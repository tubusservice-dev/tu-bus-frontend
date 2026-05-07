/**
 * TuBus Express — Service Worker
 *
 * Strategy: NETWORK-ONLY pass-through.
 *
 * This SW exists for ONE reason: PWA installability. The browser requires
 * a registered Service Worker with a fetch handler to mark the app as
 * installable. We must NEVER cache responses because:
 *   - Inventory and stock are real-time and must always be fresh.
 *   - Order/payment flows cannot tolerate stale data.
 *   - Pricing depends on the BCV exchange rate, updated daily via cron.
 *
 * Update lifecycle: skipWaiting + clients.claim ensure new SW versions
 * activate immediately on next page load — no stale shell ever served.
 */

const SW_VERSION = '1.0.0';

self.addEventListener('install', () => {
  // Activate immediately on first install. Subsequent updates also take
  // effect on the next page load without waiting for all tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Defensive cleanup: wipe any caches a previous SW version may have
      // created. This guarantees a clean slate on every deploy.
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      // Take control of any open clients (tabs) without requiring reload.
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  // Pure pass-through — go to network for every request, no caching.
  // Required for installability per Chromium PWA criteria.
  event.respondWith(fetch(event.request));
});

// Allow the app to trigger an immediate activation of a waiting SW
// (used by PwaService.applyUpdate()).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

/**
 * Notification click — focus an existing app tab if any, else open one.
 * The target URL travels in `notification.data.url` (set by `browserNotify`
 * on the page side). Required because mobile Chrome routes notifications
 * shown via `registration.showNotification()` through this handler — the
 * page-side `onclick` callback is unavailable in that path.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl =
    (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      // Reuse the first focusable tab on this origin.
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(targetUrl);
            } catch {
              // navigate() may reject across navigations the browser
              // considers cross-origin; the focused tab is enough.
            }
          }
          return;
        }
      }

      // No open tab — pop a new one.
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
