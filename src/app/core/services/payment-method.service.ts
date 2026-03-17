import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PaymentMethodConfig,
  CreatePaymentMethodDto,
  UpdatePaymentMethodDto,
} from '../../models/payment-method.model';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentMethodService {
  private readonly http = inject(HttpClient);
  private readonly adminApiUrl = `${environment.apiUrl}/admin/payment-methods`;
  private readonly publicApiUrl = `${environment.apiUrl}/payment-methods`;

  // ========== Admin ==========
  getAll(): Observable<ApiResponse<PaymentMethodConfig[]>> {
    return this.http.get<ApiResponse<PaymentMethodConfig[]>>(this.adminApiUrl);
  }

  getById(id: string): Observable<ApiResponse<PaymentMethodConfig>> {
    return this.http.get<ApiResponse<PaymentMethodConfig>>(`${this.adminApiUrl}/${id}`);
  }

  create(dto: CreatePaymentMethodDto): Observable<ApiResponse<PaymentMethodConfig>> {
    return this.http.post<ApiResponse<PaymentMethodConfig>>(this.adminApiUrl, dto);
  }

  update(id: string, dto: UpdatePaymentMethodDto): Observable<ApiResponse<PaymentMethodConfig>> {
    return this.http.put<ApiResponse<PaymentMethodConfig>>(`${this.adminApiUrl}/${id}`, dto);
  }

  delete(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.adminApiUrl}/${id}`);
  }

  toggleActive(id: string): Observable<ApiResponse<PaymentMethodConfig>> {
    return this.http.patch<ApiResponse<PaymentMethodConfig>>(`${this.adminApiUrl}/${id}/toggle`, {});
  }

  // ========== Público (checkout) ==========
  getActive(): Observable<ApiResponse<PaymentMethodConfig[]>> {
    return this.http.get<ApiResponse<PaymentMethodConfig[]>>(`${this.publicApiUrl}/active`);
  }
}
