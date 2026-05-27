import { AppleSignInResult, IAppleAuth } from './apple-auth.service';

/**
 * Native Apple sign-in via `@capacitor-firebase/authentication`.
 *
 * Flow:
 *   1. The plugin opens the OS-level Sign in with Apple sheet (iOS only —
 *      Apple does NOT expose this to Android natively, and the web flow
 *      requires the JS SDK + Service ID which is out of scope for v1).
 *   2. The user authenticates and optionally chooses "Hide My Email".
 *   3. Firebase Authentication mints an identityToken whose `aud` is our
 *      Apple bundle ID (com.tubusexpress.app).
 *   4. We surface the identityToken + name fields. The caller posts them
 *      to `POST /api/auth/apple/native` to exchange for the app's JWT.
 *
 * Apple-specific behaviour worth noting:
 *   - `result.displayName` is ONLY populated on the user's first sign-in
 *     for this app. Subsequent sign-ins return only the identityToken.
 *     We surface whatever Apple gives us and let the backend handle
 *     persistence — Apple's contract is "name once, identity forever".
 *   - When the user picks "Hide My Email", the `email` claim inside the
 *     identityToken is a relay address (xxxx@privaterelay.appleid.com).
 *     The backend treats it as a real email; Apple forwards messages.
 *
 * Cancellation: when the user dismisses the sheet, the plugin throws.
 * We re-throw so the caller can show a toast or no-op accordingly.
 */
export class NativeAppleAuthStrategy implements IAppleAuth {
  async signIn(): Promise<AppleSignInResult> {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    const result = await FirebaseAuthentication.signInWithApple();

    const identityToken = result.credential?.idToken;
    if (!identityToken) {
      // The plugin succeeded but did not include an identityToken in the
      // credential — usually a server-side scope misconfiguration.
      throw new Error('Apple sign-in did not return an identityToken');
    }

    // Apple returns the user's full name only on the FIRST sign-in. The
    // plugin surfaces it via `result.displayName` and breaks it into the
    // user.displayName field. We split on the first space defensively
    // because Apple may send it pre-split as well (varies per platform).
    const [firstNameFromDisplay, ...rest] = (result.user?.displayName ?? '')
      .trim()
      .split(/\s+/);
    const lastNameFromDisplay = rest.join(' ');

    return {
      flow: 'native',
      identityToken,
      firstName: firstNameFromDisplay || undefined,
      lastName: lastNameFromDisplay || undefined,
    };
  }

  async signOut(): Promise<void> {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    await FirebaseAuthentication.signOut();
  }

  isAvailable(): boolean {
    // Strategy is only constructed when PlatformService.isIos() is true
    // (see platform.providers.ts). Returning true unconditionally here is
    // safe — the factory already gated the choice.
    return true;
  }
}
