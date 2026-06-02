import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { ANALYTICS } from './analytics.service';
import { CRASHLYTICS } from '../crashlytics/crashlytics.service';

/**
 * One-shot bootstrap for the telemetry layer, invoked from an
 * APP_INITIALIZER.
 *
 * Responsibilities:
 *  1. Turn on automatic data collection for both Analytics and Crashlytics
 *     (native caches the flag for the next run; web applies it live).
 *  2. Emit a `screen_view` on every SPA navigation. Doing it here — once,
 *     centrally — means feature components never import the analytics token
 *     just to track page views (SoC + DRY).
 *
 * The Router subscription lives for the whole app lifetime by design, so it
 * is intentionally not torn down. Fire-and-forget throughout: telemetry must
 * not delay or break bootstrap.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsBootstrapService {
  private readonly analytics = inject(ANALYTICS);
  private readonly crashlytics = inject(CRASHLYTICS);
  private readonly router = inject(Router);

  start(): void {
    void this.analytics.setEnabled(true);
    void this.crashlytics.setEnabled(true);

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        void this.analytics.setScreen(event.urlAfterRedirects);
      });
  }
}
