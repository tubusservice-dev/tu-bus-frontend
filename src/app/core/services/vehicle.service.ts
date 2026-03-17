import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Vehicle,
  VehicleListResponse,
  VehicleResponse,
  CreateVehicleRequest,
  UpdateVehicleRequest,
} from '../../models/vehicle.model';

@Injectable({
  providedIn: 'root',
})
export class VehicleService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/vehicles`;

  private readonly _vehicles = signal<Vehicle[]>([]);
  private readonly _selectedVehicle = signal<Vehicle | null>(null);
  private readonly _isLoading = signal(false);

  readonly vehicles = this._vehicles.asReadonly();
  readonly selectedVehicle = this._selectedVehicle.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly hasVehicles = computed(() => this._vehicles().length > 0);

  getMyVehicles(page = 1, limit = 20): Observable<VehicleListResponse> {
    const params = new HttpParams().set('page', page).set('limit', limit);
    this._isLoading.set(true);

    return this.http.get<VehicleListResponse>(this.apiUrl, { params }).pipe(
      tap({
        next: (res) => {
          this._vehicles.set(res.data);
          this._isLoading.set(false);
        },
        error: () => this._isLoading.set(false),
      })
    );
  }

  create(data: CreateVehicleRequest): Observable<VehicleResponse> {
    return this.http.post<VehicleResponse>(this.apiUrl, data).pipe(
      tap({
        next: (res) => {
          this._vehicles.update((v) => [res.data, ...v]);
        },
      })
    );
  }

  update(id: string, data: UpdateVehicleRequest): Observable<VehicleResponse> {
    return this.http.put<VehicleResponse>(`${this.apiUrl}/${id}`, data).pipe(
      tap({
        next: (res) => {
          this._vehicles.update((vehicles) =>
            vehicles.map((v) => (v.id === id ? res.data : v))
          );
          if (this._selectedVehicle()?.id === id) {
            this._selectedVehicle.set(res.data);
          }
        },
      })
    );
  }

  delete(id: string): Observable<{ success: boolean; message: string }> {
    return this.http.delete<{ success: boolean; message: string }>(`${this.apiUrl}/${id}`).pipe(
      tap({
        next: () => {
          this._vehicles.update((vehicles) => vehicles.filter((v) => v.id !== id));
          if (this._selectedVehicle()?.id === id) {
            this._selectedVehicle.set(null);
          }
        },
      })
    );
  }

  selectVehicle(vehicle: Vehicle | null): void {
    this._selectedVehicle.set(vehicle);
  }
}