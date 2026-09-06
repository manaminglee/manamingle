/**
 * Client helpers — subscribe to web push and handle SW update prompts.
 */
import { API_BASE } from '../config/apiBase';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export async function fetchPushPublicKey() {
  try {
    const res = await fetch(`${API_BASE}/api/push/vapid-public`, { credentials: 'include' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function subscribeToPush({ ownerKey, audioToken } = {}) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, error: 'Push not supported' };
  }
  const cfg = await fetchPushPublicKey();
  if (!cfg?.enabled || !cfg.publicKey) return { ok: false, error: 'Push not configured' };

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, error: 'Permission denied' };

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(cfg.publicKey),
    });
  }

  const headers = { 'Content-Type': 'application/json' };
  if (audioToken) headers['X-Audio-Token'] = audioToken;

  const res = await fetch(`${API_BASE}/api/push/subscribe`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ subscription: sub.toJSON(), ownerKey }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error || 'Subscribe failed' };
  return { ok: true, subscription: sub };
}

export function watchServiceWorkerUpdates(onUpdate) {
  if (!('serviceWorker' in navigator)) return () => {};
  let refreshing = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    onUpdate?.('reloaded');
  });

  const check = async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) return;
      await reg.update();
      if (reg.waiting && navigator.serviceWorker.controller) {
        onUpdate?.('waiting', reg);
      }
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            onUpdate?.('waiting', reg);
          }
        });
      });
    } catch { /* offline */ }
  };

  void check();
  const t = setInterval(check, 60_000);
  return () => clearInterval(t);
}

export function activateWaitingWorker(reg) {
  reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
}
