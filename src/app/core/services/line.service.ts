import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Line } from '../../models/product.model';

export interface LineResponse {
  success: boolean;
  data: Line;
  message?: string;
}

export interface LineListResponse {
  success: boolean;
  data: Line[];
}

export interface CreateLineRequest {
  name: string;
  description?: string;
  image?: string;
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class LineService {
  private readonly http = inject(HttpClient);
  private readonly publicUrl = `${environment.apiUrl}/lines`;
  private readonly adminUrl = `${environment.apiUrl}/admin/lines`;

  /**
   * Obtener todas las líneas (público - para catálogo)
   */
  getAll(): Observable<LineListResponse> {
    return this.http.get<LineListResponse>(this.publicUrl);
  }

  /**
   * Obtener todas las líneas (admin - incluye inactivas)
   */
  getAllAdmin(): Observable<LineListResponse> {
    return this.http.get<LineListResponse>(`${this.adminUrl}?includeInactive=true`);
  }

  /**
   * Obtener línea por ID (admin)
   */
  getById(id: string): Observable<LineResponse> {
    return this.http.get<LineResponse>(`${this.adminUrl}/${id}`);
  }

  /**
   * Crear línea (admin)
   */
  create(data: CreateLineRequest): Observable<LineResponse> {
    return this.http.post<LineResponse>(this.adminUrl, data);
  }

  /**
   * Actualizar línea (admin)
   */
  update(id: string, data: Partial<CreateLineRequest>): Observable<LineResponse> {
    return this.http.put<LineResponse>(`${this.adminUrl}/${id}`, data);
  }

  /**
   * Eliminar línea (admin)
   */
  delete(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.adminUrl}/${id}`);
  }
}
