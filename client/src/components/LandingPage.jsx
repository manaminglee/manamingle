import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useLatency } from '../hooks/useLatency';
import { CoinBadge } from './CoinBadge';

const INTERESTS = [
  { id: 'telugu', label: 'Telugu', desc: 'Find Telugu peers' },
  { id: 'music', label: 'Music', desc: 'Sync auditory beats' },
  { id: 'gaming', label: 'Gaming', desc: 'Find your squad' },
  { id: 'movies', label: 'Movies', desc: 'Cinema data feed' },
  { id: 'sports', label: 'Sports', desc: 'Kinetic tracking' },
  { id: 'chat', label: 'General', desc: 'Random matching' },
];

const MODALS = {
  privacy: {
    title: '🛡️ Privacy Guard',
    body: `Zero-Trace Policy: \n\n• No accounts. No logs. No history.\n• Sessions are wiped instantly on exit.\n• E2EE direct peer connections.\n• 100% Anonymous metadata.`,
  },
  integrity: {
    title: '🤝 Safe Space',
    body: `Community Guidelines: \n\n• Respect all users.\n• No explicit material.\n• No bullying or harassment.\n• Instant ban for violations.`,
  }
};

export function LandingPage({ onJoin, connected, onlineCount = 0, coinState, isJoining = false }) {
  const { balance, streak, canClaim, nextClaim, claimCoins } = coinState || {};
  const [interests, setInterests] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const latency = useLatency();
  const [modal, setModal] = useState(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestedInterests, setSuggestedInterests] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [trafficStats, setTrafficStats] = useState({ us: 450, in: 1200, eu: 320 });
  const startRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setTrafficStats(s => ({
        us: s.us + Math.floor(Math.random() * 5) - 2,
        in: s.in + Math.floor(Math.random() * 5) - 2,
        eu: s.eu + Math.floor(Math.random() * 5) - 2,
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const addInterest = (interestArg) => {
    if (!interestArg) return;
    const isPredefined = INTERESTS.find(i => i.id === interestArg?.id || i.id === interestArg);
    const newInterest = isPredefined ? isPredefined : { id: interestArg.toLowerCase(), label: interestArg };
    if (!interests.find(i => i.id === newInterest.id)) setInterests([...interests, newInterest]);
  };

  const removeInterest = (id) => setInterests(interests.filter(i => i.id !== id));

  const getAiSuggestions = async () => {
    if (isSuggesting) return;
    setIsSuggesting(true);
    try {
      const apiBase = import.meta.env.VITE_SOCKET_URL || '';
      const res = await fetch(`${apiBase}/api/ai/suggest`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSuggestedInterests(data.suggestions);
      }
    } catch (e) { } finally { setIsSuggesting(false); }
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = inputValue.trim();
      if (val) {
        addInterest(val);
        setInputValue('');
      }
    }
  };

  const handleStartInteraction = (mode) => {
    setScanning(true);
    setTimeout(() => {
      onJoin(interests.length === 0 ? 'general' : interests.map(i => i.label || i).join(', '), 'Anonymous', mode);
      setScanning(false);
    }, 1000);
  };

  const scrollToStart = () => startRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="min-h-screen bg-black text-white relative font-sans selection:bg-cyan-500/30 selection:text-cyan-200 overflow-x-hidden">
      
      {/* VIBRANT BACKGROUND */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
        <img 
          src="/luminous_neon_abstract_background_1774874445375.png" 
          alt="Abstract" 
          className="w-full h-full object-cover filter contrast-125 brightness-75" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black" />
      </div>

      {/* SCANNING OVERLAY */}
      {scanning && (
        <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-black/90 backdrop-blur-3xl">
           <div className="relative w-48 h-48 flex items-center justify-center">
              <div className="absolute inset-0 border-t border-cyan-400 rounded-full animate-spin shadow-[0_0_20px_#06b6d440]" />
              <img src="/apple-touch-icon.png" alt="Logo" className="w-16 h-16 object-contain animate-pulse" />
              <span className="absolute bottom-10 text-[10px] font-black uppercase tracking-widest text-cyan-400 animate-pulse">Syncing...</span>
           </div>
        </div>
      )}

      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-[150] h-20 px-8 flex items-center justify-between bg-black/20 backdrop-blur-3xl border-b border-white/5">
        <div className="flex items-center gap-4">
           <img src="/apple-touch-icon.png" alt="Logo" className="w-10 h-10 object-contain drop-shadow-[0_0_10px_#06b6d4]" />
           <h1 className="text-sm font-black uppercase tracking-[0.4em]">Mana Mingle</h1>
        </div>
        <div className="flex items-center gap-4">
          {connected && balance !== undefined && (
            <CoinBadge balance={balance} streak={streak} canClaim={canClaim} nextClaim={nextClaim ?? 0} claimCoins={claimCoins} />
          )}
          <div className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-black text-white/40 uppercase tracking-widest">{onlineCount.toLocaleString()} Live</div>
        </div>
      </header>

      {/* HERO SECTION */}
      <main className="relative z-10 pt-32 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center">
        
        <div className="text-center mb-12 space-y-4">
           <h2 className="text-4xl md:text-7xl font-black tracking-tighter leading-none italic m-0 animate-in-zoom">
              Connect <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500">Instantly.</span>
           </h2>
           <p className="text-[11px] text-white/30 max-w-lg mx-auto font-bold uppercase tracking-widest leading-relaxed">
              No accounts. Private P2P streams. Instant matching globally.
           </p>
        </div>

        {/* INTEREST DOCK - REORDERED: NOW ABOVE STATS */}
        <section className="w-full max-w-4xl mx-auto mb-16">
           <div className="p-8 rounded-[40px] bg-white/[0.02] border border-white/5 flex flex-col items-center text-center">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400 mb-6">Target Interest</span>
              
              <div className="flex flex-wrap justify-center gap-2 mb-8">
                {INTERESTS.filter(r => !interests.find(i => i.id === r.id)).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => addInterest(r.id)}
                    className="px-5 py-2 rounded-full bg-white/5 border border-white/5 hover:border-cyan-500/40 hover:text-cyan-400 transition-all text-[10px] font-black uppercase tracking-widest"
                  >
                    #{r.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full max-w-xl">
                 <input 
                   type="text"
                   value={inputValue}
                   onChange={(e) => setInputValue(e.target.value)}
                   onKeyDown={handleInputKeyDown}
                   placeholder="Add custom topic..."
                   className="w-full h-14 bg-black border border-white/10 focus:border-cyan-500/50 rounded-2xl px-6 text-sm text-white outline-none transition-all placeholder:text-white/10 uppercase font-bold tracking-widest"
                 />
                 <button onClick={getAiSuggestions} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-cyan-500/10 text-cyan-400 rounded-lg hover:bg-cyan-500 hover:text-black transition-all">
                    <svg className={`w-4 h-4 ${isSuggesting ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                 </button>
              </div>

              {interests.length > 0 && (
                <div className="flex flex-wrap justify-center gap-2 mt-6">
                   {interests.map(i => (
                     <div key={i.id} className="flex items-center gap-2 bg-white text-black px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">
                        {i.label}
                        <button onClick={() => removeInterest(i.id)}>✕</button>
                     </div>
                   ))}
                </div>
              )}
           </div>
        </section>

        {/* MODES: SMALLER COMPACT CARDS */}
        <section className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
           {[
             { id: 'video', icon: '📹', name: 'Video Chat', color: 'from-cyan-400' },
             { id: 'text', icon: '💬', name: 'Text Chat', color: 'from-indigo-500' },
             { id: 'group_video', icon: '🎥', name: 'Group Video', color: 'from-purple-500' },
             { id: 'group_text', icon: '👥', name: 'Group Text', color: 'from-emerald-500' },
           ].map((m, i) => (
             <button
               key={m.id}
               onClick={() => handleStartInteraction(m.id)}
               disabled={!connected || isJoining}
               className="group relative h-48 rounded-3xl p-1 bg-white/[0.02] border border-white/5 hover:border-white/20 transition-all animate-in-zoom"
               style={{ animationDelay: `${i * 100}ms` }}
             >
                <div className={`absolute inset-0 bg-gradient-to-br ${m.color} to-transparent opacity-0 group-hover:opacity-10 transition-opacity rounded-3xl`} />
                <div className="relative h-full p-8 flex flex-col justify-between items-start text-left">
                   <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                      {m.icon}
                   </div>
                   <div className="space-y-1">
                      <h3 className="text-lg font-black text-white group-hover:text-cyan-400 transition-colors uppercase italic">{m.name}</h3>
                      <span className="text-[9px] font-black uppercase tracking-widest text-white/20 group-hover:text-white/40">Launch Uplink →</span>
                   </div>
                </div>
             </button>
           ))}
        </section>

        {/* GLOBAL STATS: MORE ANIMATED & COMPACT */}
        <section className="w-full max-w-5xl mx-auto py-10">
           <div className="grid md:grid-cols-3 gap-6">
              {[
                { label: 'India Terminal', val: trafficStats.in, col: 'text-cyan-400' },
                { label: 'USA Node', val: trafficStats.us, col: 'text-indigo-400' },
                { label: 'Europe Relay', val: trafficStats.eu, col: 'text-purple-400' },
              ].map(s => (
                <div key={s.label} className="p-8 rounded-[32px] bg-white/[0.02] border border-white/5 flex flex-col items-center text-center group hover:bg-white/[0.04] transition-all">
                   <span className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-3">{s.label}</span>
                   <span className={`text-3xl font-black ${s.col} tabular-nums animate-pulse`}>{s.val}</span>
                   <div className="flex gap-1 mt-3">
                      <div className="w-1 h-1 rounded-full bg-cyan-500 animate-bounce" />
                      <div className="w-1 h-1 rounded-full bg-cyan-500 animate-bounce delay-100" />
                      <div className="w-1 h-1 rounded-full bg-cyan-500 animate-bounce delay-200" />
                   </div>
                </div>
              ))}
           </div>
        </section>

      </main>

      {/* FOOTER: CLEANED & MINIMAL */}
      <footer className="relative z-10 py-16 px-8 bg-black border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
           <div className="flex flex-col items-center md:items-start gap-4">
              <img src="/apple-touch-icon.png" alt="Logo" className="w-12 h-12 border border-white/10 p-1 rounded-xl drop-shadow-[0_0_10px_#06b6d4]" />
              <p className="text-[9px] font-black uppercase tracking-widest text-white/20">© 2026 Mana Mingle Matrix</p>
           </div>
           
           <div className="flex gap-8">
              {['Privacy', 'Integrity'].map(m => (
                <button key={m} onClick={() => setModal(m.toLowerCase())} className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 hover:text-cyan-400 transition-colors">Protocol: {m}</button>
              ))}
           </div>

           <div className="text-[9px] font-black uppercase tracking-widest text-cyan-400/50">High-Frequency Anonymous Innovation</div>
        </div>
      </footer>

      {/* MODAL */}
      {modal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/90 backdrop-blur-3xl animate-in-zoom" onClick={() => setModal(null)}>
           <div className="relative w-full max-w-sm bg-black border border-white/10 rounded-[40px] p-10 text-center" onClick={e => e.stopPropagation()}>
              <h3 className="text-2xl font-black text-white italic uppercase mb-6 tracking-tighter">{MODALS[modal]?.title}</h3>
              <p className="text-xs text-white/30 leading-relaxed font-bold uppercase tracking-widest">{MODALS[modal]?.body}</p>
              <button onClick={() => setModal(null)} className="mt-10 w-full h-14 bg-cyan-500 text-black font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-white transition-all">Understood Node_Verify</button>
           </div>
        </div>
      )}
    </div>
  );
}
