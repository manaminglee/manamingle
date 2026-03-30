import React, { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [key, setKey] = useState('');
  const [isLogged, setIsLogged] = useState(false);
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchCreators = async (k) => {
    setLoading(true);
    try {
      const apiBase = import.meta.env.VITE_SOCKET_URL || '';
      const res = await fetch(`${apiBase}/api/admin/creators?key=${k || key}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCreators(data.data || []);
      setIsLogged(true);
      window.localStorage.setItem('mm_admin_key', k || key);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = window.localStorage.getItem('mm_admin_key');
    if (saved) {
      setKey(saved);
      fetchCreators(saved);
    }
  }, []);

  const handleApprove = async (id, status) => {
    try {
      const apiBase = import.meta.env.VITE_SOCKET_URL || '';
      await fetch(`${apiBase}/api/admin/creators/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, creatorId: id, status })
      });
      fetchCreators();
    } catch (err) {
      alert('Action failed');
    }
  };

  if (!isLogged) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-[#0d0d0d] border border-white/10 rounded-[32px] p-8 shadow-2xl">
          <h1 className="text-xl font-black uppercase tracking-[0.3em] text-white mb-8 text-center">Matrix Control</h1>
          <input 
            type="password" 
            placeholder="Neural Passkey" 
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white text-sm outline-none mb-4"
          />
          <button 
            onClick={() => fetchCreators()}
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase tracking-widest text-xs hover:bg-indigo-500 transition-all"
          >
            {loading ? 'Decrypting...' : 'Initialize Uplink'}
          </button>
          {error && <p className="mt-4 text-rose-500 text-[10px] text-center font-bold uppercase">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-[0.3em] text-white">Creator Appraisal</h1>
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.4em] mt-2 italic shadow-[0_0_10px_rgba(34,211,238,0.2)]">Neural Governance Active</p>
          </div>
          <button onClick={() => { window.localStorage.removeItem('mm_admin_key'); setIsLogged(false); }} className="px-6 py-2 rounded-xl bg-white/5 border border-white/10 text-white/40 text-[10px] font-black uppercase tracking-widest hover:text-white">Relinquish Access</button>
        </header>

        <div className="grid gap-4">
          {creators.map(c => (
            <div key={c.id} className="bg-[#0d0d0d] border border-white/5 rounded-3xl p-6 flex flex-col sm:flex-row gap-6 items-center justify-between group hover:border-white/20 transition-all">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-xl">👤</div>
                <div>
                   <h2 className="text-white font-black uppercase tracking-widest text-sm">{c.handle_name}</h2>
                   <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1">{c.platform} • <a href={c.profile_link} target="_blank" className="text-indigo-400 hover:underline">Profile</a></p>
                   <p className="text-[9px] text-white/20 mt-1 uppercase">ID: {c.referral_code}</p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                 <div className="text-right">
                    <div className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                      c.status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                      c.status === 'pending' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                      'bg-rose-500/10 border-rose-500/20 text-rose-400'
                    }`}>
                      {c.status}
                    </div>
                    <p className="text-[9px] text-white/20 mt-2 uppercase font-bold tracking-tighter">Applied: {new Date(c.created_at).toLocaleDateString()}</p>
                 </div>

                 <div className="flex gap-2">
                   {c.status !== 'approved' && (
                     <button onClick={() => handleApprove(c.id, 'approved')} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-all">Approve</button>
                   )}
                   {c.status !== 'rejected' && (
                     <button onClick={() => handleApprove(c.id, 'rejected')} className="px-4 py-2 rounded-xl bg-rose-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-rose-500 transition-all">Reject</button>
                   )}
                 </div>
              </div>
            </div>
          ))}

          {creators.length === 0 && <div className="py-20 text-center opacity-20 filter grayscale font-black uppercase tracking-[0.5em] text-xs">No Nodes Pending Evaluation</div>}
        </div>
      </div>
    </div>
  );
}
