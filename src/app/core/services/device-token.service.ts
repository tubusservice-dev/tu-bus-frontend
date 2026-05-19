import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import { PlatformService } from '@platform';
import {
  RegisterDeviceTokenRequest,
  RegisterDeviceTokenResponse,
} from '@models/device-token.model';

/**
 * Thin HTTP client over /api/device-tokens (and /api/admin/device-tokens).
 *
 * Stateless — UserNotificationService and AdminNotificationsService own
 * the lifecycle (when to register/unregister) and the captured token.
 *
 * The `platform` field on each request reflects the actual runtime
 * (`web`, `android`, or `ios`) so the backend can later filter / route
 * pushes per-platform if needed (e.g. silent vs alerting categories).
 */
@Injectable({ providedIn: 'root' })
export class DeviceTokenService {
  private readonly http = inject(HttpClient);
  private readonly platform = inject(PlatformService);

  /**
   * Returns the platform identifier the backend should record for this
   * device. Web SDK on web, Capacitor SDK on native — both produce FCM
   * tokens that Firebase Admin treats identically when dispatching.
   */
  private getPlatformLabel(): 'web' | 'android' | 'ios' {
    return this.platform.platformName();
  }

  registerForUser(token: string): Observable<RegisterDeviceTokenResponse> {
    const body: RegisterDeviceTokenRequest = {
      token,
      platform: this.getPlatformLabel(),
      userAgent: navigator.userAgent,
    };
    return this.http.post<RegisterDeviceTokenResponse>(
      `${environment.apiUrl}/device-tokens`,
      body
    );
  }

  unregisterForUser(token: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${environment.apiUrl}/device-tokens/${encodeURIComponent(token)}`
    );
  }

  registerForAdmin(token: string): Observable<RegisterDeviceTokenResponse> {
    const body: RegisterDeviceTokenRequest = {
      token,
      platform: this.getPlatformLabel(),
      userAgent: navigator.userAgent,
    };
    return this.http.post<RegisterDeviceTokenResponse>(
      `${environment.apiUrl}/admin/device-tokens`,
      body
    );
  }

  unregisterForAdmin(token: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${environment.apiUrl}/admin/device-tokens/${encodeURIComponent(token)}`
    );
  }
}
