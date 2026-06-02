/**
 * Platform layer barrel.
 *
 * Consumers should import from `@platform` (not from individual files) so
 * the public API stays explicit and refactor-friendly.
 *
 * Strategy implementations (`web-*-strategy.ts`, `native-*-strategy.ts`)
 * are intentionally NOT re-exported — they are internal to the layer and
 * are wired up by `providePlatform()`. Importing them directly elsewhere
 * defeats the abstraction.
 */
export { PlatformService } from './platform.service';
export { providePlatform } from './platform.providers';

// Storage
export { STORAGE, type IStorage } from './storage/storage.service';

// External links
export {
  EXTERNAL_LINK,
  type IExternalLink,
  type ExternalLinkTarget,
} from './external-link/external-link.service';

// Google Auth
export {
  GOOGLE_AUTH,
  type IGoogleAuth,
  type GoogleSignInResult,
} from './google-auth/google-auth.service';

// Apple Auth (iOS native only — no-op elsewhere)
export {
  APPLE_AUTH,
  type IAppleAuth,
  type AppleSignInResult,
} from './apple-auth/apple-auth.service';

// Messaging (push notifications)
export {
  MESSAGING,
  type IMessaging,
  type PushPayload,
} from './messaging/messaging.service';

// Camera (image picker)
export {
  CAMERA,
  type ICamera,
  type CameraSource,
  type PickImageOptions,
} from './camera/camera.service';

// Geolocation (GPS / coordinates)
export {
  GEOLOCATION,
  type IGeolocation,
  type Coordinates,
} from './geolocation/geolocation.service';

// Print (window.print on web, native PrintManager on Android)
export {
  PRINT,
  type IPrint,
  type PrintOptions,
} from './print/print.service';

// Analytics (GA4 on web, native GA SDK on Android/iOS)
export {
  ANALYTICS,
  AnalyticsEvent,
  type IAnalytics,
  type AnalyticsEventName,
} from './analytics/analytics.service';

// Crashlytics (native-only; no-op on web)
export { CRASHLYTICS, type ICrashlytics } from './crashlytics/crashlytics.service';

// Lifecycle services (no strategy split — single class with internal gating)
export { BackButtonService } from './back-button/back-button.service';
export { DeepLinksService } from './deep-links/deep-links.service';
export { BiometricService } from './biometric/biometric.service';
export { SplashService } from './splash/splash.service';
export { AnalyticsBootstrapService } from './analytics/analytics-bootstrap.service';
