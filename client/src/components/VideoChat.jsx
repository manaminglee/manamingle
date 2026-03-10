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

export function VideoChat({ socket, connected, country, onlineCount, interest = 'general', nickname = 'Anonymous', adsEnabled = false, onBack, onJoined, onFindNewPartner, coinState }) {
  const { balance, streak, canClaim, nextClaim, claimCoins } = coinState;
  const { iceServers } = useIceServers();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [roomId, setRoomId] = useState(null);
  const [peer, setPeer] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | searching | connected | disconnected
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
  const [pipOffset, setPipOffset] = useState({ x: 0, y: 0 });
  const [videoDevices, setVideoDevices] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState(
    () => (typeof window !== 'undefined' ? window.localStorage.getItem('mm_videoDeviceId') : null)
  );
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState(
    () => (typeof window !== 'undefined' ? window.localStorage.getItem('mm_audioDeviceId') : null)
  );
  const [remoteVolume, setRemoteVolume] = useState(1);
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
    vt.applyConstraints(c).catch(() => {});
  }, [lowBandwidth, autoBandwidth, latency]);

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream, status]);

  // Attach remote stream and volume
  useEffect(() => {
    if (remoteVideoRef.current && peer?.stream) {
      remoteVideoRef.current.srcObject = peer.stream;
      remoteVideoRef.current.volume = remoteVolume;
    }
  }, [peer?.stream, remoteVolume]);

  const bandwidthLabel = autoBandwidth ? 'Auto' : (lowBandwidth ? 'Low' : 'High');

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

  // Global keyboard shortcuts (desktop)
  useEffect(() => {
    const handler = (e) => {
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.key === 's' || e.key === 'S') {
        if (status === 'idle' || status === 'disconnected') {
          handleStart();
        } else if (status === 'searching' || status === 'connected') {
          handleSkip();
        }
      }
      if (e.key === 'Escape') {
        if (status === 'connected' || status === 'searching') {
          handleStop();
        } else {
          handleBack();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [status, handleStart, handleSkip, handleStop, handleBack]);

  // AI icebreaker when first connected
  useEffect(() => {
    if (!isConnected || !peer) return;
    if (messages.length > 0) return;
    const pool = AI_ICEBREAKERS[interest] || AI_ICEBREAKERS.general;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!pick) return;
    setMessages((prev) => (prev.length ? prev : [{
      id: 'ai-icebreaker',
      nickname: 'Mana Mingle AI',
      fromSelf: false,
      text: pick,
      ts: Date.now(),
    }]));
  }, [isConnected, peer, interest, messages.length]);

  // Auto hide toast after a few seconds
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

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
      const stream = e.streams?.[0] || (e.track ? new MediaStream([e.track]) : null);
      if (!stream) return;
      setPeer((prev) => ({ ...(prev || {}), socketId: remoteId, stream, nickname: info.nickname || prev?.nickname, country: info.country || prev?.country }));
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
      if (data.roomId === roomIdRef.current) setMessages((m) => [...m.slice(-100), data]);
    };

    const onUserLeft = () => {
      setPeer((p) => (p ? { ...p, stream: null } : null));
      setStatus('disconnected');
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
  }, [messages, isTranslatorActive, apiBase]);

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

  const apiBase = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const generateAiSpark = async () => {
    if (isAiGenerating) return;
    setIsAiGenerating(true);
    try {
      const res = await fetch(`${apiBase}/api/ai/spark`, {
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
    <div className="h-screen flex flex-col bg-[#070811] text-white overflow-hidden">
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
        <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap justify-end min-w-0">
          {connected && (
            <>
              <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                <CoinBadge balance={balance} streak={streak} canClaim={canClaim} nextClaim={nextClaim ?? 0} claimCoins={claimCoins} compact />
              </div>
              <div
                className={`hidden sm:flex px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-tighter gap-1 items-center shrink-0 ${
                  connectionQuality === 'good'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : connectionQuality === 'ok'
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                <div className={`w-1 h-1 rounded-full ${connectionQuality === 'good' ? 'bg-emerald-400' : connectionQuality === 'ok' ? 'bg-amber-300' : 'bg-rose-300'} animate-pulse`} />
                {latency ?? '—'}ms
              </div>
              <div className="online-pill shrink-0 max-w-[100px] sm:max-w-none overflow-hidden text-ellipsis">
                <div className="live-dot shrink-0" style={{ width: 6, height: 6 }} />
                <span className="truncate text-[11px] sm:text-sm">{onlineCount?.toLocaleString()} online</span>
              </div>
              <button
                type="button"
                onClick={() => setIsTranslatorActive(!isTranslatorActive)}
                className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all border shrink-0 ${isTranslatorActive ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-white/5 border-white/10 text-white/30'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isTranslatorActive ? 'bg-indigo-400 animate-pulse' : 'bg-white/20'}`} />
                AI Translate
              </button>
            </>
          )}
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {adsEnabled && (
          <div className="w-full bg-white/5 border border-white/10 p-2 text-center text-white/30 text-[10px] font-mono uppercase tracking-widest hidden sm:flex items-center justify-center">
            [Advertisement Placeholder Banner]
          </div>
        )}
        <div className="flex-1 flex flex-col sm:flex-row min-h-0 overflow-hidden">
          {/* LEFT (desktop) / TOP (mobile): Video area - compact square panels */}
          <div className="flex flex-col gap-2 sm:gap-3 p-2 sm:p-4 min-h-0 min-w-0 sm:max-w-[360px] sm:flex-shrink-0">
            <div className="relative flex flex-col gap-2 sm:gap-3 min-h-0 sm:max-h-[320px]">
              {/* Remote video - big on mobile, compact square on desktop */}
              <div className="video-frame-torn w-full aspect-square max-h-[45vh] sm:max-h-[200px] sm:max-w-[320px] flex-shrink-0 relative mx-auto">
                <div className="video-frame-torn-inner relative bg-black w-full h-full">
                  {cameraError ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
                      <div className="peer-avatar text-3xl w-16 h-16 flex items-center justify-center rounded-full bg-rose-500/15 border border-rose-400/40">!</div>
                      <p className="text-xs sm:text-sm" style={{ color: 'rgba(232,234,246,0.75)' }}>{cameraError}</p>
                      <button
                        type="button"
                        className="btn btn-primary px-3 py-1.5 text-[11px]"
                        onClick={async () => {
                          try {
                            const s2 = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                            localStreamRef.current = s2;
                            setLocalStream(s2);
                            if (localVideoRef.current) localVideoRef.current.srcObject = s2;
                            setCameraError(null);
                          } catch (err) {
                            console.error('Retry camera error', err);
                            setCameraError('Still cannot access camera. Check browser and OS permissions.');
                          }
                        }}
                      >
                        Retry camera
                      </button>
                    </div>
                  ) : status === 'connected' && peer?.stream ? (
                    <>
                      <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        muted={mutedStranger}
                        className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                      />
                      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/80 to-transparent" />
                      <div className="absolute bottom-2 left-3 flex items-center gap-2">
                        <div className="live-dot" style={{ width: 6, height: 6 }} />
                        <span className="text-xs sm:text-sm font-medium text-white/95">{countryToFlag(peer?.country)} Stranger</span>
                      </div>
                      <div className="absolute top-2 right-2 flex gap-1.5">
                        <button type="button" onClick={() => setMutedStranger((m) => !m)} className={`report-btn ${mutedStranger ? 'bg-amber-500/30' : ''}`} title={mutedStranger ? 'Unmute' : 'Mute stranger'}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{mutedStranger ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />}</svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (socket) socket.emit('block-user', { targetSocketId: peer?.socketId });
                            handleSkip();
                            setToast('User blocked. You will be connected to someone new.');
                          }}
                          className="report-btn"
                          title="Block"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (socket) socket.emit('report-user', { reason: 'Inappropriate (Video)' });
                            handleSkip();
                            setToast('Thank you for reporting. We will review this user.');
                          }}
                          className="report-btn"
                          title="Report & Skip"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
                        </button>
                      </div>
                    </>
                  ) : status === 'connected' && !peer?.stream ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <div className="peer-avatar text-2xl w-14 h-14 flex items-center justify-center">👤</div>
                      <p className="text-xs sm:text-sm" style={{ color: 'rgba(232,234,246,0.5)' }}>Connecting...</p>
                      <div className="search-dots"><span /><span /><span /></div>
                    </div>
                  ) : status === 'idle' ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <div className="peer-avatar text-3xl w-16 h-16 flex items-center justify-center rounded-full bg-indigo-500/20 border border-indigo-400/40">📹</div>
                      <p className="text-xs" style={{ color: 'rgba(232,234,246,0.6)' }}>Press Start to begin</p>
                    </div>
                  ) : status === 'searching' ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <div className="relative w-16 h-16">
                        <div className="radar-ring absolute inset-0" />
                        <div className="absolute inset-3 rounded-full bg-indigo-500/20 flex items-center justify-center text-xl">📡</div>
                      </div>
                      <p className="text-xs" style={{ color: 'rgba(232,234,246,0.6)' }}>Finding stranger...</p>
                    </div>
                  ) : status === 'disconnected' ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                      <span className="text-4xl opacity-50">👋</span>
                      <p className="text-xs" style={{ color: 'rgba(232,234,246,0.5)' }}>Stranger left. Press Start to find a new one.</p>
                    </div>
                  ) : null}
                  {status === 'connected' && peer?.stream && (
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={remoteVolume}
                      onChange={(e) => setRemoteVolume(Number(e.target.value))}
                      className="hidden sm:block absolute bottom-3 right-24 w-24 h-1 opacity-60 hover:opacity-100 transition"
                    />
                  )}
                  <div className="absolute bottom-2 right-2 text-[10px] font-medium text-white/25 pointer-events-none">Mana Mingle</div>
                </div>
              </div>
              {/* Local video: mobile=PIP bottom-left (draggable), desktop=separate square panel below matching remote */}
              <div
                className="local-video-pip absolute bottom-2 left-2 z-10 w-20 h-20 rounded-lg overflow-hidden border-2 border-white/20 shadow-lg bg-black sm:static sm:bottom-auto sm:left-auto sm:w-full sm:h-auto sm:rounded-none sm:border-0 sm:shadow-none video-frame-torn sm:aspect-square sm:max-h-[200px] sm:max-w-[320px] flex-shrink-0 touch-none mx-auto sm:mx-auto"
                style={{ transform: `translate(${pipOffset.x}px, ${pipOffset.y}px)` }}
                ref={pipDragRef}
                onPointerDown={(e) => {
                  if (window.innerWidth >= 640) return; // only draggable on mobile
                  const startX = e.clientX;
                  const startY = e.clientY;
                  const startOffset = { ...pipOffset };
                  const container = pipDragRef.current?.parentElement;
                  const handleMove = (ev) => {
                    if (!container) return;
                    const dx = ev.clientX - startX;
                    const dy = ev.clientY - startY;
                    const nextX = startOffset.x + dx;
                    const nextY = startOffset.y + dy;
                    const bounds = container.getBoundingClientRect();
                    const box = pipDragRef.current.getBoundingClientRect();
                    // clamp so PIP stays inside container
                    const maxX = bounds.width - box.width;
                    const maxY = bounds.height - box.height;
                    const clampedX = Math.min(Math.max(nextX, -box.left + bounds.left), maxX - (box.left - bounds.left));
                    const clampedY = Math.min(Math.max(nextY, -box.top + bounds.top), maxY - (box.top - bounds.top));
                    setPipOffset({ x: clampedX, y: clampedY });
                  };
                  const handleUp = () => {
                    window.removeEventListener('pointermove', handleMove);
                    window.removeEventListener('pointerup', handleUp);
                    // snap to closest corner
                    const cont = pipDragRef.current?.parentElement;
                    const box = pipDragRef.current?.getBoundingClientRect();
                    if (!cont || !box) return;
                    const cRect = cont.getBoundingClientRect();
                    const midX = box.left + box.width / 2;
                    const midY = box.top + box.height / 2;
                    const left = cRect.left;
                    const right = cRect.right;
                    const top = cRect.top;
                    const bottom = cRect.bottom;
                    const targetX = midX < (left + right) / 2 ? left + 8 : right - box.width - 8;
                    const targetY = midY < (top + bottom) / 2 ? top + 8 : bottom - box.height - 8;
                    setPipOffset({
                      x: targetX - (box.left),
                      y: targetY - (box.top),
                    });
                  };
                  window.addEventListener('pointermove', handleMove);
                  window.addEventListener('pointerup', handleUp);
                }}
              >
                <div className="video-frame-torn-inner relative w-full h-full min-h-[80px] sm:min-h-0">
                  <video ref={localVideoRef} autoPlay muted playsInline className={`absolute inset-0 w-full h-full object-cover scale-x-[-1] ${cameraOff ? 'opacity-30' : ''}`} />
                  {cameraOff && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2zM3 3l18 18" /></svg>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 text-[8px] sm:text-[10px] font-semibold text-white/90 sm:text-white/80 bg-black/50 sm:bg-transparent text-center py-0.5 sm:text-left sm:bottom-1 sm:left-2 sm:right-auto">You</div>
                  <div className="hidden sm:block absolute bottom-2 right-2 text-[10px] font-medium text-white/25 pointer-events-none">Mana Mingle</div>
                </div>
              </div>
            </div>

            {/* Control bar under videos */}
            <div className="control-bar flex-shrink-0 rounded-xl border border-indigo-500/10 bg-[#0a0b14]/90 flex items-center justify-center gap-2 sm:gap-3 flex-nowrap px-2 py-2">
              {(status === 'idle' || status === 'disconnected') && (
                <button
                  id="video-start-btn"
                  type="button"
                  disabled={!connected}
                  onClick={handleStart}
                  className="btn btn-primary px-3 py-1.5 text-[11px]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
                  Start
                </button>
              )}
              {(status === 'searching' || status === 'connected') && (
                <>
                  <button
                    id="video-skip-btn"
                    type="button"
                    disabled={!connected}
                    onClick={handleSkip}
                    className="btn btn-amber px-3 py-1.5 text-[11px]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={toggleMute}
                    className={`btn btn-icon px-2 py-1 ${muted ? 'danger-active' : ''}`}
                    title={muted ? 'Unmute' : 'Mute'}
                  >
                    {muted ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (autoBandwidth) {
                        setAutoBandwidth(false);
                        setLowBandwidth(false);
                      } else {
                        // cycle: High -> Low -> Auto
                        if (!lowBandwidth) setLowBandwidth(true);
                        else {
                          setLowBandwidth(false);
                          setAutoBandwidth(true);
                        }
                      }
                    }}
                    className={`btn btn-icon px-2 py-1 ${autoBandwidth ? 'bg-sky-500/20' : lowBandwidth ? 'bg-teal-500/20' : ''}`}
                    title={`Bandwidth: ${bandwidthLabel}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  </button>
                  <button
                    type="button"
                    onClick={toggleCamera}
                    className={`btn btn-icon px-2 py-1 ${cameraOff ? 'danger-active' : ''}`}
                    title={cameraOff ? 'Camera on' : 'Camera off'}
                  >
                    {cameraOff ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2zM3 3l18 18" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={startScreenShare}
                    className={`btn btn-icon px-2 py-1 ${isScreenSharing ? 'bg-indigo-500 text-white' : ''}`}
                    title="Screen Share"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </button>
                  <button
                    id="video-stop-btn"
                    type="button"
                    onClick={handleStop}
                    className="btn btn-danger px-3 py-1.5 text-[11px]"
                  >
                    Stop
                  </button>
                </>
              )}
            </div>
          </div>

          {/* RIGHT: Rules + Chat (single unified area with auto-scroll) */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-[#0d0f1c]/60 border-l border-indigo-500/10">
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
              {/* Rules + Messages in one scrollable area */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4" id="video-chat-messages">
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Welcome to Mana Mingle.</h2>
                <ul className="space-y-3 text-sm" style={{ color: 'rgba(232,234,246,0.85)' }}>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-[10px] font-black text-rose-400">18+</span>
                    <span>You must be 18+</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">✓</span>
                    <span>No nudity, hate speech, or harassment</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">✓</span>
                    <span>Your webcam must show you, live</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">✓</span>
                    <span>Do not ask for gender. This is not a dating site</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">!</span>
                    <span>Violators will be banned</span>
                  </li>
                </ul>
                {messages.length > 0 && (
                  <>
                    <div className="border-t border-white/10 pt-4 mt-4">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Chat</span>
                    </div>
                    {messages.map((m, i) => {
                      const isMe = m.nickname === 'Anonymous' || m.fromSelf;
                      return (
                        <div key={m.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <div className={`msg-bubble ${isMe ? 'me' : 'them'}`}>
                            {m.media ? (
                              <div className="max-w-[200px] rounded-lg overflow-hidden border border-white/10">
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
                          <span className="msg-time px-1 text-[10px]">{formatTime(m.ts)}</span>
                        </div>
                      );
                    })}
                  </>
                )}
                {messages.length === 0 && !isConnected && (
                  <div className="sys-msg">Chat will appear here once connected</div>
                )}
                {messages.length === 0 && isConnected && (
                  <div className="sys-msg">Start chatting!</div>
                )}
                <div ref={chatEndRef} />
              </div>

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

              {/* Start + Chat input - mobile responsive */}
              <div className="flex-shrink-0 p-3 sm:p-6 space-y-3">
                {status === 'idle' && (
                  <button
                    id="video-start-btn-alt"
                    type="button"
                    disabled={!connected}
                    onClick={handleStart}
                    className="btn btn-primary w-full px-4 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold rounded-2xl shadow-lg shadow-indigo-500/25"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
                    Start
                  </button>
                )}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 items-stretch sm:items-center">
                  {isConnected && (
                    <div className="flex gap-1 shrink-0 self-start sm:self-center order-last sm:order-first">
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-emerald-400" title="Media">📂</button>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleMediaUpload} />
                      <div className="relative">
                        <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-amber-400" title="3D Emoji">✨</button>
                        {showEmojiPicker && (
                          <div className="absolute bottom-full right-0 mb-2 p-3 bg-[#151829] border border-indigo-500/20 rounded-xl shadow-xl w-[160px] grid grid-cols-4 gap-1.5 z-[50]">
                            {EMOJIS_3D.map(e => (
                              <button key={e.char} onClick={() => send3dEmoji(e)} className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-indigo-500/20 rounded-lg text-lg">{e.char}</button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={generateAiSpark} disabled={isAiGenerating} className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-indigo-400" title="AI Spark">
                        <svg className={`w-4 h-4 ${isAiGenerating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2 min-w-0 flex-1">
                    <input
                      id="video-chat-input"
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendMsg()}
                      placeholder={isAiGenerating ? 'AI thinking...' : (isConnected ? 'Message...' : 'Connect first')}
                      disabled={!isConnected || isAiGenerating}
                      className="chat-input flex-1 min-w-0 py-2.5 sm:py-3 px-3 sm:px-4 text-sm rounded-xl border border-indigo-500/20 bg-white/5 focus:border-indigo-500/40 focus:ring-2 focus:ring-indigo-500/20 w-full"
                    />
                    <button id="video-chat-send-btn" type="button" onClick={sendMsg} disabled={!isConnected || !input.trim()} className="btn btn-primary w-10 h-10 sm:w-12 sm:h-12 p-0 rounded-xl flex-shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-white/30 text-center">Esc to go back</p>
              </div>
            </div>
          </div>
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
