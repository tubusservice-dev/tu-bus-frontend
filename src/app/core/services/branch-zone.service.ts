import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  BranchZoneListResponse,
  BranchZoneResponse,
  CreateBranchZoneBatchRequest,
  UpdateBranchZoneRequest,
} from '../../models/branch-zone.model';

/**
 * Service for BranchZone pivot operations.
 * Manages zone assignments to branches with delivery configuration.
 */
@Injectable({
  providedIn: 'root',
})
export class BranchZoneService {
  private readonly http = inject(HttpClient);
  private readonly adminUrl = `${environment.apiUrl}/branch-zones/admin`;

  /**
   * Get all BranchZones for a branch (populated with zone + city).
   */
  getByBranch(branchId: string): Observable<BranchZoneListResponse> {
    const params = new HttpParams().set('branchId', branchId);
    return this.http.get<BranchZoneListResponse>(this.adminUrl, { params });
  }

  /**
   * Get all BranchZones for a zone (populated with branch).
   */
  getByZone(zoneId: string): Observable<BranchZoneListResponse> {
    const params = new HttpParams().set('zoneId', zoneId);
    return this.http.get<BranchZoneListResponse>(this.adminUrl, { params });
  }

  /**
   * Create multiple BranchZones atomically.
   * DeliveryConfig auto-populated if not provided.
   */
  createBatch(data: CreateBranchZoneBatchRequest): Observable<BranchZoneListResponse> {
    return this.http.post<BranchZoneListResponse>(`${this.adminUrl}/batch`, data);
  }

  /**
   * Update delivery config of an existing BranchZone.
   */
  update(id: string, data: UpdateBranchZoneRequest): Observable<BranchZoneResponse> {
    return this.http.put<BranchZoneResponse>(`${this.adminUrl}/${id}`, data);
  }

  /**
   * Delete a single BranchZone.
   */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.adminUrl}/${id}`);
  }
}
