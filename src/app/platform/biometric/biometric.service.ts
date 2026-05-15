import { Injectable, inject, signal } from '@angular/core';
import { PlatformService } from '../platform.service';
import { STORAGE, IStorage } from '../storage/storage.service';

/**
 * Storage keys used to persist the biometric opt-in flag. Lives in
 * Capacitor Preferences on native (so it survives app reinstalls within
 * the same device-account pairing) — irrelevant on web (the service
 * gates itself off there).
 */
const BIOMETRIC_ENROLLED_KEY = 'biometric_enabled';

/**
 * Biometric authentication service for native Android.
 *
 * Decision 1.3 (`05-decisions-log.md`): Option A — local flag.
 *   - On successful login, the user is offered the option to enable
 *     biometric quick-unlock.
 *   - When enabled, opening the app while a JWT exists in Preferences
 *     prompts for biometric instead of password.
 *   - Successful biometric → JWT is reused as-is.
 *   - Failed biometric (3 attempts) or "use password" → falls back to
 *     the standard auth modal.
 *
 * The biometric verification is hardware-backed (Android BiometricPrompt
 * since API 28; FingerprintManager fallback for API 23-27 — handled by
 * the plugin transparently).
 *
 * On web: every method short-circuits with the no-op behaviour
 * (`isAvailable()` returns false, `authenticate()` rejects). Web UI
 * never shows the biometric toggle because `isAvailable()` gates it.
 */
@Injectable({ providedIn: 'root' })
export class BiometricService {
  private readonly platform = inject(PlatformService);
  private readonly storage = inject<IStorage>(STORAGE);

  /**
   * Reactive view of whether the user has opted into biometric quick-unlock.
   * Hydrated by `loadEnrollmentState()` in APP_INITIALIZER. Components
   * read it via signal() to render toggles / settings rows.
   */
  private readonly enrolledSignal = signal(false);
  readonly isEnrolled = this.enrolledSignal.asReadonly();

  /**
   * Probes the device for biometric capability. Returns true on Android
   * devices that have hardware biometrics and at least one enrolled
   * fingerprint/face. Always false on web.
   *
   * Caches the result the first time so repeated calls are cheap.
   */
  private cachedAvailability: boolean | null = null;

  async isAvailable(): Promise<boolean> {
    if (!this.platform.isNative()) return false;
    if (this.cachedAvailability !== null) return this.cachedAvailability;

    try {
      const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
      const result = await NativeBiometric.isAvailable();
      this.cachedAvailability = result.isAvailable;
      return this.cachedAvailability;
    } catch {
      this.cachedAvailability = false;
      return false;
    }
  }

  /**
   * Reads the persisted opt-in flag and updates the signal. Call from
   * APP_INITIALIZER so consumers see the correct state at boot.
   */
  async loadEnrollmentState(): Promise<void> {
    if (!this.platform.isNative()) {
      this.enrolledSignal.set(false);
      return;
    }
    const value = await this.storage.get(BIOMETRIC_ENROLLED_KEY);
    this.enrolledSignal.set(value === 'true');
  }

  /**
   * Prompts the user for biometric verification (huella / face).
   * Returns true on success, false on user cancellation, throws on
   * hardware failure.
   *
   * `reason` is shown in the OS prompt; keep it short and contextual
   * ("Verifica tu huella para iniciar sesión", etc).
   */
  async authenticate(reason: string): Promise<boolean> {
    if (!this.platform.isNative()) return false;

    try {
      const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
      await NativeBiometric.verifyIdentity({
        reason,
        title: 'TuBus Express',
        subtitle: reason,
        // Allow the OS's own fallback (PIN/pattern) when biometric fails.
        // Hardware-level decision; the plugin enforces.
        useFallback: true,
      });
      return true;
    } catch (err) {
      // Plugin throws on user cancel, lockout, or hardware failure.
      // We don't differentiate at this layer — caller decides the UX.
      console.warn('[BiometricService] verifyIdentity rejected:', err);
      return false;
    }
  }

  /**
   * Persists the opt-in flag = true. Call after the user accepts the
   * post-login modal "Activar inicio rápido con huella?".
   */
  async enroll(): Promise<void> {
    if (!this.platform.isNative()) return;
    await this.storage.set(BIOMETRIC_ENROLLED_KEY, 'true');
    this.enrolledSignal.set(true);
  }

  /**
   * Persists the opt-in flag = false. Call from settings when the user
   * disables the quick-unlock, or automatically on logout (defensive —
   * a new user signing in shouldn't inherit the previous user's biometric).
   */
  async unenroll(): Promise<void> {
    if (!this.platform.isNative()) return;
    await this.storage.set(BIOMETRIC_ENROLLED_KEY, 'false');
    this.enrolledSignal.set(false);
  }
}
