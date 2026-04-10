import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Mechanic,
  MechanicListResponse,
  MechanicResponse,
  CreateMechanicRequest,
  UpdateMechanicRequest,
  AddDateBlockRequest,
} from '../../models/mechanic.model';

@Injectable({
  providedIn: 'root',
})
export class MechanicService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/mechanics`;

  private readonly _mechanics = signal<Mechanic[]>([]);
  private readonly _isLoading = signal(false);

  readonly mechanics = this._mechanics.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  getAll(page = 1, limit = 10): Observable<MechanicListResponse> {
    const params = new HttpParams().set('page', page).set('limit', limit);

    this._isLoading.set(true);
    return this.http.get<MechanicListResponse>(this.apiUrl, { params }).pipe(
      tap({
        next: (res) => {
          this._mechanics.set(res.data);
          this._isLoading.set(false);
        },
        error: () => this._isLoading.set(false),
      })
    );
  }

  getById(id: string): Observable<MechanicResponse> {
    return this.http.get<MechanicResponse>(`${this.apiUrl}/${id}`);
  }

  create(data: CreateMechanicRequest): Observable<MechanicResponse> {
    return this.http.post<MechanicResponse>(this.apiUrl, data);
  }

  update(id: string, data: UpdateMechanicRequest): Observable<MechanicResponse> {
    return this.http.put<MechanicResponse>(`${this.apiUrl}/${id}`, data);
  }

  toggleStatus(id: string): Observable<MechanicResponse> {
    return this.http.patch<MechanicResponse>(`${this.apiUrl}/${id}/status`, {});
  }

  delete(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${id}`);
  }

  addDateBlock(id: string, data: AddDateBlockRequest): Observable<MechanicResponse> {
    return this.http.post<MechanicResponse>(`${this.apiUrl}/${id}/date-blocks`, data);
  }

  removeDateBlock(id: string, index: number): Observable<MechanicResponse> {
    return this.http.delete<MechanicResponse>(`${this.apiUrl}/${id}/date-blocks/${index}`);
  }
}
