export enum ReviewStatus {
  VISIBLE = 'visible',
  HIDDEN = 'hidden',
}

export interface ReviewOrderSnapshot {
  orderNumber: string;
  orderTotal: number;
  orderDispatchType: string;
}

export interface ReviewUserPopulated {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: string;
}

export interface ReviewAdminResponse {
  text: string;
  respondedAt: string;
  respondedBy: string | { id: string; username: string; firstName?: string; lastName?: string };
}

export interface Review {
  id: string;
  order: string | { id: string; orderNumber: string; total: number; items: unknown[]; dispatchType: string; createdAt: string };
  user: string | ReviewUserPopulated;
  rating: number;
  comment?: string;
  orderNumber: string;
  orderTotal: number;
  orderDispatchType: string;
  adminResponse?: ReviewAdminResponse;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReviewRequest {
  orderId: string;
  rating: number;
  comment?: string;
}

export interface AdminResponseRequest {
  text: string;
}

export interface ReviewStats {
  average: number | null;
  count: number;
  distribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface ReviewAdminSummary {
  average: number | null;
  count: number;
  withoutResponse: number;
}

export interface ReviewResponse {
  success: boolean;
  message?: string;
  data: Review;
}

export interface ReviewMaybeResponse {
  success: boolean;
  data: Review | null;
}

export interface ReviewListResponse {
  success: boolean;
  data: Review[];
  pagination: { total: number; pages: number; page: number; limit: number };
}

export interface ReviewStatsResponse {
  success: boolean;
  data: ReviewStats;
}

export interface ReviewAdminSummaryResponse {
  success: boolean;
  data: ReviewAdminSummary;
}

export const DISPATCH_TYPE_SHORT_LABELS: Record<string, string> = {
  store_pickup: 'Retiro en tienda',
  shipping_agency: 'Envío por agencia',
  local_delivery: 'Envío local',
  seller_agreement: 'Acordar con vendedor',
  oil_change_service: 'Cambio de aceite a domicilio',
  in_store_oil_change: 'Cambio de aceite en tienda',
};
