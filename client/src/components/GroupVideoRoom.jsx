/**
 * GroupVideoRoom – Up to 4 anonymous users in a video room
 * Premium 2x2 grid layout, WebRTC mesh, side chat panel
 */
import { useEffect, useRef, useState } from 'react';
import { countryToFlag } from '../utils/countryFlag';
import { useIceServers } from '../hooks/useIceServers';
import { CoinBadge } from './CoinBadge';
import { playConnectSound, playMessageSound, playDisconnectSound, playWaveSound } from '../utils/sounds';

const BlueTick = () => (
  <span className="inline-flex items-center justify-center w-3 h-3 bg-cyan-500 rounded-full ml-1.5 shadow-[0_0_10px_#06b6d4]">
    <svg className="w-2 h-2 text-black" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  </span>
);

const ICEBREAKERS = [
  "What's your favorite movie?",
  "If you could travel anywhere, where?",
  "What music are you into?",
  "Any cool hobbies?",
  "What's something interesting about you?"
];

function MessageSpark({ x, y }) {
  const [active, setActive] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setActive(false), 800);
    return () => clearTimeout(t);
  }, []);
  if (!active) return null;
  return (
    <div className="fixed pointer-events-none z-[3000]" style={{ left: x, top: y }}>
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-cyan-400 rounded-full animate-spark"
          style={{
            '--tx': `${(Math.random() - 0.5) * 60}px`,
            '--ty': `${(Math.random() - 0.5) * 60}px`,
            animationDelay: `${i * 50}ms`
          }}
        />
      ))}
    </div>
  );
}

