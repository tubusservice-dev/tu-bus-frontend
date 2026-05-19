import { GoogleSignInResult, IGoogleAuth } from './google-auth.service';

/**
 * Native Google sign-in via `@capacitor-firebase/authentication`.
 *
 * Flow:
 *   1. The plugin opens the OS-level Google account picker (Android: the
 *      bottomsheet served by Google Play Services; iOS: a Safari-based
 *      prompt). The user picks an account.
 *   2. Firebase Authentication mints an idToken whose `aud` is the Web
 *      Server client ID auto-created by Firebase (the
 *      `clientIdWebFirebase` we configured on the backend).
 *   3. We surface the idToken to the caller. The caller posts it to
 *      `POST /api/auth/google/native` to exchange for the app's JWT.
 *
 * Cancellation: when the user dismisses the picker the plugin throws.
 * We re-throw so the caller can show a toast or no-op accordingly.
 */
export class NativeGoogleAuthStrategy implements IGoogleAuth {
  async signIn(): Promise<GoogleSignInResult> {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    const result = await FirebaseAuthentication.signInWithGoogle();

    const idToken = result.credential?.idToken;
    if (!idToken) {
      // Firebase normally returns the idToken in `credential`; absence
      // here means the plugin succeeded but with an unexpected payload
      // (mostly happens when scopes are misconfigured server-side).
      throw new Error('Google sign-in did not return an idToken');
    }
    return { flow: 'native', idToken };
  }

  async signOut(): Promise<void> {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    await FirebaseAuthentication.signOut();
  }
}
