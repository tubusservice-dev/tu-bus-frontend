import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@env';
import { ApiResponse, MunicipalityCoverage, ParishDelivery } from '@models/geo.model';

/**
 * Who serves a place and on what delivery terms (`/api/geo/coverage`).
 * Not cached: the answer changes whenever the admin edits zones or branches.
 */
@Injectable({ providedIn: 'root' })
export class CoverageService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/geo/coverage`;

  municipality(municipalityId: string): Observable<MunicipalityCoverage> {
    return this.http
      .get<ApiResponse<MunicipalityCoverage>>(`${this.url}/municipalities/${municipalityId}`)
      .pipe(map((r) => r.data));
  }

  parish(parishId: string): Observable<ParishDelivery> {
    return this.http.get<ApiResponse<ParishDelivery>>(`${this.url}/parishes/${parishId}`).pipe(map((r) => r.data));
  }
}
