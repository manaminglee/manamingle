import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : '');

/**
 * Mana Mingle Admin Dashboard
 */
export function AdminDashboard() {
  const [key, setKey] = useState(sessionStorage.getItem('mm_admin_key') || '');
  const [isLogged, setIsLogged] = useState(!!sessionStorage.getItem('mm_admin_key'));
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [ipInput, setIpInput] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [isKillswitchConfirm, setIsKillswitchConfirm] = useState(false);

  const fetchStats = async (adminKey) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/overview`, {
        headers: { 'x-admin-key': adminKey },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setError('');
        setIsLogged(true);
        sessionStorage.setItem('mm_admin_key', adminKey);
      } else {
        const err = await res.json();
        setError(err.error || 'Unauthorized');
        setIsLogged(false);
      }
    } catch (e) {
      setError('Connection failed');
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    fetchStats(key);
  };

  const toggleAds = async (val) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({ adsEnabled: val }),
      });
      if (res.ok) {
        const data = await res.json();
        setStats(prev => ({ ...prev, adsEnabled: data.adsEnabled }));
      }
    } catch (e) { }
  };

  const toggleDevTools = async (val) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({ allowDevTools: val }),
      });
      if (res.ok) {
        const data = await res.json();
        setStats(prev => ({ ...prev, allowDevTools: data.allowDevTools }));
      }
    } catch (e) { }
  };

  const handleBlockIp = async (e, ipArg) => {
    if (e) e.preventDefault();
    const target = ipArg || ipInput.trim();
    if (!target) return;
    try {
      await fetch(`${API_BASE}/api/admin/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({ ip: target }),
      });
      setIpInput('');
      fetchStats(key);
    } catch (e) { }
  };

  const handleUnblockIp = async (ip) => {
    try {
      await fetch(`${API_BASE}/api/admin/unblock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({ ip }),
      });
      fetchStats(key);
    } catch (e) { }
  };

  const handleUpdateCoins = async (ip, amount, set = false) => {
    try {
      await fetch(`${API_BASE}/api/admin/coins/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({ ip, amount, set }),
      });
      fetchStats(key);
    } catch (e) { }
  };

  const handleResolveReport = async (reportId) => {
    try {
      await fetch(`${API_BASE}/api/admin/resolve-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({ reportId }),
      });
      fetchStats(key);
    } catch (e) { }
  };

  const handleSendAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcement.trim()) return;
    try {
      await fetch(`${API_BASE}/api/admin/announcement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({ message: announcement }),
      });
      setAnnouncement('');
      alert('Broadcast sent to all users!');
    } catch (e) { }
  };

  const handleKillswitch = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/killswitch`, {
        method: 'POST',
        headers: { 'x-admin-key': key }
      });
      if (res.ok) {
        const data = await res.json();
        setToast(`💥 Killswitch: ${data.kicked} users disconnected.`);
        setIsKillswitchConfirm(false);
        fetchStats(key);
      }
    } catch (e) { }
  };

  const updateSetting = async (field, value) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        const data = await res.json();
        setStats(prev => ({ ...prev, ...data }));
        setToast(`✅ Setting updated: ${field}`);
      }
    } catch (e) { }
  };

  const lookupIp = async (ip) => {
    if (!ip) return;
    try {
      const res = await fetch(`https://ipapi.co/${ip}/json/`);
      const data = await res.json();
      if (data.error) return alert('IP lookup failed');
      alert(`IP: ${ip}\nCity: ${data.city}\nRegion: ${data.region}\nCountry: ${data.country_name}\nOrg: ${data.org}`);
    } catch (e) { alert('Lookup service error'); }
  };

  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    if (isLogged) {
      const interval = setInterval(() => fetchStats(key), 5000);
      return () => clearInterval(interval);
    }
  }, [isLogged, key]);

  if (!isLogged) {
    return (
      <div className="min-h-screen bg-[#070811] flex items-center justify-center p-6 text-white font-sans">
        <div className="max-w-md w-full p-8 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-3xl font-black mb-4 shadow-xl shadow-indigo-500/20">
              M
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Admin Portal</h1>
            <p className="text-sm text-white/40 mt-1">Authorized Access Only</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-white/30 ml-1 mb-2 block">Admin Key</label>
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="••••••••••••••••"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500/50 transition-all text-center tracking-widest"
              />
            </div>
            <button className="btn btn-primary w-full py-4 rounded-xl font-bold shadow-lg shadow-indigo-600/20">
              Connect to Console
            </button>
            <button
              type="button"
              onClick={() => window.location.href = '/'}
              className="w-full text-xs text-white/20 hover:text-white/40 transition-colors uppercase tracking-[0.2em] font-bold mt-4"
            >
              ← Back to Website
            </button>
            {error && <p className="text-red-400 text-xs text-center font-medium">{error}</p>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070811] text-white p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xl font-black shadow-lg shadow-indigo-500/20">
              M
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">System Console</h1>
              <p className="text-xs font-medium text-emerald-400 flex items-center gap-1.5 uppercase tracking-widest mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live Server Operations
              </p>
            </div>
          </div>
          <button
            onClick={() => { sessionStorage.removeItem('mm_admin_key'); setIsLogged(false); }}
            className="px-6 py-2 rounded-full border border-white/10 bg-white/5 text-xs font-bold hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-all uppercase tracking-widest"
          >
            Disconnect
          </button>
        </header>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-10">
          {[
            { label: 'Active Users', value: stats?.users || 0, color: 'text-indigo-400', icon: '👤' },
            { label: 'Active Rooms', value: stats?.rooms || 0, color: 'text-purple-400', icon: '🏠' },
            { label: 'Total Msgs', value: stats?.stats?.totalMessages || 0, color: 'text-emerald-400', icon: '💬' },
            { label: 'Queue', value: (stats?.queues?.text || 0) + (stats?.queues?.video || 0), color: 'text-teal-400', icon: '⌛' },
            { label: 'Open Reports', value: stats?.openReportsCount || 0, color: 'text-rose-400', icon: '🚩' },
            { label: 'Uptime (min)', value: Math.floor((stats?.stats?.uptimeSeconds || 0) / 60), color: 'text-blue-400', icon: '⏱️' },
            { label: 'Total Conns', value: stats?.stats?.totalConnections || 0, color: 'text-cyan-400', icon: '🔌' },
            { label: 'Unique IPs', value: stats?.stats?.uniqueIps || 0, color: 'text-rose-400', icon: '📍' },
            { label: 'Coin Wallets', value: stats?.coinStats?.totalUsers || 0, color: 'text-amber-400', icon: '💰' },
            { label: 'System Coins', value: stats?.coinStats?.totalCoinsInSystem || 0, color: 'text-orange-400', icon: '🪙' },
          ].map((s) => (
            <div key={s.label} className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 flex flex-col gap-1 hover:bg-white/[0.05] transition-all cursor-default">
              <div className="flex justify-between items-start">
                <span className={`text-2xl font-black ${s.color}`}>{s.value.toLocaleString()}</span>
                <span className="opacity-40">{s.icon}</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 truncate">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-8">
            {/* Control Panel Toggles */}
            <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/10">
              <h2 className="text-sm font-black uppercase tracking-widest text-indigo-400 mb-6 flex items-center gap-2">
                ⚙️ Website Feature Toggles
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { field: 'adsEnabled', label: 'Ads Monetization', desc: 'Enable global banners', active: stats?.adsEnabled },
                  { field: 'allowDevTools', label: 'Dev Tools', desc: 'Allow F12 / Inspect', active: stats?.allowDevTools },
                  { field: 'maintenanceMode', label: 'Maintenance Mode', desc: 'Disables all chat', active: stats?.maintenanceMode },
                  { field: 'safetyAiEnabled', label: 'Safety AI Filter', desc: 'Auto-block profanity', active: stats?.safetyAiEnabled },
                  { field: 'coinsEnabled', label: 'Coin System', desc: 'Allow earning/spending', active: stats?.coinsEnabled !== false },
                  { field: 'guestRegistration', label: 'Guest Access', desc: 'Allow non-logged users', active: stats?.guestRegistration !== false },
                ].map(f => (
                  <div key={f.field} className="p-4 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                    <div>
                      <div className="text-xs font-bold">{f.label}</div>
                      <div className="text-[9px] text-white/30">{f.desc}</div>
                    </div>
                    <button
                      onClick={() => updateSetting(f.field, !f.active)}
                      className={`relative w-10 h-5 rounded-full transition-all ${f.active ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-white/10'}`}
                    >
                      <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-all transform ${f.active ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Users Table */}
            <div className="p-1 rounded-3xl bg-white/[0.03] border border-white/10 overflow-hidden">
              <div className="p-6 border-b border-white/[0.06] flex justify-between items-center">
                <h2 className="font-bold tracking-tight uppercase text-xs tracking-widest">Active Stranger Stream</h2>
                <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-full">{stats?.userList?.length || 0} Online</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[10px] uppercase tracking-widest text-white/20 border-b border-white/5">
                    <tr>
                      <th className="px-6 py-4">Stranger</th>
                      <th className="px-6 py-4">IP / Info</th>
                      <th className="px-6 py-4">Wallet</th>
                      <th className="px-6 py-4">Action Center</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {stats?.userList?.map((u) => (
                      <tr key={u.socketId} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-indigo-300">{u.nickname}</span>
                            <span className="text-[10px] text-white/20 uppercase tracking-tighter">{u.country || 'Global Connection'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                             <span className="font-mono text-[10px] text-white/40">{u.ip}</span>
                             <button onClick={() => lookupIp(u.ip)} className="p-1 rounded bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-indigo-500/20" title="Whois Lookup">🔍</button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-amber-500 font-black text-xs">🪙 {u.coins || 0}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-3">
                            <button onClick={() => handleUpdateCoins(u.ip, 100)} className="text-emerald-400 hover:text-emerald-300 font-bold text-[9px] uppercase tracking-wider bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10 transition-all">+100</button>
                            <button onClick={() => handleUpdateCoins(u.ip, 100, true)} className="text-blue-400 hover:text-blue-300 font-bold text-[9px] uppercase tracking-wider bg-blue-500/5 px-2 py-1 rounded border border-blue-500/10 transition-all">Set 100</button>
                            <button onClick={(e) => handleBlockIp(e, u.ip)} className="text-rose-400 hover:text-rose-500 font-bold text-[9px] uppercase tracking-wider bg-rose-500/5 px-2 py-1 rounded border border-rose-500/10 transition-all">Terminate IP</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Reports & Active Rooms Split */}
            <div className="grid md:grid-cols-2 gap-8">
               <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10">
                <h2 className="font-bold tracking-tight mb-4 flex items-center justify-between">
                  <span className="flex items-center gap-2 uppercase text-[10px] tracking-widest transition-colors"><span className="text-rose-400 animate-pulse">●</span> Violation Reports</span>
                  <span className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-black animate-bounce">{stats?.openReportsCount || 0}</span>
                </h2>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {stats?.reports?.map((r) => (
                    <div key={r.id} className="p-4 rounded-2xl bg-black/40 border border-rose-500/10 text-xs">
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-rose-400 font-bold uppercase text-[9px] tracking-wider">{r.reason}</p>
                        <span className="text-[8px] text-white/20 font-mono">{new Date(r.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-white/40 text-[9px] mb-3 font-mono">Target: {r.targetIp}</p>
                      <div className="flex gap-2">
                        <button onClick={(e) => handleBlockIp(e, r.targetIp)} className="flex-1 bg-rose-500/20 text-rose-400 px-3 py-1.5 rounded-xl font-black uppercase text-[8px] hover:bg-rose-500/30 transition-all">Hard Ban</button>
                        <button onClick={() => handleResolveReport(r.id)} className="flex-1 bg-white/5 text-white/40 px-3 py-1.5 rounded-xl font-black uppercase text-[8px] hover:bg-white/10">Archive</button>
                      </div>
                    </div>
                  ))}
                  {(!stats?.reports || stats.reports.length === 0) && (
                    <div className="py-12 text-center">
                      <p className="text-xs text-white/20 italic font-medium">All quiet on the safety front.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10">
                <h2 className="font-bold tracking-tight mb-4 uppercase text-[10px] tracking-widest text-emerald-400">Live Traffic Clusters</h2>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {stats?.roomList?.map((room) => (
                    <div key={room.id} className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between group hover:border-emerald-500/20 transition-all">
                      <div>
                        <div className="text-[10px] font-black uppercase text-white/80">{room.mode.replace('_', ' ')}</div>
                        <div className="text-[9px] text-white/30 font-mono">ID: {room.id.slice(-6)}...</div>
                      </div>
                      <div className="flex items-center gap-3">
                         <span className="px-2 py-1 rounded bg-white/5 text-[9px] font-bold text-white/50">{room.interest}</span>
                         <span className="text-xs font-black text-emerald-400">{room.participants} Connection</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Global Broadcast */}
            <div className="p-8 rounded-3xl bg-indigo-600/5 border border-indigo-500/10">
              <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-6 underline decoration-indigo-500/30 underline-offset-8">Global Notification</h3>
              <form onSubmit={handleSendAnnouncement} className="space-y-4">
                <div className="relative">
                  <textarea
                    value={announcement}
                    onChange={(e) => setAnnouncement(e.target.value)}
                    placeholder="Enter message to broadcast to all active users..."
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-xs min-h-[120px] focus:border-indigo-500/50 outline-none transition-all placeholder:text-white/10 font-medium"
                  />
                  <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-lg shadow-indigo-500/50" />
                </div>
                <button type="submit" className="w-full py-4 bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-400 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-indigo-500/20">
                  ⚡ Push Broadcast
                </button>
              </form>
            </div>

            {/* Quick Actions Card */}
            <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/[0.05]">
              <h3 className="text-xs font-black uppercase tracking-widest text-white/30 mb-6">Security Actions</h3>
              <div className="space-y-4">
                <form onSubmit={handleBlockIp} className="flex gap-2">
                  <input
                    type="text"
                    value={ipInput}
                    onChange={(e) => setIpInput(e.target.value)}
                    placeholder="Hard block IP..."
                    className="flex-1 bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-xs placeholder:text-white/10 outline-none focus:border-rose-500/50"
                  />
                  <button type="submit" className="bg-rose-500 text-white px-4 py-3 rounded-xl text-xs font-black uppercase tracking-tighter hover:bg-rose-600 transition-all">Ban</button>
                </form>
                <div className="bg-black/40 rounded-2xl p-4 border border-white/5 space-y-3">
                  <div className="text-[9px] font-black uppercase text-white/30 tracking-widest px-1">Blacklisted Nodes</div>
                  <div className="max-h-40 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {stats?.blockedIps?.length === 0 && <span className="text-[10px] italic text-white/10 px-1">Firewall clear.</span>}
                    {stats?.blockedIps?.map(ip => (
                      <div key={ip} className="flex justify-between items-center p-2 bg-rose-500/5 border border-rose-500/10 rounded-xl text-[10px] font-mono group">
                        <span className="text-rose-400/80">{ip}</span>
                        <button onClick={() => handleUnblockIp(ip)} className="text-emerald-400 font-black opacity-40 group-hover:opacity-100 hover:text-emerald-300 transition-all">RECOVER</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="p-8 rounded-3xl bg-rose-600/5 border border-rose-500/10">
              <h3 className="text-xs font-black uppercase tracking-widest text-rose-500 mb-6 flex items-center gap-2">
                🛑 System Termination
              </h3>
              <p className="text-[10px] text-rose-400/60 leading-relaxed mb-6 font-medium">
                Activating the killswitch will force-disconnect all active strangers, clear all room queues, and flush serverside caches immediately.
              </p>
              {!isKillswitchConfirm ? (
                <button onClick={() => setIsKillswitchConfirm(true)} className="w-full py-4 bg-rose-500/10 text-rose-500 border border-rose-500/30 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-rose-500/20 transition-all">
                  Kill All Connections
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3 animate-in-zoom">
                  <button onClick={handleKillswitch} className="py-4 bg-rose-500 rounded-2xl text-[10px] font-black text-white hover:bg-rose-600 shadow-xl shadow-rose-900/40">CONFIRM FORCE EXIT</button>
                  <button onClick={() => setIsKillswitchConfirm(false)} className="py-4 bg-white/10 rounded-2xl text-[10px] font-black hover:bg-white/20">ABORT</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Global Admin Toast */}
        {toast && (
          <div className="fixed bottom-10 right-10 z-[500] px-6 py-3 rounded-2xl bg-indigo-600 text-white font-bold text-xs shadow-2xl shadow-indigo-600/40 border border-indigo-400/30 animate-slide-in-right flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-white animate-ping" />
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
