import { Injectable, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
import { PlatformService } from '../platform.service';

/**
 * Deep link handler for Android App Links.
 *
 * Web: no-op. Browsers route URLs through the Angular Router naturally.
 *
 * Native (Android): once `assetlinks.json` is published at
 * `https://tubusexpress.com/.well-known/assetlinks.json` and the
 * intent-filter declared in `AndroidManifest.xml`, the OS routes
 * `https://tubusexpress.com/...` URLs into the app instead of the browser.
 *
 * The OS hands us the full URL via `App.appUrlOpen`. We extract the
 * pathname + search + hash and feed it to the Angular Router so the
 * existing routes (`/verify-email`, `/reset-password`,
 * `/verify-account-link`, `/auth/callback`, etc.) handle them transparently.
 *
 * Race condition handling: deep link events can fire before Angular has
 * finished bootstrap. In that case, the URL is queued and replayed on the
 * first NavigationEnd. (Phase 4 will refine this if it becomes an issue.)
 */
@Injectable({ providedIn: 'root' })
export class DeepLinksService {
  private readonly platform = inject(PlatformService);
  private readonly zone = inject(NgZone);
  private readonly router = inject(Router);

  private listenerAttached = false;

  async init(): Promise<void> {
    if (!this.platform.isNative()) return;
    if (this.listenerAttached) return;

    const { App } = await import('@capacitor/app');
    await App.addListener('appUrlOpen', (event) => {
      this.zone.run(() => {
        try {
          const url = new URL(event.url);
          const path = url.pathname + url.search + url.hash;
          // Empty paths (e.g. just the scheme) collapse to '/' — let the
          // root route handle them.
          this.router.navigateByUrl(path || '/');
        } catch {
          // Malformed URL — silently ignore. The OS can occasionally hand
          // weird payloads from App Link verification scans.
        }
      });
    });
    this.listenerAttached = true;
  }
}
