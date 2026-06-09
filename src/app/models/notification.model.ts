export type NotificationType =
  | 'mechanic_rejection'
  | 'assignment_expired'
  | 'customer_cancellation'
  | 'new_order'
  | 'payment_note'
  | 'service_progress'
  | 'order_approved'
  | 'dispatch_update'
  | 'order_comment';

export interface AdminNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedOrder?: any;
  relatedAssignment?: any;
  metadata?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListResponse {
  success: boolean;
  data: AdminNotification[];
  pagination: { total: number; pages: number; page: number; limit: number };
}

export interface UnreadCountResponse {
  success: boolean;
  data: { count: number };
}

export interface NotificationResponse {
  success: boolean;
  data: AdminNotification;
}
