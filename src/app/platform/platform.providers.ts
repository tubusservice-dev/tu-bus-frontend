import { EnvironmentProviders, Provider, makeEnvironmentProviders } from '@angular/core';
import { FirebaseMessagingService } from '@core/firebase';
import { PlatformService } from './platform.service';
import { STORAGE, IStorage } from './storage/storage.service';
import { WebStorageStrategy } from './storage/web-storage.strategy';
import { NativeStorageStrategy } from './storage/native-storage.strategy';
import { EXTERNAL_LINK, IExternalLink } from './external-link/external-link.service';
import { WebExternalLinkStrategy } from './external-link/web-external-link.strategy';
import { NativeExternalLinkStrategy } from './external-link/native-external-link.strategy';
import { GOOGLE_AUTH, IGoogleAuth } from './google-auth/google-auth.service';
import { WebGoogleAuthStrategy } from './google-auth/web-google-auth.strategy';
import { NativeGoogleAuthStrategy } from './google-auth/native-google-auth.strategy';
import { MESSAGING, IMessaging } from './messaging/messaging.service';
import { WebMessagingStrategy } from './messaging/web-messaging.strategy';
import { NativeMessagingStrategy } from './messaging/native-messaging.strategy';
import { CAMERA, ICamera } from './camera/camera.service';
import { WebCameraStrategy } from './camera/web-camera.strategy';
import { NativeCameraStrategy } from './camera/native-camera.strategy';
import { GEOLOCATION, IGeolocation } from './geolocation/geolocation.service';
import { WebGeolocationStrategy } from './geolocation/web-geolocation.strategy';
import { NativeGeolocationStrategy } from './geolocation/native-geolocation.strategy';
import { PRINT, IPrint } from './print/print.service';
import { WebPrintStrategy } from './print/web-print.strategy';
import { NativePrintStrategy } from './print/native-print.strategy';

/**
 * Returns the providers that bind every platform abstraction token to its
 * concrete strategy based on `PlatformService.isNative()`.
 *
 * Why a single bundle: every consumer of platform abstractions needs all
 * tokens resolved. Splitting by capability would force `app.config.ts` to
 * register N entries; bundling here keeps it to one `providePlatform()`
 * call. New capabilities added later (camera in Phase 5, biometric, etc.)
 * register inside this function.
 *
 * Why factories instead of `useClass`: the strategy choice is runtime
 * (depends on Capacitor.isNativePlatform()), not compile-time. The factory
 * receives PlatformService injected via `deps` and decides which class to
 * instantiate.
 *
 * Web safety: the native strategies are referenced statically below. They
 * import the Capacitor plugin types statically, BUT the actual plugin
 * runtime imports (e.g. `await import('@capacitor/preferences')`) are
 * dynamic — the bundler can split them off into chunks that only download
 * if the strategy is constructed. Since the factory short-circuits on web
 * (returns the Web*Strategy), the Native*Strategy chunks are never loaded.
 *
 * The web bundle does pay for the small TypeScript declarations, but
 * those are ~1 kB each — far below the 30 kB contractual ceiling.
 */
export function providePlatform(): EnvironmentProviders {
  return makeEnvironmentProviders([
    // PlatformService is providedIn: 'root' so it doesn't need to appear
    // here, but listing it keeps `providePlatform()` self-documenting.
    PlatformService,

    {
      provide: STORAGE,
      useFactory: (platform: PlatformService): IStorage =>
        platform.isNative() ? new NativeStorageStrategy() : new WebStorageStrategy(),
      deps: [PlatformService],
    },

    {
      provide: EXTERNAL_LINK,
      useFactory: (platform: PlatformService): IExternalLink =>
        platform.isNative() ? new NativeExternalLinkStrategy() : new WebExternalLinkStrategy(),
      deps: [PlatformService],
    },

    {
      provide: GOOGLE_AUTH,
      useFactory: (platform: PlatformService): IGoogleAuth =>
        platform.isNative() ? new NativeGoogleAuthStrategy() : new WebGoogleAuthStrategy(),
      deps: [PlatformService],
    },

    {
      provide: MESSAGING,
      useFactory: (platform: PlatformService, fcm: FirebaseMessagingService): IMessaging =>
        platform.isNative() ? new NativeMessagingStrategy() : new WebMessagingStrategy(fcm),
      // FirebaseMessagingService is injected unconditionally even on native;
      // the native strategy ignores it. Acceptable trade-off: it is already
      // providedIn root and ~5 kB of code that we'd ship anyway.
      deps: [PlatformService, FirebaseMessagingService],
    },

    {
      provide: CAMERA,
      useFactory: (platform: PlatformService): ICamera =>
        platform.isNative() ? new NativeCameraStrategy() : new WebCameraStrategy(),
      deps: [PlatformService],
    },

    {
      provide: GEOLOCATION,
      useFactory: (platform: PlatformService): IGeolocation =>
        platform.isNative() ? new NativeGeolocationStrategy() : new WebGeolocationStrategy(),
      deps: [PlatformService],
    },

    {
      provide: PRINT,
      useFactory: (platform: PlatformService): IPrint =>
        platform.isNative() ? new NativePrintStrategy() : new WebPrintStrategy(),
      deps: [PlatformService],
    },
  ] satisfies Provider[]);
}
