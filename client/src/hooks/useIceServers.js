import { useState, useEffect } from 'react';

const DEFAULT_ICE = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

function normalizeIceServer(server) {
    if (!server || typeof server !== 'object') return null;
    const urls = server.urls;
    if (!urls) return server;
    const str = typeof urls === 'string' ? urls : (Array.isArray(urls) ? urls[0] : '');
    if (!str || typeof str !== 'string') return server;
    const s = str.trim();
    if (s.startsWith('stun:') || s.startsWith('turn:') || s.startsWith('turns:')) return server;
    const normalized = `turn:${s}`;
    return { ...server, urls: Array.isArray(urls) ? [normalized] : normalized };
}

export function useIceServers() {
    const [iceServers, setIceServers] = useState(DEFAULT_ICE);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const base = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : '');
                const res = await fetch(`${base}/api/turn`);
                if (res.ok) {
                    const data = await res.json();
                    if (!cancelled && data.iceServers && data.iceServers.length > 0) {
                        const normalized = data.iceServers.map(normalizeIceServer).filter(Boolean);
                        if (normalized.length > 0) setIceServers(normalized);
                    }
                }
            } catch (err) {
                console.warn('Could not fetch TURN servers, using fallback STUN');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    return { iceServers, loading };
}
