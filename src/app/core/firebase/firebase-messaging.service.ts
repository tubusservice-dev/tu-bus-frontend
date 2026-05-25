import { Injectable, inject } from '@angular/core';
import type { MessagePayload, Messaging } from 'firebase/messaging';
import { Observable, ReplaySubject, Subject } from 'rxjs';
import { environment } from '@env';
import { PlatformService } from '@platform';
import { getFirebaseApp } from './firebase.config';
import { isFcmSwMessage, PushEventData } from './push-event.types';

/**
 * Lazy-loaded wrapper over `firebase/messaging` (web) and
 * `@capacitor-firebase/messaging` (native).
 *
 * Strategy: a single facade so consumers (UserNotificationService,
 * AdminNotificationsService) keep the same API across platforms. Internally
 * the methods branch on `PlatformService.isNative()`:
 *   - Web: uses the Firebase web SDK + Service Workers + VAPID. Service
 *     Worker `firebase-messaging-sw.js` handles background pushes and
 *     forwards to the page via postMessage (consumed by `attachSwMessageListener`).
 *   - Native: uses `@capacitor-firebase/messaging` plugin. Native FCM
 *     SDK handles background pushes and surfaces them via plugin events.
 *
 * Both paths feed the same `pushSubject` so consumers do not branch.
 *
 * Type-only imports above (`import type`) are erased at compile time and
 * do NOT pull the SDK into the bundle. Real `firebase/messaging` import
 * happens dynamically inside `getMessagingInstance()` — only loaded when
 * the user actually requests push permission on web.
 *
 * Token persistence on the backend is NOT this service's responsibility —
 * UserNotificationService and AdminNotificationsService own that lifecycle.
 */
@Injectable({ providedIn: 'root' })
export class FirebaseMessagingService {
  private readonly platform = inject(PlatformService);
  private messagingPromise: Promise<Messaging> | null = null;
  private foregroundListenerAttached = false;
  private swListenerAttached = false;
  private nativeListenersAttached = false;
  private readonly foregroundSubject = new Subject<MessagePayload>();
  /**
   * Unified push stream — emits whenever a push reaches this tab, no
   * matter whether it arrived via the SDK's foreground `onMessage` or
   * via the background Service Worker forwarding the payload through
   * `postMessage`. Components that need to react to a push (e.g. the
   * order-detail screen refreshing on a new comment) should subscribe
   * to this, not to `onForegroundMessage$`.
   */
  private readonly pushSubject = new Subject<PushEventData>();
  /**
   * Cold-start safe channel for "user tapped a notification" events.
   *
   * Uses `ReplaySubject(1)` so that a tap arriving BEFORE any subscriber
   * is registered (typical when the app boots from a tap on a system
   * notification) is replayed to the first subscriber instead of being
   * dropped. The `NotificationRouterService` consumes this stream and
   * navigates the Router accordingly.
   *
   * Separate from `pushSubject` because the consumer reactions differ
   * fundamentally:
   *  - Push received in background → refresh UI silently, light unread dot.
   *  - User tapped a notification  → navigate to destination, open modal.
   */
  private readonly tapSubject = new ReplaySubject<PushEventData>(1);
  readonly onForegroundMessage$: Observable<MessagePayload> =
    this.foregroundSubject.asObservable();
  readonly onPushReceived$: Observable<PushEventData> =
    this.pushSubject.asObservable();
  readonly notificationTap$: Observable<PushEventData> =
    this.tapSubject.asObservable();

  constructor() {
    this.attachSwMessageListener();
  }

  /**
   * Returns the FCM token for this device.
   *
   * Native (Android): uses `@capacitor-firebase/messaging` plugin which
   * binds to the native FCM SDK. The plugin handles permission +
   * registration internally — no Service Workers, no VAPID needed.
   *
   * Web: uses Firebase web SDK + Service Worker + VAPID (legacy path).
   * Returns null if:
   *  - The platform does not support Web Push (iOS Safari without PWA).
   *  - User denied permission.
   *  - Service Worker registration failed.
   *  - Firebase rejected the request (network error, project misconfig).
   *
   * Wires up foreground listeners on first successful call.
   */
  async requestToken(): Promise<string | null> {
    if (this.platform.isNative()) {
      return this.requestTokenNative();
    }
    return this.requestTokenWeb();
  }

