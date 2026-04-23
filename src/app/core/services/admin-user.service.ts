import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AdminUser, UserRole, UserStatus } from '../../models';
import { Order } from '../../models/order.model';
import { Vehicle } from '../../models/vehicle.model';

export interface AdminUserFilters {
  page?: number;
  limit?: number;
  role?: UserRole;
  status?: UserStatus;
  isVerified?: boolean;
  hasOAuth?: boolean;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface AdminUserListResponse {
  success: boolean;
  data: AdminUser[];
  pagination: {
    total: number;
    pages: number;
    page: number;
    limit: number;
  };
}

export interface AdminUserDetailResponse {
  success: boolean;
  data: AdminUser;
}

export interface AdminUserStatsResponse {
  success: boolean;
  data: {
    ordersTotal: number;
    ordersByStatus: Record<string, number>;
    totalSpent: number;
    averageTicket: number;
    lastOrderAt: string | null;
    vehiclesTotal: number;
    registeredAt: string;
  };
}

export interface AdminUserOrdersResponse {
  success: boolean;
  data: Order[];
  pagination: { total: number; pages: number; page: number; limit: number };
}

export interface AdminUserVehiclesResponse {
  success: boolean;
  data: Vehicle[];
  pagination: { total: number; pages: number };
}

export interface UpdateUserStatusRequest {
  status: UserStatus;
  reason?: string;
  suspendedUntil?: string;
}

export interface AdminUpdateUserRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  alternativePhone?: string;
  role?: UserRole;
  isVerified?: boolean;
  address?: string;
  stateCode?: string;
  stateName?: string;
  cityCode?: string;
  cityName?: string;
  municipalityCode?: string;
  municipalityName?: string;
  neighborhood?: string;
  street?: string;
  houseNumber?: string;
  referencePoint?: string;
  zipCode?: string;
  companyName?: string;
  companyRif?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminUserService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/users`;

  private buildParams(filters: AdminUserFilters): HttpParams {
    let params = new HttpParams();
    if (filters.page) params = params.set('page', filters.page);
    if (filters.limit) params = params.set('limit', filters.limit);
    if (filters.role) params = params.set('role', filters.role);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.isVerified !== undefined) params = params.set('isVerified', filters.isVerified);
    if (filters.hasOAuth !== undefined) params = params.set('hasOAuth', filters.hasOAuth);
    if (filters.dateFrom) params = params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params = params.set('dateTo', filters.dateTo);
    if (filters.search) params = params.set('search', filters.search);
    return params;
  }

  getAll(filters: AdminUserFilters = {}): Observable<AdminUserListResponse> {
    return this.http.get<AdminUserListResponse>(this.apiUrl, { params: this.buildParams(filters) });
  }

  getById(id: string): Observable<AdminUserDetailResponse> {
    return this.http.get<AdminUserDetailResponse>(`${this.apiUrl}/${id}`);
  }

  getOrders(
    id: string,
    page = 1,
    limit = 10,
    status?: string,
    search?: string
  ): Observable<AdminUserOrdersResponse> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (status) params = params.set('status', status);
    if (search) params = params.set('search', search);
    return this.http.get<AdminUserOrdersResponse>(`${this.apiUrl}/${id}/orders`, { params });
  }

  getVehicles(id: string): Observable<AdminUserVehiclesResponse> {
    return this.http.get<AdminUserVehiclesResponse>(`${this.apiUrl}/${id}/vehicles`);
  }

  getStats(id: string): Observable<AdminUserStatsResponse> {
    return this.http.get<AdminUserStatsResponse>(`${this.apiUrl}/${id}/stats`);
  }

  update(id: string, data: AdminUpdateUserRequest): Observable<AdminUserDetailResponse> {
    return this.http.put<AdminUserDetailResponse>(`${this.apiUrl}/${id}`, data);
  }

  updateStatus(id: string, data: UpdateUserStatusRequest): Observable<AdminUserDetailResponse> {
    return this.http.patch<AdminUserDetailResponse>(`${this.apiUrl}/${id}/status`, data);
  }

  delete(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${id}`);
  }
}
