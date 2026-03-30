import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useLatency } from '../hooks/useLatency';
import { CoinBadge } from './CoinBadge';

const INTERESTS = [
  { id: 'telugu', label: 'Telugu', desc: 'Sync with Telugu peers' },
  { id: 'music', label: 'Music', desc: 'Auditory frequency sync' },
  { id: 'gaming', label: 'Gaming', desc: 'Tactical squad discovery' },
  { id: 'movies', label: 'Movies', desc: 'Cinematic data stream' },
  { id: 'sports', label: 'Sports', desc: 'Kinetic event tracking' },
  { id: 'chat', label: 'General', desc: 'Stochastic matching' },
];

const MODALS = {
  privacy: {
    title: '🛡️ Core Protocol: Privacy',
    body: `Zero-Trace Encryption: \n\n• Zero PII Collection — No names, no email, no logs.\n• Volatile Memory — Sessions purge instantly on exit.\n• IP Cloaking — Transient rate-limiting protection only.\n• P2P Encryption — Direct peer-to-peer WebRTC streams.\n• No Cookies — Zero tracking, zero third-party profiling.\n• Metadata Shield — All session tags are randomized.`,
  },
  guidelines: {
    title: '🤝 Safe Space: Integrity',
    body: `Community Quality Standards: \n\n✅ Vibe Check: \n• Treat everyone with radical respect\n• Report disruptive entities\n• Be genuine and authentic\n• Skip quickly if incompatible\n\n❌ Hard Restrictions: \n• Explicit materials or illegal imagery\n• Personal identification requests\n• Harassment or systemic bullying\n• Hate speech or slur-based metrics\n\nViolations trigger permanent de-authorization.`,
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
  const startRef = useRef(null);

  const getInterest = () => {
    if (interests.length === 0) return 'general';
    return interests.map(i => i.label || i.id || i).join(', ');
  };

  const addInterest = (interestArg) => {
    if (!interestArg) return;
    const isPredefined = INTERESTS.find(i => i.id === interestArg?.id || i.id === interestArg);
    const newInterest = isPredefined ? isPredefined : { id: interestArg.toLowerCase(), label: interestArg };

    if (!interests.find(i => i.id === newInterest.id)) {
      setInterests([...interests, newInterest]);
    }
  };

  const removeInterest = (id) => {
    setInterests(interests.filter(i => i.id !== id));
  };

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
    } catch (e) { } finally {
      setIsSuggesting(false);
    }
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
      onJoin(getInterest(), 'Anonymous', mode);
      setScanning(false);
    }, 1200);
  };

  const scrollToStart = () => startRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="min-h-screen bg-[#020205] text-white relative font-sans selection:bg-cyan-500/30 selection:text-cyan-200 overflow-x-hidden">
      
      {/* VIBRANT NEON BACKGROUND */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-60">
        <img 
          src="/luminous_neon_abstract_background_1774874445375.png" 
          alt="Luminous Grid" 
          className="w-full h-full object-cover animate-pulse-slow filter contrast-125 brightness-75 blur-[1px]" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020205] via-transparent to-[#020205]/40" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.1),transparent_70%)]" />
      </div>

      {/* SCANNING LINK OVERLAY */}
      {scanning && (
        <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-black/80 backdrop-blur-3xl transition-all">
           <div className="relative w-80 h-80 flex items-center justify-center">
              <div className="absolute inset-0 border-t border-cyan-400 rounded-full animate-spin-slow opacity-20" />
              <div className="absolute inset-4 border-b border-indigo-400 rounded-full animate-spin-slower opacity-20" />
              <div className="flex flex-col items-center gap-4">
                 <div className="w-16 h-16 bg-cyan-500 rounded-2xl animate-pulse shadow-[0_0_50px_#06b6d4]" />
                 <span className="text-xs font-black uppercase tracking-[0.5em] text-cyan-400 animate-pulse">Establishing Uplink</span>
              </div>
           </div>
           <div className="absolute bottom-1/3 h-px w-screen bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent shadow-[0_0_40px_rgba(6,182,212,0.8)] animate-scan-line" />
        </div>
      )}

      {/* STICKY GLASS HEADER */}
      <header className="fixed top-0 left-0 right-0 z-[150] h-20 px-8 flex items-center justify-between bg-black/40 backdrop-blur-2xl border-b border-white/[0.05]">
        <div className="flex items-center gap-4">
           <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-indigo-600 rounded-2xl flex items-center justify-center font-black text-xl italic shadow-[0_0_30px_rgba(6,182,212,0.4)]">M</div>
           <div>
              <h1 className="text-sm font-black uppercase tracking-[0.3em]">Mana Mingle <span className="text-cyan-400">Hub</span></h1>
              <div className="flex items-center gap-1.5 mt-1">
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
                 <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{onlineCount.toLocaleString()} PEERS ONLINE</span>
              </div>
           </div>
        </div>

        <div className="flex items-center gap-4">
          {connected && balance !== undefined && (
            <CoinBadge balance={balance} streak={streak} canClaim={canClaim} nextClaim={nextClaim ?? 0} claimCoins={claimCoins} />
          )}
          <button 
            onClick={() => setModal('privacy')}
            className="hidden sm:flex text-[10px] font-black uppercase tracking-widest text-white/50 hover:text-cyan-400 transition-colors"
          >
            Protocol v2.4
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <main className="relative z-10 pt-40 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center">
        
        <div className="text-center mb-16 space-y-6">
           <div className="inline-flex px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase tracking-[0.4em] animate-fade-in">Dynamic Social Matrix</div>
           <h2 className="text-5xl md:text-8xl font-black tracking-tighter leading-[0.9] m-0 animate-in-zoom">
              Connect to the <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-indigo-400 to-cyan-400 bg-300% animate-gradient italic px-2">Global Stream.</span>
           </h2>
           <p className="text-base md:text-lg text-white/30 max-w-2xl mx-auto font-bold leading-relaxed uppercase tracking-wider">
              No accounts. No logs. No trace. High-frequency anonymous synchronization powered by world-class WebRTC.
           </p>
        </div>

        {/* NEON BORDER MODES */}
        <section ref={startRef} className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-24">
           {[
             { id: 'video', icon: '📹', title: 'Video Sync', sub: 'High-bandwidth visual P2P', color: 'from-cyan-400' },
             { id: 'text', icon: '💬', title: 'Data Feed', sub: 'Instant encrypted messaging', color: 'from-indigo-500' },
             { id: 'group_video', icon: '🎥', title: 'Mesh Room', sub: 'Shared multi-node visual', color: 'from-purple-500' },
             { id: 'group_text', icon: '👥', title: 'Cluster Hub', sub: 'Collaborative text array', color: 'from-emerald-500' },
           ].map((m, i) => (
             <button
               key={m.id}
               onClick={() => handleStartInteraction(m.id)}
               disabled={!connected || isJoining}
               className="group relative h-[420px] rounded-[32px] p-2 bg-white/[0.02] border border-white/5 hover:border-white/20 transition-all duration-700 animate-in-zoom animate-glow-pulse"
               style={{ animationDelay: `${i * 150}ms` }}
             >
                {/* UNIQUE GRADIENT BORDER EFFECT */}
                <div className={`absolute -inset-[1px] rounded-[33px] bg-gradient-to-br ${m.color} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none blur-[2px]`} />
                <div className="absolute inset-0 bg-black rounded-[30px] z-0 group-hover:bg-[#050505] transition-colors" />
                
                {/* CARD CONTENT */}
                <div className="relative z-10 h-full p-10 flex flex-col justify-between items-start text-left">
                   <div className="space-y-6">
                      <div className={`w-16 h-16 rounded-[20px] bg-gradient-to-br ${m.color} to-transparent opacity-20 absolute -top-4 -right-4 blur-xl group-hover:opacity-40 transition-opacity`} />
                      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl group-hover:scale-110 group-hover:rotate-12 transition-all">
                        {m.icon}
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-white group-hover:text-cyan-400 transition-colors uppercase tracking-tight italic">{m.title}</h3>
                        <p className="text-sm text-white/20 mt-2 font-bold leading-relaxed">{m.sub}</p>
                      </div>
                   </div>
                   
                   <div className="w-full space-y-4">
                      <div className="flex flex-wrap gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                         <span className="text-[9px] font-black uppercase border border-white/10 px-2 py-0.5 rounded">E2EE</span>
                         <span className="text-[9px] font-black uppercase border border-white/10 px-2 py-0.5 rounded">P2P</span>
                         <span className="text-[9px] font-black uppercase border border-white/10 px-2 py-0.5 rounded">LOW-MS</span>
                      </div>
                      <div className="flex items-center justify-between text-cyan-400/40 group-hover:text-cyan-400 transition-colors">
                         <span className="text-[11px] font-black uppercase tracking-[0.2em]">Authorize Uplink</span>
                         <svg className="w-5 h-5 group-hover:translate-x-2 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                      </div>
                   </div>
                </div>
             </button>
           ))}
        </section>

        {/* NEW SECTION: GLOBAL MATRIX STATS */}
        <section className="w-full max-w-7xl mx-auto py-20 px-4">
           <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                 <div className="inline-block px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-widest">Network Metrics</div>
                 <h2 className="text-4xl md:text-6xl font-black text-white italic tracking-tighter leading-none">Global Hub <br /><span className="text-indigo-500">Live Traffic.</span></h2>
                 <p className="text-white/30 text-lg leading-relaxed font-bold italic">Our matrix spans across 180+ countries. 24/7 high-bandwidth synchronization for every identity node.</p>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 rounded-3xl bg-white/5 border border-white/5 flex flex-col items-center text-center group hover:bg-cyan-500/5 transition-colors">
                       <span className="text-4xl font-black text-cyan-400 group-hover:scale-110 transition-transform">99%</span>
                       <span className="text-[10px] font-black uppercase tracking-widest text-white/30 mt-2">Uptime Core</span>
                    </div>
                    <div className="p-6 rounded-3xl bg-white/5 border border-white/5 flex flex-col items-center text-center group hover:bg-indigo-500/5 transition-colors">
                       <span className="text-4xl font-black text-indigo-400 group-hover:scale-110 transition-transform">4MS</span>
                       <span className="text-[10px] font-black uppercase tracking-widest text-white/30 mt-2">Avg Latency</span>
                    </div>
                 </div>
              </div>
              <div className="relative p-1 rounded-[40px] bg-gradient-to-br from-white/10 to-transparent border border-white/10">
                 <div className="bg-[#050505] rounded-[39px] p-10 h-[400px] flex flex-col justify-center items-center relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at center, #06b6d4 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                    <div className="text-8xl mb-6 grayscale opacity-20 filter">🌍</div>
                    <div className="space-y-4 w-full">
                       {['US HUB: PEAK', 'IN HUB: ACTIVE', 'EU NODE: OPTIMAL'].map(hub => (
                         <div key={hub} className="flex justify-between items-center px-6 py-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors">
                            <span className="text-xs font-black uppercase tracking-widest text-white/50">{hub}</span>
                            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                         </div>
                       ))}
                    </div>
                 </div>
              </div>
           </div>
        </section>

        {/* INTEREST DOCK: NEON REFRESH */}
        <section className="w-full max-w-5xl mx-auto py-20 px-4">
           <div className="relative p-8 md:p-16 rounded-[60px] bg-[#050505] border border-white/10 overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10 flex flex-col items-center text-center">
                 <h4 className="text-xs font-black uppercase tracking-[0.5em] text-cyan-400 mb-4">Neural Filters</h4>
                 <h5 className="text-4xl md:text-6xl font-black text-white italic mb-12">Target Your Vibe.</h5>
                 
                 <div className="flex flex-wrap justify-center gap-3 mb-16">
                    {INTERESTS.filter(r => !interests.find(i => i.id === r.id)).map((r) => (
                      <button
                        key={r.id}
                        onClick={() => addInterest(r.id)}
                        className="px-8 py-3.5 rounded-full bg-white/5 border border-white/10 hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:shadow-[0_0_20px_#06b6d420] transition-all text-xs font-black uppercase tracking-widest text-white/40 hover:text-cyan-400"
                      >
                        #{r.label}
                      </button>
                    ))}
                 </div>

                 <div className="relative w-full max-w-2xl group">
                    <div className="absolute inset-y-0 left-0 pl-10 flex items-center pointer-events-none text-cyan-400/40">
                       <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <input 
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      placeholder="Input discovery topic..."
                      className="w-full h-24 bg-white/5 border border-white/10 focus:border-cyan-500/60 rounded-[32px] pl-24 pr-10 text-2xl text-white outline-none transition-all placeholder:text-white/5 font-black uppercase italic shadow-2xl"
                    />
                    <button 
                      onClick={getAiSuggestions}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-4 bg-cyan-500 rounded-2xl text-black hover:bg-white transition-all shadow-[0_0_30px_#06b6d4]"
                    >
                      <svg className={`w-6 h-6 ${isSuggesting ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </button>
                 </div>

                 {interests.length > 0 && (
                   <div className="flex flex-wrap justify-center gap-3 mt-10">
                      {interests.map(i => (
                        <div key={i.id} className="group flex items-center gap-4 bg-white text-black px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-cyan-400 transition-all cursor-default">
                           {i.label}
                           <button onClick={() => removeInterest(i.id)} className="opacity-30 hover:opacity-100 transition-opacity">✕</button>
                        </div>
                      ))}
                   </div>
                 )}
              </div>
           </div>
        </section>

      </main>

      {/* FOOTER: NEON DARK */}
      <footer className="relative z-10 pt-40 pb-20 px-8 bg-black">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-20">
           <div className="max-w-sm space-y-8">
              <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center font-black italic text-2xl mb-6">M</div>
              <p className="text-white/20 text-xs font-black leading-relaxed uppercase tracking-[0.2em]">
                 The ultimate high-frequency anonymous discovery protocol. 
                 Optimized for zero-trace synchronization.
              </p>
              <div className="flex items-center gap-4">
                 <div className="text-[9px] font-black uppercase tracking-widest text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-xl">Node: Secure</div>
                 <div className="text-[9px] font-black uppercase tracking-widest text-cyan-400 border border-cyan-500/20 px-3 py-1.5 rounded-xl">Link: 100% P2P</div>
              </div>
           </div>

           <div className="grid grid-cols-2 lg:grid-cols-3 gap-12 flex-1">
              <div className="space-y-6">
                 <h5 className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400">Security Layer</h5>
                 <div className="flex flex-col gap-3">
                    {['Privacy', 'Integrity', 'Terms'].map(m => (
                      <button key={m} onClick={() => setModal(m.toLowerCase())} className="text-xs text-left text-white/30 hover:text-white transition-colors font-black uppercase tracking-widest">{m}</button>
                    ))}
                 </div>
              </div>
              <div className="space-y-6">
                 <h5 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">System Parameters</h5>
                 <div className="space-y-3">
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/10">Protocol: E2EE Direct</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/10">Latency: Low-Orbit Sync</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/10">Storage: Zero-Logs Gated</div>
                 </div>
              </div>
              <div className="space-y-6 col-span-2 lg:col-span-1">
                 <h5 className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400">Global Uplink</h5>
                 <p className="text-[10px] text-white/20 font-black leading-relaxed uppercase tracking-widest">Connecting terminals globally with automatic load-balancing. Secure email hub: manaminglee@gmail.com</p>
                 <a href="mailto:manaminglee@gmail.com" className="inline-block text-[10px] font-black text-cyan-400 underline uppercase tracking-widest hover:text-white">Email Terminal</a>
              </div>
           </div>
        </div>
        <div className="max-w-7xl mx-auto pt-20 mt-20 border-t border-white/[0.03] flex justify-between items-center text-white/5 text-[9px] font-black uppercase tracking-[0.6em]">
           <span>© 2026 MANA MINGLE</span>
           <span className="hidden sm:inline">HIGH-SPEED ANONYMOUS INNOVATION</span>
        </div>
      </footer>

      {/* MODAL */}
      {modal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/90 backdrop-blur-3xl animate-in-zoom" onClick={() => setModal(null)}>
           <div className="relative w-full max-w-xl bg-black border border-white/10 rounded-[50px] p-12 shadow-[0_0_100px_rgba(6,182,212,0.1)] overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="space-y-2 mb-10">
                 <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter">{MODALS[modal]?.title}</h3>
                 <div className="h-1 w-24 bg-cyan-500 rounded-full" />
              </div>
              <pre className="text-sm whitespace-pre-wrap font-sans text-white/40 leading-relaxed font-bold uppercase tracking-tight">
                 {MODALS[modal]?.body}
              </pre>
              <button 
                onClick={() => setModal(null)}
                className="mt-12 w-full h-16 bg-cyan-500 text-black font-black uppercase tracking-widest text-xs rounded-3xl hover:bg-white transition-all shadow-[0_0_30px_#06b6d430]"
              >
                 Authorize Protocol_Clear
              </button>
           </div>
        </div>
      )}
    </div>
  );
}
