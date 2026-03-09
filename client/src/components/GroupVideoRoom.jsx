/**
 * GroupVideoRoom – Up to 4 anonymous users in a video room
 * Premium 2x2 grid layout, WebRTC mesh, side chat panel
 */
import { useEffect, useRef, useState } from 'react';
import { countryToFlag } from '../utils/countryFlag';
import { useIceServers } from '../hooks/useIceServers';

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
  const { balance, streak, canClaim, claimCoins } = coinState;
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

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

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
      const nick = peerNicksRef.current.get(remoteId) || 'Stranger';
      const ctry = peerCountriesRef.current.get(remoteId);
      const stream = e.streams?.[0] || (e.track ? new MediaStream([e.track]) : null);
      if (!stream) return;
      setPeers((prev) => {
        const filtered = prev.filter((p) => p.socketId !== remoteId);
        return [...filtered, { socketId: remoteId, stream, nickname: nick, country: ctry }];
      });
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        setTimeout(() => {
          if (pc.iceConnectionState !== 'connected') {
            setPeers((p) => p.filter((x) => x.socketId !== remoteId));
            peerConnectionsRef.current.delete(remoteId);
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
      if (data.roomId === (roomIdRef.current || roomId)) setMessages((m) => [...m.slice(-100), data]);
    };

    const onUserJoined = (data) => {
      setParticipantCount(data.participantCount ?? 2);
      if (data.nickname) peerNicksRef.current.set(data.socketId, data.nickname);
      if (data.country) peerCountriesRef.current.set(data.socketId, data.country);
      setMessages((m) => [...m, { id: `sys-${Date.now()}`, system: true, text: `${data.nickname || 'A stranger'} joined 👋` }]);
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
                pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
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
      return () => {
        socket.off('3d-emoji');
        socket.off('media-message');
      };
    }
  }, [socket]);

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
    <div className="h-screen flex flex-col bg-[#070811] text-white overflow-hidden">
      {/* HEADER */}
      <header className="app-header shrink-0">
        <div className="flex items-center gap-3">
          <div className="logo-icon text-sm">M</div>
          <div>
            <h1 className="font-bold text-white leading-none">Mana Mingle</h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(232,234,246,0.45)' }}>
              Group Video · #{displayInterest}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end min-w-0">
          <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 shrink-0">
            <span className="text-xs sm:text-sm">🪙</span>
            <span className="text-[10px] sm:text-[11px] font-bold text-indigo-300">{balance}</span>
            <div className="hidden sm:block w-px h-3 bg-white/10 mx-0.5" />
            <span className="hidden sm:inline text-[10px] font-medium text-white/40">🔥 {streak}d</span>
          </div>
          {canClaim && (
            <button
              onClick={claimCoins}
              className="flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-black text-[9px] sm:text-[10px] font-black uppercase tracking-tighter rounded-full shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all animate-coin-glow shrink-0"
            >
              <span className="hidden sm:inline">Claim 30 Coins</span>
              <span className="sm:hidden">+30 🪙</span>
            </button>
          )}

          <div className="online-pill shrink-0 text-[11px] sm:text-sm">
            <svg className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>{participantCount}/4</span>
          </div>
          <button
            onClick={() => setShowChat(!showChat)}
            className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition shrink-0 ${showChat ? 'bg-indigo-500 text-white' : 'bg-white/5 text-realm-muted hover:bg-white/10'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </button>
          {onFindNewPod && !isQueuing && (
            <button
              id="group-video-skip-top"
              onClick={onFindNewPod}
              className="btn btn-amber shrink-0 h-10 px-4 py-0"
            >
              Skip →
            </button>
          )}
          <button
            id="group-video-leave-btn"
            onClick={onLeave}
            className="btn btn-danger shrink-0 h-10 px-4 py-0"
          >
            {isQueuing ? 'Cancel' : 'Leave'}
          </button>
        </div>
      </header>

      {/* ICEBREAKER */}
      {
        !isQueuing && icebreaker && (
          <div className="flex-shrink-0 px-4 py-2 bg-teal-500/[0.06] border-b border-teal-500/15 flex items-center gap-3">
            <span className="text-teal-400 text-sm font-semibold flex-shrink-0">🧊</span>
            <span className="text-sm text-white/70 truncate">{icebreaker}</span>
          </div>
        )
      }

      {/* BODY */}
      <div className="flex-1 flex flex-col sm:flex-row min-h-0 overflow-hidden">
        {/* VIDEO GRID */}
        <div className={`flex-1 flex flex-col min-h-0 min-w-0 relative ${showChat ? 'sm:max-w-[calc(100%-300px)]' : ''}`}>
          {active3dEmoji && (
            <div className="absolute inset-0 pointer-events-none z-[100] flex items-center justify-center overflow-hidden">
              <div className="animate-3d-emoji-pop flex flex-col items-center gap-2">
                <picture>
                  <source srcSet={active3dEmoji.emoji.url} type="image/webp" />
                  <img src={active3dEmoji.emoji.url} className="w-32 h-32" alt="3d" />
                </picture>
                <span className="bg-black/80 px-4 py-1.5 rounded-full text-xs font-bold border border-white/10 shadow-2xl">
                  {active3dEmoji.nickname} sent {active3dEmoji.emoji.char}
                </span>
              </div>
            </div>
          )}
          <div className="flex-1 video-grid-2x2 p-3 min-h-0">
            {tiles.map((tile, idx) => {
              if (tile.type === 'local') {
                return (
                  <div key="local" className={`video-tile mirror ${cameraOff ? '' : ''}`} style={{ minHeight: 140 }}>
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className={`w-full h-full object-cover ${cameraOff ? 'opacity-20' : ''}`}
                    />
                    {!localStreamReady && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0c0e1a]">
                        <div className="relative w-12 h-12">
                          <div className="radar-ring absolute inset-0" />
                          <div className="absolute inset-2 rounded-full bg-indigo-500/20 flex items-center justify-center text-lg">📹</div>
                        </div>
                        <p className="text-xs" style={{ color: 'rgba(232,234,246,0.5)' }}>Starting camera...</p>
                      </div>
                    )}
                    {cameraOff && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <svg className="w-8 h-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2zM3 3l18 18" />
                        </svg>
                      </div>
                    )}
                    <div className="tile-label">
                      {countryToFlag(myCountry) && <span>{countryToFlag(myCountry)}</span>}
                      <span>You</span>
                      {muted && <span className="text-red-400 text-xs ml-1">🔇</span>}
                    </div>
                  </div>
                );
              }
              if (tile.type === 'searching') {
                return (
                  <div key="searching" className="video-tile flex flex-col items-center justify-center gap-3" style={{ minHeight: 140 }}>
                    <div className="relative w-12 h-12">
                      <div className="radar-ring absolute inset-0" />
                      <div className="radar-ring absolute inset-2" style={{ animationDelay: '0.6s' }} />
                      <div className="absolute inset-3 rounded-full bg-indigo-500/20 flex items-center justify-center">📡</div>
                    </div>
                    <p className="text-xs" style={{ color: 'rgba(232,234,246,0.45)' }}>Finding room...</p>
                    <div className="search-dots" style={{ transform: 'scale(0.75)' }}><span /><span /><span /></div>
                  </div>
                );
              }
              if (tile.type === 'peer') {
                const { peer } = tile;
                return (
                  <div key={peer.socketId} className="video-tile" style={{ minHeight: 140 }}>
                    {peer.stream ? (
                      <RemoteVideoTile stream={peer.stream} socketId={peer.socketId} />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                        <div className="peer-avatar text-xl" style={{ width: 48, height: 48, fontSize: '1.25rem' }}>👤</div>
                        <div className="search-dots" style={{ transform: 'scale(0.7)' }}><span /><span /><span /></div>
                      </div>
                    )}
                    <div className="tile-label">
                      {countryToFlag(peer.country) && <span>{countryToFlag(peer.country)}</span>}
                      <span>{peer.nickname || 'Stranger'}</span>
                    </div>
                    <div className="absolute top-2 right-2 live-dot" />
                    <button
                      type="button"
                      onClick={() => alert('Report submitted. Our team will review this session.')}
                      className="report-btn"
                      title="Report"
                    >
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                      </svg>
                    </button>
                  </div>
                );
              }
              // empty
              return (
                <div key={`empty-${idx}`} className="video-tile flex flex-col items-center justify-center gap-2 opacity-30" style={{ minHeight: 140 }}>
                  <div className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center">⏳</div>
                  <p className="text-xs" style={{ color: 'rgba(232,234,246,0.4)' }}>Waiting for participant</p>
                </div>
              );
            })}
          </div>

          {/* CONTROL BAR */}
          <div className="control-bar flex-shrink-0">
            <button
              id="grp-video-mute-btn"
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
              id="grp-video-cam-btn"
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
            <div className="h-8 w-px bg-white/[0.08] mx-1" />
            {onFindNewPod && !isQueuing && (
              <button id="grp-video-ctrl-skip" type="button" onClick={onFindNewPod} className="btn btn-amber px-5 py-2.5">
                Skip Room
              </button>
            )}
            <button id="grp-video-ctrl-leave" type="button" onClick={onLeave} className="btn btn-danger px-5 py-2.5">
              {isQueuing ? 'Cancel' : 'Leave Room'}
            </button>
          </div>
        </div>

        {/* CHAT SIDEBAR */}
        {showChat && (
          <div className="chat-panel flex-shrink-0">
            <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
              <span className="text-sm font-semibold text-white/80">Room Chat</span>
              <button
                type="button"
                onClick={() => setIsTranslatorActive(!isTranslatorActive)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[8px] font-bold uppercase transition-all border ${isTranslatorActive ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-white/5 border-white/10 text-white/30'}`}
              >
                AI Translate
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0" id="group-video-chat-messages">
              {messages.length === 0 && !isQueuing && (
                <div className="sys-msg">Chat with your group here 💬</div>
              )}
              {isQueuing && (
                <div className="sys-msg">Chat will be available once you join a room</div>
              )}
              {messages.map((m, i) => {
                if (m.system) return <div key={m.id} className="sys-msg">{m.text}</div>;
                const isMe = m.nickname === (nickname || 'Anonymous');
                return (
                  <div key={m.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {!isMe && (
                      <span className="text-xs font-semibold text-indigo-300 px-1 mb-0.5">{m.nickname}</span>
                    )}
                    <div className={`msg-bubble ${isMe ? 'me' : 'them'}`}>
                      {m.media ? (
                        <div className="max-w-[180px] rounded-lg overflow-hidden border border-white/10">
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
                                  <span className="text-[9px] opacity-40 uppercase font-bold tracking-widest leading-none mb-1">AI Translate</span>
                                  <span className="opacity-60 text-[10px] italic line-through mb-0.5">{m.text}</span>
                                  <span className="text-white font-medium">✨ {m.translated}</span>
                                </>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] opacity-40 uppercase font-bold tracking-widest animate-pulse">Translating...</span>
                                  <span className="opacity-80">{m.text}</span>
                                </div>
                              )}
                            </div>
                          ) : m.text}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            <div className="flex-shrink-0 p-3 border-t border-white/[0.06] flex gap-1.5 sm:gap-2 min-w-0 items-center">
              <input
                id="group-video-chat-input"
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={isAiGenerating ? 'AI thinking...' : (isQueuing ? 'Joining...' : 'Message...')}
                disabled={isQueuing || !roomId || isAiGenerating}
                className={`chat-input flex-1 min-w-0 py-2.5 px-4 text-sm transition-all ${isAiGenerating ? 'opacity-50' : ''}`}
              />
              {!isQueuing && (
                <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-lg bg-white/5 border border-white/5 text-white/30 hover:text-emerald-400 transition-colors"
                    title="Media (10-15 Coins)"
                  >
                    📂
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleMediaUpload} />
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-2 rounded-lg bg-white/5 border border-white/5 text-white/30 hover:text-amber-400 transition-colors"
                      title="3D Emojis (5 Coins)"
                    >
                      ✨
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute bottom-full right-0 mb-2 p-2 bg-[#1b1f35] border border-white/10 rounded-xl shadow-2xl w-[160px] grid grid-cols-4 gap-1.5 animate-slide-in-up z-[60]">
                        <div className="col-span-4 text-[9px] font-black uppercase text-white/20 mb-0.5 px-0.5">3D Emojis (5🪙)</div>
                        {EMOJIS_3D.map(e => (
                          <button
                            key={e.char}
                            onClick={() => send3dEmoji(e)}
                            className="w-7 h-7 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded text-base transition-all"
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
                    className="p-2 rounded-lg bg-white/5 border border-white/5 text-white/30 hover:text-indigo-400 transition-colors"
                  >
                    <svg className={`w-4 h-4 ${isAiGenerating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </button>
                </div>
              )}
              <button
                id="group-video-send-btn"
                type="button"
                onClick={sendMessage}
                disabled={isQueuing || !chatInput.trim() || !roomId}
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
    </div >
  );
}

function RemoteVideoTile({ stream, socketId }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !stream) return;
    ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />;
}
