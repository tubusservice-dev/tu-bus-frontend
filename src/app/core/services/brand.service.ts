import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Brand } from '../../models/product.model';

export interface BrandResponse {
  success: boolean;
  data: Brand;
  message?: string;
}

export interface BrandListResponse {
  success: boolean;
  data: Brand[];
}

export interface CreateBrandRequest {
  name: string;
  description?: string;
  image?: string;
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class BrandService {
  private readonly http = inject(HttpClient);
  private readonly publicUrl = `${environment.apiUrl}/brands`;
  private readonly adminUrl = `${environment.apiUrl}/admin/brands`;

  /**
   * Obtener todas las marcas (público - para catálogo)
   */
  getAll(): Observable<BrandListResponse> {
    return this.http.get<BrandListResponse>(this.publicUrl);
  }

  /**
   * Obtener todas las marcas (admin - incluye inactivas)
   */
  getAllAdmin(): Observable<BrandListResponse> {
    return this.http.get<BrandListResponse>(`${this.adminUrl}?includeInactive=true`);
  }

  /**
   * Obtener marca por ID (admin)
   */
  getById(id: string): Observable<BrandResponse> {
    return this.http.get<BrandResponse>(`${this.adminUrl}/${id}`);
  }

  /**
   * Crear marca (admin)
   */
  create(data: CreateBrandRequest): Observable<BrandResponse> {
    return this.http.post<BrandResponse>(this.adminUrl, data);
  }

  /**
   * Actualizar marca (admin)
   */
  update(id: string, data: Partial<CreateBrandRequest>): Observable<BrandResponse> {
    return this.http.put<BrandResponse>(`${this.adminUrl}/${id}`, data);
  }

  /**
   * Eliminar marca (admin)
   */
  delete(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.adminUrl}/${id}`);
  }
}
