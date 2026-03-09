import { useState, useEffect } from 'react';

/**
 * Mana Mingle Admin Dashboard
 * 
 * Features:
 * - Login with `ADMIN_KEY`
 * - Live Stats (Online Users, Active Rooms, Queues)
 * - Room Inspection (List mode, interest, participant count)
 * - Global Settings Toggle (Ads, Feature Flags)
 * - Real-time auto-refresh
 */
export function AdminDashboard() {
  const [key, setKey] = useState(sessionStorage.getItem('mm_admin_key') || '');
  const [isLogged, setIsLogged] = useState(!!sessionStorage.getItem('mm_admin_key'));
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState({ adsEnabled: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ipInput, setIpInput] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [isKillswitchConfirm, setIsKillswitchConfirm] = useState(false);

  const fetchStats = async (adminKey) => {
    try {
      const res = await fetch('/api/admin/overview', {
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
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({ adsEnabled: val }),
      });
      if (res.ok) {
        setStats(prev => ({ ...prev, adsEnabled: val }));
      }
    } catch (e) { }
  };

  const handleBlockIp = async (e, ipArg) => {
    if (e) e.preventDefault();
    const target = ipArg || ipInput.trim();
    if (!target) return;
    try {
      await fetch('/api/admin/block', {
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
      await fetch('/api/admin/unblock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({ ip }),
      });
      fetchStats(key);
    } catch (e) { }
  };

  const handleResolveReport = async (reportId) => {
    try {
      await fetch('/api/admin/resolve-report', {
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
      await fetch('/api/admin/announcement', {
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
      const res = await fetch('/api/admin/killswitch', {
        method: 'POST',
        headers: { 'x-admin-key': key }
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Killswitch activated! ${data.kicked} users disconnected.`);
        setIsKillswitchConfirm(false);
        fetchStats(key);
      }
    } catch (e) { }
  };

  // Auto-refresh when logged in
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

        {/* Analytics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-6 md:grid-cols-3 gap-4 mb-10">
          {[
            { label: 'Active Users', value: stats?.users || 0, color: 'text-indigo-400' },
            { label: 'Active Rooms', value: stats?.rooms || 0, color: 'text-purple-400' },
            { label: 'Total Msgs', value: stats?.stats?.totalMessages || 0, color: 'text-emerald-400' },
            { label: 'WebRTC Queue', value: (stats?.queues?.text || 0) + (stats?.queues?.video || 0), color: 'text-teal-400' },
            { label: 'Total Conns', value: stats?.stats?.totalConnections || 0, color: 'text-amber-400' },
            { label: 'Unique IPs', value: stats?.stats?.uniqueIps || 0, color: 'text-rose-400' },
          ].map((s) => (
            <div key={s.label} className="p-5 rounded-3xl bg-white/[0.03] border border-white/10 flex flex-col gap-1">
              <span className={`text-2xl font-black ${s.color}`}>{s.value.toLocaleString()}</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 truncate">{s.label}</span>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main List */}
          <div className="lg:col-span-2">
            <div className="p-1 rounded-3xl bg-white/[0.03] border border-white/10 overflow-hidden">
              <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
                <h2 className="font-bold tracking-tight">Active Rooms</h2>
                <div className="flex gap-2">
                  <div className="px-3 py-1 rounded bg-white/5 border border-white/5 text-[10px] uppercase font-bold text-white/40">Realtime Feed</div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[10px] uppercase tracking-widest text-white/20 border-b border-white/5">
                    <tr>
                      <th className="px-6 py-4">Room ID</th>
                      <th className="px-6 py-4">Mode</th>
                      <th className="px-6 py-4">Interest</th>
                      <th className="px-6 py-4">Peers</th>
                      <th className="px-6 py-4">Age</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {stats?.roomList?.map((room) => (
                      <tr key={room.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-4 font-mono text-[11px] text-white/40 group-hover:text-white/80 transition-colors uppercase">{room.id}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${room.mode.includes('video') ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}>
                            {room.mode.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium text-white/60">{room.interest}</td>
                        <td className="px-6 py-4 font-black">{room.participants} / 4</td>
                        <td className="px-6 py-4 text-white/30 text-xs">
                          {Math.floor((Date.now() - room.createdAt) / 1000)}s
                        </td>
                      </tr>
                    ))}
                    {!stats?.roomList?.length && (
                      <tr>
                        <td colSpan="5" className="px-6 py-20 text-center text-white/20 font-medium italic">
                          No active rooms at this time.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Moderation section */}
            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 mt-8">
              <h2 className="font-bold tracking-tight mb-4 flex items-center gap-2">
                <span className="text-rose-400">⚠️</span> User Reports
              </h2>
              <div className="space-y-4">
                {stats?.reports?.map((r) => (
                  <div key={r.id} className="p-4 rounded-2xl bg-black/40 border border-rose-500/20 text-xs text-white/60">
                    <p className="mb-2"><strong className="text-white/80">Reason:</strong> {r.reason}</p>
                    <p className="mb-3 font-mono text-[10px]">
                      Reporter: {r.reporterIp} <br />
                      Target: <span className="text-rose-400 font-bold">{r.targetIp}</span>
                    </p>
                    <div className="flex gap-3">
                      <button onClick={(e) => handleBlockIp(e, r.targetIp)} className="btn bg-rose-500/10 text-rose-400 border border-rose-500/20 py-1 px-3 text-[10px] rounded-lg">Ban Target IP</button>
                      <button onClick={() => handleResolveReport(r.id)} className="btn bg-white/5 border border-white/10 py-1 px-3 text-[10px] rounded-lg">Dismiss</button>
                    </div>
                  </div>
                ))}
                {!stats?.reports?.length && <p className="text-xs text-white/20 italic p-2">Zero active reports.</p>}
              </div>
            </div>

          </div>

          {/* Settings Sidebar */}
          <div className="space-y-6">
            <div className="p-8 rounded-3xl bg-indigo-600/5 border border-indigo-500/10">
              <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-6">Global Settings</h3>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5 transition-all hover:bg-white/[0.04]">
                <div>
                  <div className="text-sm font-bold">In-Chat Ads</div>
                  <div className="text-[10px] text-white/30">Display ad units to users</div>
                </div>
                <button
                  onClick={() => toggleAds(!stats?.adsEnabled)}
                  className={`relative w-12 h-6 rounded-full transition-all duration-300 ${stats?.adsEnabled ? 'bg-emerald-500' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all transform ${stats?.adsEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="mt-6 p-4 rounded-2xl bg-black/20 border border-white/[0.03] text-[10px] leading-relaxed text-white/30">
                <strong>Note:</strong> Changes take effect immediately across all connected client instances
                via the system signaling layer.
              </div>
            </div>

            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/[0.05]">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white/30 mb-4">Diagnostics</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-[11px] font-medium border-b border-white/[0.04] pb-2">
                  <span className="text-white/40">Node Environment</span>
                  <span className="text-white/60">Production</span>
                </div>
                <div className="flex justify-between text-[11px] font-medium border-b border-white/[0.04] pb-2">
                  <span className="text-white/40">Uptime</span>
                  <span className="text-white/60">{Math.floor(performance.now() / 1000)}s</span>
                </div>
                <div className="flex justify-between text-[11px] font-medium">
                  <span className="text-white/40">WebRTC Health</span>
                  <span className="text-emerald-400 font-bold">READY</span>
                </div>
              </div>
              <div className="p-6 rounded-2xl bg-black/20 border border-white/[0.03]">
                <form onSubmit={handleBlockIp} className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={ipInput}
                    onChange={(e) => setIpInput(e.target.value)}
                    placeholder="Enter IP to restrict"
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-rose-500/50"
                  />
                  <button type="submit" className="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-3 rounded-lg text-xs font-bold hover:bg-rose-500 hover:text-white transition">Ban</button>
                </form>

                <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Restricted IPs</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                  {stats?.blockedIps?.map((ip) => (
                    <div key={ip} className="flex justify-between items-center bg-white/[0.02] border border-white/5 p-2 rounded-lg text-[11px] font-mono">
                      <span>{ip}</span>
                      <button onClick={() => handleUnblockIp(ip)} className="text-emerald-400 hover:text-emerald-300 font-bold">Unblock</button>
                    </div>
                  ))}
                  {!stats?.blockedIps?.length && <span className="text-[10px] text-white/20 italic">No IPs blocked.</span>}
                </div>
              </div>
            </div>

            <div className="p-8 rounded-3xl bg-indigo-600/5 border border-indigo-500/10">
              <h3 className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-6">Global Broadcast</h3>
              <form onSubmit={handleSendAnnouncement} className="space-y-4">
                <textarea
                  value={announcement}
                  onChange={(e) => setAnnouncement(e.target.value)}
                  placeholder="Type a global system message..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-indigo-500/50 min-h-[80px]"
                />
                <button type="submit" className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-xs font-bold transition">
                  Push to All Users
                </button>
              </form>
            </div>

            <div className="p-8 rounded-3xl bg-rose-600/5 border border-rose-500/10">
              <h3 className="text-xs font-bold uppercase tracking-widest text-rose-400 mb-6">Emergency Operations</h3>
              {!isKillswitchConfirm ? (
                <button
                  onClick={() => setIsKillswitchConfirm(true)}
                  className="w-full py-3 bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500 hover:text-white rounded-xl text-xs font-bold transition"
                >
                  Activate Killswitch
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-[10px] text-rose-400/80 font-medium">Are you sure? This will disconnect EVERY user and clear all matching rooms.</p>
                  <div className="flex gap-2">
                    <button onClick={handleKillswitch} className="flex-1 py-2 bg-rose-500 rounded-lg text-xs font-bold">CONFIRM</button>
                    <button onClick={() => setIsKillswitchConfirm(false)} className="flex-1 py-2 bg-white/10 rounded-lg text-xs font-bold">CANCEL</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
