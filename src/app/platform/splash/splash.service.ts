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
 * Status bar: we set color + style on every cold start. Without this,
 * Android shows the default OS bar (which clashes with the brand on
 * some devices). Capacitor reads the config at native init but the
 * runtime call ensures consistency across launches and theme changes.
 *
 * On web: every method is a no-op. The web app uses CSS for branding.
 */
@Injectable({ providedIn: 'root' })
export class SplashService {
  private readonly platform = inject(PlatformService);

  /**
   * Applies the status bar style and hides the splash. Invoked from
   * APP_INITIALIZER once Angular bootstrap completes.
   *
   * Lazy imports keep the plugins out of the web bundle — `await import`
   * branches are pruned when `isNative()` is false.
   */
  async init(): Promise<void> {
    if (!this.platform.isNative()) return;

    // Status bar first so the colored bar is in place by the time the
    // splash hides; otherwise users would briefly see the default bar.
    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      await StatusBar.setBackgroundColor({ color: '#001D56' });
      await StatusBar.setStyle({ style: Style.Dark });
    } catch (err) {
      console.warn('[SplashService] StatusBar setup failed:', err);
    }

    // Hide splash. fadeOut for a smoother transition than an instant cut.
    try {
      const { SplashScreen } = await import('@capacitor/splash-screen');
      await SplashScreen.hide({ fadeOutDuration: 250 });
    } catch (err) {
      console.warn('[SplashService] SplashScreen.hide failed:', err);
    }
  }
}
