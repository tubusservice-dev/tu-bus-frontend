/**
 * Modelo de Orden
 */

export enum OrderStatus {
  PENDING = 'pending',
  // Flow B (non-mechanic orders)
  APPROVED = 'approved',
  DISPATCHED = 'dispatched',
  // Flow A (oil_change_service — mechanic-driven)
  MECHANIC_ASSIGNED = 'mechanic_assigned',
  EN_ROUTE = 'en_route',
  IN_SERVICE = 'in_service',
  // Shared
  COMPLETED = 'completed',
  CANCELLATION_REQUESTED = 'cancellation_requested',
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
  mechanicAssignment?: string;
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
  [OrderStatus.APPROVED]: 'Aprobada',
  [OrderStatus.DISPATCHED]: 'Despachada',
  [OrderStatus.MECHANIC_ASSIGNED]: 'Mecánico Asignado',
  [OrderStatus.EN_ROUTE]: 'En Camino',
  [OrderStatus.IN_SERVICE]: 'En Servicio',
  [OrderStatus.COMPLETED]: 'Completada',
  [OrderStatus.CANCELLATION_REQUESTED]: 'Cancelación Solicitada',
  [OrderStatus.CANCELLED]: 'Cancelada',
};

export const ORDER_STATUS_DESCRIPTIONS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'Tu orden ha sido recibida y está siendo revisada por nuestro equipo.',
  [OrderStatus.APPROVED]: 'Tu orden fue aprobada y está siendo preparada para el despacho.',
  [OrderStatus.DISPATCHED]: 'Tu orden ha sido despachada y está en camino.',
  [OrderStatus.MECHANIC_ASSIGNED]: 'Tu mecánico ha sido asignado y pronto se pondrá en camino para realizar el servicio.',
  [OrderStatus.EN_ROUTE]: 'El mecánico está en camino hacia tu ubicación.',
  [OrderStatus.IN_SERVICE]: 'El mecánico está realizando el servicio en tu vehículo.',
  [OrderStatus.COMPLETED]: 'El servicio ha sido completado exitosamente.',
  [OrderStatus.CANCELLATION_REQUESTED]: 'Tu solicitud de cancelación ha sido enviada y está siendo revisada.',
  [OrderStatus.CANCELLED]: 'Esta orden ha sido cancelada.',
};

/** @deprecated Use ORDER_STATUS_LABELS instead — dispatch status is now unified into order status */
export const DISPATCH_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  assigned: 'Asignado',
  in_progress: 'En Progreso',
  completed: 'Completado',
};

/** @deprecated Use ORDER_STATUS_COLORS instead */
export const DISPATCH_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
  assigned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  in_progress: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

// ==================== STATUS FLOW HELPERS ====================

export function isOilChangeService(order: Order): boolean {
  return order.dispatchType === 'oil_change_service';
}

/**
 * Returns valid next statuses based on dispatch type and current status.
 * Flow A (oil_change_service): mechanic-driven, admin can only cancel.
 * Flow B (all others): PENDING → APPROVED → DISPATCHED.
 */
export function getAvailableStatuses(dispatchType: string, currentStatus: OrderStatus): OrderStatus[] {
  if (dispatchType === 'oil_change_service') {
    if (currentStatus === OrderStatus.CANCELLATION_REQUESTED) {
      return [OrderStatus.CANCELLED, OrderStatus.PENDING];
    }
    return [OrderStatus.CANCELLED];
  }

  const transitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
    [OrderStatus.PENDING]: [OrderStatus.APPROVED, OrderStatus.CANCELLED],
    [OrderStatus.APPROVED]: [OrderStatus.DISPATCHED, OrderStatus.CANCELLED],
    [OrderStatus.DISPATCHED]: [OrderStatus.CANCELLED],
    [OrderStatus.CANCELLATION_REQUESTED]: [OrderStatus.CANCELLED, OrderStatus.APPROVED],
  };
  return transitions[currentStatus] || [OrderStatus.CANCELLED];
}

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  [OrderStatus.APPROVED]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  [OrderStatus.DISPATCHED]: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  [OrderStatus.MECHANIC_ASSIGNED]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  [OrderStatus.EN_ROUTE]: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  [OrderStatus.IN_SERVICE]: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  [OrderStatus.COMPLETED]: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  [OrderStatus.CANCELLATION_REQUESTED]: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  [OrderStatus.CANCELLED]: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};