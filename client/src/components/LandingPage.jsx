import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useLatency } from '../hooks/useLatency';
import { CoinBadge } from './CoinBadge';

const INTERESTS = [
  { id: 'telugu', label: 'Telugu', desc: 'Connect with Telugu speakers' },
  { id: 'music', label: 'Music', desc: 'Share your favorite tunes' },
  { id: 'gaming', label: 'Gaming', desc: 'Find your next squad' },
  { id: 'movies', label: 'Movies', desc: 'Discuss your favorite films' },
  { id: 'sports', label: 'Sports', desc: 'Talk about recent games' },
  { id: 'chat', label: 'Random', desc: 'Friendly random chat' },
];

const MODALS = {
  privacy: {
    title: '🔒 Privacy Policy',
    body: `Mana Mingle is built on anonymity and privacy.\n\n• Zero data collection — no names, no emails, no phone numbers ever stored.\n• Conversations are ephemeral — when you leave, everything disappears.\n• IP addresses are temporarily logged only for rate limiting and abuse prevention, never sold.\n• We use end - to - end encrypted WebRTC streams for video — not even we can see your video.\n• Session data is in -memory only, wiped on disconnect.\n• No cookies, no tracking pixels, no fingerprinting.`,
  },
  terms: {
    title: '📋 Terms of Service',
    body: `By using Mana Mingle you agree to: \n\n• Be 18 years of age or older.\n• Not harass, threaten, or demean other users.\n• Not share illegal content, hate speech, or explicit material.\n• Accept that repeated violations result in IP bans.\n• Use the platform as- is — we provide no warranties.\n• Not attempt to deanonymize other users.\n• Not use bots, scripts, or automated tools.`,
  },
  guidelines: {
    title: '🤝 Community Guidelines',
    body: `Keep it respectful: \n\n✅ Do: \n• Treat strangers with kindness\n• Report bad behaviour\n• Be genuine and authentic\n• Use the Skip feature if you're uncomfortable\n\n❌ Don't: \n• Share nudity or explicit material\n• Ask for personal information\n• Bully or harass\n• Share harmful or illegal content\n• Use slurs or hate speech\n\nViolations = permanent ban.`,
  },
  monitoring: {
    title: '👀 Monitoring Policy',
    body: `Your safety is priority #1: \n\n• All sessions are monitored by automated AI systems 24 / 7.\n• Video streams undergo real - time nudity and violence detection.\n• Flagged content triggers immediate review.\n• Reported users are reviewed within minutes.\n• We cooperate fully with law enforcement upon valid legal request.\n• Monitoring data is not stored after sessions end.`,
  },
  safety: {
    title: '🛡️ Safety Features',
    body: `Built -in safety for every session: \n\n• One - click Report button on every chat and video stream.\n• Skip / Next button to instantly leave any uncomfortable chat.\n• AI nudity and violence detection on video streams.\n• Rate limiting prevents spam and bots.\n• No account required — no data to steal or compromise.\n• Country info shown(optional) for context — never exact location.\n• HTTPS + WSS encrypted connections at all times.`,
  },
  laws: {
    title: '⚖️ Legal & Compliance',
    body: `Mana Mingle complies with applicable laws: \n\n• Users must follow local, national, and international laws.\n• Minors(under 18) are strictly prohibited.\n• We cooperate with valid law enforcement requests.\n• Content violating CSAM laws is reported immediately to NCMEC.\n• Certain jurisdictions may restrict access to this service.\n• By using Mana Mingle, you represent you are legally permitted to do so.`,
  },
};

