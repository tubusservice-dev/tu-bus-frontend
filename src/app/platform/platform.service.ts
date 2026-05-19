import { Injectable, Signal, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';

/**
 * Single source of truth for runtime platform detection.
 *
 * Why a dedicated service: every other piece of the platform layer
 * (storage, auth, messaging, etc.) decides which strategy to use based on
 * `isNative()`. Centralising the detection here means switching detection
 * libraries (or adding capability checks like `hasBiometrics` in Phase 5)
 * touches one file, not the whole codebase.
 *
 * Why import `@capacitor/core` statically: it is the runtime kernel — only
 * ~5 kB. Plugins that pull in real native code (camera, biometric) are
 * imported dynamically inside their respective native strategies so the
 * web bundle does not pay for them.
 *
 * Snapshot semantics: platform identity does NOT change during a session
 * (a web session never becomes native, and vice versa). We therefore read
 * once at construction and expose readonly signals — consumers read with
 * the same `signal()` ergonomics as anywhere else in the codebase.
 */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly platform = Capacitor.getPlatform(); // 'web' | 'android' | 'ios'
  private readonly nativeFlag = Capacitor.isNativePlatform();

  /** True when running inside a Capacitor-wrapped app (Android or iOS). */
  readonly isNative: Signal<boolean> = signal(this.nativeFlag).asReadonly();

  /** True when running on Android (only inside the native app). */
  readonly isAndroid: Signal<boolean> = signal(this.platform === 'android').asReadonly();

  /** True when running on iOS (only inside the native app, future Phase B). */
  readonly isIos: Signal<boolean> = signal(this.platform === 'ios').asReadonly();

  /** True when running in a browser (any non-native context). */
  readonly isWeb: Signal<boolean> = signal(!this.nativeFlag).asReadonly();

  /** Raw platform identifier — useful for analytics tagging. */
  readonly platformName: Signal<'web' | 'android' | 'ios'> = signal(
    this.platform as 'web' | 'android' | 'ios'
  ).asReadonly();
}
