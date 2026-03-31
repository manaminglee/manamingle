/**
 * GroupTextRoom – Up to 4 anonymous strangers in a text group
 * Premium redesign: participants sidebar, message bubbles, icebreakers
 */
import { useEffect, useRef, useState } from 'react';
import { countryToFlag } from '../utils/countryFlag';
import { CoinBadge } from './CoinBadge';

const GROUP_MAX = 4;
const ICEBREAKERS = [
  "What's one thing that made you smile today? 😊",
  "If you could visit anywhere right now, where would you go? ✈️",
  "What's a hobby you wish you had time for? 🎯",
  "Share a random fact you find fascinating! 🧠",
  "What's the last thing you watched and would recommend? 📺",
  "If you could have any superpower, what would it be? ⚡",
  "What's your go-to comfort food? 🍜",
];

const COLORS = ['#a5b4fc', '#34d399', '#fb923c', '#f472b6'];

const BlueTick = () => (
  <span className="inline-flex items-center justify-center w-3 h-3 bg-cyan-500 rounded-full ml-1.5 shadow-[0_0_10px_#06b6d4]">
    <svg className="w-2 h-2 text-black" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  </span>
);

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

export function GroupTextRoom({ roomId: roomIdProp, interest: interestProp, nickname, isCreator = false, myCountry, socket, isQueuing, onLeave, onFindNewPod, onJoined, coinState }) {
  const { balance, streak, canClaim, nextClaim, claimCoins } = coinState;
  const roomIdRef = useRef(null);
  const roomId = roomIdProp ?? roomIdRef.current;
  const [displayInterest, setDisplayInterest] = useState(interestProp || 'general');
  const [peers, setPeers] = useState([]);
  const [participantCount, setParticipantCount] = useState(1);
  const [messages, setMessages] = useState([]);
  const [sparks, setSparks] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isTranslatorActive, setIsTranslatorActive] = useState(false);
  const [icebreaker] = useState(() => ICEBREAKERS[Math.floor(Math.random() * ICEBREAKERS.length)]);
  const hasJoinedRef = useRef(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [active3dEmoji, setActive3dEmoji] = useState(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!isQueuing) setTimeout(() => inputRef.current?.focus(), 200);
  }, [isQueuing]);

  useEffect(() => {
    if (socket && roomIdProp && !hasJoinedRef.current) {
      socket.emit('join-specific-group', { roomId: roomIdProp, nickname: nickname || 'Admin' });
    }
  }, [socket, roomIdProp]);

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

  const generateAiSpark = async () => {
    if (isAiGenerating) return;
    setIsAiGenerating(true);
    try {
      const apiBase = import.meta.env.VITE_SOCKET_URL || '';
      const res = await fetch(`${apiBase}/api/ai/spark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interest: displayInterest })
      });
      if (res.ok) {
        const data = await res.json();
        setChatInput(data.spark);
      }
    } catch (e) { } finally {
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
      setPeers(data.peers || []);
      setParticipantCount((data.peers?.length || 0) + 1);
    };

    const onHistory = (data) => {
      if (data.roomId === (roomIdRef.current || roomId)) setMessages(data.messages || []);
    };

    const onMsg = (data) => {
      if (data.roomId === (roomIdRef.current || roomId)) {
        setMessages((m) => [...m.slice(-100), data]);
        // Trigger spark
        const el = document.getElementById('group-text-messages');
        if (el) {
          const rect = el.getBoundingClientRect();
          setSparks(prev => [...prev.slice(-20), { id: Date.now(), x: rect.left + rect.width / 2, y: rect.bottom - 100 }]);
        }
      }
    };

    const onUserJoined = (data) => {
      setParticipantCount(data.participantCount ?? 2);
      setPeers((prev) => {
        const filtered = prev.filter((p) => p.socketId !== data.socketId);
        return [...filtered, { socketId: data.socketId, userId: data.userId, nickname: data.nickname, country: data.country }];
      });
      // System join message
      setMessages((m) => [...m, { id: `sys-${Date.now()}`, system: true, text: `${data.nickname || 'A stranger'} joined the room 👋` }]);
    };

    const onUserLeft = (data) => {
      setParticipantCount((c) => {
        const next = Math.max(1, (data.participantCount ?? c) - 1);
        if (next === 1 && !isQueuing) {
          // AUTO-SEEK Logic: If I'm alone, find a new pod
          setTimeout(() => {
            if (roomIdRef.current) onFindNewPod?.();
          }, 3000);
        }
        return next;
      });
      const sid = data.userId ?? data.socketId;
      setPeers((p) => {
        const leaving = p.find((x) => x.socketId === sid);
        if (leaving) {
          setMessages((m) => [...m, { id: `sys-${Date.now()}-left`, system: true, text: `${leaving.nickname || 'A stranger'} left the room` }]);
        }
        return p.filter((x) => x.socketId !== sid);
      });
    };

    const onSystemMsg = (data) => setMessages((m) => [...m, { id: Date.now(), system: true, text: `📢 ADMIN: ${data.message}`, ts: Date.now() }]);

    socket.on('group-joined', onGroupJoined);
    socket.on('existing-peers', onExistingPeers);
    socket.on('chat-history', onHistory);
    socket.on('chat-message', onMsg);
    socket.on('user-joined', onUserJoined);
    socket.on('user-left', onUserLeft);
    socket.on('system-announcement', onSystemMsg);

    // Auto-join group on mount if we're queuing
    if (socket && isQueuing && !hasJoinedRef.current) {
      socket.emit('join-group-by-interest', { interest: displayInterest || interestProp || 'general', nickname: 'Anonymous', mode: 'group_text' });
    }

    return () => {
      socket.off('group-joined', onGroupJoined);
      socket.off('existing-peers', onExistingPeers);
      socket.off('chat-history', onHistory);
      socket.off('chat-message', onMsg);
      socket.off('user-joined', onUserJoined);
      socket.off('user-left', onUserLeft);
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
    if (socket && roomId) {
      socket.emit('send-3d-emoji', { roomId, emoji });
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

  // AI Translation Hook
  useEffect(() => {
    if (!isTranslatorActive) return;
    const untranslated = messages.filter(m => !m.fromSelf && !m.translated && !m.system && m.text && m.text.length > 3);
    if (untranslated.length === 0) return;
    const target = untranslated[untranslated.length - 1];
    const translateMsg = async () => {
      try {
        const apiBase = import.meta.env.VITE_SOCKET_URL || '';
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

  const allParticipants = [
    { socketId: 'me', nickname: nickname || 'You', country: myCountry, isMe: true },
    ...peers,
  ];

  const getNickColor = (idx) => COLORS[idx % COLORS.length];

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.key === 'Escape') {
        onLeave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onLeave]);

  return (
    <div className="h-screen flex flex-col bg-[#070811] text-white overflow-hidden relative">
      {sparks.map(s => <MessageSpark key={s.id} x={s.x} y={s.y} />)}
      {/* AI SAFETY LAYER */}
      <div className="absolute top-[72px] left-1/2 -translate-x-1/2 z-[100] pointer-events-none px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center gap-2 animate-pulse">
         <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
         <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">AI Safety Monitor Active</span>
      </div>

      {/* HEADER */}
      <header className="app-header flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="logo-icon text-sm">M</div>
          <div>
            <h1 className="font-bold text-white leading-none">Mana Mingle</h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(232,234,246,0.45)' }}>
              Group Chat · #{displayInterest}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CoinBadge balance={balance} streak={streak} canClaim={canClaim} nextClaim={nextClaim ?? 0} claimCoins={claimCoins} />

          <div className="participant-badge">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {participantCount}/{GROUP_MAX}
          </div>
          {!isQueuing && (
            <button
              type="button"
              onClick={() => setIsTranslatorActive(!isTranslatorActive)}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider transition-all border ${isTranslatorActive ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-white/5 border-white/10 text-white/30'}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isTranslatorActive ? 'bg-indigo-400 animate-pulse' : 'bg-white/20'}`} />
              AI Translate
            </button>
          )}
          {onFindNewPod && !isQueuing && (
            <button id="group-text-skip-btn" type="button" onClick={onFindNewPod} className="btn btn-amber px-4 py-2">
              Skip Room →
            </button>
          )}
          <button id="group-text-leave-btn" type="button" onClick={onLeave} className="btn btn-danger px-4 py-2">
            {isQueuing ? 'Cancel' : 'Leave'}
          </button>
        </div>
      </header>

      {/* ICEBREAKER BANNER */}
      {
        !isQueuing && icebreaker && (
          <div className="flex-shrink-0 px-4 py-2.5 bg-indigo-500/[0.07] border-b border-indigo-500/15 flex items-center gap-3">
            <span className="text-indigo-400 text-sm font-semibold flex-shrink-0">🧊 Icebreaker:</span>
            <span className="text-sm text-white/75 truncate">{icebreaker}</span>
            <button
              id="send-icebreaker-btn"
              type="button"
              onClick={() => {
                const rid = roomIdRef.current || roomId;
                if (socket && rid) socket.emit('send-message', { roomId: rid, text: icebreaker });
              }}
              className="text-xs px-3 py-1 rounded-lg bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 transition flex-shrink-0"
            >
              Send
            </button>
          </div>
        )
      }

      {/* BODY */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* CHAT MAIN */}
        <div className="flex-1 flex flex-col min-h-0 relative">

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

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0" id="group-text-messages">
            {isQueuing ? (
              <div className="h-full flex flex-col items-center justify-center gap-6 text-center">
                <div className="relative w-20 h-20">
                  <div className="radar-ring absolute inset-0" />
                  <div className="radar-ring absolute inset-3" style={{ animationDelay: '0.6s' }} />
                  <div className="absolute inset-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-xl">👥</div>
                </div>
                <div>
                  <p className="font-bold text-white mb-1">Finding a group room...</p>
                  <p className="text-sm" style={{ color: 'rgba(232,234,246,0.45)' }}>You'll be matched based on interest: #{displayInterest}</p>
                </div>
                <div className="search-dots"><span /><span /><span /></div>
              </div>
            ) : (
              <>
                {messages.length === 0 && (
                  <div className="sys-msg pt-4">Welcome to the room! Say hello 👋</div>
                )}
                {messages.map((m, i) => {
                  if (m.system) return <div key={m.id || i} className="sys-msg">{m.text}</div>;
                  const isMe = m.socketId === socket.id || m.fromSelf;
                  const peerIdx = allParticipants.findIndex((p) => p.socketId === m.socketId);
                  const color = peerIdx >= 0 ? getNickColor(peerIdx) : COLORS[0];
                  const showNick = i === 0 || messages[i - 1]?.socketId !== m.socketId || messages[i - 1]?.system;
                  return (
                    <div key={m.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-message-pop`}>
                      {showNick && (
                        <div className="flex items-center gap-1 mb-1 px-1">
                          <span className="text-[9px] font-black uppercase tracking-widest leading-none" style={{ color: isMe ? '#22d3ee' : color }}>
                            {m.isCreator ? `@${m.nickname}` : (isMe ? 'You' : m.nickname || 'Stranger')}
                          </span>
                          {m.isCreator && <BlueTick />}
                        </div>
                      )}
                      <div className={`msg-bubble ${isMe ? 'me' : 'them'} flex flex-col gap-1 animate-bubble-pop relative group`} style={!isMe ? { borderColor: `${color}30` } : {}}>
                        {!m.system && (
                          <button 
                            onClick={() => setReplyingTo(m)} 
                            className={`absolute -top-3 ${isMe ? '-left-3' : '-right-3'} opacity-0 group-hover:opacity-100 bg-white/10 hover:bg-white/20 p-1 rounded-full text-xs transition-opacity z-10`}
                            title="Reply"
                          >
                            ↩️
                          </button>
                        )}
                        {m.replyTo && (
                          <div className="text-[10px] opacity-60 mb-1 border-l-2 border-white/20 pl-2 italic">
                            <span className="font-bold">{m.replyTo.nickname || 'Someone'}</span>: {m.replyTo.text?.slice(0, 40)}{m.replyTo.text?.length > 40 ? '...' : ''}
                          </div>
                        )}
                        {m.media ? (
                          <div className="max-w-[200px] rounded-lg overflow-hidden border border-white/10">
                            {m.type === 'video' ? (
                              <video src={m.content} controls className="w-full" autoPlay loop muted />
                            ) : (
                              <img src={m.content} className="w-full h-auto" alt="media" />
                            )}
                          </div>
                        ) : (
                          <div className="break-words">
                            {isTranslatorActive && !isMe ? (
                              <div className="flex flex-col gap-1">
                                {m.translated ? (
                                  <>
                                    <span className="text-[10px] opacity-40 uppercase font-bold tracking-widest leading-none mb-1">NVIDIA AI Translation</span>
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
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </>
            )}
          </div>

          {replyingTo && (
              <div className="mx-3 mt-2 mb-[-6px] bg-black/60 backdrop-blur-md border border-white/10 rounded-xl px-4 py-2 flex justify-between items-center z-[100] animate-in-zoom relative">
                <div className="flex items-center gap-2 overflow-hidden">
                   <span className="text-xs">↩️</span>
                   <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Replying to {replyingTo.nickname || 'Stranger'}:</span>
                   <span className="text-xs text-white/80 truncate opacity-60 italic">"{replyingTo.text?.slice(0, 40)}{replyingTo.text?.length > 40 ? '...' : ''}"</span>
                </div>
                <button onClick={() => setReplyingTo(null)} className="text-white/40 hover:text-white p-1 ml-2">✕</button>
              </div>
           )}

          {/* Input */}
          <div className="flex-shrink-0 p-3 border-t border-white/[0.06] flex gap-1.5 sm:gap-2 min-w-0 items-center">
            <input
              ref={inputRef}
              id="group-text-input"
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={isAiGenerating ? 'AI thinking...' : (isQueuing ? 'Finding room...' : 'Type a message...')}
              disabled={isQueuing || !roomId || isAiGenerating}
              className={`chat-input flex-1 min-w-0 py-3 px-4 transition-all ${isAiGenerating ? 'opacity-50' : ''}`}
            />
            {!isQueuing && (
              <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-lg bg-white/5 border border-white/5 text-white/30 hover:text-emerald-400 transition-colors"
                  title="Upload Media (10-15 Coins)"
                >
                  📂
                </button>
                <input type="file" ref={fileInputRef} onChange={handleMediaUpload} accept="image/*,video/*" className="hidden" />
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
                    <div className="absolute bottom-full right-0 mb-2 p-3 bg-[#151829] border border-white/10 rounded-2xl shadow-2xl w-[180px] grid grid-cols-4 gap-2 animate-slide-in-up z-[50]">
                      <div className="col-span-4 text-[10px] font-black uppercase tracking-widest text-white/30 mb-1 px-1">3D Emojis (5🪙)</div>
                      {EMOJIS_3D.map(e => (
                        <button
                          key={e.char}
                          onClick={() => send3dEmoji(e)}
                          className={`w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-lg text-lg transition-all ${coins < 5 ? 'opacity-30 cursor-not-allowed' : ''}`}
                          disabled={coins < 5}
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
                  className={`p-2 rounded-lg transition-all border shrink-0 ${isAiGenerating
                    ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
                    : 'bg-white/5 border-white/5 text-white/30 hover:text-indigo-400'
                    }`}
                  title="AI Spark"
                >
                  <svg className={`w-4 h-4 ${isAiGenerating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </button>
              </div>
            )}
            <button
              id="group-text-send-btn"
              type="button"
              onClick={sendMessage}
              disabled={isQueuing || !chatInput.trim() || !roomId}
              className="btn btn-primary w-12 h-12 p-0 rounded-xl flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>

        {/* PARTICIPANTS SIDEBAR */}
        <div className="participants-panel flex-shrink-0">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(232,234,246,0.4)' }}>
            Online ({participantCount})
          </p>
          <div className="space-y-3">
            {allParticipants.map((p, i) => (
              <div key={p.socketId} className="flex items-center gap-2.5">
                <div className="peer-avatar text-sm flex-shrink-0" style={{ background: p.isCreator ? 'rgba(6,182,212,0.1)' : `${getNickColor(i)}20`, borderColor: p.isCreator ? 'rgba(6,182,212,0.4)' : `${getNickColor(i)}40` }}>
                  {p.isCreator ? '⭐' : (p.isMe ? '🙋' : '👤')}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black flex items-center gap-1.5 truncate" style={{ color: p.isCreator ? '#22d3ee' : (p.isMe ? '#a5b4fc' : 'rgba(232,234,246,0.85)') }}>
                    {p.isMe && !p.isCreator ? 'You' : (p.nickname || 'Stranger')}
                    {p.isCreator && <BlueTick />}
                  </p>
                  <p className="text-[10px] uppercase font-bold tracking-widest" style={{ color: 'rgba(232,234,246,0.3)' }}>
                    {countryToFlag(p.country) || '🌍'} {p.isCreator ? 'Creator' : 'Anonymous'}
                  </p>
                </div>
                <div className="live-dot ml-auto flex-shrink-0" style={{ width: 6, height: 6 }} />
              </div>
            ))}
            {/* Empty slots */}
            {Array.from({ length: Math.max(0, GROUP_MAX - allParticipants.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-2.5 opacity-25">
                <div className="peer-avatar text-sm flex-shrink-0">⏳</div>
                <p className="text-sm" style={{ color: 'rgba(232,234,246,0.4)' }}>Waiting...</p>
              </div>
            ))}
          </div>
          <div className="mt-auto pt-4 border-t border-white/[0.06]">
            <p className="text-xs" style={{ color: 'rgba(232,234,246,0.3)' }}>🔒 Anonymous</p>
            <p className="text-xs mt-1" style={{ color: 'rgba(232,234,246,0.3)' }}>No data stored</p>
          </div>
        </div>
      </div>
    </div >
  );
}
