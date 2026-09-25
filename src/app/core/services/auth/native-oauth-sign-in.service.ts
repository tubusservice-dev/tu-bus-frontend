import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError, throwError } from 'rxjs';
import { environment } from '@env';
import { GOOGLE_AUTH, IGoogleAuth, APPLE_AUTH, IAppleAuth } from '@platform';
import { AuthResponse } from '@models';
import { ToastService } from '@shared/services/toast.service';
import { AccountBlockedStore } from './account-blocked.store';
import { AuthModalStore } from './auth-modal.store';
import { AuthSessionStore } from './auth-session.store';
import { AuthSuccessHandler } from './auth-success.handler';
import { OAuthAccountLinkService } from './oauth-account-link.service';

/**
 * Native (Capacitor) Google and Apple sign-in pipelines plus their
 * best-effort sign-out counterparts used during logout.
 */
@Injectable({
  providedIn: 'root',
})
export class NativeOAuthSignInService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  /**
   * Cross-platform Google sign-in. On web triggers the redirect-based
   * Passport flow; on native opens the OS Google account picker via the
   * Capacitor Firebase Authentication plugin.
   */
  private readonly googleAuth = inject<IGoogleAuth>(GOOGLE_AUTH);

  /**
   * iOS-only Apple sign-in (App Store Guideline 4.8 compliance). On web
   * and Android the injected strategy is a no-op that returns false from
   * `isAvailable()` — callers must always gate on `platform.isIos()` (or
   * `appleAuth.isAvailable()`) before invoking `signIn()`.
   */
  private readonly appleAuth = inject<IAppleAuth>(APPLE_AUTH);

  /**
   * User-facing toast surface. Used to translate silent plugin failures
   * (e.g. native Google sign-in errors that aren't user cancellations)
   * into a visible message — without it, a failed sign-in looks like
   * nothing happened, leaving the user and us with no diagnostic.
   */
  private readonly toast = inject(ToastService);

  private readonly session = inject(AuthSessionStore);
  private readonly authSuccess = inject(AuthSuccessHandler);
  private readonly blocked = inject(AccountBlockedStore);
  private readonly modals = inject(AuthModalStore);
  private readonly accountLink = inject(OAuthAccountLinkService);

  /**
   * True while a native Google sign-in flow is in progress (between the
   * moment the user taps the button and the moment the backend responds
   * — including the OS picker, idToken exchange and user profile fetch).
   *
   * Auth modal reads this with effect() to keep its OAuth spinner in
   * sync. The web flow does NOT need this signal because the page
   * navigates away (signal would be reset by app reload anyway).
   */
  private readonly nativeOAuthLoadingSignal = signal(false);
  readonly nativeOAuthLoading = this.nativeOAuthLoadingSignal.asReadonly();

  /**
   * Native Google sign-in pipeline:
   *   1. Open the OS Google account picker via the Capacitor plugin.
   *   2. Receive the idToken.
   *   3. POST it to /api/auth/google/native — backend verifies and
   *      returns the app's own JWT + user payload.
   *   4. Persist as a normal client session (auth-success handler).
   *
   * Errors:
   *   - Picker dismissed / cancelled → re-thrown by GoogleAuth strategy,
   *     swallowed silently here (no toast — the user dismissed on purpose).
   *   - Account blocked / collision → backend returns 4xx with `code` —
   *     translated via triggerAccountBlocked() into the global modal,
   *     same path the existing flows use.
   *   - Network error → no UI change, the original AuthError observable
   *     would have surfaced; here we log to console for debugging.
   */
  async signInWithGoogle(): Promise<void> {
    // Mark in-flight so the auth-modal can show / clear its spinner via
    // the `nativeOAuthLoading` signal. ALWAYS clear it on the way out
    // regardless of success/failure, so a stuck spinner can never happen.
    this.nativeOAuthLoadingSignal.set(true);

    let idToken: string;
    try {
      const result = await this.googleAuth.signIn();
      if (result.flow !== 'native') {
        this.nativeOAuthLoadingSignal.set(false);
        return; // safety — should not happen
      }
      idToken = result.idToken;
    } catch (err) {
      this.nativeOAuthLoadingSignal.set(false);
      // Distinguish two very different scenarios that the plugin reports
      // through the same `throw`:
      //   1) The user dismissed the Google account picker on purpose →
      //      silent no-op (toasts on intentional cancellations are noise).
      //   2) The plugin itself failed (Google Play Services missing or
      //      outdated, SHA mismatch, no network, dev config error) →
      //      visible toast, otherwise the user sees nothing and we get
      //      no diagnostic from the field.
      // Google Sign-In status code 12501 (SIGN_IN_CANCELLED) is the
      // canonical signal; some Android OEMs only surface a message, so
      // we also do a defensive substring match.
      const errCode = String((err as { code?: unknown } | null)?.code ?? '').toLowerCase();
      const errMsg = String((err as { message?: unknown } | null)?.message ?? err ?? '');
      const isUserCancelled =
        errCode === '12501' ||
        /cancel/i.test(errMsg) ||
        /dismiss/i.test(errMsg);

      if (isUserCancelled) return;

      console.warn('[AuthService] Google native sign-in failed:', err);
      this.toast.error(
        `No se pudo iniciar sesión con Google. Detalle: ${errMsg || 'Error desconocido'}`,
        8000,
      );
      return;
    }

    this.http
      .post<AuthResponse>(`${this.apiUrl}/google/native`, { idToken })
      .pipe(
        tap((response) => this.authSuccess.handle(response)),
        catchError((error: HttpErrorResponse) => {
          // Reuse the same blocked-account modal path as the web flow.
          this.blocked.triggerAccountBlocked(error);
          return throwError(() => error);
        })
      )
      .subscribe({
        next: () => {
          // Profile is already in the response; route to home (or wherever
          // the user came from). Mirrors the web AuthCallbackComponent
          // behaviour for the post-login redirect.
          this.navigateAfterSignIn();
          this.modals.closeAuthModal();
          this.nativeOAuthLoadingSignal.set(false);
        },
        error: (err: HttpErrorResponse) => {
          console.warn('[AuthService] Google native exchange failed:', err);
          this.nativeOAuthLoadingSignal.set(false);

          // `triggerAccountBlocked` (in catchError above) already opened the
          // dedicated blocked-account modal for ACCOUNT_BLOCKED/SUSPENDED/
          // DELETED/NOT_FOUND. Avoid layering a toast on top of that modal.
          if (this.blocked.blockedInfo()) return;

          const body = err?.error as { code?: string; message?: string } | undefined;
          const code = body?.code;

          // Symmetric account-linking entry point: the user has a local
          // account for this email and is now signing in with Google. Open
          // the link modal so they can supply their password and attach
          // Google to their account. `idToken` is in the enclosing closure
          // because we only reach the .subscribe.error AFTER a successful
          // plugin sign-in (the earlier try/catch already exited otherwise).
          if (code === 'EMAIL_ALREADY_REGISTERED_LOCAL') {
            this.accountLink.openLinkGoogleModal(idToken);
            return;
          }

          // Any other backend failure: surface a visible message instead of
          // dying silently. Without this, native Google sign-in errors look
          // like the button does nothing — exactly the bug we just fixed.
          this.toast.error(
            body?.message ?? 'No se pudo completar el inicio de sesión con Google.',
            8000,
          );
        },
      });
  }

  /**
   * Native Apple sign-in pipeline — exact symmetric of `signInWithGoogle`:
   *   1. Open the OS Sign in with Apple sheet via the Capacitor plugin.
   *   2. Receive the identityToken + (first-sign-in-only) firstName/lastName.
   *   3. POST to /api/auth/apple/native — backend verifies and returns
   *      the app's own JWT + user payload.
   *   4. Persist as a normal client session via the auth-success handler.
   *
   * Error handling mirrors the Google flow: cancel = silent, plugin
   * failure = toast, EMAIL_ALREADY_REGISTERED_LOCAL = open link modal.
   */
  async signInWithApple(): Promise<void> {
    this.nativeOAuthLoadingSignal.set(true);

    let identityToken: string;
    let firstName: string | undefined;
    let lastName: string | undefined;
    try {
      const result = await this.appleAuth.signIn();
      if (result.flow !== 'native') {
        this.nativeOAuthLoadingSignal.set(false);
        return; // defensive — should not happen
      }
      identityToken = result.identityToken;
      firstName = result.firstName;
      lastName = result.lastName;
    } catch (err) {
      this.nativeOAuthLoadingSignal.set(false);
      // Apple's cancellation codes differ from Google's. The native plugin
      // surfaces `1001` (ASAuthorizationErrorCanceled) on user dismiss, plus
      // a "cancelled"/"canceled" string in the message on some bridge paths.
      const errCode = String((err as { code?: unknown } | null)?.code ?? '').toLowerCase();
      const errMsg = String((err as { message?: unknown } | null)?.message ?? err ?? '');
      const isUserCancelled =
        errCode === '1001' ||
        /cancel/i.test(errMsg) ||
        /dismiss/i.test(errMsg);

      if (isUserCancelled) return;

      console.warn('[AuthService] Apple native sign-in failed:', err);
      this.toast.error(
        `No se pudo iniciar sesión con Apple. Detalle: ${errMsg || 'Error desconocido'}`,
        8000,
      );
      return;
    }

    this.http
      .post<AuthResponse>(`${this.apiUrl}/apple/native`, {
        identityToken,
        firstName,
        lastName,
      })
      .pipe(
        tap((response) => this.authSuccess.handle(response)),
        catchError((error: HttpErrorResponse) => {
          this.blocked.triggerAccountBlocked(error);
          return throwError(() => error);
        }),
      )
      .subscribe({
        next: () => {
          this.navigateAfterSignIn();
          this.modals.closeAuthModal();
          this.nativeOAuthLoadingSignal.set(false);
        },
        error: (err: HttpErrorResponse) => {
          console.warn('[AuthService] Apple native exchange failed:', err);
          this.nativeOAuthLoadingSignal.set(false);

          if (this.blocked.blockedInfo()) return;

          const body = err?.error as { code?: string; message?: string } | undefined;
          const code = body?.code;

          // Symmetric account-linking entry point for Apple — same contract
          // as the Google branch above.
          if (code === 'EMAIL_ALREADY_REGISTERED_LOCAL') {
            this.accountLink.openLinkAppleModal(identityToken, firstName, lastName);
            return;
          }

          this.toast.error(
            body?.message ?? 'No se pudo completar el inicio de sesión con Apple.',
            8000,
          );
        },
      });
  }

  /**
   * Best-effort native Google sign-out. The Capacitor Firebase
   * Authentication plugin keeps a SDK-level session (FirebaseAuth.currentUser)
   * independent of our backend JWT. Without clearing it, the next call to
   * `FirebaseAuthentication.signInWithGoogle()` fails with
   * "No credentials available" — the Android Credential Manager refuses to
   * issue new credentials while a stale session lingers. On web the strategy
   * is a no-op (web has no native Google session of its own).
   *
   * Errors are swallowed because a sign-out failure must never block the
   * app-level logout.
   */
  async signOutGoogleSilent(): Promise<void> {
    try {
      await this.googleAuth.signOut();
    } catch {
      /* silent — Google sign-out failure must not block app logout */
    }
  }

  /**
   * Best-effort native Apple sign-out. Same rationale as
   * `signOutGoogleSilent` — Firebase Authentication holds an SDK-level
   * session for Sign in with Apple independent of our JWT, and a stale
   * session can break the next sign-in attempt. The strategy is a no-op
   * on web and Android, so calling this unconditionally is safe.
   */
  async signOutAppleSilent(): Promise<void> {
    try {
      await this.appleAuth.signOut();
    } catch {
      /* silent — Apple sign-out failure must not block app logout */
    }
  }

  /**
   * Post-login redirect shared by both native providers: incomplete
   * profiles land on /perfil with the "complete profile" modal open.
   */
  private navigateAfterSignIn(): void {
    const user = this.session.currentUser();
    if (user && user.profileCompleted === false) {
      this.router.navigate(['/perfil'], { queryParams: { completeProfile: 'true' } });
    } else {
      this.router.navigate(['/']);
    }
  }
}
