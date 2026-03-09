import { useState, useEffect } from 'react';

/**
 * useLatency hook
 * Returns a semi-realistic latency value in ms that fluctuates.
 */
export function useLatency() {
    const [latency, setLatency] = useState(24); // Start with a decent base

    useEffect(() => {
        const update = () => {
            // Generate a realistic random fluctuation between 15ms and 65ms
            const fluctuation = Math.floor(Math.random() * 20) - 10;
            setLatency(prev => {
                let next = prev + fluctuation;
                if (next < 12) next = 12;
                if (next > 85) next = 85;
                return next;
            });
        };

        const interval = setInterval(update, 3000);
        return () => clearInterval(interval);
    }, []);

    return latency;
}
