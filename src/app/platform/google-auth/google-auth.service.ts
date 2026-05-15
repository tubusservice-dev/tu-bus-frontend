import { InjectionToken } from '@angular/core';

/**
 * Result returned by a successful Google sign-in.
 *
 * Web flow does NOT produce an idToken — the redirect carries a JWT
 * back in the query string (handled by `AuthCallbackComponent`). The web
 * strategy returns `{ flow: 'web-redirect' }` to signal that the caller
 * does not need to do anything else; the redirect will reload the app.
 *
 * Native flow returns `{ flow: 'native', idToken }`. The caller posts
 * the idToken to `POST /api/auth/google/native` to exchange it for the
 * app's own JWT.
 */
export type GoogleSignInResult =
  | { flow: 'web-redirect' }
  | { flow: 'native'; idToken: string };

export interface IGoogleAuth {
  /**
   * Initiates the Google sign-in flow.
   *
   * Web: persists `oauth_return_url` in storage then sets
   * `window.location.href` to the backend's `/api/auth/google` endpoint.
   * Resolves to `{ flow: 'web-redirect' }` immediately before the
   * navigation completes — the page is about to unload, so the caller
   * cannot do anything meaningful with the value.
   *
   * Native: opens the OS Google Sign-In dialog via the Capacitor
   * Firebase Authentication plugin. Resolves with the idToken when the
   * user completes the flow. Rejects with an Error when the user
   * cancels or the plugin fails.
   */
  signIn(): Promise<GoogleSignInResult>;

  /**
   * Signs out the user from Google's session on the device. Native only —
   * web does not maintain a Google session of its own (the backend's JWT
   * is the sole session). On web this is a no-op.
   */
  signOut(): Promise<void>;
}

export const GOOGLE_AUTH = new InjectionToken<IGoogleAuth>('PLATFORM_GOOGLE_AUTH');