function VideoTile({ stream, label, flag, isMe, isEmpty, isSearching, isCreator = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    const play = async () => { try { await el.play(); } catch (e) { } };
    play();

    // Anti-lag listeners
    const handleStalled = () => { if (el.paused && stream.active) el.play().catch(() => { }); };
    el.addEventListener('stalled', handleStalled);
    el.addEventListener('waiting', () => { if (stream.active) el.play().catch(() => { }); });
    el.addEventListener('canplay', () => el.play().catch(() => { }));

    return () => {
      el.removeEventListener('stalled', handleStalled);
    };
  }, [stream]);

  if (isSearching) {
    return (
      <div className="video-tile flex flex-col items-center justify-center gap-3">
        <div className="relative w-12 h-12">
          <div className="radar-ring absolute inset-0" style={{ borderColor: 'rgba(99,102,241,0.4)' }} />
          <div className="radar-ring absolute inset-2" style={{ animationDelay: '0.6s', borderColor: 'rgba(99,102,241,0.3)' }} />
          <div className="absolute inset-3 rounded-full bg-indigo-500/20 flex items-center justify-center text-sm">📡</div>
        </div>
        <p className="text-xs" style={{ color: 'rgba(232,234,246,0.5)' }}>Finding room...</p>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="video-tile flex flex-col items-center justify-center gap-2 opacity-40">
        <div className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center text-xl">⏳</div>
        <p className="text-xs" style={{ color: 'rgba(232,234,246,0.4)' }}>Waiting...</p>
      </div>
    );
  }

  return (
    <div className={`video-tile ${isMe ? 'mirror' : ''}`}>
      {stream ? (
        <video ref={ref} autoPlay playsInline muted={isMe} className="w-full h-full object-cover" />
      ) : (
        <div className="tile-empty">
          <div className="peer-avatar text-xl" style={{ width: 52, height: 52, fontSize: '1.5rem' }}>
            {isMe ? '🙋' : '👤'}
          </div>
          <div className="search-dots"><span /><span /><span /></div>
        </div>
      )}
      <div className={`tile-label ${isCreator ? 'border border-cyan-500/30 bg-cyan-950/40 text-cyan-400 font-black tracking-widest' : ''}`}>
        {flag && <span className="mr-1">{flag}</span>}
        <span>{isCreator ? `@${label}` : label}</span>
        {isCreator && <BlueTick />}
        {isMe && !isCreator && <span className="text-xs opacity-50 ml-1">(you)</span>}
      </div>
      {!isMe && stream && (
        <div className="absolute top-2 right-2 live-dot" style={{ width: 8, height: 8 }} />
      )}
    </div>
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

export function GroupVideoRoom({ roomId: roomIdProp, interest: interestProp, nickname, isCreator = false, myCountry, socket, isQueuing, onLeave, onFindNewPod, onJoined, coinState }) {
  const { balance = 0, streak = 0, canClaim = false, nextClaim = 0, claimCoins = () => {} } = coinState || {};
  const { iceServers } = useIceServers();
  const roomIdRef = useRef(null);
  const roomId = roomIdProp ?? roomIdRef.current;
  const [displayInterest, setDisplayInterest] = useState(interestProp || 'general');
  const [peers, setPeers] = useState([]);
  const [participantCount, setParticipantCount] = useState(1);
  const [messages, setMessages] = useState([]);
  const [sparks, setSparks] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [replyingTo, setReplyingTo] = useState(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isTranslatorActive, setIsTranslatorActive] = useState(false);
  const [icebreaker] = useState(() => ICEBREAKERS[Math.floor(Math.random() * ICEBREAKERS.length)]);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const [localStreamReady, setLocalStreamReady] = useState(false);
  const peerConnectionsRef = useRef(new Map());
  const pendingCandidatesRef = useRef(new Map());
  const pendingPeersRef = useRef([]);
  const pendingOffersRef = useRef([]);
  const peerNicksRef = useRef(new Map());
  const peerCountriesRef = useRef(new Map());
  const peerCreatorsRef = useRef(new Map());
  const hasJoinedRef = useRef(false);
  const hasAutoLeftRef = useRef(false);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [active3dEmoji, setActive3dEmoji] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [toast, setToast] = useState(null);
  const [cameraBlur, setCameraBlur] = useState(false);
  const [connectedSecs, setConnectedSecs] = useState(0);
  const [showWave, setShowWave] = useState(false);
  const [moodEmoji, setMoodEmoji] = useState(null);
  const [strangerTyping, setStrangerTyping] = useState(false);
  const [goodVibesSent, setGoodVibesSent] = useState(false);
  const [goodVibesMatch, setGoodVibesMatch] = useState(false);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'speaker'
  const [activeSpeakerId, setActiveSpeakerId] = useState(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [remoteRaisedHands, setRemoteRaisedHands] = useState(new Set()); // socketIds
  const [localReactions, setLocalReactions] = useState([]); // {id, emoji, x, y}
  const audioAnalyzersRef = useRef(new Map()); // socketId -> analyzer
  const connTimerRef = useRef(null);
  const typingTimerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const inputRef = useRef(null);
  const [showEntryModal, setShowEntryModal] = useState(isQueuing);
  const [showPreRoomWaiting, setShowPreRoomWaiting] = useState(false);

  useEffect(() => {
    if (socket && roomIdProp && !hasJoinedRef.current) {
      socket.emit('join-specific-group', { roomId: roomIdProp, nickname: nickname || 'Admin' });
      setShowEntryModal(false);
    }
  }, [socket, roomIdProp]);
  const [showReactionTooltip, setShowReactionTooltip] = useState(() => !localStorage.getItem('mm_grp_seen_reaction_tooltip'));
  const [localInterest, setLocalInterest] = useState(interestProp || 'general');
  const [joinRoomIdInput, setJoinRoomIdInput] = useState('');
  const [activeInterests, setActiveInterests] = useState([]);
  const [queuePos, setQueuePos] = useState(null);
  const [mediaError, setMediaError] = useState(null); // { type: 'denied'|'notfound'|'other', message }
  const [reconnectingPeers, setReconnectingPeers] = useState(new Set()); // socketIds with failed/disconnected ICE
  const [connectionQuality, setConnectionQuality] = useState(new Map()); // socketId -> 'good'|'fair'|'poor'
  const [pinnedId, setPinnedId] = useState(null); // 'local' or peer socketId for PiP

  const startRecording = () => {
    if (peers.length === 0) return alert('No active users to record.');
    // Record the first peer for now, or use a complex Canvas recorder if needed.
    // For MVP consistency with VideoChat:
    const targetStream = peers[0]?.stream;
    if (!targetStream) return alert('No remote user stream available.');

    if (!MediaRecorder.isTypeSupported('video/webm')) {
      return alert('WebM recording not supported on this browser.');
    }

    const recorder = new MediaRecorder(targetStream, { mimeType: 'video/webm' });
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Creator_Group_Clip_${Date.now()}.webm`;
      a.click();
    };
    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
    setToast('🎥 Group Recording Active');
  };

  const stopRecording = () => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      setIsRecording(false);
      setToast('🎥 Recording Offline');
    }
  };

  // Fetch active groups/interests on mount and when modal opens
  const fetchInterests = () => {
    const apiBase = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    fetch(`${apiBase}/api/rooms/active-interests?mode=group_video`)
      .then(res => res.json())
      .then(data => setActiveInterests(data.interests || []))
      .catch(() => { });
  };

  useEffect(() => {
    fetchInterests();
  }, []);

  useEffect(() => {
    if (showEntryModal) fetchInterests();
  }, [showEntryModal]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(toastTimerRef.current);
  }, [toast]);

  // Connection timer
  useEffect(() => {
    if (participantCount > 1) {
      if (!connTimerRef.current) {
        setConnectedSecs(0);
        connTimerRef.current = setInterval(() => setConnectedSecs(s => s + 1), 1000);
      }
    } else {
      clearInterval(connTimerRef.current);
      connTimerRef.current = null;
    }
    return () => clearInterval(connTimerRef.current);
  }, [participantCount]);

  const formatTimer = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Wave / Good Vibes listeners
  useEffect(() => {
    if (!socket) return;
    const onWave = () => { setShowWave(true); setTimeout(() => setShowWave(false), 2800); playWaveSound(); };
    const onGoodVibesMatch = () => { setGoodVibesMatch(true); setToast('🤝 Group Synergy! Everyone felt the good vibes!'); playConnectSound(); };
    const onTyping = ({ isTyping, socketId }) => {
      if (socketId === socket.id) return;
      setStrangerTyping(isTyping);
      if (isTyping) {
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setStrangerTyping(false), 3000);
      }
    };
    socket.on('wave-reaction', onWave);
    socket.on('good-vibes-match', onGoodVibesMatch);
    socket.on('stranger-typing', onTyping);
    return () => {
      socket.off('wave-reaction', onWave);
      socket.off('good-vibes-match', onGoodVibesMatch);
      socket.off('stranger-typing', onTyping);
    };
  }, [socket]);

  const sendWave = () => {
    if (socket && roomId) {
      socket.emit('send-wave', { roomId });
      setShowWave(true);
      setTimeout(() => setShowWave(false), 2800);
    }
  };

  const sendGoodVibes = () => {
    if (socket && roomId) {
      socket.emit('send-good-vibes', { roomId });
      setGoodVibesSent(true);
      setToast('🤝 Good Vibes sent to the room!');
    }
  };

  // Mood analyzer
  useEffect(() => {
    const last = messages.filter(m => !m.system && m.socketId !== socket?.id).slice(-1)[0];
    if (!last?.text) return;
    const t = last.text.toLowerCase();
    if (/lol|haha|😂|😄|funny|lmao/.test(t)) setMoodEmoji('😂');
    else if (/wow|amazing|omg|whoa|really/.test(t)) setMoodEmoji('😮');
    else if (/hmm|think|maybe|wonder|idk/.test(t)) setMoodEmoji('🤔');
    else if (/great|nice|good|cool|love|awesome/.test(t)) setMoodEmoji('😊');
    else setMoodEmoji(null);
  }, [messages, socket]);

  // Process pending peers/offers once local stream is ready
  useEffect(() => {
    if (!localStreamReady || !socket) return;
    const pend = pendingPeersRef.current.splice(0);
    pend.forEach((sid) => doOffer(sid));
    const offs = pendingOffersRef.current.splice(0);
    offs.forEach(({ from, signal }) => doAnswer(from, signal));
  }, [localStreamReady, socket]);

  // Camera + Mic setup – must complete before WebRTC signaling
  const requestMediaAccess = async () => {
    setMediaError(null);
    try {
      const constraints = {
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
        audio: { echoCancellation: true, noiseSuppression: true }
      };
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = s;
      setLocalStreamReady(true);
      setMediaError(null);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = s;
        localVideoRef.current.play().catch(() => { });
      }
    } catch (err) {
      console.error('getUserMedia error:', err);
      const name = err?.name || '';
      const msg = err?.message || String(err);
      if (name === 'NotAllowedError' || msg.includes('Permission denied')) {
        setMediaError({ type: 'denied', message: 'Camera and microphone access was denied.' });
      } else if (name === 'NotFoundError' || msg.includes('not found')) {
        setMediaError({ type: 'notfound', message: 'No camera or microphone found.' });
      } else {
        setMediaError({ type: 'other', message: msg || 'Could not access camera or microphone.' });
      }
      setLocalStreamReady(true);
    }
  };

  useEffect(() => {
    let s = null;
    (async () => {
      try {
        const constraints = {
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
          audio: { echoCancellation: true, noiseSuppression: true }
        };
        s = await navigator.mediaDevices.getUserMedia(constraints);
        localStreamRef.current = s;
        setLocalStreamReady(true);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = s;
          localVideoRef.current.play().catch(() => { });
        }
      } catch (err) {
        console.error('getUserMedia error:', err);
        const name = err?.name || '';
        const msg = err?.message || String(err);
        if (name === 'NotAllowedError' || msg.includes('Permission denied')) {
          setMediaError({ type: 'denied', message: 'Camera and microphone access was denied.' });
        } else if (name === 'NotFoundError' || msg.includes('not found')) {
          setMediaError({ type: 'notfound', message: 'No camera or microphone found.' });
        } else {
          setMediaError({ type: 'other', message: msg || 'Could not access camera or microphone.' });
        }
        setLocalStreamReady(true);
      }
    })();
    return () => { 
      if (s) {
        s.getTracks().forEach((t) => {
          t.stop();
          t.enabled = false;
        });
      }
      localStreamRef.current = null;
    };
  }, []);

  // Sync local stream to video element when ref mounts (handles race)
  useEffect(() => {
    if (localStreamReady && localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [localStreamReady]);

  // Setup local audio analyzer for speaking detection
  useEffect(() => {
    if (localStreamReady && localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
      setupAudioAnalyzer('local', localStreamRef.current);
    }
    return () => { cleanupAudioAnalyzer('local'); };
  }, [localStreamReady, localStreamRef.current]);

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

  const setupAudioAnalyzer = (id, stream) => {
    try {
      if (audioAnalyzersRef.current.has(id)) cleanupAudioAnalyzer(id);
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyzer = ctx.createAnalyser();
      analyzer.fftSize = 256;
      source.connect(analyzer);
      audioAnalyzersRef.current.set(id, { analyzer, ctx });
    } catch (e) { }
  };

  const cleanupAudioAnalyzer = (id) => {
    const data = audioAnalyzersRef.current.get(id);
    if (data && data.ctx) {
      try { data.ctx.close(); } catch (e) { }
    }
    audioAnalyzersRef.current.delete(id);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      let loudestId = null;
      let maxVol = 0;
      audioAnalyzersRef.current.forEach(({ analyzer }, id) => {
        const dataArr = new Uint8Array(analyzer.frequencyBinCount);
        analyzer.getByteFrequencyData(dataArr);
        const avg = dataArr.reduce((a, b) => a + b, 0) / dataArr.length;
        if (avg > maxVol && avg > 15) {
          maxVol = avg;
          loudestId = id;
        }
      });
      if (loudestId !== activeSpeakerId) setActiveSpeakerId(loudestId);
    }, 400);
    return () => clearInterval(interval);
  }, [activeSpeakerId, peers]);

  const createPeerConnection = (remoteId) => {
    if (peerConnectionsRef.current.has(remoteId)) return peerConnectionsRef.current.get(remoteId);
    const pc = new RTCPeerConnection({ iceServers });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current));
    }

    pc.onicecandidate = (e) => {
      const rid = roomIdRef.current || roomId;
      if (e.candidate && socket && rid) {
        socket.emit('webrtc-signal', { roomId: rid, targetSocketId: remoteId, type: 'ice-candidate', signal: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (!stream) return;

      setPeers((prev) => {
        const existing = prev.find((p) => p.socketId === remoteId);
        const nick = peerNicksRef.current.get(remoteId) || 'Stranger';
        const ctry = peerCountriesRef.current.get(remoteId);
        const isCr = !!peerCreatorsRef.current.get(remoteId);

        if (existing) {
          if (existing.stream === stream) return prev;
          return prev.map(p => p.socketId === remoteId ? { ...p, stream, nickname: nick, country: ctry, isCreator: isCr } : p);
        }
        return [...prev, { socketId: remoteId, stream, nickname: nick, country: ctry, isCreator: isCr }];
      });

      if (e.track.kind === 'audio' && !audioAnalyzersRef.current.has(remoteId)) {
        setupAudioAnalyzer(remoteId, stream);
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      if (state === 'failed' || state === 'disconnected') {
        setReconnectingPeers(prev => new Set(prev).add(remoteId));
        setTimeout(() => {
          if (pc.iceConnectionState === 'connected') {
            setReconnectingPeers(prev => { const n = new Set(prev); n.delete(remoteId); return n; });
          } else {
            setPeers((p) => p.filter((x) => x.socketId !== remoteId));
            peerConnectionsRef.current.delete(remoteId);
            audioAnalyzersRef.current.delete(remoteId);
            setReconnectingPeers(prev => { const n = new Set(prev); n.delete(remoteId); return n; });
          }
        }, 5000);
      } else if (state === 'connected') {
        setReconnectingPeers(prev => { const n = new Set(prev); n.delete(remoteId); return n; });
      }
    };

    peerConnectionsRef.current.set(remoteId, pc);
    return pc;
  };

  const doOffer = async (remoteId) => {
    const rid = roomIdRef.current || roomId;
    if (!rid || !socket) return;
    const pc = createPeerConnection(remoteId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('webrtc-signal', { roomId: rid, targetSocketId: remoteId, type: 'offer', signal: offer });
    } catch (err) { console.error('offer err', err); }
  };

  const doAnswer = async (remoteId, offer) => {
    const rid = roomIdRef.current || roomId;
    if (!rid || !socket) return;
    const pc = createPeerConnection(remoteId);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-signal', { roomId: rid, targetSocketId: remoteId, type: 'answer', signal: answer });
    } catch (err) { console.error('answer err', err); }
  };

  const addIce = async (remoteId, candidate) => {
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
      } catch { return false; }
    };
    if (!(await add(candidate))) {
      pend.push(candidate);
      pendingCandidatesRef.current.set(remoteId, pend);
      return;
    }
    for (const c of pend) await add(c);
    pendingCandidatesRef.current.set(remoteId, []);
  };

  const sendMessage = () => {
    const t = chatInput.trim();
    const rid = roomIdRef.current || roomId;
    if (!t || !socket || !rid) return;
    const payload = { roomId: rid, text: t };
    if (replyingTo) payload.replyTo = { id: replyingTo.id, text: replyingTo.text, nickname: replyingTo.nickname || 'Stranger' };
    socket.emit('send-message', payload);
    setChatInput('');
    setReplyingTo(null);
  };

  const apiBase = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const generateAiSpark = async () => {
    if (isAiGenerating) return;
    setIsAiGenerating(true);
    try {
      const res = await fetch(`${apiBase}/api/ai/spark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interest: displayInterest })
      });
      if (res.ok) {
        const data = await res.json();
        setChatInput(data.spark || '');
      } else {
        setChatInput(ICEBREAKERS[Math.floor(Math.random() * ICEBREAKERS.length)] || '');
      }
    } catch {
      setChatInput(ICEBREAKERS[Math.floor(Math.random() * ICEBREAKERS.length)] || '');
    } finally {
      setIsAiGenerating(false);
    }
  };

  useEffect(() => {
    if (!socket) return;

    const onGroupJoined = (data) => {
      const rid = data.roomId || roomIdRef.current;
      if (rid) roomIdRef.current = rid;
      if (data.interest) setDisplayInterest(data.interest);
      if (!hasJoinedRef.current) { hasJoinedRef.current = true; onJoined(rid); }
      setParticipantCount(data.participantCount ?? 1);
      setShowPreRoomWaiting(false);
    };

    const onExistingPeers = (data) => {
      if (data.roomId) roomIdRef.current = data.roomId;
      setParticipantCount((data.peers?.length || 0) + 1);
      const peerList = data.peers || [];
      peerList.forEach((p) => {
        if (p.nickname) peerNicksRef.current.set(p.socketId, p.nickname);
        if (p.country) peerCountriesRef.current.set(p.socketId, p.country);
        if (p.isCreator) peerCreatorsRef.current.set(p.socketId, true);
      });
      // Add peers immediately (stream: null) so tile exists; ontrack will add stream
      setPeers((prev) => {
        const existingIds = new Set(prev.map((p) => p.socketId));
        const toAdd = peerList.filter((p) => !existingIds.has(p.socketId)).map((p) => ({
          socketId: p.socketId, stream: null, nickname: p.nickname || 'Anonymous', country: p.country, isCreator: !!p.isCreator
        }));
        return toAdd.length ? [...prev, ...toAdd] : prev;
      });
      if (localStreamRef.current) {
        peerList.forEach((p) => doOffer(p.socketId));
      } else {
        pendingPeersRef.current.push(...peerList.map((p) => p.socketId));
      }
    };

    const onHistory = (data) => {
      if (data.roomId === (roomIdRef.current || roomId)) setMessages(data.messages || []);
    };

    const onMsg = (data) => {
      if (data.roomId === (roomIdRef.current || roomId)) {
        setMessages((m) => [...m.slice(-100), data]);
        // Trigger spark
        const el = document.getElementById('group-video-chat-messages');
        if (el) {
          const rect = el.getBoundingClientRect();
          setSparks(prev => [...prev.slice(-20), { id: Date.now(), x: rect.left + rect.width / 2, y: rect.bottom - 100 }]);
        }
        if (data.socketId !== socket.id) playMessageSound();
      }
    };

    const onUserJoined = (data) => {
      setParticipantCount(data.participantCount ?? 2);
      if (data.nickname) peerNicksRef.current.set(data.socketId, data.nickname);
      if (data.country) peerCountriesRef.current.set(data.socketId, data.country);
      if (data.isCreator) peerCreatorsRef.current.set(data.socketId, true);
      setMessages((m) => [...m, { id: `sys-${Date.now()}`, system: true, text: `${data.nickname || 'A stranger'} joined 👋` }]);
      playConnectSound();
      
      setPeers((prev) => {
        const isKnown = prev.some((p) => p.socketId === data.socketId);
        if (isKnown) return prev;
        return [...prev, { socketId: data.socketId, stream: null, nickname: data.nickname || 'Anonymous', country: data.country, isCreator: !!data.isCreator }];
      });

      if (localStreamRef.current && !peerConnectionsRef.current.has(data.socketId)) {
        doOffer(data.socketId);
      } else if (!peerConnectionsRef.current.has(data.socketId)) {
        pendingPeersRef.current.push(data.socketId);
      }
    };

    const onUserLeft = (data) => {
      setParticipantCount((c) => {
        const next = Math.max(1, (data.participantCount ?? c) - 1);
        if (next === 1 && !isQueuing && !hasAutoLeftRef.current) {
          // AUTO-SEEK: Find another room if left alone
          hasAutoLeftRef.current = true;
          setTimeout(() => {
            if (roomIdRef.current) {
              onLeave();
            }
          }, 3000);
        }
        return next;
      });
      const sid = data.socketId;
      if (sid) {
        const pc = peerConnectionsRef.current.get(sid);
        if (pc) {
          pc.onicecandidate = null;
          pc.ontrack = null;
          pc.close();
          peerConnectionsRef.current.delete(sid);
        }
        const leavingNick = peerNicksRef.current.get(sid);
        setPeers((p) => p.filter((x) => x.socketId !== sid));
        if (leavingNick) setMessages((m) => [...m, { id: `sys-left-${Date.now()}`, system: true, text: `${leavingNick} left the room` }]);
        playDisconnectSound();
        cleanupAudioAnalyzer(sid);
      }
    };

    const onSignal = (data) => {
      const from = data.fromSocketId;
      if (!from || from === socket.id) return;
      if (data.fromNickname) peerNicksRef.current.set(from, data.fromNickname);
      if (data.fromCountry) peerCountriesRef.current.set(from, data.fromCountry);
      if (data.fromIsCreator) peerCreatorsRef.current.set(from, true);
      if (data.type === 'offer') {
        if (localStreamRef.current) {
          doAnswer(from, data.signal);
        } else {
          pendingOffersRef.current.push({ from, signal: data.signal });
        }
      } else if (data.type === 'answer') {
        const pc = peerConnectionsRef.current.get(from);
        if (pc) {
          try {
            pc.setRemoteDescription(new RTCSessionDescription(data.signal)).then(() => {
              const pend = pendingCandidatesRef.current.get(from) || [];
              pend.forEach((c) => {
                pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => { });
              });
              pendingCandidatesRef.current.set(from, []);
            });
          } catch (err) { console.error('setRemoteDescription err', err); }
        }
      } else if (data.type === 'ice-candidate' && data.signal) addIce(from, data.signal);
    };

    const onSystemMsg = (data) => setMessages((m) => [...m, { id: Date.now(), system: true, text: `📢 ADMIN: ${data.message}`, ts: Date.now() }]);
    const onRoomEndedByAdmin = () => {
      setToast('⚠️ This session was terminated by administrative protocol.');
      setTimeout(() => onLeave(), 2000);
    };

    socket.on('group-joined', onGroupJoined);
    socket.on('existing-peers', onExistingPeers);
    socket.on('chat-history', onHistory);
    socket.on('chat-message', onMsg);
    socket.on('user-joined', onUserJoined);
    socket.on('user-left', onUserLeft);
    socket.on('webrtc-signal', onSignal);
    socket.on('system-announcement', onSystemMsg);
    socket.on('room-ended-by-admin', onRoomEndedByAdmin);

    // Auto-join group on mount removed; we rely on the Entry Modal instead.


    return () => {
      socket.off('group-joined', onGroupJoined);
      socket.off('existing-peers', onExistingPeers);
      socket.off('chat-history', onHistory);
      socket.off('chat-message', onMsg);
      socket.off('user-joined', onUserJoined);
      socket.off('user-left', onUserLeft);
      socket.off('webrtc-signal', onSignal);
      socket.off('system-announcement', onSystemMsg);
      socket.off('room-ended-by-admin', onRoomEndedByAdmin);
    };
  }, [socket, onJoined, onLeave]);

  useEffect(() => {
    if (socket) {
      socket.on('3d-emoji', (data) => {
        setActive3dEmoji(data);
        setTimeout(() => setActive3dEmoji(null), 3000);
      });
      socket.on('media-message', (data) => {
        setMessages(prev => [...prev.slice(-100), { ...data, media: true }]);
      });
      socket.on('error', (data) => {
        alert(data.message);
      });
      socket.on('room-full', (data) => {
        alert(data.message);
        setShowEntryModal(true);
      });
      socket.on('waiting-in-group-queue', (data) => {
        setQueuePos(data.queuePosition);
      });
      socket.on('hand-raise', ({ socketId, raised }) => {
        setRemoteRaisedHands(prev => {
          const next = new Set(prev);
          if (raised) next.add(socketId);
          else next.delete(socketId);
          return next;
        });
      });
      socket.on('room-reaction', ({ socketId, emoji }) => {
        const id = Math.random().toString(36).substr(2, 9);
        const reaction = { id, socketId, emoji, x: 20 + Math.random() * 60, y: 50 + Math.random() * 30 };
        setLocalReactions(prev => [...prev, reaction]);
        setTimeout(() => setLocalReactions(prev => prev.filter(r => r.id !== id)), 4000);
      });
      return () => {
        socket.off('3d-emoji');
        socket.off('media-message');
        socket.off('hand-raise');
        socket.off('room-reaction');
        socket.off('error');
        socket.off('room-full');
        socket.off('waiting-in-group-queue');
      };
    }
  }, [socket]);

  const toggleHandRaise = () => {
    const next = !handRaised;
    setHandRaised(next);
    if (socket && (roomIdRef.current || roomId)) {
      socket.emit('hand-raise', { roomId: roomIdRef.current || roomId, raised: next });
    }
  };

  const sendReaction = (emoji) => {
    if (socket && (roomIdRef.current || roomId)) {
      socket.emit('room-reaction', { roomId: roomIdRef.current || roomId, emoji });
    }
  };

  const copyRoomLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setToast('Meeting link copied to clipboard! 📋');
  };

  const generateRandomRoom = () => {
    const randomId = Math.random().toString(36).substring(2, 10);
    setJoinRoomIdInput(randomId);
    setToast('🎲 Random ID Generated!');
  };

  const send3dEmoji = (emoji) => {
    if (balance < 5) return alert('Need 5 coins!');
    if (socket && (roomIdRef.current || roomId)) {
      socket.emit('spend-coins', { amount: 5, reason: '3d-emoji' });
      socket.emit('send-3d-emoji', { roomId: roomIdRef.current || roomId, emoji });
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
        socket.emit('spend-coins', { amount: cost, reason: 'media-share' });
        processUpload(file);
      };
      video.src = URL.createObjectURL(file);
    } else {
      socket.emit('spend-coins', { amount: cost, reason: 'media-share' });
      processUpload(file);
    }
    e.target.value = '';
  };

  const processUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      socket.emit('send-media', { roomId: roomIdRef.current || roomId, type: file.type.startsWith('video') ? 'video' : 'image', content: ev.target.result });
    };
    reader.readAsDataURL(file);
  };

  const startScreenShare = async () => {
    if (balance < 50) return alert('Need 50 coins for Screen Share!');
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = stream.getVideoTracks()[0];

      for (const pc of peerConnectionsRef.current.values()) {
        const sender = pc.getSenders().find(s => s.track.kind === 'video');
        if (sender) sender.replaceTrack(track);
      }

      setIsScreenSharing(true);
      socket.emit('spend-coins', { amount: 50, reason: 'screenshare' });
      track.onended = () => {
        setIsScreenSharing(false);
        if (localStreamRef.current) {
          const localTrack = localStreamRef.current.getVideoTracks()[0];
          for (const pc of peerConnectionsRef.current.values()) {
            const sender = pc.getSenders().find(s => s.track.kind === 'video');
            if (sender) sender.replaceTrack(localTrack);
          }
        }
      };
    } catch (e) {
      console.error(e);
    }
  };

  // AI Translation Hook
  useEffect(() => {
    if (!isTranslatorActive) return;
    const untranslated = messages.filter(m => !m.system && !m.translated && m.nickname !== nickname && m.text && m.text.length > 3);
    if (untranslated.length === 0) return;
    const target = untranslated[untranslated.length - 1];
    const apiBase = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    const translateMsg = async () => {
      try {
        const res = await fetch(`${apiBase}/api/ai/translate`, {
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

  // Connection quality monitoring via getStats
  useEffect(() => {
    const interval = setInterval(async () => {
      const next = new Map();
      for (const [sid, pc] of peerConnectionsRef.current) {
        try {
          const stats = await pc.getStats();
          let rtt = 999;
          for (const r of stats.values()) {
            if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.roundTripTime) {
              rtt = Math.min(rtt, r.roundTripTime * 1000);
            }
          }
          let q = 'good';
          if (rtt > 300) q = 'poor';
          else if (rtt > 150) q = 'fair';
          next.set(sid, q);
        } catch { next.set(sid, 'fair'); }
      }
      setConnectionQuality(prev => {
        const same = prev.size === next.size && [...prev].every(([k, v]) => next.get(k) === v);
        return same ? prev : next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [peers]);

  useEffect(() => () => {
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    audioAnalyzersRef.current.forEach(({ ctx }) => {
      try { ctx.close(); } catch (e) { }
    });
    audioAnalyzersRef.current.clear();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    }
  }, []);

  // Keyboard shortcut - Escape to leave
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onLeave();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onLeave]);

  // Build adaptive tile array: [local, ...peers, ...empty/searching]
  const prioritizedPeers = [...peers].sort((a, b) => {
    if (a.socketId === pinnedId) return -1;
    if (b.socketId === pinnedId) return 1;
    return 0;
  });

  const remotePeers = prioritizedPeers.slice(0, 3);
  const tiles = [];

  // Local tile
  tiles.push({ type: 'local', isPinned: pinnedId === 'local' });

  for (let i = 0; i < 3; i++) {
    const peer = remotePeers[i];
    if (isQueuing && i === 0 && peers.length === 0) {
      tiles.push({ type: 'searching' });
    } else if (peer) {
      tiles.push({ type: 'peer', peer, isPinned: peer.socketId === pinnedId });
    } else {
      tiles.push({ type: 'empty' });
    }
  }

  // Adaptive layout: 1 = full, 2 = side-by-side, 3-4 = 2x2
  const filledCount = tiles.filter(t => t.type === 'local' || t.type === 'peer' || t.type === 'searching').length;
  const displayTiles = filledCount <= 2 ? tiles.filter(t => t.type !== 'empty') : tiles;
  const gridClass = filledCount <= 1
    ? 'grid-cols-1 grid-rows-1'
    : filledCount === 2
      ? 'grid-cols-1 grid-rows-2 sm:grid-cols-2 sm:grid-rows-1'
      : 'grid-cols-2 grid-rows-2';

  const localStream = localStreamRef.current;

  return (
    <div className="h-screen flex flex-col bg-[#1a1d21] text-white overflow-hidden font-sans select-none">
      {/* VIBE MATCH OVERLAY */}
      {goodVibesMatch && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[180] flex items-center gap-3 px-6 py-2 rounded-full bg-emerald-500 text-white font-black uppercase tracking-[0.3em] text-[10px] animate-bounce shadow-[0_0_30px_#10b981]">
          🤝 Room Synergy Matched!
          <button onClick={() => setGoodVibesMatch(false)} className="ml-2 hover:scale-110 transition-transform">✕</button>
        </div>
      )}

      {/* Media permission error overlay */}
      {mediaError && (
        <div className="absolute inset-0 z-[300] bg-[#0c0e1a]/98 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-rose-500/20 border-2 border-rose-500/40 flex items-center justify-center text-4xl mb-6">📷</div>
          <h2 className="text-xl font-bold text-white mb-2">Camera & Mic Access Needed</h2>
          <p className="text-sm text-white/70 mb-6 max-w-sm">{mediaError.message}</p>
          <button
            onClick={requestMediaAccess}
            className="px-8 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm uppercase tracking-wider transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#0c0e1a]"
            aria-label="Grant camera and microphone access"
          >
            Grant Access
          </button>
          <button onClick={onLeave} className="mt-4 text-xs text-white/50 hover:text-white underline">Cancel & Leave</button>
        </div>
      )}

      {/* QUEUING OVERLAY */}
      {/* Pre-room waiting experience (emotional hook) */}
      {showPreRoomWaiting && (
        <div className="absolute inset-0 z-[240] bg-[#0c0e1a]/98 backdrop-blur-3xl flex flex-col items-center justify-center p-8 text-center animate-fade-in">
          <div className="relative w-24 h-24 mb-8">
            <div className="radar-ring absolute inset-0 border-indigo-500/40" />
            <div className="radar-ring absolute inset-4" style={{ animationDelay: '0.4s', borderColor: 'rgba(99,102,241,0.3)' }} />
            <div className="absolute inset-0 flex items-center justify-center text-4xl">🎥</div>
          </div>
          <p className="text-sm font-bold text-white/90 mb-2">Preparing your camera...</p>
          <p className="text-indigo-400 font-semibold mb-1">🌎 Matching with people who like <span className="capitalize">{displayInterest}</span></p>
          <p className="text-xs text-white/50 mb-8">👥 Looking for up to 3 others</p>
          <div className="search-dots scale-125"><span /><span /><span /></div>
        </div>
      )}

      {queuePos !== null && (
        <div className="absolute inset-0 z-[250] bg-[#0c0e1a]/95 backdrop-blur-3xl flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="relative w-32 h-32 mb-8">
            <div className="radar-ring absolute inset-0 border-indigo-500/30" />
            <div className="radar-ring absolute inset-8 border-indigo-500/20" style={{ animationDelay: '0.6s' }} />
            <div className="absolute inset-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-4xl animate-pulse">⏳</div>
          </div>
          <h2 className="text-xl font-bold tracking-widest uppercase text-white mb-2">Group is Full</h2>
          <p className="text-sm font-black text-indigo-400 uppercase tracking-widest mb-8">Waiting in Queue: Position {queuePos}</p>
          <div className="search-dots scale-150 mb-8"><span /><span /><span /></div>
          <button onClick={() => { setQueuePos(null); setShowEntryModal(true); }} className="px-6 py-3 rounded-full bg-white/10 hover:bg-white/20 font-black text-xs uppercase tracking-widest transition-all">
            Cancel & Pick Another
          </button>
        </div>
      )}

      {/* ENTRY MODAL */}
      {showEntryModal && (
        <div className="absolute inset-0 z-[200] bg-[#1a1d21]/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#0c0e1a] border border-white/10 rounded-3xl p-6 shadow-2xl flex flex-col gap-6 animate-slide-in-up">
            <h2 className="text-xl font-bold tracking-tight text-white text-center">Join Group Video</h2>

            {activeInterests.length > 0 && (
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-emerald-400 ml-1 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active Groups</label>
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto custom-scrollbar">
                  {activeInterests.map(ai => (
                    <button
                      key={ai.interest}
                      onClick={() => setLocalInterest(ai.interest)}
                      className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${localInterest === ai.interest ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300 scale-105 shadow-lg shadow-indigo-500/20' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'}`}
                    >
                      {ai.interest} <span className="text-white/30 ml-1">({ai.count})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Select Interest (Mandatory)</label>
              <input
                type="text"
                value={localInterest}
                onChange={(e) => setLocalInterest(e.target.value)}
                placeholder="e.g. Anime, Gaming, Music"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 transition-all text-white outline-none"
              />
              <button
                onClick={() => {
                  if (!localInterest.trim()) return alert("Interest is mandatory!");
                  setDisplayInterest(localInterest.trim());
                  setShowEntryModal(false);
                  setShowPreRoomWaiting(true);
                  socket.emit('join-group-by-interest', { interest: localInterest.trim(), nickname: 'Anonymous', mode: 'group_video' });
                }}
                className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all"
              >
                Join via Interest
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-[1px] bg-white/10"></div>
              <span className="text-[10px] uppercase font-bold text-white/30">OR Paste Link</span>
              <div className="flex-1 h-[1px] bg-white/10"></div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-white/40 ml-1">Join via Link / ID</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinRoomIdInput}
                  onChange={(e) => setJoinRoomIdInput(e.target.value)}
                  placeholder="Paste Room ID"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 transition-all text-white outline-none"
                />
                <button
                  onClick={() => {
                    const cleanId = joinRoomIdInput.trim().split('/').pop();
                    if (!cleanId) return alert("Enter a valid Room ID");
                    socket.emit('join-specific-group', { roomId: cleanId, nickname: 'Anonymous' });
                    setShowEntryModal(false);
                  }}
                  className="h-full px-5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all text-xs"
                >
                  Join
                </button>
                <button
                  onClick={generateRandomRoom}
                  className="h-full px-3 bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl hover:bg-indigo-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-widest"
                  title="Generate Random ID"
                >
                  🎲
                </button>
              </div>
            </div>

            <button onClick={onLeave} className="text-[10px] font-bold text-white/30 hover:text-white uppercase tracking-widest underline mt-2">
              Cancel & Leave
            </button>
          </div>
        </div>
      )}

      {/* TOP BAR - minimal: logo + participants count + tap for more */}
      <header className="h-12 sm:h-14 flex-shrink-0 flex items-center justify-between px-4 sm:px-6 bg-[#1a1d21] border-b border-white/5 z-[80]">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-black text-white shrink-0">M</div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-[10px] font-bold text-white/60">{formatTimer(connectedSecs)} · {participantCount}/4</span>
            {myCountry && <span className="text-xs">{countryToFlag(myCountry)}</span>}
          </div>
          <CoinBadge balance={balance} canClaim={canClaim} onClaim={claimCoins} streak={streak} nextClaim={nextClaim} />
        </div>
        <div className="flex items-center gap-2">
          {onFindNewPod && (
            <button 
              onClick={() => { onLeave(); onFindNewPod(); }} 
              className="h-8 px-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-bold uppercase tracking-wider hover:bg-indigo-500 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              New Pod
            </button>
          )}
          <button onClick={copyRoomLink} aria-label="Copy meeting link" className="h-8 px-2.5 rounded-lg bg-white/5 border border-white/10 text-[9px] font-bold uppercase tracking-wider hover:bg-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500">Invite</button>
        </div>
      </header>

      {/* MAIN VIEWPORT */}
      <main className="flex-1 flex min-h-0 relative">
        <div className="flex-1 relative p-2 sm:p-4 flex flex-col gap-2 sm:gap-4 overflow-hidden">
          {/* Reaction Layer */}
          <div className="absolute inset-0 pointer-events-none z-[100] overflow-hidden">
            {localReactions.map(r => (
              <div key={r.id} className="absolute animate-float-up text-4xl" style={{ left: `${r.x}%`, top: `${r.y}%` }}>
                {r.emoji}
              </div>
            ))}
          </div>

          {/* Picture-in-Picture pinned participant */}
          {pinnedId && (
            <div className="absolute bottom-24 right-4 z-[120] w-32 h-24 sm:w-44 sm:h-32 rounded-2xl overflow-hidden border-2 border-indigo-500/60 shadow-2xl bg-[#0c0e1a]">
              {pinnedId === 'local' ? (
                <PiPLocalVideo stream={localStreamRef.current} cameraBlur={cameraBlur} />
              ) : (() => {
                const peer = peers.find(p => p.socketId === pinnedId);
                return peer?.stream ? <RemoteVideoTile stream={peer.stream} socketId={peer.socketId} /> : <div className="w-full h-full flex items-center justify-center bg-indigo-500/20 text-2xl">👤</div>;
              })()}
              <button
                onClick={() => setPinnedId(null)}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 hover:bg-rose-500 flex items-center justify-center text-white text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Unpin"
              >
                ✕
              </button>
            </div>
          )}

          {active3dEmoji && (
            <div className="absolute inset-0 pointer-events-none z-[110] flex items-center justify-center">
              <div className="animate-3d-emoji-pop flex flex-col items-center gap-4">
                <img src={active3dEmoji.emoji.url} className="w-48 h-48 drop-shadow-2xl" alt="3d" />
                <span className="px-6 py-2 rounded-full bg-black/60 border border-white/10 backdrop-blur-xl text-sm font-black uppercase tracking-widest">
                  {String(active3dEmoji.nickname)} sent {String(active3dEmoji.emoji.char)}
                </span>
              </div>
            </div>
          )}

          {/* Video Area - 2x2 grid fits viewport */}
          <div className="flex-1 min-h-0 relative">
            <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-3 pb-20 sm:pb-24">
              <div className={`grid w-full h-full max-w-full max-h-full gap-2 sm:gap-3 min-h-0 ${gridClass}`}>
                {displayTiles.map((tile, idx) => {
                  const tileSpeakerId = tile.type === 'peer' ? tile.peer?.socketId : tile.type === 'local' ? 'local' : null;
                  const isSpeaking = activeSpeakerId === tileSpeakerId;
                  return (
                    <div
                      key={idx}
                      className={`relative min-w-0 min-h-0 rounded-2xl sm:rounded-3xl overflow-hidden border-2 bg-[#0c0e1a] shadow-2xl transition-all duration-300 ${tile.isPinned ? 'border-amber-400 ring-4 ring-amber-400/40 shadow-[0_0_30px_rgba(251,191,36,0.4)]' : (isSpeaking ? 'border-indigo-500 ring-4 ring-indigo-500/60 shadow-[0_0_30px_rgba(99,102,241,0.6)] animate-speaking-pulse' : 'border-indigo-500/30')}`}
                    >
                      {tile.type === 'local' ? (
                        <VideoTile
                          stream={localStreamRef.current}
                          label={nickname || 'You'}
                          isMe={true}
                          isCreator={isCreator}
                        />
                      ) : (tile.type === 'peer' && tile.peer?.stream) ? (
                        <VideoTile
                          stream={tile.peer.stream}
                          label={tile.peer.nickname || 'Stranger'}
                          flag={tile.peer.country && countryToFlag(tile.peer.country)}
                          isCreator={tile.peer.isCreator}
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 bg-[#0c0e1a]/80">
                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center text-3xl sm:text-4xl">👤</div>
                          <p className="text-[10px] font-bold text-white/50">{tile.type === 'searching' ? 'Searching...' : 'Waiting for player...'}</p>
                          {tile.type === 'empty' && (
                            <button type="button" onClick={(e) => { e.stopPropagation(); copyRoomLink(); }} className="mt-2 px-3 py-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-[9px] font-bold uppercase tracking-wider hover:bg-indigo-500/30 transition-all min-h-[44px]">
                              Copy Invite Link
                            </button>
                          )}
                        </div>
                      )}

                      {/* Reconnecting overlay */}
                      {tile.type === 'peer' && tile.peer && reconnectingPeers.has(tile.peer.socketId) && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-10">
                          <div className="w-10 h-10 border-2 border-indigo-500/50 border-t-indigo-400 rounded-full animate-spin" />
                          <p className="mt-2 text-xs font-bold text-indigo-300 uppercase tracking-wider">Reconnecting...</p>
                        </div>
                      )}

                      {/* Overlay Label + controls */}
                      <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 right-2 sm:right-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-full bg-black/50 border border-white/10 backdrop-blur-md">
                          <div className={`w-1.5 h-1.5 rounded-full ${tile.type === 'local' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                          <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-white/80 flex items-center gap-1">
                            {tile.type === 'local' ? 'You' : tile.peer?.nickname || 'Stranger'}
                            {((tile.type === 'local' && isCreator) || (tile.type === 'peer' && tile.peer?.isCreator)) && <BlueTick />}
                          </span>
                          {/* Connection quality bars: good=3 green, fair=2, poor=1 amber */}
                          {tile.type === 'peer' && tile.peer && (
                            <div className="flex gap-0.5 ml-1 items-end" title={`Connection: ${connectionQuality.get(tile.peer.socketId) || 'good'}`}>
                              {[1, 2, 3].map(i => {
                                const q = connectionQuality.get(tile.peer.socketId) || 'good';
                                const filled = q === 'good' ? 3 : q === 'fair' ? 2 : 1;
                                const isFilled = i <= filled;
                                return <div key={i} className={`w-0.5 rounded-[1px] ${isFilled ? (q === 'poor' ? 'bg-amber-500/90' : q === 'fair' ? 'bg-amber-400/80' : 'bg-emerald-500/90') : 'bg-white/20'}`} style={{ height: 4 + i * 4 }} />;
                              })}
                            </div>
                          )}
                          {tile.type === 'local' && (
                            <div className="flex gap-0.5 ml-1 items-end">
                              {[1, 2, 3].map(i => (
                                <div key={i} className="w-0.5 rounded-[1px] bg-blue-500/80" style={{ height: 4 + i * 4 }} />
                              ))}
                            </div>
                          )}
                          {(tile.type === 'local' ? muted : false) && <span className="text-rose-400 text-[10px]">🔇</span>}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setPinnedId(pinnedId === (tile.type === 'peer' ? tile.peer?.socketId : 'local') ? null : (tile.type === 'peer' ? tile.peer?.socketId : 'local')); }}
                          className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full transition-all min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#0c0e1a] ${pinnedId === (tile.type === 'peer' ? tile.peer?.socketId : 'local') ? 'bg-indigo-500 text-white' : 'bg-black/50 hover:bg-white/20 text-white/70'}`}
                          aria-label={pinnedId === (tile.type === 'peer' ? tile.peer?.socketId : 'local') ? 'Unpin' : 'Pin to corner'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {showChat && (
          <aside className="fixed inset-0 sm:relative sm:w-80 h-full bg-[#1a1d21] border-l border-white/5 flex flex-col animate-slide-in-right z-[160]">
            <header className="p-4 border-b border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Group Chat</span>
              <button
                onClick={() => setShowChat(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-rose-500 hover:text-white text-white/20 transition-all font-bold"
              >
                ✕
              </button>
            </header>

            <div id="group-video-chat-messages" className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {messages.map((m, i) => (
                <div key={m.id || `msg-${i}`} className={`flex flex-col ${m.system ? 'items-center py-2' : m.socketId === socket.id ? 'items-end' : 'items-start'} group animate-fade-in`}>
                  {m.system ? (
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/10 text-center px-4">{m.text}</span>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-[9px] font-bold text-white/20 uppercase flex items-center gap-1">
                          {m.nickname || 'Stranger'}
                          {m.isCreator && <BlueTick />}
                        </span>
                        {m.socketId !== socket.id && (
                          <button
                            onClick={() => {
                              setReplyingTo(m);
                              inputRef.current?.focus();
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-indigo-400 font-bold"
                          >
                            Reply
                          </button>
                        )}
                      </div>

                      <div className={`relative max-w-[90%] px-4 py-2.5 rounded-2xl text-sm ${m.socketId === socket.id ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white/5 text-white/90 rounded-tl-none border border-white/5 shadow-inner'}`}>
                        {m.replyTo && (
                          <div className="mb-2 p-2 rounded-lg bg-black/20 border-l-2 border-indigo-400 text-[10px] opacity-60 italic">
                            <div className="font-bold not-italic mb-0.5">{m.replyTo.nickname}</div>
                            {m.replyTo.text}
                          </div>
                        )}
                        {m.text}
                      </div>
                    </>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
              {sparks.map(s => <MessageSpark key={s.id} x={s.x} y={s.y} />)}
            </div>

            <div className="p-4 bg-[#0c0e1a] border-t border-white/5">
              {replyingTo && (
                <div className="mb-2 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between shadow-xl animate-slide-in-up">
                  <div className="text-[10px] text-indigo-300 italic truncate pr-4">Replying to {replyingTo.nickname}: {replyingTo.text}</div>
                  <button onClick={() => setReplyingTo(null)} className="text-indigo-300 hover:text-white">✕</button>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Send packet..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 transition-all outline-none text-white shadow-inner"
                />
                <button onClick={sendMessage} className="w-12 h-12 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white shadow-lg transition-all active:scale-95">
                  🚀
                </button>
              </div>
            </div>
          </aside>
        )}
      </main>

      {/* BOTTOM CONTROL BAR - Cam, Blur, Mute, Leave only - min 44px tap targets */}
      <footer className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 sm:gap-4 px-4 py-3 rounded-full bg-black/60 border border-white/10 backdrop-blur-2xl shadow-2xl z-[150]">
        <button onClick={toggleCamera} title={cameraOff ? 'Turn camera on' : 'Turn camera off'} aria-label={cameraOff ? 'Turn camera on' : 'Turn camera off'} className={`min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-black/60 ${cameraOff ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' : 'bg-white/10 text-white hover:bg-white/20'}`}>
          {cameraOff ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15v2a2 2 0 01-2 2h-2v-4l-3-3" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          )}
        </button>
        <button onClick={() => setCameraBlur(b => !b)} title={cameraBlur ? 'Remove blur' : 'Blur background'} aria-label={cameraBlur ? 'Remove background blur' : 'Blur background'} className={`min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-black/60 ${cameraBlur ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        </button>
        <button onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'} className={`min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-black/60 ${muted ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' : 'bg-white/10 text-white hover:bg-white/20'}`}>
          {muted ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
          )}
        </button>
        <button onClick={onLeave} title="Leave call" aria-label="Leave call" className="min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/30 transition-all focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 focus:ring-offset-black/60">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.683A1 1 0 008.279 3H5z" /></svg>
        </button>
        {isCreator && (
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center rounded-full transition-all ${isRecording ? 'bg-red-600 animate-pulse' : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'}`}
          >
            {isRecording ? '⏹️' : 'REC'}
          </button>
        )}
        <button
          onClick={() => setShowChat(!showChat)}
          className={`min-w-[44px] min-h-[44px] w-11 h-11 flex items-center justify-center rounded-full transition-all ${showChat ? 'bg-indigo-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
        >
          💬
        </button>
      </footer>

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest shadow-2xl animate-slide-in-up">
          {toast}
        </div>
      )}
    </div>
  );
}

function PiPLocalVideo({ stream, cameraBlur }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
  }, [stream]);
  if (!stream) return <div className="w-full h-full flex items-center justify-center bg-indigo-500/20 text-2xl">🙋</div>;
  return <video ref={ref} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" style={cameraBlur ? { filter: 'blur(15px)' } : {}} />;
}

function RemoteVideoTile({ stream, socketId }) {
  const ref = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasVideo, setHasVideo] = useState(true);
  const playCountRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || !stream) return;
    const videoTracks = stream.getVideoTracks();
    const hasActiveVideo = videoTracks.some(t => t.readyState === 'live' && t.enabled);
    setHasVideo(videoTracks.length > 0 && hasActiveVideo);

    if (!hasActiveVideo && videoTracks.length === 0) {
      setHasVideo(false);
      return;
    }
    if (!hasActiveVideo) {
      const check = () => {
        if (stream.getVideoTracks().some(t => t.readyState === 'live' && t.enabled)) {
          setHasVideo(true);
          el.srcObject = stream;
          el.play().catch(() => { });
        } else setTimeout(check, 300);
      };
      setTimeout(check, 300);
      return;
    }
    el.srcObject = stream;
    const tryPlay = async () => {
      try {
        if (el.paused) { await el.play(); setIsPlaying(true); }
      } catch (e) {
        if (playCountRef.current < 5) { playCountRef.current++; setTimeout(tryPlay, 500); }
      }
    };
    tryPlay();
    const onUnmute = () => { setIsPlaying(true); tryPlay(); };
    stream.getTracks().forEach((t) => { t.enabled = true; t.addEventListener('unmute', onUnmute); });
    return () => stream.getTracks().forEach((t) => t.removeEventListener('unmute', onUnmute));
  }, [stream]);

  if (!stream) return null;

  return (
    <div className="absolute inset-0 w-full h-full bg-[#0c0e1a]">
      <video ref={ref} autoPlay playsInline className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${isPlaying && hasVideo ? 'opacity-100' : 'opacity-0'}`} />
      {(!isPlaying || !hasVideo) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-indigo-500/10">
          {!isPlaying && hasVideo ? (
            <>
              <div className="w-10 h-10 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
              <p className="text-[8px] font-black uppercase tracking-widest text-indigo-400/50">Connecting...</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-indigo-500/20 border-2 border-indigo-500/40 flex items-center justify-center text-3xl sm:text-4xl">👤</div>
              <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Camera off</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
