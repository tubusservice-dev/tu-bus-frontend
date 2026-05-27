import { InjectionToken } from '@angular/core';

/**
 * Result returned by a successful Apple sign-in.
 *
 * Unlike Google, there is NO web flow in v1 — Sign in with Apple via
 * `signInWithApple` is iOS-only for this release. A future web flow would
 * use Apple's Service ID + JS SDK and return `{ flow: 'web-redirect' }`
 * mirroring the Google contract.
 *
 * Native flow returns `{ flow: 'native', identityToken, ... }`. The caller
 * posts the identityToken (plus firstName/lastName when present — Apple
 * only returns names on the FIRST sign-in for this app) to
 * `POST /api/auth/apple/native` to exchange it for the app's own JWT.
 */
export type AppleSignInResult = {
  flow: 'native';
  identityToken: string;
  /** First name as supplied by Apple. Only present on the user's first sign-in. */
  firstName?: string;
  /** Last name as supplied by Apple. Only present on the user's first sign-in. */
  lastName?: string;
};

export interface IAppleAuth {
  /**
   * Initiates the Sign in with Apple flow.
   *
   * Native (iOS only): opens the OS sheet via the Capacitor Firebase
   * Authentication plugin. Resolves with the identityToken when the user
   * completes the flow. Rejects with an Error when the user cancels or
   * the plugin fails.
   *
   * Web + Android: throws. Callers should gate the invocation with
   * `isAvailable()` to avoid the throw — see PlatformService.isIos().
   */
  signIn(): Promise<AppleSignInResult>;

  /**
   * Signs out the user from Apple's Firebase session on the device.
   * Native only — web is a no-op because no Apple session is held.
   * Called from AuthService.performLogoutAsync to prevent the
   * "No credentials available" error on the next sign-in attempt
   * (same Firebase Auth gotcha that bit us with Google in Phase 6.5).
   */
  signOut(): Promise<void>;

  /**
   * True only on iOS native — false on web and Android. Use this to
   * gate UI (show / hide the "Continue with Apple" button) and to guard
   * `signIn()` from being invoked on unsupported platforms.
   */
  isAvailable(): boolean;
}

export const APPLE_AUTH = new InjectionToken<IAppleAuth>('PLATFORM_APPLE_AUTH');
