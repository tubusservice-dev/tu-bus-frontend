import { Injectable, inject } from '@angular/core';
import { PlatformService } from '../platform.service';

/**
 * Splash + status bar lifecycle for native.
 *
 * Capacitor shows the launch splash automatically (configured in
 * `capacitor.config.ts`). This service is responsible for hiding it
 * AFTER Angular has bootstrapped, so the user never sees a flash of
 * blank WebView between splash and first paint.
 *
 * Status bar style: the app header is always dark blue in both light and
 * dark themes, so the OS icons are always forced to light (`Style.Dark`)
 * for legibility — independent of the in-app theme. We deliberately do NOT
 * call `setBackgroundColor`: on Android 15+ (targetSdk >= 35) that API
 * is silently ignored — the WebView itself paints the inset area via
 * the global header + `var(--safe-area-top, 0px)` in CSS, which is the
 * source of truth across web, legacy Android, and edge-to-edge Android.
 *
 * On web: every method is a no-op. The web app uses CSS for branding.
 */
@Injectable({ providedIn: 'root' })
export class SplashService {
  private readonly platform = inject(PlatformService);

  /** Cached plugin module; loaded once on first sync to avoid re-imports. */
  private statusBarModule: typeof import('@capacitor/status-bar') | null = null;

  constructor() {
    // The app header is always dark blue (#001D56) in both light and dark
    // themes, so the OS status-bar icons must always be light. This does not
    // depend on the in-app theme, so we apply it once instead of reacting to
    // theme changes.
    void this.applyStatusBarStyle();
  }

  /**
   * Hides the splash screen after Angular bootstrap. Invoked from
   * APP_INITIALIZER. The status-bar style is handled separately by the
   * theme effect in the constructor and does not need to wait for boot.
   *
   * Lazy import keeps the plugin out of the web bundle — the `await import`
   * branch is pruned when `isNative()` is false.
   */
  async init(): Promise<void> {
    if (!this.platform.isNative()) return;

    try {
      const { SplashScreen } = await import('@capacitor/splash-screen');
      await SplashScreen.hide({ fadeOutDuration: 250 });
    } catch (err) {
      console.warn('[SplashService] SplashScreen.hide failed:', err);
    }
  }

  /**
   * Forces light status-bar icons (legible over the always-dark header),
   * regardless of the in-app theme. No-op on web. Errors are swallowed
   * because a transient plugin failure must never block the UI thread or
   * the boot sequence.
   */
  private async applyStatusBarStyle(): Promise<void> {
    if (!this.platform.isNative()) return;

    try {
      const mod = this.statusBarModule ??= await import('@capacitor/status-bar');
      // `Style.Dark` = light icons — for the dark blue app header.
      await mod.StatusBar.setStyle({ style: mod.Style.Dark });
    } catch (err) {
      console.warn('[SplashService] StatusBar.setStyle failed:', err);
    }
  }
}
