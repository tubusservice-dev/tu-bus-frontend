import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ZoneListResponse,
  ZoneResponse,
  CheckNameResponse,
  CreateZoneRequest,
  UpdateZoneRequest,
} from '../../models/zone.model';

/**
 * Service for Zone CRUD operations.
 * All interfaces moved to models/zone.model.ts.
 */
@Injectable({
  providedIn: 'root',
})
export class ZoneService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/zones`;
  private readonly adminUrl = `${environment.apiUrl}/zones/admin`;

  // ==================== PUBLIC ====================

  /**
   * Get active zones only (for dropdowns and public views).
   */
  getActive(): Observable<ZoneListResponse> {
    return this.http.get<ZoneListResponse>(this.apiUrl);
  }

  /**
   * Get a single zone by ID with populated city.
   */
  getById(id: string): Observable<ZoneResponse> {
    return this.http.get<ZoneResponse>(`${this.apiUrl}/${id}`);
  }

  // ==================== ADMIN ====================

  /**
   * Get all zones including inactive (admin view).
   */
  getAllAdmin(): Observable<ZoneListResponse> {
    return this.http.get<ZoneListResponse>(this.adminUrl);
  }

  /**
   * Check if a zone name already exists (debounced frontend validation).
   */
  checkName(name: string): Observable<CheckNameResponse> {
    const params = new HttpParams().set('name', name);
    return this.http.get<CheckNameResponse>(`${this.adminUrl}/check-name`, { params });
  }

  /**
   * Create a new zone.
   */
  create(data: CreateZoneRequest): Observable<ZoneResponse> {
    return this.http.post<ZoneResponse>(this.adminUrl, data);
  }

  /**
   * Update an existing zone.
   */
  update(id: string, data: UpdateZoneRequest): Observable<ZoneResponse> {
    return this.http.put<ZoneResponse>(`${this.adminUrl}/${id}`, data);
  }

  /**
   * Delete a zone (blocked if BranchZones reference it).
   */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/${id}`);
  }
}
