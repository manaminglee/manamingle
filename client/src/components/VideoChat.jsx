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
  const [status, setStatus] = useState('searching'); // Start in searching mode by default when mounted from landing
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
      // Auto-reconnect on remote user leave
      setTimeout(() => {
        if (roomIdRef.current) {
           handleSkip();
        }
      }, 1000);
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
  }, [socket, onJoined, doOffer, doAnswer, addIce]);

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
    <div className="h-screen flex flex-col bg-[#070811] text-white overflow-hidden relative font-sans">
      {/* AI SAFETY LAYER - Moved up above everything */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[200] pointer-events-none px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-2 animate-pulse transition-opacity duration-1000 backdrop-blur-md">
        <div className="text-sm animate-bounce origin-bottom">🕵️</div>
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">AI Safety Monitor Active</span>
      </div>

      {/* 🌐 COUNTRY DISCOVERY BANNER */}
      {countryBanner && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[150] animate-slide-in-up pointer-events-none">
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-black/80 border border-indigo-500/40 backdrop-blur-xl shadow-2xl">
            <span className="text-2xl">{countryToFlag(countryBanner.myCountry) || '🌏'}</span>
            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Global Connection!</p>
              <p className="text-xs text-white/70 font-medium">You connected across the world 🌍</p>
            </div>
            <span className="text-2xl">{countryToFlag(countryBanner.peerCountry) || '🌎'}</span>
          </div>
        </div>
      )}

      {/* ⌨️ TYPING INDICATOR */}
      {strangerTyping && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[110] pointer-events-none animate-slide-in-up">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#1a1d30] border border-white/10 shadow-xl backdrop-blur-md">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs text-white/50 font-medium">Stranger is typing</span>
          </div>
        </div>
      )}

      {/* WAVE OVERLAY */}
      {showWave && (
        <div className="fixed inset-0 z-[200] pointer-events-none flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 animate-3d-emoji-pop">
            <span className="text-8xl drop-shadow-2xl" style={{ filter: 'drop-shadow(0 0 30px rgba(251,191,36,0.8))' }}>👋</span>
            <span className="px-5 py-2 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-sm uppercase tracking-widest shadow-2xl backdrop-blur-md">
              Someone waved!
            </span>
          </div>
        </div>
      )}

      {/* MOOD INDICATOR */}
      {moodEmoji && status === 'connected' && (
        <div className="fixed top-20 right-4 z-[90] pointer-events-none flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-xl animate-slide-in-up">
          <span className="text-2xl">{moodEmoji}</span>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/40">Stranger's Mood</p>
            <p className="text-xs font-bold text-white/80">
              {moodEmoji === '😂' ? 'Having fun!' : moodEmoji === '😮' ? 'Surprised!' : moodEmoji === '🤔' ? 'Thinking...' : 'Positive!'}
            </p>
          </div>
        </div>
      )}

      {/* GOOD VIBES MATCH */}
      {goodVibesMatch && (
        <div className="fixed inset-0 z-[190] pointer-events-none flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 animate-3d-emoji-pop">
            <span className="text-7xl">🤝</span>
            <div className="text-center px-6 py-4 rounded-3xl bg-indigo-500/20 border border-indigo-500/40 backdrop-blur-xl shadow-2xl">
              <p className="font-black text-white text-lg uppercase tracking-widest">Mutual Good Vibes!</p>
              <p className="text-white/60 text-sm mt-1">You both had a great conversation</p>
            </div>
          </div>
        </div>
      )}

      {/* INTEREST CARD MODAL */}
      {showInterestCard && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setShowInterestCard(false)}>
          <div className="bg-[#12152a] border border-indigo-500/30 rounded-3xl p-6 max-w-xs w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <span className="text-3xl">🃏</span>
              <h3 className="font-black text-white text-lg mt-2 uppercase tracking-widest">Your Interest Card</h3>
              <p className="text-white/40 text-xs mt-1">Shared anonymously — no personal info</p>
            </div>
            <div className="space-y-2 mb-4">
              {(interest ? [interest, 'conversations', 'global culture'] : ['conversations', 'global culture', 'ideas']).map((tag, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                  <span className="text-indigo-400 text-sm">#{i + 1}</span>
                  <span className="text-white font-bold capitalize text-sm">{tag}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                if (socket && roomIdRef.current) {
                  socket.emit('send-message', { roomId: roomIdRef.current, text: `🃏 Interest Card: I'm into ${interest || 'general conversations'}, global culture, and sharing ideas!` });
                }
                setShowInterestCard(false);
              }}
              className="w-full py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-black text-sm uppercase tracking-widest transition-all active:scale-95"
            >
              Share with Stranger (3 Coins)
            </button>
            <button onClick={() => setShowInterestCard(false)} className="w-full mt-2 py-2 text-white/30 text-xs hover:text-white/60 transition">Cancel</button>
          </div>
        </div>
      )}

      {/* POST-CHAT RATING MODAL */}
      {showRating && !ratingDone && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#12152a] border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center">
            <span className="text-4xl">⭐</span>
            <h3 className="font-black text-white text-lg mt-3 uppercase tracking-widest">Rate This Conversation</h3>
            <p className="text-white/40 text-sm mt-1 mb-5">How was your chat experience? (anonymous)</p>
            <div className="flex justify-center gap-3 mb-4">
              {[1, 2, 3, 4, 5].map(s => (
                <button
                  key={s}
                  onClick={() => submitRating(s)}
                  className="text-3xl hover:scale-125 transition-transform active:scale-95"
                  title={['Terrible', 'Bad', 'Okay', 'Good', 'Amazing!'][s - 1]}
                >
                  ⭐
                </button>
              ))}
            </div>
            {aiSummary && (
              <div className="mt-3 p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-left">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-2">🤖 AI Chat Summary</p>
                <p className="text-sm text-white/70">{aiSummary}</p>
              </div>
            )}
            <button onClick={() => { setShowRating(false); setRatingDone(true); }} className="mt-4 text-white/30 text-xs hover:text-white/60 transition">Skip Rating</button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="app-header">
        <div className="flex items-center gap-3">
          <button
            id="video-back-btn"
            type="button"
            onClick={handleBack}
            className="btn btn-icon shrink-0"
            title="Back to home"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="logo-icon text-sm shrink-0">M</div>
          <div className="min-w-0">
            <h1 className="font-bold text-white leading-none truncate">Mana Mingle</h1>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'rgba(232,234,246,0.45)' }}>
              {status === 'idle' ? 'Ready to Video' : status === 'searching' ? 'Finding partner...' : 'Connected Anonymous'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap justify-end min-w-0 pr-2">
          {connected && (
            <>
              {/* COMPACT MOBILE NAX / STATUS BAR */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="hidden sm:block">
                  <CoinBadge balance={balance} streak={streak} canClaim={canClaim} nextClaim={nextClaim ?? 0} claimCoins={claimCoins} compact />
                </div>
                <div className="flex sm:hidden items-center gap-1 bg-black/20 px-2 py-1 rounded-full border border-white/5 backdrop-blur-sm">
                   <span className="text-[10px] font-black text-amber-400">🪙 {balance}</span>
                </div>

                <div
                  className={`flex px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-tighter gap-1 items-center shrink-0 ${connectionQuality === 'good'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : connectionQuality === 'ok'
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}
                >
                  <div className={`w-1 h-1 rounded-full ${connectionQuality === 'good' ? 'bg-emerald-400' : connectionQuality === 'ok' ? 'bg-amber-300' : 'bg-rose-300'} animate-pulse`} />
                  {latency ?? '—'}ms
                </div>

                <button
                  type="button"
                  onClick={() => setIsTranslatorActive(!isTranslatorActive)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border transition-all ${isTranslatorActive ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-white/5 border-white/10 text-white/30'}`}
                >
                  <span className={`w-1 h-1 rounded-full ${isTranslatorActive ? 'bg-indigo-400 animate-pulse' : 'bg-white/20'}`} />
                  {isTranslatorActive ? 'AI ON' : 'AI'}
                </button>
              </div>

              <div className="online-pill hidden sm:flex shrink-0">
                <div className="live-dot shrink-0" style={{ width: 6, height: 6 }} />
                <span className="truncate text-[11px] sm:text-sm">{onlineCount?.toLocaleString()} online</span>
              </div>
            </>
          )}
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {adsEnabled && (
          <div className="w-full bg-white/5 border border-white/10 p-2 text-center text-white/30 text-[10px] font-mono uppercase tracking-widest hidden sm:flex items-center justify-center">
            [Advertisement Placeholder Banner]
          </div>
        )}
        <div className="flex-1 flex flex-col sm:flex-row min-h-0 overflow-hidden relative">
          {/* VIDEO CONTAINER (uMingle Split Style) */}
          <div className={`flex-1 min-h-0 relative flex sm:p-4 gap-0 sm:gap-4 ${showChat ? 'flex-col lg:flex-none lg:w-[480px] sm:w-[400px]' : 'flex-col sm:flex-row'}`}>
            {/* SLOT 1: REMOTE (STRANGER) */}
            <div className={`bg-[#07080f] overflow-hidden transition-all duration-500 ${showChat ? 'absolute inset-0 sm:relative sm:flex-1 sm:rounded-tl-[40px] sm:rounded-br-[40px] sm:border-2 border-indigo-500/30' : 'relative flex-1 sm:rounded-3xl sm:border-2 border-white/5'}`}>
              {status === 'connected' && peer?.stream ? (
                <>
                  <RemoteVideoComponent stream={peer.stream} muted={mutedStranger} />
                  <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-md">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-black text-white/90 uppercase tracking-widest">{countryToFlag(peer.country)} Stranger</span>
                    {/* NETWORK INDICATOR REMOTE */}
                    <div className="flex gap-0.5 ml-1">
                       <div className="w-1 h-2 bg-emerald-500/80 rounded-[1px]" />
                       <div className="w-1 h-2.5 bg-emerald-500/80 rounded-[1px]" />
                       <div className="w-1 h-3 bg-emerald-500/80 rounded-[1px]" />
                    </div>
                  </div>
                  <div className="absolute top-4 right-4 z-20 flex gap-1.5">
                    <button type="button" onClick={() => setMutedStranger(!mutedStranger)} className={`w-8 h-8 flex items-center justify-center rounded-lg bg-black/40 border border-white/10 text-white/60 hover:text-white transition-all ${mutedStranger ? 'text-amber-400' : ''}`}>
                      {mutedStranger ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>}
                    </button>
                    <button type="button" onClick={handleSkip} className="w-8 h-8 flex items-center justify-center rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-400 hover:bg-rose-500 hover:text-white transition-all">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
                    </button>
                  </div>
                </>
              ) : status === 'searching' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-[#0c0e1a]/90 backdrop-blur-sm">
                  <div className="relative w-32 h-32 flex items-center justify-center">
                    {/* Earth Animation */}
                    <div className="absolute inset-0 rounded-full bg-indigo-900/20 border border-indigo-500/20 overflow-hidden shadow-[0_0_50px_rgba(99,102,241,0.2)]">
                      <div className="absolute inset-0 bg-[url('https://upload.wikimedia.org/wikipedia/commons/c/c3/World_map_blue_dotted.svg')] bg-[length:200%] bg-center opacity-30 animate-[spin_30s_linear_infinite]" />
                    </div>
                    {/* Pulsing Rings */}
                    <div className="absolute inset-0 rounded-full border border-cyan-500/10 animate-ping" />
                    <div className="absolute inset-4 rounded-full border border-indigo-500/10 animate-ping" style={{ animationDelay: '0.5s' }} />
                    
                    {/* Network Nodes */}
                    <div className="absolute inset-0 rounded-full animate-[spin_15s_linear_infinite_reverse]">
                      <div className="absolute top-4 left-6 w-1 h-1 bg-white/80 rounded-full shadow-[0_0_8px_#fff]" />
                      <div className="absolute top-12 right-4 w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_10px_#22d3ee]" />
                      <div className="absolute bottom-6 left-10 w-1 h-1 bg-indigo-400 rounded-full shadow-[0_0_8px_#818cf8]" />
                    </div>
                    
                    {/* Radar Sweep */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-transparent to-indigo-500/20 animate-spin" style={{ animationDuration: '3s' }} />
                    <div className="absolute z-10 w-4 h-4 rounded-full bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,1)] animate-pulse" />
                  </div>
                  <div className="text-center z-10">
                    <div className="flex items-end justify-center text-xs font-black text-white/40 uppercase tracking-[0.4em] drop-shadow-lg">
                      <span>Searching</span>
                      <span className="flex tracking-[0.2em] ml-2 text-indigo-400">
                        <span className="animate-[bounce_1s_infinite_0ms]">.</span>
                        <span className="animate-[bounce_1s_infinite_150ms]">.</span>
                        <span className="animate-[bounce_1s_infinite_300ms]">.</span>
                      </span>
                    </div>
                    <p className="mt-2 text-[8px] font-bold text-white/20 uppercase tracking-[0.2em]">Connecting to global nodes</p>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#07080f]">
                  <p className="text-xs font-black uppercase tracking-widest text-white/20">Press Start to Begin</p>
                </div>
              )}
            </div>

            {/* SLOT 2: LOCAL (YOU) */}
            <div 
              onClick={showChat ? togglePip : undefined}
              className={`
                bg-[#07080f] overflow-hidden transition-all duration-500 z-30
                ${showChat 
                  ? `absolute w-28 h-40 rounded-3xl border-2 border-indigo-500/50 cursor-pointer shadow-2xl sm:inset-auto sm:relative sm:w-auto sm:h-auto sm:flex-1 sm:rounded-tl-[40px] sm:rounded-br-[40px] sm:border-indigo-500/30 sm:cursor-auto sm:shadow-none ${pipPos === 'tl' ? 'top-4 left-4' : pipPos === 'tr' ? 'top-4 right-4' : pipPos === 'bl' ? 'bottom-24 left-4' : 'bottom-24 right-4'}`
                  : 'relative flex-1 sm:rounded-3xl sm:border-2 border-white/5 cursor-auto'
                }
              `}
            >
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] transition-all duration-700 ${cameraOff ? 'opacity-20' : ''}`}
                style={cameraBlur ? { filter: 'blur(15px)', transform: 'scaleX(-1)' } : {}}
              />
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-white/10 backdrop-blur-md">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-xs font-black text-white/90 uppercase tracking-widest">You</span>
                {/* NETWORK INDICATOR LOCAL */}
                <div className="flex gap-0.5 ml-1">
                   <div className="w-1 h-2 bg-blue-500/80 rounded-[1px]" />
                   <div className="w-1 h-2.5 bg-blue-500/80 rounded-[1px]" />
                   <div className="w-1 h-3 bg-blue-500/80 rounded-[1px]" />
                </div>
              </div>

              {/* VERTICAL CONTROL BAR (Right Side) */}
              <div className="absolute top-1/2 right-3 -translate-y-1/2 z-30 flex flex-col items-center gap-3 px-2 py-4 rounded-full bg-black/5 border border-white/5 backdrop-blur-xl shadow-2xl justify-center pointer-events-auto scale-[0.8] origin-right transition-all hover:bg-black/10">
                  {(status === 'idle' || status === 'disconnected') ? (
                    <button onClick={handleStart} className="w-10 h-10 flex items-center justify-center rounded-full bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)] animate-pulse" title="Start">▶️</button>
                  ) : (
                    <>
                      <button id="video-skip-btn" onClick={(e) => { e.stopPropagation(); handleSkip(); }} className="w-10 h-10 flex items-center justify-center rounded-full bg-amber-500 text-white shadow-lg active:scale-90 transition-all outline-none group relative overflow-hidden" title="Next Stranger">
                        <span className="z-10 text-lg font-bold">⏭️</span>
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent" />
                        <div className="absolute right-full mr-3 px-2 py-1 rounded bg-black/80 text-[8px] font-black uppercase tracking-widest text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">Next Stranger</div>
                      </button>
                      <div className="w-5 h-[1px] bg-white/5" />
                      <button onClick={(e) => { e.stopPropagation(); toggleCamera(); }} title="Cam" className={`w-9 h-9 flex items-center justify-center rounded-full transition-all outline-none border ${cameraOff ? 'bg-rose-500 border-rose-400 text-white' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'}`}>
                        {cameraOff ? '📹' : '📸'}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setCameraBlur(!cameraBlur); }} title="Blur" className={`w-9 h-9 flex items-center justify-center rounded-full transition-all outline-none border ${cameraBlur ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'}`}>
                        🫥
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setShowChat(!showChat); }} title="Chat" className={`w-9 h-9 flex items-center justify-center rounded-full transition-all outline-none border ${showChat ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20'}`}>
                        💬
                      </button>
                      <div className="w-5 h-[1px] bg-white/5" />
                      <button onClick={(e) => { e.stopPropagation(); handleStop(); }} title="Stop" className="w-9 h-9 flex items-center justify-center rounded-full bg-rose-500/5 border border-rose-500/10 text-rose-500/60 hover:bg-rose-500 hover:text-white hover:border-rose-400 transition-all outline-none group relative">
                        🛑
                        <div className="absolute right-full mr-3 px-2 py-1 rounded bg-black/80 text-[8px] font-black uppercase tracking-widest text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap italic text-rose-200">End Session</div>
                      </button>
                    </>
                  )}
              </div>
            </div>


          </div>

          {/* CHAT PANEL (Overlay Mobile) */}
          {showChat && (
            <div className={`absolute inset-0 z-40 flex flex-col pointer-events-none sm:pointer-events-auto sm:static sm:flex-1 sm:h-full sm:bg-[#0d0f1c] sm:border-l sm:border-white/5 sm:z-40 animate-slide-in-right sm:animate-none`}>
              <div className="hidden sm:flex p-4 border-b border-white/5 items-center justify-between">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Chat Room</span>
                <button onClick={() => setShowChat(false)} className="text-white/20 hover:text-white">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 pointer-events-none" id="video-chat-messages">
                {(messages.length === 0 || !isConnected) && (
                  <div className="hidden sm:block p-6 rounded-2xl bg-white/5 border border-white/5 space-y-3 mt-4">
                    <p className="text-xs text-white/40 font-black uppercase tracking-widest">{isConnected ? "👋 Start the vibe!" : "🔒 Connect to Chat"}</p>
                    <p className="text-[10px] text-white/20 uppercase font-bold leading-relaxed">No nudity • No harassment • Have fun</p>
                  </div>
                )}
                <div className="flex-1" /> {/* Push content down if empty */}
                {messages.map((m, i) => {
                  const isMe = m.socketId === socket.id || m.fromSelf;
                  if (now - m.ts > 30000) return null; // vanish in 30s
                  return (
                    <div key={m.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-message-pop`}>
                      <div className={`px-4 py-2.5 rounded-2xl text-sm ${isMe ? 'bg-indigo-500 text-white rounded-tr-none' : 'bg-black/60 backdrop-blur-md text-white/90 rounded-tl-none border border-white/10'}`}>
                        {m.text}
                      </div>
                      <span className="text-[8px] font-black uppercase text-white/40 mt-1 px-1 drop-shadow-md">{isMe ? 'You' : 'Stranger'} • {formatTime(m.ts)}</span>
                    </div>
                  );
                })}
                <div ref={chatEndRef} className="pb-32 sm:pb-2" />
              </div>

              <div className="p-4 sm:bg-[#0a0c16] sm:border-t sm:border-white/5 pointer-events-auto bg-gradient-to-t from-black/90 via-black/50 to-transparent sm:bg-none z-[50]">
                {/* Mobile Quick Controls above text field */}
                <div className="flex sm:hidden items-center justify-center gap-3 mb-4 scale-90">
                     <button onClick={handleSkip} className="w-10 h-10 flex items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-500 font-black text-[10px] uppercase">Skip</button>
                     <button onClick={toggleCamera} className={`w-10 h-10 flex items-center justify-center rounded-xl ${cameraOff ? 'bg-rose-500 text-white' : 'bg-white/10 text-white/80'}`}>{cameraOff ? '📹' : '📸'}</button>
                     <button onClick={() => setCameraBlur(!cameraBlur)} className={`w-10 h-10 flex items-center justify-center rounded-xl ${cameraBlur ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white/80'}`}>🫥</button>
                     <button onClick={handleStop} className="w-10 h-10 flex items-center justify-center rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-500 font-black text-[10px] uppercase">Stop</button>
                </div>
                
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    id="video-chat-input"
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={(e) => e.key === 'Enter' && sendMsg()}
                    placeholder={isConnected ? "Say hello..." : "Connecting..."}
                    disabled={!isConnected}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500/50 outline-none transition-all placeholder:text-white/20"
                  />
                  <button id="video-chat-send-btn" onClick={sendMsg} disabled={!isConnected || !input.trim()} className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[120] px-4 py-2 rounded-full bg-black/80 border border-white/10 text-xs sm:text-sm text-white/90 shadow-lg">
          {toast}
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