export function LandingPage({ onJoin, connected, onlineCount = 0, coinState, isJoining = false }) {
  const { balance, streak, canClaim, nextClaim, claimCoins } = coinState || {};
  const [interests, setInterests] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const latency = useLatency();
  const [modal, setModal] = useState(null);
  const [particles, setParticles] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestedInterests, setSuggestedInterests] = useState([]);
  const startRef = useRef(null);

  useEffect(() => {
    const pts = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 2.5,
      opacity: 0.1 + Math.random() * 0.3,
      delay: Math.random() * 6,
      duration: 4 + Math.random() * 5,
    }));
    setParticles(pts);
  }, []);

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

  const scrollToStart = () => startRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="min-h-screen bg-[#070811] text-white relative overflow-x-hidden">
      {/* Particle background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full bg-indigo-400"
            style={{
              left: `${p.x}% `,
              top: `${p.y}% `,
              width: p.size,
              height: p.size,
              opacity: p.opacity,
              animation: `pulse ${p.duration}s ease -in -out ${p.delay}s infinite alternate`,
            }}
          />
        ))}
        <div className="hero-glow hero-glow-1" />
        <div className="hero-glow hero-glow-2" />
        {/* Grid lines */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* HEADER */}
      <header className="app-header relative z-50">
        <div className="logo-mark">
          <div className="logo-icon">M</div>
          <span className="font-bold text-lg tracking-tight">Mana Mingle</span>
          <span className="text-xs font-medium text-realm-muted ml-1 pt-0.5">WeConnect</span>
        </div>
        <div className="flex items-center gap-3">
          {connected ? (
            <>
              {balance !== undefined && (
                <CoinBadge balance={balance} streak={streak} canClaim={canClaim} nextClaim={nextClaim ?? 0} claimCoins={claimCoins} />
              )}
              <div className="hidden md:flex px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black text-emerald-400 uppercase tracking-widest gap-1.5 items-center">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {latency}ms
              </div>
              <div className="online-pill">
                <div className="live-dot" style={{ width: 7, height: 7 }} />
                <span>{onlineCount.toLocaleString()} online</span>
              </div>
            </>
          ) : (
            <div className="connecting-pill">
              <div className="search-dots" style={{ transform: 'scale(0.7)' }}>
                <span /><span /><span />
              </div>
              <span>Connecting</span>
            </div>
          )}
          <div className="anon-badge">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            100% Anonymous
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-10 pb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 text-indigo-300 text-xs font-semibold mb-5 animate-fade-in-up shadow-lg shadow-indigo-500/5 hover:border-indigo-500/40 transition-all cursor-default">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-500"></span>
          </span>
          No Accounts. No Tracking. Pure Social Discovery.
        </div>

        <h1 className="text-4xl md:text-5xl font-black leading-[1.15] tracking-tight mb-4 animate-fade-in-up delay-100">
          <span className="text-white">Mana Mingle:</span>
          <br />
          <span className="gradient-text drop-shadow-[0_0_30px_rgba(99,102,241,0.2)]">Connect Instantly</span>
        </h1>

        <p className="text-base md:text-lg max-w-2xl mx-auto mb-5 animate-fade-in-up delay-200 leading-relaxed font-medium" style={{ color: 'rgba(232,234,246,0.55)' }}>
          The world's most advanced anonymous social platform. Experience high-speed
          <span className="text-indigo-400 font-bold px-1.5">Text & Video</span>
          conversations with 100% privacy by default.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 animate-fade-in-up delay-300 mb-6">
          <button
            id="hero-start-btn"
            onClick={scrollToStart}
            className="btn btn-primary px-6 py-3 text-base rounded-xl w-full sm:w-auto shadow-xl shadow-indigo-600/20 group hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Start Chatting <span className="ml-2 group-hover:translate-x-1 transition-transform inline-block">→</span>
          </button>
          <button
            id="hero-howit-btn"
            onClick={() => setModal('safety')}
            className="btn btn-ghost px-6 py-3 text-base rounded-xl w-full sm:w-auto border border-white/5 hover:bg-white/5 transition-all"
          >
            Safety First
          </button>
        </div>

      </section>

      <div className="section-divider" />

      {/* CHOOSE MODE SECTION */}
      <section ref={startRef} className="relative z-10 max-w-7xl mx-auto px-6 py-6 scroll-mt-20">
        <div className="text-center mb-6 max-w-2xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight">Select Your Experience</h2>
          <p className="text-lg leading-relaxed" style={{ color: 'rgba(232,234,246,0.45)' }}>
            Jump into a private conversation instantly. Our WeConnect technology handles the
            heavy lifting of security and speed.
          </p>
        </div>

        <div className="interests-container animate-fade-in-up delay-400">
          <h4>Match by Interest <span className="font-normal opacity-50 ml-1">(Optional)</span></h4>
          <div className="interest-tags-wrap">
            {INTERESTS.filter(r => !interests.find(i => i.id === r.id)).map((r) => (
              <button
                key={r.id}
                type="button"
                id={`interest-${r.id}`}
                onClick={() => addInterest(r.id)}
                className="interest-tag"
              >
                <span>{r.label}</span>
              </button>
            ))}
          </div>
          <div className="custom-interest-box flex items-center flex-wrap gap-2">
            {interests.map((i) => (
              <div key={i.id} className="flex items-center gap-2 bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-lg text-sm font-medium border border-indigo-500/30">
                {i.label}
                <button
                  onClick={() => removeInterest(i.id)}
                  className="hover:text-white opacity-70 hover:opacity-100 transition-opacity flex items-center justify-center p-0.5"
                  title="Remove"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            <input
              id="custom-interest-input"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={interests.length === 0 ? "Type a topic and press Enter..." : "Add another..."}
              maxLength={30}
              className="flex-1 min-w-[150px] bg-transparent border-none outline-none text-white focus:ring-0 p-1 m-0"
              style={{ boxShadow: 'none' }}
            />
          </div>
        </div>

        {/* AI Suggestions */}
        <div className="flex flex-wrap items-center gap-2 mb-8 min-h-[32px]">
          <button
            onClick={getAiSuggestions}
            disabled={isSuggesting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all text-[10px] font-bold uppercase tracking-wider ${isSuggesting ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400 cursor-wait' : 'bg-white/5 border-white/10 text-white/30 hover:border-indigo-500/40 hover:text-indigo-400 hover:bg-indigo-500/10'}`}
          >
            <svg className={`w-3 h-3 ${isSuggesting ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {isSuggesting ? 'Thinking...' : 'AI Suggestions'}
          </button>
          {suggestedInterests.map((s, idx) => (
            <button
              key={idx}
              onClick={() => addInterest(s)}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-white/50 hover:bg-white/10 hover:border-white/20 transition-all animate-fade-in"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              #{s}
            </button>
          ))}
        </div>

        {/* Mode cards grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* TEXT CHAT */}
          <div className="mode-card group animate-fade-in-up delay-100">
            <div className="icon-wrap" style={{ background: 'rgba(99,102,241,0.15)', borderColor: 'rgba(99,102,241,0.25)' }}>
              💬
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Text Chat</h3>
            <p className="text-sm mb-5" style={{ color: 'rgba(232,234,246,0.5)' }}>
              1-on-1 anonymous text with instant random strangers.
            </p>
            <button
              id="start-text-btn"
              disabled={!connected || isJoining}
              onClick={() => onJoin(getInterest(), 'Anonymous', 'text')}
              className="btn btn-primary w-full py-3 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isJoining ? '...' : 'Start →'}
            </button>
          </div>

          {/* VIDEO CHAT */}
          <div className="mode-card group animate-fade-in-up delay-200">
            <div className="icon-wrap" style={{ background: 'rgba(20,184,166,0.15)', borderColor: 'rgba(20,184,166,0.25)' }}>
              📹
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Video Chat</h3>
            <p className="text-sm mb-5" style={{ color: 'rgba(232,234,246,0.5)' }}>
              Face-to-face video with encrypted WebRTC streams.
            </p>
            <button
              id="start-video-btn"
              disabled={!connected || isJoining}
              onClick={() => onJoin(getInterest(), 'Anonymous', 'video')}
              className="btn btn-teal w-full py-3 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isJoining ? '...' : 'Start →'}
            </button>
          </div>

          {/* GROUP TEXT */}
          <div className="mode-card group animate-fade-in-up delay-300">
            <div className="icon-wrap" style={{ background: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.25)' }}>
              👥
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Group Text</h3>
            <p className="text-sm mb-5" style={{ color: 'rgba(232,234,246,0.5)' }}>
              Join a group of up to 4 strangers for text conversation.
            </p>
            <button
              id="start-group-text-btn"
              disabled={!connected || isJoining}
              onClick={() => onJoin(getInterest(), 'Anonymous', 'group_text')}
              className="btn btn-amber w-full py-3 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isJoining ? '...' : 'Join →'}
            </button>
          </div>

          {/* GROUP VIDEO */}
          <div className="mode-card group animate-fade-in-up delay-400">
            <div className="icon-wrap" style={{ background: 'rgba(244,63,94,0.15)', borderColor: 'rgba(244,63,94,0.25)' }}>
              🎥
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Group Video</h3>
            <p className="text-sm mb-5" style={{ color: 'rgba(232,234,246,0.5)' }}>
              Video conference with up to 4 anonymous strangers.
            </p>
            <button
              id="start-group-video-btn"
              disabled={!connected || isJoining}
              onClick={() => onJoin(getInterest(), 'Anonymous', 'group_video')}
              className="btn btn-danger w-full py-3 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isJoining ? '...' : 'Join →'}
            </button>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* HOW IT WORKS */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row items-end justify-between mb-10 gap-6">
          <div className="max-w-xl text-left">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4">Simple. Fast. Private.</h2>
            <p className="text-lg" style={{ color: 'rgba(232,234,246,0.45)' }}>Getting started takes less than 10 seconds.</p>
          </div>
          <div className="hidden md:block h-px flex-grow bg-white/[0.04] mb-4 mx-8" />
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Set Your Vibe', desc: 'Choose a specific interest like Telugu or Gaming to find people who share your passions.', icon: '🎯' },
            { step: '02', title: 'Pick a Interface', desc: 'Go for traditional Text or immersive Video. Join a group or stay 1-on-1 — you decide.', icon: '🧩' },
            { step: '03', title: 'Connect Securely', desc: 'Our AI-powered safety layer works in the background while you enjoy direct connections.', icon: '⚡' },
          ].map((item) => (
            <div key={item.step} className="feature-card group !bg-white/[0.01]">
              <div className="flex items-center justify-between mb-8">
                <span className="text-5xl font-black opacity-10 group-hover:opacity-20 transition-opacity italic">{item.step}</span>
                <span className="text-4xl group-hover:scale-125 transition-transform duration-500 marquee-icon">{item.icon}</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
              <p className="text-base leading-relaxed" style={{ color: 'rgba(232,234,246,0.4)' }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      {/* WHY MANA MINGLE / FEATURES */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-12 max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6">Why Mana Mingle?</h2>
          <p className="text-lg leading-relaxed" style={{ color: 'rgba(232,234,246,0.45)' }}>
            We've combined state-of-the-art WebRTC technology with a commitment to
            absolute privacy to build the next generation of social discovery.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {[
            { icon: '🔒', title: 'Ephemeral Identity', desc: 'Your session token is generated randomly and deleted the moment you close the tab. No traces left behind.' },
            { icon: '🛡️', title: 'Direct End-to-End', desc: 'Video streams are peer-to-peer. We provide the handshake, but your conversation stays between you and your partner.' },
            { icon: '🤖', title: 'AI-First Safety', desc: 'Our proprietary vision AI detects harmful content in real-time to keep the community welcoming for everyone.' },
            { icon: '🌐', title: 'Global Grid', desc: 'Access an international network of users. Mana Mingle is optimized for low-latency connections worldwide.' },
          ].map((f) => (
            <div key={f.title} className="feature-card flex flex-col md:flex-row items-start gap-6 !p-8">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-2xl flex-shrink-0 group-hover:bg-indigo-500/10 transition-colors">
                {f.icon}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-2">{f.title}</h3>
                <p className="text-base leading-relaxed" style={{ color: 'rgba(232,234,246,0.4)' }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer-v2">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 items-start mb-12">

            {/* Column 1: Brand */}
            <div className="flex flex-col gap-4">
              <div className="logo-mark">
                <div className="logo-icon">M</div>
                <span className="font-bold text-xl tracking-tight">Mana Mingle</span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(232,234,246,0.45)' }}>
                Powered by WeConnect technology. The premier destination for safe, 100% anonymous global conversations.
              </p>
              <div className="flex items-center gap-3">
                <div className="online-pill" style={{ opacity: 0.8 }}>
                  <div className="live-dot" style={{ width: 6, height: 6 }} />
                  <span>{onlineCount.toLocaleString()} Experts Online</span>
                </div>
              </div>
            </div>

            {/* Column 2: Quick Links */}
            <div className="flex flex-col gap-4">
              <h5 className="text-xs font-bold uppercase tracking-widest text-indigo-400">Legal & Contact</h5>
              <div className="grid grid-cols-1 gap-3">
                {Object.entries(MODALS).map(([key, m]) => (
                  <button
                    key={key}
                    onClick={() => setModal(key)}
                    className="text-sm text-left hover:text-indigo-300 transition-colors w-fit"
                    style={{ color: 'rgba(232,234,246,0.55)' }}
                  >
                    {m.title.split(' ').slice(1).join(' ')}
                  </button>
                ))}
                <div className="pt-2 mt-2 border-t border-white/[0.06]">
                  <a
                    href="mailto:manaminglee@gmail.com"
                    className="text-sm text-left hover:text-indigo-300 transition-colors inline-block"
                    style={{ color: 'rgba(232,234,246,0.55)' }}
                  >
                    📧 Contact Us (manaminglee@gmail.com)
                  </a>
                </div>
              </div>
            </div>

            {/* Column 3: Trust & Safety */}
            <div className="flex flex-col gap-4">
              <h5 className="text-xs font-bold uppercase tracking-widest text-teal-400">Trust & Safety</h5>
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(232,234,246,0.5)' }}>
                  <span className="text-indigo-400">🛡️</span> Encrypted WebRTC
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(232,234,246,0.5)' }}>
                  <span className="text-teal-400">⚡</span> Zero Logs Policy
                </div>
                <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(232,234,246,0.5)' }}>
                  <span className="text-purple-400">👁️</span> 24/7 AI Monitoring
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-white/[0.06] flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs" style={{ color: 'rgba(232,234,246,0.3)' }}>
              © {new Date().getFullYear()} Mana Mingle · Powered by WeConnect Technology
            </p>
            <div className="flex items-center gap-6">
              <span className="text-[10px] uppercase tracking-tighter text-white/10 font-black">Anonymous By Design</span>
            </div>
          </div>
        </div>
      </footer>

      {/* MODAL */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-white">{MODALS[modal]?.title}</h3>
              <button
                onClick={() => setModal(null)}
                className="btn btn-icon"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <pre className="text-sm whitespace-pre-wrap font-sans" style={{ color: 'rgba(232,234,246,0.7)', lineHeight: 1.75 }}>
              {MODALS[modal]?.body}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
