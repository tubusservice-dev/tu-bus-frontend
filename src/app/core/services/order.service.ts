import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MechanicAssignmentResponse } from '../../models/mechanic-assignment.model';
import {
  Order,
  OrderListResponse,
  OrderResponse,
  CreateOrderRequest,
  PaymentSubmission,
  OrderStatus,
  DispatchStatus,
} from '../../models/order.model';

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/orders`;
  private readonly adminApiUrl = `${environment.apiUrl}/admin/orders`;

  private readonly _orders = signal<Order[]>([]);
  private readonly _isLoading = signal(false);

  readonly orders = this._orders.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  // ==================== CLIENT METHODS ====================

  createOrder(data: CreateOrderRequest): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(this.apiUrl, data);
  }

  getMyOrders(page = 1, limit = 10, status?: OrderStatus, search?: string): Observable<OrderListResponse> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (status) params = params.set('status', status);
    if (search) params = params.set('search', search);

    this._isLoading.set(true);
    return this.http.get<OrderListResponse>(this.apiUrl, { params }).pipe(
      tap({
        next: (res) => {
          this._orders.set(res.data);
          this._isLoading.set(false);
        },
        error: () => this._isLoading.set(false),
      })
    );
  }

  getOrderById(id: string): Observable<OrderResponse> {
    return this.http.get<OrderResponse>(`${this.apiUrl}/${id}`);
  }

  cancelOrder(id: string, reason?: string): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(`${this.apiUrl}/${id}/cancel`, { reason });
  }

  updatePayment(id: string, payment: PaymentSubmission): Observable<OrderResponse> {
    return this.http.patch<OrderResponse>(`${this.apiUrl}/${id}/payment`, payment);
  }

  getServiceTracking(orderId: string): Observable<MechanicAssignmentResponse> {
    return this.http.get<MechanicAssignmentResponse>(`${this.apiUrl}/${orderId}/service-tracking`);
  }

  // ==================== ADMIN METHODS ====================

  getAdminOrders(page = 1, limit = 10, status?: OrderStatus, search?: string): Observable<OrderListResponse> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (status) params = params.set('status', status);
    if (search) params = params.set('search', search);
    return this.http.get<OrderListResponse>(this.adminApiUrl, { params });
  }

  getAdminOrderById(id: string): Observable<OrderResponse> {
    return this.http.get<OrderResponse>(`${this.adminApiUrl}/${id}`);
  }

  /** Normal status transition (approve/cancel from pending, etc.) */
  updateOrderStatus(orderId: string, status: OrderStatus, note?: string): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`${this.adminApiUrl}/${orderId}/status`, { status, note });
  }

  /** Force-set any status from admin options menu */
  forceOrderStatus(orderId: string, status: OrderStatus, note?: string): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`${this.adminApiUrl}/${orderId}/force-status`, { status, note });
  }

  /** Update dispatch status for shipping/delivery orders */
  updateDispatchStatus(orderId: string, dispatchStatus: DispatchStatus, note?: string): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`${this.adminApiUrl}/${orderId}/dispatch-status`, { dispatchStatus, note });
  }

  updateNotes(orderId: string, notes: string): Observable<OrderResponse> {
    return this.http.patch<OrderResponse>(`${this.adminApiUrl}/${orderId}/notes`, { notes });
  }

  /**
   * Admin-only: reprogramar la fecha solicitada del servicio. Dispara una
   * notificación al cliente con la nota del admin.
   */
  rescheduleService(
    orderId: string,
    payload: { newDate: string; newTier: 'express' | 'tomorrow' | 'scheduled'; adminNote: string },
  ): Observable<OrderResponse> {
    return this.http.patch<OrderResponse>(`${this.adminApiUrl}/${orderId}/reschedule-service`, payload);
  }

  /** Client: agregar un comentario al hilo de la orden. */
  addCommentAsClient(orderId: string, message: string): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(`${this.apiUrl}/${orderId}/comments`, { message });
  }

  /** Admin: agregar un comentario al hilo de la orden (se guarda como "Agente TuBusExpress"). */
  addCommentAsAdmin(orderId: string, message: string): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(`${this.adminApiUrl}/${orderId}/comments`, { message });
  }
}
