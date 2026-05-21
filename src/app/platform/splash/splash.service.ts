import { Injectable, effect, inject } from '@angular/core';
import { PlatformService } from '../platform.service';
import { ThemeService } from '@core/services/theme.service';

/**
 * Splash + status bar lifecycle for native.
 *
 * Capacitor shows the launch splash automatically (configured in
 * `capacitor.config.ts`). This service is responsible for hiding it
 * AFTER Angular has bootstrapped, so the user never sees a flash of
 * blank WebView between splash and first paint.
 *
 * Status bar style: we react to `ThemeService.theme` so the OS icons
 * stay legible regardless of light/dark mode. We deliberately do NOT
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
  private readonly themeService = inject(ThemeService);

  /** Cached plugin module; loaded once on first sync to avoid re-imports. */
  private statusBarModule: typeof import('@capacitor/status-bar') | null = null;

  constructor() {
    // Keep the OS status-bar icon color in sync with the in-app theme.
    // `Style.Dark` = light icons (for dark headers), `Style.Light` = dark
    // icons (for light headers). The effect re-runs on every theme toggle
    // so users who switch dark/light at runtime see the change instantly.
    effect(() => {
      const theme = this.themeService.theme();
      void this.syncStatusBarStyle(theme === 'dark');
    });
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
   * Applies the matching status-bar icon style for the current theme.
   * No-op on web. Errors are swallowed because a transient plugin failure
   * must never block the UI thread or the boot sequence.
   */
  private async syncStatusBarStyle(isDark: boolean): Promise<void> {
    if (!this.platform.isNative()) return;

    try {
      const mod = this.statusBarModule ??= await import('@capacitor/status-bar');
      const style = isDark ? mod.Style.Dark : mod.Style.Light;
      await mod.StatusBar.setStyle({ style });
    } catch (err) {
      console.warn('[SplashService] StatusBar.setStyle failed:', err);
    }
  }
}
