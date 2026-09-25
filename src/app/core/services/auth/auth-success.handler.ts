import { Injectable, inject } from '@angular/core';
import { ANALYTICS, CRASHLYTICS, AnalyticsEvent } from '@platform';
import { AuthResponse } from '@models';
import { AuthSessionStore, CLIENT_SESSION_SCOPE } from './auth-session.store';

/**
 * Single funnel for every successful client login (local, OAuth native,
 * account-link): persists the client session and reports the login to
 * telemetry.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthSuccessHandler {
  private readonly session = inject(AuthSessionStore);

  /**
   * Telemetry: associates analytics/crashlytics reports with the logged-in
   * user and tracks the login funnel event. Best-effort — every call is
   * fire-and-forget so telemetry never blocks the auth flow.
   */
  private readonly analytics = inject(ANALYTICS);
  private readonly crashlytics = inject(CRASHLYTICS);

  handle(response: AuthResponse): void {
    if (response.success && response.data && response.data.token) {
      this.session.startSession(response.data.token, response.data.user, CLIENT_SESSION_SCOPE);

      // Telemetry: single funnel for every client login (local, OAuth,
      // account-link). Correlate reports with the user, then track the event.
      const userId = response.data.user.id;
      void this.analytics.setUserId(userId);
      void this.crashlytics.setUserId(userId);
      void this.analytics.logEvent(AnalyticsEvent.Login);
    }
  }
}
