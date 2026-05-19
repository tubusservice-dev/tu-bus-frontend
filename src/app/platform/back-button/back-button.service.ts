import { Injectable, NgZone, inject } from '@angular/core';
import { Location } from '@angular/common';
import { PlatformService } from '../platform.service';
import { OverlayStackService } from '@core/services/overlay-stack.service';

/**
 * Hardware back button manager for Android.
 *
 * Web: no-op. Browsers handle back via the History API; OverlayStackService
 * already syncs overlay state with `popstate` so nothing extra is needed.
 *
 * Native (Android): the OS dispatches the hardware back button to the
 * Capacitor `App.backButton` event, NOT to `window.popstate`. We bind a
 * listener that:
 *   1. Closes the top overlay if any (delegating to OverlayStackService.goBack).
 *   2. Otherwise, navigates back in the router history if possible.
 *   3. Otherwise, exits the app.
 *
 * `init()` is invoked once during app bootstrap by an APP_INITIALIZER.
 */
@Injectable({ providedIn: 'root' })
export class BackButtonService {
  private readonly platform = inject(PlatformService);
  private readonly zone = inject(NgZone);
  private readonly location = inject(Location);
  private readonly overlayStack = inject(OverlayStackService);

  private listenerAttached = false;

  async init(): Promise<void> {
    if (!this.platform.isNative()) return;
    if (this.listenerAttached) return;

    const { App } = await import('@capacitor/app');
    await App.addListener('backButton', ({ canGoBack }) => {
      // Capacitor invokes the listener outside the Angular zone — wrap so
      // signal updates trigger change detection.
      this.zone.run(async () => {
        if (this.overlayStack.isOpen()) {
          this.overlayStack.goBack();
          return;
        }
        if (canGoBack) {
          this.location.back();
          return;
        }
        // No history left — exit the app. The user already pressed back
        // at the root; the OS-standard behaviour is to dismiss the app.
        const { App: AppRef } = await import('@capacitor/app');
        await AppRef.exitApp();
      });
    });
    this.listenerAttached = true;
  }
}
