/**
 * Anonymous-safe debug logging (no PII). Enable with:
 * - URL: ?debug=1 or ?mm_debug=1
 * - sessionStorage: mm_debug = "1"
 * - localStorage: mm_debug = "1" (persists; clear in devtools if needed)
 */
export function isMmDebugEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    if (sessionStorage.getItem('mm_debug') === '1') return true;
    if (localStorage.getItem('mm_debug') === '1') return true;
    const q = new URLSearchParams(window.location.search);
    if (q.get('debug') === '1' || q.get('mm_debug') === '1') return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function mmDebug(tag, ...args) {
  if (!isMmDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log(`[MM:${tag}]`, ...args);
}
