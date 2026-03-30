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

// Load env from .env (or path from DOTENV_CONFIG_PATH). Never commit .env.
require('dotenv').config(
  process.env.DOTENV_CONFIG_PATH ? { path: process.env.DOTENV_CONFIG_PATH } : {}
);

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
const userBlocks = new Map(); // ip -> Set of blocked IPs (user-level block list)
const reports = [];
const stats = { totalMessages: 0, totalConnections: 0, uniqueIps: new Set() };
const coinUsers = new Map(); // ip -> { coins: 0, lastClaim: 0, streak: 0, lastClaimDate: null }

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
  const room = {
    id: roomId,
    interest,
    mode,
    interestKey: mode === 'group_text' || mode === 'group_video' ? key : null,
    maxSize,
    users: new Set([socketId]),
    participants: [{ socketId, userId: userData.id, nickname: userData.nickname, country: userData.country }],
    messages: [],
    createdAt: Date.now(),
  };
  rooms.set(roomId, room);
  if (room.interestKey) interestToRoom.set(key, roomId);
  return room;
}

function addUserToRoom(room, socketId, userData) {
  if (room.users.size >= room.maxSize) return false;
  room.users.add(socketId);
  room.participants.push({ socketId, userId: userData.id, nickname: userData.nickname, country: userData.country });
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
  io.emit('online_count', { count: users.size });
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

// Admin: toggle settings like ads, allowDevTools
app.post('/api/admin/settings', requireAdmin, (req, res) => {
  const { adsEnabled, allowDevTools } = req.body || {};
  if (typeof adsEnabled === 'boolean') settings.adsEnabled = adsEnabled;
  if (typeof allowDevTools === 'boolean') settings.allowDevTools = allowDevTools;
  io.emit('settings_updated', { adsEnabled: settings.adsEnabled, allowDevTools: settings.allowDevTools });
  res.json({ adsEnabled: settings.adsEnabled, allowDevTools: settings.allowDevTools });
});

// Admin: high-level overview of current activity
app.get('/api/admin/overview', requireAdmin, (req, res) => {
  const roomList = Array.from(rooms.values()).map((room) => ({
    id: room.id,
    mode: room.mode,
    interest: room.interest,
    participants: room.users.size,
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

  res.json({
    adsEnabled: settings.adsEnabled,
    allowDevTools: settings.allowDevTools,
    users: users.size,
    rooms: rooms.size,
    queues: {
      text: pairQueues.text.length,
      video: pairQueues.video.length,
    },
    roomList,
    userList,
    coinStats,
    reports,
    openReportsCount: reports.length,
    blockedIps: Array.from(blockedIps),
    stats: {
      totalMessages: stats.totalMessages,
      totalConnections: stats.totalConnections,
      uniqueIps: stats.uniqueIps.size,
      uptimeSeconds: Math.floor(process.uptime()),
    }
  });
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
  pingTimeout: 20000,
  pingInterval: 8000,
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
  });

  socket.emit('connected', { userId, country });
  socket.emit('settings_updated', { adsEnabled: settings.adsEnabled, allowDevTools: settings.allowDevTools });
  emitOnlineCount();

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
        return { socketId: p.socketId, userId: u?.id, nickname: p.nickname, country: u?.country };
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
    const userData = users.get(socket.id);
    const room = rooms.get(roomId);
    if (!userData || !room || !room.users.has(socket.id)) return;
    const msg = sanitize(String(text || ''), 500);
    if (!msg) return;

    // AI SAFETY MONITORING (Offense & Abuse Filter)
    const profanities = [
      'fuck', 'shit', 'asshole', 'bitch', 'bastard', 'cunt', 'dick', 'pussy', 'nigga', 'nigger', 'faggot',
      'slut', 'whore', 'motherfucker', 'cock', 'jerk', 'dumbass', 'retard', 'scum',
      'porn', 'sex', 'nude', 'naked', 'xxx', 'horny', 'cum', 'cock', 'tit', 'boob', 'vagina', 'penis'
    ];
    // Simple regex pattern to catch variations
    const pattern = new RegExp(`\\b(${profanities.join('|')})\\b`, 'i');

    if (pattern.test(msg)) {
      console.log(`[AI SAFETY] Blocked offensive content from ${socket.id}: ${msg}`);
      socket.emit('content-flagged', {
        message: '⚠️ MESSAGE BLOCKED: Our AI safety monitor detected offensive or abusive language. Please be respectful to maintain a safe community.'
      });
      return;
    }

    stats.totalMessages++;
    const entry = {
      id: generateId('msg'),
      nickname: userData.nickname,
      text: msg,
      ts: Date.now(),
      socketId: socket.id,
    };
    room.messages = room.messages || [];
    room.messages.push(entry);
    if (room.messages.length > 100) room.messages = room.messages.slice(-MESSAGE_HISTORY);
    io.to(roomId).emit('chat-message', { roomId, ...entry });
  });

  // Wave reaction
  socket.on('send-wave', (data) => {
    const { roomId } = data || {};
    const userData = users.get(socket.id);
    const room = rooms.get(roomId);
    if (!userData || !room || !room.users.has(socket.id)) return;
    socket.to(roomId).emit('wave-reaction', { fromSocketId: socket.id, nickname: userData.nickname });
  });

  // Good vibes (mutual positivity - NOT a dating feature, just conversation quality)
  const goodVibesPending = new Map(); // roomId -> Set of socketIds
  socket.on('send-good-vibes', (data) => {
    const { roomId } = data || {};
    const userData = users.get(socket.id);
    const room = rooms.get(roomId);
    if (!userData || !room || !room.users.has(socket.id)) return;
    if (!goodVibesPending.has(roomId)) goodVibesPending.set(roomId, new Set());
    const pending = goodVibesPending.get(roomId);
    pending.add(socket.id);
    // Check if all users in room sent good vibes
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

  socket.on('send-3d-emoji', (data) => {
    const { roomId, emoji } = data || {};
    const u = users.get(socket.id);
    const cUser = coinUsers.get(ip);
    if (!u || !cUser || cUser.coins < 5) return socket.emit('error', { message: 'Need 5 coins for 3D Emoji' });
    cUser.coins -= 5;
    coinUsers.set(ip, cUser);
    io.to(roomId).emit('3d-emoji', { roomId, emoji, nickname: u.nickname, socketId: socket.id });
    socket.emit('coins-updated', { coins: cUser.coins });
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
