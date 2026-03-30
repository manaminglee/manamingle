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
  const prevBalance = useRef(balance);
  const popoverRef = useRef(null);

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

  return (
    <div className="relative flex items-center gap-2" ref={popoverRef}>
      {/* Claim feedback animation */}
      {showClaimFeedback && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-amber-400 font-black text-sm animate-float-up pointer-events-none z-[101]">
          🪙 +{REWARD_AMOUNT}
        </span>
      )}
      {deduction && (
        <span className="absolute top-0 left-1/2 -translate-x-1/2 text-rose-500 font-black text-sm z-[101] pointer-events-none animate-deduct-coins">
          -{deduction} 🪙
        </span>
      )}
      <button
        type="button"
        onClick={() => setShowPopover(!showPopover)}
        title="Daily rewards"
        className="relative flex items-center gap-1 sm:gap-1.5 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/30 transition-all cursor-pointer shrink-0"
      >
        {canClaim && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full animate-pulse ring-2 ring-[#0d0f1c]" />
        )}
        <span className={compact ? 'text-xs sm:text-sm' : 'text-sm'}>🪙</span>
        <span className={`font-bold text-indigo-300 ${compact ? 'text-[10px] sm:text-[11px]' : 'text-[11px]'}`}>{balance}</span>
        <div className={`bg-white/10 mx-0.5 ${compact ? 'w-px h-2.5 sm:h-3' : 'w-px h-3'}`} />
        <span className={`font-medium text-white/40 ${compact ? 'text-[9px] sm:text-[10px]' : 'text-[10px]'}`} title="Daily claim streak">🔥 {streak}d</span>
      </button>
      {showPopover && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[100] min-w-[180px] px-0 py-1 rounded-xl bg-[#0d0f1c] border border-indigo-500/30 shadow-xl overflow-hidden">
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-[#0d0f1c] border-l border-t border-indigo-500/30" />
          {canClaim ? (
            <div className="px-3 pb-2">
              <div className="text-xs text-white/50 text-center mb-1">Daily reward ready</div>
              <div className="text-sm font-bold text-amber-400 text-center mb-1.5">+{REWARD_AMOUNT} Coins</div>
              <button
                type="button"
                onClick={handleClaim}
                disabled={isClaiming}
                className="w-full px-4 py-2.5 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-sm rounded-lg hover:from-amber-400 hover:to-orange-400 active:scale-[0.98] transition-all disabled:opacity-70"
              >
                {isClaiming ? 'Claiming...' : 'Claim'}
              </button>
            </div>
          ) : (
            <div className="px-4 py-2.5 text-xs text-white/70 space-y-2">
              <div>Next claim in {formatTimeUntilClaim(nextClaim)}</div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-500/60 to-orange-500/60 rounded-full transition-all duration-1000" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
