import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import {
  RegisterDeviceTokenRequest,
  RegisterDeviceTokenResponse,
} from '@models/device-token.model';

/**
 * Thin HTTP client over /api/device-tokens (and /api/admin/device-tokens).
 *
 * Stateless — UserNotificationService and AdminNotificationsService own
 * the lifecycle (when to register/unregister) and the captured token.
 */
@Injectable({ providedIn: 'root' })
export class DeviceTokenService {
  private readonly http = inject(HttpClient);

  registerForUser(token: string): Observable<RegisterDeviceTokenResponse> {
    const body: RegisterDeviceTokenRequest = {
      token,
      platform: 'web',
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
      platform: 'web',
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
