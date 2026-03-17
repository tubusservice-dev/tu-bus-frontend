import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Order,
  OrderListResponse,
  OrderResponse,
  CreateOrderRequest,
  OrderStatus,
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

  createOrder(data: CreateOrderRequest): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(this.apiUrl, data);
  }

  getMyOrders(page = 1, limit = 10, status?: OrderStatus): Observable<OrderListResponse> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (status) params = params.set('status', status);

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

  cancelOrder(id: string): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(`${this.apiUrl}/${id}/cancel`, {});
  }

  // ==================== ADMIN METHODS ====================

  getAdminOrders(page = 1, limit = 10, status?: OrderStatus): Observable<OrderListResponse> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (status) params = params.set('status', status);
    return this.http.get<OrderListResponse>(this.adminApiUrl, { params });
  }

  getAdminOrderById(id: string): Observable<OrderResponse> {
    return this.http.get<OrderResponse>(`${this.adminApiUrl}/${id}`);
  }

  assignMechanic(orderId: string, mechanicId: string): Observable<OrderResponse> {
    return this.http.post<OrderResponse>(`${this.adminApiUrl}/${orderId}/assign-mechanic`, { mechanicId });
  }

  updateOrderStatus(orderId: string, status: OrderStatus, note?: string): Observable<OrderResponse> {
    return this.http.put<OrderResponse>(`${this.adminApiUrl}/${orderId}/status`, { status, note });
  }
}