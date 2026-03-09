/**
 * VideoChat – 1:1 anonymous video chat with WebRTC
 * Full Omegle-style: searching→matched→skip
 * Layout: remote video (main) | local video (pip) | side chat
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { countryToFlag } from '../utils/countryFlag';
import { useSocket } from '../hooks/useSocket';
import { useLatency } from '../hooks/useLatency';
import { useIceServers } from '../hooks/useIceServers';

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

export function VideoChat({ interest = 'general', nickname = 'Anonymous', adsEnabled = false, onBack, onJoined, onFindNewPartner, coinState }) {
  const { balance, streak, canClaim, claimCoins } = coinState;
  const { socket, connected, country, onlineCount } = useSocket();
  const { iceServers } = useIceServers();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [roomId, setRoomId] = useState(null);
  const [peer, setPeer] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | searching | connected | disconnected
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [localStream, setLocalStream] = useState(null);
  const latency = useLatency();
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isTranslatorActive, setIsTranslatorActive] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [active3dEmoji, setActive3dEmoji] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const pcRef = useRef(null);
  const roomIdRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const pendingCandidatesRef = useRef(new Map());
  const peerInfoRef = useRef(new Map());
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const isConnected = !!peer && !!roomId;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Get user media on mount
  useEffect(() => {
    let s = null;
    (async () => {
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = s;
        setLocalStream(s);
        if (localVideoRef.current) localVideoRef.current.srcObject = s;
      } catch (err) {
        console.error('Camera/mic error:', err);
      }
    })();
    return () => {
      if (s) s.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  const clearRoom = useCallback(() => {
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    pendingCandidatesRef.current.clear();
    peerInfoRef.current.clear();
    setPeer(null);
    setRoomId(null);
    setMessages([]);
    roomIdRef.current = null;
  }, []);

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
      setPeer((prev) => ({ ...(prev || {}), socketId: remoteId, stream: e.streams[0], nickname: info.nickname || prev?.nickname, country: info.country || prev?.country }));
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
  }, [socket]);

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

  const addIce = useCallback(async (remoteId, candidate) => {
    const pc = peerConnectionsRef.current.get(remoteId);
    if (!pc) {
      const pend = pendingCandidatesRef.current.get(remoteId) || [];
      pend.push(candidate);
      pendingCandidatesRef.current.set(remoteId, pend);
      return;
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      const pend = pendingCandidatesRef.current.get(remoteId) || [];
      for (const c of pend) await pc.addIceCandidate(new RTCIceCandidate(c));
      pendingCandidatesRef.current.set(remoteId, []);
    } catch (err) { console.error('ice error', err); }
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
        if (socket.id < p.socketId) doOffer(p.socketId);
      }
      setStatus('connected');
      onJoined?.(data.roomId);
    };

    const onHistory = (data) => {
      if (data.roomId === roomIdRef.current) setMessages(data.messages || []);
    };

    const onMsg = (data) => {
      if (data.roomId === roomIdRef.current) setMessages((m) => [...m.slice(-100), data]);
    };

    const onUserLeft = () => {
      setPeer((p) => (p ? { ...p, stream: null } : null));
      setStatus('disconnected');
    };

    const onWaiting = () => setStatus('searching');
    const onSystemMsg = (data) => setMessages((m) => [...m, { id: Date.now(), system: true, text: `📢 ADMIN: ${data.message}`, ts: Date.now() }]);

    const onSignal = (data) => {
      const from = data.fromSocketId;
      if (!from || from === socket.id) return;
      if (data.fromNickname || data.fromCountry) {
        peerInfoRef.current.set(from, { nickname: data.fromNickname, country: data.fromCountry });
      }
      if (data.type === 'offer') doAnswer(from, data.signal);
      else if (data.type === 'answer') {
        const pc = peerConnectionsRef.current.get(from);
        pc?.setRemoteDescription(new RTCSessionDescription(data.signal));
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
        const res = await fetch('/api/ai/translate', {
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
      socket.emit('send-3d-emoji', { roomId: roomIdRef.current, emoji });
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
      socket.emit('send-media', { roomId: roomIdRef.current, type: file.type.startsWith('video') ? 'video' : 'image', content: ev.target.result });
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (socket) {
      socket.on('3d-emoji', (data) => {
        setActive3dEmoji(data);
        setTimeout(() => setActive3dEmoji(null), 3000);
      });
      socket.on('media-message', (data) => {
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

  const handleStart = () => {
    if (!socket || !connected) return;
    clearRoom();
    setStatus('searching');
    socket.emit('find-partner', { mode: 'video', interest: interest || 'general', nickname: 'Anonymous' });
  };

  const handleSkip = () => {
    if (roomIdRef.current && socket) socket.emit('leave-room', { roomId: roomIdRef.current });
    else socket?.emit('cancel-find-partner');
    clearRoom();
    setStatus('searching');
    setTimeout(() => {
      socket?.emit('find-partner', { mode: 'video', interest: interest || 'general', nickname: 'Anonymous' });
      onFindNewPartner?.();
    }, 50);
  };

  const handleStop = () => {
    if (roomIdRef.current && socket) socket.emit('leave-room', { roomId: roomIdRef.current });
    socket?.emit('cancel-find-partner');
    clearRoom();
    setStatus('idle');
  };

  const handleBack = () => { handleStop(); onBack?.(); };

  const sendMsg = () => {
    const t = input.trim();
    const r = roomIdRef.current;
    if (!t || !socket || !r) return;
    socket.emit('send-message', { roomId: r, text: t });
    setInput('');
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

  const generateAiSpark = async () => {
    if (isAiGenerating) return;
    setIsAiGenerating(true);
    try {
      const res = await fetch('/api/ai/spark', {
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
    <div className="min-h-screen flex flex-col bg-[#070811] text-white">
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
        <div className="flex items-center gap-3">
          {connected && (
            <>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                  <span className="text-sm">🪙</span>
                  <span className="text-[11px] font-bold text-indigo-300">{balance}</span>
                  <div className="w-px h-3 bg-white/10 mx-0.5" />
                  <span className="text-[10px] font-medium text-white/40">🔥 {streak}d</span>
                </div>
                {canClaim && (
                  <button
                    onClick={claimCoins}
                    className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-black text-[10px] font-black uppercase tracking-tighter rounded-full shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all animate-coin-glow"
                  >
                    <span className="hidden sm:inline">Claim 30 Coins</span>
                    <span className="sm:hidden">+30 🪙</span>
                  </button>
                )}
              </div>
              <div className="hidden sm:flex px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-400 uppercase tracking-tighter gap-1 items-center">
                <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                {latency}ms
              </div>
              <div className="online-pill">
                <div className="live-dot" style={{ width: 7, height: 7 }} />
                <span>{onlineCount?.toLocaleString()} online</span>
              </div>
              <button
                type="button"
                onClick={() => setIsTranslatorActive(!isTranslatorActive)}
                className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all border ${isTranslatorActive ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-white/5 border-white/10 text-white/30'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isTranslatorActive ? 'bg-indigo-400 animate-pulse' : 'bg-white/20'}`} />
                AI Translate
              </button>
            </>
          )}
          <button
            id="toggle-chat-btn"
            type="button"
            onClick={() => setShowChat(!showChat)}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition ${showChat ? 'bg-indigo-500 text-white' : 'bg-white/5 text-realm-muted hover:bg-white/10'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </button>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {adsEnabled && (
          <div className="w-full bg-white/5 border border-white/10 p-2 text-center text-white/30 text-[10px] font-mono uppercase tracking-widest hidden sm:flex items-center justify-center">
            [Advertisement Placeholder Banner]
          </div>
        )}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* VIDEO AREA */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            <div className="flex-1 relative bg-[#05060f] min-h-0">

              {/* IDLE state */}
              {status === 'idle' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-center p-8">
                  <div className="w-28 h-28 rounded-3xl bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center text-5xl">
                    📹
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Ready for Video Chat</h2>
                    <p style={{ color: 'rgba(232,234,246,0.5)' }}>Your camera is ready. Hit Start to meet a stranger.</p>
                  </div>
                  {/* Preview local video in idle */}
                  <div className="w-48 h-36 rounded-2xl overflow-hidden border border-white/10 bg-black">
                    <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
                  </div>
                </div>
              )}

              {active3dEmoji && (
                <div className="absolute inset-0 pointer-events-none z-[100] flex items-center justify-center overflow-hidden">
                  <div className="animate-3d-emoji-pop flex flex-col items-center gap-2">
                    <picture>
                      <source srcSet={active3dEmoji.emoji.url} type="image/webp" />
                      <img src={active3dEmoji.emoji.url} className="w-40 h-40" alt="3d" />
                    </picture>
                    <span className="bg-black/80 px-4 py-1.5 rounded-full text-xs font-bold border border-white/10 shadow-2xl">
                      {active3dEmoji.nickname} sent {active3dEmoji.emoji.char}
                    </span>
                  </div>
                </div>
              )}

              {/* SEARCHING state */}
              {status === 'searching' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-center p-8">
                  <div className="relative w-28 h-28">
                    <div className="radar-ring absolute inset-0" />
                    <div className="radar-ring absolute inset-3" style={{ animationDelay: '0.6s' }} />
                    <div className="radar-ring absolute inset-6" style={{ animationDelay: '1.2s' }} />
                    <div className="absolute inset-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-2xl">📡</div>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white mb-2">Finding your stranger...</h2>
                    <p className="text-sm" style={{ color: 'rgba(232,234,246,0.45)' }}>Matching based on interests · Anonymous</p>
                  </div>
                  <div className="search-dots"><span /><span /><span /></div>
                </div>
              )}

              {/* DISCONNECTED state */}
              {status === 'disconnected' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-8">
                  <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-3xl">👋</div>
                  <div>
                    <h2 className="text-xl font-bold text-amber-400 mb-2">Stranger disconnected</h2>
                    <p className="text-sm" style={{ color: 'rgba(232,234,246,0.45)' }}>Click Skip to find a new person</p>
                  </div>
                </div>
              )}

              {/* CONNECTED — remote video fills the space */}
              {status === 'connected' && (
                <div className="absolute inset-0">
                  {peer?.stream ? (
                    <>
                      <VideoEl stream={peer.stream} className="absolute inset-0" />
                      {/* Subtle gradient overlay at bottom */}
                      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
                      {/* Peer label */}
                      <div className="absolute bottom-4 left-4 flex items-center gap-2">
                        <div className="live-dot" />
                        <span className="text-sm font-medium text-white/90">
                          {countryToFlag(peer?.country)} Stranger
                        </span>
                      </div>
                      {/* Report button */}
                      <button
                        id="video-report-btn"
                        type="button"
                        onClick={() => {
                          if (socket) socket.emit('report-user', { reason: 'Inappropriate Behavior (Video)' });
                          alert('User reported. Our Trust & Safety team has been notified and the IP logged.');
                        }}
                        className="report-btn"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center flex-col gap-3">
                      <div className="peer-avatar text-2xl" style={{ width: 64, height: 64, fontSize: '2rem' }}>👤</div>
                      <p className="text-sm" style={{ color: 'rgba(232,234,246,0.5)' }}>Connecting video...</p>
                      <div className="search-dots"><span /><span /><span /></div>
                    </div>
                  )}
                </div>
              )}

              {/* Local PiP video */}
              <div className={`absolute bottom-4 right-4 w-36 h-28 rounded-xl overflow-hidden border border-white/20 bg-black shadow-xl z-20 ${status === 'idle' ? 'hidden' : ''}`}>
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className={`w-full h-full object-cover scale-x-[-1] ${cameraOff ? 'opacity-30' : ''}`}
                />
                {cameraOff && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <svg className="w-6 h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2zM3 3l18 18" />
                    </svg>
                  </div>
                )}
                <div className="absolute bottom-1 left-2 text-xs text-white/60 font-medium">You</div>
              </div>
            </div>

            {/* CONTROL BAR */}
            <div className="control-bar">
              {/* Start */}
              {status === 'idle' && (
                <button id="video-start-btn" type="button" disabled={!connected} onClick={handleStart} className="btn btn-primary px-8 py-3">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  </svg>
                  Start Searching
                </button>
              )}

              {status !== 'idle' && (
                <>
                  <button id="video-skip-btn" type="button" disabled={!connected} onClick={handleSkip} className="btn btn-amber px-6 py-3">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                    {status === 'searching' ? 'Cancel' : 'Skip'}
                  </button>

                  <button
                    id="video-mute-btn"
                    type="button"
                    onClick={toggleMute}
                    className={`btn btn-icon ${muted ? 'danger-active' : ''}`}
                    title={muted ? 'Unmute' : 'Mute'}
                  >
                    {muted ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                    )}
                  </button>

                  <button
                    id="video-cam-btn"
                    type="button"
                    onClick={toggleCamera}
                    className={`btn btn-icon ${cameraOff ? 'danger-active' : ''}`}
                    title={cameraOff ? 'Camera on' : 'Camera off'}
                  >
                    {cameraOff ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2zM3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={startScreenShare}
                    className={`btn btn-icon ${isScreenSharing ? 'bg-indigo-500 text-white' : ''}`}
                    title="Screen Share (50 Coins)"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </button>

                  <button id="video-stop-btn" type="button" onClick={handleStop} className="btn btn-danger px-6 py-3">
                    Stop
                  </button>
                </>
              )}
            </div>
          </div>

          {/* CHAT SIDEBAR */}
          {showChat && (
            <div className="chat-panel animate-slide-in-right">
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                <span className="text-sm font-semibold text-white/80">Chat</span>
                <span className="text-xs" style={{ color: 'rgba(232,234,246,0.35)' }}>{isConnected ? 'Live' : 'Waiting'}</span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0" id="video-chat-messages">
                {messages.length === 0 && isConnected && (
                  <div className="sys-msg">Start chatting while you video!</div>
                )}
                {!isConnected && (
                  <div className="sys-msg">Chat will appear here once connected</div>
                )}
                {messages.map((m, i) => {
                  const isMe = m.nickname === 'Anonymous' || m.fromSelf;
                  return (
                    <div key={m.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className={`msg-bubble ${isMe ? 'me' : 'them'}`}>
                        {m.media ? (
                          <div className="max-w-[150px] rounded-lg overflow-hidden border border-white/10">
                            {m.type === 'video' ? (
                              <video src={m.content} controls className="w-full" autoPlay loop muted />
                            ) : (
                              <img src={m.content} className="w-full h-auto" alt="media" />
                            )}
                          </div>
                        ) : (
                          <>
                            {isTranslatorActive && !isMe ? (
                              <div className="flex flex-col gap-1">
                                {m.translated ? (
                                  <>
                                    <span className="text-[10px] opacity-40 uppercase font-bold tracking-widest leading-none mb-1">NVIDIA AI Translate</span>
                                    <span className="opacity-60 text-[11px] italic line-through mb-0.5">{m.text}</span>
                                    <span className="text-white font-medium">✨ {m.translated}</span>
                                  </>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] opacity-40 uppercase font-bold tracking-widest animate-pulse">Translating...</span>
                                    <span className="opacity-80">{m.text}</span>
                                  </div>
                                )}
                              </div>
                            ) : m.text}
                          </>
                        )}
                      </div>
                      <span className="msg-time px-1">{formatTime(m.ts)}</span>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              <div className="p-3 border-t border-white/[0.06] flex gap-2">
                <div className="flex-1 relative">
                  <input
                    id="video-chat-input"
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMsg()}
                    placeholder={isAiGenerating ? 'AI Thinking...' : (isConnected ? 'Message...' : 'Connect first...')}
                    disabled={!isConnected || isAiGenerating}
                    className="chat-input w-full py-2.5 pr-10 text-sm"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {/* 3D EMOJI BUTTON */}
                    <div className="relative">
                      <div className="flex items-center gap-1 border-r border-white/5 pr-1.5 mr-0.5">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-1 text-white/20 hover:text-emerald-400 transition-colors"
                          title="Media (10-15 Coins)"
                        >
                          📂
                        </button>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleMediaUpload} />

                        <button
                          type="button"
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          className="p-1 text-white/20 hover:text-amber-400 transition-colors"
                          title="3D Emojis (5 Coins)"
                        >
                          ✨
                        </button>
                      </div>
                      {showEmojiPicker && (
                        <div className="absolute bottom-full right-0 mb-4 p-3 bg-[#151829] border border-white/10 rounded-2xl shadow-2xl w-[180px] grid grid-cols-4 gap-2 animate-slide-in-up z-[50]">
                          <div className="col-span-4 text-[10px] font-black uppercase tracking-widest text-white/30 mb-1 px-1">3D Emojis (5🪙)</div>
                          {EMOJIS_3D.map(e => (
                            <button
                              key={e.char}
                              onClick={() => send3dEmoji(e)}
                              className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-lg transition-all"
                            >
                              {e.char}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={generateAiSpark}
                      disabled={isAiGenerating}
                      className="text-white/20 hover:text-indigo-400 transition-colors p-1"
                      title="AI Spark (Icebreaker)"
                    >
                      <svg className={`w-3.5 h-3.5 ${isAiGenerating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </button>
                  </div>
                </div>
                <button
                  id="video-chat-send-btn"
                  type="button"
                  onClick={sendMsg}
                  disabled={!isConnected || !input.trim()}
                  className="btn btn-primary w-10 h-10 p-0 rounded-xl flex-shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
