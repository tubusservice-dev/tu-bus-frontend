import { InjectionToken } from '@angular/core';

/**
 * Cross-platform crash reporting abstraction.
 *
 * Crashlytics is a NATIVE-ONLY product: the Firebase JS SDK has no
 * Crashlytics module. The web strategy is therefore a deliberate no-op —
 * web crash visibility relies on the existing `ChunkLoadErrorHandler` +
 * browser console (and, if ever needed, a separate web tool such as
 * Sentry). Consumers inject `CRASHLYTICS` unconditionally and never branch
 * on platform; the binding resolves to the no-op strategy on web.
 *
 * Native implementation wraps `@capacitor-firebase/crashlytics`, which
 * binds to the Firebase Crashlytics SDK (Android/iOS).
 *
 * Every method swallows its own errors: a telemetry failure must NEVER
 * propagate into the app's control flow or mask the original error being
 * reported.
 */
export interface ICrashlytics {
  /**
   * Enables/disables automatic crash data collection. The value only takes
   * effect on the next app run (Crashlytics caches it natively). Invoked
   * once at bootstrap. No-op on web.
   */
  setEnabled(enabled: boolean): Promise<void>;

  /**
   * Records a non-fatal exception so it surfaces in the Crashlytics
   * dashboard. `error` is optional context — when it is an `Error`, its
   * name/stack are folded into the recorded message. No-op on web.
   */
  recordException(message: string, error?: unknown): Promise<void>;

  /**
   * Appends a breadcrumb log line attached to subsequent crash reports.
   * No-op on web.
   */
  log(message: string): Promise<void>;

  /**
   * Associates subsequent reports with a user identifier (or clears it
   * when `null`). Lets us see which account hit a crash without storing
   * PII in the report body. No-op on web.
   */
  setUserId(userId: string | null): Promise<void>;
}

/**
 * DI token consumed by the global ErrorHandler and AuthService. The
 * concrete implementation is bound by `providePlatform()` in
 * `platform.providers.ts` based on `PlatformService.isNative()`.
 */
export const CRASHLYTICS = new InjectionToken<ICrashlytics>('PLATFORM_CRASHLYTICS');
