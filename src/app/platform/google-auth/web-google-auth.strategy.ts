import { environment } from '@env';
import { GoogleSignInResult, IGoogleAuth } from './google-auth.service';

/**
 * Web Google sign-in: replicates the legacy flow used by the existing
 * `AuthService.loginWithOAuth` so behaviour is identical.
 *
 *   1. Store the current pathname so AuthCallback can route back.
 *   2. Navigate the browser to the backend's `/api/auth/google` endpoint.
 *   3. Backend → Passport → Google → callback → JWT in query string →
 *      AuthCallbackComponent persists JWT and routes the user.
 *
 * The promise resolves to `{ flow: 'web-redirect' }` synchronously
 * because `window.location.href` schedules a navigation; the caller
 * cannot rely on doing anything else after this. The signal is purely
 * informational.
 */
export class WebGoogleAuthStrategy implements IGoogleAuth {
  async signIn(): Promise<GoogleSignInResult> {
    try {
      localStorage.setItem('oauth_return_url', window.location.pathname);
    } catch {
      // Quota exceeded / disabled — not fatal, return URL just defaults to '/'.
    }
    window.location.href = `${environment.apiUrl}/auth/google`;
    return { flow: 'web-redirect' };
  }

  async signOut(): Promise<void> {
    // No-op on web. The backend JWT is the sole session — clearing it
    // is the existing AuthService.logout() responsibility.
  }
}
