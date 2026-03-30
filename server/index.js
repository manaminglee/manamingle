require('dotenv').config(
  process.env.DOTENV_CONFIG_PATH ? { path: process.env.DOTENV_CONFIG_PATH } : {}
);

/**
 * Mana Mingle - Secure backend: interest-based group video (max 4), WebRTC signaling, WebSockets
 */
const express = require('express');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const geoip = require('geoip-lite');
const { createClient } = require('@supabase/supabase-js');

// Persistence Strategy: Supabase (Cloud) or Local JSON (Node)
const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_ANON_KEY || '').trim();
let supabase = null;

// Local DB State (Fallback)
const LOCAL_DB_PATH = path.join(__dirname, 'data', 'matrix_hub.json');
let localDb = { creators: [], referral_logs: [], withdrawals: [] };

function loadLocalDb() {
  try {
    if (!fs.existsSync(path.dirname(LOCAL_DB_PATH))) fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive: true });
    if (fs.existsSync(LOCAL_DB_PATH)) {
      localDb = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, 'utf8'));
      console.log('[MATRIX] Local Node Storage Synchronized.');
    }
  } catch (e) { console.error('[MATRIX] Local DB Load Failed', e); }
}

function saveLocalDb() {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(localDb, null, 2));
  } catch (e) { console.error('[MATRIX] Local DB Sync Failed', e); }
}

if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('[MATRIX] Supabase Uplink Initialized.');
} else {
  console.warn('[MATRIX] SUPABASE_URL missing or invalid. Engaging Local Node Storage.');
  loadLocalDb();
}

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Validate sensitive config at startup (never log secret values)
function validateEnv() {
  const adminKey = process.env.ADMIN_KEY;
  if (NODE_ENV === 'production') {
    if (!adminKey || typeof adminKey !== 'string' || adminKey.length < 16) {
      console.warn(
        '[SECURITY] In production, set a strong ADMIN_KEY (min 16 chars) in .env to enable the admin panel. ' +
        'See .env.example.'
      );
    }
  }
  // Never log ADMIN_KEY, TURN_PASSWORD, or any env value that could be secret
}
validateEnv();

function countryFromIP(ip) {
  const parsed = geoip.lookup(ip);
  return parsed?.country || null;
}

const GROUP_MAX = 4;
const PAIR_MAX = 2;

// Runtime feature flags / settings
const settings = {
  adsEnabled: false,
  allowDevTools: false,
  maintenanceMode: false,
  safetyAiEnabled: true,
  coinsEnabled: true,
  guestRegistration: true,
  adScripts: {
    hero: '',
    sidebar: '',
    footer: '',
  }
};

// interestKey -> roomId (for groups: "interest_mode")
const interestToRoom = new Map();
const rooms = new Map();
const users = new Map();
// 1:1 queues: mode -> [{ socketId, userData, interest }]
const pairQueues = { text: [], video: [] };
// Group queues: interestKey -> [{ socketId, userData }]
const groupQueues = new Map();

// Admin & Safety State
const blockedIps = new Set();
const warnedIps = new Set();
const userBlocks = new Map(); // ip -> Set of blocked IPs (user-level block list)
const reports = [];
const stats = { totalMessages: 0, totalConnections: 0, uniqueIps: new Set() };
const coinUsers = new Map(); // ip -> { coins: 0, lastClaim: 0, streak: 0, lastClaimDate: null }

const statsHistory = []; // { timestamp, users, rooms }
setInterval(() => {
  statsHistory.push({
    timestamp: Date.now(),
    users: users.size,
    rooms: rooms.size,
  });
  if (statsHistory.length > 60) statsHistory.shift(); // Keep last hour
}, 60000);

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function sanitize(str, max = 50) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, max).replace(/[<>]/g, '');
}

function interestKey(interest, mode) {
  return `${interest}_${mode}`;
}

function getRoomByInterestKey(key, returnEvenIfFull = false) {
  const roomId = interestToRoom.get(key);
  if (!roomId) return null;
  const room = rooms.get(roomId);
  if (!room) {
    interestToRoom.delete(key);
    return null;
  }
  if (!returnEvenIfFull && room.users.size >= room.maxSize) {
    return null;
  }
  return room;
}

function getAnyRoomByMode(mode) {
  for (const [, room] of rooms) {
    if (room.mode === mode && room.users.size < room.maxSize) return room;
  }
  return null;
}

const MESSAGE_HISTORY = 50;

function createRoom(interest, mode, socketId, userData, maxSize = GROUP_MAX) {
  const roomId = generateId('room');
  const key = interestKey(interest, mode);
  const u = users.get(socketId);
  const room = {
    id: roomId,
    interest,
    mode,
    interestKey: mode === 'group_text' || mode === 'group_video' ? key : null,
    maxSize,
    users: new Set([socketId]),
    participants: [{ socketId, userId: userData.id, nickname: userData.nickname, country: userData.country, isCreator: !!u?.isCreator }],
    messages: [],
    createdAt: Date.now(),
  };
  rooms.set(roomId, room);
  if (room.interestKey) interestToRoom.set(key, roomId);
  return room;
}

function addUserToRoom(room, socketId, userData) {
  if (room.users.size >= room.maxSize) return false;
  const u = users.get(socketId);
  room.users.add(socketId);
  room.participants.push({ socketId, userId: userData.id, nickname: userData.nickname, country: userData.country, isCreator: !!u?.isCreator });
  return true;
}

function removeUserFromRoom(socketId, roomId, io) {
  const room = rooms.get(roomId);
  if (!room) return;
  room.users.delete(socketId);
  room.participants = room.participants.filter((p) => p.socketId !== socketId);
  const userData = users.get(socketId);
  if (room.users.size > 0) {
    io.to(roomId).emit('user-left', {
      userId: socketId,
      nickname: userData?.nickname || 'Anonymous',
      roomId,
      participantCount: room.users.size,
    });

    // Check if anyone is waiting in the queue for this group
    if (room.interestKey) {
      const q = groupQueues.get(room.interestKey) || [];
      if (q.length > 0) {
        // Pop next available valid user
        while (q.length > 0) {
          const nextUser = q.shift();
          const nextSocket = io.sockets.sockets.get(nextUser.socketId);
          if (nextSocket && users.has(nextUser.socketId)) {
            // Let them join
            const actuallyAdded = addUserToRoom(room, nextUser.socketId, nextUser.userData);
            if (actuallyAdded) {
              nextUser.userData.rooms.add(room.id);
              nextSocket.join(room.id);
              // Send them joined events
              const peers = room.participants
                .filter((p) => p.socketId !== nextUser.socketId)
                .map((p) => {
                  const u = users.get(p.socketId);
                  return { socketId: p.socketId, userId: u?.id, nickname: p.nickname, country: u?.country };
                });
              nextSocket.emit('group-joined', {
                roomId: room.id,
                mode: room.mode,
                interest: room.interest,
                participantCount: room.users.size,
                country: nextUser.userData.country,
              });
              nextSocket.emit('existing-peers', { roomId: room.id, peers, total: peers.length });
              nextSocket.emit('chat-history', { roomId: room.id, messages: (room.messages || []).slice(-MESSAGE_HISTORY) });
              nextSocket.to(room.id).emit('user-joined', {
                roomId: room.id,
                socketId: nextUser.socketId,
                userId: nextUser.userData.id,
                nickname: nextUser.userData.nickname,
                country: nextUser.userData.country,
                participantCount: room.users.size,
              });
              break;
            }
          }
        }
      }
    }
  } else {
    rooms.delete(roomId);
    if (room.interestKey) interestToRoom.delete(room.interestKey);
  }
}

