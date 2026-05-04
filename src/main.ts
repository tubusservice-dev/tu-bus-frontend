import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

bootstrapApplication(App, appConfig)
  .then(() => registerServiceWorker())
  .catch((err) => console.error(err));

/**
 * Registers the network-only Service Worker so the app is installable
 * as a PWA. The SW does not cache responses — it exists solely to meet
 * the installability criteria; e-commerce data must always be fresh
 * (inventory, orders, payments are real-time).
 *
 * Registration is delayed until after Angular bootstraps and the load
 * event fires so it never competes with critical resources during the
 * first paint. Disabled in development to avoid HMR caching conflicts
 * with the dev server.
 */
function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  if (!environment.production) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => console.error('[PWA] SW registration failed:', err));
  });
}
