import { useCallback, useEffect, useRef, useState } from 'react';
import { countryToFlag } from '../utils/countryFlag';
import { useLatency } from '../hooks/useLatency';

const AI_ICEBREAKERS = {
  general: [
    "If you could travel anywhere right now, where would you go?",
    "What's the most interesting thing you've learned recently?",
    "What's your favorite way to spend a rainy afternoon?",
    "If you could have dinner with any historical figure, who would it be?",
    "What's the best piece of advice you've ever received?"
  ],
  telugu: [
    "What's your favorite Telugu movie of all time? 🎬",
    "Which Telugu song are you currently obsessed with? 🎵",
    "Have you tried the new street food spots in Hyderabad lately?",
    "What's your favorite memory related to a Telugu festival?",
    "If you could meet one Telugu actor, who would it be?"
  ],
  music: [
    "What's one song that always puts you in a good mood?",
    "If you could go to any concert in history, which one would it be?",
    "What's your favorite genre of music to listen to while working?",
    "What's the best live performance you've ever seen?",
    "Do you play any musical instruments?"
  ],
  gaming: [
    "What's the first video game you ever played?",
    "What's your all-time favorite game soundtrack?",
    "If you could live in any video game world, which one would it be?",
    "What's the most challenging game you've ever completed?",
    "Are you more of a PC gamer or a console gamer?"
  ]
};

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

