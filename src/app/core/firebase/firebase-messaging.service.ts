import { Injectable } from '@angular/core';
import type { MessagePayload, Messaging } from 'firebase/messaging';
import { Observable, Subject } from 'rxjs';
import { environment } from '@env';
import { getFirebaseApp } from './firebase.config';

/**
 * Lazy-loaded wrapper over `firebase/messaging`.
 *
 * The Firebase SDK is split into a separate async chunk via dynamic
 * `import()` — the only runtime references to `firebase/messaging`
 * happen here, behind methods that are themselves only invoked AFTER
 * a successful login. Type-only imports above (`import type`) are
 * erased at compile time and do NOT pull the SDK into the bundle.
 *
 * Responsibilities:
 *  - Lazy-init the Messaging instance the first time push is requested.
 *  - Expose `requestToken()` for FCM token retrieval.
 *  - Expose `onForegroundMessage$` for handling pushes when the app is open.
 *
 * Token persistence on the backend is NOT this service's responsibility —
 * UserNotificationService and AdminNotificationsService own that lifecycle.
 */
@Injectable({ providedIn: 'root' })
export class FirebaseMessagingService {
  private messagingPromise: Promise<Messaging> | null = null;
  private foregroundListenerAttached = false;
  private readonly foregroundSubject = new Subject<MessagePayload>();
  readonly onForegroundMessage$: Observable<MessagePayload> =
    this.foregroundSubject.asObservable();

  /**
   * Returns the FCM token for this browser, or null if:
   *  - The platform does not support Web Push (iOS Safari without PWA).
   *  - User denied permission.
   *  - Service Worker registration failed.
   *  - Firebase rejected the request (network error, project misconfig).
   *
   * Wires up the foreground onMessage listener on first successful call.
   */
  async requestToken(): Promise<string | null> {
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
      console.warn('[FirebaseMessaging] requestToken failed:', err);
      return null;
    }
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
   * Quick capability check — does the browser support Web Push at all?
   * Use before requesting permission so the UI can hide the prompt
   * gracefully on unsupported platforms (iOS Safari without PWA).
   *
   * Synchronous and dependency-free: callable during the initial bundle
   * without forcing the SDK chunk to load.
   */
  isMessagingSupportedSync(): boolean {
    if (typeof window === 'undefined') return false;
    if (!('Notification' in window)) return false;
    if (!('serviceWorker' in navigator)) return false;
    if (!('PushManager' in window)) return false;
    return true;
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
    });
    this.foregroundListenerAttached = true;
  }
}
