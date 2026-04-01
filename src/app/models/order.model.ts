/**
 * Modelo de Orden
 */

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  READY = 'ready',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export interface OrderItem {
  product: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface DispatchDetails {
  storeAddress?: string;
  storeSchedule?: string;
  agencyName?: string;
  agencyId?: string;
  recipientName?: string;
  recipientDocument?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  recipientState?: string;
  recipientCity?: string;
  recipientMunicipality?: string;
  agencyOfficeCode?: string;
  referencePoint?: string;
  selectedBranchId?: string;
  selectedBranchName?: string;
  selectedBranchAddress?: string;
}

export interface BillingAddress {
  source: 'shipping' | 'profile' | 'custom';
  fullName?: string;
  documentType?: string;
  documentNumber?: string;
  address?: string;
  city?: string;
  municipality?: string;
  state?: string;
  referencePoint?: string;
}

export interface PaymentSubmission {
  methodType: string;
  methodLabel: string;
  selectedMethodId?: string;
  referenceNumber?: string;
  sourceBank?: string;
  amount?: number;
  paymentDate?: string;
  proofUrl?: string;
  proofPublicId?: string;
  notes?: string;
}

export interface StatusHistoryEntry {
  status: OrderStatus;
  timestamp: string;
  note?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  user: string | { id: string; firstName: string; lastName: string; email: string };
  items: OrderItem[];
  vehicles: (string | { id: string; placa: string; marca: string; modelo: string; year: number; engineType?: any })[];
  vehicle?: string | { id: string; placa: string; marca: string; modelo: string; year: number }; // @deprecated
  subtotal: number;
  shippingCost: number;
  total: number;
  status: OrderStatus;
  paymentMethod?: string;
  dispatchType: string;
  dispatchDetails: DispatchDetails;
  billingAddress?: BillingAddress;
  disclaimerAccepted: boolean;
  disclaimerAcceptedAt?: string;
  notes?: string;
  paymentSubmission?: PaymentSubmission;
  mechanic?: string | { id: string; name: string; phone: string; whatsapp?: string };
  mechanicToken?: string;
  dispatchStatus?: 'pending' | 'assigned' | 'in_progress' | 'completed';
  statusHistory: StatusHistoryEntry[];
  createdAt: string;
}

export interface CreateOrderRequest {
  items: OrderItem[];
  vehicles?: string[];
  selectedBranch?: string;
  subtotal: number;
  shippingCost?: number;
  total: number;
  dispatchType: 'store_pickup' | 'shipping_agency' | 'local_delivery' | 'seller_agreement' | 'oil_change_service' | 'in_store_oil_change';
  paymentMethod?: string;
  dispatchDetails?: DispatchDetails;
  billingAddress?: BillingAddress;
  disclaimerAccepted: boolean;
  notes?: string;
  paymentSubmission?: PaymentSubmission;
}

export interface OrderListResponse {
  success: boolean;
  data: Order[];
  pagination: {
    total: number;
    pages: number;
    page: number;
    limit: number;
  };
}

export interface OrderResponse {
  success: boolean;
  message?: string;
  data: Order;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'Pendiente',
  [OrderStatus.CONFIRMED]: 'Confirmada',
  [OrderStatus.PROCESSING]: 'En Proceso',
  [OrderStatus.READY]: 'Lista',
  [OrderStatus.SHIPPED]: 'Enviada',
  [OrderStatus.DELIVERED]: 'Entregada',
  [OrderStatus.COMPLETED]: 'Completada',
  [OrderStatus.CANCELLED]: 'Cancelada',
};

export const DISPATCH_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  assigned: 'Asignado',
  in_progress: 'En Progreso',
  completed: 'Completado',
};

export const DISPATCH_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
  assigned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  in_progress: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  [OrderStatus.CONFIRMED]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  [OrderStatus.PROCESSING]: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  [OrderStatus.READY]: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  [OrderStatus.SHIPPED]: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  [OrderStatus.DELIVERED]: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  [OrderStatus.COMPLETED]: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  [OrderStatus.CANCELLED]: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};