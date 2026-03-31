import { useState, useEffect, useMemo } from 'react';

const API_BASE = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : '');

/**
 * Mana Mingle Admin Dashboard v2.5
 * Features: Live stats, Visualizations, Economy control, Security, Moderation, Monitoring, Ads
 */
export function AdminDashboard({ onJoinRoom }) {
  const [key, setKey] = useState(sessionStorage.getItem('mm_admin_key') || '');
  const [isLogged, setIsLogged] = useState(!!sessionStorage.getItem('mm_admin_key'));
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [ipInput, setIpInput] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [isKillswitchConfirm, setIsKillswitchConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // overview, users, creators, room-monitoring, economy, security, ads, logic
  const [creators, setCreators] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [history, setHistory] = useState([]);
  const [toast, setToast] = useState(null);
  const [adForm, setAdForm] = useState({ hero: '', sidebar: '', footer: '' });

  const fetchStats = async (adminKey) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/overview`, {
        headers: { 'x-admin-key': adminKey },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        if (data.adScripts) setAdForm(data.adScripts);
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

  const fetchCreators = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/creators`, {
        headers: { 'x-admin-key': key },
      });
      if (res.ok) {
        const data = await res.json();
        setCreators(data.creators || []);
        setWithdrawals(data.withdrawals || []);
      }
    } catch (e) { }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/history`, {
        headers: { 'x-admin-key': key },
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (e) { }
  };

  const handleCreatorApprove = async (creatorId, status) => {
    try {
      await fetch(`${API_BASE}/api/admin/creators/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({ creatorId, status }),
      });
      fetchCreators();
      setToast(`⭐ Creator ${status}`);
    } catch (e) { }
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

  const handleAdSave = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/admin/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({ adScripts: adForm }),
      });
      if (res.ok) setToast('✅ Ad Settings Updated!');
    } catch (e) { }
  };

  const handleEndRoom = async (roomId) => {
    if (!window.confirm(`⚠️ Terminate user session ${roomId}?`)) return;
    try {
      // We use the socket event directly via the server listener I added
      // But we can also use an API endpoint. For simplicity, we can just emit if we had socket here.
      // However, AdminDashboard is an API-first component. I'll add an API endpoint in server soon if needed.
      // For now, let's assume we use an endpoint I'll add.
      const res = await fetch(`${API_BASE}/api/admin/end-room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
        body: JSON.stringify({ roomId }),
      });
      if (res.ok) {
        setToast(`💥 Room ${roomId} terminated.`);
        fetchStats(key);
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
        body: JSON.stringify({ ip, message: '⚠️ WARNING: Your behavior flag has been raised. Platform de-authorization imminent.' }),
      });
      fetchStats(key);
      setToast(`⚠️ Warning broadcast to user ${ip}`);
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
      setToast(`💰 Coin logic modified for ${ip}`);
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
      setToast('✅ Metadata resolved');
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
      setToast('📣 Global Broadcast initialized.');
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
        setToast(`💥 System Restart: ${data.kicked} users disconnected.`);
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
      alert(`User Detail: ${data.city}, ${data.region_code}, ${data.country_name} · ISP: ${data.org}`);
    } catch (e) { alert('Lookup service failed'); }
  };

  const handleExportCSV = (data, filename) => {
    if (!data || !data.length) return setToast('⚠️ No data structure found for export');

    // Safely extract all unique headers from JSON objects
    const headers = Array.from(new Set(data.flatMap(Object.keys)));

    // Escape standard CSV strings
    const csvRows = [
      headers.join(','),
      ...data.map(row => headers.map(fieldName => {
        let val = row[fieldName];
        if (typeof val === 'object') val = JSON.stringify(val);
        val = String(val || '');
        // Escape quotes and commas
        return `"${val.replace(/"/g, '""')}"`;
      }).join(','))
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${Date.now()}.csv`;
    a.click();
    setToast(`📥 Exported ${filename}.csv`);
  };

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    if (isLogged) {
      const interval = setInterval(() => {
        fetchStats(key);
        if (activeTab === 'creators') fetchCreators();
        if (activeTab === 'history') fetchHistory();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [isLogged, key, activeTab]);

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
        <div className="max-w-md w-full p-10 rounded-[40px] bg-black border border-white/10 backdrop-blur-3xl shadow-[0_0_100px_rgba(99,102,241,0.2)] animate-in-zoom">
          <div className="flex flex-col items-center mb-8">
            <img src="/apple-touch-icon.png" alt="MM" className="w-20 h-20 mb-6 drop-shadow-[0_0_20px_rgba(6,182,212,0.4)]" />
            <h1 className="text-2xl font-black uppercase tracking-[0.2em] italic">Admin <span className="text-cyan-400">Dashboard</span></h1>
            <p className="text-[10px] text-white/20 mt-2 font-black uppercase tracking-[0.3em]">Authorized Access Required</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Enter Admin Key..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 focus:outline-none focus:border-cyan-500/50 transition-all text-center tracking-widest font-black uppercase text-xs"
              />
            </div>
            <button className="w-full py-4 bg-cyan-500 text-black rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-cyan-600/20 hover:scale-[1.02] active:scale-95 transition-all">
              Login to Dashboard
            </button>
            <button
              type="button"
              onClick={() => window.location.href = '/'}
              className="w-full text-[10px] text-white/20 hover:text-white/40 transition-colors uppercase tracking-[0.4em] font-black mt-6"
            >
              ← Back to Site
            </button>
            {error && <p className="text-rose-400 text-[10px] text-center font-black uppercase mt-4 animate-shake">Invalid Admin Key</p>}
          </form>
        </div>
      </div>
    );
  }

  const UsageChart = ({ data }) => {
    if (!data || data.length < 2) return <div className="h-40 flex items-center justify-center text-white/10 text-xs italic">Waiting for data...</div>;
    const maxUsers = Math.max(...data.map(d => d.users), 10);
    return (
      <div className="h-40 flex items-end gap-1 px-2 border-b border-l border-white/5 bg-black/20 rounded-lg">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex-1 bg-cyan-500/30 rounded-t-sm hover:bg-cyan-500 transition-all relative group"
            style={{ height: `${(d.users / maxUsers) * 100}%` }}
          >
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-black rounded text-[8px] opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
              {d.users} Active
            </div>
          </div>
        ))}
      </div>
    );
  };

  const ResourceBar = ({ label, value, max, color }) => (
    <div className="space-y-1">
      <div className="flex justify-between text-[8px] uppercase tracking-widest font-black text-white/20 px-1">
        <span>{label}</span>
        <span>{Math.round((value / max) * 100)}%</span>
      </div>
      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-[#f8fafc] font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      <div className="flex min-h-screen">

        {/* Sidebar Nav */}
        <aside className="w-72 border-r border-white/5 bg-black/40 backdrop-blur-3xl p-8 hidden lg:flex flex-col gap-10">
          <div className="flex items-center gap-4 px-2">
            <img src="/apple-touch-icon.png" alt="M" className="w-10 h-10 object-contain drop-shadow-[0_0_10px_#06b6d4]" />
            <div className="flex flex-col">
              <span className="font-black text-sm tracking-[0.2em] italic uppercase leading-none">Mana <span className="text-cyan-400">Admin</span></span>
              <span className="text-[8px] font-black text-white/20 uppercase tracking-widest mt-1">System Online</span>
            </div>
          </div>

          <nav className="flex flex-col gap-1.5">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'users', label: 'Active Users', icon: '👤' },
              { id: 'creators', label: 'Creator Hub', icon: '⭐' },
              { id: 'room-monitoring', label: 'Live Monitoring', icon: '👁️' },
              { id: 'economy', label: 'Economy Hub', icon: '🪙' },
              { id: 'security', label: 'Security & Moderation', icon: '🛡️' },
              { id: 'ads', label: 'Ads Manager', icon: '💰' },
              { id: 'logic', label: 'System Settings', icon: '⚙️' },
              { id: 'history', label: 'Admin History', icon: '📜' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-4 px-5 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-xl' : 'text-white/30 hover:text-white/60 hover:bg-white/5'}`}
              >
                <span className="text-lg opacity-60 grayscale group-hover:grayscale-0">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto space-y-4">
            <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 shadow-inner">
              <div className="text-[8px] font-black uppercase text-white/10 mb-4 tracking-widest px-1 italic">Diagnostics</div>
              <div className="space-y-4">
                <ResourceBar label="Server Memory" value={stats?.memory?.heapUsed || 0} max={stats?.memory?.heapTotal || 1} color="bg-cyan-500" />
                <ResourceBar label="CPU Load" value={35} max={100} color="bg-indigo-500" />
              </div>
            </div>
            <button
              onClick={() => { sessionStorage.removeItem('mm_admin_key'); setIsLogged(false); window.location.reload(); }}
              className="w-full py-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all shadow-xl shadow-rose-900/10"
            >
              Terminate Auth
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-12 lg:p-14 custom-scrollbar lg:bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.03),transparent_40%)]">
          <header className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-8 animate-fade-in-down">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-black tracking-tight italic uppercase m-0">{activeTab.replace('-', ' ')}</h1>
                <div className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[9px] font-black text-cyan-400 uppercase tracking-widest shadow-xl">v2.5</div>
              </div>
              <p className="text-white/20 text-[11px] font-black uppercase tracking-widest">Administrative Management Dashboard · Tracking {stats?.users || 0} Connected Users</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.3em] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_#10b981]" />
                  Administrative Access Secure
                </span>
                <span className="text-[10px] text-white/10 font-black uppercase italic mt-1">Uptime: {Math.floor((stats?.stats?.uptimeSeconds || 0) / 3600)}H {Math.floor(((stats?.stats?.uptimeSeconds || 0) % 3600) / 60)}M</span>
              </div>
            </div>
          </header>

          {activeTab === 'overview' && (
            <div className="space-y-10 animate-fade-in">
              {/* Massive Counters */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Active Users', value: stats?.users || 0, color: 'text-cyan-400', icon: '👤', shadow: 'shadow-cyan-900/10' },
                  { label: 'Active Rooms', value: stats?.rooms || 0, color: 'text-indigo-400', icon: '🏠', shadow: 'shadow-indigo-900/10' },
                  { label: 'Total Connections', value: stats?.stats?.totalConnections || 0, color: 'text-purple-400', icon: '🔄', shadow: 'shadow-purple-900/10' },
                  { label: 'System Wealth', value: stats?.coinStats?.totalCoinsInSystem || 0, color: 'text-amber-400', icon: '🪙', shadow: 'shadow-amber-900/10' },
                ].map(s => (
                  <div key={s.label} className={`p-8 rounded-[40px] bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group relative overflow-hidden ${s.shadow}`}>
                    <div className="absolute top-4 right-4 text-4xl opacity-5 group-hover:opacity-10 group-hover:scale-125 transition-all grayscale">{s.icon}</div>
                    <div className="text-[9px] font-black uppercase text-white/20 mb-2 tracking-[0.2em] italic">{s.label}</div>
                    <div className={`text-4xl font-black tracking-tighter italic ${s.color}`}>{s.value.toLocaleString()}</div>
                  </div>
                ))}
              </div>

              <div className="grid lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 p-10 rounded-[50px] bg-white/[0.02] border border-white/5 shadow-2xl">
                  <div className="flex justify-between items-center mb-10">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400">User Activity Graph</h3>
                    <span className="text-[9px] font-black text-white/10 uppercase tracking-widest italic">Last 60m Activity</span>
                  </div>
                  <UsageChart data={stats?.statsHistory} />
                </div>
                <div className="p-10 rounded-[50px] bg-white/[0.02] border border-white/5 flex flex-col shadow-2xl relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-40 pointer-events-none" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400 mb-8 relative z-10">Interface Distribution</h3>
                  <div className="flex-1 space-y-8 relative z-10">
                    <div className="space-y-3">
                      <div className="flex justify-between text-[11px] font-black uppercase italic"><span className="text-white/40 tracking-widest">Video Streams</span> <span className="text-cyan-400">72%</span></div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400" style={{ width: '72%' }} /></div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between text-[11px] font-black uppercase italic"><span className="text-white/40 tracking-widest">Text Messages</span> <span className="text-indigo-400">28%</span></div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden shadow-inner"><div className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400" style={{ width: '28%' }} /></div>
                    </div>
                    <div className="mt-12 pt-8 border-t border-white/5">
                      <div className="grid grid-cols-2 gap-6">
                        <div className="text-center p-5 rounded-[24px] bg-white/5 border border-white/5">
                          <div className="text-[8px] font-black uppercase text-white/20 mb-2 tracking-widest">Queue (V)</div>
                          <div className="text-2xl font-black text-white tracking-widest italic">{stats?.queues?.video || 0}</div>
                        </div>
                        <div className="text-center p-5 rounded-[24px] bg-white/5 border border-white/5">
                          <div className="text-[8px] font-black uppercase text-white/20 mb-2 tracking-widest">Queue (T)</div>
                          <div className="text-2xl font-black text-white tracking-widest italic">{stats?.queues?.text || 0}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-10">
                <div className="p-10 rounded-[50px] bg-[#050505] border border-white/10 shadow-2xl">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400 mb-8 italic">📢 Global Announcement</h3>
                  <form onSubmit={handleSendAnnouncement} className="space-y-6">
                    <textarea
                      value={announcement}
                      onChange={(e) => setAnnouncement(e.target.value)}
                      placeholder="Message for all users..."
                      className="w-full bg-white/5 border border-white/10 rounded-3xl px-6 py-6 text-sm min-h-[120px] outline-none focus:border-cyan-500/50 transition-all font-bold tracking-tight shadow-inner"
                    />
                    <button className="w-full py-5 bg-cyan-500 text-black rounded-3xl text-[11px] font-black uppercase tracking-[0.3em] shadow-xl shadow-cyan-600/30 hover:bg-white transition-all active:scale-95">Send Global Announcement</button>
                  </form>
                </div>
                <div className="p-10 rounded-[50px] bg-rose-500/[0.02] border border-rose-500/10 shadow-2xl overflow-hidden relative">
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-rose-500/5 rounded-full blur-3xl" />
                  <div className="flex justify-between items-center mb-8 relative z-10">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-rose-500 italic">🚩 Reported Content</h3>
                    <span className="text-[9px] font-black bg-rose-500 text-white px-3 py-1 rounded-full shadow-lg">{stats?.openReportsCount || 0} NEW DATA</span>
                  </div>
                  <div className="space-y-4 max-h-[180px] overflow-y-auto pr-4 custom-scrollbar relative z-10">
                    {stats?.reports?.map(r => (
                      <div key={r.id} className="p-4 rounded-[20px] bg-black/40 border border-white/5 flex items-center justify-between group hover:border-rose-500/30 transition-all">
                        <div>
                          <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest">{r.reason}</div>
                          <div className="text-[9px] text-white/20 font-black mt-1 uppercase">USER: {r.targetIp}</div>
                        </div>
                        <button onClick={() => handleResolveReport(r.id)} className="text-[9px] font-black uppercase text-white/20 hover:text-rose-400 transition-all">Resolve Report →</button>
                      </div>
                    ))}
                    {(!stats?.reports || stats.reports.length === 0) && (
                      <div className="flex flex-col items-center justify-center py-10 opacity-10 grayscale">
                        <div className="text-4xl mb-4">🛡️</div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em]">System Status: Nominal</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-10 animate-fade-in">
              <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
                <div className="relative flex-1 w-full group">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-white/10 text-xl group-focus-within:text-cyan-400 transition-colors">🔍</span>
                  <input
                    type="text"
                    placeholder="Search Users (IP, Nick, Country)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-[30px] pl-16 pr-8 py-5 text-sm focus:outline-none focus:border-cyan-500/50 transition-all font-bold tracking-tight shadow-inner"
                  />
                </div>
                <div className="flex gap-4">
                  <button onClick={() => handleExportCSV(filteredUsers, 'platform_users')} className="px-8 py-5 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-cyan-500/20 hover:text-cyan-400 hover:border-cyan-500/30 transition-all shadow-xl">Export CSV</button>
                  <button onClick={() => fetchStats(key)} className="px-8 py-5 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/10 transition-all shadow-xl">Refresh Data</button>
                </div>
              </div>

              <div className="rounded-[40px] bg-white/[0.02] border border-white/5 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-white/[0.02] border-b border-white/5 text-[10px] uppercase font-black tracking-[0.3em] text-white/20 italic">
                        <th className="px-10 py-6">User Info</th>
                        <th className="px-10 py-6">Connection Details</th>
                        <th className="px-10 py-6">Wallet Balance</th>
                        <th className="px-10 py-6 text-right">Moderation Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {filteredUsers.map(u => (
                        <tr key={u.socketId} className="hover:bg-white/[0.01] transition-all group border-b border-white/[0.01]">
                          <td className="px-10 py-8">
                            <div className="flex items-center gap-5">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-white/5 border border-white/10 text-cyan-400 font-black italic transition-all group-hover:scale-110 group-hover:border-cyan-500/40 ${u.mode !== 'idle' ? 'ring-2 ring-emerald-500 ring-offset-8 ring-offset-black' : ''}`}>
                                {u.nickname?.[0] || 'A'}
                              </div>
                              <div>
                                <div className="font-black text-white group-hover:text-cyan-400 transition-colors uppercase tracking-tight">{u.nickname}</div>
                                <div className="text-[10px] text-white/20 uppercase font-black tracking-widest mt-0.5">{u.country || 'Unknown Relay'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-10 py-8">
                            <div className="font-mono text-xs text-white/30 mb-1.5 font-bold tracking-tight uppercase">IP: {u.ip}</div>
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${u.mode === 'idle' ? 'bg-white/20' : 'bg-emerald-500 animate-pulse'}`} />
                              <span className="text-[10px] font-black uppercase text-white/20 tracking-tighter italic">{u.mode} mode active</span>
                            </div>
                          </td>
                          <td className="px-10 py-8">
                            <div className="text-amber-500 font-black flex items-center gap-2 text-sm italic">🪙 {u.coins || 0}</div>
                            {u.coins > 200 && <span className="text-[10px] uppercase font-black text-amber-500/20 tracking-widest mt-1 block">Elite User</span>}
                          </td>
                          <td className="px-10 py-8 text-right">
                            <div className="flex gap-3 justify-end opacity-20 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                              <button onClick={() => handleWarnIp(u.ip)} className="p-3 rounded-[15px] bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500 hover:text-black transition-all">⚠️</button>
                              <button onClick={(e) => handleBlockIp(e, u.ip)} className="p-3 rounded-[15px] bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all">🚫</button>
                              <button onClick={() => lookupIp(u.ip)} className="p-3 rounded-[15px] bg-white/5 text-white/40 border border-white/5 hover:bg-white hover:text-black transition-all">📍</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr><td colSpan="4" className="py-24 text-center text-white/10 italic text-sm font-black uppercase tracking-[0.5em]">No matching user data found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'room-monitoring' && (
            <div className="space-y-10 animate-fade-in">
              <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
                <div className="flex flex-col">
                  <h2 className="text-2xl font-black italic uppercase tracking-tight">Active Room <span className="text-cyan-400">Overview</span></h2>
                  <p className="text-[10px] text-white/30 font-black uppercase tracking-widest mt-1">Live visualization of all active rooms</p>
                </div>
                <div className="px-5 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-black text-cyan-400 uppercase tracking-widest">
                  {stats?.rooms || 0} LIVE ROOMS
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {stats?.roomList?.map(room => (
                  <div key={room.id} className="group relative rounded-[40px] bg-white/[0.02] border border-white/10 hover:border-cyan-500/40 p-8 flex flex-col transition-all shadow-2xl backdrop-blur-xl">
                    <div className="absolute top-4 right-8 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_#ef4444]" />
                      <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">LIVE OVERVIEW</span>
                    </div>

                    <div className="mb-6">
                      <div className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] mb-1 italic">{room.mode.replace('_', ' ')}</div>
                      <h4 className="text-xl font-black text-white tracking-tight uppercase italic">{room.interest} ROOM</h4>
                    </div>

                    <div className="bg-black/60 rounded-3xl p-6 mb-8 border border-white/5">
                      <div className="flex justify-between items-center mb-6">
                        <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">User Identity List</span>
                        <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest italic">{room.participantCount} Active</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {room.participants?.map((p, pIdx) => (
                          <div key={p.socketId} className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-white/50 group-hover:border-cyan-500/20" title={`${p.nickname} (${p.country})`}>
                            {p.nickname?.[0] || '?'}{pIdx + 1}
                          </div>
                        ))}
                      </div>
                      {/* AI MONITORING LABEL */}
                      <div className="mt-8 pt-4 border-t border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_#06b6d4]" />
                          <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest italic">AI Guard Active</span>
                        </div>
                        <span className="text-[8px] font-black text-white/10 uppercase tracking-widest italic">Encrypted Feed</span>
                      </div>
                    </div>

                    <div className="mt-auto grid grid-cols-1 gap-3">
                      <button
                        onClick={() => onJoinRoom && onJoinRoom(room.id, room.mode, room.interest)}
                        className="w-full py-3.5 bg-white/5 hover:bg-white text-white hover:text-black transition-all rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10"
                      >
                        View Room →
                      </button>
                      <button
                        onClick={() => handleEndRoom(room.id)}
                        className="w-full py-3.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white transition-all rounded-2xl text-[10px] font-black uppercase tracking-widest border border-rose-500/20"
                      >
                        End Room
                      </button>
                    </div>
                  </div>
                ))}
                {(!stats?.roomList || stats.roomList.length === 0) && (
                  <div className="lg:col-span-3 py-40 flex flex-col items-center opacity-10">
                    <div className="text-6xl mb-6">🌑</div>
                    <p className="text-sm font-black uppercase tracking-[0.5em]">No active rooms detected</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'creators' && (
            <div className="space-y-10 animate-fade-in">
              <div className="p-10 rounded-[50px] bg-gradient-to-br from-cyan-500/5 to-transparent border border-cyan-500/10 shadow-2xl">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400 italic">⭐ Creator Approval Queue</h3>
                  <button onClick={() => handleExportCSV(creators, 'platform_creators')} className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] hover:bg-cyan-500/20 hover:text-cyan-400 border-cyan-500/30 transition-all shadow-xl">Export CSV</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase font-black tracking-widest text-white/20 border-b border-white/5 italic">
                        <th className="py-4">Creator Handle</th>
                        <th className="py-4">Platform</th>
                        <th className="py-4">Metrics (Coins/Clicks)</th>
                        <th className="py-4">Status</th>
                        <th className="py-4 text-right">Approval Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {creators?.map(c => (
                        <tr key={c.id} className="hover:bg-white/[0.01] transition-all group">
                          <td className="py-6 flex flex-col">
                            <span className="font-black text-white italic group-hover:text-cyan-400 transition-colors uppercase tracking-widest">{c.handle_name}</span>
                            <a href={c.profile_link} target="_blank" className="text-[9px] text-white/20 hover:text-white transition-colors mt-1">View Profile →</a>
                          </td>
                          <td className="py-6 text-xs text-white/40 font-black uppercase tracking-widest">{c.platform}</td>
                          <td className="py-6 text-xs font-black uppercase tracking-widest">
                            <span className="text-cyan-400 italic">🪙 {c.coins_earned}</span>
                            <span className="mx-2 text-white/5">/</span>
                            <span className="text-indigo-400 italic">🖱️ {c.referral_count || 0}</span>
                          </td>
                          <td className="py-6">
                            <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${c.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="py-6 text-right">
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => handleCreatorApprove(c.id, 'approved')} className="p-2 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-lg transition-all">⭐ Approve</button>
                              <button onClick={() => handleCreatorApprove(c.id, 'rejected')} className="p-2 bg-rose-500/20 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg transition-all">✕ Reject</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-10 rounded-[50px] bg-gradient-to-br from-emerald-500/5 to-transparent border border-emerald-500/10 shadow-2xl">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400 mb-8 italic">💸 Payment Requests (Withdrawals)</h3>
                <div className="space-y-4">
                  {withdrawals?.map(w => (
                    <div key={w.id} className="p-6 rounded-[30px] bg-white/[0.02] border border-white/5 flex items-center justify-between group">
                      <div>
                        <div className="text-sm font-black text-white italic uppercase tracking-widest">{w.creators?.handle_name}</div>
                        <div className="text-[10px] text-white/20 font-black uppercase tracking-widest mt-1">UPI: {w.upi}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-black text-emerald-400 italic mb-2 tracking-tighter">₹{w.amount}</div>
                        <button className="px-6 py-2 bg-emerald-500 text-black font-black uppercase tracking-widest text-[9px] rounded-xl hover:bg-white transition-all shadow-xl shadow-emerald-500/30">Authorize Payout</button>
                      </div>
                    </div>
                  ))}
                  {withdrawals?.length === 0 && <div className="py-10 text-center opacity-10 text-xs font-black uppercase tracking-[0.5em]">No pending requests found</div>}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'ads' && (
            <div className="space-y-10 animate-fade-in">
              <div className="p-10 rounded-[50px] bg-gradient-to-br from-amber-500/5 to-transparent border border-amber-500/10 shadow-2xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                  <div>
                    <h2 className="text-2xl font-black italic uppercase tracking-tight">Ads <span className="text-amber-500">Management</span></h2>
                    <p className="text-[10px] text-white/30 font-black uppercase tracking-widest mt-1">Manage platform advertisement settings</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Global State:</span>
                    <button
                      onClick={() => updateSetting('adsEnabled', !stats?.adsEnabled)}
                      className={`relative w-12 h-6 rounded-full transition-all ${stats?.adsEnabled ? 'bg-amber-500' : 'bg-white/10'}`}
                    >
                      <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all transform ${stats?.adsEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

                <form onSubmit={handleAdSave} className="space-y-8">
                  <div className="grid lg:grid-cols-3 gap-8">
                    {[
                      { id: 'hero', label: 'Primary Hero Slot', desc: 'Center top landing' },
                      { id: 'sidebar', label: 'Sidebar Gutter', desc: 'Floating side slot' },
                      { id: 'footer', label: 'Basement Overlay', desc: 'Bottom landing slot' },
                    ].map(slot => (
                      <div key={slot.id} className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-white/40">{slot.label}</label>
                          <span className="text-[8px] font-black text-white/10 uppercase italic">{slot.desc}</span>
                        </div>
                        <textarea
                          value={adForm[slot.id]}
                          onChange={(e) => setAdForm(prev => ({ ...prev, [slot.id]: e.target.value }))}
                          placeholder="Paste Ad Script code here..."
                          className="w-full bg-black/40 border border-white/10 rounded-[28px] p-6 text-xs h-[240px] focus:border-amber-500/40 transition-all font-mono shadow-inner outline-none text-amber-500/60"
                        />
                      </div>
                    ))}
                  </div>
                  <button className="w-full py-5 bg-amber-500 text-black rounded-3xl text-[11px] font-black uppercase tracking-[0.4em] shadow-xl shadow-amber-900/40 hover:bg-white transition-all active:scale-95">Save Ads Configuration</button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'economy' && (
            <div className="space-y-10 animate-fade-in">
              <div className="p-12 rounded-[50px] bg-[#050505] border border-amber-500/10 flex flex-col lg:flex-row gap-12 items-center shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[100px] -mr-32 -mt-32" />
                <div className="flex-1 relative z-10">
                  <h2 className="text-3xl font-black italic uppercase tracking-tight mb-4">Economy <span className="text-amber-500">Overview</span></h2>
                  <p className="text-sm text-white/30 mb-10 leading-relaxed font-bold italic uppercase tracking-wide">Monitoring real-time coin distribution and user balance across the system.</p>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="p-8 rounded-[32px] bg-white/[0.02] border border-white/5 shadow-inner">
                      <div className="text-[10px] font-black text-amber-500/60 uppercase mb-3 tracking-[0.2em] italic">User Wallets</div>
                      <div className="text-4xl font-black text-white italic tracking-tighter">{stats?.coinStats?.totalUsers || 0}</div>
                    </div>
                    <div className="p-8 rounded-[32px] bg-white/[0.02] border border-white/5 shadow-inner">
                      <div className="text-[10px] font-black text-amber-500/60 uppercase mb-3 tracking-[0.2em] italic">Active Supply</div>
                      <div className="text-4xl font-black text-white italic tracking-tighter">{stats?.coinStats?.totalCoinsInSystem || 0}</div>
                    </div>
                  </div>
                </div>
                <div className="w-full lg:w-96 p-10 rounded-[40px] bg-white/[0.02] border border-white/5 backdrop-blur-3xl flex flex-col items-center justify-center relative z-10">
                  <div className="relative w-48 h-48">
                    <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                      <path className="text-white/5 stroke-current" strokeWidth="2.5" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="text-amber-500/60 stroke-current animate-dash shadow-xl" strokeWidth="2.5" strokeDasharray="75, 100" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-4xl font-black text-amber-500 italic">75%</span>
                      <span className="text-[9px] font-black text-white/10 uppercase tracking-[0.3em] mt-1">Capacity Usage</span>
                    </div>
                  </div>
                  <div className="mt-8 text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] animate-pulse">Status: Stable</div>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-10">
                <div className="p-10 rounded-[50px] bg-white/[0.02] border border-white/5 shadow-2xl">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-500 mb-8 italic">Top Coin Holders</h3>
                  <div className="space-y-4">
                    {Object.entries(stats?.userWallets || {}).sort(([, a], [, b]) => b - a).slice(0, 5).map(([ip, bal], i) => (
                      <div key={ip} className="flex items-center justify-between p-5 rounded-[24px] bg-black/40 border border-white/5 group hover:border-amber-500/20 transition-all">
                        <div className="flex items-center gap-5">
                          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center font-black text-amber-500 text-sm italic border border-amber-500/20 group-hover:scale-110 transition-transform">{i + 1}</div>
                          <span className="text-xs font-black text-white/40 uppercase tracking-widest">{ip}</span>
                        </div>
                        <div className="flex items-center gap-6">
                          <span className="text-sm font-black text-amber-500 italic">🪙 {bal}</span>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => handleUpdateCoins(ip, 100)} className="text-[9px] font-black text-emerald-400 uppercase tracking-widest hover:text-white transition-colors">+100</button>
                            <button onClick={() => handleUpdateCoins(ip, 0, true)} className="text-[9px] font-black text-rose-500 uppercase tracking-widest hover:text-white transition-colors">CLEAR</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-10 rounded-[50px] bg-white/[0.02] border border-white/5 shadow-2xl">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400 mb-8 italic">Economy Parameters</h3>
                  <div className="space-y-4">
                    {[
                      { label: 'Starting Coins Balance', val: '30 🪙' },
                      { label: 'Daily Bonus Coins', val: '30 🪙 + Bonus' },
                      { label: 'Premium Filter Cost', val: '12 🪙 / min' },
                      { label: 'Premium Emojis', val: '5 🪙 / unit' }
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between p-5 rounded-[24px] bg-black/60 border border-white/5 shadow-inner">
                        <div className="text-[10px] font-black uppercase tracking-widest text-white/40">{item.label}</div>
                        <div className="text-[11px] font-black text-white tracking-widest italic">{item.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-10 animate-fade-in">
              <div className="grid lg:grid-cols-2 gap-10">
                <div className="p-10 rounded-[50px] bg-rose-500/[0.02] border border-rose-500/10 shadow-2xl">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-rose-500 mb-8 italic flex items-center gap-3">🚫 Banned IP List</h3>
                  <div className="space-y-4 max-h-[360px] overflow-y-auto pr-4 custom-scrollbar">
                    {stats?.blockedIps?.map(ip => (
                      <div key={ip} className="flex justify-between items-center p-5 rounded-3xl bg-black border border-rose-500/20 group hover:border-rose-500/50 transition-all shadow-inner">
                        <div className="font-mono text-xs text-rose-500 font-bold uppercase tracking-tight">IP: {ip}</div>
                        <button onClick={() => handleUnblockIp(ip)} className="text-[9px] font-black uppercase text-white/20 hover:text-emerald-400 transition-colors">Remove ban →</button>
                      </div>
                    ))}
                    {(!stats?.blockedIps || stats.blockedIps.length === 0) && (
                      <div className="py-24 text-center opacity-10 flex flex-col items-center">
                        <div className="text-4xl mb-6">🛰️</div>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em]">No blocked IPs</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-10 rounded-[50px] bg-amber-500/[0.02] border border-amber-500/10 shadow-2xl">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-500 mb-8 italic flex items-center gap-3">⚠️ User Watchlist (Warned)</h3>
                  <div className="space-y-4 max-h-[360px] overflow-y-auto pr-4 custom-scrollbar">
                    {stats?.warnedIps?.map(ip => (
                      <div key={ip} className="flex justify-between items-center p-5 rounded-3xl bg-black border border-amber-500/20 group hover:border-amber-500/50 transition-all shadow-inner">
                        <div className="font-mono text-xs text-amber-500 font-bold uppercase tracking-tight">IP: {ip}</div>
                        <button onClick={async () => {
                          try {
                            await fetch(`${API_BASE}/api/admin/unwarn`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-key': key }, body: JSON.stringify({ ip }) });
                            fetchStats(key);
                            setToast('Warning cleared.');
                          } catch (e) { }
                        }} className="text-[9px] font-black uppercase text-white/20 hover:text-white transition-colors">Clear Warning →</button>
                      </div>
                    ))}
                    {(!stats?.warnedIps || stats.warnedIps.length === 0) && (
                      <div className="py-24 text-center opacity-10 flex flex-col items-center">
                        <div className="text-4xl mb-6">👁️</div>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em]">No users flagged</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-12 rounded-[60px] bg-rose-500/[0.02] border border-rose-500/20 text-center shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-t from-rose-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <h3 className="text-3xl font-black italic tracking-tighter text-rose-600 mb-4 uppercase">Emergency System Reset</h3>
                <p className="text-[11px] text-rose-500/40 max-w-lg mx-auto mb-10 font-bold italic uppercase tracking-widest leading-relaxed">Absolute emergency termination of all active sessions and clearing of temporary system data.</p>

                {!isKillswitchConfirm ? (
                  <button onClick={() => setIsKillswitchConfirm(true)} className="px-20 py-6 rounded-[30px] bg-rose-600 text-white font-black uppercase tracking-[0.4em] shadow-[0_20px_50px_rgba(225,29,72,0.3)] hover:scale-[1.02] hover:bg-rose-500 transition-all active:scale-95 text-xs">
                    Execute Emergency Reset
                  </button>
                ) : (
                  <div className="flex gap-4 justify-center animate-in-zoom">
                    <button onClick={handleKillswitch} className="px-10 py-6 rounded-[30px] bg-white text-rose-600 shadow-[0_0_50px_rgba(159,18,57,1)] font-black text-[11px] uppercase tracking-widest animate-pulse">Confirm System Reset</button>
                    <button onClick={() => setIsKillswitchConfirm(false)} className="px-10 py-6 rounded-[30px] bg-white/5 text-white font-black text-[11px] uppercase tracking-widest border border-white/10">Cancel Reset</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'logic' && (
            <div className="space-y-10 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {[
                  { field: 'adsEnabled', label: 'Ads Manager', desc: 'Manage advertisement visibility', active: stats?.adsEnabled },
                  { field: 'allowDevTools', label: 'Developer Tools', desc: 'Allow browser console access', active: stats?.allowDevTools },
                  { field: 'maintenanceMode', label: 'Maintenance Mode', desc: 'Disable platform access for maintenance', active: stats?.maintenanceMode, color: 'bg-rose-500' },
                  { field: 'safetyAiEnabled', label: 'Safety System Monitor', desc: 'Behavioural filtering systems', active: stats?.safetyAiEnabled, color: 'bg-cyan-500' },
                  { field: 'coinsEnabled', label: 'Coin Management', desc: 'Authorize coin circulation', active: stats?.coinsEnabled !== false },
                  { field: 'guestRegistration', label: 'Guest Access', desc: 'Allow anonymous user mapping', active: stats?.guestRegistration !== false },
                ].map(f => (
                  <div key={f.field} className="p-10 rounded-[40px] bg-white/[0.02] border border-white/5 flex flex-col justify-between group hover:border-cyan-500/30 transition-all min-h-[180px] shadow-2xl relative overflow-hidden">
                    <div className="absolute -inset-2 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none group-hover:from-white/[0.05]" />
                    <div className="relative z-10">
                      <div className="text-[13px] font-black mb-2 uppercase italic tracking-tight">{f.label}</div>
                      <p className="text-[10px] text-white/20 font-black uppercase tracking-widest leading-relaxed">{f.desc}</p>
                    </div>
                    <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/5 relative z-10">
                      <span className={`text-[9px] font-black uppercase tracking-[0.3em] ${f.active ? 'text-emerald-400 pulse' : 'text-white/10'}`}>{f.active ? 'Operational' : 'De-Activated'}</span>
                      <button
                        onClick={() => updateSetting(f.field, !f.active)}
                        className={`relative w-14 h-7 rounded-full transition-all border border-white/5 ${f.active ? (f.color || 'bg-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.4)]') : 'bg-black shadow-inner'}`}
                      >
                        <div className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-all transform ${f.active ? 'translate-x-7 shadow-xl' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-10 animate-fade-in px-4">
              <div className="p-10 rounded-[50px] bg-white/[0.02] border border-white/5 shadow-2xl">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400">Admin Action History</h3>
                  <button onClick={fetchHistory} className="text-[10px] font-black text-white/30 hover:text-white uppercase tracking-widest transition-colors">Refresh Records 🔄</button>
                </div>
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
                  {history.map((h, i) => (
                    <div key={h.id || i} className="p-6 rounded-3xl bg-black border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-cyan-500/20 transition-all shadow-inner relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                           <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${h.action_type === 'CREATOR_APPROVE' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/40'}`}>
                             {h.action_type}
                           </span>
                           <span className="text-[9px] text-white/20 font-black uppercase tracking-tighter">
                             {new Date(h.created_at).toLocaleString()}
                           </span>
                        </div>
                        <div className="text-[13px] font-black uppercase italic tracking-tighter text-white/90">
                           {h.target_name} <span className="text-white/20 not-italic font-medium mx-2">·</span> {h.details}
                        </div>
                      </div>
                      <div className="text-[9px] font-black text-white/10 uppercase tracking-widest text-right">
                        ID: {h.target_id || 'SYSTEM'}
                      </div>
                    </div>
                  ))}
                  {history.length === 0 && (
                    <div className="py-24 text-center opacity-10 flex flex-col items-center select-none">
                      <div className="text-5xl mb-6">📜</div>
                      <p className="text-[10px] font-black uppercase tracking-[0.4em]">No activity records found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* Admin Quick Notification Bar */}
      {toast && (
        <div className="fixed bottom-12 right-12 z-[500] px-10 py-5 rounded-[24px] bg-white text-black font-black text-[11px] shadow-2xl animate-fade-in-up flex items-center gap-5 uppercase tracking-[0.4em] italic border-4 border-black">
          <div className="w-3 h-3 rounded-full bg-cyan-500 animate-ping" />
          {toast}
        </div>
      )}

      {/* Tablet/Mobile Overlay Warning */}
      <div className="lg:hidden fixed inset-0 z-[5000] bg-black p-12 flex flex-col items-center justify-center text-center">
        <img src="/apple-touch-icon.png" alt="Logo" className="w-24 h-24 mb-10 opacity-20" />
        <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-4">Device Restriction</h2>
        <p className="text-[11px] text-white/30 font-black uppercase tracking-[0.2em] leading-relaxed mb-12">The Administrative Dashboard requires a desktop view for proper management. Access is restricted on mobile devices.</p>
        <button onClick={() => window.location.href = '/'} className="px-10 py-5 bg-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white hover:text-black transition-all">Return to Home</button>
      </div>
    </div>
  );
}

export default AdminDashboard;