function emitOnlineCount() {
  const regions = { in: 0, us: 0, eu: 0, ot: 0 };
  const EU_CODES = ['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE','GB'];
  
  users.forEach(u => {
    const c = u.country;
    if (c === 'IN') regions.in++;
    else if (c === 'US') regions.us++;
    else if (EU_CODES.includes(c)) regions.eu++;
    else regions.ot++;
  });
  
  io.emit('online_count', { count: users.size, regions });
}

// Express app
const app = express();
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: NODE_ENV === 'production'
    ? [
      'https://manamingle.site',
      'https://www.manamingle.site',
      process.env.FRONTEND_ORIGIN,
      'http://localhost:5173',
    ].filter(Boolean)
    : true,
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests' },
  standardHeaders: true,
}));

// Public settings (for client feature flags like ads, dev tools)
app.get('/api/settings', (req, res) => {
  res.json({ adsEnabled: settings.adsEnabled, allowDevTools: settings.allowDevTools });
});

// --- CREATOR MATRIX HUB (High Priority) ---
app.post('/api/creators/register', async (req, res) => {
  const { handle, platform, link } = req.body || {};
  const ip = req.ip === '::1' ? '127.0.0.1' : req.ip;
  const referral_code = crypto.randomBytes(3).toString('hex');
  const entry = {
    id: generateId('creator'),
    handle_name: sanitize(handle, 30),
    platform: sanitize(platform, 20),
    profile_link: sanitize(link, 200),
    authorized_ips: [ip],
    referral_code,
    status: 'pending',
    coins_earned: 0,
    earnings_rs: 0,
    password: null,
    created_at: new Date().toISOString()
  };
  try {
    if (supabase) {
      await supabase.from('creators').insert(entry);
    } else {
      const existing = localDb.creators.find(c => c.handle_name === entry.handle_name);
      if (existing) return res.status(400).json({ error: 'Identity handle already registered.' });
      localDb.creators.push(entry);
      saveLocalDb();
    }
    res.json({ success: true, message: 'Application Transmitted.', accessKey: referral_code });
  } catch (e) { res.status(500).json({ error: 'Database uplink failed' }); }
});

app.post('/api/creators/login', async (req, res) => {
  const { handle, password } = req.body || {};
  const currentIp = req.ip === '::1' ? '127.0.0.1' : req.ip;
  if (!handle || !password) return res.status(400).json({ error: 'Incomplete Signal' });
  try {
    let creator = null;
    if (supabase) {
      const { data } = await supabase.from('creators').select('*').eq('handle_name', handle).eq('password', password).single();
      creator = data;
    } else {
      creator = localDb.creators.find(c => c.handle_name === handle && c.password === password);
    }
    if (!creator) return res.status(401).json({ error: 'Neural Key Mismatch' });
    if (creator.status !== 'approved') return res.status(403).json({ error: 'Node Pending Appraisal' });

    // Link current IP if not already linked
    if (!creator.authorized_ips.includes(currentIp)) {
      creator.authorized_ips.push(currentIp);
      if (supabase) {
        await supabase.from('creators').update({ authorized_ips: creator.authorized_ips }).eq('id', creator.id);
      } else {
        saveLocalDb();
      }
    }
    res.json({ success: true, data: creator });
  } catch (e) { res.status(500).json({ error: 'Authentication Failed' }); }
});

app.get('/api/creators/status', async (req, res) => {
  const { id, handle } = req.query || {};
  const ip = req.ip === '::1' ? '127.0.0.1' : req.ip;
  try {
    let creator = null;
    if (supabase) {
      if (id) {
        const { data } = await supabase.from('creators').select('*').eq('referral_code', id).single();
        creator = data;
      } else if (handle) {
        const { data } = await supabase.from('creators').select('*').eq('handle_name', handle).single();
        creator = data;
      } else {
        const { data } = await supabase.from('creators').select('*').contains('authorized_ips', [ip]).single();
        creator = data;
      }
    } else {
      if (id) creator = localDb.creators.find(c => c.referral_code === id);
      else if (handle) creator = localDb.creators.find(c => c.handle_name === handle);
      else creator = localDb.creators.find(c => c.authorized_ips.includes(ip));
    }
    res.json({ data: creator || null });
  } catch (e) { res.json({ data: null }); }
});

