import { useState, useEffect, useCallback } from 'react';
import { LandingPage } from './components/LandingPage';
import { TextChat } from './components/TextChat';
import { GroupVideoRoom } from './components/GroupVideoRoom';
import { GroupTextRoom } from './components/GroupTextRoom';
import { VideoChat } from './components/VideoChat';
import { AdminDashboard } from './components/AdminDashboard';
import { PreloadSplash } from './components/PreloadSplash';
import { AgeVerificationGate } from './components/AgeVerificationGate';
import { useSocket } from './hooks/useSocket';
import { useCoins } from './hooks/useCoins';

const STATES = { LANDING: 'landing', CHAT: 'chat', ADMIN: 'admin' };
const MODES = { TEXT: 'text', VIDEO: 'video', GROUP_TEXT: 'group_text', GROUP_VIDEO: 'group_video' };

export default function App() {
  const [gateVerified, setGateVerified] = useState(() =>
    sessionStorage.getItem('wc_age') === '1' && sessionStorage.getItem('wc_bot') === '1'
  );

  const [appState, setAppState] = useState(
    window.location.pathname === '/admin' ? STATES.ADMIN : STATES.LANDING
  );
  const [mode, setMode] = useState(null);
  const [interest, setInterest] = useState('general');
  const [roomId, setRoomId] = useState(null);
  const [preloadDone, setPreloadDone] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const { socket, connected, country, onlineCount, adsEnabled, allowDevTools, isBlocked, contentFlagged } = useSocket();
  const coinState = useCoins();

  useEffect(() => {
    if (allowDevTools) return;
    const block = (e) => e.preventDefault();
    const keyBlock = (e) => {
       if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67)) || (e.ctrlKey && e.keyCode === 85)) {
         e.preventDefault();
         return false;
       }
    };
    document.addEventListener('contextmenu', block);
    document.addEventListener('keydown', keyBlock);
    return () => {
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('keydown', keyBlock);
    };
  }, [allowDevTools]);

  const handlePreloadReady = useCallback(() => setPreloadDone(true), []);

  useEffect(() => {
    if (socket) {
      socket.on('coins-updated', (data) => coinState.setBalance(data.coins));
      return () => socket.off('coins-updated');
    }
  }, [socket, coinState]);

  // Manage browser back button
  useEffect(() => {
    const handlePopState = (e) => {
      // If we're not on the landing page, go back to it
      if (appState !== STATES.LANDING) {
        handleBackInternal();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [appState]);

  const handleBackInternal = () => {
    if (roomId && socket) socket.emit('leave-room', { roomId });
    if (mode === MODES.TEXT || mode === MODES.VIDEO) socket?.emit('cancel-find-partner');
    setRoomId(null);
    setAppState(STATES.LANDING);
    setMode(null);
    setInterest('general');
  };

  // Called when user selects a mode from the landing page
  const handleJoin = (interestVal, _nickname, m) => {
    if (!socket || !connected || isJoining) return;
    setIsJoining(true);
    const intst = (interestVal || 'general').trim().toLowerCase() || 'general';
    setInterest(intst);
    setMode(m);
    setAppState(STATES.CHAT);

    // Push state so back button works
    window.history.pushState({ mode: m }, '');

    // Note: We no longer emit find-partner here. 
    // The individual components (VideoChat/TextChat) will emit it on mount 
    // to avoid race conditions where events arrive before listeners are ready.
    
    setTimeout(() => setIsJoining(false), 500);
  };

  const handleJoined = (rid) => setRoomId(rid);

  const handleLeaveRoom = () => {
    handleBack();
  };

  const handleCancelQueue = () => {
    handleBack();
  };

  const handleBack = () => {
    if (appState !== STATES.LANDING) {
      window.history.back(); // This will trigger popstate
    }
  };

  const handleFindNewPartner = () => {
    if (!socket) return;
    if (roomId) socket.emit('leave-room', { roomId });
    setRoomId(null);
    socket.emit('find-partner', { mode, interest, nickname: 'Anonymous' });
  };

  const handleFindNewPod = () => {
    if (!socket) return;
    if (roomId) socket.emit('leave-room', { roomId });
    setRoomId(null);
    socket.emit('join-group-by-interest', { interest, nickname: 'Anonymous', mode });
  };

  const renderContent = () => {
    if (appState === STATES.ADMIN) return <AdminDashboard />;
    if (isBlocked) {
      return (
        <div className="min-h-screen bg-[#070811] flex items-center justify-center p-6 text-white font-sans text-center">
          <div className="max-w-md w-full p-8 rounded-3xl bg-rose-500/10 border border-rose-500/20 backdrop-blur-xl animate-fade-in">
            <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center bg-rose-500/20 mb-6 border border-rose-500/50 text-rose-500 text-3xl">⚠️</div>
            <h1 className="text-2xl font-bold mb-3 tracking-tight text-white">Access Restricted</h1>
            <p className="text-sm text-white/50 mb-8 leading-relaxed">
              Your connection has been blocked due to multiple violations of our terms of service and community guidelines.
            </p>
            <div className="bg-black/40 p-5 rounded-2xl border border-white/5 mb-8">
              <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-2">Unblock Account</h3>
              <p className="text-[11px] text-white/40 mb-4">Pay the $5.00 unblock fee using cryptocurrency to verify intent and clear your IP reputation.</p>
              <button className="btn w-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 shadow-none hover:text-white py-3 rounded-xl font-bold text-xs" onClick={() => alert('Payment processor would open here')}>
                Pay $5.00 via Stripe
              </button>
            </div>
            <p className="text-[10px] text-white/20">Provide the Admin with your IP if this was a mistake.</p>
          </div>
        </div>
      );
    }
    if (appState === STATES.LANDING) {
      return (
        <div className="animate-fade-in">
          <LandingPage
            onJoin={handleJoin}
            connected={connected}
            onlineCount={onlineCount}
            coinState={coinState}
            isJoining={isJoining}
          />
        </div>
      );
    }
    if (mode === MODES.TEXT) {
      return (
        <div className="animate-fade-in">
          <TextChat
            socket={socket}
            connected={connected}
            country={country}
            onlineCount={onlineCount}
            interest={interest}
            nickname="Anonymous"
            adsEnabled={adsEnabled}
            onBack={handleBack}
            onJoined={handleJoined}
            onFindNewPartner={handleFindNewPartner}
            coinState={coinState}
          />
        </div>
      );
    }
    if (mode === MODES.VIDEO) {
      return (
        <div className="animate-fade-in">
          <VideoChat
            socket={socket}
            connected={connected}
            country={country}
            onlineCount={onlineCount}
            interest={interest}
            nickname="Anonymous"
            adsEnabled={adsEnabled}
            onBack={handleBack}
            onJoined={handleJoined}
            onFindNewPartner={handleFindNewPartner}
            coinState={coinState}
          />
        </div>
      );
    }
    if (mode === MODES.GROUP_TEXT) {
      return (
        <div className="animate-fade-in">
          <GroupTextRoom
            roomId={roomId}
            interest={interest}
            nickname="Anonymous"
            myCountry={country}
            socket={socket}
            isQueuing={!roomId}
            onLeave={roomId ? handleLeaveRoom : handleCancelQueue}
            onFindNewPod={roomId ? handleFindNewPod : undefined}
            onJoined={handleJoined}
            coinState={coinState}
          />
        </div>
      );
    }
    if (mode === MODES.GROUP_VIDEO) {
      return (
        <div className="animate-fade-in">
          <GroupVideoRoom
            roomId={roomId}
            interest={interest}
            nickname="Anonymous"
            myCountry={country}
            socket={socket}
            isQueuing={!roomId}
            onLeave={roomId ? handleLeaveRoom : handleCancelQueue}
            onFindNewPod={roomId ? handleFindNewPod : undefined}
            onJoined={handleJoined}
            coinState={coinState}
          />
        </div>
      );
    }
    return null;
  };

  if (!gateVerified) {
    return (
      <AgeVerificationGate onVerified={() => setGateVerified(true)} />
    );
  }

  return (
    <>
      {!preloadDone && (
        <PreloadSplash ready={connected} onReady={handlePreloadReady} />
      )}
      {renderContent()}
      {contentFlagged && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-xl bg-amber-500/90 text-black font-semibold text-sm shadow-xl animate-fade-in-up max-w-md text-center">
          ⚠️ {contentFlagged}
        </div>
      )}
    </>
  );
}
