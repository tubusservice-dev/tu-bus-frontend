import { Observable, map } from 'rxjs';
import { FirebaseMessagingService } from '@core/firebase';
import { IMessaging, PushPayload } from './messaging.service';

/**
 * Web messaging strategy: thin wrapper over the existing
 * `FirebaseMessagingService` (which uses the Firebase web SDK + Service
 * Workers). The wrapper exists so the consumer code uses the platform
 * abstraction uniformly; it does NOT change web behaviour.
 *
 * Note: the existing FirebaseMessagingService remains untouched and keeps
 * being used directly by `UserNotificationService` / `AdminNotificationsService`.
 * Only the abstraction gives Phase 4 the option to switch the consumers
 * to the abstract API at its own pace without breaking anything.
 *
 * The FirebaseMessagingService dependency is passed via constructor
 * (instead of `inject()`) because the factory in `platform.providers.ts`
 * instantiates this class with `new`, outside an injection context.
 */
export class WebMessagingStrategy implements IMessaging {
  constructor(private readonly fcm: FirebaseMessagingService) {}

  isSupported(): boolean {
    return this.fcm.isMessagingSupportedSync();
  }

  async requestPermission(): Promise<'granted' | 'denied' | 'default' | 'unsupported'> {
    if (!this.isSupported()) return 'unsupported';
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {
        // Some browsers reject the prompt request when not invoked from a
        // user gesture; surface whatever state the browser settled into.
      }
    }
    return Notification.permission;
  }

  async getToken(): Promise<string | null> {
    return this.fcm.requestToken();
  }

  onPushReceived$(): Observable<PushPayload> {
    return this.fcm.onPushReceived$.pipe(
      map((raw) => {
        // FCM web SDK emits `Record<string, string | undefined>` (the
        // service worker forwards data fields verbatim and TypeScript
        // models them as possibly missing). PushPayload guarantees
        // `Record<string, string>` for downstream consumers, so strip
        // undefined values defensively.
        const cleaned: Record<string, string> = {};
        for (const [key, value] of Object.entries(raw)) {
          if (typeof value === 'string') cleaned[key] = value;
        }
        return { data: cleaned };
      }),
    );
  }

  async deleteToken(): Promise<void> {
    // The web SDK exposes deleteToken via the Messaging instance, but
    // the existing wrapper does not expose a method for it. The backend
    // unregister (DELETE /api/device-tokens/:token) handled in AuthService
    // is sufficient — keeping this as no-op to avoid touching the existing
    // FirebaseMessagingService. Phase 4 can wire the full delete if needed.
  }
}