// --- ADMIN CONTROL CENTER ---
app.get('/api/admin/creators', async (req, res) => {
  const { key } = req.query || {};
  if (key !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Access Denied' });
  try {
    if (supabase) {
      const { data } = await supabase.from('creators').select('*').order('created_at', { ascending: false });
      res.json({ data });
    } else {
      res.json({ data: [...localDb.creators].reverse() });
    }
  } catch (e) { res.status(500).json({ error: 'Admin query failed' }); }
});

app.post('/api/admin/creators/approve', async (req, res) => {
  const { key, creatorId, status } = req.body || {};
  if (key !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Access Denied' });
  try {
    let creator = null;
    if (supabase) {
      const { data } = await supabase.from('creators').select('*').eq('id', creatorId).single();
      creator = data;
    } else {
      creator = localDb.creators.find(x => x.id === creatorId);
    }
    if (!creator) return res.status(404).json({ error: 'Node Not Found' });

    let updates = { status };
    if (status === 'approved' && !creator.password) {
      const pin = Math.floor(1000 + Math.random() * 9000);
      updates.password = `${creator.handle_name}@${pin}`;
    }

    if (supabase) {
      await supabase.from('creators').update(updates).eq('id', creatorId);
    } else {
      Object.assign(creator, updates);
      saveLocalDb();
    }
    res.json({ success: true, password: updates.password });
  } catch (e) { res.status(500).json({ error: 'Approval failed' }); }
});

app.post('/api/creators/verify-ref', async (req, res) => {
  const { code } = req.body || {};
  const visitorIp = req.ip === '::1' ? '127.0.0.1' : req.ip;
  if (!code) return res.status(400).json({ error: 'Empty Signal' });
  try {
    let creator = null;
    if (supabase) {
      const { data } = await supabase.from('creators').select('*').eq('referral_code', code).single();
      creator = data;
    } else {
      creator = localDb.creators.find(c => c.referral_code === code);
    }
    if (!creator) return res.status(404).json({ error: 'Creator not found' });
    let logExists = false;
    if (supabase) {
      const { data } = await supabase.from('referral_logs').select('*').eq('creator_id', creator.id).eq('visitor_ip', visitorIp).single();
      logExists = !!data;
    } else {
      logExists = localDb.referral_logs.some(l => l.creator_id === creator.id && l.visitor_ip === visitorIp);
    }
    if (logExists) return res.json({ success: true, already_claimed: true });
    if (supabase) {
      await supabase.from('referral_logs').insert({ creator_id: creator.id, visitor_ip: visitorIp });
      const newCoins = (creator.coins_earned || 0) + 10;
      const newEarnings = Math.floor(newCoins / 10000) * 150;
      await supabase.from('creators').update({ coins_earned: newCoins, earnings_rs: newEarnings }).eq('id', creator.id);
    } else {
      localDb.referral_logs.push({ creator_id: creator.id, visitor_ip: visitorIp, created_at: new Date().toISOString() });
      creator.coins_earned = (creator.coins_earned || 0) + 10;
      creator.earnings_rs = Math.floor(creator.coins_earned / 10000) * 150;
      saveLocalDb();
    }
    if (!coinUsers.has(visitorIp)) coinUsers.set(visitorIp, { coins: 30, lastClaim: 0, streak: 1, lastClaimDate: null });
    const u = coinUsers.get(visitorIp);
    u.coins += 5;
    coinUsers.set(visitorIp, u);
    res.json({ success: true, message: 'Referral node synchronized' });
  } catch (e) { res.status(500).json({ error: 'Sync failed' }); }
});

app.post('/api/creators/withdraw', async (req, res) => {
  const { upi } = req.body || {};
  const ip = req.ip === '::1' ? '127.0.0.1' : req.ip;
  try {
     let creator = null;
     if (supabase) {
       const { data } = await supabase.from('creators').select('*').eq('ip_addr', ip).single();
       creator = data;
     } else {
       creator = localDb.creators.find(c => c.ip_addr === ip);
     }
     if (!creator || creator.status !== 'approved') return res.status(403).json({ error: 'Creator not approved' });
     if (creator.earnings_rs < 1500) return res.status(400).json({ error: 'Threshold (₹1500) not reached' });
     const wdEntry = {
       id: generateId('wd'),
       creator_id: creator.id,
       handle_name: creator.handle_name,
       amount: creator.earnings_rs, 
       upi: sanitize(upi, 100), 
       status: 'pending',
       created_at: new Date().toISOString()
     };
     if (supabase) {
       await supabase.from('withdrawals').insert(wdEntry);
       await supabase.from('creators').update({ earnings_rs: 0, coins_earned: 0 }).eq('id', creator.id);
     } else {
       localDb.withdrawals.push(wdEntry);
       creator.earnings_rs = 0;
       creator.coins_earned = 0;
       saveLocalDb();
     }
     res.json({ success: true, message: 'Withdrawal request logged.' });
  } catch(e) { res.status(500).json({ error: 'Withdrawal uplink failed' }); }
});

app.use('/api', (req, res, next) => {
  console.log(`[API_TRACE] ${req.method} ${req.originalUrl}`);
  next();
});

// Get active interests for group chats
app.get('/api/rooms/active-interests', (req, res) => {
  const mode = req.query.mode || 'group_video';
  const interestCounts = new Map();

  for (const room of rooms.values()) {
    if (room.mode === mode && room.interest && room.interest !== 'general') {
      const currentCount = interestCounts.get(room.interest) || 0;
      interestCounts.set(room.interest, currentCount + room.users.size);
    }
  }

  const results = Array.from(interestCounts.entries())
    .map(([interest, count]) => ({ interest, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  res.json({ interests: results });
});

// Cloudflare Turnstile verification
app.post('/api/verify-turnstile', async (req, res) => {
  const { token } = req.body || {};
  const secret = process.env.TURNSTILE_SECRET_KEY || '1x0000000000000000000000000000000AA';
  if (!token) return res.status(400).json({ success: false, error: 'Token required' });
  try {
    const ip = req.ip === '::1' ? '127.0.0.1' : req.ip;
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    });
    const data = await r.json();
    if (data.success) return res.json({ success: true });
    return res.status(400).json({ success: false, 'error-codes': data['error-codes'] });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

// Admin auth: timing-safe comparison so key is not leaked by response time
function requireAdmin(req, res, next) {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || typeof adminKey !== 'string') {
    return res.status(503).json({ error: 'Admin panel not configured' });
  }
  const provided = (req.header('x-admin-key') || '').toString();
  try {
    const a = Buffer.from(adminKey, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Admin: toggle settings like ads, allowDevTools, maintenanceMode, etc.
app.post('/api/admin/settings', requireAdmin, (req, res) => {
  const body = req.body || {};
  Object.keys(settings).forEach(key => {
    if (key === 'adScripts' && typeof body[key] === 'object') settings[key] = body[key];
    else if (typeof body[key] === 'boolean') settings[key] = body[key];
  });
  io.emit('settings_updated', settings);
  res.json(settings);
});

// Admin: high-level overview of current activity
app.get('/api/admin/overview', requireAdmin, (req, res) => {
  const roomList = Array.from(rooms.values()).map((room) => ({
    id: room.id,
    mode: room.mode,
    interest: room.interest,
    participantCount: room.users.size,
    participants: room.participants, // Full list for visual monitoring
    createdAt: room.createdAt,
  }));

  const userList = Array.from(users.values()).map(u => ({
    nickname: u.nickname,
    country: u.country,
    ip: u.ip,
    mode: u.mode || 'idle',
    socketId: u.socketId
  }));

  const coinStats = {
    totalUsers: coinUsers.size,
    totalCoinsInSystem: Array.from(coinUsers.values()).reduce((sum, u) => sum + (u.coins || 0), 0)
  };

  const userWallets = {};
  for (const [ip, data] of coinUsers.entries()) {
    userWallets[ip] = data.coins || 0;
  }

  res.json({
    ...settings,
    users: users.size,
    rooms: rooms.size,
    queues: {
      text: pairQueues.text.length,
      video: pairQueues.video.length,
    },
    roomList,
    userList,
    userWallets,
    coinStats,
    reports,
    openReportsCount: reports.length,
    blockedIps: Array.from(blockedIps),
    stats: {
      totalMessages: stats.totalMessages,
      totalConnections: stats.totalConnections,
      uniqueIps: stats.uniqueIps.size,
      uptimeSeconds: Math.floor(process.uptime()),
    },
    statsHistory,
    warnedIps: Array.from(warnedIps),
    memory: process.memoryUsage(),
  });
});

app.post('/api/admin/warn', requireAdmin, (req, res) => {
  const { ip, message } = req.body || {};
  if (!ip) return res.status(400).json({ error: 'IP required' });
  warnedIps.add(ip);
  let count = 0;
  for (const [socketId, user] of users.entries()) {
    if (user.ip === ip) {
      io.to(socketId).emit('content-flagged', { message: message || '⚠️ SYSTEM WARNING: Your behavior has been flagged. Please follow community rules.' });
      count++;
    }
  }
  res.json({ success: true, warned: count });
});

app.post('/api/admin/unwarn', requireAdmin, (req, res) => {
  const { ip } = req.body || {};
  if (ip) warnedIps.delete(ip);
  res.json({ success: true });
});

app.post('/api/admin/coins/update', requireAdmin, (req, res) => {
  const { ip, amount, set } = req.body || {};
  if (!ip) return res.status(400).json({ error: 'IP required' });

  if (!coinUsers.has(ip)) {
    coinUsers.set(ip, { coins: 30, lastClaim: 0, streak: 1, lastClaimDate: null });
  }

  const user = coinUsers.get(ip);
  if (set) user.coins = parseInt(amount);
  else user.coins += parseInt(amount);

  coinUsers.set(ip, user);

  // Find connected sockets with this IP and notify them
  for (const [sid, u] of users.entries()) {
    if (u.ip === ip) {
      io.to(sid).emit('coins-updated', { coins: user.coins });
    }
  }

  res.json({ success: true, balance: user.coins });
});

app.post('/api/admin/block', requireAdmin, (req, res) => {
  const { ip } = req.body || {};
  if (ip) {
    blockedIps.add(ip);
    // Find online users with this IP and boot them
    for (const [socketId, user] of users.entries()) {
      if (user.ip === ip) {
        io.to(socketId).emit('blocked-ip');
        io.sockets.sockets.get(socketId)?.disconnect(true);
      }
    }
  }
  res.json({ success: true, blockedIps: Array.from(blockedIps) });
});

app.post('/api/admin/unblock', requireAdmin, (req, res) => {
  const { ip } = req.body || {};
  if (ip) blockedIps.delete(ip);
  res.json({ success: true, blockedIps: Array.from(blockedIps) });
});

app.post('/api/admin/resolve-report', requireAdmin, (req, res) => {
  const { reportId } = req.body || {};
  const reportIndex = reports.findIndex(r => r.id === reportId);
  if (reportIndex !== -1) reports.splice(reportIndex, 1);
  res.json({ success: true, reports });
});

app.post('/api/admin/announcement', requireAdmin, (req, res) => {
  const { message } = req.body || {};
  if (message) {
    io.emit('system-announcement', { message });
  }
  res.json({ success: true });
});

app.post('/api/admin/content-flagged', requireAdmin, (req, res) => {
  const { ip, message } = req.body || {};
  if (!ip) return res.status(400).json({ error: 'IP required' });
  let count = 0;
  for (const [socketId, user] of users.entries()) {
    if (user.ip === ip) {
      io.to(socketId).emit('content-flagged', { message: message || 'Your content was flagged for review. Please follow community guidelines.' });
      count++;
    }
  }
  res.json({ success: true, notified: count });
});

app.post('/api/admin/end-room', requireAdmin, (req, res) => {
  const { roomId } = req.body || {};
  const room = rooms.get(roomId);
  if (room) {
    io.to(roomId).emit('room-ended-by-admin');
    [...room.users].forEach(sid => {
      const s = io.sockets.sockets.get(sid);
      if (s) s.leave(roomId);
    });
    rooms.delete(roomId);
    if (room.interestKey) interestToRoom.delete(room.interestKey);
    return res.json({ success: true });
  }
  res.status(404).json({ error: 'Room not found' });
});

app.post('/api/admin/killswitch', requireAdmin, (req, res) => {
  let kickCount = 0;
  for (const [socketId] of users.entries()) {
    io.sockets.sockets.get(socketId)?.disconnect(true);
    kickCount++;
  }
  // Clear serverside caches just in case
  pairQueues.text = [];
  pairQueues.video = [];
  rooms.clear();
  interestToRoom.clear();
  users.clear();
  userBlocks.clear();
  io.emit('online_count', { count: 0 }); // Update anyone reconnecting
  res.json({ success: true, kicked: kickCount });
});

// Health
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    users: users.size,
    rooms: rooms.size,
  });
});

// API TURN/ICE (optional TURN later)
function normalizeTurnUrl(url) {
  if (!url || typeof url !== 'string') return 'turn:global.relay.metered.ca:443';
  const s = url.trim();
  if (s.startsWith('stun:') || s.startsWith('turn:') || s.startsWith('turns:')) return s;
  return `turn:${s}`;
}
app.get('/api/turn', (req, res) => {
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  if (process.env.TURN_USERNAME && process.env.TURN_PASSWORD) {
    iceServers.push({
      urls: normalizeTurnUrl(process.env.TURN_URL || 'turn:global.relay.metered.ca:443'),
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_PASSWORD,
    });
  } else {
    // Free Public TURN relay fallback for robust cross-network P2P connections
    iceServers.push({
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    });
    iceServers.push({
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    });
    iceServers.push({
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    });
  }
  res.json({ iceServers });
});

// COIN SYSTEM API
const COIN_CLAIM_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

app.post('/api/user/credit-age', (req, res) => {
  const ip = req.ip === '::1' ? '127.0.0.1' : req.ip;
  if (!coinUsers.has(ip)) {
    coinUsers.set(ip, { coins: 30, lastClaim: 0, streak: 1, lastClaimDate: null });
  }
  res.json({ success: true });
});

app.get('/api/user/coins', (req, res) => {
  const ip = req.ip === '::1' ? '127.0.0.1' : req.ip;
  if (!coinUsers.has(ip)) {
    coinUsers.set(ip, { coins: 30, lastClaim: 0, streak: 1, lastClaimDate: null });
  }
  const user = coinUsers.get(ip);
  const now = Date.now();
  const nextClaim = user.lastClaim + COIN_CLAIM_INTERVAL_MS;

  res.json({
    coins: user.coins,
    streak: user.streak,
    canClaim: now >= nextClaim,
    nextClaim: Math.max(0, nextClaim - now)
  });
});

app.post('/api/user/claim', (req, res) => {
  const ip = req.ip === '::1' ? '127.0.0.1' : req.ip;
  const user = coinUsers.get(ip) || { coins: 0, lastClaim: 0, streak: 0, lastClaimDate: null };
  const now = Date.now();
  const waitTime = COIN_CLAIM_INTERVAL_MS;

  if (now < user.lastClaim + waitTime) {
    return res.status(400).json({ error: 'Too early to claim' });
  }

  // Streak logic (daily check)
  const today = new Date().toDateString();
  const yesterday = new Date(now - 86400000).toDateString();

  if (user.lastClaimDate === yesterday) {
    user.streak += 1;
  } else if (user.lastClaimDate !== today) {
    user.streak = 1;
  }

  // 30 coins base + bonus (5 per streak day, max 50 bonus)
  const bonus = user.streak > 1 ? Math.min((user.streak - 1) * 5, 50) : 0;
  user.coins += (30 + bonus);
  user.lastClaim = now;
  user.lastClaimDate = today;
  coinUsers.set(ip, user);

  res.json({ coins: user.coins, streak: user.streak, bonus });
});

app.post('/api/user/spend', (req, res) => {
  const { amount } = req.body;
  const ip = req.ip === '::1' ? '127.0.0.1' : req.ip;
  const user = coinUsers.get(ip);

  if (!user || user.coins < amount) {
    return res.status(400).json({ error: 'Insufficient coins' });
  }

  user.coins -= amount;
  coinUsers.set(ip, user);
  res.json({ success: true, balance: user.coins });
});

// NVIDIA AI PROXY
app.post('/api/ai/spark', async (req, res) => {
  const { interest } = req.body || {};
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'AI Service Offline' });

  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'meta/llama3-70b-instruct',
        messages: [
          {
            role: 'system',
            content: 'You are a friendly ice-breaker for an anonymous chat app. Provide one short, intriguing question or prompt to start a conversation based on the user interest. Maximum 15 words. No hashtags.'
          },
          {
            role: 'user',
            content: `Interest: ${interest || 'general'}`
          }
        ],
        temperature: 0.7,
        max_tokens: 50,
      }),
    });
    const data = await response.json();
    const message = data.choices?.[0]?.message?.content?.replace(/["']/g, '');
    res.json({ spark: message || 'Hello! What is on your mind today?' });
  } catch (err) {
    res.status(500).json({ error: 'AI generation failed' });
  }
});

