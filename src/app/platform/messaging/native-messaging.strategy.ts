import { Observable, Subject, from, switchMap } from 'rxjs';
import { IMessaging, PushPayload } from './messaging.service';

/**
 * Native messaging strategy: uses `@capacitor-firebase/messaging` which
 * binds to the native FCM SDK (Android: `firebase-messaging`).
 *
 * The plugin emits `notificationReceived` for foreground pushes and
 * `notificationActionPerformed` when the user taps a notification. We
 * route both into a single `pushSubject` keyed by their `data` field so
 * consumers see a uniform stream regardless of the path.
 *
 * Token lifecycle: `getToken` returns the FCM registration token, which
 * the caller persists on the backend via DeviceTokenService. `deleteToken`
 * removes the token at the device level, called during logout.
 */
export class NativeMessagingStrategy implements IMessaging {
  private readonly pushSubject = new Subject<PushPayload>();
  private listenersAttached = false;

  isSupported(): boolean {
    // Native devices support push by definition (FCM is available on every
    // Android with Google Play Services). Capability checks should be done
    // by querying actual permission state via requestPermission().
    return true;
  }

  async requestPermission(): Promise<'granted' | 'denied' | 'default' | 'unsupported'> {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    const result = await FirebaseMessaging.requestPermissions();
    return result.receive as 'granted' | 'denied' | 'default';
  }

  async getToken(): Promise<string | null> {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    await this.attachListeners();
    try {
      const result = await FirebaseMessaging.getToken();
      return result.token ?? null;
    } catch {
      return null;
    }
  }

  onPushReceived$(): Observable<PushPayload> {
    // Lazily attach listeners on first subscription so the plugin is only
    // imported when push is actually requested. Wrapping in `from` lets us
    // await the import inside an observable pipeline.
    return from(this.attachListeners()).pipe(switchMap(() => this.pushSubject));
  }

  async deleteToken(): Promise<void> {
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
    await FirebaseMessaging.deleteToken();
  }

  /**
   * Wires up the two plugin event listeners exactly once. Subsequent calls
   * are no-ops so it's safe to invoke from multiple lazy entry points.
   */
  private async attachListeners(): Promise<void> {
    if (this.listenersAttached) return;
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');

    // Foreground push — the OS shows nothing automatically; the consumer
    // decides whether to surface a local notification or just refresh UI.
    await FirebaseMessaging.addListener('notificationReceived', (event) => {
      this.pushSubject.next({
        title: event.notification.title,
        body: event.notification.body,
        data: (event.notification.data as Record<string, string>) ?? {},
      });
    });

    // User tapped a notification (foreground or background). The OS already
    // showed the toast; this handler routes the click action.
    await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
      this.pushSubject.next({
        title: event.notification.title,
        body: event.notification.body,
        data: (event.notification.data as Record<string, string>) ?? {},
      });
    });

    this.listenersAttached = true;
  }
}
