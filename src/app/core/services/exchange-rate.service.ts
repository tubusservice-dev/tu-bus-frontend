import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SettingsService } from './settings.service';

export interface ExchangeRateData {
  rate: number;
  source: 'bcv' | 'manual';
  fetchedAt: string;
  updatedAt: string;
}

interface ExchangeRateResponse {
  success: boolean;
  data: ExchangeRateData | null;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ExchangeRateService {
  private readonly http = inject(HttpClient);
  private readonly settingsService = inject(SettingsService);

  private readonly publicUrl = `${environment.apiUrl}/exchange-rate`;
  private readonly adminUrl = `${environment.apiUrl}/admin/exchange-rate`;

  private readonly _currentRate = signal<number | null>(null);
  private readonly _rateData = signal<ExchangeRateData | null>(null);

  readonly currentRate = this._currentRate.asReadonly();
  readonly rateData = this._rateData.asReadonly();

  /** Whether Bs prices should be shown to the user */
  readonly showBsPrice = computed(() => {
    const settings = this.settingsService.settings();
    const rate = this._currentRate();
    return (settings?.exchangeRate?.showBsPrice ?? false) && rate !== null && rate > 0;
  });

  /**
   * Load the current exchange rate from public endpoint
   */
  loadCurrentRate(): void {
    this.http
      .get<ExchangeRateResponse>(`${this.publicUrl}/current`)
      .pipe(
        tap((response) => {
          if (response.data) {
            this._currentRate.set(response.data.rate);
            this._rateData.set(response.data);
          }
        }),
        catchError((error) => {
          console.warn('[ExchangeRate] Could not load current rate:', error);
          return of(null);
        })
      )
      .subscribe();
  }

  /**
   * Load rate from admin endpoint
   */
  loadAdminRate(): void {
    this.http
      .get<ExchangeRateResponse>(`${this.adminUrl}/current`)
      .pipe(
        tap((response) => {
          if (response.data) {
            this._currentRate.set(response.data.rate);
            this._rateData.set(response.data);
          }
        }),
        catchError((error) => {
          console.warn('[ExchangeRate] Could not load admin rate:', error);
          return of(null);
        })
      )
      .subscribe();
  }

  /**
   * Update rate manually (admin)
   */
  updateRate(rate: number) {
    return this.http.put<ExchangeRateResponse>(this.adminUrl, { rate }).pipe(
      tap((response) => {
        if (response.data) {
          this._currentRate.set(response.data.rate);
          this._rateData.set(response.data);
        }
      })
    );
  }

  /**
   * Convert USD amount to Bs
   */
  convertToBs(usdAmount: number): number | null {
    const rate = this._currentRate();
    if (!rate) return null;
    return usdAmount * rate;
  }

  /**
   * Format a USD amount as Bs string
   */
  formatBsPrice(usdAmount: number): string {
    const bs = this.convertToBs(usdAmount);
    if (bs === null) return '';
    return `Bs ${bs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}