app.post('/api/ai/reply', async (req, res) => {
  const { lastMessage } = req.body || {};
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'AI Service Offline' });

  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'meta/llama3-70b-instruct',
        messages: [
          {
            role: 'system',
            content: 'You are an AI generating 3 short, natural, modern quick-reply options for a chat application. Based on the stranger\'s last message, suggest 3 highly distinct responses (maximum 4 words each). Output them separated by commas like: Haha exactly, No way!, Tell me more. Do not include quotes or numbers.'
          },
          {
            role: 'user',
            content: `Stranger: ${lastMessage || 'Hi'}`
          }
        ],
        temperature: 0.8,
        max_tokens: 30,
      }),
    });
    const data = await response.json();
    const suggestions = data.choices?.[0]?.message?.content?.split(',').map(s => s.trim().replace(/['"]/g, '')) || ['Yes', 'No', 'Haha'];
    res.json({ replies: suggestions.slice(0, 3) });
  } catch (err) {
    res.status(500).json({ error: 'AI reply failed' });
  }
});

app.post('/api/ai/suggest', async (req, res) => {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'AI Offline' });

  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'meta/llama3-70b-instruct',
        messages: [
          {
            role: 'system',
            content: 'Suggest 5 trending or intriguing short interests/topics for a chat application. Format: Only the words separated by commas. Example: Gaming, Space, AI, Music, Books. No numbers, no extra text.'
          }
        ],
        temperature: 0.9,
      }),
    });
    const data = await response.json();
    const suggestions = data.choices?.[0]?.message?.content?.split(',').map(s => s.trim().replace(/[.]/g, '')) || [];
    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: 'AI failed' });
  }
});