  private async requestTokenNative(): Promise<string | null> {
    try {
      console.log('[FCM-Native] importing @capacitor-firebase/messaging...');
      const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
      console.log('[FCM-Native] plugin loaded, requesting permissions...');

      // The native plugin handles its own permission flow. Caller MUST
      // invoke from a user gesture so the OS shows the system prompt
      // (Android 13+ requires runtime POST_NOTIFICATIONS permission).
      const perm = await FirebaseMessaging.requestPermissions();
      console.log('[FCM-Native] requestPermissions result:', JSON.stringify(perm));
      if (perm.receive !== 'granted') {
        console.warn('[FCM-Native] Permission not granted:', perm.receive);
        return null;
      }

      await this.attachNativeListeners();
      console.log('[FCM-Native] listeners attached, getting token...');

      const result = await FirebaseMessaging.getToken();
      console.log('[FCM-Native] getToken result:', result.token ? 'token-OK' : 'null');
      return result.token ?? null;
    } catch (err) {
      console.error('[FCM-Native] requestTokenNative failed:', err);
      return null;
    }
  }

  private async requestTokenWeb(): Promise<string | null> {
    if (!this.isMessagingSupportedSync()) return null;

    try {
      const { getToken } = await import('firebase/messaging');
      const messaging = await this.getMessagingInstance();

      // Explicitly register the FCM SW with its own scope. Critical inside
      // an installed PWA: the PWA `/sw.js` already controls scope '/', so
      // a generic `getRegistration('/firebase-cloud-messaging-push-scope')`
      // would return THAT SW, and getToken() would bind the token to it.
      // Since `/sw.js` has no `push` handler, every notification would be
      // silently swallowed — that's why pushes worked on the regular web
      // but NOT inside the installed PWA.
      const swReg = await this.ensureFcmServiceWorker();

      const token = await getToken(messaging, {
        vapidKey: environment.fcmVapidKey,
        serviceWorkerRegistration: swReg,
      });

      if (!token) return null;

      await this.attachForegroundListener();
      return token;
    } catch (err) {
      console.warn('[FirebaseMessaging] requestTokenWeb failed:', err);
      return null;
    }
  }

