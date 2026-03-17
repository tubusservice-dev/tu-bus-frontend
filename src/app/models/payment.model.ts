/**
 * Modelo de Pago
 */

export enum PaymentMethod {
  DIGITAL = 'digital',
  CASH = 'cash',
  CASHEA = 'cashea',
}

export enum PaymentStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface Payment {
  id: string;
  order: string | { id: string; orderNumber: string; total: number; status: string; dispatchType: string; createdAt: string };
  user: string | { id: string; firstName: string; lastName: string; email: string; phone?: string };
  method: PaymentMethod;
  status: PaymentStatus;
  referenceNumber?: string;
  transactionAmount?: number;
  paymentDate?: string;
  captureUrl?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentRequest {
  orderId: string;
  method: PaymentMethod;
  referenceNumber?: string;
  transactionAmount?: number;
  paymentDate?: string;
  captureUrl?: string;
  capturePublicId?: string;
}

export interface UpdatePaymentRequest {
  referenceNumber?: string;
  transactionAmount?: number;
  paymentDate?: string;
  captureUrl?: string;
  capturePublicId?: string;
}

export interface ReviewPaymentRequest {
  action: 'approve' | 'reject';
  rejectionReason?: string;
}

export interface PaymentResponse {
  success: boolean;
  message?: string;
  data: Payment;
}

export interface PaymentListResponse {
  success: boolean;
  data: Payment[];
  pagination: {
    total: number;
    pages: number;
    page: number;
    limit: number;
  };
}

export interface PendingCountResponse {
  success: boolean;
  data: { count: number };
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.DIGITAL]: 'Pago Digital',
  [PaymentMethod.CASH]: 'Efectivo',
  [PaymentMethod.CASHEA]: 'Cashea',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]: 'Pendiente',
  [PaymentStatus.APPROVED]: 'Aprobado',
  [PaymentStatus.REJECTED]: 'Rechazado',
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  [PaymentStatus.APPROVED]: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  [PaymentStatus.REJECTED]: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};
