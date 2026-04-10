export type NotificationType = 'mechanic_rejection' | 'customer_cancellation';

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
