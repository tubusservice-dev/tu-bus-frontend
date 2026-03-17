import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Admin,
  AdminLoginRequest,
  AdminAuthResponse,
  AdminProfileResponse,
  AdminListResponse,
  AdminOperationResponse,
  CreateAdminRequest,
  UpdateAdminRequest,
} from '../../models/admin.model';

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin`;

  /**
   * Login de administrador
   */
  login(credentials: AdminLoginRequest): Observable<AdminAuthResponse> {
    return this.http.post<AdminAuthResponse>(`${this.apiUrl}/login`, credentials);
  }

  /**
   * Obtener perfil del admin actual
   */
  getProfile(): Observable<AdminProfileResponse> {
    return this.http.get<AdminProfileResponse>(`${this.apiUrl}/profile`);
  }

  /**
   * Listar todos los administradores
   */
  getAll(params?: { page?: number; limit?: number }): Observable<AdminListResponse> {
    let httpParams = new HttpParams();
    if (params?.page) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params?.limit) {
      httpParams = httpParams.set('limit', params.limit.toString());
    }
    return this.http.get<AdminListResponse>(`${this.apiUrl}/administrators`, { params: httpParams });
  }

  /**
   * Obtener un administrador por ID
   */
  getById(id: string): Observable<AdminProfileResponse> {
    return this.http.get<AdminProfileResponse>(`${this.apiUrl}/administrators/${id}`);
  }

  /**
   * Crear un nuevo administrador
   */
  create(data: CreateAdminRequest): Observable<AdminOperationResponse> {
    return this.http.post<AdminOperationResponse>(`${this.apiUrl}/administrators`, data);
  }

  /**
   * Actualizar un administrador
   */
  update(id: string, data: UpdateAdminRequest): Observable<AdminOperationResponse> {
    return this.http.put<AdminOperationResponse>(`${this.apiUrl}/administrators/${id}`, data);
  }

  /**
   * Eliminar un administrador
   */
  delete(id: string): Observable<AdminOperationResponse> {
    return this.http.delete<AdminOperationResponse>(`${this.apiUrl}/administrators/${id}`);
  }

  /**
   * Cambiar estado activo/inactivo de un administrador
   */
  toggleStatus(id: string, isActive: boolean): Observable<AdminOperationResponse> {
    return this.http.patch<AdminOperationResponse>(`${this.apiUrl}/administrators/${id}/status`, { isActive });
  }
}