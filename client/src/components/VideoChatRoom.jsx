import { useEffect, useRef, useState } from 'react';
import { countryToFlag } from '../utils/countryFlag';
import { useIceServers } from '../hooks/useIceServers';

export function VideoChatRoom({ roomId: roomIdProp, interest, nickname, myCountry, socket, isQueuing, onLeave, onFindNewPartner, onJoined }) {
  const { iceServers } = useIceServers();
  const roomIdRef = useRef(null);
  const roomId = roomIdProp ?? roomIdRef.current;
  const [peers, setPeers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(new Map());
  const pendingCandidatesRef = useRef(new Map());
  const peerInfoRef = useRef(new Map());
  const hasJoinedRef = useRef(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    let stream = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch (err) {
        console.error('getUserMedia error:', err);
      }
    })();
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = muted;
    });
    setMuted(!muted);
  };

  const toggleCamera = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = cameraOff;
    });
    setCameraOff(!cameraOff);
  };

  const createPeerConnection = (remoteSocketId) => {
    if (peerConnectionsRef.current.get(remoteSocketId)) return peerConnectionsRef.current.get(remoteSocketId);
    const pc = new RTCPeerConnection({ iceServers });
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
    }
    pc.onicecandidate = (e) => {
      const rid = roomIdRef.current || roomId;
      if (e.candidate && socket && rid) {
        socket.emit('webrtc-signal', {
          roomId: rid,
          targetSocketId: remoteSocketId,
          type: 'ice-candidate',
          signal: e.candidate,
        });
      }
    };
    pc.ontrack = (e) => {
      const info = peerInfoRef.current.get(remoteSocketId) || {};
      setPeers((prev) => {
        const next = prev.filter((p) => p.socketId !== remoteSocketId);
        next.push({ socketId: remoteSocketId, stream: e.streams[0], nickname: info.nickname, country: info.country });
        return next;
      });
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        setTimeout(() => {
          if (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'connecting') {
            setPeers((p) => p.filter((x) => x.socketId !== remoteSocketId));
            peerConnectionsRef.current.delete(remoteSocketId);
          }
        }, 3000);
      }
    };
    peerConnectionsRef.current.set(remoteSocketId, pc);
    return pc;
  };

  const doOffer = async (remoteSocketId) => {
    const rid = roomIdRef.current || roomId;
    if (!rid) return;
    const pc = createPeerConnection(remoteSocketId);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('webrtc-signal', {
        roomId: rid,
        targetSocketId: remoteSocketId,
        type: 'offer',
        signal: offer,
      });
    } catch (err) {
      console.error('createOffer error:', err);
    }
  };

  const doAnswer = async (remoteSocketId, offer) => {
    const rid = roomIdRef.current || roomId;
    if (!rid) return;
    const pc = createPeerConnection(remoteSocketId);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-signal', {
        roomId: rid,
        targetSocketId: remoteSocketId,
        type: 'answer',
        signal: answer,
      });
    } catch (err) {
      console.error('createAnswer error:', err);
    }
  };

  const addIceCandidate = async (remoteSocketId, candidate) => {
    let pc = peerConnectionsRef.current.get(remoteSocketId);
    if (!pc) {
      const pending = pendingCandidatesRef.current.get(remoteSocketId) || [];
      pending.push(candidate);
      pendingCandidatesRef.current.set(remoteSocketId, pending);
      return;
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      const pending = pendingCandidatesRef.current.get(remoteSocketId);
      if (pending?.length) {
        pendingCandidatesRef.current.set(remoteSocketId, []);
        for (const c of pending) await pc.addIceCandidate(new RTCIceCandidate(c));
      }
    } catch (err) {
      console.error('addIceCandidate error:', err);
    }
  };

  const sendMessage = () => {
    const t = chatInput.trim();
    const rid = roomIdRef.current || roomId;
    if (!t || !socket || !rid) return;
    socket.emit('send-message', { roomId: rid, text: t });
    setChatInput('');
  };

  useEffect(() => {
    if (!socket) return;

    const onPartnerFound = (data) => {
      const rid = data.roomId || roomIdRef.current;
      if (rid) roomIdRef.current = rid;
      if (!hasJoinedRef.current) {
        hasJoinedRef.current = true;
        onJoined(rid);
      }
      const peer = data.peer;
      if (peer?.socketId) {
        peerInfoRef.current.set(peer.socketId, { nickname: peer.nickname, country: peer.country });
        if (socket.id < peer.socketId) {
          doOffer(peer.socketId);
        }
      }
    };

    const onChatHistory = (data) => {
      const rid = roomIdRef.current || roomId;
      if (data.roomId === rid && data.messages) setMessages(data.messages);
    };

    const onChatMessage = (data) => {
      const rid = roomIdRef.current || roomId;
      if (data.roomId === rid) setMessages((m) => [...m.slice(-80), data]);
    };

    const onUserLeft = (data) => {
      const sid = data.userId ?? data.socketId;
      if (sid) {
        const pc = peerConnectionsRef.current.get(sid);
        if (pc) {
          pc.close();
          peerConnectionsRef.current.delete(sid);
        }
        setPeers((p) => p.filter((x) => x.socketId !== sid));
      }
    };

    const onSignal = (data) => {
      const fromId = data.fromSocketId;
      if (!fromId || fromId === socket.id) return;
      if (data.fromNickname || data.fromCountry) {
        peerInfoRef.current.set(fromId, {
          nickname: data.fromNickname || peerInfoRef.current.get(fromId)?.nickname,
          country: data.fromCountry || peerInfoRef.current.get(fromId)?.country,
        });
      }
      const { type, signal } = data;
      if (type === 'offer') {
        doAnswer(fromId, signal);
      } else if (type === 'answer') {
        const pc = peerConnectionsRef.current.get(fromId);
        if (pc) pc.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (type === 'ice-candidate' && signal) {
        addIceCandidate(fromId, signal);
      }
    };

    socket.on('partner-found', onPartnerFound);
    socket.on('chat-history', onChatHistory);
    socket.on('chat-message', onChatMessage);
    socket.on('user-left', onUserLeft);
    socket.on('webrtc-signal', onSignal);

    return () => {
      socket.off('partner-found', onPartnerFound);
      socket.off('chat-history', onChatHistory);
      socket.off('chat-message', onChatMessage);
      socket.off('user-left', onUserLeft);
      socket.off('webrtc-signal', onSignal);
    };
  }, [socket, onJoined]);

  useEffect(() => {
    return () => {
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const count = 1 + peers.length;
  // Use Tailwind grid. On mobile, stack them vertically (grid-rows-2), on sm+ layout horizontally (grid-cols-2)
  const gridClass = count <= 1
    ? 'grid grid-cols-1 grid-rows-1'
    : 'grid grid-cols-1 grid-rows-2 sm:grid-cols-2 sm:grid-rows-1 gap-2 sm:gap-4';

  return (
    <div className="flex flex-col h-screen bg-realm-void">
      <header className="flex items-center justify-between px-4 py-3 border-b border-realm-border bg-realm-surface/90 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="text-sm text-realm-muted">
            <span className="text-realm-teal font-medium capitalize">{interest || 'general'}</span>
            <span className="mx-1.5">·</span>
            1:1 Video
          </span>
          {onFindNewPartner && !isQueuing && (
            <button
              type="button"
              onClick={onFindNewPartner}
              className="text-sm px-3 py-1.5 rounded-lg bg-realm-amber/15 text-realm-gold border border-realm-gold/40 hover:bg-realm-gold/25 transition font-medium"
            >
              Skip →
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isQueuing && (
            <button
              type="button"
              onClick={() => setShowChat(!showChat)}
              className={`p-2 rounded-xl transition ${showChat ? 'bg-realm-teal/20 text-realm-mint' : 'text-realm-muted hover:text-white hover:bg-realm-card'}`}
              title="Chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => { if (isQueuing) socket?.emit('cancel-find-partner'); onLeave(); }}
            className="px-4 py-2 rounded-xl bg-realm-coral/15 text-realm-coral hover:bg-realm-coral/25 transition font-medium text-sm"
          >
            {isQueuing ? 'Cancel' : 'Leave'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <div className={`relative flex-1 flex flex-col p-2 sm:p-4 ${showChat && !isQueuing ? 'sm:max-w-[calc(100%-280px)] w-full' : 'w-full'} min-h-0 transition-all`}>
          <div className={`flex-1 ${gridClass} min-h-0 w-full`}>
            <div className="relative min-w-0 min-h-0 rounded-2xl overflow-hidden border-2 bg-[#0c0e1a] border-indigo-500/30">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`absolute inset-0 w-full h-full object-cover mirror ${cameraOff ? 'opacity-30' : ''}`}
              />
              {cameraOff && !isQueuing && (
                <div className="absolute inset-0 flex items-center justify-center bg-indigo-500/10 backdrop-blur-sm">
                  <span className="text-white/60 text-sm font-bold tracking-wider uppercase">Camera off</span>
                </div>
              )}
              <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1.5 rounded-full bg-black/50 border border-white/10 backdrop-blur-md z-10">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
                  {countryToFlag(myCountry) ? `${countryToFlag(myCountry)} ` : ''}You
                </span>
              </div>
            </div>
            {isQueuing ? (
              <div className="relative min-w-0 min-h-0 rounded-2xl overflow-hidden border-2 bg-indigo-500/5 border-indigo-500/20 flex flex-col items-center justify-center">
                <p className="text-realm-muted text-sm mb-2">Searching for partner</p>
                <div className="flex gap-2">
                  <span className="w-2 h-2 rounded-full bg-realm-teal animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-realm-teal animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-realm-teal animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            ) : (
              peers.map((p) => (
                <RemoteVideo key={p.socketId} stream={p.stream} nickname={p.nickname} country={p.country} socketId={p.socketId} />
              ))
            )}
          </div>

          <div className="flex items-center justify-center gap-3 py-3 px-4 bg-realm-surface/60 border-t border-realm-border">
            {onFindNewPartner && !isQueuing && (
              <button
                type="button"
                onClick={onFindNewPartner}
                className="px-5 py-3 rounded-xl bg-realm-amber/20 text-realm-gold border border-realm-gold/50 hover:bg-realm-gold/30 transition font-medium"
              >
                Skip
              </button>
            )}
            <button
              type="button"
              onClick={toggleMute}
              className={`p-3 rounded-xl transition ${muted ? 'bg-realm-coral/20 text-realm-coral' : 'bg-realm-card text-realm-muted hover:text-white hover:bg-realm-border'}`}
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
              )}
            </button>
            <button
              type="button"
              onClick={toggleCamera}
              className={`p-3 rounded-xl transition ${cameraOff ? 'bg-realm-coral/20 text-realm-coral' : 'bg-realm-card text-realm-muted hover:text-white hover:bg-realm-border'}`}
              title={cameraOff ? 'Turn on camera' : 'Turn off camera'}
            >
              {cameraOff ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowChat(!showChat)}
              className={`p-3 rounded-xl transition ${showChat ? 'bg-realm-teal/20 text-realm-teal' : 'bg-realm-card text-realm-muted hover:text-white hover:bg-realm-border'}`}
              title="Toggle chat panel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </button>
          </div>
        </div>

        {showChat && !isQueuing && (
          <div className="absolute inset-y-0 right-0 z-[100] w-[85%] sm:static sm:w-[280px] flex flex-col border-l border-realm-border bg-realm-surface/95 backdrop-blur-xl sm:bg-realm-surface shadow-2xl sm:shadow-none animate-slide-in-right">
            <div className="p-2 border-b border-realm-border flex justify-between items-center">
              <span className="text-sm font-medium text-realm-muted">Chat</span>
              <button onClick={() => setShowChat(false)} className="text-realm-muted hover:text-white p-1">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              {messages.map((m) => (
                <div key={m.id} className="text-sm"><span className="text-realm-teal font-medium">{m.nickname}:</span> <span className="text-white/90">{m.text}</span></div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="p-2 border-t border-realm-border flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Say something..."
                className="flex-1 px-3 py-2 rounded-lg bg-realm-card border border-realm-border text-white placeholder-realm-muted text-sm focus:border-realm-teal focus:outline-none"
              />
              <button type="button" onClick={sendMessage} className="px-3 py-2 rounded-lg bg-realm-teal text-realm-void font-medium text-sm hover:bg-realm-mint transition">Send</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RemoteVideo({ stream, nickname, country, socketId }) {
  const ref = useRef(null);
  const flag = countryToFlag(country);
  useEffect(() => {
    if (!ref.current || !stream) return;
    ref.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="relative min-w-0 min-h-0 rounded-2xl overflow-hidden border-2 bg-[#0c0e1a] border-indigo-500/30">
      <video ref={ref} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-1.5 rounded-full bg-black/50 border border-white/10 backdrop-blur-md z-10">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
        <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
          {flag && <span className="mr-1">{flag}</span>}
          {nickname || 'Stranger'}
        </span>
      </div>
    </div>
  );
}
