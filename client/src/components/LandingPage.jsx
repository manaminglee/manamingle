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
  },
  safety: {
    title: '🏛️ Security Infrastructure',
    body: `Our core defenses: \n\n• 24/7 AI-driven content analysis.\n• Secure P2P communication tunnel.\n• Zero-retention session storage.\n• Rate-limiting against spambots.\n• Administrator oversight with visual monitoring.`,
  },
  dev: {
    title: '💻 Developer Uplink',
    body: `Open Source & Secure: \n\n• Built on WebRTC / Socket.io.\n• Native React / Node.js stack.\n• Scalable cluster methodology.\n• Secure API endpoints with HMAC protection.\n• Performance-first architecture.`,
  },
  bug: {
    title: '🛠️ Bug Bounty Program',
    body: `Identify vulnerabilities: \n\n• We reward critical bug reports.\n• Direct contact: manaminglee@gmail.com.\n• Rapid patching within 24-48 hours.\n• Help build a safer social matrix.`,
  }
};

const INSIGHTS = [
  "Trending now: Retro music syncing in EU clusters.",
  "New Matrix: Casual tech debates active in the US node.",
  "AI Analysis: Peer synchronization speed is at its peak.",
  "System Pulse: 2,400+ anonymous links verified in the last hour.",
  "User Feedback: Telugu-based video feeds are trending today."
];

// Reusable Ad Placeholder component
const AdSection = ({ position, script }) => {
  if (!script) return (
    <div className="w-full bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-center my-6">
      <span className="text-[10px] font-black uppercase tracking-widest text-white/10 italic">Sponsor Uplink Overlay [{position}]</span>
    </div>
  );
  return (
    <div className="w-full my-6 text-center overflow-hidden rounded-2xl" dangerouslySetInnerHTML={{ __html: script }} />
  );
};