app.post('/api/ai/translate', async (req, res) => {
  const { text } = req.body || {};
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'AI Service Offline' });
  if (!text) return res.json({ translated: '' });

  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'meta/llama3-70b-instruct',
        messages: [
          {
            role: 'system',
            content: 'Translate the following message to clear, natural English. Only return the translated text without quotes or preamble.'
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });
    const data = await response.json();
    const translated = data.choices?.[0]?.message?.content?.replace(/["']/g, '');
    res.json({ translated: translated || text });
  } catch (err) {
    res.status(500).json({ error: 'AI translation failed' });
  }
});


app.post('/api/admin/creators/approve', requireAdmin, async (req, res) => {
  const { creatorId, status } = req.body || {};
  try {
    if (supabase) {
      await supabase.from('creators').update({ status }).eq('id', creatorId);
    } else {
      const c = localDb.creators.find(x => x.id === creatorId);
      if (c) {
        c.status = status;
        saveLocalDb();
      }
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'Approval failed' }); }
});

app.get('/api/admin/creators/list', requireAdmin, async (req, res) => {
  try {
    if (supabase) {
      const { data: creators } = await supabase.from('creators').select('*');
      const { data: withdrawals } = await supabase.from('withdrawals').select('*, creators(handle_name)');
      return res.json({ creators: creators || [], withdrawals: withdrawals || [] });
    } else {
      return res.json({ creators: localDb.creators || [], withdrawals: localDb.withdrawals || [] });
    }
  } catch (e) { res.json({ creators: [], withdrawals: [] }); }
});

// API 404 Fallback
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: 'Matrix endpoint not found' });
});

// Serve React build when client/dist exists (single-host deploy). Else API-only (Vercel frontend).
const clientBuild = path.join(__dirname, '..', 'client', 'dist');
const clientExists = fs.existsSync(path.join(clientBuild, 'index.html'));
if (clientExists) {
  app.use(express.static(clientBuild, { index: false }));
}
app.get(/^(?!\/api|\/socket\.io|\/health)/, (req, res, next) => {
  if (clientExists) {
    return res.sendFile(path.join(clientBuild, 'index.html'), (err) => {
      if (err) next();
    });
  }
  const frontendUrl = process.env.FRONTEND_ORIGIN || 'https://manamingle.vercel.app';
  const url = frontendUrl.split(',')[0].trim();
  res.redirect(302, url);
});

const server = http.createServer(app);

