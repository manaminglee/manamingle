/**
 * ProFeatureGate – Wraps Phase 3 (Pro) features
 * Pro = paid subscription (real money), not coins
 */
import { PHASE_3_PRO } from '../constants/features';

export function ProFeatureGate({ feature, isProUser = false, children, fallback }) {
  const unlocked = isProUser;

  if (unlocked) return children;

  if (fallback) return fallback;

  return (
    <div className="relative group">
      <div className="opacity-50 pointer-events-none select-none blur-[1px]">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="px-4 py-2 rounded-xl bg-indigo-500/20 border border-indigo-500/40 backdrop-blur-sm text-center">
          <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">Pro</span>
          <p className="text-[10px] text-white/60 mt-0.5">Upgrade to Pro</p>
        </div>
      </div>
    </div>
  );
}

/** Pro badge for feature lists */
export function ProBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
      PRO
    </span>
  );
}
