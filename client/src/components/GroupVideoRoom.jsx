/**
 * GroupVideoRoom – Up to 4 anonymous users in a video room
 * Premium 2x2 grid layout, WebRTC mesh, side chat panel
 */
import { useEffect, useRef, useState } from 'react';
import { countryToFlag } from '../utils/countryFlag';
import { useIceServers } from '../hooks/useIceServers';
import { CoinBadge } from './CoinBadge';
import { playConnectSound, playMessageSound, playDisconnectSound, playWaveSound } from '../utils/sounds';

const GROUP_MAX = 4;
const ICEBREAKERS = [
  "What's something you've learned recently? 📚",
  "What would you do on a perfect day off? 🌟",
  "A song you can't stop listening to right now?",
  "If you could swap lives with anyone for a day, who? 🔄",
  "What's your hidden talent? 🎯",
  "What's the last thing you bought that you love? 🛒",
  "What's a show everyone should watch? 📺",
];

function VideoTile({ stream, label, flag, isMe, isEmpty, isSearching }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream) ref.current.srcObject = stream;
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
      <div className="tile-label">
        {flag && <span>{flag}</span>}
        <span>{label}</span>
        {isMe && <span className="text-xs opacity-50 ml-1">(you)</span>}
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

export function GroupVideoRoom({ roomId: roomIdProp, interest: interestProp, nickname, myCountry, socket, isQueuing, onLeave, onFindNewPod, onJoined, coinState }) {
  const { balance, streak, canClaim, nextClaim, claimCoins } = coinState;
  const { iceServers } = useIceServers();
  const roomIdRef = useRef(null);
  const roomId = roomIdProp ?? roomIdRef.current;
  const [displayInterest, setDisplayInterest] = useState(interestProp || 'general');
  const [peers, setPeers] = useState([]);
  const [participantCount, setParticipantCount] = useState(1);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [showChat, setShowChat] = useState(true);
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
  const hasJoinedRef = useRef(false);
  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [active3dEmoji, setActive3dEmoji] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
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
  const [localInterest, setLocalInterest] = useState(interestProp || 'general');
  const [joinRoomIdInput, setJoinRoomIdInput] = useState('');
  const [activeInterests, setActiveInterests] = useState([]);
  const [queuePos, setQueuePos] = useState(null);

  // Fetch active groups/interests on mount
  useEffect(() => {
    fetch('http://localhost:5000/api/rooms/active-interests?mode=group_video')
      .then(res => res.json())
      .then(data => setActiveInterests(data.interests || []))
      .catch(() => {});
  }, []);

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
  useEffect(() => {
    let s = null;
    (async () => {
      try {
        s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = s;
        setLocalStreamReady(true);
        if (localVideoRef.current) localVideoRef.current.srcObject = s;
      } catch (err) {
        console.error('getUserMedia error:', err);
        setLocalStreamReady(true);
      }
    })();
    return () => { if (s) s.getTracks().forEach((t) => t.stop()); };
  }, []);

  // Sync local stream to video element when ref mounts (handles race)
  useEffect(() => {
    if (localStreamReady && localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [localStreamReady]);

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
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyzer = ctx.createAnalyser();
      analyzer.fftSize = 256;
      source.connect(analyzer);
      audioAnalyzersRef.current.set(id, { analyzer, ctx });
    } catch (e) { }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      let loudestId = null;
      let maxVol = 0;
      audioAnalyzersRef.current.forEach(({ analyzer }, id) => {
        const dataArr = new Uint8Array(analyzer.frequencyBinCount);
        analyzer.getByteFrequencyData(dataArr);
        const avg = dataArr.reduce((a, b) => a + b, 0) / dataArr.length;
        if (avg > maxVol && avg > 10) {
          maxVol = avg;
          loudestId = id;
        }
      });
      if (loudestId !== activeSpeakerId) setActiveSpeakerId(loudestId);
    }, 400);
    return () => clearInterval(interval);
  }, [activeSpeakerId]);

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
      const track = e.track;
      if (!track) return;

      const remoteStream = e.streams[0] || new MediaStream([track]);
      
      setPeers((prev) => {
        const existing = prev.find((p) => p.socketId === remoteId);
        let stream = existing?.stream || remoteStream;
        
        // Ensure track is in the stream
        if (!stream.getTracks().some(t => t.id === track.id)) {
            stream.addTrack(track);
        }

        const nick = peerNicksRef.current.get(remoteId) || 'Stranger';
        const ctry = peerCountriesRef.current.get(remoteId);

        if (track.kind === 'audio') {
          setupAudioAnalyzer(remoteId, stream);
        }

        if (existing) {
            return prev.map(p => p.socketId === remoteId ? { ...p, stream, nickname: nick, country: ctry } : p);
        }
        return [...prev, { socketId: remoteId, stream, nickname: nick, country: ctry }];
      });
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        setTimeout(() => {
          if (pc.iceConnectionState !== 'connected') {
            setPeers((p) => p.filter((x) => x.socketId !== remoteId));
            peerConnectionsRef.current.delete(remoteId);
            audioAnalyzersRef.current.delete(remoteId);
          }
        }, 3000);
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
    socket.emit('send-message', { roomId: rid, text: t });
    setChatInput('');
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
    };

    const onExistingPeers = (data) => {
      if (data.roomId) roomIdRef.current = data.roomId;
      setParticipantCount((data.peers?.length || 0) + 1);
      const peerList = data.peers || [];
      peerList.forEach((p) => {
        if (p.nickname) peerNicksRef.current.set(p.socketId, p.nickname);
        if (p.country) peerCountriesRef.current.set(p.socketId, p.country);
      });
      // Add peers immediately (stream: null) so tile exists; ontrack will add stream
      setPeers((prev) => {
        const existingIds = new Set(prev.map((p) => p.socketId));
        const toAdd = peerList.filter((p) => !existingIds.has(p.socketId)).map((p) => ({
          socketId: p.socketId, stream: null, nickname: p.nickname || 'Anonymous', country: p.country
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
        if (data.socketId !== socket.id) playMessageSound();
      }
    };

    const onUserJoined = (data) => {
      setParticipantCount(data.participantCount ?? 2);
      if (data.nickname) peerNicksRef.current.set(data.socketId, data.nickname);
      if (data.country) peerCountriesRef.current.set(data.socketId, data.country);
      setMessages((m) => [...m, { id: `sys-${Date.now()}`, system: true, text: `${data.nickname || 'A stranger'} joined 👋` }]);
      playConnectSound();
      // Add peer immediately so tile exists; ontrack will add stream
      setPeers((prev) => prev.some((p) => p.socketId === data.socketId) ? prev : [...prev, { socketId: data.socketId, stream: null, nickname: data.nickname || 'Anonymous', country: data.country }]);
      if (localStreamRef.current) {
        doOffer(data.socketId);
      } else {
        pendingPeersRef.current.push(data.socketId);
      }
    };

    const onUserLeft = (data) => {
      setParticipantCount((c) => Math.max(1, (data.participantCount ?? c) - 1));
      const sid = data.userId ?? data.socketId;
      if (sid) {
        const pc = peerConnectionsRef.current.get(sid);
        if (pc) { pc.close(); peerConnectionsRef.current.delete(sid); }
        const leavingNick = peerNicksRef.current.get(sid);
        setPeers((p) => p.filter((x) => x.socketId !== sid));
        if (leavingNick) setMessages((m) => [...m, { id: `sys-left-${Date.now()}`, system: true, text: `${leavingNick} left the room` }]);
        playDisconnectSound();
      }
    };

    const onSignal = (data) => {
      const from = data.fromSocketId;
      if (!from || from === socket.id) return;
      if (data.fromNickname) peerNicksRef.current.set(from, data.fromNickname);
      if (data.fromCountry) peerCountriesRef.current.set(from, data.fromCountry);
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

    socket.on('group-joined', onGroupJoined);
    socket.on('existing-peers', onExistingPeers);
    socket.on('chat-history', onHistory);
    socket.on('chat-message', onMsg);
    socket.on('user-joined', onUserJoined);
    socket.on('user-left', onUserLeft);
    socket.on('webrtc-signal', onSignal);
    socket.on('system-announcement', onSystemMsg);

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
    };
  }, [socket, onJoined]);

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

  useEffect(() => () => {
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.key === 'Escape') {
        onLeave();
      }
      if (e.key === 'Enter') {
        document.getElementById('group-video-chat-input')?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onLeave]);

  // Build tile array: [local, ...peers, ...empty/searching]
  const remotePeers = peers.slice(0, 3);
  const totalSlots = 4;
  const tiles = [];
  // slot 0: local
  tiles.push({ type: 'local' });
  // slots 1-3: peers or searching/empty
  for (let i = 0; i < 3; i++) {
    const peer = remotePeers[i];
    if (isQueuing && i === 0) {
      tiles.push({ type: 'searching' });
    } else if (peer) {
      tiles.push({ type: 'peer', peer });
    } else {
      tiles.push({ type: 'empty' });
    }
  }

  const localStream = localStreamRef.current;

  return (
    <div className="h-screen flex flex-col bg-[#1a1d21] text-white overflow-hidden font-sans select-none">
      {/* QUEUING OVERLAY */}
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
                   if(!localInterest.trim()) return alert("Interest is mandatory!");
                   setDisplayInterest(localInterest.trim());
                   socket.emit('join-group-by-interest', { interest: localInterest.trim(), nickname: 'Anonymous', mode: 'group_video' });
                   setShowEntryModal(false);
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
                    if(!cleanId) return alert("Enter a valid Room ID");
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

      {/* TOP MEETING BAR */}
      <header className="h-14 flex-shrink-0 flex items-center justify-between px-6 bg-[#1a1d21] border-b border-white/5 z-[80]">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-black text-white">M</div>
            <h1 className="font-bold text-sm tracking-tight hidden sm:block">Mana Mingle Meeting</h1>
          </div>
          <div className="h-4 w-[1px] bg-white/10 hidden sm:block" />
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/5 border border-white/5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/60">{formatTimer(connectedSecs)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 mr-4">
            <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Meeting ID:</span>
            <span className="text-[10px] font-mono text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">{(roomId || roomIdRef.current || 'QUEUING').substring(0, 8)}</span>
          </div>
          <button onClick={copyRoomLink} className="h-8 px-3 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all">Copy Link</button>
          <button onClick={() => setViewMode(viewMode === 'grid' ? 'speaker' : 'grid')} className="h-8 px-3 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-[10px] font-black uppercase tracking-widest text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all">
            {viewMode === 'grid' ? 'Speaker View' : 'Grid View'}
          </button>
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

          {active3dEmoji && (
            <div className="absolute inset-0 pointer-events-none z-[110] flex items-center justify-center">
              <div className="animate-3d-emoji-pop flex flex-col items-center gap-4">
                <img src={active3dEmoji.emoji.url} className="w-48 h-48 drop-shadow-2xl" alt="3d" />
                <span className="px-6 py-2 rounded-full bg-black/60 border border-white/10 backdrop-blur-xl text-sm font-black uppercase tracking-widest">
                  {active3dEmoji.nickname} sent {active3dEmoji.emoji.char}
                </span>
              </div>
            </div>
          )}

          {/* Video Area */}
          <div className="flex-1 min-h-0 relative">
            {viewMode === 'grid' ? (
              <div className="absolute inset-0 flex items-center justify-center p-2 sm:p-4">
                <div className="grid grid-cols-2 grid-rows-2 w-full max-w-6xl aspect-video gap-3 sm:gap-6">
                {tiles.map((tile, idx) => (
                  <div key={idx} className={`relative sm:aspect-video rounded-3xl sm:rounded-tl-[40px] sm:rounded-br-[40px] sm:rounded-tr-none sm:rounded-bl-none overflow-hidden border-2 border-indigo-500/30 bg-[#0c0e1a] shadow-2xl transition-all duration-500 ${activeSpeakerId === (tile.type === 'peer' ? tile.peer.socketId : null) ? 'ring-4 ring-indigo-500/50 border-indigo-500' : ''}`}>
                    {tile.type === 'local' ? (
                      <video ref={localVideoRef} autoPlay muted playsInline className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] transition-opacity duration-500 ${cameraOff ? 'opacity-20' : 'opacity-100'}`} style={cameraBlur ? { filter: 'blur(15px)', transform: 'scaleX(-1)' } : {}} />
                    ) : (tile.type === 'peer' && tile.peer.stream) ? (
                      <RemoteVideoTile stream={tile.peer.stream} socketId={tile.peer.socketId} />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl font-black text-white/10 select-none">M</div>
                        <p className="text-[8px] font-black uppercase tracking-[0.3em] text-white/20">{tile.type === 'searching' ? 'Scanning...' : 'Empty Slot'}</p>
                      </div>
                    )}

                    {/* Overlay Label */}
                    <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 rounded-full bg-black/40 border border-white/10 backdrop-blur-md">
                      <div className={`w-1.5 h-1.5 rounded-full ${tile.type === 'local' ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                      <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-white/80">
                        {tile.type === 'local' ? 'You' : tile.peer?.nickname || 'Stranger'}
                      </span>
                      {/* Network Indicator */}
                      <div className="flex gap-0.5 ml-1">
                         <div className={`w-0.5 h-1.5 ${tile.type === 'local' ? 'bg-blue-500/80' : 'bg-emerald-500/80'} rounded-[1px]`} />
                         <div className={`w-0.5 h-2 ${tile.type === 'local' ? 'bg-blue-500/80' : 'bg-emerald-500/80'} rounded-[1px]`} />
                         <div className={`w-0.5 h-2.5 ${tile.type === 'local' ? 'bg-blue-500/80' : 'bg-emerald-500/80'} rounded-[1px]`} />
                      </div>
                      {remoteRaisedHands.has(tile.type === 'peer' ? tile.peer.socketId : socket?.id) && (
                        <span className="text-[10px] animate-bounce ml-1">✋</span>
                      )}
                      {(tile.type === 'local' ? muted : false) && <span className="text-rose-400 text-[10px]">🔇</span>}
                    </div>

                    {/* Active Speaker Ring Indicator */}
                    {activeSpeakerId === (tile.type === 'peer' ? tile.peer.socketId : null) && (
                      <div className="absolute inset-0 border-4 border-indigo-500 rounded-3xl pointer-events-none" />
                    )}
                  </div>
                ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col gap-4">
                {/* Speaker Stage */}
                <div className="flex-[4] relative rounded-3xl sm:rounded-tl-[40px] sm:rounded-br-[40px] sm:rounded-tr-none sm:rounded-bl-none overflow-hidden border-2 border-indigo-500/30 bg-[#0c0e1a] shadow-2xl">
                  {(() => {
                    const speaker = peers.find(p => p.socketId === (activeSpeakerId || (peers.length > 0 ? peers[0].socketId : null)));
                    if (speaker) return <RemoteVideoTile stream={speaker.stream} socketId={speaker.socketId} />;
                    return <video ref={localVideoRef} autoPlay muted playsInline className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] ${cameraOff ? 'opacity-20' : ''}`} />;
                  })()}
                  <div className="absolute bottom-6 left-6 flex items-center gap-3 px-4 py-2 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-xl">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-white/90">Speaker Stage</span>
                  </div>
                </div>
                {/* Peer Strip */}
                <div className="flex-1 flex gap-4 overflow-x-auto pb-2">
                  {tiles.map((tile, idx) => (
                      <div key={idx} className="h-full aspect-video rounded-xl sm:rounded-tl-[20px] sm:rounded-br-[20px] sm:rounded-tr-none sm:rounded-bl-none overflow-hidden border-2 border-indigo-500/30 bg-black/40 flex-shrink-0 relative">
                      {tile.type === 'local' ? (
                        <video ref={localVideoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
                      ) : tile.type === 'peer' ? (
                        <RemoteVideoTile stream={tile.peer.stream} socketId={tile.peer.socketId} />
                      ) : <div className="absolute inset-0 flex items-center justify-center">👤</div>}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                      <span className="absolute bottom-2 left-3 text-[8px] font-black uppercase tracking-widest text-white/60">{tile.type === 'local' ? 'You' : tile.peer?.nickname}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* SIDE PANELS */}
        <div className="flex-shrink-0 flex">
          {showParticipants && (
            <div className="w-80 bg-[#1a1d21] border-l border-white/5 flex flex-col animate-slide-in-right z-50">
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Participants ({participantCount})</h2>
                <button onClick={() => setShowParticipants(false)} className="text-white/20 hover:text-white">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold">ME</div>
                    <span className="text-xs font-bold text-white/90">You</span>
                  </div>
                  <div className="flex gap-2 text-xs">
                    {muted && <span>🔇</span>}
                    {cameraOff && <span>📸</span>}
                  </div>
                </div>
                {peers.map(p => (
                  <div key={p.socketId} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">
                        {countryToFlag(p.country) || '👤'}
                      </div>
                      <span className="text-xs font-medium text-white/70">{p.nickname}</span>
                    </div>
                    {remoteRaisedHands.has(p.socketId) && <span className="text-xs animate-bounce">✋</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {showChat && (
            <div className="absolute inset-x-0 bottom-0 top-1/2 z-50 pointer-events-none sm:pointer-events-auto sm:static sm:flex-1 sm:w-80 sm:h-full bg-black/20 sm:bg-[#1a1d21] border-t sm:border-t-0 sm:border-l border-white/5 flex flex-col animate-slide-in-up sm:animate-slide-in-right">
              <div className="hidden sm:flex p-4 border-b border-white/5 items-center justify-between">
                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">In-Meeting Chat</h2>
                <button onClick={() => setShowChat(false)} className="text-white/20 hover:text-white">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 pointer-events-none" id="group-video-chat-messages">
                {messages.map((m, i) => {
                  const isMe = m.socketId === socket.id;
                  const now = Date.now();
                  if (m.ts && now - m.ts > 30000) return null; // 30s vanish
                  return (
                    <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-message-pop`}>
                      {!m.system && <span className="text-[8px] font-black uppercase text-white/20 mb-1 px-1">{m.nickname || 'Stranger'}</span>}
                      <div className={`px-4 py-2 rounded-2xl text-xs ${m.system ? 'bg-white/5 text-white/30 italic text-[10px]' : isMe ? 'bg-indigo-500 text-white rounded-tr-none' : 'bg-black/60 backdrop-blur-md text-white/90 rounded-tl-none border border-white/10'}`}>
                        {m.text}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
              <div className="p-4 sm:bg-[#16191c] sm:border-t sm:border-white/5 pointer-events-auto bg-gradient-to-t from-black/80 to-transparent">
                 {/* Mobile Quick Controls above input */}
                 <div className="flex sm:hidden items-center justify-center gap-4 mb-4 scale-90">
                     <button onClick={toggleMute} className={`w-9 h-9 rounded-xl flex items-center justify-center ${muted ? 'bg-rose-500' : 'bg-white/10'}`}>{muted ? '🔇' : '🎤'}</button>
                     <button onClick={toggleCamera} className={`w-9 h-9 rounded-xl flex items-center justify-center ${cameraOff ? 'bg-rose-500' : 'bg-white/10'}`}>{cameraOff ? '📷' : '📹'}</button>
                     <button onClick={toggleHandRaise} className={`w-9 h-9 rounded-xl flex items-center justify-center ${handRaised ? 'bg-amber-400' : 'bg-white/10'}`}>✋</button>
                     <button onClick={onLeave} className="w-9 h-9 rounded-xl flex items-center justify-center bg-rose-500/20 text-rose-500 text-[10px] font-bold">End</button>
                 </div>

                <div className="flex gap-2">
                  <input autoFocus value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Message..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-indigo-500/50 transition-all placeholder:text-white/20" />
                  <button onClick={sendMessage} className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center active:scale-95 transition-all shadow-lg shadow-indigo-500/20">🚀</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* BOTTOM CONTROL BAR */}
      {/* BOTTOM CONTROL BAR - FLOATING & SMALLER */}
      <footer className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center justify-center gap-1 sm:gap-4 px-3 py-1.5 rounded-2xl bg-black/40 border border-white/5 backdrop-blur-xl shadow-2xl z-[150] scale-90 sm:scale-100">
        <div className="flex items-center gap-1">
          <button onClick={toggleMute} className={`group flex flex-col items-center gap-1 px-3 py-1 transition-all ${muted ? 'text-rose-500' : 'hover:bg-white/5 rounded-lg'}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${muted ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-white/5'}`}>
              {muted ? '🔇' : '🎤'}
            </div>
          </button>
          <button onClick={toggleCamera} className={`group flex flex-col items-center gap-1 px-3 py-1 transition-all ${cameraOff ? 'text-rose-500' : 'hover:bg-white/5 rounded-lg'}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${cameraOff ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-white/5'}`}>
              {cameraOff ? '📷' : '📹'}
            </div>
          </button>
        </div>

        <div className="h-6 w-[1px] bg-white/10 mx-1" />

        <div className="flex items-center gap-0.5 sm:gap-1">
          <button onClick={() => setShowParticipants(!showParticipants)} className={`group flex flex-col items-center gap-1 px-2 py-1 transition-all ${showParticipants ? 'text-indigo-400' : 'hover:bg-white/5 rounded-lg'}`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center group-hover:bg-white/10 transition-all ${showParticipants ? 'bg-indigo-500/20 border border-indigo-500/30' : 'bg-white/5'}`}>
               <span className="text-sm">👥</span>
            </div>
          </button>
          <button onClick={() => setShowChat(!showChat)} className={`group flex flex-col items-center gap-1 px-2 py-1 transition-all ${showChat ? 'text-indigo-400' : 'hover:bg-white/5 rounded-lg'}`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center group-hover:bg-white/10 transition-all ${showChat ? 'bg-indigo-500/20 border border-indigo-500/30' : 'bg-white/5'}`}>
               <span className="text-sm">💬</span>
            </div>
          </button>
          <button onClick={toggleHandRaise} className={`group flex flex-col items-center gap-1 px-2 py-1 transition-all ${handRaised ? 'text-amber-400' : 'hover:bg-white/5 rounded-lg'}`}>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${handRaised ? 'bg-amber-400 text-white shadow-lg shadow-amber-500/20' : 'bg-white/5'}`}>
               <span className="text-sm">✋</span>
            </div>
          </button>
          <div className="relative group">
            <button className="group flex flex-col items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5 transition-all">
              <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-all">
                <span className="text-sm">😀</span>
              </div>
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 p-2 bg-[#2a2d32] border border-white/10 rounded-2xl shadow-2xl flex gap-1.5 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all scale-75 group-hover:scale-100">
              {['👏', '❤️', '😂', '😮', '👍', '🎉'].map(emoji => (
                <button key={emoji} onClick={() => sendReaction(emoji)} className="w-8 h-8 rounded-lg hover:bg-white/5 text-base transition-all">{emoji}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-6 w-[1px] bg-white/10 mx-1" />

        <button onClick={onLeave} className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-black uppercase tracking-widest shadow-lg shadow-rose-600/20 active:scale-95 transition-all">
          Leave
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

function RemoteVideoTile({ stream, socketId }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !stream) return;
    
    // Explicitly handle track-to-stream assignment for maximum cross-browser visibility
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    
    const play = () => {
      if (el.paused) el.play?.().catch(() => { });
    };
    
    play();
    const t1 = setTimeout(play, 100);
    const t2 = setTimeout(play, 1000);
    
    stream.getTracks().forEach((t) => {
      t.enabled = true;
      t.addEventListener('unmute', play);
    });
    
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      stream.getTracks().forEach((t) => t.removeEventListener('unmute', play));
    };
  }, [stream]);

  if (!stream) return null;
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      className="absolute inset-0 w-full h-full object-cover sm:rounded-tl-[40px] sm:rounded-br-[40px]"
      style={{ pointerEvents: 'none' }}
    />
  );
}
