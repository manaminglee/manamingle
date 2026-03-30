import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useLatency } from '../hooks/useLatency';
import { CoinBadge } from './CoinBadge';

const INTERESTS = [
  { id: 'telugu', label: 'Telugu', desc: 'Connect with Telugu speakers' },
  { id: 'music', label: 'Music', desc: 'Share your favorite beats' },
  { id: 'gaming', label: 'Gaming', desc: 'Find your next squad' },
  { id: 'movies', label: 'Movies', desc: 'Discuss latest releases' },
  { id: 'sports', label: 'Sports', desc: 'Talk about live games' },
  { id: 'chat', label: 'Random', desc: 'Just a friendly hello' },
];

const MODALS = {
  privacy: {
    title: '🔒 Privacy First',
    body: `Mana Mingle is built on absolute anonymity.\n\n• Zero data collection — no names, no emails, no accounts.\n• Ephemeral sessions — everything is purged when you leave.\n• IP Protection — transient logs for safety only.\n• E2EE WebRTC — secure direct video tunnels.\n• No permanent storage — session data lives in memory only.\n• No tracking — zero cookies, zero scripts, zero footprint.`,
  },
  terms: {
    title: '📋 Terms of Service',
    body: `Community Standards: \n\n• You must be 18 years of age or older.\n• Harassment and bullying are strictly prohibited.\n• Illegal content triggers immediate system bans.\n• Repeated violations result in permanent IP blocks.\n• Use the platform as-is — we prioritize safety over all.\n• Do not attempt to deanonymize other users.\n• Bots and automated tools are not allowed.`,
  },
  guidelines: {
    title: '🤝 Safe Space Guidelines',
    body: `The Vibe Check: \n\n✅ Do: \n• Treat everyone with kindness\n• Report disruptive behavior\n• Be genuine and authentic\n• Skip quickly if not interested\n\n❌ Don't: \n• Share explicit or illegal material\n• Ask for private identity details\n• Use slurs or hate speech\n• Harass or demean others\n\nViolations lead to permanent de-activation.`,
  },
  monitoring: {
    title: '⚖️ AI Safety Guard',
    body: `Our automated safety system: \n\n• 24/7 AI-powered content monitoring.\n• Real-time visual analysis for platform safety.\n• Immediate action on flagged material.\n• Human review within minutes of reports.\n• Full compliance with local security laws.\n• All monitoring data is deleted post-session.`,
  },
  safety: {
    title: '🛡️ Safety Features',
    body: `Built-in protection: \n\n• Global 'End Connection' button on all chats.\n• Instant Skip — move to the next person instantly.\n• AI Vision Barrier — keeps the community safe.\n• Rate Limiting — prevents spam and abuse.\n• 100% Anonymous metadata — your identity is yours.\n• Optimized for privacy on every device.\n• Encrypted connections at all times.`,
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
  const [transitioning, setTransitioning] = useState(false);
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
    setTransitioning(true);
    setTimeout(() => {
      onJoin(getInterest(), 'Anonymous', mode);
    }, 800);
  };

  const scrollToStart = () => startRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="min-h-screen bg-[#050505] text-white relative font-sans selection:bg-amber-500/30 selection:text-amber-200 overflow-x-hidden">
      
      {/* PREMIUM LIQUID GLASS BACKGROUND */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-50">
        <img 
          src="/premium_abstract_fluid_background_1774873660918.png" 
          alt="Fluid Abstract" 
          className="w-full h-full object-cover filter blur-[2px] scale-105" 
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/40 via-transparent to-[#050505]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(245,158,11,0.08),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(99,102,241,0.08),transparent_50%)]" />
      </div>

      {/* TRANSITION OVERLAY */}
      {transitioning && (
        <div className="fixed inset-0 z-[1000] bg-black animate-fade-in flex items-center justify-center">
           <div className="w-12 h-12 border-2 border-white/10 border-t-amber-500 rounded-full animate-spin" />
        </div>
      )}

      {/* LUXURY NAV */}
      <header className="fixed top-0 left-0 right-0 z-[150] h-20 px-8 flex items-center justify-between bg-black/10 backdrop-blur-2xl border-b border-white/[0.03]">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <h1 className="text-xl font-black tracking-tighter uppercase leading-none">Mana <span className="text-amber-500">Mingle</span></h1>
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.3em] mt-1">Premium Social Studio</span>
          </div>
          <div className="hidden lg:flex h-8 w-px bg-white/10 ml-2" />
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/5">
             <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
             </span>
             <span className="text-[10px] font-bold tracking-widest text-white/50 uppercase">{onlineCount.toLocaleString()} ONLINE</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {connected && balance !== undefined && (
            <CoinBadge balance={balance} streak={streak} canClaim={canClaim} nextClaim={nextClaim ?? 0} claimCoins={claimCoins} />
          )}
          <button 
            onClick={() => setModal('safety')}
            className="px-5 py-2 rounded-full border border-white/10 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-amber-500"
          >
            Safety Hub
          </button>
        </div>
      </header>

      {/* HERO SECTION */}
      <main className="relative z-10 pt-40 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center">
        
        {/* BREATHING TITLE */}
        <div className="text-center mb-16 animate-fade-in-up">
           <span className="inline-block px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-amber-500/80 text-[10px] font-black uppercase tracking-[0.4em] mb-6">Discovery Reimagined</span>
           <h2 className="text-5xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-8 text-white drop-shadow-2xl">
              Meet People <br /> 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-white to-amber-200 italic px-2">Instantly.</span>
           </h2>
           <p className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto font-medium leading-relaxed">
              Experience the world’s most elegant anonymous platform. 
              Pure connections, zero registration, and complete privacy by design.
           </p>
        </div>

        {/* GALLERIED MODES */}
        <section ref={startRef} className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
           {[
             { id: 'video', icon: '📹', title: 'Video Connect', sub: 'Face-to-face encrypted chat', color: 'amber', delay: 100 },
             { id: 'text', icon: '💬', title: 'Text Stream', sub: '1-on-1 anonymous messaging', color: 'indigo', delay: 200 },
             { id: 'group_video', icon: '🎥', title: 'Multi-Room', sub: 'Shared video with up to 4 strangers', color: 'emerald', delay: 300 },
             { id: 'group_text', icon: '👥', title: 'Group Hub', sub: 'Collaborative anonymous text', color: 'rose', delay: 400 },
           ].map((m) => (
             <button
               key={m.id}
               onClick={() => handleStartInteraction(m.id)}
               disabled={!connected || isJoining}
               className={`group relative h-[380px] rounded-[40px] overflow-hidden bg-white/5 border border-white/10 hover:border-${m.color}-500/50 hover:bg-${m.color}-500/5 transition-all duration-500 animate-in-zoom`}
               style={{ animationDelay: `${m.delay}ms` }}
             >
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                <div className="absolute inset-0 translate-y-full group-hover:translate-y-0 bg-gradient-to-b from-white/5 to-transparent transition-transform duration-700" />
                
                <div className="h-full relative z-10 p-10 flex flex-col justify-between items-start text-left">
                   <div className="w-16 h-16 rounded-[24px] bg-white/5 border border-white/10 flex items-center justify-center text-3xl group-hover:scale-125 group-hover:rotate-6 transition-all duration-500">
                      {m.icon}
                   </div>
                   <div className="space-y-4 w-full">
                      <div className="space-y-1">
                        <h3 className="text-2xl font-black tracking-tight text-white group-hover:text-amber-500 transition-colors uppercase italic">{m.title}</h3>
                        <p className="text-sm text-white/30 font-medium leading-snug">{m.sub}</p>
                      </div>
                      <div className="h-px w-full bg-white/10 group-hover:bg-amber-500/30 transition-all duration-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]" />
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black tracking-widest text-white/40 uppercase group-hover:text-white transition-colors">Launch Protocol</span>
                         <svg className="w-5 h-5 text-white/20 group-hover:text-amber-500 group-hover:translate-x-2 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                      </div>
                   </div>
                </div>
             </button>
           ))}
        </section>

        {/* INTERACTIVE INTEREST DOCK */}
        <section className="w-full max-w-5xl mx-auto px-4">
           <div className="relative p-1 rounded-[50px] bg-gradient-to-br from-white/20 via-transparent to-white/5 shadow-2xl">
              <div className="bg-[#0a0a0a]/90 backdrop-blur-3xl rounded-[49px] p-8 md:p-12">
                 <div className="flex flex-col md:flex-row items-center justify-between gap-10 mb-12">
                    <div className="text-center md:text-left">
                       <h4 className="text-xs font-black uppercase tracking-[0.4em] text-amber-500 mb-2">Refine Your Feed</h4>
                       <h5 className="text-3xl font-black text-white">Select Discovery Keywords</h5>
                    </div>
                    <button 
                      onClick={getAiSuggestions}
                      disabled={isSuggesting}
                      className="group flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 hover:border-amber-500/40 hover:bg-amber-500/10 transition-all text-[11px] font-black uppercase tracking-widest"
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${isSuggesting ? 'bg-amber-500 animate-pulse' : 'bg-white/20 group-hover:bg-amber-500'} transition-colors`} />
                      {isSuggesting ? 'Scanning Patterns...' : 'Grow Recommendations'}
                    </button>
                 </div>

                 <div className="flex flex-wrap justify-center md:justify-start gap-3 mb-10">
                    {INTERESTS.filter(r => !interests.find(i => i.id === r.id)).map((r) => (
                      <button
                        key={r.id}
                        onClick={() => addInterest(r.id)}
                        className="px-6 py-3 rounded-full bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 hover:scale-105 active:scale-95 transition-all text-xs font-bold text-white/50 hover:text-white shadow-xl"
                      >
                        {r.label}
                      </button>
                    ))}
                 </div>

                 <div className="relative w-full max-w-3xl mx-auto">
                    <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-white/10">
                       <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <input 
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleInputKeyDown}
                      placeholder="Start typing your passions..."
                      className="w-full h-20 bg-black/50 border border-white/10 focus:border-amber-500/50 rounded-[28px] pl-16 pr-8 text-xl text-white outline-none transition-all placeholder:text-white/10 placeholder:font-light font-medium shadow-inner"
                    />
                 </div>

                 {interests.length > 0 && (
                   <div className="flex flex-wrap justify-center gap-2 mt-8 animate-fade-in-up">
                      {interests.map(i => (
                        <div key={i.id} className="flex items-center gap-3 bg-amber-500 text-black px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-[0_10px_30px_rgba(245,158,11,0.3)]">
                           {i.label}
                           <button onClick={() => removeInterest(i.id)} className="hover:opacity-50 transition-opacity">✕</button>
                        </div>
                      ))}
                   </div>
                 )}
              </div>
           </div>
        </section>

      </main>

      {/* LUXURY FOOTER */}
      <footer className="relative z-10 pt-40 pb-20 px-8 bg-black">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-16">
           <div className="space-y-8">
              <div className="space-y-2">
                 <h2 className="text-2xl font-black uppercase tracking-tight italic">Mana <span className="text-amber-500">Mingle</span></h2>
                 <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.4em]">Refined Social Discovery</p>
              </div>
              <p className="text-sm text-white/30 leading-relaxed font-medium">
                 The definitive destination for safe, anonymous, and high-quality 
                 conversations on a global scale. Pure social experimentation.
              </p>
              <div className="flex items-center gap-3">
                 <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    Global Sync Operational
                 </div>
              </div>
           </div>

           <div className="space-y-6">
              <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500">Legal Protocols</h5>
              <div className="flex flex-col gap-3">
                 {['Privacy', 'Guidelines', 'Terms'].map(m => (
                   <button key={m} onClick={() => setModal(m.toLowerCase())} className="text-sm text-left text-white/40 hover:text-white transition-colors w-fit font-bold uppercase tracking-widest">{m}</button>
                 ))}
                 <a href="mailto:manaminglee@gmail.com" className="text-sm text-white/40 hover:text-white transition-colors font-bold uppercase tracking-widest mt-2 underline">Email Hub</a>
              </div>
           </div>

           <div className="space-y-6">
              <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">System Specs</h5>
              <div className="space-y-4">
                 <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white/20">
                    <span className="text-white/40">Encryption:</span> Full Spectrum TLS
                 </div>
                 <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white/20">
                    <span className="text-white/40">Data Path:</span> P2P WebRTC
                 </div>
                 <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white/20">
                    <span className="text-white/40">Retention:</span> Zero (RAM Only)
                 </div>
              </div>
           </div>

           <div className="space-y-6">
              <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">Trust Hub</h5>
              <div className="p-6 rounded-3xl bg-white/5 border border-white/5 space-y-4 shadow-2xl">
                 <p className="text-[10px] font-black uppercase tracking-widest text-white/60 leading-relaxed">
                    24/7 Monitoring active. Community standards enforced by AI and Human moderation.
                 </p>
                 <div className="flex gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs">🔒</div>
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs">🛡️</div>
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs">⚡</div>
                 </div>
              </div>
           </div>
        </div>
        <div className="max-w-7xl mx-auto pt-20 mt-20 border-t border-white/[0.03] flex justify-between items-center text-white/5 text-[9px] font-black uppercase tracking-[0.5em]">
           <span>© 2026 Mana Mingle Matrix</span>
           <span className="hidden sm:inline">Encrypted Social Innovation</span>
        </div>
      </footer>

      {/* LUXURY MODAL */}
      {modal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/90 backdrop-blur-3xl animate-fade-in" onClick={() => setModal(null)}>
           <div className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-[50px] p-12 shadow-[0_0_100px_rgba(245,158,11,0.15)] max-h-[85vh] overflow-y-auto custom-scrollbar" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-10">
                 <div className="space-y-2">
                    <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter">{MODALS[modal]?.title}</h3>
                    <div className="h-1 w-20 bg-amber-500 rounded-full" />
                 </div>
                 <button onClick={() => setModal(null)} className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all text-xl font-light">✕</button>
              </div>
              <pre className="text-sm md:text-base whitespace-pre-wrap font-sans text-white/50 leading-relaxed font-medium">
                 {MODALS[modal]?.body}
              </pre>
              <div className="mt-12">
                 <button 
                  onClick={() => setModal(null)}
                  className="w-full h-16 rounded-3xl bg-amber-500 text-black font-black uppercase tracking-widest text-xs shadow-xl shadow-amber-500/20 hover:scale-[1.02] active:scale-95 transition-all"
                 >
                    Confirm & Dismiss
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
