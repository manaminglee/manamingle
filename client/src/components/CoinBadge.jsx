/**
 * Clickable coin badge - click to show claim bar (if ready) or timer
 */
import { useState, useRef, useEffect } from 'react';
import { formatTimeUntilClaim } from '../hooks/useCoins';

export function CoinBadge({ balance = 0, streak = 1, canClaim, nextClaim = 0, claimCoins, compact = false }) {
  const [showPopover, setShowPopover] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const popoverRef = useRef(null);

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
    if (ok) setShowPopover(false);
  };

  return (
    <div className="relative flex items-center gap-2" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setShowPopover(!showPopover)}
        className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors cursor-pointer shrink-0"
      >
        <span className={compact ? 'text-xs sm:text-sm' : 'text-sm'}>🪙</span>
        <span className={`font-bold text-indigo-300 ${compact ? 'text-[10px] sm:text-[11px]' : 'text-[11px]'}`}>{balance}</span>
        <div className={`bg-white/10 mx-0.5 ${compact ? 'w-px h-2.5 sm:h-3' : 'w-px h-3'}`} />
        <span className={`font-medium text-white/40 ${compact ? 'text-[9px] sm:text-[10px]' : 'text-[10px]'}`}>🔥 {streak}d</span>
      </button>
      {showPopover && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[100] min-w-[180px] px-0 py-1 rounded-xl bg-[#0d0f1c] border border-indigo-500/30 shadow-xl overflow-hidden">
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-[#0d0f1c] border-l border-t border-indigo-500/30" />
          {canClaim ? (
            <button
              type="button"
              onClick={handleClaim}
              disabled={isClaiming}
              className="w-full px-4 py-2.5 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold text-sm rounded-lg mx-2 mb-1 hover:from-amber-400 hover:to-orange-400 active:scale-[0.98] transition-all disabled:opacity-70"
            >
              {isClaiming ? 'Claiming...' : '+30 🪙 Claim'}
            </button>
          ) : (
            <div className="px-4 py-2.5 text-xs text-white/70">
              Next claim in {formatTimeUntilClaim(nextClaim)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
