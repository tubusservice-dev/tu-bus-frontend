import { Coordinates, IGeolocation } from './geolocation.service';

/**
 * Web geolocation: HTML5 `navigator.geolocation`.
 *
 * Works on `https://` only (modern browsers refuse on http://). The
 * permission prompt is browser-managed; we cannot pre-check granted
 * state, only handle the resolve/reject of the actual call.
 */
export class WebGeolocationStrategy implements IGeolocation {
  isAvailable(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      'geolocation' in navigator &&
      // Secure context required by modern browsers; isSecureContext
      // covers https://, localhost, and 127.0.0.1.
      (typeof window === 'undefined' || window.isSecureContext)
    );
  }

  getCurrentPosition(): Promise<Coordinates> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
      );
    });
  }
}
