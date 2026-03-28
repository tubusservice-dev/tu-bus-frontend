import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CityListResponse, CityResponse } from '../../models/city.model';

/**
 * Service for City reference data (read-only).
 * Cities are seeded from backend — admin does not manage them.
 */
@Injectable({
  providedIn: 'root',
})
export class CityService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/cities`;

  /**
   * Get all active cities with municipalities.
   */
  getAll(): Observable<CityListResponse> {
    return this.http.get<CityListResponse>(this.apiUrl);
  }

  /**
   * Get a single city by slug.
   */
  getBySlug(slug: string): Observable<CityResponse> {
    return this.http.get<CityResponse>(`${this.apiUrl}/${slug}`);
  }
}
