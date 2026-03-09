import { useEffect, useRef, useState } from 'react';
import { countryToFlag } from '../utils/countryFlag';

export function TextChatRoom({ roomId, interest, nickname, myCountry, socket, isQueuing, onLeave, onFindNewPartner, onJoined }) {
  const roomIdRef = useRef(null);
  const rid = roomId ?? roomIdRef.current;
  const [peer, setPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [participantCount, setParticipantCount] = useState(1);
  const hasJoinedRef = useRef(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    const t = chatInput.trim();
    const r = roomIdRef.current || roomId;
    if (!t || !socket || !r) return;
    socket.emit('send-message', { roomId: r, text: t });
    setChatInput('');
  };

  useEffect(() => {
    if (!socket) return;

    const onPartnerFound = (data) => {
      const r = data.roomId || roomIdRef.current;
      if (r) roomIdRef.current = r;
      if (!hasJoinedRef.current) {
        hasJoinedRef.current = true;
        onJoined(r);
      }
      setPeer(data.peer);
      setParticipantCount(2);
    };

    const onChatHistory = (data) => {
      const r = roomIdRef.current || roomId;
      if (data.roomId === r && data.messages) setMessages(data.messages);
    };

    const onChatMessage = (data) => {
      const r = roomIdRef.current || roomId;
      if (data.roomId === r) setMessages((m) => [...m.slice(-80), data]);
    };

    const onUserLeft = (data) => {
      setParticipantCount(1);
      setPeer(null);
    };

    socket.on('partner-found', onPartnerFound);
    socket.on('chat-history', onChatHistory);
    socket.on('chat-message', onChatMessage);
    socket.on('user-left', onUserLeft);

    return () => {
      socket.off('partner-found', onPartnerFound);
      socket.off('chat-history', onChatHistory);
      socket.off('chat-message', onChatMessage);
      socket.off('user-left', onUserLeft);
    };
  }, [socket, onJoined]);

  const partnerLeft = participantCount < 2 && !peer && !isQueuing;

  return (
    <div className="flex flex-col h-screen bg-realm-void">
      <header className="flex items-center justify-between px-4 py-3 border-b border-realm-border bg-realm-surface/90 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="text-sm text-realm-muted">
            <span className="text-realm-teal font-medium capitalize">{interest || 'general'}</span>
            <span className="mx-1.5">·</span>
            1:1 Text
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
        <button
          type="button"
          onClick={() => { if (isQueuing) socket?.emit('cancel-find-partner'); onLeave(); }}
          className="px-4 py-2 rounded-xl bg-realm-coral/15 text-realm-coral hover:bg-realm-coral/25 transition font-medium text-sm"
        >
          {isQueuing ? 'Cancel' : 'Leave'}
        </button>
      </header>

      {isQueuing && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-realm-muted text-sm mb-2">Searching for a partner</p>
            <div className="flex justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-realm-teal animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-realm-teal animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-realm-teal animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}

      {!isQueuing && peer && (
        <div className="px-4 py-2 bg-realm-card/50 border-b border-realm-border/50">
          <p className="text-sm text-realm-muted">
            <span className="text-realm-gold">Chatting with:</span>{' '}
            <span className="text-white/90">{countryToFlag(peer.country) ? `${countryToFlag(peer.country)} ` : ''}{peer.nickname || 'Stranger'}</span>
          </p>
        </div>
      )}

      {!isQueuing && partnerLeft && (
        <div className="px-4 py-2 bg-realm-coral/20 border-b border-realm-coral/30">
          <p className="text-sm text-realm-coral">Your partner left. Use Skip to find someone new.</p>
        </div>
      )}

      {!isQueuing && (
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
          {messages.map((m) => (
            <div key={m.id} className="text-sm">
              <span className="text-realm-teal font-medium">{m.nickname}:</span>{' '}
              <span className="text-white/90">{m.text}</span>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div className="p-3 border-t border-realm-border flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Say something..."
            className="flex-1 px-3 py-2 rounded-lg bg-realm-card border border-realm-border text-white placeholder-realm-muted text-sm focus:border-realm-teal focus:outline-none"
          />
          <button
            type="button"
            onClick={sendMessage}
            className="px-4 py-2 rounded-lg bg-realm-teal text-realm-void font-medium text-sm hover:bg-realm-mint transition"
          >
            Send
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
