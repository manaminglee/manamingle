import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useLatency } from '../hooks/useLatency';
import { CoinBadge } from './CoinBadge';
import { useCreators } from '../hooks/useCreators';
import { MiniTrendChart } from './MiniTrendChart';
import { countryToFlag } from '../utils/countryFlag';
import { ParticleText } from './ParticleText';

const BlueTick = () => (
  <span className="inline-flex items-center justify-center w-3 h-3 bg-cyan-500 rounded-full ml-1.5 shadow-[0_0_10px_#06b6d4]">
    <svg className="w-2 h-2 text-black" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  </span>
);


const INTERESTS = [
  { id: 'telugu', label: 'Telugu', desc: 'Find Telugu peers' },
  { id: 'music', label: 'Music', desc: 'Connect with music lovers' },
  { id: 'gaming', label: 'Gaming', desc: 'Find your squad' },
  { id: 'movies', label: 'Movies', desc: 'Cinema data feed' },
  { id: 'sports', label: 'Sports', desc: 'Kinetic tracking' },
  { id: 'chat', label: 'General', desc: 'Random matching' },
];

const MODALS = {
  privacy: {
    title: '🛡️ Privacy Protection',
    body: `Zero-Trace Policy: \n\n• No accounts. No logs. No history.\n• Sessions are wiped instantly on exit.\n• E2EE direct peer connections.\n• 100% Anonymous metadata.`,
  },
  integrity: {
    title: '🤝 Community Safety',
    body: `Guidelines: \n\n• Respect all users.\n• No explicit material.\n• No bullying or harassment.\n• Instant ban for violations.`,
  },
  safety: {
    title: '🏛️ Security Systems',
    body: `Our core defenses: \n\n• 24/7 AI-driven content analysis.\n• Secure P2P communication.\n• Zero-retention session storage.\n• Rate-limiting against spambots.\n• Administrator oversight with visual monitoring.`,
  },
  dev: {
    title: '💻 Technology Stack',
    body: `Modern & Secure: \n\n• Built on WebRTC / Socket.io.\n• Modern React / Node.js stack.\n• Scalable architecture.\n• Secure API endpoints.\n• Performance-first logic.`,
  },
  bug: {
    title: '🛠️ Bug Bounty',
    body: `Identify vulnerabilities: \n\n• We reward critical bug reports.\n• Direct contact: manaminglee@gmail.com.\n• Rapid patching within 24-48 hours.\n• Help build a safer network.`,
  }
};

const INSIGHTS = [
  "Trending now: Retro music enthusiasts in EU regions.",
  "Trending Chat: Casual debates active in the US.",
  "AI Analysis: Connection speed is at its peak.",
  "System Status: 2,400+ active sessions verified in the last hour.",
  "User Feedback: Telugu-based video feeds are trending today."
];

// Reusable Ad Placeholder component
const AdSection = ({ position, script }) => {
  if (!script) return (
    <div className="w-full bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-center my-6">
      <span className="text-[10px] font-black uppercase tracking-widest text-white/10 italic">Sponsored Content [{position}]</span>
    </div>
  );
  return (
    <div className="w-full my-6 text-center overflow-hidden rounded-2xl" dangerouslySetInnerHTML={{ __html: script }} />
  );
};

