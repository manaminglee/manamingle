import { useState, useEffect } from 'react';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

export function useSocket() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [country, setCountry] = useState(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [adsEnabled, setAdsEnabled] = useState(false);

  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    let s = null;
    (async () => {
      const { io } = await import('socket.io-client');
      s = io(SOCKET_URL || window.location.origin, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        withCredentials: true,
      });
      s.on('connect', () => { setConnected(true); setIsBlocked(false); });
      s.on('disconnect', () => setConnected(false));
      s.on('connected', (data) => setCountry(data?.country || null));
      s.on('online_count', (data) => setOnlineCount(data?.count ?? 0));
      s.on('blocked-ip', () => setIsBlocked(true));
      s.on('settings_updated', (data) => {
        if (data && typeof data.adsEnabled !== 'undefined') {
          setAdsEnabled(!!data.adsEnabled);
        }
      });
      setSocket(s);
    })();
    return () => {
      if (s) s.disconnect();
      setSocket(null);
      setConnected(false);
      setCountry(null);
      setOnlineCount(0);
      setAdsEnabled(false);
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
      } catch {
        // ignore network errors; socket event will eventually update
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  return { socket, connected, country, onlineCount, adsEnabled, isBlocked };
}
