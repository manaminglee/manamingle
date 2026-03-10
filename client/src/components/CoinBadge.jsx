/**
 * Clickable coin badge with tooltip showing next claim time or "available to collect"
 */
import { useState, useRef, useEffect } from 'react';
import { formatTimeUntilClaim } from '../hooks/useCoins';

export function CoinBadge({ balance = 0, streak = 1, canClaim, nextClaim = 0, claimCoins, compact = false }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef(null);

  useEffect(() => {
    if (!showTooltip) return;
    const close = (e) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target)) setShowTooltip(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showTooltip]);

  const message = canClaim ? 'Available to collect!' : `Next claim in ${formatTimeUntilClaim(nextClaim)}`;

  return (
    <div className="relative flex items-center gap-2" ref={tooltipRef}>
      {canClaim && (
        <button
          onClick={claimCoins}
          className="flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 bg-gradient-to-r from-amber-400 to-orange-500 text-black text-[9px] sm:text-[10px] font-black uppercase tracking-tighter rounded-full shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all animate-coin-glow shrink-0"
        >
          <span className="hidden sm:inline">Claim 30 Coins</span>
          <span className="sm:hidden">+30 🪙</span>
        </button>
      )}
      <button
        type="button"
        onClick={() => setShowTooltip(!showTooltip)}
        className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors cursor-pointer"
      >
        <span className={compact ? 'text-xs sm:text-sm' : 'text-sm'}>🪙</span>
        <span className={`font-bold text-indigo-300 ${compact ? 'text-[10px] sm:text-[11px]' : 'text-[11px]'}`}>{balance}</span>
        <div className={`bg-white/10 mx-0.5 ${compact ? 'w-px h-2.5 sm:h-3' : 'w-px h-3'}`} />
        <span className={`font-medium text-white/40 ${compact ? 'text-[9px] sm:text-[10px]' : 'text-[10px]'}`}>🔥 {streak}d</span>
      </button>
      {showTooltip && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[100] px-3 py-2 rounded-lg bg-[#0d0f1c] border border-indigo-500/30 shadow-xl text-xs text-white whitespace-nowrap">
          {message}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-[#0d0f1c] border-l border-t border-indigo-500/30" />
        </div>
      )}
    </div>
  );
}
