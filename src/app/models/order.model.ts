/**
 * Order Model — 3 Status Systems
 *
 * System 1: OrderStatus (universal — all dispatch types)
 * System 2: DispatchStatus (shipping_agency + local_delivery only)
 * System 3: Service Status (managed via MechanicAssignment.progressSteps)
 */

// ==================== ORDER STATUS (universal) ====================

export enum OrderStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  COMPLETED = 'completed',
  CANCELLATION_REQUESTED = 'cancellation_requested',
  CANCELLED = 'cancelled',
}

// ==================== DISPATCH STATUS (shipping/delivery only) ====================

export enum DispatchStatus {
  DISPATCHED = 'dispatched',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
}

// ==================== INTERFACES ====================

export interface OrderItem {
  product: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  isCombo?: boolean;
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
  /** Nombre del titular de la cuenta emisora (remitente). Obligatorio para
   *  zelle, opcional para otros tipos. */
  senderName?: string;
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

export interface DispatchStatusEntry {
  status: DispatchStatus;
  timestamp: string;
  note?: string;
}

/** Non-status timeline events (reschedules, reassignments, etc.) */
export type ServiceEventType = 'date_rescheduled' | 'mechanic_reassigned' | 'note';

export interface ServiceEventMetadata {
  previousDate?: string;
  newDate?: string;
  previousTier?: ServiceDateTier;
  newTier?: ServiceDateTier;
}

export interface ServiceEvent {
  type: ServiceEventType;
  timestamp: string;
  note?: string;
  metadata?: ServiceEventMetadata;
}

export type OrderCommentAuthorType = 'client' | 'admin';

/** Engine modification status declared by the client at checkout. */
export type EngineModificationStatus = 'original' | 'modified';

export interface OrderComment {
  _id?: string;
  author: string;
  authorType: OrderCommentAuthorType;
  authorName: string;
  message: string;
  createdAt: string;
}

export type DispatchType = 'store_pickup' | 'shipping_agency' | 'local_delivery' | 'seller_agreement' | 'oil_change_service' | 'in_store_oil_change';

export interface Order {
  id: string;
  orderNumber: string;
  user: string | {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    alternativePhone?: string;
    documentType?: string;
    documentNumber?: string;
    address?: string;
    stateName?: string;
    cityName?: string;
    municipalityName?: string;
    companyName?: string;
    companyRif?: string;
  };
  items: OrderItem[];
  vehicles: (string | { id: string; placa: string; marca: string; modelo: string; year: number; engineType?: any; vehicleType?: string; kilometraje?: number })[];
  vehicle?: string | { id: string; placa: string; marca: string; modelo: string; year: number }; // @deprecated
  subtotal: number;
  shippingCost: number;
  total: number;
  status: OrderStatus;
  paymentMethod?: string;
  dispatchType: DispatchType;
  dispatchDetails: DispatchDetails;
  requestedServiceDate?: string;
  requestedServiceTier?: ServiceDateTier;
  billingAddress?: BillingAddress;
  disclaimerAccepted: boolean;
  disclaimerAcceptedAt?: string;
  engineModification?: EngineModificationStatus;
  notes?: string;
  paymentSubmission?: PaymentSubmission;
  mechanic?: string | { id: string; name: string; phone: string; whatsapp?: string; avatar?: string };
  mechanicAssignment?: string | any;
  mechanicToken?: string;
  dispatchStatus?: DispatchStatus;
  dispatchStatusHistory?: DispatchStatusEntry[];
  statusHistory: StatusHistoryEntry[];
  serviceEvents?: ServiceEvent[];
  comments?: OrderComment[];
  createdAt: string;
}

export interface CreateOrderRequest {
  items: OrderItem[];
  vehicles?: string[];
  selectedBranch?: string;
  subtotal: number;
  shippingCost?: number;
  total: number;
  dispatchType: DispatchType;
  paymentMethod?: string;
  dispatchDetails?: DispatchDetails;
  requestedServiceDate?: string;
  requestedServiceTier?: ServiceDateTier;
  billingAddress?: BillingAddress;
  disclaimerAccepted: boolean;
  engineModification?: EngineModificationStatus;
  notes?: string;
  paymentSubmission?: PaymentSubmission;
}

export type ServiceDateTier = 'express' | 'tomorrow' | 'scheduled';

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

// ==================== ORDER STATUS LABELS & COLORS ====================

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'Pendiente',
  [OrderStatus.APPROVED]: 'Aprobada',
  [OrderStatus.COMPLETED]: 'Completada',
  [OrderStatus.CANCELLATION_REQUESTED]: 'Cancelacion Solicitada',
  [OrderStatus.CANCELLED]: 'Cancelada',
};