const io = new Server(server, {
  path: '/socket.io',
  cors: { origin: NODE_ENV === 'production' ? process.env.FRONTEND_ORIGIN || true : true, credentials: true },
  pingTimeout: 30000,
  pingInterval: 15000,
});

// Per-socket rate limit for signaling
const signalCount = new Map();
function isSignalRateLimited(socketId) {
  const now = Date.now();
  const entry = signalCount.get(socketId) || { count: 0, reset: now + 60000 };
  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + 60000;
  }
  entry.count++;
  signalCount.set(socketId, entry);
  return entry.count > 300;
}

io.on('connection', (socket) => {
  const userId = generateId('usr');
  const ip = socket.handshake.headers['x-forwarded-for']?.split(',')[0]?.trim() || socket.handshake.address;
  const country = countryFromIP(ip);

  stats.totalConnections++;
  stats.uniqueIps.add(ip);

  if (settings.maintenanceMode) {
    socket.emit('system-maintenance', { message: 'ManaMingle is currently undergoing scheduled maintenance. Please check back later!' });
    return socket.disconnect(true);
  }

  if (blockedIps.has(ip)) {
    socket.emit('blocked-ip', { message: 'Your IP has been blocked. Please pay to unblock.' });
    socket.disconnect(true);
    return;
  }

  users.set(socket.id, {
    id: userId,
    ip,
    country,
    nickname: 'Anonymous',
    rooms: new Set(),
    isCreator: false,
    creatorData: null
  });

  (async () => {
    let finalNick = 'Anonymous';
    let finalIsCreator = false;
    if (supabase) {
      const { data } = await supabase.from('creators').select('*').contains('authorized_ips', [ip]).eq('status', 'approved').single();
      if (data) {
        const u = users.get(socket.id);
        if (u) {
          u.isCreator = true;
          u.nickname = data.handle_name;
          u.creatorData = data;
          finalNick = u.nickname;
          finalIsCreator = true;
        }
      }
    } else {
      const data = localDb.creators.find(c => c.authorized_ips.includes(ip) && c.status === 'approved');
      if (data) {
        const u = users.get(socket.id);
        if (u) {
          u.isCreator = true;
          u.nickname = data.handle_name;
          u.creatorData = data;
          finalNick = u.nickname;
          finalIsCreator = true;
        }
      }
    }
    socket.emit('connected', { userId, nickname: finalNick, isCreator: finalIsCreator, country, settings: { adsEnabled: settings.adsEnabled, allowDevTools: settings.allowDevTools } });
    emitOnlineCount();
  })();

  socket.on('report-user', (data) => {
    let targetIp = 'unknown';
    // find opponent in rooms
    for (const [roomId, room] of rooms) {
      if (room.users.has(socket.id)) {
        for (let pt of room.participants) {
          if (pt.socketId !== socket.id) {
            const opponentData = users.get(pt.socketId);
            if (opponentData) targetIp = opponentData.ip || targetIp;
          }
        }
      }
    }
    reports.push({
      id: generateId('rpt'),
      reporterIp: ip,
      targetIp,
      reason: data?.reason || 'Inappropriate Behavior',
      timestamp: Date.now()
    });
  });

  socket.on('block-user', (data) => {
    let targetIp = null;
    if (data?.targetSocketId) {
      const u = users.get(data.targetSocketId);
      if (u) targetIp = u.ip;
    }
    if (!targetIp) {
      for (const [, room] of rooms) {
        if (room.users.has(socket.id)) {
          for (const pt of room.participants) {
            if (pt.socketId !== socket.id) {
              const opp = users.get(pt.socketId);
              if (opp) { targetIp = opp.ip; break; }
            }
          }
          if (targetIp) break;
        }
      }
    }
    if (targetIp && targetIp !== ip) {
      if (!userBlocks.has(ip)) userBlocks.set(ip, new Set());
      userBlocks.get(ip).add(targetIp);
    }
  });

  // Find partner for 1:1 text or video
  socket.on('find-partner', (data) => {
    const userData = users.get(socket.id);
    if (!userData) return;
    const mode = data?.mode === 'video' ? 'video' : 'text';
    const interest = sanitize(String(data?.interest || 'general').toLowerCase(), 30) || 'general';
    const nickname = sanitize(data?.nickname || 'Anonymous', 30);
    userData.nickname = nickname;

    const myBlocks = userBlocks.get(ip);
    const canMatch = (e) => {
      if (e.socketId === socket.id) return false;
      const otherIp = users.get(e.socketId)?.ip;
      if (!otherIp || blockedIps.has(otherIp)) return false;
      if (myBlocks && myBlocks.has(otherIp)) return false;
      if (userBlocks.get(otherIp)?.has(ip)) return false;
      return true;
    };
    const queue = pairQueues[mode];
    let match = queue.find((e) => e.interest === interest && canMatch(e));
    if (!match) match = queue.find(canMatch);
    if (match) {
      const idx = queue.indexOf(match);
      queue.splice(idx, 1);
      const otherData = users.get(match.socketId);
      if (!otherData || !io.sockets.sockets.get(match.socketId)) return;
      const room = createRoom(interest, mode, socket.id, { id: userData.id, nickname: userData.nickname, country: userData.country }, PAIR_MAX);
      addUserToRoom(room, match.socketId, { id: otherData.id, nickname: otherData.nickname, country: otherData.country });
      userData.rooms.add(room.id);
      otherData.rooms.add(room.id);
      socket.join(room.id);
      io.sockets.sockets.get(match.socketId).join(room.id);

      const myPeer = { socketId: socket.id, userId: userData.id, nickname: userData.nickname, country: userData.country };
      const otherPeer = { socketId: match.socketId, userId: otherData.id, nickname: otherData.nickname, country: otherData.country };

      socket.emit('partner-found', { roomId: room.id, peer: otherPeer, country: userData.country });
      io.sockets.sockets.get(match.socketId).emit('partner-found', { roomId: room.id, peer: myPeer, country: otherData.country });
      socket.emit('chat-history', { roomId: room.id, messages: [] });
      io.sockets.sockets.get(match.socketId).emit('chat-history', { roomId: room.id, messages: [] });
    } else {
      queue.push({ socketId: socket.id, userData, interest });
      socket.emit('waiting-for-partner', { mode, interest });
    }
  });

  socket.on('cancel-find-partner', () => {
    ['text', 'video'].forEach((m) => {
      pairQueues[m] = pairQueues[m].filter((e) => e.socketId !== socket.id);
    });
  });

  // Join group by interest (find or create room, max 4)
  socket.on('join-group-by-interest', (data) => {
    const userData = users.get(socket.id);
    if (!userData) return;
    const interest = sanitize(String(data?.interest || '').toLowerCase(), 30) || 'general';
    const mode = data?.mode === 'group_text' ? 'group_text' : 'group_video';
    const nickname = sanitize(data?.nickname || 'Anonymous', 30);
    userData.nickname = nickname;

    const myBlocks = userBlocks.get(ip);
    const canJoinRoom = (r) => {
      for (const p of r.participants) {
        const otherIp = users.get(p.socketId)?.ip;
        if (!otherIp || blockedIps.has(otherIp)) return false;
        if (myBlocks && myBlocks.has(otherIp)) return false;
        if (userBlocks.get(otherIp)?.has(ip)) return false;
      }
      return true;
    };

    const key = interestKey(interest, mode);
    let room = getRoomByInterestKey(key, true); // Get it even if full

    // If the room exists but is full, put them in queue instead of creating a new one
    if (room && room.users.size >= room.maxSize) {
      if (!groupQueues.has(key)) groupQueues.set(key, []);
      const q = groupQueues.get(key);
      q.push({ socketId: socket.id, userData: { id: userData.id, nickname: userData.nickname, country: userData.country, rooms: userData.rooms } });
      socket.emit('waiting-in-group-queue', { queuePosition: q.length, interest: room.interest });
      return;
    }

    if (room && !canJoinRoom(room)) room = null;
    if (!room) {
      room = getAnyRoomByMode(mode);
      if (room && !canJoinRoom(room)) room = null;
    }
    if (!room) {
      room = createRoom(interest, mode, socket.id, { id: userData.id, nickname: userData.nickname, country: userData.country });
    } else {
      const added = addUserToRoom(room, socket.id, { id: userData.id, nickname: userData.nickname, country: userData.country });
      if (!added) {
        socket.emit('room-full', { message: 'Room is full. Try again.' });
        return;
      }
    }

    userData.rooms.add(room.id);
    socket.join(room.id);

    const peers = room.participants
      .filter((p) => p.socketId !== socket.id)
      .map((p) => {
        const u = users.get(p.socketId);
        return {
          socketId: p.socketId,
          userId: u?.id,
          nickname: p.nickname,
          country: u?.country,
          isCreator: !!u?.isCreator
        };
      });

    socket.emit('group-joined', {
      roomId: room.id,
      mode,
      interest: room.interest,
      participantCount: room.users.size,
      country: userData.country,
    });
    socket.emit('existing-peers', { roomId: room.id, peers, total: peers.length });
    socket.emit('chat-history', { roomId: room.id, messages: (room.messages || []).slice(-MESSAGE_HISTORY) });

    socket.to(room.id).emit('user-joined', {
      roomId: room.id,
      socketId: socket.id,
      userId: userData.id,
      nickname: userData.nickname,
      country: userData.country,
      isCreator: !!userData.isCreator,
      participantCount: room.users.size,
    });
  });

  socket.on('join-specific-group', (data) => {
    const userData = users.get(socket.id);
    if (!userData) return;
    const { roomId, nickname } = data || {};
    if (!roomId) return socket.emit('error', { message: 'Room ID required' });
    userData.nickname = sanitize(nickname || 'Anonymous', 30);

    const room = rooms.get(roomId);
    if (!room) return socket.emit('room-full', { message: 'Room not found or expired.' });
    if (room.mode !== 'group_video' && room.mode !== 'group_text') return socket.emit('room-full', { message: 'Invalid room mode.' });

    const myBlocks = userBlocks.get(ip);
    for (const p of room.participants) {
      const otherIp = users.get(p.socketId)?.ip;
      if (!otherIp || blockedIps.has(otherIp)) return socket.emit('error', { message: 'Cannot join this room.' });
      if (myBlocks && myBlocks.has(otherIp)) return socket.emit('error', { message: 'Cannot join this room.' });
      if (userBlocks.get(otherIp)?.has(ip)) return socket.emit('error', { message: 'Cannot join this room.' });
    }

    const added = addUserToRoom(room, socket.id, { id: userData.id, nickname: userData.nickname, country: userData.country });
    if (!added) return socket.emit('room-full', { message: 'Room is full.' });

    userData.rooms.add(room.id);
    socket.join(room.id);

    const peers = room.participants
      .filter((p) => p.socketId !== socket.id)
      .map((p) => {
        const u = users.get(p.socketId);
        return { socketId: p.socketId, userId: u?.id, nickname: p.nickname, country: u?.country, isCreator: !!u?.isCreator };
      });

    socket.emit('group-joined', {
      roomId: room.id,
      mode: room.mode,
      interest: room.interest,
      participantCount: room.users.size,
      country: userData.country,
    });
    socket.emit('existing-peers', { roomId: room.id, peers, total: peers.length });
    socket.emit('chat-history', { roomId: room.id, messages: (room.messages || []).slice(-MESSAGE_HISTORY) });

    socket.to(room.id).emit('user-joined', {
      roomId: room.id,
      socketId: socket.id,
      userId: userData.id,
      nickname: userData.nickname,
      country: userData.country,
      isCreator: !!userData.isCreator,
      participantCount: room.users.size,
    });
  });

  socket.on('leave-room', (data) => {
    const roomId = String(data?.roomId || '');
    const userData = users.get(socket.id);
    const room = rooms.get(roomId);
    if (!userData || !room || !room.users.has(socket.id)) return;
    userData.rooms.delete(roomId);
    socket.leave(roomId);
    removeUserFromRoom(socket.id, roomId, io);
    socket.emit('left-room', { roomId });
  });

  socket.on('send-message', (data) => {
    const { roomId, text } = data || {};
    const u = users.get(socket.id);
    if (!u) return socket.emit('error', { message: 'Session lost. Please refresh.' });
    const room = rooms.get(roomId);
    if (!room) return socket.emit('error', { message: 'Chat room not found or closed.' });
    if (!room.users.has(socket.id)) return socket.emit('error', { message: 'You are no longer in this room.' });
    if (settings.maintenanceMode) return socket.emit('error', { message: 'Messaging disabled during maintenance.' });

    const msg = sanitize(String(text || ''), 500);
    if (!msg) return;

    // AI SAFETY MONITORING
    const profanities = [
      'fuck', 'shit', 'asshole', 'bitch', 'bastard', 'cunt', 'dick', 'pussy', 'nigga', 'nigger', 'faggot',
      'slut', 'whore', 'motherfucker', 'cock', 'jerk', 'dumbass', 'retard', 'scum',
      'porn', 'sex', 'nude', 'naked', 'xxx', 'horny', 'cum', 'cock', 'tit', 'boob', 'vagina', 'penis'
    ];
    const pattern = new RegExp(`\\b(${profanities.join('|')})\\b`, 'i');
    if (settings.safetyAiEnabled && pattern.test(msg)) {
      socket.emit('content-flagged', { message: '⚠️ MESSAGE BLOCKED: Please be respectful.' });
      return;
    }

    stats.totalMessages++;
    const entry = {
      id: generateId('msg'),
      nickname: u.nickname,
      text: msg,
      ts: Date.now(),
      socketId: socket.id,
    };
    room.messages = room.messages || [];
    room.messages.push(entry);
    if (room.messages.length > 100) room.messages = room.messages.slice(-MESSAGE_HISTORY);
    io.to(roomId).emit('chat-message', { roomId, ...entry });
  });

  socket.on('admin-end-room', (data) => {
    const { roomId, adminKey: providedKey } = data || {};
    const adminKey = process.env.ADMIN_KEY;
    if (!adminKey || providedKey !== adminKey) return;
    const room = rooms.get(roomId);
    if (room) {
      io.to(roomId).emit('room-ended-by-admin');
      [...room.users].forEach(sid => {
        const s = io.sockets.sockets.get(sid);
        if (s) s.leave(roomId);
      });
      rooms.delete(roomId);
      if (room.interestKey) interestToRoom.delete(room.interestKey);
    }
  });

  // Wave reaction
  socket.on('send-wave', (data) => {
    const { roomId } = data || {};
    const u = users.get(socket.id);
    const room = rooms.get(roomId);
    if (!u || !room || !room.users.has(socket.id)) return;
    socket.to(roomId).emit('wave-reaction', { fromSocketId: socket.id, nickname: u.nickname });
  });

  // Good vibes
  const goodVibesPending = new Map();
  socket.on('send-good-vibes', (data) => {
    const { roomId } = data || {};
    const u = users.get(socket.id);
    const room = rooms.get(roomId);
    if (!u || !room || !room.users.has(socket.id)) return;
    if (!goodVibesPending.has(roomId)) goodVibesPending.set(roomId, new Set());
    const pending = goodVibesPending.get(roomId);
    pending.add(socket.id);
    const allSent = [...room.users].every(uid => pending.has(uid));
    if (allSent) {
      io.to(roomId).emit('good-vibes-match', { roomId });
      goodVibesPending.delete(roomId);
    }
  });

  socket.on('typing', (data) => {
    const { roomId, isTyping } = data || {};
    socket.to(roomId).emit('stranger-typing', { isTyping, socketId: socket.id });
  });

  socket.on('video-style', (data) => {
    const { roomId, filter, blur, targetSocketId } = data || {};
    if (!roomId) return;
    if (targetSocketId) {
      io.to(targetSocketId).emit('stranger-video-style', { socketId: socket.id, filter, blur });
    } else {
      socket.to(roomId).emit('stranger-video-style', { socketId: socket.id, filter, blur });
    }
  });

  socket.on('spend-coins', (data) => {
    const { amount, reason } = data || {};
    const cUser = coinUsers.get(ip);
    if (!cUser || cUser.coins < amount) return socket.emit('error', { message: 'Insufficient coins' });
    cUser.coins -= amount;
    coinUsers.set(ip, cUser);
    // Notify all sockets with this IP
    for (const [sid, user] of users.entries()) {
      if (user.ip === ip) {
        io.to(sid).emit('coins-updated', { coins: cUser.coins, reason });
      }
    }
  });

  socket.on('send-3d-emoji', (data) => {
    const { roomId, emoji } = data || {};
    const u = users.get(socket.id);
    const cUser = coinUsers.get(ip);
    if (!u || !cUser || cUser.coins < 5) return socket.emit('error', { message: 'Need 5 coins for 3D Emoji' });
    cUser.coins -= 5;
    coinUsers.set(ip, cUser);
    // Notify all sockets with this IP
    for (const [sid, user] of users.entries()) {
      if (user.ip === ip) {
        io.to(sid).emit('coins-updated', { coins: cUser.coins, reason: '3D Emoji' });
      }
    }
    io.to(roomId).emit('3d-emoji', { roomId, emoji, nickname: u.nickname, socketId: socket.id });
  });

  socket.on('send-media', (data) => {
    const { roomId, type, content } = data || {};
    const u = users.get(socket.id);
    const cUser = coinUsers.get(ip);
    const cost = type === 'video' ? 15 : 10;
    if (!u || !cUser || cUser.coins < cost) return socket.emit('error', { message: `Need ${cost} coins for Media` });
    cUser.coins -= cost;
    coinUsers.set(ip, cUser);
    io.to(roomId).emit('media-message', { id: generateId('med'), roomId, type, content, nickname: u.nickname, ts: Date.now(), socketId: socket.id });
    socket.emit('coins-updated', { coins: cUser.coins });
  });

  socket.on('spend-coins', (data) => {
    const { amount, reason } = data || {};
    const cUser = coinUsers.get(ip);
    if (!cUser || cUser.coins < amount) return socket.emit('error', { message: 'Insufficient coins' });
    cUser.coins -= amount;
    coinUsers.set(ip, cUser);
    socket.emit('coins-updated', { coins: cUser.coins });
    console.log(`[COINS] User ${socket.id} spent ${amount} for ${reason}`);
  });

  socket.on('webrtc-signal', (data) => {
    if (isSignalRateLimited(socket.id)) return;
    const { roomId, targetSocketId, type, signal } = data || {};
    const userData = users.get(socket.id);
    const room = rooms.get(roomId);
    if (!userData || !room || !room.users.has(socket.id) || !room.users.has(targetSocketId)) return;
    const valid = ['offer', 'answer', 'ice-candidate'].includes(type);
    if (!valid) return;
    const target = io.sockets.sockets.get(targetSocketId);
    if (!target) return;
    target.emit('webrtc-signal', {
      fromSocketId: socket.id,
      fromUserId: userData.id,
      fromNickname: userData.nickname,
      fromCountry: userData.country,
      fromIsCreator: !!userData.isCreator,
      signal,
      type,
      roomId,
    });
  });

  socket.on('disconnect', () => {
    pairQueues.text = pairQueues.text.filter((e) => e.socketId !== socket.id);
    pairQueues.video = pairQueues.video.filter((e) => e.socketId !== socket.id);
    for (const [key, q] of groupQueues.entries()) {
      groupQueues.set(key, q.filter(u => u.socketId !== socket.id));
    }
    const userData = users.get(socket.id);
    if (userData?.rooms) {
      userData.rooms.forEach((roomId) => {
        removeUserFromRoom(socket.id, roomId, io);
      });
    }
    users.delete(socket.id);
    signalCount.delete(socket.id);
    emitOnlineCount();
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mana Mingle server listening on port ${PORT} (${NODE_ENV})`);
});