export function LandingPage({ onJoin, connected, onlineCount = 0, coinState, isJoining = false }) {
  const { balance, streak, canClaim, nextClaim, claimCoins, adsEnabled, adScripts } = coinState || {};
  const [interests, setInterests] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const latency = useLatency();
  const [modal, setModal] = useState(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [trafficStats, setTrafficStats] = useState({ us: 450, in: 1200, eu: 320 });
  const [insightIndex, setInsightIndex] = useState(0);
  const startRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setInsightIndex(prev => (prev + 1) % INSIGHTS.length);
    }, 4000);
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
        setSuggestedInterests(data.suggestions || []);
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
              <span className="absolute bottom-10 text-[10px] font-black uppercase tracking-widest text-cyan-400 animate-pulse">Establishing Uplink...</span>
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
          <div className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-black text-white/40 uppercase tracking-widest">{(onlineCount?.count || onlineCount || 0).toLocaleString()} Live</div>
        </div>
      </header>

      {/* HERO SECTION */}
      <main className="relative z-10 pt-32 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center">
        
        {adsEnabled && <AdSection position="hero" script={adScripts?.hero} />}

        <div className="text-center mb-12 space-y-4">
           <h2 className="text-4xl md:text-7xl font-black tracking-tighter leading-none italic m-0 animate-in-zoom">
              Connect <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500">Instantly.</span>
           </h2>
           <p className="text-[11px] text-white/30 max-w-lg mx-auto font-bold uppercase tracking-widest leading-relaxed">
              Zero registration. Private P2P. Secure Global Hub.
           </p>
        </div>

        {/* INTEREST DOCK */}
        <section className="w-full max-w-4xl mx-auto mb-12">
           <div className="p-8 rounded-[40px] bg-white/[0.02] border border-white/5 flex flex-col items-center text-center">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400 mb-6">Target Passion Matrix</span>
              
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
                   placeholder="Refine discovery topic..."
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

        {/* COMPACT MODES */}
        <section className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
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

        {/* AI INSIGHT SECTION */}
        <section className="w-full max-w-4xl mx-auto mb-16 animate-fade-in-up">
           <div className="bg-gradient-to-r from-indigo-500/5 via-cyan-500/5 to-indigo-500/5 p-6 rounded-3xl border border-white/5 flex items-center gap-6">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-xl shadow-[0_0_20px_#06b6d430]">🤖</div>
              <div className="flex-1">
                 <div className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-1">AI System Insight</div>
                 <p className="text-sm font-bold text-white/60 italic transition-all duration-500">{INSIGHTS[insightIndex]}</p>
              </div>
              <div className="px-3 py-1 rounded-full border border-white/10 text-[9px] font-black uppercase text-white/20">Real-time Analysis</div>
           </div>
        </section>

        {adsEnabled && <AdSection position="sidebar" script={adScripts?.sidebar} />}

        {/* GLOBAL STATS WITH HOLOGRAPHIC GLOBE */}
        <section className="w-full py-16">
           <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="flex flex-col items-center justify-center pointer-events-none relative">
                 <div className="absolute inset-0 bg-cyan-500/10 rounded-full blur-[100px]" />
                 {/* HOLOGRAPHIC GLOBE SVG */}
                 <div className="relative w-64 h-64 md:w-80 md:h-80">
                    <svg viewBox="0 0 100 100" className="w-full h-full animate-spin-slower opacity-40">
                       <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" className="text-cyan-400" />
                       <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" className="text-cyan-500/30" />
                       <path d="M50 2 A48 48 0 0 1 50 98" fill="none" stroke="currentColor" strokeWidth="0.2" className="text-cyan-400" />
                       <path d="M2 50 A48 48 0 0 1 98 50" fill="none" stroke="currentColor" strokeWidth="0.2" className="text-cyan-400" />
                       <ellipse cx="50" cy="50" rx="48" ry="15" fill="none" stroke="currentColor" strokeWidth="0.2" className="text-cyan-400" />
                       <ellipse cx="50" cy="50" rx="15" ry="48" fill="none" stroke="currentColor" strokeWidth="0.2" className="text-cyan-400" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                       <div className="text-6xl animate-pulse">🌏</div>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {[
                  { label: 'India Terminal', val: onlineCount?.regions?.in || 0, col: 'text-cyan-400' },
                  { label: 'USA Node', val: onlineCount?.regions?.us || 0, col: 'text-indigo-400' },
                  { label: 'Europe Relay', val: onlineCount?.regions?.eu || 0, col: 'text-purple-400' },
                ].map(s => (
                  <div key={s.label} className="p-8 rounded-[32px] bg-white/[0.02] border border-white/5 flex items-center justify-between group hover:bg-white/[0.04] transition-all">
                     <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-1">{s.label}</span>
                        <h4 className="text-lg font-black text-white italic">Node Connectivity</h4>
                     </div>
                     <div className="text-right">
                        <span className={`text-3xl font-black ${s.col} tabular-nums animate-pulse`}>{s.val}</span>
                        <div className="flex gap-1 justify-end mt-1">
                           <div className="w-1 h-1 rounded-full bg-cyan-500 animate-bounce" />
                           <div className="w-1 h-1 rounded-full bg-cyan-500 animate-bounce delay-100" />
                        </div>
                     </div>
                  </div>
                ))}
              </div>
           </div>
        </section>

        {adsEnabled && <AdSection position="footer" script={adScripts?.footer} />}
      </main>

      {/* FOOTER */}
      <footer className="relative z-10 py-20 px-8 bg-black border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-16">
           <div className="max-w-xs space-y-6">
              <img src="/apple-touch-icon.png" alt="Logo" className="w-12 h-12 border border-white/10 p-1 rounded-xl drop-shadow-[0_0_10px_#06b6d4]" />
              <p className="text-[10px] font-black uppercase tracking-widest text-white/20 leading-relaxed">
                 The definitive high-frequency discovery protocol. 
                 Optimized for zero-trace synchronization across the global matrix.
              </p>
           </div>
           
           <div className="grid grid-cols-2 md:grid-cols-3 gap-10 flex-1">
              <div className="space-y-4">
                 <h5 className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400">Legal Matrix</h5>
                 <div className="flex flex-col gap-2">
                    {['Privacy', 'Integrity', 'Safety'].map(m => (
                      <button key={m} onClick={() => setModal(m.toLowerCase())} className="text-[10px] font-bold text-left uppercase text-white/30 hover:text-cyan-400 transition-colors">{m} Center</button>
                    ))}
                 </div>
              </div>
              <div className="space-y-4">
                 <h5 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">System Uplink</h5>
                 <div className="flex flex-col gap-2">
                    {['Dev', 'Bug'].map(m => (
                      <button key={m} onClick={() => setModal(m.toLowerCase())} className="text-[10px] font-bold text-left uppercase text-white/30 hover:text-indigo-400 transition-colors">{m === 'Dev' ? 'Developer' : 'Bug Bounty'} Hub</button>
                    ))}
                    <button onClick={() => setModal('safety')} className="text-[10px] font-bold text-left uppercase text-white/30 hover:text-indigo-400 transition-colors">Infrastructure</button>
                 </div>
              </div>
              <div className="space-y-4 col-span-2 md:col-span-1">
                 <h5 className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400">Support Terminal</h5>
                 <p className="text-[10px] font-bold text-white/20 leading-relaxed uppercase tracking-widest">Global load balancing active. Secure correspondence hub.</p>
                 <a href="mailto:manaminglee@gmail.com" className="text-[10px] font-black text-cyan-400 underline uppercase hover:text-white">Email Console</a>
              </div>
           </div>
        </div>
        <div className="max-w-7xl mx-auto pt-20 mt-20 border-t border-white/[0.03] flex justify-between items-center text-white/5 text-[9px] font-black uppercase tracking-[0.6em]">
           <span>© 2026 MANA MINGLE MATRIX</span>
           <span className="hidden sm:inline">P2P ENCRYPTED SOCIAL NETWORK</span>
        </div>
      </footer>

      {/* MODAL */}
      {modal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/90 backdrop-blur-3xl animate-in-zoom" onClick={() => setModal(null)}>
           <div className="relative w-full max-w-sm bg-black border border-white/10 rounded-[40px] p-10 text-center" onClick={e => e.stopPropagation()}>
              <h3 className="text-2xl font-black text-white italic uppercase mb-6 tracking-tighter">{MODALS[modal]?.title}</h3>
              <p className="text-[11px] text-white/40 leading-relaxed font-bold uppercase tracking-widest">{MODALS[modal]?.body}</p>
              <button onClick={() => setModal(null)} className="mt-10 w-full h-14 bg-cyan-500 text-black font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-white transition-all shadow-xl shadow-cyan-500/20">Authorize Terminal_Access</button>
           </div>
        </div>
      )}
    </div>
  );
}
