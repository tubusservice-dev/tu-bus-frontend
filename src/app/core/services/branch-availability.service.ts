import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BranchAvailability, BranchAvailabilityResponse } from '../../models/branch-availability.model';

/**
 * Public client for `GET /api/branches/:id/availability`. The endpoint
 * returns the union of every active mechanic's schedule, which the home
 * oil change date picker uses to decide which Express/Tomorrow/Scheduled
 * options should be enabled.
 */
@Injectable({
  providedIn: 'root',
})
export class BranchAvailabilityService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/branches`;

  getByBranch(branchId: string): Observable<BranchAvailability> {
    return this.http
      .get<BranchAvailabilityResponse>(`${this.apiUrl}/${branchId}/availability`)
      .pipe(map((res) => res.data));
  }
}
