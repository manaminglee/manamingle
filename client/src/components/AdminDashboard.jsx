import { useState, useEffect, useMemo } from 'react';

const API_BASE = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : '');

/**
 * Mana Mingle Advanced Admin Console
 * Features: Live stats, Visualizations, Economy control, Security, Moderation
 */
export function AdminDashboard() {
  const [key, setKey] = useState(sessionStorage.getItem('mm_admin_key') || '');
  const [isLogged, setIsLogged] = useState(!!sessionStorage.getItem('mm_admin_key'));
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [ipInput, setIpInput] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [isKillswitchConfirm, setIsKillswitchConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // overview, users, economy, security, logic
  const [toast, setToast] = useState(null);

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
      setToast(`🚫 IP Blocked: ${target}`);
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
      setToast(`🔓 IP Unblocked: ${ip}`);
    } catch (e) { }
  };

  const handleWarnIp = async (ip) => {
    try {
      await fetch(`${API_BASE}/api/admin/warn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({ ip, message: '⚠️ YOUR BEHAVIOR HAS BEEN FLAGGED. Please follow community rules or you will be banned.' }),
      });
      fetchStats(key);
      setToast(`⚠️ Warning sent to IP: ${ip}`);
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
      setToast(`💰 Coins updated for ${ip}`);
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
      setToast('✅ Report archived');
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
      setToast('📣 Global Broadcast sent!');
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
        setToast(`💥 Killswitch: ${data.kicked} users kicked.`);
        setIsKillswitchConfirm(false);
        fetchStats(key);
      }
    } catch (e) { }
  };

  const lookupIp = async (ip) => {
    if (!ip) return;
    try {
      const res = await fetch(`https://ipapi.co/${ip}/json/`);
      const data = await res.json();
      if (data.error) return alert('IP lookup failed');
      alert(`IP Info: ${data.city}, ${data.region}, ${data.country_name} (${data.org})`);
    } catch (e) { alert('Lookup service error'); }
  };

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

  const filteredUsers = useMemo(() => {
    if (!stats?.userList) return [];
    if (!searchQuery) return stats.userList;
    const q = searchQuery.toLowerCase();
    return stats.userList.filter(u => 
      u.nickname.toLowerCase().includes(q) || 
      u.ip.includes(q) || 
      (u.country || '').toLowerCase().includes(q)
    );
  }, [stats?.userList, searchQuery]);

  if (!isLogged) {
    return (
      <div className="min-h-screen bg-[#070811] flex items-center justify-center p-6 text-white font-sans">
        <div className="max-w-md w-full p-8 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-3xl font-black mb-4 shadow-xl shadow-indigo-500/30 animate-pulse">
              M
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Access Control</h1>
            <p className="text-sm text-white/40 mt-1">Authorized personnel only</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-1 mb-2 block">System Encryption Key</label>
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="••••••••••••••••"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500/50 transition-all text-center tracking-widest"
              />
            </div>
            <button className="w-full py-4 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95">
              Initialize Matrix
            </button>
            <button
              type="button"
              onClick={() => window.location.href = '/'}
              className="w-full text-[10px] text-white/20 hover:text-white/40 transition-colors uppercase tracking-[0.2em] font-bold mt-4"
            >
              ← System Exit
            </button>
            {error && <p className="text-rose-400 text-xs text-center font-bold animate-shake">{error}</p>}
          </form>
        </div>
      </div>
    );
  }

  // --- Chart Component (No external libs) ---
  const UsageChart = ({ data }) => {
    if (!data || data.length < 2) return <div className="h-40 flex items-center justify-center text-white/10 text-xs italic">Waiting for data cycles...</div>;
    const maxUsers = Math.max(...data.map(d => d.users), 10);
    return (
      <div className="h-40 flex items-end gap-1 px-2 border-b border-l border-white/5 bg-black/20 rounded-sm">
        {data.map((d, i) => (
          <div 
            key={i} 
            className="flex-1 bg-indigo-500/40 rounded-t-sm hover:bg-indigo-500 transition-all relative group" 
            style={{ height: `${(d.users / maxUsers) * 100}%` }}
          >
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-black rounded text-[8px] opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
              {d.users} Users
            </div>
          </div>
        ))}
      </div>
    );
  };

  const ResourceBar = ({ label, value, max, color }) => (
    <div className="space-y-1">
      <div className="flex justify-between text-[9px] uppercase tracking-widest font-black text-white/30 px-1">
        <span>{label}</span>
        <span>{Math.round((value / max) * 100)}%</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#05060b] text-[#f8fafc] font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      <div className="flex min-h-screen">
        {/* Sidebar Nav */}
        <aside className="w-64 border-r border-white/5 bg-[#0a0c16]/50 backdrop-blur-3xl p-6 hidden lg:flex flex-col gap-8">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-black text-lg">M</div>
            <span className="font-bold tracking-tight">MANA ADMIN</span>
          </div>

          <nav className="flex flex-col gap-1">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'users', label: 'User Hub', icon: '👥' },
              { id: 'economy', label: 'Economy', icon: '💰' },
              { id: 'security', label: 'Security', icon: '🛡️' },
              { id: 'logic', label: 'System Logic', icon: '⚙️' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-white/40 hover:text-white/60 hover:bg-white/5'}`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto space-y-4">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
              <div className="text-[9px] font-black uppercase text-white/20 mb-3 tracking-widest px-1">Host Diagnostics</div>
              <div className="space-y-3">
                <ResourceBar label="Memory" value={stats?.memory?.heapUsed || 0} max={stats?.memory?.heapTotal || 1} color="bg-emerald-500" />
                <ResourceBar label="CPU Load" value={30} max={100} color="bg-indigo-500" />
              </div>
            </div>
            <button
              onClick={() => { sessionStorage.removeItem('mm_admin_key'); setIsLogged(false); }}
              className="w-full py-3 rounded-xl border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-widest hover:bg-rose-500/10 transition-all"
            >
              De-Authorize
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 custom-scrollbar">
          <header className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
            <div className="animate-fade-in-down">
              <div className="flex items-center gap-2 mb-1">
                 <h1 className="text-3xl font-black tracking-tight capitalize">{activeTab}</h1>
                 <span className="px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">v2.1 Stable</span>
              </div>
              <p className="text-white/30 text-sm font-medium">Monitoring real-time traffic across {stats?.rooms || 0} active clusters.</p>
            </div>
            <div className="flex items-center gap-3">
               <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Platform Online</span>
                  <span className="text-xs text-white/20 font-mono">Uptime: {Math.floor((stats?.stats?.uptimeSeconds || 0) / 3600)}h {Math.floor(((stats?.stats?.uptimeSeconds || 0) % 3600) / 60)}m</span>
               </div>
            </div>
          </header>

          {activeTab === 'overview' && (
            <div className="space-y-8 animate-fade-in">
              {/* Top Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Active Users', value: stats?.users || 0, color: 'text-indigo-400', icon: '👥' },
                  { label: 'Live Rooms', value: stats?.rooms || 0, color: 'text-purple-400', icon: '🏠' },
                  { label: 'Total Traffic', value: stats?.stats?.totalConnections || 0, color: 'text-emerald-400', icon: '🔌' },
                  { label: 'System Coins', value: stats?.coinStats?.totalCoinsInSystem || 0, color: 'text-amber-400', icon: '🪙' },
                ].map(s => (
                  <div key={s.label} className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] transition-all group overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 text-3xl opacity-5 group-hover:opacity-10 group-hover:scale-125 transition-all grayscale">{s.icon}</div>
                    <div className="text-[10px] font-black uppercase text-white/30 mb-1 tracking-widest">{s.label}</div>
                    <div className={`text-3xl font-black tracking-tight ${s.color}`}>{s.value.toLocaleString()}</div>
                  </div>
                ))}
              </div>

              {/* Charts Row */}
              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 p-8 rounded-3xl bg-white/[0.03] border border-white/10">
                   <div className="flex justify-between items-center mb-8">
                      <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400">Traffic Velocity (Last 60m)</h3>
                      <div className="flex gap-4">
                         <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-indigo-500" /> <span className="text-[10px] text-white/40 font-bold uppercase">Users</span></div>
                      </div>
                   </div>
                   <UsageChart data={stats?.statsHistory} />
                </div>
                <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/10 flex flex-col">
                   <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-6">Distribution Metrics</h3>
                   <div className="flex-1 space-y-6">
                      <div className="space-y-2">
                        <div className="flex justify-between text-[11px] font-bold"><span className="text-white/60">Video Presence</span> <span className="text-indigo-400">72%</span></div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-indigo-500" style={{ width: '72%' }} /></div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[11px] font-bold"><span className="text-white/60">Text Engagement</span> <span className="text-purple-400">28%</span></div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-purple-500" style={{ width: '28%' }} /></div>
                      </div>
                      <div className="mt-8 pt-8 border-t border-white/5">
                        <div className="grid grid-cols-2 gap-4">
                           <div className="text-center p-3 rounded-2xl bg-white/5">
                              <div className="text-[9px] font-black uppercase text-white/20 mb-1">Queue (T)</div>
                              <div className="text-xl font-bold">{stats?.queues?.text || 0}</div>
                           </div>
                           <div className="text-center p-3 rounded-2xl bg-white/5">
                              <div className="text-[9px] font-black uppercase text-white/20 mb-1">Queue (V)</div>
                              <div className="text-xl font-bold">{stats?.queues?.video || 0}</div>
                           </div>
                        </div>
                      </div>
                   </div>
                </div>
              </div>

              {/* Alerts & Announcement */}
              <div className="grid lg:grid-cols-2 gap-8">
                <div className="p-8 rounded-3xl bg-indigo-600/5 border border-indigo-500/10">
                  <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-6">📢 Global Broadcast Hub</h3>
                  <form onSubmit={handleSendAnnouncement} className="space-y-4">
                    <textarea
                      value={announcement}
                      onChange={(e) => setAnnouncement(e.target.value)}
                      placeholder="Transmission text..."
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-4 text-sm min-h-[100px] outline-none focus:border-indigo-500/50 transition-all"
                    />
                    <button className="w-full py-4 bg-indigo-500 hover:bg-indigo-400 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 transition-all">Submit Global Transmission</button>
                  </form>
                </div>
                <div className="p-8 rounded-3xl bg-rose-500/5 border border-rose-500/10 overflow-hidden">
                   <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xs font-black uppercase tracking-widest text-rose-400">🚩 Violation Stream</h3>
                      <span className="text-[10px] font-bold bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full">{stats?.openReportsCount || 0} New</span>
                   </div>
                   <div className="space-y-3 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                      {stats?.reports?.map(r => (
                        <div key={r.id} className="p-3 rounded-xl bg-black/20 border border-white/5 flex items-center justify-between group">
                          <div>
                            <div className="text-[10px] font-bold text-rose-400 uppercase">{r.reason}</div>
                            <div className="text-[9px] text-white/20 font-mono">Target: {r.targetIp}</div>
                          </div>
                          <button onClick={() => handleResolveReport(r.id)} className="text-[9px] font-black uppercase text-white/30 hover:text-white transition-colors">Resolve</button>
                        </div>
                      ))}
                      {(!stats?.reports || stats.reports.length === 0) && <p className="text-center py-8 text-xs text-white/10 italic">Secure. No breaches reported.</p>}
                   </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-8">
                <div className="relative flex-1 w-full">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
                  <input 
                    type="text" 
                    placeholder="Search by nickname, IP, or country..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
                  />
                </div>
                <div className="flex gap-2">
                   <button onClick={() => fetchStats(key)} className="px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white/10 transition-all">Refresh Flux</button>
                </div>
              </div>

              <div className="rounded-3xl bg-white/[0.03] border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/[0.02] border-b border-white/5">
                      <tr className="text-[10px] uppercase font-black tracking-[0.2em] text-white/20">
                        <th className="px-8 py-5">Stranger Identity</th>
                        <th className="px-8 py-5">Node Context</th>
                        <th className="px-8 py-5">Wallet Stat</th>
                        <th className="px-8 py-5 text-right">Moderation Console</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {filteredUsers.map(u => (
                        <tr key={u.socketId} className="hover:bg-white/[0.01] transition-all group">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-4">
                               <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold ${u.mode !== 'idle' ? 'ring-2 ring-emerald-500 ring-offset-4 ring-offset-[#05060b]' : ''}`}>
                                  {u.nickname?.[0] || 'A'}
                               </div>
                               <div>
                                  <div className="font-bold text-white group-hover:text-indigo-400 transition-colors">{u.nickname}</div>
                                  <div className="text-[10px] text-white/20 uppercase tracking-widest">{u.country || 'Unknown Node'}</div>
                               </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                             <div className="font-mono text-xs text-white/40 mb-1">{u.ip}</div>
                             <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full ${u.mode === 'idle' ? 'bg-white/20' : 'bg-emerald-500 animate-pulse'}`} />
                                <span className="text-[10px] font-black uppercase text-white/20 tracking-tighter">{u.mode} mode</span>
                             </div>
                          </td>
                          <td className="px-8 py-6">
                             <span className="text-amber-500 font-black flex items-center gap-1.5 text-xs">🪙 {u.coins || 0}</span>
                             {u.coins > 100 && <span className="text-[8px] uppercase font-bold text-amber-500/40">VIP Wallet</span>}
                          </td>
                          <td className="px-8 py-6 text-right">
                             <div className="flex gap-2 justify-end opacity-40 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleWarnIp(u.ip)} className="p-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500 hover:text-black transition-all">⚠️</button>
                                <button onClick={(e) => handleBlockIp(e, u.ip)} className="p-2 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all">🚫</button>
                                <button onClick={() => lookupIp(u.ip)} className="p-2 rounded-lg bg-white/5 text-white/40 border border-white/5 hover:bg-indigo-500 hover:text-white transition-all">📍</button>
                             </div>
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr><td colSpan="4" className="py-20 text-center text-white/10 italic">No nodes matching your query.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'economy' && (
            <div className="space-y-8 animate-fade-in">
                <div className="p-10 rounded-3xl bg-amber-500/5 border border-amber-500/10 flex flex-col md:flex-row gap-10 items-center">
                   <div className="flex-1">
                      <h2 className="text-2xl font-bold mb-2">Global Coin Circulation</h2>
                      <p className="text-sm text-white/40 mb-6 leading-relaxed">System-wide monitoring of the Mana Mingle economy. Track inflation, user wealth distribution, and recent credits.</p>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="p-6 rounded-2xl bg-black/40 border border-white/5">
                            <div className="text-[10px] font-black text-amber-500/60 uppercase mb-1 tracking-widest">Total Wallets</div>
                            <div className="text-3xl font-black">{stats?.coinStats?.totalUsers || 0}</div>
                         </div>
                         <div className="p-6 rounded-2xl bg-black/40 border border-white/5">
                            <div className="text-[10px] font-black text-amber-500/60 uppercase mb-1 tracking-widest">Active Supply</div>
                            <div className="text-3xl font-black">{stats?.coinStats?.totalCoinsInSystem || 0}</div>
                         </div>
                      </div>
                   </div>
                   <div className="w-full md:w-80 h-64 rounded-3xl bg-black/40 border border-amber-500/10 p-6 flex flex-col justify-center items-center">
                      <div className="relative w-40 h-40">
                         <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                           <path className="text-white/5 stroke-current" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                           <path className="text-amber-500 stroke-current animate-dash" strokeWidth="3" strokeDasharray="75, 100" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                         </svg>
                         <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-black text-amber-500">75%</span>
                            <span className="text-[8px] font-bold text-white/30 uppercase tracking-widest">Cap. Sat.</span>
                         </div>
                      </div>
                      <div className="mt-4 text-[9px] font-bold text-white/30 uppercase tracking-[0.2em] text-center">Economy Health: Stable</div>
                   </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-8">
                   <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/10">
                      <h3 className="text-xs font-black uppercase tracking-widest text-amber-500 mb-6">Top Wealth Nodes</h3>
                      <div className="space-y-3">
                         {Object.entries(stats?.userWallets || {}).sort(([,a],[,b]) => b - a).slice(0, 5).map(([ip, bal], i) => (
                           <div key={ip} className="flex items-center justify-between p-4 rounded-xl bg-black/20 border border-white/5 group">
                              <div className="flex items-center gap-4">
                                 <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center font-black text-amber-500 text-xs">{i+1}</div>
                                 <span className="text-[11px] font-mono text-white/60">{ip}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                 <span className="text-xs font-black text-amber-500">🪙 {bal}</span>
                                 <button onClick={() => handleUpdateCoins(ip, 100)} className="text-[10px] font-black text-emerald-400 opacity-0 group-hover:opacity-100 transition-all">+100</button>
                                 <button onClick={() => handleUpdateCoins(ip, 0, true)} className="text-[10px] font-black text-rose-500 opacity-0 group-hover:opacity-100 transition-all">CLEAR</button>
                              </div>
                           </div>
                         ))}
                      </div>
                   </div>
                   <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/10">
                      <h3 className="text-xs font-black uppercase tracking-widest text-blue-400 mb-6">Economy Logic Controls</h3>
                      <div className="space-y-4">
                         <div className="flex items-center justify-between p-4 rounded-2xl bg-black/40">
                             <div className="text-xs font-bold">Base Login Credit</div>
                             <div className="text-xs font-black text-white/60">30 🪙</div>
                         </div>
                         <div className="flex items-center justify-between p-4 rounded-2xl bg-black/40">
                             <div className="text-xs font-bold">Daily Streak Bonus</div>
                             <div className="text-xs font-black text-white/60">+5 to +50 🪙</div>
                         </div>
                         <div className="flex items-center justify-between p-4 rounded-2xl bg-black/40">
                             <div className="text-xs font-bold">Premium Filter Cost</div>
                             <div className="text-xs font-black text-white/60">12 🪙 / min</div>
                         </div>
                         <div className="flex items-center justify-between p-4 rounded-2xl bg-black/40">
                             <div className="text-xs font-bold">3D Emoji Cost</div>
                             <div className="text-xs font-black text-white/60">5 🪙</div>
                         </div>
                      </div>
                   </div>
                </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-8 animate-fade-in">
               <div className="grid lg:grid-cols-2 gap-8">
                  <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/10">
                     <h3 className="text-xs font-black uppercase tracking-widest text-rose-400 mb-6 flex items-center gap-2">🚫 Firewall (Banned IPs)</h3>
                     <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                        {stats?.blockedIps?.map(ip => (
                          <div key={ip} className="flex justify-between items-center p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 group">
                             <div className="font-mono text-xs text-rose-400">{ip}</div>
                             <button onClick={() => handleUnblockIp(ip)} className="text-[10px] font-black uppercase text-emerald-400 hover:text-emerald-300 transition-colors">Recover Node</button>
                          </div>
                        ))}
                        {(!stats?.blockedIps || stats.blockedIps.length === 0) && <p className="py-20 text-center text-white/10 italic text-xs">Firewall is currently open.</p>}
                     </div>
                  </div>
                  <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/10">
                     <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-6 flex items-center gap-2">⚠️ Watchlist (Warned IPs)</h3>
                     <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                        {stats?.warnedIps?.map(ip => (
                          <div key={ip} className="flex justify-between items-center p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 group">
                             <div className="font-mono text-xs text-amber-400">{ip}</div>
                             <button onClick={async () => {
                               try {
                                  await fetch(`${API_BASE}/api/admin/unwarn`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-key': key }, body: JSON.stringify({ ip }) });
                                  fetchStats(key);
                                  setToast('Watcher removed.');
                               } catch(e){}
                             }} className="text-[10px] font-black uppercase text-white/20 hover:text-white">Clear Watch</button>
                          </div>
                        ))}
                        {(!stats?.warnedIps || stats.warnedIps.length === 0) && <p className="py-20 text-center text-white/10 italic text-xs">No active warnings.</p>}
                     </div>
                  </div>
               </div>
               
               <div className="p-10 rounded-3xl bg-rose-600/5 border border-rose-500/20 text-center">
                  <h3 className="text-lg font-black tracking-tight text-rose-500 mb-2 uppercase">Protocol Zero</h3>
                  <p className="text-xs text-rose-400/60 max-w-sm mx-auto mb-8 font-medium italic">Emergency termination of all socket connections, session cache flushing, and global route reset.</p>
                  
                  {!isKillswitchConfirm ? (
                    <button onClick={() => setIsKillswitchConfirm(true)} className="px-12 py-5 rounded-2xl bg-rose-500 text-white font-black uppercase tracking-[0.3em] shadow-2xl shadow-rose-900/40 hover:bg-rose-600 transition-all active:scale-95 text-xs">
                       Execute Killswitch
                    </button>
                  ) : (
                    <div className="flex gap-4 justify-center animate-in-zoom">
                       <button onClick={handleKillswitch} className="px-8 py-5 rounded-2xl bg-rose-600 text-white font-black text-xs uppercase tracking-widest shadow-2xl">Confirm Termination</button>
                       <button onClick={() => setIsKillswitchConfirm(false)} className="px-8 py-5 rounded-2xl bg-white/10 text-white font-black text-xs uppercase tracking-widest">Abort Logic</button>
                    </div>
                  )}
               </div>
            </div>
          )}

          {activeTab === 'logic' && (
            <div className="space-y-8 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {[
                      { field: 'adsEnabled', label: 'Ads Monetization', desc: 'Enable global banners', active: stats?.adsEnabled },
                      { field: 'allowDevTools', label: 'Dev Tools Access', desc: 'Allow F12 / Console', active: stats?.allowDevTools },
                      { field: 'maintenanceMode', label: 'Maintenance Mode', desc: 'Lock all new chats', active: stats?.maintenanceMode, color: 'bg-rose-500' },
                      { field: 'safetyAiEnabled', label: 'Safety AI Shield', desc: 'LLM Profanity Filtering', active: stats?.safetyAiEnabled, color: 'bg-indigo-500' },
                      { field: 'coinsEnabled', label: 'Economy Subsystem', desc: 'Allow coin logic', active: stats?.coinsEnabled !== false },
                      { field: 'guestRegistration', label: 'Deep Proxy Access', desc: 'Allow guest traffic', active: stats?.guestRegistration !== false },
                   ].map(f => (
                     <div key={f.field} className="p-8 rounded-3xl bg-white/[0.03] border border-white/10 flex flex-col justify-between group hover:border-indigo-500/30 transition-all min-h-[160px]">
                        <div>
                           <div className="text-sm font-black mb-1">{f.label}</div>
                           <p className="text-[10px] text-white/30 font-medium leading-relaxed">{f.desc}</p>
                        </div>
                        <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/5">
                           <span className={`text-[9px] font-black uppercase tracking-widest ${f.active ? 'text-emerald-400' : 'text-white/20'}`}>{f.active ? 'Active' : 'Offline'}</span>
                           <button
                             onClick={() => updateSetting(f.field, !f.active)}
                             className={`relative w-12 h-6 rounded-full transition-all ${f.active ? (f.color || 'bg-emerald-500 shadow-lg shadow-emerald-500/20') : 'bg-white/10'}`}
                           >
                             <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all transform ${f.active ? 'translate-x-6' : 'translate-x-0'}`} />
                           </button>
                        </div>
                     </div>
                   ))}
                </div>
                <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/10">
                   <h3 className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-6">Cluster Management</h3>
                   <div className="space-y-3">
                      {stats?.roomList?.map(r => (
                        <div key={r.id} className="p-4 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
                           <div>
                              <div className="text-[11px] font-black uppercase">{r.mode} Cluster</div>
                              <div className="text-[10px] text-white/30 font-mono">ID: {r.id}</div>
                           </div>
                           <div className="flex items-center gap-4">
                              <span className="px-2 py-1 rounded bg-white/5 text-[9px] font-bold text-white/50">{r.interest}</span>
                              <span className="text-xs font-black text-indigo-400">{r.participants} Strangers</span>
                              <button className="text-[10px] font-black text-rose-500 opacity-20 hover:opacity-100 transition-opacity">CLOSE</button>
                           </div>
                        </div>
                      ))}
                      {(!stats?.roomList || stats.roomList.length === 0) && <p className="text-center py-10 text-xs text-white/10 italic">No clusters active.</p>}
                   </div>
                </div>
            </div>
          )}

        </main>
      </div>

      {/* Admin Quick Notification Bar */}
      {toast && (
        <div className="fixed bottom-10 right-10 z-[500] px-8 py-4 rounded-2xl bg-indigo-600 text-white font-black text-[11px] shadow-2xl shadow-indigo-600/50 border border-indigo-400/30 animate-slide-in-right flex items-center gap-4 uppercase tracking-[0.2em]">
           <div className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
           {toast}
        </div>
      )}

      {/* Tablet/Mobile Overlay Warning */}
      <div className="lg:hidden fixed inset-0 z-[1000] bg-black p-10 flex flex-col items-center justify-center text-center">
         <div className="text-4xl mb-6">🖥️</div>
         <h2 className="text-xl font-bold mb-4">Command Console Restricted</h2>
         <p className="text-sm text-white/40 leading-relaxed mb-10">The admin terminal requires a high-resolution viewport for visualization mapping and secure cluster management. Please switch to a desktop environment.</p>
         <button onClick={() => window.location.href = '/'} className="px-8 py-4 bg-white/5 rounded-xl text-xs font-bold uppercase tracking-widest border border-white/10">Return to Portal</button>
      </div>
    </div>
  );
}
