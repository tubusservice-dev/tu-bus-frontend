export type UserNotificationType =
  // Order status flow
  | 'order_approved' | 'order_dispatched'
  | 'order_mechanic_assigned' | 'order_en_route' | 'order_in_service'
  | 'order_completed' | 'order_cancelled'
  // Legacy (kept for existing notifications in DB)
  | 'order_confirmed' | 'order_processing' | 'order_ready' | 'order_shipped' | 'order_delivered'
  // Mechanic service
  | 'mechanic_assigned' | 'mechanic_en_route' | 'service_started'
  | 'service_completed' | 'service_paused' | 'assignment_expired'
  | 'cancellation_requested'
  // Dispatch tracking
  | 'dispatch_dispatched' | 'dispatch_in_transit' | 'dispatch_delivered'
  // Service rescheduling (admin reschedules the requested service date)
  | 'service_rescheduled'
  // Order comment thread (admin reply)
  | 'order_comment';

export type NotificationIcon = 'order' | 'mechanic' | 'payment' | 'cancel' | 'success' | 'warning' | 'truck' | 'user-plus' | 'box';

export interface UserNotification {
  id: string;
  type: UserNotificationType;
  title: string;
  message: string;
  relatedOrder?: any;
  icon: NotificationIcon;
  isRead: boolean;
  createdAt: string;
}

export interface UserNotificationListResponse {
  success: boolean;
  data: UserNotification[];
  pagination: { total: number; pages: number };
}

export interface UserUnreadCountResponse {
  success: boolean;
  data: { count: number };
}
