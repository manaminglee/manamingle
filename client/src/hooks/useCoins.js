import { useState, useEffect } from 'react';

export function useCoins() {
    const [balance, setBalance] = useState(0);
    const [streak, setStreak] = useState(1);
    const [nextClaim, setNextClaim] = useState(0);
    const [canClaim, setCanClaim] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/user/coins');
            if (res.ok) {
                const data = await res.json();
                setBalance(data.coins);
                setStreak(data.streak);
                setCanClaim(data.canClaim);
                setNextClaim(data.nextClaim);
            }
        } catch (e) {
            console.error('Failed to fetch coins:', e);
        } finally {
            setLoading(false);
        }
    };

    const claimCoins = async () => {
        try {
            const res = await fetch('/api/user/claim', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                setBalance(data.coins);
                setStreak(data.streak);
                setCanClaim(false);
                setNextClaim(4 * 60 * 60 * 1000); // 4 hours
                return true;
            }
        } catch (e) {
            console.error('Claim failed:', e);
        }
        return false;
    };

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, []);

    return { balance, streak, nextClaim, canClaim, claimCoins, refresh: fetchStatus, setBalance };
}
