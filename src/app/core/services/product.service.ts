import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Product,
  ProductListResponse,
  ProductResponse,
  CreateProductRequest,
  UpdateProductRequest,
  FuelType,
  VehicleType,
} from '../../models/product.model';

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  line?: string;
  brand?: string;
  category?: string;
  vehicleType?: VehicleType;
  minPrice?: number;
  maxPrice?: number;
  isActive?: boolean;
  isFeatured?: boolean;
  isCombo?: boolean;
  search?: string;
  sortBy?: 'price' | 'createdAt' | 'name';
  sortOrder?: 'asc' | 'desc';
  // Branch filter (comma-separated IDs)
  branchIds?: string;
  // Filtros de compatibilidad de motor
  engineDisplacement?: string;
  engineFuelType?: FuelType;
  engineCylinders?: number;
}

@Injectable({
  providedIn: 'root',
})
export class ProductService {
  private readonly http = inject(HttpClient);
  // Ruta pública para lectura (usuarios)
  private readonly publicUrl = `${environment.apiUrl}/products`;
  // Ruta admin para escritura (crear, editar, eliminar)
  private readonly adminUrl = `${environment.apiUrl}/admin/products`;

  /**
   * Obtener lista de productos con filtros y paginación (público)
   */
  getAll(params?: ProductQueryParams): Observable<ProductListResponse> {
    let httpParams = new HttpParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }

    return this.http.get<ProductListResponse>(this.publicUrl, { params: httpParams });
  }

  /**
   * Obtener producto por ID (público)
   */
  getById(id: string): Observable<ProductResponse> {
    return this.http.get<ProductResponse>(`${this.publicUrl}/${id}`);
  }

  /**
   * Obtener lista de productos para admin (incluye inactivos)
   */
  getAllAdmin(params?: ProductQueryParams): Observable<ProductListResponse> {
    let httpParams = new HttpParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          httpParams = httpParams.set(key, value.toString());
        }
      });
    }

    return this.http.get<ProductListResponse>(this.adminUrl, { params: httpParams });
  }

  /**
   * Obtener producto por ID para admin
   */
  getByIdAdmin(id: string): Observable<ProductResponse> {
    return this.http.get<ProductResponse>(`${this.adminUrl}/${id}`);
  }

  /**
   * Crear nuevo producto (admin)
   */
  create(data: CreateProductRequest): Observable<ProductResponse> {
    return this.http.post<ProductResponse>(this.adminUrl, data);
  }

  /**
   * Actualizar producto (admin)
   */
  update(id: string, data: UpdateProductRequest): Observable<ProductResponse> {
    return this.http.put<ProductResponse>(`${this.adminUrl}/${id}`, data);
  }

  /**
   * Eliminar producto (admin)
   */
  delete(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.adminUrl}/${id}`);
  }

  /**
   * Actualizar stock (admin)
   */
  updateStock(id: string, quantity: number): Observable<ProductResponse> {
    return this.http.patch<ProductResponse>(`${this.adminUrl}/${id}/stock`, {
      quantity,
    });
  }
}