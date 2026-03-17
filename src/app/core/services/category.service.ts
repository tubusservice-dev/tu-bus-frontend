import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Category } from '../../models/product.model';

export interface CategoryResponse {
  success: boolean;
  data: Category;
  message?: string;
}

export interface CategoryListResponse {
  success: boolean;
  data: Category[];
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly publicUrl = `${environment.apiUrl}/categories`;
  private readonly adminUrl = `${environment.apiUrl}/admin/categories`;

  /**
   * Obtener todas las categorías (público - para catálogo)
   */
  getAll(): Observable<CategoryListResponse> {
    return this.http.get<CategoryListResponse>(this.publicUrl);
  }

  /**
   * Obtener todas las categorías (admin - incluye inactivas)
   */
  getAllAdmin(): Observable<CategoryListResponse> {
    return this.http.get<CategoryListResponse>(`${this.adminUrl}?includeInactive=true`);
  }

  /**
   * Obtener categoría por ID (admin)
   */
  getById(id: string): Observable<CategoryResponse> {
    return this.http.get<CategoryResponse>(`${this.adminUrl}/${id}`);
  }

  /**
   * Crear categoría (admin)
   */
  create(data: CreateCategoryRequest): Observable<CategoryResponse> {
    return this.http.post<CategoryResponse>(this.adminUrl, data);
  }

  /**
   * Actualizar categoría (admin)
   */
  update(id: string, data: Partial<CreateCategoryRequest>): Observable<CategoryResponse> {
    return this.http.put<CategoryResponse>(`${this.adminUrl}/${id}`, data);
  }

  /**
   * Eliminar categoría (admin)
   */
  delete(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.adminUrl}/${id}`);
  }
}
