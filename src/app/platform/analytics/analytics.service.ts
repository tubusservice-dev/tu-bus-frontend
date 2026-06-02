import { InjectionToken } from '@angular/core';

/**
 * Canonical analytics event names used across the app.
 *
 * Centralised so call sites cannot drift into typos (`add_to_cart` vs
 * `addToCart`) that would fragment funnels in the GA4 dashboard. Values
 * mirror Firebase/GA4 recommended event names where one exists, so the
 * console shows them with native semantics and pre-built reports.
 */
export const AnalyticsEvent = {
  Login: 'login',
  Logout: 'logout',
  SignUp: 'sign_up',
  ViewItemList: 'view_item_list',
  SelectItem: 'select_item',
  ViewItem: 'view_item',
  AddToCart: 'add_to_cart',
  RemoveFromCart: 'remove_from_cart',
  ViewCart: 'view_cart',
  BeginCheckout: 'begin_checkout',
  AddShippingInfo: 'add_shipping_info',
  AddPaymentInfo: 'add_payment_info',
  Purchase: 'purchase',
  Search: 'search',
} as const;

export type AnalyticsEventName =
  (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent] | (string & {});

/**
 * Cross-platform product analytics abstraction.
 *
 * Web strategy uses the Firebase JS SDK (`firebase/analytics`, GA4),
 * reusing the singleton app from `core/firebase`. Native strategy uses
 * `@capacitor-firebase/analytics` (native GA SDK). Consumers inject
 * `ANALYTICS` and never branch on platform.
 *
 * Every method is best-effort and swallows its own errors: analytics must
 * never break a user flow.
 */
export interface IAnalytics {
  /**
   * Enables/disables automatic data collection. Invoked once at bootstrap.
   * Lets a future privacy opt-out toggle flip collection at runtime.
   */
  setEnabled(enabled: boolean): Promise<void>;

  /** Logs a custom or GA4-recommended event with optional parameters. */
  logEvent(name: AnalyticsEventName, params?: Record<string, unknown>): Promise<void>;

  /** Associates subsequent events with a user id (or clears it on `null`). */
  setUserId(userId: string | null): Promise<void>;

  /**
   * Sets a user-scoped property (e.g. `zone`, `branch`) attached to ALL
   * subsequent events, enabling segmentation across every report. Pass
   * `null` to clear. Requires registering a matching custom dimension in
   * the GA4 console for the property to surface as a reportable column.
   */
  setUserProperty(name: string, value: string | null): Promise<void>;

  /**
   * Records a screen view. Native uses `setCurrentScreen`; web emits the
   * GA4 `screen_view` event (the modular SDK dropped `setCurrentScreen`).
   */
  setScreen(screenName: string): Promise<void>;
}

/**
 * DI token bound by `providePlatform()` in `platform.providers.ts` based on
 * `PlatformService.isNative()`.
 */
export const ANALYTICS = new InjectionToken<IAnalytics>('PLATFORM_ANALYTICS');
