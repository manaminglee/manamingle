/**
 * Clickable coin badge - click to show claim bar (if ready) or timer
 */
import { useState, useRef, useEffect } from 'react';
import { formatTimeUntilClaim } from '../hooks/useCoins';

const CLAIM_INTERVAL_MS = 60 * 60 * 1000;
const REWARD_AMOUNT = 30;

export function CoinBadge({ balance = 0, streak = 1, canClaim, nextClaim = 0, claimCoins, compact = false }) {
  const [showPopover, setShowPopover] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [showClaimFeedback, setShowClaimFeedback] = useState(false);
  const [deduction, setDeduction] = useState(null);
  const [activeTime, setActiveTime] = useState(() => Number(localStorage.getItem('mm_active_reward_time') || 0));
  const prevBalance = useRef(balance);
  const popoverRef = useRef(null);

  const REWARD_DUR = 180; // 3 minutes
  const REWARD_VAL = 40;

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && activeTime < REWARD_DUR) {
        setActiveTime(prev => {
          const next = prev + 1;
          localStorage.setItem('mm_active_reward_time', next);
          return next;
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [activeTime]);

  // Auto-claim activity reward
  useEffect(() => {
    if (activeTime >= REWARD_DUR) {
      const claimActivity = async () => {
        try {
          const API_BASE = import.meta.env.VITE_SOCKET_URL || '';
          const res = await fetch(`${API_BASE}/api/coins/activity-reward`, { method: 'POST' });
          if (res.ok) {
            localStorage.setItem('mm_active_reward_time', '0');
            setActiveTime(0);
            setShowClaimFeedback(true);
            setTimeout(() => setShowClaimFeedback(false), 3000);
          }
        } catch (e) { console.error('Activity Sync Failed'); }
      };
      claimActivity();
    }
  }, [activeTime]);

  useEffect(() => {
    if (balance < prevBalance.current) {
      const diff = prevBalance.current - balance;
      setDeduction(diff);
      setTimeout(() => setDeduction(null), 1500);
    }
    prevBalance.current = balance;
  }, [balance]);

  useEffect(() => {
    if (!showPopover) return;
    const close = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setShowPopover(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showPopover]);

  const handleClaim = async () => {
    if (!canClaim || isClaiming) return;
    setIsClaiming(true);
    const ok = await claimCoins();
    setIsClaiming(false);
    if (ok) {
      setShowClaimFeedback(true);
      setTimeout(() => setShowClaimFeedback(false), 1200);
      setShowPopover(false);
    }
  };

  const progress = nextClaim > 0 ? Math.max(0, 1 - nextClaim / CLAIM_INTERVAL_MS) : 1;
  const activeProgress = (activeTime / REWARD_DUR) * 100;

  return (
    <div className="relative flex items-center gap-2" ref={popoverRef}>
      {/* Claim feedback animation */}
      {showClaimFeedback && (
        <span className="absolute -top-10 left-1/2 -translate-x-1/2 text-amber-400 font-black text-xs animate-float-up pointer-events-none z-[101] whitespace-nowrap bg-black/60 px-2 py-1 rounded-full border border-amber-500/20">
          🪙 +{activeTime >= REWARD_DUR ? REWARD_VAL : REWARD_AMOUNT} COINS
        </span>
      )}
      {deduction && (
        <span className="absolute top-0 left-1/2 -translate-x-1/2 text-rose-500 font-black text-sm z-[101] pointer-events-none animate-deduct-coins">
          -{deduction} 🪙
        </span>
      )}
      <button
        type="button"
        onMouseEnter={() => !compact && setShowPopover(true)}
        onClick={() => setShowPopover(!showPopover)}
        className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-cyan-500/40 hover:bg-cyan-500/10 transition-all cursor-pointer group"
      >
        <span className="text-sm group-hover:rotate-12 transition-transform">🪙</span>
        <span className="font-black text-xs text-white tabular-nums">{balance}</span>
        <div className="w-px h-3 bg-white/10 mx-1" />
        <span className="text-[9px] font-black uppercase text-white/30 tracking-tighter italic">🔥 {streak}d</span>
        
        {/* Tiny live pulse indicator for 3m timer */}
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${activeProgress}%` }} />
        </div>
      </button>

      {showPopover && (
        <div className="absolute top-full right-0 mt-3 z-[200] w-56 bg-black/95 backdrop-blur-3xl border border-white/10 rounded-3xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.6)] animate-in-zoom">
          <div className="space-y-4">
            
            {/* 3M ACTIVITY REWARD - MINI VERSION */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <span className="text-xs">🎁</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-white/70 italic">Stay Active 3M for {REWARD_VAL}</span>
                 </div>
                 <span className="text-[9px] font-black text-emerald-400 italic tabular-nums">{Math.floor(activeTime / 60)}:{(activeTime % 60).toString().padStart(2, '0')}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${activeProgress}%` }} />
              </div>
              <p className="text-[7px] font-black text-white/10 uppercase tracking-[0.2em] text-center italic">Uplink active only when visible</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
