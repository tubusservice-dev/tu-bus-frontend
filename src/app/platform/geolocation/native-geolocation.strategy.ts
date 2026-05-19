import { Coordinates, IGeolocation } from './geolocation.service';

/**
 * Native geolocation via `@capacitor/geolocation`. Wraps the Android
 * FusedLocationProvider — combines GPS + cell tower + WiFi triangulation
 * for the best balance of accuracy and battery use.
 *
 * The plugin handles its own permission prompt the first time
 * `getCurrentPosition` is called. AndroidManifest must declare
 * `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` (added in P5.6).
 */
export class NativeGeolocationStrategy implements IGeolocation {
  isAvailable(): boolean {
    // The Capacitor plugin is always available on Android with Google
    // Play Services (essentially every consumer device in our market).
    return true;
  }

  async getCurrentPosition(): Promise<Coordinates> {
    const { Geolocation } = await import('@capacitor/geolocation');

    // Permission prompt fires inside getCurrentPosition the first time.
    // No need to call requestPermissions explicitly — the plugin does
    // it transparently and rejects if the user denies.
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 60000,
    });

    return {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
    };
  }
}
