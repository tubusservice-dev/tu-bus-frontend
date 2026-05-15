import { Injectable, inject } from '@angular/core';
import type { MessagePayload, Messaging } from 'firebase/messaging';
import { Observable, Subject } from 'rxjs';
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
  readonly onForegroundMessage$: Observable<MessagePayload> =
    this.foregroundSubject.asObservable();
  readonly onPushReceived$: Observable<PushEventData> =
    this.pushSubject.asObservable();

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
      const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');

      // The native plugin handles its own permission flow. Caller MUST
      // invoke from a user gesture so the OS shows the system prompt
      // (Android 13+ requires runtime POST_NOTIFICATIONS permission).
      const perm = await FirebaseMessaging.requestPermissions();
      if (perm.receive !== 'granted') return null;

      await this.attachNativeListeners();

      const result = await FirebaseMessaging.getToken();
      return result.token ?? null;
    } catch (err) {
      console.warn('[FirebaseMessaging] requestTokenNative failed:', err);
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
   * Subscribes to the Capacitor Firebase Messaging plugin's events.
   * Routes both `notificationReceived` (foreground) and
   * `notificationActionPerformed` (user tap) into `pushSubject` keyed by
   * the notification's `data` payload — same shape as the web SW
   * postMessage path so consumers do not branch.
   */
  private async attachNativeListeners(): Promise<void> {
    if (this.nativeListenersAttached) return;

    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');

    await FirebaseMessaging.addListener('notificationReceived', (event) => {
      const data = (event.notification.data as Record<string, string>) ?? {};
      this.pushSubject.next(data as PushEventData);
    });

    await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
      const data = (event.notification.data as Record<string, string>) ?? {};
      this.pushSubject.next(data as PushEventData);
    });

    this.nativeListenersAttached = true;
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
   * Bridge for pushes that arrive while the page is in background and
   * are handled by `firebase-messaging-sw.js`. The SW broadcasts the
   * payload to every open client via `postMessage`; this listener
   * funnels those messages into the same `pushReceived$` stream so
   * consumers don't need to care which path the push took.
   */
  private attachSwMessageListener(): void {
    if (this.swListenerAttached) return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
      if (!isFcmSwMessage(event.data)) return;
      this.pushSubject.next(event.data.payload);
    });
    this.swListenerAttached = true;
  }
}
