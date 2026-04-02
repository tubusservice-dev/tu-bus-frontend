import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  APP_INITIALIZER,
  inject,
} from '@angular/core';
import { provideRouter, withViewTransitions, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors';
import { AuthService, SettingsService } from './core/services';
import { ExchangeRateService } from './core/services/exchange-rate.service';

/**
 * Inicializa la sesión del usuario si existe un token guardado
 */
function initializeAuth(): () => Promise<void> {
  const authService = inject(AuthService);

  return async () => {
    const token = authService.getToken();
    if (token) {
      try {
        await firstValueFrom(authService.loadUserProfile());
      } catch {
        // Si falla, el token es inválido - se limpia en el servicio
      }
    }
  };
}

/**
 * Carga las configuraciones globales de la aplicación
 */
function initializeSettings(): () => Promise<void> {
  const settingsService = inject(SettingsService);
  const exchangeRateService = inject(ExchangeRateService);

  return async () => {
    try {
      await firstValueFrom(settingsService.loadSettings());
      // Load exchange rate after settings (non-blocking)
      exchangeRateService.loadCurrentRate();
    } catch {
      // Si falla, usa valores por defecto (ya manejado en el servicio)
    }
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withViewTransitions(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' })
    ),
    provideHttpClient(withInterceptors([
      authInterceptor,
    ])),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuth,
      multi: true,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeSettings,
      multi: true,
    },
  ]
};