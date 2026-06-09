import { NavigationExtras } from '@angular/router';
import { AdminNotification, NotificationType } from '@models/notification.model';
import { UserNotification, UserNotificationType } from '@models/user-notification.model';

/**
 * Resolved call-to-action for a notification detail modal. Pure data — the
 * consuming component performs the navigation. Keeping this side-effect free
 * makes the type→CTA mapping trivially unit-testable and reusable across the
 * user and admin modals (SoC + DRY).
 */
export interface NotificationCta {
  /** Visible button label, e.g. "Ver mensaje" / "Ver servicio" / "Ver orden". */
  label: string;
  /** Router commands array passed verbatim to `Router.navigate`. */
  commands: string[];
  /** Optional navigation extras (query params that open a focused view). */
  extras?: NavigationExtras;
}

/**
 * Normalises the polymorphic `relatedOrder` field (populated object | id
 * string | undefined) into a plain order id. Returns '' when absent.
 */
const extractOrderId = (relatedOrder: unknown): string => {
  if (!relatedOrder) return '';
  if (typeof relatedOrder === 'object') {
    const ref = relatedOrder as { id?: string; _id?: string };
    return ref.id || ref._id || '';
  }
  return String(relatedOrder);
};

/**
 * User notification types whose context is the mechanic/oil-change service,
 * routed to the dedicated service-tracking screen.
 */
const USER_SERVICE_TYPES: ReadonlySet<UserNotificationType> = new Set<UserNotificationType>([
  'mechanic_assigned',
  'mechanic_en_route',
  'service_started',
  'service_completed',
  'service_paused',
  'assignment_expired',
  'service_rescheduled',
  'order_mechanic_assigned',
  'order_en_route',
  'order_in_service',
]);

/**
 * Resolves the contextual CTA for a customer-facing notification.
 *
 *  - `order_comment`        → "Ver mensaje" → opens the messaging modal.
 *  - service/mechanic types → "Ver servicio" → dedicated tracking route.
 *  - everything else        → "Ver orden" → order detail.
 *
 * Returns `null` when there is no order to navigate to, so the modal renders
 * no action button at all.
 */
export const resolveUserNotificationCta = (
  notif: UserNotification | null,
): NotificationCta | null => {
  if (!notif) return null;
  const orderId = extractOrderId(notif.relatedOrder);
  if (!orderId) return null;

  const orderPath = ['/perfil/pedidos', orderId];

  if (notif.type === 'order_comment') {
    return {
      label: 'Ver mensaje',
      commands: orderPath,
      extras: { queryParams: { openMessages: '1' } },
    };
  }

  if (USER_SERVICE_TYPES.has(notif.type)) {
    return { label: 'Ver servicio', commands: [...orderPath, 'servicio'] };
  }

  return { label: 'Ver orden', commands: orderPath };
};

/**
 * Admin notification types tied to the mechanic service. These scroll the
 * admin order-detail to the service-tracking card via `?openService=1`.
 */
const ADMIN_SERVICE_TYPES: ReadonlySet<NotificationType> = new Set<NotificationType>([
  'mechanic_rejection',
  'assignment_expired',
  'service_progress',
]);

/**
 * Resolves the contextual CTA for an admin-facing notification.
 *
 *  - `order_comment`        → "Ver mensaje" → scrolls to the comments thread.
 *  - service-related types  → "Ver servicio" → scrolls to the service card.
 *  - everything else        → "Ver orden" → order detail.
 *
 * Returns `null` when there is no related order.
 */
export const resolveAdminNotificationCta = (
  notif: AdminNotification | null,
): NotificationCta | null => {
  if (!notif) return null;
  const orderId = extractOrderId(notif.relatedOrder);
  if (!orderId) return null;

  const orderPath = ['/admin/orders', orderId];

  if (notif.type === 'order_comment') {
    return {
      label: 'Ver mensaje',
      commands: orderPath,
      extras: { queryParams: { openMessages: '1' } },
    };
  }

  if (ADMIN_SERVICE_TYPES.has(notif.type)) {
    return {
      label: 'Ver servicio',
      commands: orderPath,
      extras: { queryParams: { openService: '1' } },
    };
  }

  return { label: 'Ver orden', commands: orderPath };
};
