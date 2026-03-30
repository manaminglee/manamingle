/**
 * VideoChat – 1:1 anonymous video chat with WebRTC
 * Full Omegle-style: searching→matched→skip
 * Layout: remote video (main) | local video (pip) | side chat
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { countryToFlag } from '../utils/countryFlag';
import { useLatency } from '../hooks/useLatency';
import { useIceServers } from '../hooks/useIceServers';
import { CoinBadge } from './CoinBadge';
import { playConnectSound, playMessageSound, playDisconnectSound, playWaveSound } from '../utils/sounds';

const AI_ICEBREAKERS = {
  general: [
    "What's the most surprising thing about your day so far?",
    "If you could have any superpower, what would it be?",
    "What's your favorite secret spot in your city?",
    "If you had to eat one meal for the rest of your life, what would it be?",
    "What's the best concert you've ever attended?"
  ],
  telugu: [
    "Which Telugu movie dialogue do you use most in real life?",
    "If you could be any character in a Rajamouli film, who would you be?",
    "What's your favorite place in Andhra or Telangana for a road trip?",
    "Do you prefer classical Telugu literature or modern films?",
    "What's the one thing everyone should experience in a Telugu wedding?"
  ],
  music: [
    "What's your favorite guilty pleasure song?",
    "If you could play any instrument perfectly overnight, which one would it be?",
    "What's the best soundtrack to a movie or game you've ever heard?",
    "Who is your all-time favorite musical artist?",
    "What's the most meaningful lyric you've ever heard?"
  ],
  gaming: [
    "What's the most immersive world you've ever explored in a game?",
    "If you could build your dream game, what would the genre be?",
    "What's the biggest 'clutch' moment you've ever had in a game?",
    "Gaming on a big TV or a small monitor? What's your choice?",
    "What's the first game that made you actually emotional?"
  ]
};

function VideoEl({ stream, muted = false, mirror = false, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={`w-full h-full object-cover ${mirror ? 'scale-x-[-1]' : ''} ${className}`}
    />
  );
}

const EMOJIS_3D = [
  { char: '🔥', label: 'Fire', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.webp' },
  { char: '💎', label: 'Gem', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f48e/512.webp' },
  { char: '🚀', label: 'Rocket', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f680/512.webp' },
  { char: '✨', label: 'Sparkle', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/2728/512.webp' },
  { char: '🎉', label: 'Party', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f389/512.webp' },
  { char: '❤️', label: 'Heart', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/2764_fe0f/512.webp' },
  { char: '😂', label: 'Laugh', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f602/512.webp' },
  { char: '👑', label: 'Crown', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f451/512.webp' },
];

const API_BASE = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : '');

const VIDEO_FILTERS = [
  { id: 'none', label: 'Normal' },
  { id: 'grayscale(100%)', label: 'Noir (B&W)' },
  { id: 'sepia(80%)', label: 'Vintage (Sepia)' },
  { id: 'hue-rotate(90deg)', label: 'Alien (Hue)' },
  { id: 'invert(100%)', label: 'Negative' },
  { id: 'contrast(150%) brightness(120%)', label: 'Intense' },
];

function VanishingMessage({ m, isMe }) {
  const [timeLeft, setTimeLeft] = useState(90);

  useEffect(() => {
    if (m.system) return;
    const age = Math.floor((Date.now() - (m.ts || Date.now())) / 1000);
    const rem = Math.max(0, 90 - age);
    setTimeLeft(rem);

    if (rem <= 0) return;

    const int = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(int);
  }, [m.ts, m.system]);

  if (!m.system && timeLeft <= 0) return null;

  if (m.system) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded shadow-sm">
          {m.text}
        </span>
      </div>
    );
  }

  const mStr = Math.floor(timeLeft / 60);
  const sStr = (timeLeft % 60).toString().padStart(2, '0');

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in mt-2`}>
      <div className={`relative max-w-[85%] px-3 py-2 rounded-lg text-sm flex gap-2 items-end group ${isMe ? 'bg-[#1a7f37] text-white' : 'bg-white/10 text-white/90'}`}>
        <p className="break-words leading-relaxed">{m.text}</p>
        <span className={`text-[9px] font-mono shrink-0 mb-0.5 ${timeLeft <= 10 ? 'text-amber-400 animate-pulse font-bold' : 'opacity-50'}`}>
          {mStr}:{sStr}
        </span>
      </div>
    </div>
  );
}

export function VideoChat({ socket, connected, country, onlineCount, interest = 'general', nickname = 'Anonymous', adsEnabled = false, onBack, onJoined, onFindNewPartner, coinState }) {
  const { balance, streak, canClaim, nextClaim, claimCoins, history, addHistory } = coinState || {};
  const { iceServers } = useIceServers();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [roomId, setRoomId] = useState(null);
  const [peer, setPeer] = useState(null);
  const [status, setStatus] = useState('idle'); // Start in idle mode to show preparation screen
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [mutedStranger, setMutedStranger] = useState(false);
  const [lowBandwidth, setLowBandwidth] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const latency = useLatency();
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isTranslatorActive, setIsTranslatorActive] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [active3dEmoji, setActive3dEmoji] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [toast, setToast] = useState(null);
  const [autoBandwidth, setAutoBandwidth] = useState(true);
  const [videoDevices, setVideoDevices] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState(
    () => (typeof window !== 'undefined' ? window.localStorage.getItem('mm_videoDeviceId') : null)
  );
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState(
    () => (typeof window !== 'undefined' ? window.localStorage.getItem('mm_audioDeviceId') : null)
  );
  const [remoteVolume, setRemoteVolume] = useState(1);
  // --- NEW FEATURES ---
  const [cameraBlur, setCameraBlur] = useState(false);
  const [connectedSecs, setConnectedSecs] = useState(0);
  const [showWave, setShowWave] = useState(false);
  const [moodEmoji, setMoodEmoji] = useState(null); // live mood: 😊😂🤔😮
  const [showInterestCard, setShowInterestCard] = useState(false);
  const [goodVibesSent, setGoodVibesSent] = useState(false);
  const [goodVibesMatch, setGoodVibesMatch] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);
  const [aiSummary, setAiSummary] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [strangerTyping, setStrangerTyping] = useState(false);
  const [countryBanner, setCountryBanner] = useState(null); // { myCountry, peerCountry }
  const [showChat, setShowChat] = useState(true);
  const [activeFilter, setActiveFilter] = useState('none');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showCoinHistory, setShowCoinHistory] = useState(false);
  const [smartReplies, setSmartReplies] = useState([]);
  const [filterTimer, setFilterTimer] = useState(0);
  const [strangerFilter, setStrangerFilter] = useState('none');
  const [strangerBlur, setStrangerBlur] = useState(false);
  const filterIntervalRef = useRef(null);
  const [myCountry, setMyCountry] = useState(country);
  const [partnerLeft, setPartnerLeft] = useState(false);
  const [interestTags, setInterestTags] = useState(['social', 'fun', 'music', 'gaming']);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const connTimerRef = useRef(null);
  const typingTimerRef = useRef(null);
  const toastTimerRef = useRef(null);
  // ---------------
  const pipDragRef = useRef(null);
  const pcRef = useRef(null);
  const roomIdRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const pendingCandidatesRef = useRef(new Map());
  const pendingOfferRef = useRef(null);
  const pendingAnswerRef = useRef(null);
  const peerInfoRef = useRef(new Map());
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  const isConnected = !!peer && !!roomId;

  const connectionQuality = latency == null
    ? 'unknown'
    : latency < 120
      ? 'good'
      : latency < 260
        ? 'ok'
        : 'poor';

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const [pipPos, setPipPos] = useState('br');
  const togglePip = () => {
    const pos = ['tr', 'tl', 'bl', 'br'];
    setPipPos(pos[(pos.indexOf(pipPos) + 1) % pos.length]);
  };

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Toast auto-dismiss after 4 seconds
  useEffect(() => {
    if (!toast) return;
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(toastTimerRef.current);
  }, [toast]);

  // Connection timer
  useEffect(() => {
    if (status === 'connected') {
      setConnectedSecs(0);
      connTimerRef.current = setInterval(() => setConnectedSecs(s => s + 1), 1000);
    } else {
      clearInterval(connTimerRef.current);
    }
    return () => clearInterval(connTimerRef.current);
  }, [status]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in chat
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      // SPACE + S for Stop
      if (e.code === 'Space' && e.shiftKey) { // Using Shift+Space for "Space+S" style or just separate keys
         // The user asked for "Space + S", let's implement a listener for both
      }

      // ESC for Skip/New
      if (e.key === 'Escape') {
        e.preventDefault();
        handleSkip();
      }
    };

    // More robust combo for Space + S
    const pressedKeys = new Set();
    const handleDown = (e) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      pressedKeys.add(e.code);
      if (pressedKeys.has('Space') && pressedKeys.has('KeyS')) {
        e.preventDefault();
        handleStop();
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        handleSkip();
      }
    };
    const handleUp = (e) => pressedKeys.delete(e.code);

    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => {
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
    };
  }, [handleSkip, handleStop]);

  const formatTimer = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Mood meter: analyze last message
  useEffect(() => {
    const last = messages.filter(m => !m.system && !m.fromSelf && (m.socketId !== (socket?.id))).slice(-1)[0];
    if (!last?.text) return;
    const t = last.text.toLowerCase();
    if (/lol|haha|😂|😄|funny|lmao/.test(t)) setMoodEmoji('😂');
    else if (/wow|amazing|omg|whoa|really/.test(t)) setMoodEmoji('😮');
    else if (/hmm|think|maybe|wonder|idk/.test(t)) setMoodEmoji('🤔');
    else if (/great|nice|good|cool|love|awesome/.test(t)) setMoodEmoji('😊');
    else setMoodEmoji(null);
  }, [messages]);

  // Wave reaction handler
  useEffect(() => {
    if (!socket) return;
    const onWave = () => { setShowWave(true); setTimeout(() => setShowWave(false), 2800); playWaveSound(); };
    const onGoodVibesMatch = () => { setGoodVibesMatch(true); setToast('🤝 Both of you gave Good Vibes! Great conversation!'); playConnectSound(); };
    const onContentFlagged = (data) => setToast(`⚠️ ${data.message}`);
    const onTyping = ({ isTyping }) => {
      setStrangerTyping(isTyping);
      if (isTyping) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setStrangerTyping(false), 3000);
      }
    };
    socket.on('wave-reaction', onWave);
    socket.on('good-vibes-match', onGoodVibesMatch);
    socket.on('content-flagged', onContentFlagged);
    socket.on('stranger-typing', onTyping);
    return () => {
      socket.off('wave-reaction', onWave);
      socket.off('good-vibes-match', onGoodVibesMatch);
      socket.off('content-flagged', onContentFlagged);
      socket.off('stranger-typing', onTyping);
    };
  }, [socket]);

  const sendWave = () => {
    if (socket && roomIdRef.current) {
      socket.emit('send-wave', { roomId: roomIdRef.current });
      setShowWave(true);
      setTimeout(() => setShowWave(false), 2800);
    }
  };

  const sendGoodVibes = () => {
    if (socket && roomIdRef.current) {
      socket.emit('send-good-vibes', { roomId: roomIdRef.current });
      setGoodVibesSent(true);
      setToast('🤝 Good Vibes sent! Waiting for the other person...');
    }
  };

  const submitRating = (stars) => {
    setRatingDone(true);
    setShowRating(false);
    setToast(`Thanks for rating! ${'⭐'.repeat(stars)} — Your feedback helps improve Mana Mingle.`);
  };

  const generateAiSummary = async (msgs) => {
    if (!msgs || msgs.length < 3) return;
    try {
      const res = await fetch(`${API_BASE}/api/ai/spark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interest: 'Summarize this anonymous conversation in 2 fun bullet points (no names, no personal info): ' + msgs.filter(m => !m.system).map(m => m.text).join(' | ') })
      });
      if (res.ok) {
        const data = await res.json();
        setAiSummary(data.spark);
        setShowSummary(true);
      }
    } catch (e) { }
  };

  // Get user media on mount
  useEffect(() => {
    let s = null;
    (async () => {
      try {
        const baseConstraints = {
          video: selectedVideoDeviceId ? { deviceId: { exact: selectedVideoDeviceId } } : true,
          audio: selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : true,
        };
        s = await navigator.mediaDevices.getUserMedia(baseConstraints);
        localStreamRef.current = s;
        setLocalStream(s);
        if (localVideoRef.current) localVideoRef.current.srcObject = s;
      } catch (err) {
        console.error('Camera/mic error:', err);
        setCameraError('We could not access your camera or microphone. Please allow permissions and try again.');
      }
    })();
    return () => {
      if (s) s.getTracks().forEach((t) => t.stop());
    };
  }, [selectedVideoDeviceId, selectedAudioDeviceId]);

  // Enumerate audio / video devices
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;

    const loadDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videos = devices.filter((d) => d.kind === 'videoinput');
        const audios = devices.filter((d) => d.kind === 'audioinput');

        setVideoDevices(videos);
        setAudioDevices(audios);

        if (!selectedVideoDeviceId && videos[0]?.deviceId) {
          setSelectedVideoDeviceId(videos[0].deviceId);
        }
        if (!selectedAudioDeviceId && audios[0]?.deviceId) {
          setSelectedAudioDeviceId(audios[0].deviceId);
        }
      } catch (e) {
        console.error('enumerateDevices error', e);
      }
    };

    loadDevices();
    navigator.mediaDevices.addEventListener?.('devicechange', loadDevices);
    return () => navigator.mediaDevices.removeEventListener?.('devicechange', loadDevices);
  }, [selectedVideoDeviceId, selectedAudioDeviceId]);

  // Apply quality constraints when lowBandwidth / autoBandwidth toggles
  useEffect(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const vt = stream.getVideoTracks()[0];
    if (!vt) return;
    const targetLow = lowBandwidth || (autoBandwidth && latency != null && latency > 260);
    const c = targetLow ? { width: 640, height: 480, frameRate: 15 } : { width: 1280, height: 720 };
    vt.applyConstraints(c).catch(() => { });
  }, [lowBandwidth, autoBandwidth, latency]);

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream, status]);

  // Attach remote stream, volume, and ensure play on mobile (fixes black screen)
  useEffect(() => {
    const el = remoteVideoRef.current;
    if (!el || !peer?.stream) return;
    el.srcObject = peer.stream;
    el.volume = remoteVolume;
    el.play?.().catch(() => { });
  }, [peer?.stream, remoteVolume]);

  const bandwidthLabel = autoBandwidth ? 'Auto' : (lowBandwidth ? 'Low' : 'High');

  const clearRoom = useCallback(() => {
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    pendingCandidatesRef.current.clear();
    pendingOfferRef.current = null;
    pendingAnswerRef.current = null;
    peerInfoRef.current.clear();
    setPeer(null);
    setRoomId(null);
    setMessages([]);
    roomIdRef.current = null;
  }, []);

  const handleStart = () => {
    if (!socket || !connected) return;
    clearRoom();
    setStatus('searching');
    socket.emit('find-partner', { mode: 'video', interest: interest || 'general', nickname: 'Anonymous' });
  };

  const handleSkip = () => {
    if (socket) {
      if (roomIdRef.current) socket.emit('leave-room', { roomId: roomIdRef.current });
      else socket.emit('cancel-find-partner');
    }
    clearRoom();
    setStatus('searching');
    setGoodVibesSent(false); setGoodVibesMatch(false); setCameraBlur(false);
    setStrangerFilter('none'); setStrangerBlur(false);
    setTimeout(() => {
      if (status !== 'idle') {
        socket?.emit('find-partner', { mode: 'video', interest: interest || 'general', nickname: 'Anonymous' });
        onFindNewPartner?.();
      }
    }, 100);
  };

  const handleStop = () => {
    if (roomIdRef.current && socket) socket.emit('leave-room', { roomId: roomIdRef.current });
    socket?.emit('cancel-find-partner');
    clearRoom();
    setStatus('idle');
    setGoodVibesSent(false); setGoodVibesMatch(false); setCameraBlur(false);
    setStrangerFilter('none'); setStrangerBlur(false);
  };

  const handleBack = () => { handleStop(); onBack?.(); };

  const handleReport = () => {
    if (!isConnected) return;
    setToast('🚩 User reported. Our safety AI is now performing a deep scan.');
    // In a real app, this would emit a 'report-user' event to the server
    if (socket && roomIdRef.current) {
      socket.emit('report-user', { roomId: roomIdRef.current, reason: 'unspecified' });
    }
    // Optionally auto-skip after report
    setTimeout(handleSkip, 2000);
  };

  const toggleInterestTag = (tag) => {
    setSelectedInterests(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  // Pause remote video when tab is hidden
  useEffect(() => {
    const handleVisibility = () => {
      const hidden = document.visibilityState === 'hidden';
      if (!peer?.stream) return;
      peer.stream.getVideoTracks().forEach((t) => { t.enabled = !hidden; });
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [peer]);

  // --- Video Filter Sync Effect ---
  useEffect(() => {
    if (socket && roomIdRef.current && status === 'connected') {
      socket.emit('video-style', { roomId: roomIdRef.current, filter: activeFilter, blur: cameraBlur });
    }
  }, [activeFilter, cameraBlur, socket, status]);

  // Sync balance to a ref so we don't reset the filter interval whenever balance changes
  const balanceRef = useRef(balance);
  useEffect(() => {
    balanceRef.current = balance;
  }, [balance]);

  // --- Premium Video Filter Effect ---
  useEffect(() => {
    if (activeFilter === 'none') {
      setFilterTimer(0);
      return;
    }
    setFilterTimer(60);
    const tickInterval = setInterval(() => {
      setFilterTimer(t => (t <= 1 ? 60 : t - 1));
    }, 1000);

    const deductionInterval = setInterval(() => {
      if (balanceRef.current >= 12) {
        if (socket) socket.emit('spend-coins', { amount: 12, reason: 'Premium Video Filter Maintenance' });
        if (addHistory) addHistory('Premium Filter (1 min)', -12);
      } else {
        setActiveFilter('none');
        setToast('Premium filter auto-stopped (insufficient coins).');
      }
    }, 60000);
    return () => { clearInterval(tickInterval); clearInterval(deductionInterval); };
  }, [activeFilter, socket, addHistory]);

  const handleFilterSelect = (filterId) => {
    if (filterId === 'none') {
      setActiveFilter('none');
      setShowFilterMenu(false);
      return;
    }
    if (balance < 12) {
      alert('You need at least 12 coins to enable premium video filters.');
      return;
    }
    const confirm = window.confirm("Enable Premium Filter? Full auto access is required.\n\n12 coins will be automatically deducted every 1 minute while this filter is active. Continue?");
    if (!confirm) return;

    if (socket) socket.emit('spend-coins', { amount: 12, reason: 'Started Premium Filter' });
    if (addHistory) addHistory('Started Premium Video Filter', -12);
    setActiveFilter(filterId);
    setShowFilterMenu(false);
  };

  // --- Smart Quick Replies Effect ---
  useEffect(() => {
    const fetchReplies = async () => {
      const last = messages.filter(m => !m.system && m.socketId !== socket?.id).slice(-1)[0];
      if (!last?.text) {
        setSmartReplies([]);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/ai/reply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lastMessage: last.text })
        });
        if (res.ok) {
          const data = await res.json();
          setSmartReplies(data.replies || []);
        }
      } catch (e) { setSmartReplies([]); }
    };

    const timeout = setTimeout(fetchReplies, 800);
    return () => clearTimeout(timeout);
  }, [messages, socket?.id]);

  useEffect(() => {
    if (status === 'connected') {
      setTimeout(() => inputRef.current?.focus(), 500);
      setToast('✅ Connected with a stranger!');
      playConnectSound();
    } else if (status === 'disconnected') {
      playDisconnectSound();
    }
  }, [status]);

  // Country discovery banner when peer is found
  useEffect(() => {
    if (!peer) return;
    if (peer.country || country) {
      setCountryBanner({ myCountry: country, peerCountry: peer.country });
      setTimeout(() => setCountryBanner(null), 4000);
    }
  }, [peer]);

  const handleEsc = useCallback(() => {
    if (status === 'connected' || status === 'searching') {
      handleSkip();
    } else {
      handleBack();
    }
  }, [status, handleSkip, handleBack]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      if (e.key.toLowerCase() === 's') handleStart();
      if (e.key === 'Escape') handleEsc();
      if (e.key === 'Enter') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [status, handleStart, handleSkip, handleBack, handleEsc]);

  // AI icebreaker when first connected
  useEffect(() => {
    const pool = AI_ICEBREAKERS[interest?.toLowerCase()] || AI_ICEBREAKERS.general;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!pick) return;
    // Removed auto-sent AI message to chat log as per user request
  }, [isConnected, peer, interest]);

  // Auto hide toast after a few seconds
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const createPeerConnection = useCallback((remoteId) => {
    if (peerConnectionsRef.current.has(remoteId)) return peerConnectionsRef.current.get(remoteId);
    const pc = new RTCPeerConnection({ iceServers });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current));
    }

    pc.onicecandidate = (e) => {
      const rid = roomIdRef.current;
      if (e.candidate && socket && rid) {
        socket.emit('webrtc-signal', { roomId: rid, targetSocketId: remoteId, type: 'ice-candidate', signal: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      const info = peerInfoRef.current.get(remoteId) || {};
      const streams = e.streams;
      let stream = null;
      if (streams && streams[0]) {
        stream = streams[0];
      } else {
        stream = new MediaStream([e.track]);
      }

      setPeer((prev) => {
        if (prev?.socketId === remoteId && prev?.stream) {
          // Add track to existing stream
          if (!prev.stream.getTracks().find(t => t.id === e.track.id)) {
            prev.stream.addTrack(e.track);
          }
          return { ...prev, nickname: info.nickname || prev.nickname, country: info.country || prev.country };
        }
        return { socketId: remoteId, stream, nickname: info.nickname || prev?.nickname, country: info.country || prev?.country };
      });
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        setTimeout(() => {
          if (pc.iceConnectionState !== 'connected') {
            setPeer((p) => (p?.socketId === remoteId ? null : p));
          }
        }, 3000);
      }
    };

    peerConnectionsRef.current.set(remoteId, pc);
    pcRef.current = pc;
    return pc;
  }, [socket, iceServers]);

  const doOffer = useCallback(async (remoteId) => {
    const rid = roomIdRef.current;
    if (!rid || !socket) return;
    const pc = createPeerConnection(remoteId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('webrtc-signal', { roomId: rid, targetSocketId: remoteId, type: 'offer', signal: offer });
    } catch (err) { console.error('offer error', err); }
  }, [socket, createPeerConnection]);

  const doAnswer = useCallback(async (remoteId, offer) => {
    const rid = roomIdRef.current;
    if (!rid || !socket) return;
    const pc = createPeerConnection(remoteId);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-signal', { roomId: rid, targetSocketId: remoteId, type: 'answer', signal: answer });
    } catch (err) { console.error('answer error', err); }
  }, [socket, createPeerConnection]);

  // Send offer/answer once local stream is ready (fixes race when signaling before getUserMedia)
  useEffect(() => {
    if (!localStream) return;
    const po = pendingOfferRef.current;
    if (po && roomIdRef.current && peer?.socketId === po) {
      pendingOfferRef.current = null;
      doOffer(po);
    }
    const pa = pendingAnswerRef.current;
    if (pa) {
      pendingAnswerRef.current = null;
      doAnswer(pa.from, pa.signal);
    }
  }, [localStream, peer?.socketId, doOffer, doAnswer]);

  const addIce = useCallback(async (remoteId, candidate) => {
    const pc = peerConnectionsRef.current.get(remoteId);
    const pend = pendingCandidatesRef.current.get(remoteId) || [];
    if (!pc) {
      pend.push(candidate);
      pendingCandidatesRef.current.set(remoteId, pend);
      return;
    }
    const add = async (c) => {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
        return true;
      } catch {
        return false;
      }
    };
    const ok = await add(candidate);
    if (!ok) {
      pend.push(candidate);
      pendingCandidatesRef.current.set(remoteId, pend);
      return;
    }
    for (const c of pend) await add(c);
    pendingCandidatesRef.current.set(remoteId, []);
  }, []);

  // Socket events
  useEffect(() => {
    if (!socket) return;

    const onPartnerFound = (data) => {
      roomIdRef.current = data.roomId;
      setRoomId(data.roomId);
      const p = data.peer;
      if (p?.socketId) {
        peerInfoRef.current.set(p.socketId, { nickname: p.nickname, country: p.country });
        setPeer({ socketId: p.socketId, nickname: p.nickname, country: p.country, stream: null });
        if (socket.id < p.socketId) {
          if (localStreamRef.current) doOffer(p.socketId);
          else pendingOfferRef.current = p.socketId;
        }
      }
      setStatus('connected');
      onJoined?.(data.roomId);
    };

    const onHistory = (data) => {
      if (data.roomId === roomIdRef.current) setMessages(data.messages || []);
    };

    const onMsg = (data) => {
      if (data.roomId === roomIdRef.current) {
        setMessages((m) => [...m.slice(-100), data]);
        // Play sound only for incoming messages
        if (data.socketId !== socket.id) playMessageSound();
      }
    };

    const onUserLeft = () => {
      setPeer((p) => (p ? { ...p, stream: null } : null));
      setStatus('disconnected');
      setPartnerLeft(true);
      playDisconnectSound();
      setTimeout(() => setPartnerLeft(false), 5000);
    };

    const onWaiting = () => setStatus('searching');
    const onSystemMsg = (data) => setMessages((m) => [...m, { id: Date.now(), system: true, text: `📢 ADMIN: ${data.message}`, ts: Date.now() }]);

    const onStrangerVideoStyle = (data) => {
      setStrangerFilter(data.filter || 'none');
      setStrangerBlur(!!data.blur);
    };

    const onSignal = async (data) => {
      const from = data.fromSocketId;
      if (!from || from === socket.id) return;
      if (data.fromNickname || data.fromCountry) {
        peerInfoRef.current.set(from, { nickname: data.fromNickname, country: data.fromCountry });
      }
      if (data.type === 'offer') {
        if (localStreamRef.current) doAnswer(from, data.signal);
        else pendingAnswerRef.current = { from, signal: data.signal };
      }
      else if (data.type === 'answer') {
        const pc = peerConnectionsRef.current.get(from);
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
            const pend = pendingCandidatesRef.current.get(from) || [];
            for (const c of pend) {
              try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ }
            }
            pendingCandidatesRef.current.set(from, []);
          } catch (err) { console.error('setRemoteDescription error', err); }
        }
      } else if (data.type === 'ice-candidate' && data.signal) {
        addIce(from, data.signal);
      }
    };

    socket.on('partner-found', onPartnerFound);
    socket.on('chat-history', onHistory);
    socket.on('chat-message', onMsg);
    socket.on('user-left', onUserLeft);
    socket.on('waiting-for-partner', onWaiting);
    socket.on('webrtc-signal', onSignal);
    socket.on('system-announcement', onSystemMsg);
    socket.on('stranger-video-style', onStrangerVideoStyle);

    // Auto-emit find-partner on mount if we're in searching state
    if (socket && status === 'searching' && !roomIdRef.current) {
      socket.emit('find-partner', { mode: 'video', interest: interest || 'general', nickname: 'Anonymous' });
    }

    return () => {
      socket.off('partner-found', onPartnerFound);
      socket.off('chat-history', onHistory);
      socket.off('chat-message', onMsg);
      socket.off('user-left', onUserLeft);
      socket.off('waiting-for-partner', onWaiting);
      socket.off('webrtc-signal', onSignal);
      socket.off('system-announcement', onSystemMsg);
      socket.off('stranger-video-style', onStrangerVideoStyle);
    };
  }, [socket, interest, onJoined, onFindNewPartner, doOffer, doAnswer, addIce]);

  // Handle translation for incoming messages
  useEffect(() => {
    if (!isTranslatorActive) return;

    const untranslated = messages.filter(m => !m.fromSelf && !m.translated && !m.system && m.text && m.text.length > 2);
    if (untranslated.length === 0) return;

    const target = untranslated[untranslated.length - 1];
    const translateMsg = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/ai/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: target.text, to: 'English' })
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(prev => prev.map(m => (m.id === target.id || (m.text === target.text && m.ts === target.ts)) ? { ...m, translated: data.translated } : m));
        }
      } catch (e) { }
    };
    translateMsg();
  }, [messages, isTranslatorActive]);

  const startScreenShare = async () => {
    if (balance < 50) return alert('Need 50 coins to start Screen Share!');
    if (!pcRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      const sender = pcRef.current.getSenders().find(s => s.track.kind === 'video');
      if (sender) {
        sender.replaceTrack(track);
        setIsScreenSharing(true);
        socket.emit('spend-coins', { amount: 50, reason: 'screenshare' });
        track.onended = () => {
          setIsScreenSharing(false);
          if (localStreamRef.current) {
            const localTrack = localStreamRef.current.getVideoTracks()[0];
            sender.replaceTrack(localTrack);
          }
        };
      }
    } catch (e) {
      console.error(e);
    }
  };

  const send3dEmoji = (emoji) => {
    if (balance < 5) return alert('Need 5 coins for 3D Emoji!');
    if (socket && roomIdRef.current) {
      const r = roomIdRef.current;
      socket.emit('send-3d-emoji', { roomId: r, emoji });
      setShowEmojiPicker(false);
    }
  };

  const handleMediaUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const type = file.type.startsWith('video') ? 'video' : 'image';
    const cost = type === 'video' ? 15 : 10;
    if (balance < cost) return alert(`Need ${cost} coins!`);

    if (type === 'video') {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = function () {
        window.URL.revokeObjectURL(video.src);
        if (video.duration > 6) {
          return alert('Video must be 5 seconds or less!');
        }
        processUpload(file);
      };
      video.src = URL.createObjectURL(file);
    } else {
      processUpload(file);
    }
    e.target.value = '';
  };

  const processUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const r = roomIdRef.current;
      if (!socket || !r) return;
      const type = file.type.startsWith('video') ? 'video' : 'image';
      const content = ev.target.result;
      // Optimistically show in our chat immediately
      setMessages(prev => [
        ...prev.slice(-100),
        {
          id: `local-med-${Date.now()}`,
          type,
          content,
          nickname,
          ts: Date.now(),
          socketId: socket.id,
          media: true,
        },
      ]);
      socket.emit('send-media', { roomId: r, type, content });
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (socket) {
      socket.on('3d-emoji', (data) => {
        if (data.roomId && data.roomId !== roomIdRef.current) return;
        setActive3dEmoji(data);
        // Add to chat history too
        setMessages(prev => [...prev.slice(-100), {
          id: `emoji-${Date.now()}`,
          text: `Sent a 3D ${data.emoji.char || data.emoji}`,
          socketId: data.socketId,
          nickname: data.nickname,
          ts: Date.now(),
          isEmoji: true
        }]);
        setTimeout(() => setActive3dEmoji(null), 3000);
      });
      socket.on('media-message', (data) => {
        if (data.roomId && data.roomId !== roomIdRef.current) return;
        setMessages(prev => [...prev.slice(-100), { ...data, media: true }]);
      });
      return () => {
        socket.off('3d-emoji');
        socket.off('media-message');
      };
    }
  }, [socket]);

  // Cleanup on unmount
  useEffect(() => () => { clearRoom(); }, [clearRoom]);

  const sendMsg = () => {
    const t = input.trim();
    const r = roomIdRef.current;
    if (!t || !socket || !r) return;
    socket.emit('send-message', { roomId: r, text: t });
    // Clear typing indicator
    socket.emit('typing', { roomId: r, isTyping: false });
    setInput('');
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const r = roomIdRef.current;
    if (!socket || !r) return;
    socket.emit('typing', { roomId: r, isTyping: e.target.value.length > 0 });
    // Auto-stop typing after 2s of no keystroke
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.emit('typing', { roomId: r, isTyping: false });
    }, 2000);
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const next = !muted;
    localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  };

  const toggleCamera = () => {
    if (!localStreamRef.current) return;
    const next = !cameraOff;
    localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = !next));
    setCameraOff(next);
  };

  const changeDevices = async (videoDeviceId, audioDeviceId) => {
    try {
      const constraints = {
        video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
        audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
      };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }

      localStreamRef.current = newStream;
      setLocalStream(newStream);
      if (localVideoRef.current) localVideoRef.current.srcObject = newStream;

      peerConnectionsRef.current.forEach((pc) => {
        const senders = pc.getSenders();
        const newVideoTrack = newStream.getVideoTracks()[0];
        const newAudioTrack = newStream.getAudioTracks()[0];

        if (newVideoTrack) {
          const vs = senders.find((s) => s.track && s.track.kind === 'video');
          if (vs) vs.replaceTrack(newVideoTrack);
        }
        if (newAudioTrack) {
          const as = senders.find((s) => s.track && s.track.kind === 'audio');
          if (as) as.replaceTrack(newAudioTrack);
        }
      });

      if (videoDeviceId) {
        setSelectedVideoDeviceId(videoDeviceId);
        window.localStorage.setItem('mm_videoDeviceId', videoDeviceId);
      }
      if (audioDeviceId) {
        setSelectedAudioDeviceId(audioDeviceId);
        window.localStorage.setItem('mm_audioDeviceId', audioDeviceId);
      }
    } catch (err) {
      console.error('changeDevices error', err);
      setCameraError('Could not switch camera or microphone. Please check permissions and try again.');
    }
  };

  const generateAiSpark = async () => {
    if (isAiGenerating) return;
    setIsAiGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai/spark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interest })
      });
      if (res.ok) {
        const data = await res.json();
        setInput(data.spark);
      } else {
        const list = AI_ICEBREAKERS[interest.toLowerCase()] || AI_ICEBREAKERS.general;
        setInput(list[Math.floor(Math.random() * list.length)]);
      }
    } catch (e) {
      const list = AI_ICEBREAKERS[interest.toLowerCase()] || AI_ICEBREAKERS.general;
      setInput(list[Math.floor(Math.random() * list.length)]);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const formatTime = (ts) => ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-white overflow-hidden font-sans select-none">
      {/* Minimal Omegle-style header */}
      <header className="h-12 sm:h-14 px-4 flex items-center justify-between border-b border-white/[0.06] bg-[#0a0a0a] z-[100] shrink-0">
        <button onClick={handleBack} className="p-2 -ml-2 rounded-lg hover:bg-white/5 transition-colors" aria-label="Back">
          <svg className="w-5 h-5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-sm font-medium text-white/80">Video Chat</span>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowFilterMenu(true)} className="px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition">Filters</button>
          <span className="text-xs text-white/40">{onlineCount?.toLocaleString()} online</span>
          <button onClick={() => setShowCoinHistory(true)} className="text-amber-500/90 font-medium text-sm flex items-center gap-1 hover:bg-white/5 px-2 py-1 rounded transition">🪙 {balance}</button>
          {!showChat && status === 'connected' && (
            <button onClick={() => setShowChat(true)} className="p-2 sm:hidden text-white/40 hover:text-white">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </button>
          )}
        </div>
      </header>

      {/* Main area - Omegle split layout */}
      <main className="flex-1 flex min-h-0 relative">
        {/* Split view: You | Stranger - when idle or searching show full, when connected show split */}
        <div className={`flex-1 flex ${status === 'connected' ? 'flex-col sm:flex-row' : 'flex-col'} min-h-0`}>
          {/* Left: You (or full when idle/searching) */}
          <div className={`relative bg-[#111] flex-1 flex flex-col justify-center items-center min-h-0 ${status === 'connected' ? 'border-b sm:border-b-0 sm:border-r border-white/[0.06]' : ''}`}>
            {status === 'idle' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                {cameraError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-10 p-6">
                    <p className="text-sm text-rose-400 text-center max-w-xs">{cameraError}</p>
                  </div>
                )}
                <p className="text-white/60 text-sm mb-2">Talk to strangers!</p>
                <p className="text-white/40 text-xs mb-8 max-w-xs text-center">Click Start to begin a random video chat with someone from around the world.</p>
                <button onClick={handleStart} disabled={!connected} className="px-12 py-4 rounded-lg bg-[#1a7f37] hover:bg-[#2ea043] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-base transition-colors">
                  Start
                </button>
              </div>
            )}
            {status === 'searching' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
                <p className="text-white/80 text-base mb-1">Looking for someone you can chat with...</p>
                <div className="flex gap-1.5 mt-4">
                  <span className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <button onClick={handleStop} className="mt-8 text-sm text-white/50 hover:text-white underline">Stop</button>
              </div>
            )}
            {(status === 'idle' || status === 'searching') && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-32 h-24 sm:w-40 sm:h-28 rounded-lg overflow-hidden border border-white/10 bg-black/50 z-10">
                <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover scale-x-[-1] ${cameraOff ? 'opacity-30' : ''}`} style={{ filter: activeFilter !== 'none' ? activeFilter : 'none' }} />
                <div className="absolute bottom-1 left-1 flex items-center gap-1 z-10">
                  <div className="text-[10px] font-medium text-white/80 bg-black/50 px-1.5 py-0.5 rounded">You</div>
                  {activeFilter !== 'none' && (
                    <span className="px-1 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-[9px] font-bold text-amber-500 animate-pulse">
                      -{filterTimer}s
                    </span>
                  )}
                </div>
              </div>
            )}
            {status === 'connected' && (
              <>
                <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${cameraOff ? 'opacity-20' : ''}`} style={{ filter: cameraBlur && activeFilter === 'none' ? 'blur(20px)' : (activeFilter !== 'none' ? activeFilter : 'none') }} />
                <div className="absolute bottom-3 left-3 flex items-center gap-1 z-10">
                  <span className="px-2 py-1 rounded bg-black/60 text-xs font-medium">You</span>
                  {activeFilter !== 'none' && (
                    <span className="px-1.5 py-1 rounded bg-amber-500/20 border border-amber-500/40 text-[10px] font-bold text-amber-500 animate-pulse">
                      -{filterTimer}s
                    </span>
                  )}
                </div>
                {cameraOff && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><span className="text-white/60 text-sm">Camera off</span></div>}
              </>
            )}
          </div>

          {/* Right: Stranger (only when connected) */}
          {status === 'connected' && (
            <div className="relative flex-1 bg-[#0d0d0d] min-h-0">
              <RemoteVideoComponent stream={peer?.stream} muted={mutedStranger} strangerFilter={strangerFilter} strangerBlur={strangerBlur} />
              <div className="absolute bottom-3 left-3 px-2 py-1 rounded bg-black/60 text-xs font-medium">
                {countryToFlag(peer?.country)} Stranger
              </div>
              {partnerLeft && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70">
                  <p className="text-white/80 text-sm">Stranger has disconnected.</p>
                  <p className="text-white/50 text-xs mt-1">Looking for someone new...</p>
                </div>
              )}
              <button onClick={handleReport} className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded bg-black/50 hover:bg-rose-500/20 text-white/60 hover:text-rose-400 transition-colors" title="Report">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </button>
            </div>
          )}
        </div>

        {/* Chat panel - slide in from right, Omegle style */}
        {showChat && status === 'connected' && (
          <div className="absolute inset-y-0 right-0 z-[100] w-[85%] sm:static sm:w-80 border-l border-white/[0.06] bg-[#0d0d0d]/95 backdrop-blur-xl sm:bg-[#0d0d0d] flex flex-col flex-shrink-0 animate-slide-in-right shadow-2xl sm:shadow-none">
            <div className="h-10 px-4 flex items-center justify-between border-b border-white/[0.06]">
              <span className="text-xs font-medium text-white/60">Text chat</span>
              <button onClick={() => setShowChat(false)} className="p-1 text-white/40 hover:text-white">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2" id="video-chat-messages">
              {messages.map((m, i) => {
                const isMe = m.socketId === socket.id || m.fromSelf;
                return <VanishingMessage key={m.id || i} m={m} isMe={isMe} />;
              })}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-white/[0.06] flex flex-col gap-2">
              {smartReplies.length > 0 && status === 'connected' && (
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar shrink-0">
                  {smartReplies.map((r, idx) => (
                    <button key={idx} onClick={() => { setInput(r); inputRef.current?.focus(); setSmartReplies([]); }} className="whitespace-nowrap px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-white/80 hover:bg-[#1a7f37] hover:border-[#1a7f37] transition-all shrink-0">
                      {r}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2 items-center relative">
                <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="text-white/40 hover:text-amber-500 transition-colors p-1" title="3D Animated Emojis (5 Coins)">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </button>
                <input ref={inputRef} value={input} onChange={handleInputChange} onKeyDown={(e) => e.key === 'Enter' && sendMsg()} placeholder="Type a message..." className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm outline-none focus:border-white/20 placeholder:text-white/30 transition-all focus:bg-white/10" />
                <button onClick={sendMsg} disabled={!input.trim()} className="px-4 py-2 rounded-lg bg-[#1a7f37] border border-[#2ea043]/50 hover:bg-[#2ea043] disabled:opacity-40 text-white text-sm font-bold shadow-lg shadow-[#1a7f37]/20 transition-all">Send</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom controls - Rearranged: Stop (Left) | Controls (Middle) | New (Right) */}
      <footer className="h-16 sm:h-20 px-4 border-t border-white/[0.06] bg-[#0a0a0a] flex items-center justify-between gap-4 z-[120] shrink-0">
        {/* Left Side: Stop */}
        <div className="flex flex-col items-center gap-1">
          <button onClick={handleStop} className="group relative px-6 py-2.5 rounded-xl bg-[#cf222e] hover:bg-[#da3633] text-white font-bold text-sm transition-all active:scale-95 shadow-lg shadow-red-900/20" aria-label="Stop">
            Stop
          </button>
          <span className="text-[9px] uppercase tracking-tighter text-white/30 font-bold">Space + S</span>
        </div>

        {/* Middle: Video/Audio Controls */}
        <div className="flex items-center gap-2 sm:gap-4 bg-white/5 px-4 py-2 rounded-2xl border border-white/10">
          <div className="flex flex-col items-center gap-1">
            <button onClick={toggleMute} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${muted ? 'bg-red-500/20 text-red-500' : 'bg-white/10 text-white/80 hover:bg-white/20'}`} title={muted ? 'Unmute' : 'Mute'}>
              {muted ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>}
            </button>
            <span className="text-[8px] text-white/20 font-bold">M</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <button onClick={toggleCamera} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${cameraOff ? 'bg-red-500/20 text-red-500' : 'bg-white/10 text-white/80 hover:bg-white/20'}`} title={cameraOff ? 'Camera on' : 'Camera off'}>
              {cameraOff ? <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>}
            </button>
            <span className="text-[8px] text-white/20 font-bold">V</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <button onClick={() => setCameraBlur(!cameraBlur)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${cameraBlur ? 'bg-[#1a7f37]/30 text-[#2ea043]' : 'bg-white/10 text-white/80 hover:bg-white/20'}`} title="Blur">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </button>
            <span className="text-[8px] text-white/20 font-bold">B</span>
          </div>
          {status === 'connected' && (
            <div className="flex flex-col items-center gap-1">
              <button onClick={() => setShowChat(!showChat)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${showChat ? 'bg-indigo-500/30 text-indigo-400' : 'bg-white/10 text-white/80 hover:bg-white/20'}`} title="Chat">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </button>
              <span className="text-[8px] text-white/20 font-bold">C</span>
            </div>
          )}
        </div>

        {/* Right Side: New/Skip */}
        <div className="flex flex-col items-center gap-1">
          <button onClick={handleSkip} className="relative px-6 py-2.5 rounded-xl bg-[#9a6700] hover:bg-[#bf8700] text-white font-bold text-sm transition-all active:scale-95 shadow-lg shadow-amber-900/20" aria-label="Skip">
            {status === 'searching' ? 'Cancel' : 'New'}
          </button>
          <span className="text-[9px] uppercase tracking-tighter text-white/30 font-bold">ESC</span>
        </div>
      </footer>

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[200] px-4 py-2 rounded-lg bg-black/90 border border-white/10 text-sm text-white shadow-xl animate-fade-in">
          {toast}
        </div>
      )}

      {active3dEmoji && (
        <div className="pointer-events-none fixed inset-0 z-[300] flex items-center justify-center overflow-hidden bg-black/40 backdrop-blur-sm">
          <div className="text-[150px] sm:text-[250px] drop-shadow-[0_0_80px_rgba(255,255,255,0.3)] animate-bounce" style={{ filter: 'drop-shadow(0px 10px 40px rgba(0,0,0,0.5))' }}>
            {active3dEmoji.emoji}
          </div>
          <div className="absolute top-1/4 bg-amber-500/90 text-black px-6 py-2 rounded-full font-black text-sm uppercase tracking-widest shadow-2xl animate-fade-in-up">
            {active3dEmoji.nickname || 'Someone'} sent a reaction!
          </div>
        </div>
      )}

      {showEmojiPicker && (
        <div className="fixed bottom-24 right-4 sm:right-0 sm:mr-4 z-[150] p-4 rounded-2xl bg-[#111] border border-white/10 shadow-2xl shrink-0 w-[300px] animate-fade-in-up">
          <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
            <h3 className="text-xs font-black uppercase text-amber-500 tracking-wider">Premium 3D Emojis</h3>
            <span className="text-[10px] font-bold text-white/50 bg-black/40 px-2 py-0.5 rounded">5 Coins</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {EMOJIS_3D.map(e => (
              <button key={e.char} onClick={() => send3dEmoji(e.char)} className="aspect-square rounded-xl bg-white/5 hover:bg-amber-500/20 hover:scale-110 flex flex-col items-center justify-center text-2xl transition-all border border-transparent hover:border-amber-500/30 group">
                <span className="group-hover:animate-bounce">{e.char}</span>
                <span className="text-[8px] text-white/30 group-hover:text-amber-500/80 mt-1 uppercase font-bold">{e.label || 'Send'}</span>
              </button>
            ))}
          </div>
          {balance < 5 && <div className="mt-3 text-[10px] text-center text-rose-400 font-medium bg-rose-500/10 py-1 rounded">Not enough coins!</div>}
        </div>
      )}
      {/* Coin History Modal */}
      {showCoinHistory && (
        <div className="absolute inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#111] border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-2">
              <h3 className="text-sm font-black uppercase tracking-widest text-amber-500">🪙 Coin History</h3>
              <button onClick={() => setShowCoinHistory(false)} className="text-white/40 hover:text-white">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-2">
              {(history || []).length === 0 ? (
                <p className="text-center text-xs text-white/40 my-8">No transaction history yet.</p>
              ) : (
                (history || []).map((h) => (
                  <div key={h.id} className="flex justify-between items-center p-3 rounded-xl bg-white/5">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white/90">{h.reason}</span>
                      <span className="text-[10px] text-white/40">{new Date(h.date).toLocaleString()}</span>
                    </div>
                    <span className={`text-sm font-bold ${h.amount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {h.amount > 0 ? '+' : ''}{h.amount}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Premium Video Filters Modal */}
      {showFilterMenu && (
        <div className="absolute inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-[280px] bg-[#111] border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2"><span className="text-amber-500">🪙</span> Premium Filters</h3>
              <button onClick={() => setShowFilterMenu(false)} className="text-white/40 hover:text-white">✕</button>
            </div>
            <p className="text-[10px] text-white/40 text-center leading-relaxed">
              Premium filters cost <strong className="text-amber-500">12 coins per minute</strong> while active. You will be asked for auto-deduct access.
            </p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {VIDEO_FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => handleFilterSelect(f.id)}
                  className={`py-3 rounded-xl border text-xs font-bold transition-all ${activeFilter === f.id ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg' : 'bg-white/5 border-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function RemoteVideoComponent({ stream, muted, strangerFilter, strangerBlur }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => { });
    }
  }, [stream]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className="absolute inset-0 w-full h-full object-cover transition-all duration-300"
      style={{ filter: strangerBlur && strangerFilter === 'none' ? 'blur(20px)' : (strangerFilter !== 'none' ? strangerFilter : 'none') }}
    />
  );
}
