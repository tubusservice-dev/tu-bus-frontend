import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, map, of, shareReplay } from 'rxjs';
import { environment } from '@env';
import {
  ApiResponse,
  BranchAssignmentSave,
  CreateGeoZoneRequest,
  GeoAdminTree,
  GeoCoverageState,
  GeoState,
  UpdateGeoZoneRequest,
} from '@models/geo.model';
import { Zone } from '@models/zone.model';
import { BranchZone } from '@models/branch-zone.model';

/**
 * Admin access to the geographic catalogue and to the v2 writes of zones and
 * branch assignments (`/api/admin/geo`).
 *
 * The catalogue is fixed (official data file, loaded by the server), so state
 * trees are cached per state for the page lifetime.
 */
@Injectable({ providedIn: 'root' })
export class GeoAdminService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/admin/geo`;
  private readonly trees = new Map<string, Observable<GeoAdminTree>>();
  private coverage: Observable<GeoCoverageState[]> | null = null;

  listStates(): Observable<GeoState[]> {
    return this.http.get<ApiResponse<GeoState[]>>(`${this.url}/states`).pipe(map((r) => r.data));
  }

  getTree(stateId: string): Observable<GeoAdminTree> {
    let tree = this.trees.get(stateId);
    if (!tree) {
      const params = new HttpParams().set('stateId', stateId);
      tree = this.http.get<ApiResponse<GeoAdminTree>>(`${this.url}/tree`, { params }).pipe(
        map((r) => r.data),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.trees.set(stateId, tree);
    }
    return tree;
  }

  /** Trees of several states (a zone may span more than one), in the given order. */
  getTrees(stateIds: readonly string[]): Observable<GeoAdminTree[]> {
    return stateIds.length ? forkJoin(stateIds.map((id) => this.getTree(id))) : of([]);
  }

  /** Where there is service today (public coverage tree): states first, then municipalities. */
  getCoverage(): Observable<GeoCoverageState[]> {
    this.coverage ??= this.http
      .get<ApiResponse<GeoCoverageState[]>>(`${environment.apiUrl}/geo/coverage-tree`)
      .pipe(map((r) => r.data), shareReplay({ bufferSize: 1, refCount: false }));
    return this.coverage;
  }

  invalidateTrees(): void {
    this.trees.clear();
    this.coverage = null;
  }

  // ==================== zones and assignments ====================

  createZone(request: CreateGeoZoneRequest): Observable<Zone> {
    return this.http.post<ApiResponse<Zone>>(`${this.url}/zones`, request).pipe(map((r) => r.data));
  }

  updateZone(id: string, request: UpdateGeoZoneRequest): Observable<Zone> {
    return this.http.put<ApiResponse<Zone>>(`${this.url}/zones/${id}`, request).pipe(map((r) => r.data));
  }

  /** Saves every zone of a branch in one go: all of it is stored, or none. */
  saveBranchAssignments(branchId: string, assignments: BranchAssignmentSave[]): Observable<BranchZone[]> {
    return this.http
      .put<ApiResponse<BranchZone[]>>(`${this.url}/branches/${branchId}/assignments`, { assignments })
      .pipe(map((r) => r.data));
  }
}
