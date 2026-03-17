import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Payment,
  PaymentListResponse,
  PaymentResponse,
  CreatePaymentRequest,
  UpdatePaymentRequest,
  ReviewPaymentRequest,
  PaymentStatus,
  PendingCountResponse,
} from '../../models/payment.model';

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/payments`;
  private readonly adminApiUrl = `${environment.apiUrl}/admin/payments`;

  private readonly _payments = signal<Payment[]>([]);
  private readonly _isLoading = signal(false);
  private readonly _pendingCount = signal(0);

  readonly payments = this._payments.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly pendingCount = this._pendingCount.asReadonly();

  // ─── User Methods ───

  createPayment(data: CreatePaymentRequest): Observable<PaymentResponse> {
    return this.http.post<PaymentResponse>(this.apiUrl, data);
  }

  getMyPayments(page = 1, limit = 10, status?: PaymentStatus): Observable<PaymentListResponse> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (status) params = params.set('status', status);

    this._isLoading.set(true);
    return this.http.get<PaymentListResponse>(this.apiUrl, { params }).pipe(
      tap({
        next: (res) => {
          this._payments.set(res.data);
          this._isLoading.set(false);
        },
        error: () => this._isLoading.set(false),
      })
    );
  }

  getPaymentByOrder(orderId: string): Observable<PaymentResponse> {
    return this.http.get<PaymentResponse>(`${this.apiUrl}/order/${orderId}`);
  }

  updatePayment(id: string, data: UpdatePaymentRequest): Observable<PaymentResponse> {
    return this.http.patch<PaymentResponse>(`${this.apiUrl}/${id}`, data);
  }

  // ─── Admin Methods ───

  getPendingPayments(page = 1, limit = 10): Observable<PaymentListResponse> {
    const params = new HttpParams().set('page', page).set('limit', limit);

    this._isLoading.set(true);
    return this.http.get<PaymentListResponse>(`${this.adminApiUrl}/pending`, { params }).pipe(
      tap({
        next: (res) => {
          this._payments.set(res.data);
          this._isLoading.set(false);
        },
        error: () => this._isLoading.set(false),
      })
    );
  }

  getPendingCount(): Observable<PendingCountResponse> {
    return this.http.get<PendingCountResponse>(`${this.adminApiUrl}/pending-count`).pipe(
      tap({
        next: (res) => this._pendingCount.set(res.data.count),
      })
    );
  }

  reviewPayment(id: string, data: ReviewPaymentRequest): Observable<PaymentResponse> {
    return this.http.post<PaymentResponse>(`${this.adminApiUrl}/${id}/review`, data);
  }

  getAllPayments(page = 1, limit = 10, status?: PaymentStatus): Observable<PaymentListResponse> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (status) params = params.set('status', status);

    this._isLoading.set(true);
    return this.http.get<PaymentListResponse>(this.adminApiUrl, { params }).pipe(
      tap({
        next: (res) => {
          this._payments.set(res.data);
          this._isLoading.set(false);
        },
        error: () => this._isLoading.set(false),
      })
    );
  }

  getPaymentById(id: string): Observable<PaymentResponse> {
    return this.http.get<PaymentResponse>(`${this.adminApiUrl}/${id}`);
  }
}
