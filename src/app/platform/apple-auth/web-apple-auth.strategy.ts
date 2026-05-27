import { AppleSignInResult, IAppleAuth } from './apple-auth.service';

/**
 * Web / Android no-op for Apple sign-in.
 *
 * Apple does not provide a native sign-in flow on Android, and the web
 * Sign in with Apple JS SDK is out of scope for v1 (would require an
 * Apple Service ID + the apple-signin-js library + extra security config).
 *
 * `isAvailable()` returns false so the UI never offers the option on
 * unsupported platforms — `auth-modal` gates the button visibility with
 * `platform.isIos()` and never reaches `signIn()` here. The throws below
 * are defensive guards in case the gate is ever bypassed in the future.
 */
export class WebAppleAuthStrategy implements IAppleAuth {
  async signIn(): Promise<AppleSignInResult> {
    throw new Error('Apple Sign-In is not available on this platform.');
  }

  async signOut(): Promise<void> {
    // No-op. There is no Apple session held on web or Android.
  }

  isAvailable(): boolean {
    return false;
  }
}