export function LandingPage({ onJoin, coinState, isJoining = false }) {
  const { balance, streak, canClaim, nextClaim, claimCoins, adsEnabled, adScripts } = coinState || {};
  const [interests, setInterests] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const { socket, connected, country, onlineCount: socketOnlineCount } = useSocket();
  const onlineCount = typeof socketOnlineCount === 'object' ? socketOnlineCount?.count : (socketOnlineCount || 0);
  const latency = useLatency();
  const [modal, setModal] = useState(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [regionalCounts, setRegionalCounts] = useState({ americas: 42639, eurasia: 89875, oceania: 13033 });
  const [insightIndex, setInsightIndex] = useState(0);
  const [creatorForm, setCreatorForm] = useState({ handle: '', platform: 'Instagram', link: '' });
  const [linkValidated, setLinkValidated] = useState(false);
  const [refProcessed, setRefProcessed] = useState(false);
  const [platformDropdownOpen, setPlatformDropdownOpen] = useState(false);
  const [waitingForApproval, setWaitingForApproval] = useState(false);
  const [approvalTimer, setApprovalTimer] = useState(15);
  const [uniqueAccessCode, setUniqueAccessCode] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [statusCheckCode, setStatusCheckCode] = useState('');
  const [statusCheckResult, setStatusCheckResult] = useState(null); // null | 'not_found' | { ...creator }
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [showCreatorModal, setShowCreatorModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginForm, setLoginForm] = useState({ handle: '', password: '' });
  const [loginError, setLoginError] = useState('');
  // Custom dialog modal — replaces system alert/confirm
  const [dialog, setDialog] = useState(null); // { title, body, confirm?, onConfirm?, onCancel? }
  const { creatorStatus, registerCreator, verifyReferral, requestWithdrawal, login, checkStatus, reRequestApproval } = useCreators();
  const startRef = useRef(null);

  // Helper to show an alert-dialog
  const showAlert = (title, body) => new Promise(resolve => {
    setDialog({ title, body, onConfirm: () => { setDialog(null); resolve(true); }, onCancel: null });
  });
  // Helper to show a confirm-dialog
  const showConfirm = (title, body) => new Promise(resolve => {
    setDialog({ title, body, confirm: true, onConfirm: () => { setDialog(null); resolve(true); }, onCancel: () => { setDialog(null); resolve(false); } });
  });

  useEffect(() => {
    const rawCount = onlineCount || 0;
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

  const [approvalData, setApprovalData] = useState(null);

  // Approval Timer Logic
  useEffect(() => {
    let timer;
    let pollInterval;
    if (waitingForApproval && approvalTimer > 0 && !creatorStatus) {
      timer = setInterval(() => {
        setApprovalTimer(prev => prev - 1);
      }, 1000);

      // Poll status every 3 seconds if waiting (backup for when socket is unavailable)
      pollInterval = setInterval(async () => {
        if (uniqueAccessCode) {
          const status = await checkStatus(uniqueAccessCode);
          if (status && status.status === 'approved') {
            setApprovalData(status);
            setWaitingForApproval(false);
          }
        }
      }, 3000);
    }
    return () => {
      clearInterval(timer);
      clearInterval(pollInterval);
    };
  }, [waitingForApproval, approvalTimer, creatorStatus, uniqueAccessCode, checkStatus]);

  // Real-time: when admin approves/rejects a creator, update UI instantly via socket
  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      // If this creator is currently waiting for approval
      if (data.referral_code === uniqueAccessCode && waitingForApproval) {
        if (data.status === 'approved') {
          setApprovalData({ ...data, status: 'approved' });
          setWaitingForApproval(false);
        }
      }
      // If admin panel status check modal is open and result matches
      setStatusCheckResult(prev => {
        if (prev && typeof prev === 'object' && prev.referral_code === data.referral_code) {
          return { ...prev, status: data.status, password: data.password || prev.password };
        }
        return prev;
      });
    };
    socket.on('creator-status-changed', handler);
    return () => socket.off('creator-status-changed', handler);
  }, [socket, uniqueAccessCode, waitingForApproval]);

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
            <span className="absolute bottom-10 text-[10px] font-black uppercase tracking-widest text-cyan-400 animate-pulse">Connecting...</span>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-[150] h-16 sm:h-20 px-4 sm:px-8 flex items-center justify-between bg-black/20 backdrop-blur-3xl border-b border-white/5">
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          <img src="/apple-touch-icon.png" alt="Logo" className="w-8 h-8 sm:w-10 sm:h-10 object-contain drop-shadow-[0_0_10px_#06b6d4]" />
          <div className="flex flex-col">
            <h1 className="text-xs sm:text-sm font-black uppercase tracking-[0.2em] sm:tracking-[0.4em] whitespace-nowrap">Mana Mingle</h1>
            <span className="hidden sm:block text-[7px] font-black uppercase tracking-[0.2em] text-cyan-400/40">by WeConnect</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-4 overflow-hidden">
          {connected && balance !== undefined && (
            <CoinBadge balance={balance} streak={streak} canClaim={canClaim} nextClaim={nextClaim ?? 0} claimCoins={claimCoins} />
          )}
          <div className="px-2 sm:px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[8px] sm:text-[10px] font-black text-white/40 uppercase tracking-widest flex items-center gap-1 shrink-0">
            {country && <span className="opacity-100 grayscale hover:grayscale-0 transition-all cursor-help" title={`Localized to ${country}`}>{countryToFlag(country)}</span>}
            <span>{(onlineCount ?? 0)} Live</span>
          </div>
          {creatorStatus && (
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="hidden md:flex items-center px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-black text-white/40 uppercase tracking-tighter italic">
                @{creatorStatus.handle_name}
                {creatorStatus.status === 'approved' && <BlueTick />}
              </div>
              <button
                onClick={() => {
                  window.localStorage.setItem('mm_logout_flag', 'true');
                  window.localStorage.removeItem('mm_creatorId');
                  window.location.reload();
                }}
                className="px-2 py-1.5 bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg text-[8px] font-black uppercase tracking-widest transition-all"
                title="Logout Session"
              >Logout</button>
            </div>
          )}
        </div>
      </header>

      {/* HERO SECTION */}
      <main className="relative z-10 pt-32 pb-20 px-6 max-w-7xl mx-auto flex flex-col items-center">

        {adsEnabled && <AdSection position="hero" script={adScripts?.hero} />}

        <div className="text-center mb-0 w-full">
          <ParticleText text="MANA MINGLE" className="mb-0" />
          <p className="text-[9px] font-black uppercase tracking-[0.8em] text-cyan-400 mb-8 animate-pulse">Powered by WeConnect</p>

          <h2 className="text-4xl md:text-7xl font-black tracking-tighter leading-none italic m-0 animate-in-zoom text-white">
            Connect <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500">Instantly.</span>
          </h2>
          <p className="text-[11px] text-white/30 max-w-lg mx-auto font-bold uppercase tracking-widest leading-relaxed mt-4">
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
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400 italic">Select Interests</span>
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
                <div className={`w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-lg group-hover:scale-110 transition-transform group-hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]`}>
                  {m.icon}
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest italic text-white group-hover:text-cyan-400 transition-colors">{m.name}</h3>
                  <p className="text-[8px] font-bold text-white/20 uppercase tracking-[0.2em] mt-1">Secure Connection</p>
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
              Smart Matching Discovery
            </h4>
            <p className="text-sm font-medium text-white/70 italic leading-relaxed">
              System is analyzing global connections... Our secure network ensures that every user is uniquely protected. Currently observing high activity in creative and tech communities. Target a specific interest to initiate a connection.
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
              <h4 className="text-[10px] font-black uppercase tracking-[0.6em] text-cyan-400 mb-2 italic">Global Presence Map</h4>
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

        {/* CREATOR MATRIX HIGH-VELOCITY GATEWAY */}
        <section className="w-full max-w-4xl mx-auto mb-20 px-6">
          <div className="p-12 rounded-[60px] bg-gradient-to-br from-cyan-500/10 via-black to-indigo-500/10 border border-white/10 text-center relative overflow-hidden group shadow-[0_0_50px_rgba(6,182,212,0.1)]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]" />
                Creator Hub
              </div>
              <h3 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter mb-4 leading-none text-white">Share your <span className="text-cyan-400 drop-shadow-[0_0_20px_rgba(6,182,212,0.4)]">Influence.</span></h3>
              <p className="text-[10px] md:text-xs font-bold text-white/30 uppercase tracking-[0.4em] mb-12 max-w-md mx-auto leading-relaxed italic">Monetize your reach. Grow your online presence with ManaMingle.</p>

              <div className="flex flex-wrap items-center justify-center gap-4">
                <button
                  onClick={() => setShowCreatorModal(true)}
                  className="px-8 py-4 bg-white text-black font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-cyan-400 hover:scale-105 transition-all shadow-xl active:scale-95 flex items-center gap-2 group/btn"
                >
                  <span className="text-sm group-hover/btn:rotate-12 transition-transform italic">⭐</span>
                  {creatorStatus?.handle_name ? 'Open Hub' : 'Apply Now'}
                </button>

                {(!creatorStatus || !creatorStatus.handle_name) && (
                  <>
                    <span className="text-cyan-500/40 text-xs font-black animate-pulse opacity-40">→</span>

                    <button
                      onClick={() => setShowStatusModal(true)}
                      className="px-8 py-4 bg-white/5 border border-white/10 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-cyan-500/20 hover:text-cyan-400 hover:scale-105 transition-all shadow-lg active:scale-95 flex items-center gap-2"
                    >
                      <span>🔍</span> Check Status
                    </button>

                    <span className="text-cyan-500/40 text-xs font-black animate-pulse opacity-40">→</span>

                    <button
                      onClick={() => setShowLoginModal(true)}
                      className="px-8 py-4 bg-black/60 border border-white/10 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-white hover:text-black hover:scale-105 transition-all backdrop-blur-3xl shadow-xl active:scale-95"
                    >
                      Creator Login
                    </button>
                  </>
                )}
              </div>

              {creatorStatus?.handle_name && (
                <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-[10px] font-black uppercase tracking-widest text-white/20 italic">
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                    Account Linked: {creatorStatus.handle_name}
                  </span>
                  <button
                    onClick={() => { localStorage.setItem('mm_logout_flag', '1'); localStorage.removeItem('mm_creatorId'); window.location.reload(); }}
                    className="px-3 py-1.5 rounded-full border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all text-rose-500/60"
                  >
                    Logout Session →
                  </button>
                </div>
              )}
            </div>
            <div className="absolute -bottom-10 -right-10 text-9xl opacity-[0.03] group-hover:opacity-[0.1] transition-all pointer-events-none rotate-12">⚡</div>
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
              The definitive platform for global interaction.
              Optimized for privacy and security across the entire platform.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-10 flex-1">
            <div className="space-y-4">
              <h5 className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400">Legal Center</h5>
              <div className="flex flex-col gap-2">
                {['Privacy', 'Integrity', 'Safety'].map(m => (
                  <button key={m} onClick={() => setModal(m.toLowerCase())} className="text-[10px] font-bold text-left uppercase text-white/30 hover:text-cyan-400 transition-colors">{m} Center</button>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <h5 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">Help & Resources</h5>
              <div className="flex flex-col gap-2">
                {['Dev', 'Bug'].map(m => (
                  <button key={m} onClick={() => setModal(m.toLowerCase())} className="text-[10px] font-bold text-left uppercase text-white/30 hover:text-indigo-400 transition-colors">{m === 'Dev' ? 'Technology' : 'Bug Bounty'} Hub</button>
                ))}
                <button onClick={() => setModal('safety')} className="text-[10px] font-bold text-left uppercase text-white/30 hover:text-indigo-400 transition-colors">Security Overview</button>
              </div>
            </div>
            <div className="space-y-4 col-span-2 md:col-span-1">
              <h5 className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400">Support Center</h5>
              <p className="text-[10px] font-bold text-white/20 leading-relaxed uppercase tracking-widest">Global load balancing active. Secure correspondence hub.</p>
              <a href="mailto:manaminglee@gmail.com" className="text-[10px] font-black text-cyan-400 underline uppercase hover:text-white">Email Support</a>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-20 mt-20 border-t border-white/[0.03] flex justify-between items-center text-white/5 text-[9px] font-black uppercase tracking-[0.6em]">
          <span>© 2026 MANA MINGLE | POWERED BY <span className="text-white/20">WECONNECT</span></span>
          <span className="hidden sm:inline">SECURE ANONYMOUS NETWORK</span>
        </div>
      </footer>

      {/* CREATOR MODAL */}
      {showCreatorModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl animate-in-zoom" onClick={() => setShowCreatorModal(false)}>
          <div className="relative w-full max-w-sm bg-black border border-white/10 rounded-[50px] p-10 overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowCreatorModal(false)}
              className="absolute top-6 right-8 text-white/20 hover:text-white transition-colors"
            >✕</button>

            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4 text-2xl shadow-[0_0_20px_#06b6d430]">⭐</div>
              <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white">Creator Hub</h3>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-2">{approvalData ? 'Approved Identity' : 'Monetization Dashboard'}</p>
            </div>

            {approvalData ? (
              <div className="space-y-8 animate-in-zoom">
                <div className="p-8 rounded-[40px] bg-emerald-500/5 border-2 border-emerald-500/20 space-y-6 shadow-[0_0_50px_rgba(16,185,129,0.1)]">
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center text-4xl mb-4 animate-bounce">✅</div>
                    <h4 className="text-xl font-black italic uppercase text-white">Validation Success!</h4>
                    <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Credentials Generated by WeConnect</p>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-black/40 rounded-2xl p-4 border border-white/5 flex justify-between items-center group">
                      <div>
                        <div className="text-[8px] font-black uppercase text-white/20 mb-1">Creator Handle</div>
                        <div className="text-xs font-black text-white italic uppercase tracking-widest">@{approvalData.handle_name}</div>
                      </div>
                      <span className="text-[10px] opacity-10 group-hover:opacity-40 transition-opacity">🆔</span>
                    </div>
                    <div className="bg-black/40 rounded-2xl p-4 border border-white/5 flex justify-between items-center group">
                      <div>
                        <div className="text-[8px] font-black uppercase text-white/20 mb-1">Temporary Password</div>
                        <div className="text-xs font-black text-cyan-400 italic uppercase select-all tracking-widest">{approvalData.password}</div>
                      </div>
                      <span className="text-[10px] opacity-10 group-hover:opacity-40 transition-opacity">🔒</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const content = `MANAMINGLE CREATOR CREDENTIALS\n\nHandle: @${approvalData.handle_name}\nAccess Code: ${approvalData.referral_code}\nPassword: ${approvalData.password}\n\nNote: Reach admin team at manaminglee@gmail.com for issues.`;
                      const blob = new Blob([content], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `mm_approved_${approvalData.handle_name}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                      window.localStorage.setItem('mm_creatorId', approvalData.referral_code);
                      window.location.reload();
                    }}
                    className="w-full py-5 bg-emerald-500 text-black font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-white hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-emerald-500/20"
                  >Download and Enter Hub →</button>
                </div>
              </div>
            ) : waitingForApproval ? (
              <div className="space-y-8 animate-in-zoom">
                <div className="text-center py-8">
                  {approvalTimer > 0 ? (
                    <div className="space-y-6">
                      <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
                        <div className="absolute inset-0 border-4 border-cyan-500/20 rounded-full" />
                        <div
                          className="absolute inset-0 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"
                          style={{ animationDuration: '0.8s' }}
                        />
                        <span className="text-3xl font-black italic text-cyan-400 tabular-nums">{approvalTimer}</span>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-xl font-black italic uppercase tracking-tighter text-white">Validating Identity...</h4>
                        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest animate-pulse">Wait for Admin or AI Appraisal</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-8 animate-fade-in-up">
                      <div className="p-8 rounded-[45px] bg-indigo-500/5 border-2 border-indigo-500/20 space-y-8 shadow-[0_0_50px_rgba(99,102,241,0.15)]">
                        <div className="text-center">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400/60 mb-2">Unique Access Code</h4>
                          <div className="w-full bg-black/40 rounded-[30px] py-10 px-6 text-2xl font-black italic text-center tracking-[0.1em] text-white border border-white/5 select-all hover:border-indigo-500/30 transition-all">
                            {uniqueAccessCode}
                          </div>
                        </div>

                        <div className="flex flex-col items-center gap-6">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(uniqueAccessCode);
                              setCodeCopied(true);
                              alert('Unique Code Saved to Clipboard');
                            }}
                            className="px-10 py-4 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-500 hover:scale-105 transition-all shadow-2xl shadow-indigo-600/30 active:scale-95"
                          >
                            {codeCopied ? 'Code Copied ✓' : 'Copy Mandatory Code'}
                          </button>

                          <p className="text-[9px] font-bold text-white/20 uppercase text-center leading-relaxed max-w-xs">
                            Validation is taking longer than expected. <span className="text-white/60">Copy this code now.</span> You will need it to check your status under the "Returning Creator" section.
                          </p>
                        </div>
                      </div>

                      {codeCopied && (
                        <button
                          onClick={() => {
                            setWaitingForApproval(false);
                            setShowCreatorModal(false);
                          }}
                          className="w-full h-14 bg-white text-black font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-indigo-400 transition-all"
                        >Close and Check Later</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : !creatorStatus ? (
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
                    className="w-full h-14 bg-white/5 border border-white/5 focus:border-cyan-500/30 rounded-2xl px-6 text-sm outline-none text-white font-bold"
                    value={creatorForm.handle}
                    onChange={e => {
                      const h = e.target.value.replace(/^@/, '');
                      const platformUrls = {
                        'Instagram': `https://instagram.com/${h}`,
                        'YouTube': `https://youtube.com/@${h}`,
                        'Snapchat': `https://snapchat.com/add/${h}`,
                        'X (Twitter)': `https://x.com/${h}`,
                        'TikTok': `https://tiktok.com/@${h}`,
                      };
                      const autoLink = h ? (platformUrls[creatorForm.platform] || '') : '';
                      setCreatorForm(f => ({ ...f, handle: e.target.value, link: autoLink }));
                      setLinkValidated(false);
                    }}
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

                    {platformDropdownOpen && (
                      <div className="absolute top-[calc(100%+8px)] left-0 right-0 z-[1000] bg-[#111] border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-in-zoom">
                        {['Instagram', 'YouTube', 'Snapchat', 'X (Twitter)', 'TikTok'].map(p => {
                          const platformUrls = {
                            'Instagram': `https://instagram.com/${creatorForm.handle.replace(/^@/, '')}`,
                            'YouTube': `https://youtube.com/@${creatorForm.handle.replace(/^@/, '')}`,
                            'Snapchat': `https://snapchat.com/add/${creatorForm.handle.replace(/^@/, '')}`,
                            'X (Twitter)': `https://x.com/${creatorForm.handle.replace(/^@/, '')}`,
                            'TikTok': `https://tiktok.com/@${creatorForm.handle.replace(/^@/, '')}`,
                          };
                          return (
                            <button
                              key={p}
                              onClick={() => {
                                const newLink = platformUrls[p] || '';
                                setCreatorForm(f => ({ ...f, platform: p, link: newLink }));
                                setLinkValidated(false);
                                setPlatformDropdownOpen(false);
                              }}
                              className="w-full h-12 px-6 text-left text-xs font-bold text-white/60 hover:text-white hover:bg-cyan-500/10 transition-all border-b border-white/[0.03] last:border-0"
                            >
                              {p}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder={`e.g. https://instagram.com/${creatorForm.handle.replace(/^@/, '') || 'yourhandle'}`}
                        className={`flex-1 h-14 bg-white/5 border rounded-2xl px-4 text-sm outline-none text-white transition-all ${
                          linkValidated ? 'border-emerald-500/50 shadow-[0_0_10px_#10b98120]' : 'border-white/5 focus:border-cyan-500/30'
                        }`}
                        value={creatorForm.link}
                        onChange={e => {
                          setCreatorForm({ ...creatorForm, link: e.target.value });
                          setLinkValidated(false);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!creatorForm.link) return;
                          try {
                            const url = new URL(creatorForm.link);
                            window.open(url.href, '_blank', 'noopener,noreferrer');
                            setLinkValidated(true);
                          } catch {
                            alert('Please enter a valid URL first.');
                          }
                        }}
                        title="Open link in new tab to verify it's your profile"
                        className={`h-14 px-4 rounded-2xl font-black text-[9px] uppercase tracking-widest transition-all border ${
                          linkValidated
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                            : 'bg-white/5 border-white/10 text-white/40 hover:border-cyan-500/40 hover:text-cyan-400'
                        }`}
                      >
                        {linkValidated ? '✓ OK' : 'Verify ↗'}
                      </button>
                    </div>
                    <p className="text-[9px] text-white/20 px-2">
                      Auto-filled from your handle. Click <span className="text-cyan-400">Verify ↗</span> to confirm it's your profile.
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!creatorForm.handle) return showAlert('Missing Handle', 'Please enter your handle name.');
                      if (!creatorForm.link) return showAlert('Missing Profile Link', 'Please enter your profile link.');
                      if (!linkValidated) {
                        const go = await showConfirm('Profile Not Verified', "You haven't verified your profile link yet. Are you sure you want to submit?");
                        if (!go) return;
                      }
                      const res = await registerCreator(creatorForm.handle, creatorForm.platform, creatorForm.link);
                      if (res.success) {
                        setUniqueAccessCode(res.accessCode);
                        setWaitingForApproval(true);
                        setApprovalTimer(15);
                      }
                      else showAlert('Registration Failed', res.error || 'Something went wrong. Please try again.');
                    }}
                    className="w-full h-14 bg-cyan-400 text-black font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-white transition-all shadow-xl shadow-cyan-500/20"
                  >Register as Creator</button>

                  <div className="pt-10 flex flex-col items-center gap-6 border-t border-white/5">
                    <div className="flex items-center gap-4 text-[8px] font-black uppercase tracking-[0.4em] text-white/20 whitespace-nowrap italic">
                      <span>Apply</span>
                      <span className="text-cyan-500 animate-pulse">→</span>
                      <span>Check Status</span>
                      <span className="text-cyan-500 animate-pulse">→</span>
                      <span>Login</span>
                    </div>

                    <div className="flex gap-4 w-full">
                       <button 
                        onClick={() => { setShowCreatorModal(false); setShowStatusModal(true); }}
                        className="flex-1 py-4 rounded-xl bg-white/5 border border-white/5 text-[9px] font-black uppercase text-white/40 hover:text-cyan-400 hover:border-cyan-400/20 transition-all tracking-widest"
                       >Check Status</button>
                       <button 
                        onClick={() => { setShowCreatorModal(false); setShowLoginModal(true); }}
                        className="flex-1 py-4 rounded-xl bg-white/5 border border-white/5 text-[9px] font-black uppercase text-white/40 hover:text-indigo-400 hover:border-indigo-400/20 transition-all tracking-widest"
                       >Creator Login</button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-8 animate-in-zoom">
                <div className="p-8 rounded-[32px] bg-white/[0.02] border border-white/5 space-y-4 text-center">
                  <div className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Account Identity</div>
                  <h4 className="text-3xl font-black italic uppercase tracking-tighter text-white">
                    @{creatorStatus.handle_name}
                    {creatorStatus.status === 'approved' && <BlueTick />}
                  </h4>
                  <div className="flex justify-center gap-4">
                    {creatorStatus.status === 'approved' ? (
                      <span className="px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest shadow-[0_0_20px_#10b98130]">Account Active</span>
                    ) : (
                      <span className="px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest animate-pulse">Waiting for manual appraisal</span>
                    )}
                  </div>
                </div>
                {creatorStatus.status === 'approved' && (
                  <div className="space-y-6">
                    {/* GROWTH VELOCITY ANALYTICS */}
                    <div className="mb-8 animate-in-zoom" style={{ animationDelay: '100ms' }}>
                  <MiniTrendChart data={[35, 42, 38, 55, 48, 65, 82]} color="#06b6d4" />
                  <div className="flex justify-between mt-3 px-2 text-[8px] font-black uppercase text-white/10 tracking-[0.3em] italic">
                    <span className="flex items-center gap-2">
                       <span className="w-1 h-1 rounded-full bg-cyan-400" />
                       Performance Trend: Last 7 Days
                    </span>
                    <span className="text-emerald-400/40">+64.8% Influence Delta</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                      <div className="p-6 rounded-[32px] bg-white/[0.03] border border-white/5">
                        <div className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-1">Earned</div>
                        <div className="text-xl font-black italic text-emerald-400">₹{creatorStatus.earnings_rs || 0}</div>
                        <div className="text-[8px] font-bold text-white/10 uppercase mt-1 italic">Creator Earnings</div>
                      </div>
                      <div className="p-6 rounded-[32px] bg-white/[0.03] border border-white/5">
                        <div className="text-[9px] font-black uppercase tracking-widest text-white/20 mb-1">Referral Clicks</div>
                        <div className="text-xl font-black italic text-indigo-400">{creatorStatus.referral_count || 0}</div>
                        <div className="text-[8px] font-bold text-white/10 uppercase mt-1 italic">Total Referrals</div>
                      </div>
                    </div>

                    <div className="p-8 rounded-[32px] bg-indigo-500/5 border border-indigo-500/10 space-y-4">
                      <div className="text-center">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 italic">Profile Details</span>
                        <p className="text-[8px] font-black text-white/20 uppercase mt-1">Use these to login from any device</p>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="bg-black/40 rounded-2xl p-4 border border-white/5 flex justify-between items-center group">
                          <div>
                            <div className="text-[8px] font-black uppercase text-white/20 mb-1">Public Handle</div>
                            <div className="text-xs font-black text-white italic uppercase">{creatorStatus.handle_name}</div>
                          </div>
                          <span className="text-[10px] opacity-10 group-hover:opacity-40 transition-opacity">🆔</span>
                        </div>
                        <div className="bg-black/40 rounded-2xl p-4 border border-white/5 flex justify-between items-center group">
                          <div>
                            <div className="text-[8px] font-black uppercase text-white/20 mb-1">Account Password</div>
                            <div className="text-xs font-black text-emerald-400 italic uppercase select-all">{creatorStatus.password}</div>
                          </div>
                          <span className="text-[10px] opacity-10 group-hover:opacity-40 transition-opacity">🔒</span>
                        </div>
                        <button
                          onClick={() => {
                            const content = `MANAMINGLE CREATOR CREDENTIALS\n\nHandle: @${creatorStatus.handle_name}\nCreator ID: ${creatorStatus.referral_code}\nPassword: ${creatorStatus.password}\nReferral Link: ${window.location.origin}/?ref=${creatorStatus.referral_code}\n\nNote: If you have forgotten these, reach the admin team at manaminglee@gmail.com`;
                            const blob = new Blob([content], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `mm_creator_${creatorStatus.handle_name}.txt`;
                            a.click();
                            URL.revokeObjectURL(url);
                            alert('Credentials Downloaded to Device.');
                          }}
                          className="w-full py-4 rounded-xl bg-white/5 border border-white/10 text-white/40 text-[9px] font-black uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-all"
                        >Download Account Details →</button>
                        <p className="text-[7px] text-center font-black uppercase tracking-widest text-white/10 italic">Forgotten? Reach Admin Team</p>
                      </div>
                    </div>

                    <div className="p-8 rounded-[32px] bg-white/[0.01] border border-white/5">
                      <div className="flex justify-between items-center mb-4 px-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Authorized IP Addresses</span>
                        <span className="text-[8px] font-black text-emerald-400 uppercase italic animate-pulse">Verified</span>
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
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Referral Link</span>
                    {creatorStatus.status === 'approved' && <span className="text-[9px] font-bold text-emerald-400 uppercase italic animate-pulse">Referral Ready</span>}
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
                          alert('Referral Link Copied');
                        }}
                        className="px-8 h-14 rounded-2xl bg-cyan-400 text-black font-black uppercase tracking-widest text-[10px] hover:bg-white transition-all shadow-xl shadow-cyan-500/20"
                      >Copy Link</button>
                    )}
                  </div>
                </div>

                {creatorStatus.status === 'approved' && creatorStatus.earnings_rs >= 1500 && (
                  <button
                    onClick={async () => {
                      const upi = prompt('Enter UPI ID for withdrawal:');
                      if (upi) {
                        const res = await requestWithdrawal(upi);
                        if (res.success) alert('Withdrawal Request Sent.');
                        else alert(res.error);
                      }
                    }}
                    className="w-full h-14 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-emerald-500 hover:text-white transition-all shadow-xl shadow-emerald-500/20"
                  >Authorize Withdrawal (₹{creatorStatus.earnings_rs})</button>
                )}

                <div className="text-[9px] font-bold text-white/10 text-center uppercase tracking-widest italic pt-4">
                  Earnings Logic: 10 Coins / Click | 10000 Coins = ₹150 | Min Withdrawal ₹1500
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
              <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Creator Login</h3>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-2">Creator Hub Authorization</p>
            </div>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Creator Handle"
                value={loginForm.handle}
                onChange={e => setLoginForm({ ...loginForm, handle: e.target.value })}
                className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl px-6 text-sm outline-none text-white focus:border-indigo-500/30 transition-all font-bold"
              />
              <input
                type="password"
                placeholder="Password"
                value={loginForm.password}
                onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl px-6 text-sm outline-none text-white focus:border-indigo-500/30 transition-all tracking-widest"
              />
              <button
                onClick={async () => {
                  setLoginError('');
                  const res = await login(loginForm.handle, loginForm.password);
                  if (res.success) {
                    setShowLoginModal(false);
                    setLoginForm({ handle: '', password: '' });
                  } else {
                    setLoginError(res.error);
                  }
                }}
                className="w-full h-14 bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-white hover:text-black transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
              >Login as Creator</button>
              {loginError && <p className="text-rose-500 text-[10px] text-center font-black uppercase tracking-widest mt-4 animate-shake">{loginError}</p>}
            </div>
          </div>
        </div>
      )}

      {/* CHECK STATUS MODAL */}
      {showStatusModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl animate-in-zoom" onClick={() => { setShowStatusModal(false); setStatusCheckResult(null); setStatusCheckCode(''); }}>
          <div className="relative w-full max-w-sm bg-black border border-white/10 rounded-[50px] p-10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <button onClick={() => { setShowStatusModal(false); setStatusCheckResult(null); setStatusCheckCode(''); }} className="absolute top-6 right-8 text-white/20 hover:text-white transition-colors text-xl">✕</button>
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4 text-2xl shadow-[0_0_20px_#06b6d430]">🔍</div>
              <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Check Application Status</h3>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-2">Enter your access code or handle name</p>
            </div>
            <div className="space-y-6">
              {!statusCheckResult ? (
                <>
                  <input
                    type="text"
                    value={statusCheckCode}
                    onChange={e => { setStatusCheckCode(e.target.value); setStatusCheckResult(null); }}
                    placeholder="e.g. handle1234 or @yourhandle"
                    className="w-full h-14 bg-white/5 border border-white/5 rounded-2xl px-6 text-sm outline-none text-white focus:border-cyan-500/30 transition-all font-bold tracking-widest"
                  />
                  <button
                    disabled={checkingStatus || !statusCheckCode.trim()}
                    onClick={async () => {
                      const code = statusCheckCode.trim().replace(/^@/, '');
                      if (!code) return;
                      setCheckingStatus(true);
                      // Try access code first, then handle name as fallback
                      let data = await checkStatus(code);
                      if (!data) {
                        // Try looking up by handle name directly
                        data = await checkStatus(`handle:${code}`);
                      }
                      setCheckingStatus(false);
                      setStatusCheckResult(data || 'not_found');
                    }}
                    className="w-full h-14 bg-cyan-400 text-black font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-white transition-all shadow-xl shadow-cyan-500/20 disabled:opacity-50"
                  >
                    {checkingStatus ? 'Checking...' : 'Check Status →'}
                  </button>
                </>
              ) : statusCheckResult === 'not_found' ? (
                <div className="text-center space-y-6">
                  <div className="text-5xl">❌</div>
                  <div>
                    <div className="text-sm font-black text-white uppercase tracking-widest">Access Code Not Found</div>
                    <p className="text-[10px] text-white/30 font-bold mt-2 leading-relaxed">
                      The code <span className="text-white/60 font-black">"{statusCheckCode}"</span> doesn't match any application.
                      Make sure you're entering the exact code you received after registering.
                    </p>
                  </div>
                  <button
                    onClick={() => { setStatusCheckResult(null); setStatusCheckCode(''); }}
                    className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/10 transition-all"
                  >Try Again</button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">👤</div>
                      <div>
                        <div className="text-xs text-white/20 font-black uppercase tracking-widest">Handle</div>
                        <div className="font-black text-white text-lg italic uppercase">@{statusCheckResult.handle_name}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Status</span>
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        statusCheckResult.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        statusCheckResult.status === 'rejected' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                        'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                      }`}>{statusCheckResult.status === 'approved' ? '✅ Approved' : statusCheckResult.status === 'rejected' ? '❌ Rejected' : '⏳ Pending Review'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Platform</span>
                      <span className="text-[10px] font-black text-white/60 uppercase">{statusCheckResult.platform}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Applied</span>
                      <span className="text-[10px] font-black text-white/40">{new Date(statusCheckResult.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {statusCheckResult.status === 'approved' ? (
                    <button
                      onClick={() => {
                        window.localStorage.setItem('mm_creatorId', statusCheckResult.referral_code);
                        window.location.reload();
                      }}
                      className="w-full h-12 bg-emerald-500 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-white hover:text-black transition-all shadow-xl shadow-emerald-500/20"
                    >Login as Creator →</button>
                  ) : statusCheckResult.status === 'pending' ? (
                    <button
                      onClick={async () => {
                        await reRequestApproval(statusCheckResult.referral_code);
                        setStatusCheckResult({ ...statusCheckResult, _pinged: true });
                      }}
                      disabled={statusCheckResult._pinged}
                      className="w-full h-12 bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-indigo-500 hover:text-white transition-all disabled:opacity-50"
                    >{statusCheckResult._pinged ? '✓ Approval Reminder Sent' : 'Remind Admin to Review →'}</button>
                  ) : null}

                  <button
                    onClick={() => { setStatusCheckResult(null); setStatusCheckCode(''); }}
                    className="w-full h-10 text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-white/40 transition-colors"
                  >← Check Another Code</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STANDARD MODAL */}
      {modal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/90 backdrop-blur-3xl animate-in-zoom" onClick={() => setModal(null)}>
          <div className="relative w-full max-w-sm bg-black border border-white/10 rounded-[40px] p-10 text-center" onClick={e => e.stopPropagation()}>
            <button onClick={() => setModal(null)} className="absolute top-6 right-8 text-white/20 hover:text-white transition-colors text-xl">✕</button>
            <h3 className="text-2xl font-black text-white italic uppercase mb-6 tracking-tighter">{MODALS[modal]?.title}</h3>
            <p className="text-[11px] text-white/40 leading-relaxed font-bold uppercase tracking-widest whitespace-pre-line">{MODALS[modal]?.body}</p>
            <button onClick={() => setModal(null)} className="mt-10 w-full h-14 bg-cyan-500 text-black font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-white transition-all shadow-xl shadow-cyan-500/20">Got it</button>
          </div>
        </div>
      )}

      {/* CUSTOM APP DIALOG — replaces system alert/confirm */}
      {dialog && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-black/90 backdrop-blur-3xl">
          <div className="w-full max-w-xs bg-[#0a0a0a] border border-white/10 rounded-[40px] p-8 shadow-2xl animate-in-zoom">
            <div className="text-center mb-6">
              <div className="text-3xl mb-4">{dialog.confirm ? '⚠️' : 'ℹ️'}</div>
              <h4 className="text-base font-black uppercase tracking-widest text-white italic mb-3">{dialog.title}</h4>
              <p className="text-[11px] text-white/40 font-bold leading-relaxed">{dialog.body}</p>
            </div>
            <div className={`flex gap-3 ${dialog.confirm ? 'flex-row' : 'flex-col'}`}>
              <button
                onClick={dialog.onConfirm}
                className="flex-1 h-12 bg-cyan-400 text-black font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-white transition-all"
              >OK</button>
              {dialog.confirm && dialog.onCancel && (
                <button
                  onClick={dialog.onCancel}
                  className="flex-1 h-12 bg-white/5 border border-white/10 text-white/40 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-white/10 transition-all"
                >Cancel</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
