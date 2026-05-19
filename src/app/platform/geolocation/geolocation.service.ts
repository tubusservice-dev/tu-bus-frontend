import { InjectionToken } from '@angular/core';

/**
 * Result of a geolocation request. `accuracy` is in meters — typical
 * values: 5-20m on GPS, 50-2000m on network/IP fallback.
 */
export interface Coordinates {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface IGeolocation {
  /**
   * True when the platform exposes a usable geolocation API. On web,
   * requires HTTPS context (`navigator.geolocation` exists everywhere
   * but only works on secure origins). On native, requires Google Play
   * Services for FusedLocationProvider.
   */
  isAvailable(): boolean;

  /**
   * Resolves with the device's current position. Triggers the OS
   * permission prompt the first time (if not yet granted).
   *
   * Rejects when:
   *   - User denied the permission.
   *   - GPS / location services are off.
   *   - Timeout (15s default).
   */
  getCurrentPosition(): Promise<Coordinates>;
}

export const GEOLOCATION = new InjectionToken<IGeolocation>('PLATFORM_GEOLOCATION');
