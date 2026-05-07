/**
 * Browser-notification helper that picks the API the current environment
 * actually allows.
 *
 * Why this exists:
 *   On mobile devices with an active Service Worker (Chrome Android, etc.)
 *   the `new Notification(...)` constructor throws
 *   `TypeError: Failed to construct 'Notification': Illegal constructor`.
 *   The browser only allows `ServiceWorkerRegistration.showNotification()`
 *   in that scenario. Desktop, dev mode, and devices without SW continue
 *   to support the classic constructor.
 *
 * This helper auto-detects the SW registration and falls back gracefully,
 * so the same call site works across every supported platform.
 *
 * Click handling: when shown via the SW path, the `onclick` callback of
 * the constructor is unavailable. Embed the target URL inside
 * `options.data.url` and let `sw.js` handle the click (`notificationclick`
 * listener) — the SW will focus an existing tab or open a new one.
 */
export async function browserNotify(
  title: string,
  options: NotificationOptions = {},
): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  // Prefer Service Worker registration when available — this is the ONLY
  // path that works on mobile Chrome with an active SW, and it works fine
  // on desktop too. Falling back to the constructor only when there is no
  // registration (dev mode, desktop in production, browsers without SW).
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, options);
        return;
      }
    } catch (err) {
      // Don't silence — surface the reason so future regressions are visible.
      console.warn('[browserNotify] showNotification failed, falling back to constructor', err);
    }
  }

  try {
    // eslint-disable-next-line no-new
    new Notification(title, options);
  } catch (err) {
    console.warn('[browserNotify] Notification constructor failed', err);
  }
}
