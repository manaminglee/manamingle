import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useLatency } from '../hooks/useLatency';
import { CoinBadge } from './CoinBadge';

const INTERESTS = [
  { id: 'telugu', label: 'Telugu', desc: 'Direct uplink to Telugu speakers' },
  { id: 'music', label: 'Music', desc: 'Sync auditory data streams' },
  { id: 'gaming', label: 'Gaming', desc: 'Join the combat matrix' },
  { id: 'movies', label: 'Movies', desc: 'Access cinematic feeds' },
  { id: 'sports', label: 'Sports', desc: 'Track kinetic events' },
  { id: 'chat', label: 'Random', desc: 'Stochastic AI matching' },
];

const MODALS = {
  privacy: {
    title: '🛡️ AI Protocol: Privacy',
    body: `Encryption Layer: Zero-Trace Architecture.\n\n• Zero data collection — no identifying metrics ever stored.\n• Ephemeral sessions — all temporary data purged on disconnect.\n• IP Anonymization — automated rate-limiting only.\n• E2EE WebRTC — secure direct tunnel between nodes.\n• Volatile Memory only — no resident storage footprint.\n• Tracker-Free — no profiling or behavioral analysis.`,
  },
  terms: {
    title: '📜 AI Protocol: Access',
    body: `System Directives: \n\n• Minimum age requirement: 18 years.\n• Harassment is a terminal violation.\n• Illegal content triggers immediate system lockout.\n• Repeated infractions = Matrix-Level ban.\n• Use at own discretion — experimental AI interface.\n• Do not attempt to deanonymize other participants.\n• Automated tools and scripts are prohibited.`,
  },
  guidelines: {
    title: '🤝 System: Integrity',
    body: `The Network Directive: \n\n✅ Authorize: \n• Respectful node interaction\n• Reporting disruptive entities\n• Genuine human identity\n• Rapid 'Next' selection if incompatible\n\n❌ Restrict: \n• Explicit visual data or illegal content\n• Querying for private identity tokens\n• Malicious algorithmic patterns\n• Hate speech or slur-based metrics\n\nViolations lead to permanent de-authorization.`,
  },
  monitoring: {
    title: '👁️ Core: Safety Scanner',
    body: `Automated Surveillance: \n\n• 24/7 AI System monitoring.\n• Real-time digital analysis for safety breaches.\n• Immediate threat neutralization (Flag & Ban).\n• Rapid administrator intervention (Under 3 min response).\n• Law enforcement hand-off for valid legal overrides.\n• Analysis data is purged post-session.`,
  },
  safety: {
    title: '⚡ Cyber Defense: Protocols',
    body: `Embedded safeguards: \n\n• Global 'ABORT' button for instant disconnect.\n• Instant Skip — break links with zero trace.\n• AI vision barrier — dynamic content blocking.\n• Rate-Limit gating — spambot mitigation.\n• 100% Anonymous metadata — identity shielded.\n• Precise location data is never captured.\n• Full-Spectrum TLS + WSS encryption.`,
  },
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
    }, 1500);
  };

  const scrollToStart = () => startRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="min-h-screen bg-black text-white relative font-sans selection:bg-cyan-500/30 selection:text-cyan-200 overflow-x-hidden">
      
      {/* AI TECH NETWORK BACKGROUND */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
        <img 
          src="/futuristic_ai_nexus_background_1774873330167.png" 
          alt="AI Grid" 
          className="w-full h-full object-cover animate-pulse-slow filter brightness-75 contrast-125" 
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.15),transparent_70%)]" />
      </div>

      {/* SCANNING OVERLAY */}
      {scanning && (
        <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-black/60 backdrop-blur-md pointer-events-none transition-all duration-500">
           <div className="relative w-64 h-64 border-2 border-cyan-500/20 rounded-full animate-spin-slow">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-cyan-400 rounded-full shadow-[0_0_20px_#06b6d4]" />
           </div>
           <div className="absolute flex flex-col items-center gap-2">
              <span className="text-cyan-400 font-extrabold tracking-[0.4em] uppercase text-sm animate-pulse">Initializing AI Uplink</span>
              <span className="text-white/20 text-[10px] font-bold uppercase tracking-[0.2em]">Synchronizing Data Streams...</span>
           </div>
           <div className="absolute bottom-1/4 h-px w-screen bg-cyan-500/20 border-b border-cyan-400/40 shadow-[0_0_40px_rgba(6,182,212,0.5)] animate-scan-line" />
        </div>
      )}

      {/* DYNAMIC HEADER */}
      <header className="fixed top-0 left-0 right-0 z-[150] h-16 px-6 flex items-center justify-between bg-black/20 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="relative w-10 h-10 group">
             <div className="absolute inset-0 bg-cyan-500/20 rounded-xl blur-lg group-hover:bg-cyan-500/40 transition-all" />
             <div className="relative w-full h-full bg-black/40 border border-cyan-500/40 rounded-xl flex items-center justify-center font-black text-cyan-400 text-lg shadow-inner">A</div>
          </div>
          <div className="hidden sm:block">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">Mana Mingle <span className="text-cyan-500/50">Core</span></h2>
            <div className="flex items-center gap-2">
               <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
               <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.1em]">{onlineCount.toLocaleString()} Active Terminals</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {connected ? (
            <>
              {balance !== undefined && (
                <CoinBadge balance={balance} streak={streak} canClaim={canClaim} nextClaim={nextClaim ?? 0} claimCoins={claimCoins} />
              )}
              <div className="hidden md:flex px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-black text-white/40 uppercase tracking-widest gap-1.5 items-center">
                📡 {latency}MS
              </div>
            </>
          ) : (
             <div className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-black text-amber-500 uppercase tracking-widest animate-pulse">
                Uplink Offline
             </div>
          )}
          <button onClick={() => setModal('safety')} className="hidden sm:flex text-xs font-black uppercase tracking-widest text-cyan-400/60 hover:text-cyan-400 transition-colors">Protocols</button>
        </div>
      </header>

      {/* HERO / LANDING */}
      <main className="relative z-10 pt-32 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center">
        
        {/* AI Nav Core - Pure Tech */}
        <div className="relative w-full max-w-4xl mb-12 animate-in-zoom duration-1000">
          <div className="absolute -inset-20 bg-cyan-500/5 rounded-full blur-[120px] pointer-events-none" />
          
          <div className="relative p-1 rounded-3xl bg-gradient-to-br from-cyan-500/40 via-white/5 to-white/5 shadow-2xl">
            <div className="bg-[#050505]/95 backdrop-blur-3xl rounded-[22px] p-8 md:p-12 overflow-hidden relative">
              {/* Background data grid */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#06b6d4 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
              
              <div className="flex flex-col md:flex-row items-center gap-10 relative z-10">
                <div className="w-48 h-48 md:w-56 md:h-56 shrink-0 relative group">
                   <div className="absolute inset-0 bg-cyan-500/10 rounded-full animate-ping-slow" />
                   <div className="absolute inset-2 border border-cyan-500/20 rounded-full animate-spin-slow" />
                   <div className="absolute inset-4 border-2 border-cyan-500/10 rounded-full" />
                   <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-32 h-32 md:w-40 md:h-40 bg-gradient-to-tr from-black via-cyan-950 to-cyan-800 rounded-full border border-cyan-400/30 flex flex-col items-center justify-center shadow-[0_0_60px_rgba(6,182,212,0.3)] group-hover:shadow-[0_0_90px_rgba(6,182,212,0.5)] transition-all overflow-hidden">
                        {/* Animated AI orb */}
                        <div className="relative w-12 h-12">
                           <div className="absolute inset-0 bg-cyan-400 rounded-full blur-md animate-pulse opacity-50" />
                           <div className="relative w-full h-full border-2 border-cyan-200 rounded-full animate-pulse-fast flex items-center justify-center text-white font-black text-xl">A</div>
                        </div>
                        <span className="text-[10px] font-black tracking-widest text-cyan-400 mt-4 uppercase">AI Core</span>
                      </div>
                   </div>
                </div>

                <div className="flex-1 text-center md:text-left space-y-6">
                  <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[10px] uppercase font-black tracking-[0.2em] mb-4 inline-block">System Load: Nominal</span>
                  <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-none m-0">
                    Next-Gen AI <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500 italic">Social Discovery.</span>
                  </h1>
                  <p className="text-white/40 text-sm md:text-base font-medium leading-relaxed max-w-xl">
                    Deploying algorithmic synchronization protocols for anonymous peer discovery.
                    Zero accounts. Zero tracking. 100% High-Performance AI Matching.
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-4 justify-center md:justify-start">
                    <button 
                      onClick={() => handleStartInteraction('video')}
                      disabled={!connected || isJoining}
                      className="relative h-14 px-8 rounded-2xl bg-cyan-500 text-black font-black uppercase tracking-widest text-xs shadow-[0_0_40px_rgba(6,182,212,0.4)] hover:bg-white hover:shadow-[0_0_60px_rgba(255,255,255,0.4)] hover:scale-105 active:scale-95 transition-all overflow-hidden group"
                    >
                      <div className="absolute inset-0 translate-y-full group-hover:translate-y-0 bg-white transition-transform duration-300" />
                      <span className="relative z-10 flex items-center gap-2">Initialize Video Uplink <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></span>
                    </button>
                    <button 
                      onClick={scrollToStart}
                      className="h-14 px-8 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 font-black uppercase tracking-widest text-xs text-white/60 hover:text-white transition-all whitespace-nowrap"
                    >
                      Refine Algorithm
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MODE GRID - Pure Tech */}
        <section ref={startRef} className="w-full max-w-7xl mx-auto py-20">
          <div className="flex flex-col items-center text-center mb-16 px-4">
             <h2 className="text-sm font-black uppercase tracking-[0.5em] text-cyan-500/60 mb-4">Discovery Protocols</h2>
             <p className="text-3xl md:text-5xl font-black tracking-tight text-white max-w-2xl">Select your matching interface.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 px-4">
            {[
              { id: 'text', icon: '💬', title: 'Data: Text', desc: 'Binary exchange via secure text uplink. Low-latency anonymous pairing.', color: 'indigo', btn: 'btn-primary' },
              { id: 'video', icon: '📹', title: 'Feed: Video', desc: 'Full-spectrum visual pairing. Encrypted P2P connection via AI Core.', color: 'cyan', btn: 'btn-teal' },
              { id: 'group_text', icon: '👥', title: 'Cluster: Text', desc: 'Sync with a multi-node shared chat segment.', color: 'amber', btn: 'btn-amber' },
              { id: 'group_video', icon: '🎥', title: 'Mesh: Video', desc: 'High-bandwidth multi-node visual synchronization.', color: 'rose', btn: 'btn-danger' },
            ].map((m, i) => (
              <div 
                key={m.id} 
                className="group relative h-80 rounded-[32px] p-1 bg-white/5 border border-white/10 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all duration-500 animate-in-zoom"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <div className="h-full flex flex-col p-8 justify-between">
                  <div className="space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform group-hover:border-cyan-500/20 group-hover:bg-cyan-500/10">
                      {m.icon}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white group-hover:text-cyan-400 transition-colors uppercase tracking-tight">{m.title}</h3>
                      <p className="text-white/30 text-[13px] leading-relaxed mt-2">{m.desc}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleStartInteraction(m.id)}
                    disabled={!connected || isJoining}
                    className="w-full h-12 rounded-2xl bg-white/5 border border-white/10 group-hover:bg-white group-hover:text-black text-xs font-black uppercase tracking-widest transition-all"
                  >
                    Authorize Match →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* INTEREST SCANNER */}
        <section className="w-full max-w-4xl mx-auto py-10 px-4">
           <div className="p-8 md:p-12 rounded-[40px] bg-gradient-to-br from-white/5 to-transparent border border-white/10 backdrop-blur-2xl">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
                <div>
                   <h3 className="text-xs font-black uppercase tracking-[0.3em] text-cyan-400 mb-2">Algorithmic Filters</h3>
                   <h4 className="text-3xl font-black text-white">Target Interest Frequency</h4>
                </div>
                <button 
                  onClick={getAiSuggestions}
                  disabled={isSuggesting}
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-cyan-400 transition-colors"
                >
                  <svg className={`w-3 h-3 ${isSuggesting ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  {isSuggesting ? 'Processing AI Data...' : 'AI Topic Expansion'}
                </button>
              </div>

              <div className="flex flex-wrap gap-3 mb-10">
                {INTERESTS.filter(r => !interests.find(i => i.id === r.id)).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => addInterest(r.id)}
                    className="px-5 py-2.5 rounded-full bg-white/5 border border-white/10 hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:scale-105 transition-all text-sm font-bold text-white/60 hover:text-cyan-400"
                  >
                    #{r.label}
                  </button>
                ))}
              </div>

              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-cyan-500/50">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Input custom discovery parameters..."
                  className="w-full h-16 bg-black/40 border border-white/10 focus:border-cyan-500/50 rounded-2xl pl-16 pr-6 text-white text-lg outline-none transition-all placeholder:text-white/20 placeholder:italic shadow-inner"
                />
              </div>

              {interests.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-6 animate-fade-in-up">
                   {interests.map(i => (
                     <div key={i.id} className="flex items-center gap-2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest">
                       {i.label}
                       <button onClick={() => removeInterest(i.id)} className="hover:text-white">✕</button>
                     </div>
                   ))}
                </div>
              )}
           </div>
        </section>

      </main>

      {/* FOOTER - PURE TECH */}
      <footer className="relative z-10 py-20 px-6 bg-black border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start justify-between gap-20">
          <div className="max-w-xs space-y-6">
             <div className="font-black text-2xl tracking-[0.2em] text-white uppercase italic">
                Mana <span className="text-cyan-500">Mingle</span>
             </div>
             <p className="text-white/20 text-xs font-bold leading-relaxed tracking-widest uppercase">
                Premier AI Discovery Matrix for anonymous peer pairing. 
                Powered by WeConnect tech stack. 
                100% ephemeral digital environment.
             </p>
             <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-2xl p-4">
                <span className="text-[10px] font-black text-cyan-400/60 uppercase tracking-[0.2em]">Security Grid: Operational</span>
                <p className="text-[9px] text-white/30 mt-1 uppercase font-bold">Real-time AI behavioral analysis. Illegal activity leads to de-authorization.</p>
             </div>
          </div>

          <div className="flex-1 grid grid-cols-2 lg:grid-cols-3 gap-10">
             <div className="space-y-4">
                <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400">Security Layers</h5>
                <ul className="space-y-2">
                   {['privacy', 'guidelines', 'Terms'].map(m => (
                     <li key={m}><button onClick={() => setModal(m.toLowerCase())} className="text-xs text-white/40 hover:text-white transition-colors uppercase font-bold tracking-widest">Protocol: {m}</button></li>
                   ))}
                </ul>
             </div>
             <div className="space-y-4">
                <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">System Parameters</h5>
                <ul className="space-y-2">
                   <li className="text-[10px] text-white/20 font-bold uppercase tracking-widest">Matching: AI Algorithmic</li>
                   <li className="text-[10px] text-white/20 font-bold uppercase tracking-widest">Storage: Volatile RAM Only</li>
                   <li className="text-[10px] text-white/20 font-bold uppercase tracking-widest">Link: P2P Encrypted</li>
                </ul>
             </div>
             <div className="space-y-4 col-span-2 lg:col-span-1">
                <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">Support Uplink</h5>
                <p className="text-[10px] text-white/40 font-bold leading-relaxed uppercase tracking-widest">
                   Connecting terminals globally. Automatic load balancing across server segments.
                </p>
                <a href="mailto:manaminglee@gmail.com" className="inline-block text-[10px] text-cyan-400 hover:text-white font-black uppercase underline tracking-[0.2em]">Email Terminal</a>
             </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-10 mt-10 border-t border-white/[0.03] text-center">
            <span className="text-[10px] font-black text-white/5 uppercase tracking-[0.5em]">© 2026 Mana Mingle Matrix · Anonymous Data Policy</span>
        </div>
      </footer>

      {/* MODAL */}
      {modal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-black/80 backdrop-blur-3xl animate-in-zoom" onClick={() => setModal(null)}>
          <div className="relative w-full max-w-xl bg-black border border-cyan-500/30 rounded-[40px] shadow-[0_0_100px_rgba(6,182,212,0.2)] p-10 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 right-0 p-8">
               <button onClick={() => setModal(null)} className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">✕</button>
            </div>
            <div className="relative z-10">
               <h3 className="text-3xl font-black text-cyan-400 mb-6 uppercase tracking-tighter italic">{MODALS[modal]?.title}</h3>
               <div className="h-px w-20 bg-cyan-500/40 mb-8" />
               <pre className="text-sm whitespace-pre-wrap font-sans text-white/50 leading-relaxed font-medium">
                {MODALS[modal]?.body}
               </pre>
               <button onClick={() => setModal(null)} className="mt-12 w-full h-14 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-bold uppercase tracking-widest text-xs rounded-2xl hover:bg-cyan-500 hover:text-black transition-all">Understood Protocol</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
