import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  APP_INITIALIZER,
  LOCALE_ID,
  inject,
} from '@angular/core';
import { provideRouter, withViewTransitions, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors';
import { AuthService, SettingsService } from './core/services';
import { ExchangeRateService } from './core/services/exchange-rate.service';

// Register Spanish locale so the `date` pipe can format with 'es'
registerLocaleData(localeEs, 'es');

/**
 * Initializes user session if a stored token exists (non-blocking)
 */
function initializeAuth(): () => void {
  const authService = inject(AuthService);

  return () => {
    const token = authService.getToken();
    if (token) {
      authService.loadUserProfile().subscribe();
    }
  };
}

/**
 * Loads global application settings (non-blocking)
 */
function initializeSettings(): () => void {
  const settingsService = inject(SettingsService);
  const exchangeRateService = inject(ExchangeRateService);

  return () => {
    settingsService.loadSettings().subscribe({
      next: () => {
        exchangeRateService.loadCurrentRate();
      }
    });
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
    { provide: LOCALE_ID, useValue: 'es' },
  ]
};