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
        void this.analytics.setScreen(this.toScreenName(event.urlAfterRedirects));
      });
  }

  /**
   * Normalises a router URL into a stable, readable screen name:
   *  - drops query string and fragment,
   *  - collapses id-like segments (Mongo ObjectId / numeric) to `:id` so
   *    `/perfil/pedidos/123` and `/perfil/pedidos/456` report as one screen
   *    instead of fragmenting the "Pages and screens" report and funnels.
   */
  private toScreenName(url: string): string {
    const path = url.split(/[?#]/)[0];
    const cleaned = path
      .split('/')
      .filter(Boolean)
      .map((seg) => (/^[0-9a-f]{24}$/i.test(seg) || /^\d+$/.test(seg) ? ':id' : seg))
      .join('/');
    return cleaned || 'home';
  }
}
