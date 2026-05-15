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

// Messaging (push notifications)
export {
  MESSAGING,
  type IMessaging,
  type PushPayload,
} from './messaging/messaging.service';

// Lifecycle services (no strategy split — single class with internal gating)
export { BackButtonService } from './back-button/back-button.service';
export { DeepLinksService } from './deep-links/deep-links.service';