  /**
   * Attaches the Capacitor Firebase Messaging plugin listeners.
   *
   * MUST be called at bootstrap time (via APP_INITIALIZER), not lazily on
   * `requestToken()`. The Android plugin retains the
   * `notificationActionPerformed` event in an internal queue with
   * `retainUntilConsumed = true`, but only delivers it to JS once a
   * listener is attached. If the user opens the app from a cold-start
   * tap and we only attach listeners when they manually opt-in to push,
   * the tap event sits in the plugin queue forever — the app appears
   * to "just open" without navigating to the deep target.
   *
   * Idempotent: subsequent calls are no-ops thanks to the guard.
   *
   *  - `notificationReceived`         → emitted on `pushSubject` (foreground
   *    delivery while the user is inside the app; consumer refreshes UI
   *    silently, lights the unread dot).
   *  - `notificationActionPerformed`  → emitted on `tapSubject` (user
   *    explicitly tapped a notification; consumer must navigate to the
   *    target URL and open the relevant modal).
   *
   * Why separate streams: the two actions have opposite UX intents. A
   * background push that triggers a tap was already routed by the OS to
   * the tray — the user picked it up later. A foreground push is silent
   * data that should NOT navigate or interrupt the current screen.
   */
  async attachNativeListeners(): Promise<void> {
    if (this.nativeListenersAttached) return;
    if (!this.platform.isNative()) return;

    console.log('[FCM-Native] Attaching listeners on bootstrap...');
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');

    await FirebaseMessaging.addListener('notificationReceived', (event) => {
      const data = (event.notification.data as Record<string, string>) ?? {};
      console.log('[FCM-Native] notificationReceived:', data);
      this.pushSubject.next(data as PushEventData);
    });

    await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
      const data = (event.notification.data as Record<string, string>) ?? {};
      console.log('[FCM-Native] notificationActionPerformed (TAP):', data);
      this.tapSubject.next(data as PushEventData);
    });

    this.nativeListenersAttached = true;
    console.log('[FCM-Native] Listeners attached.');
  }

  /**
   * Find or register the Firebase Messaging SW under its dedicated scope.
   *
   * Lookup is by the SW's actual `scriptURL`, not by `getRegistration(path)`,
   * because the latter returns whichever SW currently controls the requested
   * path — which is the PWA `/sw.js` when installed.
   */
  private async ensureFcmServiceWorker(): Promise<ServiceWorkerRegistration | undefined> {
    if (!('serviceWorker' in navigator)) return undefined;

    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
      const url = reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL;
      if (url && url.endsWith('/firebase-messaging-sw.js')) {
        // Force the browser to revalidate the SW script in case nginx (or
        // a previous deploy) cached an old version that handles push wrong.
        try {
          await reg.update();
        } catch {
          /* ignore update failures — registration is still usable */
        }
        return reg;
      }
    }

    try {
      // `updateViaCache: 'none'` bypasses HTTP cache for the SW script
      // every time the browser checks for updates. Critical because a
      // stale SW silently swallows push events when the app is closed.
      return await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/firebase-cloud-messaging-push-scope/',
        updateViaCache: 'none',
      });
    } catch (err) {
      console.warn('[FirebaseMessaging] Failed to register FCM SW:', err);
      return undefined;
    }
  }

  /**
   * Quick capability check — can the device receive push notifications?
   *
   * Native: always true. The Capacitor Firebase Messaging plugin works on
   * every Android with Google Play Services (essentially all consumer
   * Androids in our target market).
   *
   * Web: requires `Notification`, `serviceWorker` and `PushManager` APIs.
   * Excludes iOS Safari without PWA installation, ancient browsers, etc.
   *
   * Synchronous and dependency-free: callable during the initial bundle
   * without forcing the SDK chunk to load.
   */
  isMessagingSupportedSync(): boolean {
    if (this.platform.isNative()) return true;
    return (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    );
  }

  private getMessagingInstance(): Promise<Messaging> {
    if (!this.messagingPromise) {
      this.messagingPromise = (async () => {
        const { getMessaging } = await import('firebase/messaging');
        const app = await getFirebaseApp();
        return getMessaging(app);
      })();
    }
    return this.messagingPromise;
  }

  private async attachForegroundListener(): Promise<void> {
    if (this.foregroundListenerAttached) return;
    const { onMessage } = await import('firebase/messaging');
    const messaging = await this.getMessagingInstance();
    onMessage(messaging, (payload) => {
      this.foregroundSubject.next(payload);
      const data = (payload.data || {}) as PushEventData;
      this.pushSubject.next(data);
    });
    this.foregroundListenerAttached = true;
  }

  /**
   * Bridge for events that arrive from `firebase-messaging-sw.js` via
   * `postMessage`. The SW broadcasts two distinct event types:
   *
   *  - `'fcm-push'`              → background data push received. Funneled
   *    into `pushSubject` so the open tab can refresh its UI silently.
   *  - `'fcm-notification-click'`→ user tapped the notification in the OS
   *    tray. Funneled into `tapSubject` (ReplaySubject) so the router can
   *    navigate even if the listener attaches AFTER the message arrived
   *    (cold-start race: SW posts the message before any component has
   *    subscribed).
   */
  private attachSwMessageListener(): void {
    if (this.swListenerAttached) return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
      if (!isFcmSwMessage(event.data)) return;
      if (event.data.type === 'fcm-notification-click') {
        this.tapSubject.next(event.data.payload);
      } else {
        this.pushSubject.next(event.data.payload);
      }
    });
    this.swListenerAttached = true;
  }
}
