import { memo, useEffect, useState } from 'react';
import { activateWaitingWorker } from '../utils/pushNotifications';

/**
 * Shown when a new service worker is waiting — one tap to refresh.
 */
export const PwaUpdatePrompt = memo(function PwaUpdatePrompt({ registration, onDismiss }) {
  const [visible, setVisible] = useState(!!registration);

  useEffect(() => {
    setVisible(!!registration);
  }, [registration]);

  if (!visible || !registration?.waiting) return null;

  return (
    <div className="pwa-update" role="status">
      <p className="pwa-update__text">A new version of Helloooo is ready.</p>
      <button
        type="button"
        className="pwa-update__btn"
        onClick={() => {
          activateWaitingWorker(registration);
          setVisible(false);
          onDismiss?.();
        }}
      >
        Update now
      </button>
      <button type="button" className="pwa-update__dismiss" onClick={() => { setVisible(false); onDismiss?.(); }} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
});

export default PwaUpdatePrompt;
