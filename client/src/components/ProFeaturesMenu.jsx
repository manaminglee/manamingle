/**
 * ProFeaturesMenu – Lists Phase 3 Pro features (paid subscription)
 */
import { useState } from 'react';
import { ProBadge } from './ProFeatureGate';
import { PHASE_3_PRO } from '../constants/features';

const PRO_FEATURE_LABELS = {
  aiMoodDetection: 'AI Mood Detection',
  reconnectToken: 'Reconnect Token',
  miniChatGames: 'Mini Chat Games',
};

const PRO_FEATURE_DESC = {
  aiMoodDetection: 'Detect conversation vibe in real-time',
  reconnectToken: 'Reconnect with the same stranger',
  miniChatGames: 'Play quick games while chatting',
};

export function ProFeaturesMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1 rounded-lg text-[10px] font-bold text-indigo-400 border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 transition-all"
      >
        ✨ Pro Features
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[150]" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full right-0 mb-2 z-[151] w-64 p-4 rounded-2xl bg-[#0d0f1c] border border-indigo-500/20 shadow-2xl animate-slide-in-up">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Pro Features</h4>
              <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white text-lg leading-none">×</button>
            </div>
            <div className="space-y-2">
              {Object.keys(PHASE_3_PRO).map((key) => (
                <div key={key} className="flex items-center justify-between gap-2 py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-xs font-medium text-white">{PRO_FEATURE_LABELS[key]}</p>
                    <p className="text-[10px] text-white/50">{PRO_FEATURE_DESC[key]}</p>
                  </div>
                  <ProBadge />
                </div>
              ))}
            </div>
            <p className="text-[10px] text-white/40 mt-3">Upgrade to Pro to unlock</p>
          </div>
        </>
      )}
    </div>
  );
}
