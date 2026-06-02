import { AnalyticsEventName, IAnalytics } from './analytics.service';

/**
 * Native analytics strategy backed by `@capacitor-firebase/analytics`
 * (binds to the native Google Analytics for Firebase SDK).
 *
 * Lazy plugin import keeps the native dependency out of the web bundle —
 * the factory only instantiates this class on a native platform. All
 * methods are best-effort: a plugin failure resolves silently so analytics
 * never disrupts a user flow.
 */
export class NativeAnalyticsStrategy implements IAnalytics {
  async setEnabled(enabled: boolean): Promise<void> {
    try {
      const { FirebaseAnalytics } = await import('@capacitor-firebase/analytics');
      await FirebaseAnalytics.setEnabled({ enabled });
    } catch (err) {
      console.warn('[Analytics] setEnabled failed:', err);
    }
  }

  async logEvent(name: AnalyticsEventName, params?: Record<string, unknown>): Promise<void> {
    try {
      const { FirebaseAnalytics } = await import('@capacitor-firebase/analytics');
      await FirebaseAnalytics.logEvent({ name, params });
    } catch (err) {
      console.warn('[Analytics] logEvent failed:', err);
    }
  }

  async setUserId(userId: string | null): Promise<void> {
    try {
      const { FirebaseAnalytics } = await import('@capacitor-firebase/analytics');
      await FirebaseAnalytics.setUserId({ userId });
    } catch (err) {
      console.warn('[Analytics] setUserId failed:', err);
    }
  }

  async setScreen(screenName: string): Promise<void> {
    try {
      const { FirebaseAnalytics } = await import('@capacitor-firebase/analytics');
      await FirebaseAnalytics.setCurrentScreen({ screenName });
    } catch (err) {
      console.warn('[Analytics] setScreen failed:', err);
    }
  }
}
