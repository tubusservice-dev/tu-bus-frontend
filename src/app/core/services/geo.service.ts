import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';
import { environment } from '@env';
import {
  ApiResponse,
  GeoCity,
  GeoCoverageState,
  GeoMunicipality,
  GeoParish,
  GeoPlace,
  GeoSearchHit,
  GeoState,
} from '@models/geo.model';

/**
 * Public geographic catalogue (`/api/geo`): the national cascade, the search
 * box, where there is service, and the bridge from locations saved by the
 * previous version. Stateless HTTP; the catalogue is fixed, so each list is
 * fetched once per page lifetime.
 */
@Injectable({ providedIn: 'root' })
export class GeoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/geo`;
  private readonly cache = new Map<string, Observable<unknown>>();

  states(): Observable<GeoState[]> {
    return this.cached('states', '/states');
  }

  municipalities(stateId: string): Observable<GeoMunicipality[]> {
    return this.cached(`m:${stateId}`, `/states/${stateId}/municipalities`);
  }

  cities(municipalityId: string): Observable<GeoCity[]> {
    return this.cached(`c:${municipalityId}`, `/municipalities/${municipalityId}/cities`);
  }

  parishes(cityId: string): Observable<GeoParish[]> {
    return this.cached(`p:${cityId}`, `/cities/${cityId}/parishes`);
  }

  /** States and municipalities with service today. Not cached: coverage changes when the admin edits zones. */
  coverageTree(): Observable<GeoCoverageState[]> {
    return this.http.get<ApiResponse<GeoCoverageState[]>>(`${this.url}/coverage-tree`).pipe(map((r) => r.data));
  }

  /** Municipalities matching `q` (at least 2 characters); with `coveredOnly`, only where there is service. */
  search(q: string, coveredOnly = false): Observable<GeoSearchHit[]> {
    let params = new HttpParams().set('q', q);
    if (coveredOnly) params = params.set('coveredOnly', 'true');
    return this.http.get<ApiResponse<GeoSearchHit[]>>(`${this.url}/search`, { params }).pipe(map((r) => r.data));
  }

  /** The state and municipality a location saved by the previous version stands for, or null. */
  legacyResolve(citySlug: string, municipalitySlug: string): Observable<{ state: GeoPlace; municipality: GeoPlace } | null> {
    const params = new HttpParams().set('citySlug', citySlug).set('municipality', municipalitySlug);
    return this.http
      .get<ApiResponse<{ state: GeoPlace; municipality: GeoPlace } | null>>(`${this.url}/legacy-resolve`, { params })
      .pipe(map((r) => r.data));
  }

  private cached<T>(key: string, path: string): Observable<T> {
    let request = this.cache.get(key) as Observable<T> | undefined;
    if (!request) {
      request = this.http.get<ApiResponse<T>>(`${this.url}${path}`).pipe(
        map((r) => r.data),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.cache.set(key, request);
    }
    return request;
  }
}
