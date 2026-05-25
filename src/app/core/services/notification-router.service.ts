import { Injectable, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
import { FirebaseMessagingService } from '@core/firebase';

/**
 * Centralises the navigation reaction to a notification tap.
 *
 * The backend stamps every push with a `data.url` that points at the
 * deep destination (e.g. `/perfil/pedidos/:id?openMessages=1`). When the
 * user taps the notification, the platform-specific channel surfaces the
 * event via `FirebaseMessagingService.notificationTap$`:
 *
 *   - Web PWA  → Service Worker postMessage('fcm-notification-click').
 *   - Android  → Capacitor plugin event `notificationActionPerformed`.
 *
 * This service subscribes to the unified tap stream and dispatches the
 * Angular Router. The destination component is responsible for honouring
 * any query params (e.g. `openMessages=1` triggers `openMessaging()` in
 * `order-detail`); this service does not own that logic — separation of
 * concerns.
 *
 * Cold-start safety: `notificationTap$` is backed by a `ReplaySubject(1)`,
 * so a tap that fires before this service subscribes (the bootstrap race)
 * is replayed to the first subscriber. The very early `inject()` from
 * `app.config.ts` initialisation guarantees we are subscribed before the
 * Router has any chance to navigate via app code.
 *
 * Why not inside `DeepLinksService`: that service handles App Links
 * (`App.appUrlOpen`) which arrive from the OS when a user clicks an
 * `https://tubusexpress.com/...` URL elsewhere. Notification taps are a
 * different channel with different lifecycle and consumers — mixing them
 * couples two unrelated concerns.
 */
@Injectable({ providedIn: 'root' })
export class NotificationRouterService {
  private readonly fcm = inject(FirebaseMessagingService);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private started = false;

  /**
   * Idempotent bootstrap. Safe to call multiple times — subsequent calls
   * are no-ops. Invoked once during `APP_INITIALIZER` so the subscription
   * is alive before any navigation can happen.
   *
   * Order of operations matters:
   *   1. Attach native plugin listeners FIRST. The Android plugin retains
   *      the cold-start tap event in an internal queue with
   *      `retainUntilConsumed = true`. Until a listener is attached, the
   *      event sits there indefinitely — that was the bug that made taps
   *      "just open the app" without navigating.
   *   2. Subscribe to `notificationTap$`. The ReplaySubject(1) inside the
   *      service guarantees that the very first event the plugin
   *      delivers (which may fire synchronously after step 1) is captured
   *      and replayed to this subscriber.
   */
  start(): void {
    if (this.started) return;
    this.started = true;

    console.log('[NotificationRouter] start() — bootstrap');

    // Fire-and-forget. We don't block APP_INITIALIZER on this because
    // the dynamic import + addListener may take a few hundred ms; the
    // ReplaySubject already covers the race.
    void this.fcm.attachNativeListeners();

    this.fcm.notificationTap$.subscribe((data) => {
      console.log('[NotificationRouter] tap event:', data);
      const targetUrl = data?.url;
      if (!targetUrl || typeof targetUrl !== 'string') return;
      // Tap events from native/SW channels run outside the Angular zone
      // on some platforms; explicitly enter the zone so the router triggers
      // change detection and the destination component initialises normally.
      this.zone.run(() => {
        console.log('[NotificationRouter] navigating to:', targetUrl);
        this.router.navigateByUrl(targetUrl).catch((err) => {
          console.warn('[NotificationRouter] navigation failed:', err);
          /* Silent: the URL may be transiently invalid (e.g. order deleted
             between push dispatch and tap). The tray notification has
             already disappeared at this point. */
        });
      });
    });
  }
}
