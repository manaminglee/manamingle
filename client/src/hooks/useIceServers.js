import { useState, useEffect } from 'react';

const DEFAULT_ICE = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

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
                        setIceServers(data.iceServers);
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
