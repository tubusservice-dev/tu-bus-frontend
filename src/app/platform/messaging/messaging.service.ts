import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Normalised payload of an incoming push notification, abstracted from the
 * Firebase web SDK and Capacitor Firebase Messaging plugin. Both backends
 * map their native shape to this so the consumer never needs to branch.
 */
export interface PushPayload {
  /** Title shown in the OS toast / notification tray. */
  title?: string;

  /** Body text shown in the OS toast / notification tray. */
  body?: string;

  /**
   * Free-form data dictionary set by the backend (FCM `data` field).
   * Used to convey domain-specific context the client must react to —
   * `url` for navigation, `relatedOrder` for order detail refresh, etc.
   */
  data: Record<string, string>;
}

export interface IMessaging {
  /**
   * Quick capability check. Returns true when the platform supports push
   * notifications. Web: `Notification` + `serviceWorker` + `PushManager`
   * present. Native: always true on supported devices.
   */
  isSupported(): boolean;

  /**
   * Requests notification permission from the user (must be invoked from
   * a user gesture for browsers to honour). Returns the resulting state.
   */
  requestPermission(): Promise<'granted' | 'denied' | 'default' | 'unsupported'>;

  /**
   * Returns the FCM registration token for the current device, or null
   * when permission is denied / the platform is unsupported.
   */
  getToken(): Promise<string | null>;

  /**
   * Stream of push payloads received while the app is in the foreground
   * AND while it is in the background (the latter only on native — on
   * web the SW handles background and re-broadcasts via postMessage).
   */
  onPushReceived$(): Observable<PushPayload>;

  /**
   * Removes the FCM token registration on the device. Called by AuthService
   * during logout, before the JWT is cleared, so the DELETE on the backend
   * still travels with valid auth.
   */
  deleteToken(): Promise<void>;
}

export const MESSAGING = new InjectionToken<IMessaging>('PLATFORM_MESSAGING');
