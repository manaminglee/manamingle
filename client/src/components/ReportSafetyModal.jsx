import { useState } from 'react';

const REASONS = [
  { id: 'harassment', label: 'Harassment or hate' },
  { id: 'sexual', label: 'Sexual or explicit content' },
  { id: 'spam', label: 'Spam or scams' },
  { id: 'minor_safety', label: 'Minor safety concern' },
  { id: 'other', label: 'Other' },
];

/**
 * Report + optional block. Calls onSubmit({ reason, block, targetSocketId? }) then onClose.
 */
export function ReportSafetyModal({ open, onClose, onSubmit, title = 'Report user', subtitle = 'Reports are reviewed. You can also block this user from matching you again.', prepend }) {
  const [reason, setReason] = useState('harassment');
  const [alsoBlock, setAlsoBlock] = useState(true);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0c0e14] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-black uppercase tracking-wide text-white mb-1">{title}</h3>
        <p className="text-[11px] text-white/45 leading-relaxed mb-5">{subtitle}</p>

        {prepend}

        <label className="block text-[10px] font-black uppercase tracking-widest text-white/35 mb-2">Reason</label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full mb-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-rose-500/40"
        >
          {REASONS.map((r) => (
            <option key={r.id} value={r.id} className="bg-[#111]">
              {r.label}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-3 cursor-pointer mb-6">
          <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} className="rounded border-white/20" />
          <span className="text-[12px] text-white/70">Also block from future matches (this device / IP pair)</span>
        </label>

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-2xl border border-white/10 py-3 text-[11px] font-black uppercase text-white/50 hover:bg-white/5">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSubmit?.({ reason, block: alsoBlock });
              onClose?.();
            }}
            className="flex-1 rounded-2xl bg-rose-600 py-3 text-[11px] font-black uppercase text-white hover:bg-rose-500"
          >
            Submit report
          </button>
        </div>
      </div>
    </div>
  );
}