export function TextChat({ socket, connected, country, onlineCount, interest = 'general', nickname = 'Anonymous', onBack, onJoined, onFindNewPartner, adsEnabled, coinState }) {
  const { balance, streak, canClaim, claimCoins } = coinState;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [roomId, setRoomId] = useState(null);
  const [peer, setPeer] = useState(null);
  // status: idle | searching | connected | disconnected
  const [status, setStatus] = useState('idle');
  const latency = useLatency();
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isTranslatorActive, setIsTranslatorActive] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [active3dEmoji, setActive3dEmoji] = useState(null);
  const roomIdRef = useRef(null);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const isConnected = !!peer && !!roomId;

  const isFromMe = (m) => {
    if (!m) return false;
    if (socket && m.socketId) return m.socketId === socket.id;
    if (typeof m.fromSelf === 'boolean') return m.fromSelf;
    if (m.nickname && nickname) return m.nickname === nickname;
    return false;
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const emitFind = useCallback(() => {
    if (!socket || !connected) return;
    socket.emit('find-partner', { mode: 'text', interest: interest || 'general', nickname: 'Anonymous' });
  }, [socket, connected, interest]);

  const clearRoom = useCallback(() => {
    setPeer(null);
    setRoomId(null);
    setMessages([]);
    roomIdRef.current = null;
  }, []);

  // ---- socket events ----
  useEffect(() => {
    if (!socket) return;

    const onPartnerFound = (data) => {
      roomIdRef.current = data.roomId;
      setRoomId(data.roomId);
      setPeer(data.peer);
      setStatus('connected');
      onJoined?.(data.roomId);
      setTimeout(() => inputRef.current?.focus(), 100);
    };

    const onHistory = (data) => {
      if (data.roomId === roomIdRef.current) setMessages(data.messages || []);
    };

    const onMessage = (data) => {
      if (data.roomId === roomIdRef.current)
        setMessages((m) => [...m.slice(-100), data]);
    };

    const onUserLeft = () => {
      setStatus('disconnected');
      setPeer(null);
    };

    const onWaiting = () => setStatus('searching');
    const onSystemMsg = (data) => setMessages((m) => [...m, { id: Date.now(), system: true, text: `📢 ADMIN: ${data.message}`, ts: Date.now() }]);

    socket.on('partner-found', onPartnerFound);
    socket.on('chat-history', onHistory);
    socket.on('chat-message', onMessage);
    socket.on('user-left', onUserLeft);
    socket.on('waiting-for-partner', onWaiting);
    socket.on('system-announcement', onSystemMsg);

    return () => {
      socket.off('partner-found', onPartnerFound);
      socket.off('chat-history', onHistory);
      socket.off('chat-message', onMessage);
      socket.off('user-left', onUserLeft);
      socket.off('waiting-for-partner', onWaiting);
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
    if (balance < 5) return alert('Need 5 coins for 3D Emoji!');
    const rid = roomIdRef.current;
    if (socket && rid) {
      socket.emit('send-3d-emoji', { roomId: rid, emoji });
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
        if (video.duration > 6) { // Allowing small buffer
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

  // Handle translation for incoming messages
  useEffect(() => {
    if (!isTranslatorActive) return;

    // Find messages from stranger that aren't translated yet
    const toTranslate = messages.find(m =>
      !m.system &&
      !m.media &&
      !isFromMe(m) &&
      !m.translated &&
      !m.translating
    );
    if (toTranslate) {
      const targetId = toTranslate.id || messages.indexOf(toTranslate);
      setMessages(prev => prev.map(m => (m.id === toTranslate.id || prev.indexOf(m) === targetId) ? { ...m, translating: true } : m));

      const apiBase = import.meta.env.VITE_SOCKET_URL || '';
      fetch(`${apiBase}/api/ai/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: toTranslate.text })
      })
        .then(res => res.json())
        .then(data => {
          setMessages(prev => prev.map(m => (m.id === toTranslate.id || prev.indexOf(m) === targetId) ? { ...m, translated: data.translated, translating: false } : m));
        })
        .catch(() => {
          setMessages(prev => prev.map(m => (m.id === toTranslate.id || prev.indexOf(m) === targetId) ? { ...m, translating: false } : m));
        });
    }
  }, [messages, isTranslatorActive]);

  // keyboard shortcut
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && status === 'searching') handleSkip();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [status]);

  const handleStart = () => {
    if (!socket || !connected) return;
    clearRoom();
    setStatus('searching');
    emitFind();
  };

  const handleSkip = () => {
    if (roomIdRef.current && socket) {
      socket.emit('leave-room', { roomId: roomIdRef.current });
    } else {
      socket?.emit('cancel-find-partner');
    }
    clearRoom();
    setStatus('searching');
    setTimeout(() => {
      socket?.emit('find-partner', { mode: 'text', interest: interest || 'general', nickname: 'Anonymous' });
      onFindNewPartner?.();
    }, 50);
  };

  const handleStop = () => {
    if (roomIdRef.current && socket) socket.emit('leave-room', { roomId: roomIdRef.current });
    socket?.emit('cancel-find-partner');
    clearRoom();
    setStatus('idle');
  };

  const handleBack = () => {
    handleStop();
    onBack?.();
  };

  const sendMsg = () => {
    const t = input.trim();
    const r = roomIdRef.current;
    if (!t || !socket || !r) return;
    socket.emit('send-message', { roomId: r, text: t });
    setInput('');
  };

  const generateAiSpark = async () => {
    if (isAiGenerating) return;
    setIsAiGenerating(true);

    try {
      const apiBase = import.meta.env.VITE_SOCKET_URL || '';
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
      inputRef.current?.focus();
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#070811] text-white">
      {/* HEADER */}
      <header className="app-header">
        <div className="flex items-center gap-3">
          <button
            id="text-back-btn"
            type="button"
            onClick={handleBack}
            className="btn btn-icon"
            title="Back to home"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="logo-icon text-sm">M</div>
          <div>
            <h1 className="font-bold text-white leading-none">Mana Mingle</h1>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(232,234,246,0.45)' }}>
              {interest && interest !== 'general' ? `#${interest}` : 'Any topic'} · Anonymous
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {connected && (
            <>
              {canClaim && (
                <button
                  onClick={claimCoins}
                  className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-black text-[10px] font-black uppercase tracking-tighter rounded-full shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all animate-coin-glow"
                >
                  <span className="hidden sm:inline">Claim 30 Coins</span>
                  <span className="sm:hidden">+30 🪙</span>
                </button>
              )}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                <span className="text-sm">🪙</span>
                <span className="text-[11px] font-bold text-indigo-300">{balance}</span>
                <div className="w-px h-3 bg-white/10 mx-0.5" />
                <span className="text-[10px] font-medium text-white/40">🔥 {streak}d</span>
              </div>
              <div className="hidden sm:flex px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-400 uppercase tracking-tighter gap-1 items-center">
                <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                {latency}ms
              </div>
              <div className="online-pill">
                <div className="live-dot" style={{ width: 7, height: 7 }} />
                <span>{onlineCount?.toLocaleString()} online</span>
              </div>
            </>
          )}
          {status === 'connected' && (
            <button
              onClick={() => setIsTranslatorActive(!isTranslatorActive)}
              className={`anon-badge transition-all ${isTranslatorActive ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'hover:bg-white/10'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
              {isTranslatorActive ? 'AI Translator ON' : 'AI Translator OFF'}
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 py-4 gap-4 min-h-0">
        {adsEnabled && (
          <div className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-center text-white/30 text-xs font-mono uppercase tracking-widest hidden sm:block h-20 flex items-center justify-center">
            [Advertisement Placeholder 728x90]
          </div>
        )}

        {/* Status / Chat area */}
        <div className="flex-1 flex flex-col rounded-2xl overflow-hidden border border-white/[0.07] bg-[#0d0f1c] min-h-0 relative" style={{ minHeight: 400 }}>

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

          {/* Peer bar when connected */}
          {status === 'connected' && peer && (
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.07] bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="peer-avatar">👤</div>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {countryToFlag(peer?.country)} Stranger
                  </p>
                  <p className="text-xs" style={{ color: 'rgba(232,234,246,0.4)' }}>Anonymous · No identity shared</p>
                </div>
              </div>
              <button
                id="report-text-btn"
                type="button"
                onClick={() => {
                  if (socket) socket.emit('report-user', { reason: 'Inappropriate Behavior (Text)' });
                  alert('User reported. Our Trust & Safety team has been notified and the IP logged.');
                }}
                className="text-xs px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400/60 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/40 transition"
              >
                Report
              </button>
            </div>
          )}

          {/* IDLE */}
          {status === 'idle' && (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-4xl">
                  💬
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                  1:1
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-2">Ready to Chat?</h2>
                <p className="text-sm" style={{ color: 'rgba(232,234,246,0.5)' }}>
                  Press Start to be matched with a random stranger worldwide.<br />
                  No identity, no account — just pure conversation.
                </p>
              </div>
            </div>
          )}

          {/* SEARCHING */}
          {status === 'searching' && (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-6">
              <div className="relative w-24 h-24">
                <div className="radar-ring absolute inset-0" />
                <div className="radar-ring absolute inset-2" />
                <div className="radar-ring absolute inset-4" />
                <div className="absolute inset-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-2xl">
                  🔍
                </div>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white mb-2">Searching for a stranger...</h2>
                <p className="text-sm" style={{ color: 'rgba(232,234,246,0.4)' }}>
                  Press <kbd className="px-2 py-0.5 rounded bg-white/10 text-xs font-mono">Esc</kbd> or Skip to cancel
                </p>
              </div>
              <div className="search-dots">
                <span /><span /><span />
              </div>
            </div>
          )}

          {/* DISCONNECTED */}
          {status === 'disconnected' && (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-3xl">
                👋
              </div>
              <div>
                <h2 className="text-lg font-bold text-amber-400 mb-2">Stranger left the chat</h2>
                <p className="text-sm" style={{ color: 'rgba(232,234,246,0.5)' }}>
                  Click Skip to find someone new
                </p>
              </div>
              {/* Show last messages fadeout */}
              <div className="w-full max-w-sm space-y-2 opacity-40">
                {messages.slice(-2).map((m) => {
                  const isMe = isFromMe(m);
                  return (
                    <div key={m.id}>
                      <div className={`msg-bubble ${isMe ? 'me' : 'them'}`}>{m.text}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MESSAGES */}
          {status === 'connected' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0" id="text-chat-messages">
              {messages.length === 0 && (
                <div className="sys-msg">Say hello! The conversation just started 👋</div>
              )}
              {messages.map((m, i) => {
                const isMe = isFromMe(m);
                const showTime = i === 0 || messages[i - 1]?.nickname !== m.nickname;
                return (
                  <div key={m.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-message-pop`}>
                    {showTime && (
                      <span className="msg-time px-2">{isMe ? 'You' : 'Stranger'}</span>
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
                                  <span className="text-[10px] opacity-40 uppercase font-bold tracking-widest">Translated by NVIDIA AI</span>
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
                    <span className="msg-time px-2">{formatTime(m.ts)}</span>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* CONTROLS */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Main action button */}
            {status === 'idle' && (
              <button
                id="text-start-btn"
                type="button"
                disabled={!connected}
                onClick={handleStart}
                className="btn btn-primary shrink-0 px-6 py-3.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start
              </button>
            )}
            {(status === 'searching' || status === 'disconnected' || status === 'connected') && (
              <>
                <button
                  id="text-skip-btn"
                  type="button"
                  disabled={!connected}
                  onClick={handleSkip}
                  className="btn btn-amber shrink-0 px-6 py-3.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                  {status === 'searching' ? 'Cancel' : 'Skip'}
                </button>
                <button
                  id="text-stop-btn"
                  type="button"
                  onClick={handleStop}
                  className="btn btn-danger shrink-0 px-6 py-3.5"
                >
                  Stop
                </button>
              </>
            )}

            {/* Message input container */}
            <div className="flex-1 min-w-0 flex gap-1.5 sm:gap-2 items-center">
              <input
                ref={inputRef}
                id="text-message-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMsg()}
                placeholder={isAiGenerating ? 'AI thinking...' : (isConnected ? 'Type a message...' : 'Connect first')}
                disabled={!isConnected || isAiGenerating}
                className={`chat-input flex-1 min-w-0 py-3 px-4 transition-all ${isAiGenerating ? 'opacity-50' : ''}`}
              />
              {isConnected && (
                <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 sm:p-2.5 rounded-lg bg-white/5 border border-white/5 text-white/30 hover:text-emerald-400 hover:border-emerald-500/30 transition-all"
                    title="Media (10-15 Coins)"
                  >
                    📂
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleMediaUpload} />
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-2 sm:p-2.5 rounded-lg bg-white/5 border border-white/5 text-white/30 hover:text-amber-400 hover:border-amber-500/30 transition-all"
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
                    className={`p-2 sm:p-2.5 rounded-lg transition-all border shrink-0 ${isAiGenerating
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
                      : 'bg-white/5 border-white/5 text-white/30 hover:border-indigo-500/30 hover:text-indigo-400 hover:bg-indigo-500/10'
                      }`}
                  >
                    <svg className={`w-4 h-4 ${isAiGenerating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* Send button */}
            <button
              id="text-send-btn"
              type="button"
              onClick={sendMsg}
              disabled={!isConnected || !input.trim()}
              className="btn btn-primary shrink-0 w-12 h-12 p-0 rounded-xl"
              title="Send"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>

          <p className="text-xs text-center" style={{ color: 'rgba(232,234,246,0.3)' }}>
            🔒 Anonymous · Messages disappear when you leave · No data stored
          </p>
        </div>
      </main>
    </div >
  );
}
