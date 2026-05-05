import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from '@env';

bootstrapApplication(App, appConfig)
  .then(() => registerServiceWorker())
  .catch((err) => console.error(err));

/**
 * Registers the network-only Service Worker so the app is installable
 * as a PWA. The SW does not cache responses — it exists solely to meet
 * the installability criteria; e-commerce data must always be fresh
 * (inventory, orders, payments are real-time).
 *
 * Gating rules:
 *   1. Browser must support Service Workers.
 *   2. Production build only — avoids clashing with the dev server's HMR.
 *   3. Mobile / tablet only — by product decision the PWA is offered to
 *      touch devices exclusively. Skipping registration on desktop also
 *      hides Chrome's address-bar install icon, since installability
 *      requires a registered SW.
 *
 * Registration is delayed until after Angular bootstraps and the load
 * event fires so it never competes with critical resources during the
 * first paint.
 */
function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  if (!environment.production) return;
  if (!isMobileOrTablet()) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => console.error('[PWA] SW registration failed:', err));
  });
}

/**
 * Returns true on phones and tablets, false on desktops/laptops.
 *
 * Uses the `pointer: coarse` media query as the primary signal:
 *   - coarse → primary input is touch (phone, tablet, hybrid in tablet mode)
 *   - fine   → primary input is a mouse / trackpad (desktop, laptop)
 *
 * This is more reliable than user-agent sniffing — it tracks how the
 * user actually interacts with the device, not what the device claims
 * to be. Desktops with touchscreens still report `pointer: fine` because
 * the OS treats the mouse as primary, so they are correctly excluded.
 */
function isMobileOrTablet(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(pointer: coarse)').matches;
}
