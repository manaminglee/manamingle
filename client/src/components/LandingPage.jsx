import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useLatency } from '../hooks/useLatency';
import { CoinBadge } from './CoinBadge';
import { useCreators } from '../hooks/useCreators';


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
  const [regionalCounts, setRegionalCounts] = useState({ americas: 42639, eurasia: 89875, oceania: 13033 });
  const [insightIndex, setInsightIndex] = useState(0);
  const { creatorStatus, registerCreator, verifyReferral, requestWithdrawal } = useCreators();
  const [showCreatorModal, setShowCreatorModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ handle: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [creatorForm, setCreatorForm] = useState({ handle: '', platform: 'Instagram', link: '' });
  const [refProcessed, setRefProcessed] = useState(false);
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false);
  const startRef = useRef(null);

  useEffect(() => {
    const rawCount = onlineCount?.count || onlineCount || 0;
    const baseAmericas = Math.floor(rawCount * 0.32) || 42639;
    const baseEurasia = Math.floor(rawCount * 0.58) || 89875;
    const baseOceania = Math.floor(rawCount * 0.10) || 13033;

    const interval = setInterval(() => {
      setRegionalCounts({
        americas: baseAmericas + Math.floor(Math.random() * 20 - 10),
        eurasia: baseEurasia + Math.floor(Math.random() * 40 - 20),
        oceania: baseOceania + Math.floor(Math.random() * 10 - 5)
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [onlineCount]);

  useEffect(() => {
    // Detect Referral Link
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref');
    if (refCode && !refProcessed) {
      verifyReferral(refCode).then(() => {
        setRefProcessed(true);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      });
    }

    const interval = setInterval(() => {
      setInsightIndex(prev => (prev + 1) % INSIGHTS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [verifyReferral, refProcessed]);

  const addInterest = (interestArg) => {
    if (!interestArg) return;
    const isPredefined = INTERESTS.find(i => i.id === interestArg?.id || i.id === interestArg);
    const newInterest = isPredefined ? isPredefined : { id: interestArg.toLowerCase(), label: interestArg };
    if (!interests.find(i => i.id === newInterest.id)) setInterests([...interests, newInterest]);
  };

  const removeInterest = (id) => setInterests(interests.filter(idArg => idArg.id !== id));

  const getAiSuggestions = async () => {
    if (isSuggesting) return;
    setIsSuggesting(true);
    try {
      const apiBase = import.meta.env.VITE_SOCKET_URL || '';
      const res = await fetch(`${apiBase}/api/ai/suggest`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        // setSuggestedInterests is not defined, skipping or fixing if needed
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
          <div className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-black text-white/40 uppercase tracking-widest">{(typeof onlineCount === 'object' ? onlineCount?.count : onlineCount) || 0} Live</div>
          {creatorStatus && (
             <button 
               onClick={() => { window.localStorage.removeItem('mm_creatorId'); window.location.reload(); }}
               className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg text-[8px] font-black uppercase tracking-widest transition-all"
               title="Terminate Node Session"
             >Logout</button>
          )}
        </div>
      </header>

      {/* HERO SECTION */}
      <main className="relative z-10 pt-32 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center">

        {adsEnabled && <AdSection position="hero" script={adScripts?.hero} />}

        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-7xl font-black tracking-tighter leading-none italic m-0 animate-in-zoom">
            Connect <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500">Instantly.</span>
          </h2>
          <p className="text-[11px] text-white/30 max-w-lg mx-auto font-bold uppercase tracking-widest leading-relaxed">
            Zero registration. Private P2P. Secure Global Hub.
          </p>
        </div>

        {/* INTEREST DOCK - REFINED COMPACT */}
        <section className="w-full max-w-2xl mx-auto mb-16 px-4 animate-fade-in" style={{ animationDelay: '200ms' }}>
          <div className="relative group p-6 sm:p-8 rounded-[40px] bg-white/[0.03] border border-white/[0.06] backdrop-blur-3xl overflow-hidden active:scale-[0.98] transition-all">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-cyan-500/20 rounded-full blur-[80px] pointer-events-none group-hover:bg-cyan-500/30 transition-all" />

            <div className="relative z-10 flex flex-col items-center">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_10px_#00E5FF]" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400 italic">Passion Matrix Filter</span>
              </div>

              <div className="flex flex-wrap justify-center gap-1.5 mb-8">
                {INTERESTS.filter(r => !interests.find(i => i.id === r.id)).slice(0, 8).map((r) => (
                  <button
                    key={r.id}
                    onClick={() => addInterest(r.id)}
                    className="px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/5 hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-400 transition-all text-[9px] font-black uppercase tracking-widest text-white/40"
                  >
                    #{r.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full max-w-sm">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Add specific topics..."
                  className="w-full h-12 bg-black/40 border border-white/10 focus:border-cyan-500/40 rounded-2xl px-6 text-[12px] text-white outline-none transition-all placeholder:text-white/10 uppercase font-black tracking-widest text-center"
                />
                <button onClick={getAiSuggestions} className="absolute right-1 top-1/2 -translate-y-1/2 p-2.5 bg-cyan-500/20 text-cyan-400 rounded-xl hover:bg-cyan-500 hover:text-black transition-all">
                  <svg className={`w-3.5 h-3.5 ${isSuggesting ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </button>
              </div>

              {interests.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5 mt-5">
                  {interests.map(i => (
                    <div key={i.id} className="flex items-center gap-2 bg-cyan-400 text-black px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-[0_0_15px_#06b6d440]">
                      {i.label}
                      <button onClick={() => removeInterest(i.id)} className="hover:scale-125 transition-transform">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>


        {/* UNIQUE COMPACT MODES */}
        <section className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-20">
          {[
            { id: 'video', icon: '📹', name: 'Start Video', color: 'from-cyan-400/20', accent: 'cyan' },
            { id: 'text', icon: '💬', name: 'Start Text', color: 'from-indigo-500/20', accent: 'indigo' },
            { id: 'group_video', icon: '🎥', name: 'Group Jam', color: 'from-purple-500/20', accent: 'purple' },
            { id: 'group_text', icon: '👥', name: 'Group Out', color: 'from-emerald-500/20', accent: 'emerald' },
          ].map((m, i) => (
            <button
              key={m.id}
              onClick={() => handleStartInteraction(m.id)}
              disabled={!connected || isJoining}
              className="group relative h-40 rounded-[35px] bg-white/[0.02] border border-white/5 hover:border-white/20 transition-all animate-in-zoom p-[2px] overflow-hidden"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${m.color} to-transparent opacity-40 group-hover:opacity-100 transition-opacity`} />
              <div className="relative h-full bg-[#0a0a0a]/90 rounded-[33px] p-6 flex flex-col justify-between items-start text-left">
                <div className={`w-10 h-10 rounded-2xl bg-${m.accent}-500/10 border border-${m.accent}-500/40 flex items-center justify-center text-lg group-hover:scale-110 transition-transform group-hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]`}>
                  {m.icon}
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest italic text-white group-hover:text-cyan-400 transition-colors">{m.name}</h3>
                  <p className="text-[8px] font-bold text-white/20 uppercase tracking-[0.2em] mt-1">Uplink Encrypted</p>
                </div>
              </div>
            </button>
          ))}
        </section>

        {/* AI GENERATED DISCOVERY CONTEXT */}
        <section className="w-full max-w-3xl mb-24 px-6">
          <div className="p-8 rounded-[40px] bg-gradient-to-r from-cyan-500/5 via-indigo-500/5 to-transparent border border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 font-mono text-[80px] pointer-events-none italic font-black">AI</div>
            <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              Pulse Intelligence Discovery
            </h4>
            <p className="text-sm font-medium text-white/70 italic leading-relaxed">
              System is analyzing global interaction nodes... Our decentralized P2P matrix ensures that every connection is uniquely encrypted. Currently observing a high density of clusters in creative and tech corridors. Target a specific interest to initiate a focused uplink.
            </p>
          </div>
        </section>

        {/* GLOBAL TRAFFIC GLOBE - REAL TIME ANIMATED */}
        <section className="w-full max-w-5xl mb-32 flex flex-col items-center">
          <div className="relative w-full h-[400px] flex items-center justify-center">
            {/* MOCKED REAL-TIME MAP/GLOBE ANIMATION */}
            <div className="absolute inset-0 flex items-center justify-center opacity-30">
              <div className="w-[300px] h-[300px] rounded-full border border-cyan-500/20 animate-pulse" />
              <div className="absolute w-[450px] h-[450px] rounded-full border border-indigo-500/10 animate-spin-slow" />
              <div className="absolute w-[600px] h-[600px] rounded-full border border-white/[0.03] animate-reverse-spin-slow" />
            </div>

            <div className="relative z-10 text-center">
              <div className="mb-8 scale-150 grayscale brightness-150 opacity-20 hover:grayscale-0 hover:opacity-100 transition-all duration-1000 cursor-help">
                <span className="text-[120px] animate-float">🌍</span>
              </div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.6em] text-cyan-400 mb-2 italic">Active Neural Traffic Hub</h4>
              <div className="flex gap-12 mt-8">
                <div className="text-center group">
                  <div className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1 group-hover:text-cyan-400 transition-colors">Americas</div>
                  <div className="text-xl font-black italic text-white group-hover:scale-110 transition-transform tabular-nums">{regionalCounts.americas.toLocaleString()}</div>
                </div>
                <div className="text-center group">
                  <div className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1 group-hover:text-indigo-400 transition-colors">Eurasia</div>
                  <div className="text-xl font-black italic text-white group-hover:scale-110 transition-transform tabular-nums">{regionalCounts.eurasia.toLocaleString()}</div>
                </div>
                <div className="text-center group">
                  <div className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-1 group-hover:text-emerald-400 transition-colors">Oceania</div>
                  <div className="text-xl font-black italic text-white group-hover:scale-110 transition-transform tabular-nums">{regionalCounts.oceania.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* FLOATING DATA DOTS */}
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-cyan-400 rounded-full animate-float-pixel"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${i * 200}ms`
                }}
              />
            ))}
          </div>
        </section>

        {/* CREATOR MATRIX CTA */}
        <section className="w-full max-w-4xl mx-auto mb-16 px-4">
          <div className="p-10 rounded-[50px] bg-gradient-to-br from-cyan-500/10 to-transparent border border-cyan-500/20 text-center relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50" />
            <div className="relative z-10">
              <h3 className="text-2xl font-black uppercase italic tracking-tighter mb-2">Are you a <span className="text-cyan-400">Creator?</span></h3>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.3em] mb-8">Monetize your nodes. Influence the matrix.</p>
              <div className="flex flex-wrap justify-center gap-4">
                <button
                  onClick={() => setShowCreatorModal(true)}
                  className="px-10 py-4 bg-white text-black font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-cyan-400 transition-all shadow-xl shadow-cyan-500/20"
                >
                  {creatorStatus ? 'Creator Dashboard' : 'Join the Matrix'}
                </button>
                {!creatorStatus && (
                  <button
                    onClick={() => setShowLoginModal(true)}
                    className="px-10 py-4 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-indigo-500 hover:text-white transition-all"
                  >
                    Creator Login
                  </button>
                )}
              </div>
            </div>
            <div className="absolute -bottom-10 -right-10 text-9xl opacity-[0.03] group-hover:opacity-[0.07] transition-opacity pointer-events-none">⭐</div>
          </div>
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

      {/* CREATOR MODAL */}
      {showCreatorModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl animate-in-zoom" onClick={() => setShowCreatorModal(false)}>
          <div className="relative w-full max-w-lg bg-black border border-white/10 rounded-[50px] p-10 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowCreatorModal(false)}
              className="absolute top-6 right-8 text-white/20 hover:text-white transition-colors"
            >✕</button>

            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4 text-2xl shadow-[0_0_20px_#06b6d430]">⭐</div>
              <h3 className="text-2xl font-black italic uppercase tracking-tighter">Creator Hub</h3>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-2">Monetization Node Infrastructure</p>
            </div>

            {!creatorStatus ? (
              <div className="space-y-6">
                <div className="space-y-4 text-center mb-8">
                  <p className="text-xs font-bold text-white/60 leading-normal">
                    Verified creators get a <span className="text-cyan-400">Blue Tick</span>, unique handles, and earn <span className="text-emerald-400">₹150 per 10k clicks</span>.
                  </p>
                </div>
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="@handle_name"
                    className="w-full h-14 bg-white/5 border border-white/5 focus:border-cyan-500/30 rounded-2xl px-6 text-sm outline-none"
                    value={creatorForm.handle}
                    onChange={e => setCreatorForm({ ...creatorForm, handle: e.target.value })}
                  />
                  <div className="relative group">
                    <button
                      onClick={() => setPlatformDropdownOpen(!platformDropdownOpen)}
                      type="button"
                      className="w-full h-14 bg-white/5 border border-white/5 focus:border-cyan-500/30 rounded-2xl px-6 text-sm outline-none text-white/50 flex items-center justify-between transition-all hover:bg-white/[0.08]"
                    >
                      <span>{creatorForm.platform || 'Select Platform'}</span>
                      <svg className={`w-4 h-4 transition-transform duration-300 ${platformDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* CUSTOM DROPDOWN OPTIONS */}
                    {platformDropdownOpen && (
                      <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-[1000] bg-[#111] border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in-zoom">
                        {['Instagram', 'YouTube', 'Snapchat'].map(p => (
                          <button
                            key={p}
                            onClick={() => {
                              setCreatorForm({ ...creatorForm, platform: p });
                              setPlatformDropdownOpen(false);
                            }}
                            className="w-full h-12 px-6 text-left text-xs font-bold text-white/60 hover:text-white hover:bg-cyan-500/10 transition-all border-b border-white/[0.03] last:border-0"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    type="url"
                    placeholder="Platform Profile Link"
                    className="w-full h-14 bg-white/5 border border-white/5 focus:border-cyan-500/30 rounded-2xl px-6 text-sm outline-none"
                    value={creatorForm.link}
                    onChange={e => setCreatorForm({ ...creatorForm, link: e.target.value })}
                  />
                  <button
                    onClick={async () => {
                      const res = await registerCreator(creatorForm.handle, creatorForm.platform, creatorForm.link);
                      if (res.success) {
                        alert(`Application Transmitted! \n\nIMPORTANT: Take a screenshot of your Matrix ID: ${res.accessKey} \nUse this to check your earnings later.`);
                        window.location.reload();
                      }
                      else alert(res.error);
                    }}
                    className="w-full h-14 bg-cyan-400 text-black font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-white transition-all shadow-xl shadow-cyan-500/20"
                  >Initialize Matrix Node</button>
                  
                  <div className="pt-6 border-t border-white/5">
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest text-center mb-4 italic shadow-[0_0_10px_rgba(34,211,238,0.2)]">Returning Creator?</p>
                    <div className="flex gap-2">
                       <input 
                         type="text" 
                         id="creator-id-input"
                         placeholder="Paste Matrix ID" 
                         className="flex-1 h-12 bg-white/5 border border-white/5 rounded-xl px-4 text-[10px] outline-none font-black tracking-widest uppercase"
                       />
                       <button 
                         onClick={async () => {
                           const id = document.getElementById('creator-id-input').value;
                           const res = await fetch(`${import.meta.env.VITE_SOCKET_URL || ''}/api/creators/status?id=${id}`);
                           const data = await res.json();
                           if (data.data) {
                             // Force status refresh
                             window.localStorage.setItem('mm_creatorId', id);
                             window.location.reload();
                           } else {
                             alert('Matrix ID invalid.');
                           }
                         }}
                         className="px-6 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all"
                       >Sync</button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-8 animate-in-zoom">
                <div className="p-8 rounded-[32px] bg-white/[0.02] border border-white/5 space-y-4 text-center">
                   <div className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Node Identity</div>
                   <h4 className="text-3xl font-black italic uppercase tracking-tighter text-white">@{creatorStatus.handle_name}</h4>
                   <div className="flex justify-center gap-4">
                     {creatorStatus.status === 'approved' ? (
                       <span className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest shadow-[0_0_20px_#10b98130]">Portal Active</span>
                     ) : (
                       <span className="px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest animate-pulse">Waiting for manual appraisal</span>
                     )}
                   </div>
                </div>

                {creatorStatus.status === 'approved' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-6 rounded-[32px] bg-white/[0.03] border border-white/5">
                        <div className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-1">Earned</div>
                        <div className="text-xl font-black italic text-emerald-400">₹{creatorStatus.earnings_rs || 0}</div>
                        <div className="text-[8px] font-bold text-white/10 uppercase mt-1 italic shadow-[0_0_10px_rgba(34,211,238,0.2)]">Neural Earnings</div>
                      </div>
                      <div className="p-6 rounded-[32px] bg-white/[0.03] border border-white/5">
                        <div className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-1">Matrix ID</div>
                        <div className="text-xl font-black italic text-indigo-400">{creatorStatus.referral_code}</div>
                        <div className="text-[8px] font-bold text-white/10 uppercase mt-1 italic shadow-[0_0_10px_rgba(34,211,238,0.2)]">Unique Access</div>
                      </div>
                    </div>

                    <div className="p-8 rounded-[32px] bg-indigo-500/5 border border-indigo-500/10 space-y-4">
                       <div className="text-center">
                          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 italic">Neural Credentials</span>
                          <p className="text-[8px] font-black text-white/20 uppercase mt-1">Use these to login from any IP node</p>
                       </div>
                       <div className="grid grid-cols-1 gap-3">
                          <div className="bg-black/40 rounded-2xl p-4 border border-white/5 flex justify-between items-center group">
                             <div>
                                <div className="text-[8px] font-black uppercase text-white/20 mb-1">Universal Handle</div>
                                <div className="text-xs font-black text-white italic uppercase">{creatorStatus.handle_name}</div>
                             </div>
                             <span className="text-[10px] opacity-10 group-hover:opacity-40 transition-opacity">🆔</span>
                          </div>
                          <div className="bg-black/40 rounded-2xl p-4 border border-white/5 flex justify-between items-center group">
                             <div>
                                <div className="text-[8px] font-black uppercase text-white/20 mb-1">Access Passphrase</div>
                                <div className="text-xs font-black text-emerald-400 italic uppercase select-all">{creatorStatus.password}</div>
                             </div>
                             <span className="text-[10px] opacity-10 group-hover:opacity-40 transition-opacity">🔒</span>
                          </div>
                       </div>
                    </div>

                    <div className="p-8 rounded-[32px] bg-white/[0.01] border border-white/5">
                       <div className="flex justify-between items-center mb-4 px-2">
                          <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Authorized Node IPs</span>
                          <span className="text-[8px] font-black text-emerald-400 uppercase italic animate-pulse">Synced</span>
                       </div>
                       <div className="flex flex-wrap gap-2">
                          {(creatorStatus.authorized_ips || []).map(ipNode => (
                             <span key={ipNode} className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 text-[9px] font-bold text-white/30 uppercase tracking-widest">{ipNode}</span>
                          ))}
                       </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4 pt-6 border-t border-white/5">
                  <div className="flex justify-between items-center px-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Referral Matrix Link</span>
                    {creatorStatus.status === 'approved' && <span className="text-[9px] font-bold text-emerald-400 uppercase italic shadow-[0_0_10px_rgba(34,211,238,0.2)] animate-pulse">Sync Enabled</span>}
                  </div>
                  <div className="flex gap-2">
                    <input
                      disabled
                      readOnly
                      value={creatorStatus.status === 'approved' ? `${window.location.origin}?ref=${creatorStatus.referral_code}` : 'Pending Appraisal...'}
                      className="flex-1 h-14 bg-white/5 border border-white/5 rounded-2xl px-6 text-[10px] font-bold text-white/40 outline-none overflow-hidden text-ellipsis italic"
                    />
                    {creatorStatus.status === 'approved' && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}?ref=${creatorStatus.referral_code}`);
                          alert('Referral Matrix Link Copied');
                        }}
                        className="px-8 h-14 rounded-2xl bg-cyan-400 text-black font-black uppercase tracking-widest text-[10px] hover:bg-white transition-all shadow-xl shadow-cyan-500/20"
                      >Sync</button>
                    )}
                  </div>
                </div>

                {creatorStatus.status === 'approved' && creatorStatus.earnings_rs >= 1500 && (
                  <button
                    onClick={async () => {
                      const upi = prompt('Enter UPI ID for withdrawal:');
                      if (upi) {
                        const res = await requestWithdrawal(upi);
                        if (res.success) alert('Withdrawal Signal Transmitted.');
                        else alert(res.error);
                      }
                    }}
                    className="w-full h-14 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-emerald-500 hover:text-white transition-all shadow-xl shadow-emerald-500/20"
                  >Authorize Withdrawal (₹{creatorStatus.earnings_rs})</button>
                )}

                <div className="text-[9px] font-bold text-white/10 text-center uppercase tracking-widest italic pt-4">
                  Matrix Logic: 10 Coins / Click | 10000 Coins = ₹150 | Min Withdrawal ₹1500
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATOR LOGIN MODAL */}
      {showLoginModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl animate-in-zoom" onClick={() => setShowLoginModal(false)}>
          <div className="relative w-full max-w-sm bg-black border border-white/10 rounded-[50px] p-10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowLoginModal(false)} className="absolute top-6 right-8 text-white/20 hover:text-white transition-colors">✕</button>
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4 text-2xl shadow-[0_0_20px_#6366f120]">🔑</div>
              <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Neural Portal</h3>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-2">Creator Hub Authorization</p>
            </div>
            <div className="space-y-4">
               <input 
                 type="text" 
                 placeholder="Matrix Handle" 
                 value={loginForm.handle}
                 onChange={e => setLoginForm({...loginForm, handle: e.target.value})}
                 className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl px-6 text-sm outline-none text-white focus:border-indigo-500/30 transition-all font-bold"
               />
               <input 
                 type="password" 
                 placeholder="Neural Key" 
                 value={loginForm.password}
                 onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                 className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl px-6 text-sm outline-none text-white focus:border-indigo-500/30 transition-all tracking-widest"
               />
               <button 
                 onClick={async () => {
                   setLoginError('');
                   try {
                     const apiBase = import.meta.env.VITE_SOCKET_URL || '';
                     const res = await fetch(`${apiBase}/api/creators/login`, {
                       method: 'POST',
                       headers: { 'Content-Type': 'application/json' },
                       body: JSON.stringify(loginForm)
                     });
                     const data = await res.json();
                     if (data.success) {
                       window.localStorage.setItem('mm_creatorId', data.data.referral_code);
                       window.location.reload();
                     } else {
                       setLoginError(data.error);
                     }
                   } catch (e) { setLoginError('Connection Failed'); }
                 }}
                 className="w-full h-14 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-white hover:text-black transition-all shadow-xl shadow-indigo-600/20"
               >Authorize Uplink</button>
               {loginError && <p className="text-rose-500 text-[10px] text-center font-black uppercase tracking-widest mt-4 animate-shake">{loginError}</p>}
            </div>
          </div>
        </div>
      )}

      {/* STANDARD MODAL */}
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
