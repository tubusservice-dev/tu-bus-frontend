export type UserNotificationType =
  | 'order_confirmed' | 'order_processing' | 'order_ready' | 'order_shipped'
  | 'order_delivered' | 'order_completed' | 'order_cancelled'
  | 'mechanic_assigned' | 'mechanic_en_route' | 'service_started'
  | 'service_completed' | 'service_paused' | 'assignment_expired'
  | 'cancellation_requested';

export type NotificationIcon = 'order' | 'mechanic' | 'payment' | 'cancel' | 'success' | 'warning';

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
