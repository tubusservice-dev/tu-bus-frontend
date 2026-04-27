import {
  ApplicationConfig,
  ErrorHandler,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  APP_INITIALIZER,
  LOCALE_ID,
  inject,
} from '@angular/core';
import { provideRouter, withViewTransitions, withInMemoryScrolling, withNavigationErrorHandler } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors';
import { AuthService, SettingsService } from './core/services';
import { ExchangeRateService } from './core/services/exchange-rate.service';
import {
  ChunkLoadErrorHandler,
  isChunkLoadError,
  reloadOnceForStaleBuild,
} from './core/error-handlers/chunk-load-error.handler';

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
      // `disabled`: Angular does NOT touch scroll on any navigation. This
      // is critical for the overlay flow — `pushState` + popstate with any
      // other setting races with Angular's scroll-restore and resets the
      // catalog's scroll position to 0 on back. With disabled, the
      // OverlayStackService is the sole authority over scroll; forward
      // navigations scroll to top via a dedicated NavigationStart/End
      // listener in that service.
      withInMemoryScrolling({ scrollPositionRestoration: 'disabled' }),
      // Recover from stale-build errors after a deploy: when a lazy-loaded
      // route fails because its chunk no longer exists on the server, force
      // a single reload so the browser picks up the new index.html and
      // refreshed chunk references.
      withNavigationErrorHandler((error) => {
        if (isChunkLoadError(error)) reloadOnceForStaleBuild();
      })
    ),
    provideHttpClient(withInterceptors([
      authInterceptor,
    ])),
    { provide: ErrorHandler, useClass: ChunkLoadErrorHandler },
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