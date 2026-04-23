import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, tap, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminResponseRequest,
  CreateReviewRequest,
  ReviewAdminSummaryResponse,
  ReviewListResponse,
  ReviewMaybeResponse,
  ReviewResponse,
  ReviewStats,
  ReviewStatsResponse,
  ReviewStatus,
} from '../../models/review.model';

type StatsCache = { value: ReviewStats; expiresAt: number } | null;

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/reviews`;
  private readonly adminApiUrl = `${environment.apiUrl}/admin/reviews`;

  private statsCache: StatsCache = null;
  private readonly STATS_TTL_MS = 60_000;

  // ==================== Public ====================

  getStats(): Observable<ReviewStats> {
    const now = Date.now();
    if (this.statsCache && this.statsCache.expiresAt > now) {
      return of(this.statsCache.value);
    }

    return this.http.get<ReviewStatsResponse>(`${this.apiUrl}/stats`).pipe(
      tap((res) => {
        this.statsCache = { value: res.data, expiresAt: Date.now() + this.STATS_TTL_MS };
      }),
      map((res) => res.data),
    );
  }

  // ==================== User ====================

  create(data: CreateReviewRequest): Observable<ReviewResponse> {
    return this.http.post<ReviewResponse>(this.apiUrl, data).pipe(
      tap(() => this.invalidateStatsCache()),
    );
  }

  getByOrder(orderId: string): Observable<ReviewMaybeResponse> {
    return this.http.get<ReviewMaybeResponse>(`${this.apiUrl}/order/${orderId}`);
  }

  getMyReviews(page = 1, limit = 10): Observable<ReviewListResponse> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    return this.http.get<ReviewListResponse>(`${this.apiUrl}/my`, { params });
  }

  // ==================== Admin ====================

  getAllAdmin(
    page = 1,
    limit = 20,
    filters?: { rating?: number; hasResponse?: boolean; status?: ReviewStatus },
  ): Observable<ReviewListResponse> {
    let params = new HttpParams().set('page', page).set('limit', limit);
    if (filters?.rating) params = params.set('rating', filters.rating);
    if (filters?.hasResponse !== undefined) params = params.set('hasResponse', String(filters.hasResponse));
    if (filters?.status) params = params.set('status', filters.status);

    return this.http.get<ReviewListResponse>(this.adminApiUrl, { params });
  }

  getSummaryAdmin(): Observable<ReviewAdminSummaryResponse> {
    return this.http.get<ReviewAdminSummaryResponse>(`${this.adminApiUrl}/summary`);
  }

  getByIdAdmin(id: string): Observable<ReviewResponse> {
    return this.http.get<ReviewResponse>(`${this.adminApiUrl}/${id}`);
  }

  respondAdmin(id: string, data: AdminResponseRequest): Observable<ReviewResponse> {
    return this.http.patch<ReviewResponse>(`${this.adminApiUrl}/${id}/response`, data);
  }

  deleteResponseAdmin(id: string): Observable<ReviewResponse> {
    return this.http.delete<ReviewResponse>(`${this.adminApiUrl}/${id}/response`);
  }

  updateVisibilityAdmin(id: string, status: ReviewStatus): Observable<ReviewResponse> {
    return this.http.patch<ReviewResponse>(`${this.adminApiUrl}/${id}/visibility`, { status });
  }

  invalidateStatsCache(): void {
    this.statsCache = null;
  }
}
