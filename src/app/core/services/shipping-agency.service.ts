import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ShippingAgency, ShippingConfig } from '../../models/product.model';

export interface ShippingAgencyResponse {
  success: boolean;
  data: ShippingAgency;
  message?: string;
}

export interface ShippingAgencyListResponse {
  success: boolean;
  data: ShippingAgency[];
}

export interface CreateShippingAgencyRequest {
  name: string;
  description?: string;
  image?: string;
  isActive?: boolean;
  config?: Partial<ShippingConfig>;
}

@Injectable({
  providedIn: 'root',
})
export class ShippingAgencyService {
  private readonly http = inject(HttpClient);
  private readonly publicUrl = `${environment.apiUrl}/shipping-agencies`;
  private readonly adminUrl = `${environment.apiUrl}/admin/shipping-agencies`;

  /**
   * Obtener todas las agencias (público - para checkout)
   */
  getAll(): Observable<ShippingAgencyListResponse> {
    return this.http.get<ShippingAgencyListResponse>(this.publicUrl);
  }

  /**
   * Obtener todas las agencias (admin - incluye inactivas)
   */
  getAllAdmin(): Observable<ShippingAgencyListResponse> {
    return this.http.get<ShippingAgencyListResponse>(`${this.adminUrl}?includeInactive=true`);
  }

  /**
   * Obtener agencia por ID (admin)
   */
  getById(id: string): Observable<ShippingAgencyResponse> {
    return this.http.get<ShippingAgencyResponse>(`${this.adminUrl}/${id}`);
  }

  /**
   * Crear agencia (admin)
   */
  create(data: CreateShippingAgencyRequest): Observable<ShippingAgencyResponse> {
    return this.http.post<ShippingAgencyResponse>(this.adminUrl, data);
  }

  /**
   * Actualizar agencia (admin)
   */
  update(id: string, data: Partial<CreateShippingAgencyRequest>): Observable<ShippingAgencyResponse> {
    return this.http.put<ShippingAgencyResponse>(`${this.adminUrl}/${id}`, data);
  }

  /**
   * Actualizar solo la configuración (admin)
   */
  updateConfig(id: string, config: Partial<ShippingConfig>): Observable<ShippingAgencyResponse> {
    return this.http.put<ShippingAgencyResponse>(`${this.adminUrl}/${id}`, { config });
  }

  /**
   * Eliminar agencia (admin)
   */
  delete(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.adminUrl}/${id}`);
  }
}
