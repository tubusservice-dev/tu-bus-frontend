/**
 * Shape of the FCM `data` payload as the backend sends it. Mirrors
 * `PushDataPayload` in `backend/src/shared/services/push/interfaces`.
 *
 * Used as the contract for both foreground (`onMessage`) and background
 * (Service Worker → postMessage) paths so any component can subscribe to
 * a single stream and react regardless of how the push reached the tab.
 *
 * All fields are optional because the SW relays whatever shape FCM
 * delivers — defensive parsing on the consumer side.
 */
export interface PushEventData {
  type?: string;
  notificationId?: string;
  relatedOrder?: string;
  url?: string;
  icon?: string;
  [key: string]: string | undefined;
}

/**
 * Wire protocol for messages sent from the FCM Service Worker to the
 * page via `postMessage`. The `type` discriminator lets the page-side
 * listener filter SW chatter from other origins.
 */
export interface FcmSwMessage {
  type: 'fcm-push' | 'fcm-notification-click';
  payload: PushEventData;
}

/** Type guard for SW → page messages. */
export const isFcmSwMessage = (data: unknown): data is FcmSwMessage => {
  if (!data || typeof data !== 'object') return false;
  const t = (data as { type?: unknown }).type;
  return t === 'fcm-push' || t === 'fcm-notification-click';
};
