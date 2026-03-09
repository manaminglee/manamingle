/**
 * GroupTextRoom – Up to 4 anonymous strangers in a text group
 * Premium redesign: participants sidebar, message bubbles, icebreakers
 */
import { useEffect, useRef, useState } from 'react';
import { countryToFlag } from '../utils/countryFlag';

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

export function GroupTextRoom({ roomId: roomIdProp, interest: interestProp, nickname, myCountry, socket, isQueuing, onLeave, onFindNewPod, onJoined, coinState }) {
  const { balance, streak, canClaim, claimCoins } = coinState;
  const roomIdRef = useRef(null);
  const roomId = roomIdProp ?? roomIdRef.current;
  const [displayInterest, setDisplayInterest] = useState(interestProp || 'general');
  const [peers, setPeers] = useState([]);
  const [participantCount, setParticipantCount] = useState(1);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
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

  const sendMessage = () => {
    const t = chatInput.trim();
    const rid = roomIdRef.current || roomId;
    if (!t || !socket || !rid) return;
    socket.emit('send-message', { roomId: rid, text: t });
    setChatInput('');
  };

  const generateAiSpark = async () => {
    if (isAiGenerating) return;
    setIsAiGenerating(true);
    try {
      const res = await fetch('/api/ai/spark', {
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
      if (data.roomId === (roomIdRef.current || roomId))
        setMessages((m) => [...m.slice(-100), data]);
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
      setParticipantCount((c) => Math.max(1, (data.participantCount ?? c) - 1));
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
    socket.on('system-announcement', onSystemMsg);

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

  const allParticipants = [
    { socketId: 'me', nickname: nickname || 'You', country: myCountry, isMe: true },
    ...peers,
  ];

  const getNickColor = (idx) => COLORS[idx % COLORS.length];

  return (
    <div className="h-screen flex flex-col bg-[#070811] text-white overflow-hidden">
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
                  if (m.system) return <div key={m.id} className="sys-msg">{m.text}</div>;
                  const isMe = m.nickname === (nickname || 'Anonymous');
                  const peerIdx = allParticipants.findIndex((p) => p.nickname === m.nickname);
                  const color = peerIdx >= 0 ? getNickColor(peerIdx) : COLORS[0];
                  const showNick = i === 0 || messages[i - 1]?.nickname !== m.nickname || messages[i - 1]?.system;
                  return (
                    <div key={m.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-message-pop`}>
                      {showNick && !isMe && (
                        <span className="text-xs font-semibold px-1 mb-1" style={{ color }}>
                          {m.nickname || 'Stranger'}
                        </span>
                      )}
                      <div className={`msg-bubble ${isMe ? 'me' : 'them'}`} style={!isMe ? { borderColor: `${color}30` } : {}}>
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
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="flex-shrink-0 p-3 border-t border-white/[0.06] flex gap-2 min-w-0">
            <div className="flex-1 min-w-0 relative group">
              <input
                ref={inputRef}
                id="group-text-input"
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder={isAiGenerating ? 'AI thinking...' : (isQueuing ? 'Finding room...' : 'Type a message...')}
                disabled={isQueuing || !roomId || isAiGenerating}
                className={`chat-input w-full py-3.5 pr-28 sm:pr-32 transition-all ${isAiGenerating ? 'opacity-50' : ''}`}
              />

              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-white/30 hover:text-emerald-400 hover:border-emerald-500/30 transition-all"
                  title="Upload Media (10-15 Coins)"
                >
                  📂
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleMediaUpload}
                  accept="image/*,video/*"
                  className="hidden"
                />

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-white/30 hover:text-amber-400 hover:border-amber-500/30 transition-all"
                    title="3D Emojis (5 Coins)"
                  >
                    ✨
                  </button>
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

                {!isQueuing && (
                  <button
                    type="button"
                    onClick={generateAiSpark}
                    disabled={isAiGenerating}
                    className={`p-1.5 rounded-lg transition-all border ${isAiGenerating
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
                      : 'bg-white/5 border-white/5 text-white/30 hover:border-indigo-500/30 hover:text-indigo-400 hover:bg-indigo-500/10'
                      }`}
                    title="AI Spark (Generate Icebreaker)"
                  >
                    <svg className={`w-4 h-4 ${isAiGenerating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
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
                <div className="peer-avatar text-sm flex-shrink-0" style={{ background: `${getNickColor(i)}20`, borderColor: `${getNickColor(i)}40` }}>
                  {p.isMe ? '🙋' : '👤'}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: p.isMe ? '#a5b4fc' : 'rgba(232,234,246,0.85)' }}>
                    {p.isMe ? 'You' : (p.nickname || 'Stranger')}
                  </p>
                  <p className="text-xs" style={{ color: 'rgba(232,234,246,0.4)' }}>
                    {countryToFlag(p.country) || '🌍'} Anonymous
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