export const ORDER_STATUS_DESCRIPTIONS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'Tu orden ha sido recibida y esta siendo revisada por nuestro equipo.',
  [OrderStatus.APPROVED]: 'Tu orden fue aprobada y esta siendo preparada.',
  [OrderStatus.COMPLETED]: 'Tu orden ha sido completada exitosamente. Gracias por tu compra.',
  [OrderStatus.CANCELLATION_REQUESTED]: 'Tu solicitud de cancelacion ha sido enviada y esta siendo revisada.',
  [OrderStatus.CANCELLED]: 'Esta orden ha sido cancelada.',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  [OrderStatus.APPROVED]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  [OrderStatus.COMPLETED]: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  [OrderStatus.CANCELLATION_REQUESTED]: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  [OrderStatus.CANCELLED]: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

// ==================== DISPATCH STATUS LABELS & COLORS ====================

export const DISPATCH_STATUS_LABELS: Record<DispatchStatus, string> = {
  [DispatchStatus.DISPATCHED]: 'Despachado',
  [DispatchStatus.IN_TRANSIT]: 'En Transito',
  [DispatchStatus.DELIVERED]: 'Entregado',
};

export const DISPATCH_STATUS_DESCRIPTIONS: Record<DispatchStatus, string> = {
  [DispatchStatus.DISPATCHED]: 'Tu orden ha sido despachada.',
  [DispatchStatus.IN_TRANSIT]: 'Tu orden esta en transito hacia su destino.',
  [DispatchStatus.DELIVERED]: 'Tu orden ha sido entregada exitosamente.',
};

export const DISPATCH_STATUS_COLORS: Record<DispatchStatus, string> = {
  [DispatchStatus.DISPATCHED]: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  [DispatchStatus.IN_TRANSIT]: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  [DispatchStatus.DELIVERED]: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
};

// ==================== DISPATCH TYPE LABELS ====================

export const DISPATCH_TYPE_LABELS: Record<DispatchType, string> = {
  store_pickup: 'Retiro en Tienda',
  shipping_agency: 'Agencia de Envio',
  local_delivery: 'Delivery Local',
  seller_agreement: 'Acordar con Vendedor',
  oil_change_service: 'Cambio de Aceite',
  in_store_oil_change: 'Cambio en Tienda',
};

export const DISPATCH_TYPE_COLORS: Record<DispatchType, string> = {
  store_pickup: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  shipping_agency: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
  local_delivery: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300',
  seller_agreement: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
  oil_change_service: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300',
  in_store_oil_change: 'bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300',
};

// ==================== HELPERS ====================

/** Order status transitions (universal) */
export function getAvailableStatuses(currentStatus: OrderStatus): OrderStatus[] {
  const transitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
    [OrderStatus.PENDING]: [OrderStatus.APPROVED, OrderStatus.CANCELLED],
    [OrderStatus.APPROVED]: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
    [OrderStatus.CANCELLATION_REQUESTED]: [OrderStatus.CANCELLED, OrderStatus.PENDING],
  };
  return transitions[currentStatus] || [];
}

/** All statuses for the admin options menu (except current) */
export function getOptionsMenuStatuses(currentStatus: OrderStatus): OrderStatus[] {
  return Object.values(OrderStatus).filter(s =>
    s !== currentStatus && s !== OrderStatus.CANCELLATION_REQUESTED
  );
}

/** Dispatch status transitions */
export function getAvailableDispatchStatuses(current?: DispatchStatus): DispatchStatus[] {
  if (!current) return [DispatchStatus.DISPATCHED];
  const transitions: Partial<Record<DispatchStatus, DispatchStatus[]>> = {
    [DispatchStatus.DISPATCHED]: [DispatchStatus.IN_TRANSIT],
    [DispatchStatus.IN_TRANSIT]: [DispatchStatus.DELIVERED],
  };
  return transitions[current] || [];
}

/** Type guards */
export function isShippingOrder(order: Order): boolean {
  return order.dispatchType === 'shipping_agency' || order.dispatchType === 'local_delivery';
}

export function isOilChangeOrder(order: Order): boolean {
  return order.dispatchType === 'oil_change_service' || order.dispatchType === 'in_store_oil_change';
}

export function isInStoreOilChange(order: Order): boolean {
  return order.dispatchType === 'in_store_oil_change';
}

export function needsDispatchTracking(order: Order): boolean {
  return isShippingOrder(order) && order.status === OrderStatus.APPROVED;
}
