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
