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
import { authInterceptor } from '@core/interceptors';
import { AuthService, SettingsService } from '@core/services';
import { ExchangeRateService } from '@core/services/exchange-rate.service';
import { PwaService } from '@core/services/pwa.service';
import {
  ChunkLoadErrorHandler,
  isChunkLoadError,
  reloadOnceForStaleBuild,
} from '@core/error-handlers/chunk-load-error.handler';
import {
  providePlatform,
  BackButtonService,
  DeepLinksService,
  SplashService,
  BiometricService,
} from '@platform';

// Register Spanish locale so the `date` pipe can format with 'es'
registerLocaleData(localeEs, 'es');

/**
 * Initializes the user session.
 *
 * BLOCKING: awaits `loadCacheFromStorage()` so the in-memory caches
 * (`tokenCacheSignal`, `userCacheSignal`) are populated before the first
 * HTTP request can fire. Without this, the auth interceptor would read
 * `getToken() = null` for any synchronous request issued during the
 * boot window and miss the Authorization header.
 *
 * The subsequent `loadUserProfile()` is NON-blocking — refreshing the
 * profile from the server can happen in the background after the app
 * is interactive.
 */
function initializeAuth(): () => Promise<void> {
  const authService = inject(AuthService);
  return async () => {
    await authService.loadCacheFromStorage();
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

/**
 * Wires up the PWA lifecycle listeners (install prompt, app installed,
 * service-worker update). Non-blocking — only attaches event listeners.
 */
function initializePwa(): () => void {
  const pwaService = inject(PwaService);
  return () => pwaService.init();
}

/**
 * Attaches the Capacitor `App.backButton` listener so the Android hardware
 * back button closes overlays / navigates back instead of exiting the app.
 * No-op on web (the BackButtonService self-gates via PlatformService).
 */
function initializeBackButton(): () => void {
  const backButton = inject(BackButtonService);
  return () => void backButton.init();
}

/**
 * Attaches the Capacitor `App.appUrlOpen` listener so https:// deep links
 * (verify-email, reset-password, auth callback, etc.) routed by Android
 * App Links navigate inside the app via Angular Router instead of opening
 * the browser. No-op on web.
 */
function initializeDeepLinks(): () => void {
  const deepLinks = inject(DeepLinksService);
  return () => void deepLinks.init();
}

/**
 * Configures the native status bar (color + icon style) and hides the
 * Capacitor splash screen once Angular has bootstrapped. No-op on web —
 * the web app uses CSS for branding.
 */
function initializeSplash(): () => void {
  const splash = inject(SplashService);
  return () => void splash.init();
}

/**
 * Hydrates the biometric opt-in flag from native Preferences so the UI
 * shows the correct toggle state at boot. No-op on web.
 */
function initializeBiometric(): () => void {
  const biometric = inject(BiometricService);
  return () => void biometric.loadEnrollmentState();
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
    // Platform layer: binds STORAGE / EXTERNAL_LINK / GOOGLE_AUTH / MESSAGING
    // tokens to the correct strategy (web or native) based on PlatformService.
    // Cero impacto web — strategies web envuelven el comportamiento actual.
    providePlatform(),
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
    {
      provide: APP_INITIALIZER,
      useFactory: initializePwa,
      multi: true,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeBackButton,
      multi: true,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeDeepLinks,
      multi: true,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeSplash,
      multi: true,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeBiometric,
      multi: true,
    },
    { provide: LOCALE_ID, useValue: 'es' },
  ]
};