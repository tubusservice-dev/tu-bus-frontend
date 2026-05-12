import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env';
import { BranchAvailability, BranchAvailabilityResponse } from '@models/branch-availability.model';

/**
 * How the availability envelope is computed by the backend:
 *   - `mechanics` (default): union of every active mechanic assigned to the
 *     branch — used for the home oil-change flow.
 *   - `branch`: storefront schedule only, ignoring mechanics — used for the
 *     in-store oil-change flow, where the customer visits the branch.
 */
export type AvailabilityMode = 'mechanics' | 'branch';

/**
 * Public client for `GET /api/branches/:id/availability`. The endpoint
 * returns either the union of every active mechanic's schedule (default) or
 * the branch's own storefront schedule (`mode=branch`), depending on which
 * oil-change flow drives the picker.
 */
@Injectable({
  providedIn: 'root',
})
export class BranchAvailabilityService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/branches`;

  getByBranch(branchId: string, mode: AvailabilityMode = 'mechanics'): Observable<BranchAvailability> {
    const params = new HttpParams().set('mode', mode);
    return this.http
      .get<BranchAvailabilityResponse>(`${this.apiUrl}/${branchId}/availability`, { params })
      .pipe(map((res) => res.data));
  }
}
