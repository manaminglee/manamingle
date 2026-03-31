import { useState, useEffect, useMemo } from 'react';

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
    let mounted = true;
    (async () => {
      const { io } = await import('socket.io-client');
      if (!mounted) return;
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
      mounted = false;
    };
  }, []);

  const apiBase = SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  
  useEffect(() => {
    let cancelled = false;
    const fetchInitData = async () => {
      try {
        const [settingsRes, coinsRes] = await Promise.all([
          fetch(`${apiBase}/api/settings`),
          fetch(`${apiBase}/api/user/coins`)
        ]);
        
        if (!cancelled && settingsRes.ok) {
          const data = await settingsRes.json();
          if (typeof data.adsEnabled !== 'undefined') setAdsEnabled(!!data.adsEnabled);
          if (typeof data.allowDevTools !== 'undefined') setAllowDevTools(!!data.allowDevTools);
        }
        
        if (!cancelled && coinsRes.ok) {
          const data = await coinsRes.json();
          if (typeof data?.coins !== 'undefined') setCoins(data.coins);
        }
      } catch { }
    };
    
    fetchInitData();
    return () => { cancelled = true; };
  }, [apiBase]);

  return useMemo(() => ({
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
  }), [socket, connected, country, onlineCount, adsEnabled, allowDevTools, nickname, isCreator, isBlocked, contentFlagged, coins]);
}
