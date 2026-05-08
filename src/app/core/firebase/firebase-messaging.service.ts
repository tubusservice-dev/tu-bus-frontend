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

      // The Firebase Messaging SW must already be registered. Pass the
      // registration explicitly to avoid the SDK auto-registering with
      // a wrong scope when the page is served from a non-root path.
      const swReg = await navigator.serviceWorker.getRegistration(
        '/firebase-cloud-messaging-push-scope'
      );

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
