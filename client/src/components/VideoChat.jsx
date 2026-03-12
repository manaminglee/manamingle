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
import { ProFeaturesMenu } from './ProFeaturesMenu';
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
  { char: '🔥', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.webp' },
  { char: '💎', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f48e/512.webp' },
  { char: '🚀', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f680/512.webp' },
  { char: '✨', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/2728/512.webp' },
  { char: '🎉', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f389/512.webp' },
  { char: '❤️', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/2764_fe0f/512.webp' },
  { char: '😂', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f602/512.webp' },
  { char: '👑', url: 'https://fonts.gstatic.com/s/e/notoemoji/latest/1f451/512.webp' },
];

const API_BASE = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : '');

export function VideoChat({ socket, connected, country, onlineCount, interest = 'general', nickname = 'Anonymous', adsEnabled = false, onBack, onJoined, onFindNewPartner, coinState }) {
  const { balance, streak, canClaim, nextClaim, claimCoins } = coinState;
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
  const [myCountry, setMyCountry] = useState(country);
  const [partnerLeft, setPartnerLeft] = useState(false);
  const [showMatchCelebration, setShowMatchCelebration] = useState(false);
  const [progressiveTooltip, setProgressiveTooltip] = useState(0); // 0=hello, 1=reaction, 2=AI spark, -1=dismissed
  const [suggestedIcebreaker] = useState(() => {
    const pool = AI_ICEBREAKERS.general;
    return pool[Math.floor(Math.random() * pool.length)] || "What's the best movie you watched recently?";
  });
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
    if (status === 'connected' && messages.filter(m => !m.system).length > 2) {
      setShowRating(true);
      generateAiSummary(messages);
    }
    if (socket) {
      if (roomIdRef.current) socket.emit('leave-room', { roomId: roomIdRef.current });
      else socket.emit('cancel-find-partner');
    }
    clearRoom();
    setStatus('searching');
    setGoodVibesSent(false); setGoodVibesMatch(false); setCameraBlur(false);
    setTimeout(() => {
      if (status !== 'idle') {
        socket?.emit('find-partner', { mode: 'video', interest: interest || 'general', nickname: 'Anonymous' });
        onFindNewPartner?.();
      }
    }, 100);
  };

  const handleStop = () => {
    if (status === 'connected' && messages.filter(m => !m.system).length > 2) {
      setShowRating(true);
      generateAiSummary(messages);
    }
    if (roomIdRef.current && socket) socket.emit('leave-room', { roomId: roomIdRef.current });
    socket?.emit('cancel-find-partner');
    clearRoom();
    setStatus('idle');
    setGoodVibesSent(false); setGoodVibesMatch(false); setCameraBlur(false);
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

  useEffect(() => {
    if (status === 'connected') {
      setShowMatchCelebration(true);
      setProgressiveTooltip(0);
      setTimeout(() => setShowMatchCelebration(false), 1200);
      setTimeout(() => inputRef.current?.focus(), 500);
      playConnectSound();
    } else if (status === 'disconnected') {
      playDisconnectSound();
    }
  }, [status]);

  // Progressive feature tooltips: 0=hello, 20s=reaction, 60s=AI spark
  useEffect(() => {
    if (status !== 'connected' || progressiveTooltip < 0) return;
    if (connectedSecs >= 60 && progressiveTooltip < 2) setProgressiveTooltip(2);
    else if (connectedSecs >= 20 && progressiveTooltip < 1) setProgressiveTooltip(1);
  }, [status, connectedSecs, progressiveTooltip]);

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
      // Smooth transition: 400ms then auto-find next
      setTimeout(() => {
        setPartnerLeft(false);
        setStatus('searching');
        socket.emit('find-partner', { mode: 'video', interest: interest || 'general', nickname: 'Anonymous' });
        onFindNewPartner?.();
      }, 450);
    };

    const onWaiting = () => setStatus('searching');
    const onSystemMsg = (data) => setMessages((m) => [...m, { id: Date.now(), system: true, text: `📢 ADMIN: ${data.message}`, ts: Date.now() }]);

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
      // Optimistically play locally
      setActive3dEmoji({ emoji, nickname, socketId: socket.id });
      setTimeout(() => setActive3dEmoji(null), 3000);
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
    <div className="h-screen flex flex-col bg-[#05060b] text-slate-100 overflow-hidden relative font-sans select-none">
      {/* 1. LAYER: HEADER */}
      <header className="h-16 sm:h-20 px-4 sm:px-8 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-2xl z-[100] shrink-0">
        <div className="flex items-center gap-3 sm:gap-6">
          <button onClick={handleBack} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all active:scale-90" title="Go Back">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500 shadow-lg shadow-indigo-500/30 flex items-center justify-center font-black text-sm">M</div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-black uppercase tracking-[0.2em]">Mana Mingle</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-widest">{onlineCount?.toLocaleString()} Users Online</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/5 border border-white/5 font-black text-[10px] uppercase tracking-widest">
            <span className={connectionQuality === 'good' ? 'text-emerald-400' : connectionQuality === 'ok' ? 'text-amber-400' : 'text-rose-400'}>
              {connectionQuality === 'good' ? '🟢 Excellent' : connectionQuality === 'ok' ? '🟡 Fair' : connectionQuality === 'poor' ? '🔴 Poor' : '--'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-xs sm:text-sm font-black text-amber-500">🪙 {balance}</span>
          </div>

          <ProFeaturesMenu />
          <button onClick={() => setIsTranslatorActive(!isTranslatorActive)} className={`px-3 py-2 rounded-2xl border transition-all text-[10px] font-black uppercase tracking-widest ${isTranslatorActive ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/30' : 'bg-white/5 border-white/10 text-slate-500'}`}>
            {isTranslatorActive ? 'AI ON' : 'AI'}
          </button>
        </div>
      </header>

      {/* 2. LAYER: VIDEO / SEARCH AREA */}
      <main className="flex-1 relative flex flex-col md:flex-row min-h-0 overflow-hidden p-2 sm:p-4 gap-2 sm:gap-4">

        {/* Floating AI Safety Status */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[110] pointer-events-none">
          <div className="px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-xl flex items-center gap-2 animate-fade-in shadow-2xl shadow-black/50">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">AI Safety Monitor Active</span>
          </div>
        </div>

        {/* Video Containers Floor */}
        <div className={`flex-1 relative flex flex-col sm:flex-row gap-2 sm:gap-4 transition-all duration-700 ${showChat ? 'md:flex-none md:w-[65%]' : 'w-full'}`}>

          {/* Main Display (Remote / Searching / Idle) */}
          <div className={`relative flex-1 bg-black/40 rounded-[2.5rem] border border-white/5 overflow-hidden transition-all duration-500 ${status === 'connected' ? 'shadow-2xl' : ''}`}>

            {status === 'idle' ? (
              /* IDLE / START SCREEN */
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-[#0a0c16]">
                {cameraError ? (
                  <div className="flex flex-col items-center text-center max-w-sm animate-fade-in">
                    <div className="w-20 h-20 mb-6 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-4xl">📷</div>
                    <h3 className="text-lg font-black text-white uppercase tracking-widest">We need camera access</h3>
                    <p className="mt-2 text-sm text-slate-500">To start chatting, please allow camera and microphone permissions.</p>
                    <button onClick={async () => { setCameraError(null); try { const base = { video: selectedVideoDeviceId ? { deviceId: { exact: selectedVideoDeviceId } } : true, audio: selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : true }; const s = await navigator.mediaDevices.getUserMedia(base); localStreamRef.current = s; setLocalStream(s); if (localVideoRef.current) localVideoRef.current.srcObject = s; } catch (e) { setCameraError('Permission denied. Please allow camera in your browser settings.'); } }} className="mt-6 px-8 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-black uppercase tracking-widest transition-all active:scale-95">
                      Allow Camera
                    </button>
                  </div>
                ) : (
                <>
                <div className="w-24 h-24 mb-8 rounded-[2rem] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-4xl shadow-2xl animate-bounce">👋</div>
                <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tighter text-center max-w-md">Ready to meet someone new?</h2>
                <p className="mt-4 text-slate-500 text-sm sm:text-base text-center max-w-sm uppercase font-bold tracking-widest">Connect with verified mingle nodes globally.</p>

                <div className="mt-10 w-full max-w-sm flex flex-col gap-4">
                  <div className="flex flex-wrap justify-center gap-2">
                    {interestTags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => toggleInterestTag(tag)}
                        className={`px-4 py-2 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest ${selectedInterests.includes(tag) ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/20'}`}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                  <button onClick={handleStart} className="w-full h-16 rounded-3xl bg-indigo-500 hover:bg-indigo-600 text-white font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-500/40 active:scale-95 transition-all text-sm mt-4">
                    Start Mingling
                  </button>
                </div>
                </>
                )}
              </div>
            ) : status === 'searching' ? (
              /* SEARCHING SCREEN */
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070811]">
                <div className="relative w-48 h-48 sm:w-64 sm:h-64 flex items-center justify-center">
                  {/* Modern Pulse Rings */}
                  <div className="absolute inset-0 rounded-full border border-indigo-500/10 animate-ping" />
                  <div className="absolute inset-8 rounded-full border border-indigo-500/20 animate-ping" style={{ animationDelay: '0.4s' }} />

                  {/* Spinning Core */}
                  <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-indigo-900/10 border border-white/5 p-2 overflow-hidden shadow-[0_0_80px_rgba(99,102,241,0.2)]">
                    <div className="absolute inset-0 bg-[url('https://upload.wikimedia.org/wikipedia/commons/c/c3/World_map_blue_dotted.svg')] bg-[length:300%] bg-center opacity-40 animate-[spin_40s_linear_infinite]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-indigo-500/20 to-transparent" />
                  </div>

                  {/* Moving Nodes */}
                  <div className="absolute inset-0 animate-[spin_20s_linear_infinite]">
                    <div className="absolute top-4 left-1/4 w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_15px_#818cf8]" />
                    <div className="absolute bottom-8 right-1/4 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
                  </div>
                </div>

                <div className="mt-8 text-center">
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-[0.5rem] flex items-center justify-center">
                    Searching
                    <span className="flex items-center gap-1 ml-4">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </span>
                  </h3>
                  <p className="mt-4 text-[9px] font-bold text-slate-500 uppercase tracking-widest">Establishing secure peer connection...</p>
                </div>
              </div>
            ) : (
              /* CONNECTED VIEW */
              <>
                <RemoteVideoComponent stream={peer?.stream} muted={mutedStranger} />

                {/* Match Celebration */}
                {showMatchCelebration && (
                  <div className="absolute inset-0 z-25 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-fade-in pointer-events-none">
                    <div className="px-8 py-4 rounded-3xl bg-indigo-500/90 border border-indigo-400/50 shadow-2xl animate-slide-in-up text-center">
                      <span className="text-3xl block mb-1">🎉</span>
                      <span className="text-lg font-black text-white uppercase tracking-widest">Connected!</span>
                    </div>
                  </div>
                )}

                {/* Stranger Info Badge */}
                <div className="absolute top-6 left-6 z-20 flex items-center gap-3 px-4 py-2 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl transition-transform hover:scale-105">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-white/90 uppercase tracking-widest leading-none mb-1">Stranger Found</span>
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">{countryToFlag(peer?.country)} {peer?.nickname || 'Anonymous'}</span>
                  </div>
                </div>

                {/* Report Button */}
                <div className="absolute top-6 right-6 z-20">
                  <button
                    onClick={handleReport}
                    className="w-10 h-10 flex items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all active:scale-95 shadow-xl"
                    title="Report Inappropriate Behavior"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  </button>
                </div>

                {/* Partner Left Overlay */}
                {partnerLeft && (
                  <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in">
                    <div className="bg-[#12152a] border border-white/10 p-8 rounded-[2.5rem] shadow-2xl text-center max-w-xs scale-in">
                      <div className="text-4xl mb-4">👋</div>
                      <h4 className="text-lg font-black uppercase tracking-widest text-white">Partner Disconnected</h4>
                      <p className="mt-2 text-slate-500 text-xs uppercase font-bold tracking-widest">Searching for someone new...</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Local Video PIP - Optimized for Mobile Thumb usage */}
          <div className={`
             absolute w-28 h-40 sm:w-48 sm:h-64 rounded-[2rem] border-2 border-white/10 overflow-hidden z-50 transition-all duration-700 shadow-2xl bg-black/60
             ${status === 'connected' ? (pipPos === 'tl' ? 'top-6 left-6' : pipPos === 'tr' ? 'top-6 right-6' : pipPos === 'bl' ? 'bottom-24 left-6' : 'bottom-24 right-6') : 'relative w-full h-full border-none inset-auto sm:rounded-[2.5rem]'}
             ${status === 'idle' ? 'sm:w-[400px]' : ''}
          `}
            onClick={status === 'connected' ? togglePip : undefined}
          >
            <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover scale-x-[-1] transition-all duration-1000 ${cameraOff ? 'opacity-20' : ''}`} />
            <div className="absolute bottom-4 left-4 z-20 px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 backdrop-blur-md">
              <span className="text-[10px] font-black text-white/90 uppercase tracking-widest">You</span>
            </div>
            {cameraBlur && <div className="absolute inset-0 backdrop-blur-3xl z-10" />}
          </div>
        </div>

        {/* Chat Panel - Sidebar on desktop, slide-up sheet on mobile */}
        {showChat && (
          <div className="flex-1 md:flex-none md:w-[35%] glass-card flex flex-col z-[40] max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:h-[70%] max-md:max-h-[85vh] max-md:rounded-t-[2.5rem] max-md:animate-slide-up-sheet md:relative md:rounded-[1.5rem]">
            <div className="h-14 sm:h-16 px-6 border-b border-white/5 flex items-center justify-between bg-white/5">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-slate-400">Secure Message Link</span>
              <button onClick={() => setShowChat(false)} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:text-white transition-all">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4" id="video-chat-messages">
              {messages.length === 0 && (
                <div className="p-6 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 space-y-4 animate-fade-in">
                  <p className="text-sm font-black text-indigo-400">💬 Start the conversation!</p>
                  <p className="text-xs text-slate-500">Try asking:</p>
                  <p className="text-sm text-slate-300 font-medium italic">&ldquo;{suggestedIcebreaker}&rdquo;</p>
                  <button onClick={() => { setInput(suggestedIcebreaker); inputRef.current?.focus(); }} className="px-4 py-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-xs font-bold hover:bg-indigo-500/30 transition-all active:scale-95">
                    Use this
                  </button>
                </div>
              )}
              {messages.map((m, i) => {
                const isMe = m.socketId === socket.id || m.fromSelf;
                return (
                  <div key={m.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-message-pop`}>
                    <div className={`px-4 py-2.5 rounded-2xl text-sm font-medium ${isMe ? 'bg-indigo-500 text-white rounded-tr-none shadow-lg shadow-indigo-500/20' : 'bg-white/10 text-slate-100 rounded-tl-none border border-white/5'}`}>
                      {m.text}
                    </div>
                    <span className="text-[8px] font-black uppercase text-slate-500 mt-1.5 px-1 tracking-widest">{isMe ? 'You' : 'Strange'} • {formatTime(m.ts)}</span>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            <div className="p-4 sm:p-6 bg-white/5 border-t border-white/5">
              <div className="relative flex items-center gap-2">
                <input ref={inputRef} value={input} onChange={handleInputChange} onKeyDown={(e) => e.key === 'Enter' && sendMsg()} placeholder={isConnected ? "Message..." : "Waiting for match..."} disabled={!isConnected} className="flex-1 h-12 bg-black/40 border border-white/10 rounded-2xl px-5 text-sm outline-none focus:border-indigo-500/50 focus:bg-black/60 transition-all font-medium" />
                <button onClick={sendMsg} disabled={!isConnected || !input.trim()} className="w-12 h-12 rounded-2xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 active:scale-90 transition-all disabled:opacity-50">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. LAYER: ACTION CONTROLS */}
      <footer className="h-20 sm:h-24 px-4 sm:px-12 border-t border-white/5 bg-black/60 backdrop-blur-2xl z-[120] flex items-center justify-center shrink-0">
        <div className="w-full max-w-2xl flex items-center justify-between gap-4 sm:gap-8">
          {/* Main Action Block */}
          <div className="flex-1 flex items-center gap-2 sm:gap-4 h-12 sm:h-14">
            <button onClick={handleSkip} className="h-full px-6 sm:px-10 rounded-3xl bg-amber-500 hover:bg-amber-600 text-white font-black uppercase tracking-[0.2em] shadow-xl shadow-amber-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 group">
              <span className="text-xl group-hover:translate-x-1 transition-transform">⏭️</span>
              <span className="hidden sm:inline text-xs">Skip Stranger</span>
            </button>
            <div className="w-[1px] h-8 bg-white/10 mx-2" />
            <button onClick={toggleCamera} className={`w-12 h-12 sm:w-14 sm:h-14 rounded-3xl flex items-center justify-center transition-all border-2 active:scale-90 ${cameraOff ? 'bg-rose-500 border-rose-400 shadow-lg shadow-rose-500/30 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20'}`} title="Toggle camera">
              {cameraOff ? '📹' : '📸'}
            </button>
            <button onClick={() => setCameraBlur(!cameraBlur)} className={`w-12 h-12 sm:w-14 sm:h-14 rounded-3xl flex items-center justify-center transition-all border-2 active:scale-90 ${cameraBlur ? 'bg-indigo-500 border-indigo-400 shadow-lg shadow-indigo-500/30 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:border-white/20'}`} title="Blur background">
              🫥
            </button>
            <button onClick={() => setShowChat(!showChat)} className={`w-12 h-12 sm:w-14 sm:h-14 rounded-3xl flex items-center justify-center transition-all border-2 active:scale-90 ${showChat ? 'bg-indigo-500 border-indigo-400 shadow-lg shadow-indigo-500/30 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`} title="Toggle chat">
              💬
            </button>
          </div>

          <div className="w-10 sm:w-12 h-[1px] bg-white/10" />

          {/* Stop Button */}
          <button onClick={handleStop} className="w-12 h-12 sm:w-14 sm:h-14 rounded-3xl bg-rose-500/10 border-2 border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all active:scale-90 flex items-center justify-center shadow-lg shadow-rose-500/10">
            <span className="text-xl">🛑</span>
          </button>
        </div>
      </footer>

      {/* Notifications / Toasts */}
      {toast && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl bg-black/90 border border-indigo-500/40 text-sm font-black text-white shadow-2xl animate-fade-in-up uppercase tracking-widest backdrop-blur-xl">
          {toast}
        </div>
      )}

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[150] p-4 glass rounded-[2rem] border border-white/10 flex gap-4 shadow-2xl">
          {EMOJIS_3D.map(e => (
            <button key={e.char} onClick={() => send3dEmoji(e.char)} className="w-12 h-12 rounded-2xl hover:bg-white/10 transition-all active:scale-90 flex items-center justify-center text-3xl">{e.char}</button>
          ))}
        </div>
      )}

      {/* Progressive Feature Tooltip - show after 2s to not overlap Connected celebration */}
      {isConnected && progressiveTooltip >= 0 && (progressiveTooltip > 0 || connectedSecs >= 2) && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-[180] px-4 py-3 rounded-2xl bg-indigo-500/95 border border-indigo-400/50 shadow-2xl animate-slide-in-up flex items-center gap-3 max-w-[280px]">
          <span className="text-lg">{progressiveTooltip === 0 ? '👋' : progressiveTooltip === 1 ? '✨' : '💡'}</span>
          <span className="text-xs font-bold text-white">
            {progressiveTooltip === 0 ? 'Say hello or wave!' : progressiveTooltip === 1 ? 'Try sending a reaction' : 'Use AI spark for conversation ideas'}
          </span>
          <button onClick={() => setProgressiveTooltip(-1)} className="ml-1 w-6 h-6 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center text-white text-xs">✕</button>
        </div>
      )}

      {/* Rating Modal - smooth transition */}
      {showRating && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 modal-backdrop animate-fade-in">
          <div className="modal-box animate-fade-in-up max-w-sm">
            <h3 className="text-lg font-black text-white mb-4">Rate this conversation</h3>
            <div className="flex gap-2 justify-center mb-6">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} onClick={() => submitRating(s)} className="w-12 h-12 rounded-xl bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/30 text-2xl transition-all active:scale-90">
                  ⭐
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 text-center">Your feedback helps improve Mana Mingle</p>
            <button onClick={() => setShowRating(false)} className="mt-4 w-full py-2 rounded-xl bg-white/5 text-slate-400 text-sm font-bold">Skip</button>
          </div>
        </div>
      )}

      {/* AI Summary - smooth transition */}
      {showSummary && aiSummary && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 modal-backdrop animate-fade-in">
          <div className="modal-box animate-fade-in-up max-w-sm">
            <h3 className="text-lg font-black text-indigo-400 mb-3">✨ Chat Summary</h3>
            <p className="text-sm text-slate-300 whitespace-pre-wrap">{aiSummary}</p>
            <button onClick={() => { setShowSummary(false); setAiSummary(null); }} className="mt-6 w-full py-3 rounded-xl bg-indigo-500 text-white font-bold">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function RemoteVideoComponent({ stream, muted }) {
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
      className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
    />
  );
}
