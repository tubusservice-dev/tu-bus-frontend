import type { Analytics } from 'firebase/analytics';
import { environment } from '@env';
import { getFirebaseApp } from '@core/firebase';
import { AnalyticsEventName, IAnalytics } from './analytics.service';

/**
 * Web analytics strategy using the Firebase JS SDK (GA4).
 *
 * Mirrors the messaging pattern: web talks to `firebase/*` directly while
 * native uses the Capacitor plugin. We deliberately do NOT route through
 * the plugin's web layer — that would initialise a second Firebase app and
 * diverge from the `getFirebaseApp()` singleton already used by messaging.
 *
 * Hard gate: web analytics only activates when a `measurementId` is present
 * AND the browser passes `isSupported()` (excludes private-mode Safari,
 * ancient browsers, etc.). When the id is empty the whole strategy is an
 * inert no-op, so shipping before the owner fills the id breaks nothing.
 *
 * `firebase/analytics` is imported dynamically so the GA chunk only loads
 * when analytics actually initialises — zero cost to the initial paint.
 */
export class WebAnalyticsStrategy implements IAnalytics {
  /** Memoised init: resolves to the Analytics instance, or null when unavailable. */
  private analyticsPromise: Promise<Analytics | null> | null = null;

  private getAnalyticsInstance(): Promise<Analytics | null> {
    if (!this.analyticsPromise) {
      this.analyticsPromise = (async () => {
        if (!environment.firebase.measurementId) return null;
        try {
          const { getAnalytics, isSupported } = await import('firebase/analytics');
          if (!(await isSupported())) return null;
          const app = await getFirebaseApp();
          return getAnalytics(app);
        } catch (err) {
          console.warn('[Analytics] web init failed:', err);
          return null;
        }
      })();
    }
    return this.analyticsPromise;
  }

  async setEnabled(enabled: boolean): Promise<void> {
    const analytics = await this.getAnalyticsInstance();
    if (!analytics) return;
    try {
      const { setAnalyticsCollectionEnabled } = await import('firebase/analytics');
      setAnalyticsCollectionEnabled(analytics, enabled);
    } catch (err) {
      console.warn('[Analytics] setEnabled failed:', err);
    }
  }

  async logEvent(name: AnalyticsEventName, params?: Record<string, unknown>): Promise<void> {
    const analytics = await this.getAnalyticsInstance();
    if (!analytics) return;
    try {
      const { logEvent } = await import('firebase/analytics');
      logEvent(analytics, name, params);
    } catch (err) {
      console.warn('[Analytics] logEvent failed:', err);
    }
  }

  async setUserId(userId: string | null): Promise<void> {
    const analytics = await this.getAnalyticsInstance();
    if (!analytics) return;
    try {
      const { setUserId } = await import('firebase/analytics');
      // The modular SDK takes `string`; pass empty string to clear.
      setUserId(analytics, userId ?? '');
    } catch (err) {
      console.warn('[Analytics] setUserId failed:', err);
    }
  }

  async setScreen(screenName: string): Promise<void> {
    const analytics = await this.getAnalyticsInstance();
    if (!analytics) return;
    try {
      const { logEvent } = await import('firebase/analytics');
      // GA4 dropped `setCurrentScreen`; the canonical replacement is the
      // `screen_view` event with the reserved `firebase_screen*` params.
      logEvent(analytics, 'screen_view', {
        firebase_screen: screenName,
        firebase_screen_class: 'angular',
      });
    } catch (err) {
      console.warn('[Analytics] setScreen failed:', err);
    }
  }
}
