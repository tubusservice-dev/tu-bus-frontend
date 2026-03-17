import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  Settings,
  SettingsResponse,
  WhatsAppConfig,
  CarouselsConfig,
  HomeHeroConfig,
  PaginationConfig,
  UpdateDispatchDto,
  DEFAULT_SETTINGS,
  STORE_COLORS,
  ADMIN_COLORS,
} from '../../models/settings.model';

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly publicUrl = `${environment.apiUrl}/settings`;
  private readonly adminUrl = `${environment.apiUrl}/admin/settings`;

  // Estado reactivo de las configuraciones
  private readonly _settings = signal<Settings>(DEFAULT_SETTINGS);
  private readonly _isLoaded = signal(false);
  private routerSubscribed = false;

  // Exposición de señales de solo lectura
  readonly settings = this._settings.asReadonly();
  readonly isLoaded = this._isLoaded.asReadonly();

  // Computed para acceso rápido a configuraciones específicas
  readonly whatsappConfig = computed(() => this._settings().whatsapp);
  readonly carouselsConfig = computed(() => this._settings().carousels);
  readonly homeHeroConfig = computed(() => this._settings().homeHero);
  readonly paginationConfig = computed(() => this._settings().pagination);
  readonly dispatchConfig = computed(() => this._settings().dispatch);

  /**
   * Cargar configuraciones desde el servidor (público)
   */
  loadSettings(): Observable<SettingsResponse> {
    return this.http.get<SettingsResponse>(this.publicUrl).pipe(
      tap((response) => {
        if (response.data) {
          // Mezclar con defaults para asegurar que todos los campos existen
          const mergedSettings: Settings = {
            ...DEFAULT_SETTINGS,
            ...response.data,
            pagination: {
              ...DEFAULT_SETTINGS.pagination,
              ...response.data.pagination,
            },
            dispatch: {
              modules: {
                ...DEFAULT_SETTINGS.dispatch.modules,
                ...response.data.dispatch?.modules,
              },
              storePickup: {
                ...DEFAULT_SETTINGS.dispatch.storePickup,
                ...response.data.dispatch?.storePickup,
              },
            },
          };
          this._settings.set(mergedSettings);
          this._isLoaded.set(true);
          this.applyColors();
          this.subscribeToRouterEvents();
        }
      }),
      catchError((error) => {
        console.warn('Error cargando configuraciones, usando valores por defecto:', error);
        this._settings.set(DEFAULT_SETTINGS);
        this._isLoaded.set(true);
        this.applyColors();
        this.subscribeToRouterEvents();
        return of({ success: true, data: DEFAULT_SETTINGS });
      })
    );
  }

  /**
   * Suscribirse a eventos del router para aplicar colores al navegar
   */
  private subscribeToRouterEvents(): void {
    if (this.routerSubscribed) return;
    this.routerSubscribed = true;

    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.applyColors();
      });
  }

  /**
   * Obtener configuraciones (admin)
   */
  getSettings(): Observable<SettingsResponse> {
    return this.http.get<SettingsResponse>(this.adminUrl);
  }

  /**
   * Actualizar configuración de WhatsApp
   */
  updateWhatsApp(data: Partial<WhatsAppConfig>): Observable<SettingsResponse> {
    return this.http.put<SettingsResponse>(`${this.adminUrl}/whatsapp`, data).pipe(
      tap((response) => {
        if (response.data) {
          this._settings.set(response.data);
        }
      })
    );
  }

  /**
   * Actualizar configuración de carruseles
   */
  updateCarousels(data: Partial<CarouselsConfig>): Observable<SettingsResponse> {
    return this.http.put<SettingsResponse>(`${this.adminUrl}/carousels`, data).pipe(
      tap((response) => {
        if (response.data) {
          this._settings.set(response.data);
        }
      })
    );
  }

  /**
   * Actualizar configuración del Home Hero
   */
  updateHomeHero(data: Partial<HomeHeroConfig>): Observable<SettingsResponse> {
    return this.http.put<SettingsResponse>(`${this.adminUrl}/home-hero`, data).pipe(
      tap((response) => {
        if (response.data) {
          this._settings.set(response.data);
        }
      })
    );
  }

  /**
   * Actualizar configuración de paginación
   */
  updatePagination(data: Partial<PaginationConfig>): Observable<SettingsResponse> {
    return this.http.put<SettingsResponse>(`${this.adminUrl}/pagination`, data).pipe(
      tap((response) => {
        if (response.data) {
          // Mezclar con defaults para asegurar que todos los campos existen
          const mergedSettings: Settings = {
            ...DEFAULT_SETTINGS,
            ...response.data,
            pagination: {
              ...DEFAULT_SETTINGS.pagination,
              ...response.data.pagination,
            },
          };
          this._settings.set(mergedSettings);
        }
      })
    );
  }

  /**
   * Actualizar configuración de despacho
   */
  updateDispatch(data: UpdateDispatchDto): Observable<SettingsResponse> {
    return this.http.put<SettingsResponse>(`${this.adminUrl}/dispatch`, data).pipe(
      tap((response) => {
        if (response.data) {
          const mergedSettings: Settings = {
            ...DEFAULT_SETTINGS,
            ...response.data,
            dispatch: {
              modules: {
                ...DEFAULT_SETTINGS.dispatch.modules,
                ...response.data.dispatch?.modules,
              },
              storePickup: {
                ...DEFAULT_SETTINGS.dispatch.storePickup,
                ...response.data.dispatch?.storePickup,
              },
            },
          };
          this._settings.set(mergedSettings);
        }
      })
    );
  }

  /**
   * Aplicar colores según la ruta actual (usando colores configurados en código)
   */
  applyColors(): void {
    const isAdminRoute = this.router.url.startsWith('/admin');
    if (isAdminRoute) {
      this.applyColorConfig(ADMIN_COLORS);
    } else {
      this.applyColorConfig(STORE_COLORS);
    }
  }

  /**
   * Aplicar configuración de colores a CSS variables
   */
  private applyColorConfig(colors: { primary: string; secondary: string }): void {
    const root = document.documentElement;
    root.style.setProperty('--accent-primary', colors.primary);
    root.style.setProperty('--accent-hover', this.darkenColor(colors.primary, 15));
    root.style.setProperty('--accent-light', this.lightenColor(colors.primary, 90));
    root.style.setProperty('--accent-secondary', colors.secondary);
  }

  /**
   * Oscurecer un color hexadecimal
   */
  private darkenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max((num >> 16) - amt, 0);
    const G = Math.max(((num >> 8) & 0x00ff) - amt, 0);
    const B = Math.max((num & 0x0000ff) - amt, 0);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  }

  /**
   * Aclarar un color hexadecimal (para fondos claros)
   */
  private lightenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min((num >> 16) + amt, 255);
    const G = Math.min(((num >> 8) & 0x00ff) + amt, 255);
    const B = Math.min((num & 0x0000ff) + amt, 255);
    return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
  }
}
