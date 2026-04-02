import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SettingsService } from './settings.service';

export interface ExchangeRateData {
  rate: number;
  customRate?: number;
  source: 'bcv' | 'manual';
  fetchedAt: string;
  updatedAt: string;
}

interface ExchangeRateResponse {
  success: boolean;
  data: ExchangeRateData | null;
  changed?: boolean;
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
  private readonly _customRate = signal<number | null>(null);
  private readonly _rateData = signal<ExchangeRateData | null>(null);

  readonly currentRate = this._currentRate.asReadonly();
  readonly customRate = this._customRate.asReadonly();
  readonly rateData = this._rateData.asReadonly();

  /** Whether custom rate is being used */
  readonly useCustomRate = computed(() => {
    const settings = this.settingsService.settings();
    return settings?.exchangeRate?.useCustomRate ?? false;
  });

  /** The effective rate used for Bs calculations */
  readonly effectiveRate = computed(() => {
    if (this.useCustomRate()) {
      const custom = this._customRate();
      return custom && custom > 0 ? custom : this._currentRate();
    }
    return this._currentRate();
  });

  /** Whether Bs prices should be shown to the user */
  readonly showBsPrice = computed(() => {
    const settings = this.settingsService.settings();
    const rate = this.effectiveRate();
    return (settings?.exchangeRate?.showBsPrice ?? false) && rate !== null && rate > 0;
  });

  private applyRateData(data: ExchangeRateData): void {
    this._currentRate.set(data.rate);
    this._customRate.set(data.customRate ?? null);
    this._rateData.set(data);
  }

  /**
   * Load the current exchange rate from public endpoint
   */
  loadCurrentRate(): void {
    this.http
      .get<ExchangeRateResponse>(`${this.publicUrl}/current`)
      .pipe(
        tap((response) => {
          if (response.data) this.applyRateData(response.data);
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
          if (response.data) this.applyRateData(response.data);
        }),
        catchError((error) => {
          console.warn('[ExchangeRate] Could not load admin rate:', error);
          return of(null);
        })
      )
      .subscribe();
  }

  /**
   * Refresh rate from BCV (admin triggered)
   */
  refreshRate() {
    return this.http.post<ExchangeRateResponse>(`${this.adminUrl}/refresh`, {}).pipe(
      tap((response) => {
        if (response.data) this.applyRateData(response.data);
      })
    );
  }

  /**
   * Update custom rate (admin)
   */
  updateCustomRate(customRate: number) {
    return this.http.put<ExchangeRateResponse>(`${this.adminUrl}/custom`, { customRate }).pipe(
      tap((response) => {
        if (response.data) this.applyRateData(response.data);
      })
    );
  }

  /**
   * Convert USD amount to Bs using the effective rate
   */
  convertToBs(usdAmount: number): number | null {
    const rate = this.effectiveRate();
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
