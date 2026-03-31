import { useState, useEffect } from 'react';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

export function useSocket() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [country, setCountry] = useState(null);
  const [onlineCount, setOnlineCount] = useState({ count: 0, regions: { in: 0, us: 0, eu: 0, ot: 0 } });
  const [adsEnabled, setAdsEnabled] = useState(false);
  const [allowDevTools, setAllowDevTools] = useState(true);
  const [nickname, setNickname] = useState('Anonymous');
  const [isCreator, setIsCreator] = useState(false);
  const [contentFlagged, setContentFlagged] = useState(null);
  const [coins, setCoins] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    let s = null;
    (async () => {
      const { io } = await import('socket.io-client');
      s = io(SOCKET_URL || window.location.origin, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        timeout: 20000
      });

      // Set socket immediately so components can use it even before 'connect' event
      setSocket(s);

      s.on('connect', () => { setConnected(true); setIsBlocked(false); });
      s.on('disconnect', () => setConnected(false));
      s.on('connected', (data) => {
        setCountry(data?.country || null);
        setNickname(data?.nickname || 'Anonymous');
        setIsCreator(!!data?.isCreator);
        if (data?.settings) {
           setAdsEnabled(!!data.settings.adsEnabled);
           setAllowDevTools(!!data.settings.allowDevTools);
        }
      });
      s.on('online_count', (data) => setOnlineCount(data));
      s.on('blocked-ip', () => setIsBlocked(true));
      s.on('content-flagged', (data) => {
        setContentFlagged(data?.message || 'Your content was flagged for review. Please follow community guidelines.');
        setTimeout(() => setContentFlagged(null), 6000);
      });
      s.on('settings_updated', (data) => {
        if (data) {
          if (typeof data.adsEnabled !== 'undefined') setAdsEnabled(!!data.adsEnabled);
          if (typeof data.allowDevTools !== 'undefined') setAllowDevTools(!!data.allowDevTools);
        }
      });
      s.on('coins-updated', (data) => {
        if (typeof data?.coins !== 'undefined') setCoins(data.coins);
      });
    })();
    return () => {
      // We no longer disconnect on unmount to keep socket alive throughout the session
      // if (s) s.disconnect(); 
      // setSocket(null);
    };
  }, []);

  // Initial fetch for settings so UI knows flags before any socket events
  const apiBase = SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/settings`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && typeof data.adsEnabled !== 'undefined') {
          setAdsEnabled(!!data.adsEnabled);
        }
        if (!cancelled && typeof data.allowDevTools !== 'undefined') {
          setAllowDevTools(!!data.allowDevTools);
        }
      } catch {
        // ignore network errors; socket event will eventually update
      }
    })();
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/user/coins`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && typeof data?.coins !== 'undefined') {
          setCoins(data.coins);
        }
      } catch { }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  return {
    socket,
    connected,
    country,
    onlineCount,
    adsEnabled,
    allowDevTools,
    nickname,
    isCreator,
    isBlocked,
    contentFlagged,
    coins
  };
}
