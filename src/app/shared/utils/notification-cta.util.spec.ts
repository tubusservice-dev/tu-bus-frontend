import { AdminNotification } from '@models/notification.model';
import { UserNotification, UserNotificationType } from '@models/user-notification.model';
import {
  resolveAdminNotificationCta,
  resolveUserNotificationCta,
} from './notification-cta.util';

const userNotif = (
  type: UserNotificationType,
  relatedOrder: UserNotification['relatedOrder'] = 'order-1',
): UserNotification => ({
  id: 'n-1',
  type,
  title: 't',
  message: 'm',
  relatedOrder,
  icon: 'order',
  isRead: false,
  createdAt: '2026-06-08T00:00:00.000Z',
});

const adminNotif = (
  type: AdminNotification['type'],
  relatedOrder: AdminNotification['relatedOrder'] = 'order-9',
): AdminNotification => ({
  id: 'a-1',
  type,
  title: 't',
  message: 'm',
  relatedOrder,
  isRead: false,
  createdAt: '2026-06-08T00:00:00.000Z',
});

describe('resolveUserNotificationCta', () => {
  it('returns null for a null notification', () => {
    expect(resolveUserNotificationCta(null)).toBeNull();
  });

  it('returns null when there is no related order', () => {
    expect(
      resolveUserNotificationCta({ ...userNotif('order_approved'), relatedOrder: undefined }),
    ).toBeNull();
  });

  it('maps order_comment to "Ver mensaje" opening the messaging modal', () => {
    const cta = resolveUserNotificationCta(userNotif('order_comment'));
    expect(cta).toEqual({
      label: 'Ver mensaje',
      commands: ['/perfil/pedidos', 'order-1'],
      extras: { queryParams: { openMessages: '1' } },
    });
  });

  it('maps service/mechanic types to "Ver servicio" on the tracking route', () => {
    const serviceTypes: UserNotificationType[] = [
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
    ];
    for (const type of serviceTypes) {
      const cta = resolveUserNotificationCta(userNotif(type));
      expect(cta?.label).withContext(type).toBe('Ver servicio');
      expect(cta?.commands).withContext(type).toEqual(['/perfil/pedidos', 'order-1', 'servicio']);
      expect(cta?.extras).withContext(type).toBeUndefined();
    }
  });

  it('falls back to "Ver orden" for order-status and dispatch types', () => {
    const orderTypes: UserNotificationType[] = [
      'order_approved',
      'order_completed',
      'order_cancelled',
      'dispatch_dispatched',
      'dispatch_in_transit',
      'dispatch_delivered',
    ];
    for (const type of orderTypes) {
      const cta = resolveUserNotificationCta(userNotif(type));
      expect(cta?.label).withContext(type).toBe('Ver orden');
      expect(cta?.commands).withContext(type).toEqual(['/perfil/pedidos', 'order-1']);
    }
  });

  it('resolves the order id from a populated object via id', () => {
    const cta = resolveUserNotificationCta(userNotif('order_approved', { id: 'obj-id' } as never));
    expect(cta?.commands).toEqual(['/perfil/pedidos', 'obj-id']);
  });

  it('resolves the order id from a populated object via _id', () => {
    const cta = resolveUserNotificationCta(userNotif('order_approved', { _id: 'mongo-id' } as never));
    expect(cta?.commands).toEqual(['/perfil/pedidos', 'mongo-id']);
  });
});

describe('resolveAdminNotificationCta', () => {
  it('returns null for a null notification', () => {
    expect(resolveAdminNotificationCta(null)).toBeNull();
  });

  it('returns null when there is no related order', () => {
    expect(
      resolveAdminNotificationCta({ ...adminNotif('new_order'), relatedOrder: undefined }),
    ).toBeNull();
  });

  it('maps order_comment to "Ver mensaje" opening the thread', () => {
    const cta = resolveAdminNotificationCta(adminNotif('order_comment'));
    expect(cta).toEqual({
      label: 'Ver mensaje',
      commands: ['/admin/orders', 'order-9'],
      extras: { queryParams: { openMessages: '1' } },
    });
  });

  it('maps service types to "Ver servicio" with openService', () => {
    for (const type of [
      'mechanic_rejection',
      'assignment_expired',
      'service_progress',
    ] as AdminNotification['type'][]) {
      const cta = resolveAdminNotificationCta(adminNotif(type));
      expect(cta?.label).withContext(type).toBe('Ver servicio');
      expect(cta?.extras).withContext(type).toEqual({ queryParams: { openService: '1' } });
    }
  });

  it('falls back to "Ver orden" for the remaining admin types', () => {
    for (const type of [
      'new_order',
      'order_approved',
      'customer_cancellation',
      'payment_note',
      'dispatch_update',
    ] as AdminNotification['type'][]) {
      const cta = resolveAdminNotificationCta(adminNotif(type));
      expect(cta?.label).withContext(type).toBe('Ver orden');
      expect(cta?.commands).withContext(type).toEqual(['/admin/orders', 'order-9']);
    }
  });
});
