import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '@env';
import { AuthResponse } from '@models';
import { AccountBlockedStore } from './account-blocked.store';
import { AuthModalStore } from './auth-modal.store';
import { AuthSuccessHandler } from './auth-success.handler';

interface PendingAppleLink {
  identityToken: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Symmetric Google/Apple ↔ local-account linking. A native OAuth sign-in
 * that collides with an existing local account (backend 409
 * EMAIL_ALREADY_REGISTERED_LOCAL) stages its provider token here; the
 * link-*-password modals read the open state and post the token plus the
 * user's local password to attach the provider identity.
 */
@Injectable({
  providedIn: 'root',
})
export class OAuthAccountLinkService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly http = inject(HttpClient);
  private readonly authSuccess = inject(AuthSuccessHandler);
  private readonly blocked = inject(AccountBlockedStore);
  private readonly modals = inject(AuthModalStore);

  /**
   * Holds the Google idToken captured during a native sign-in attempt that
   * collided with an existing local account (backend responded 409 with
   * code EMAIL_ALREADY_REGISTERED_LOCAL). The link-google-password-modal
   * reads this signal to know it should open; the modal posts the idToken
   * plus the user-supplied password to `/api/auth/link-google-with-password`
   * to attach the Google identity to the existing local account.
   *
   * Null means no link flow is in progress — the modal stays hidden.
   */
  private readonly linkGooglePendingSignal = signal<string | null>(null);
  readonly linkGoogleModalOpen = computed(() => this.linkGooglePendingSignal() !== null);

  /**
   * Symmetric pending-link payload for Apple. Unlike Google we carry name
   * fields alongside the identityToken because Apple only returns them on
   * the FIRST sign-in for this app — losing them between the initial 409
   * and the link-with-password call would leave the linked account with
   * empty firstName/lastName until the user re-fills the profile manually.
   *
   * Null means no Apple link flow is in progress — the modal stays hidden.
   */
  private readonly linkApplePendingSignal = signal<PendingAppleLink | null>(null);
  readonly linkAppleModalOpen = computed(() => this.linkApplePendingSignal() !== null);

  /**
   * Stages a Google idToken for the link-with-password modal. Called from
   * the native Google sign-in when the backend rejects it with
   * EMAIL_ALREADY_REGISTERED_LOCAL — the user already has a local
   * account and must prove ownership via password to attach Google.
   *
   * Closes the auth modal in the same step so the user sees ONE modal at a
   * time — same pattern used by `onAccountLinkPending` and the verify-email
   * handoff in app.ts. Without this, the auth modal stays mounted behind
   * the link modal and reappears when the link modal closes.
   */
  openLinkGoogleModal(idToken: string): void {
    this.linkGooglePendingSignal.set(idToken);
    this.modals.closeAuthModal();
  }

  closeLinkGoogleModal(): void {
    this.linkGooglePendingSignal.set(null);
  }

  /**
   * Posts the staged idToken + the user-supplied local password to the
   * link endpoint. On success the backend returns the same { token, user }
   * shape as a regular sign-in, so we route through the auth-success
   * handler exactly like a normal login — the linked Google account is now
   * authoritatively logged in, modal closes, blocked flow handled.
   *
   * Observable surface keeps the same error semantics as the rest of the
   * auth API so callers can `.subscribe` with a typed HttpErrorResponse and
   * react to specific codes (INVALID_PASSWORD, GOOGLE_ALREADY_LINKED, etc.).
   */
  linkGoogleWithPassword(password: string): Observable<AuthResponse> {
    const idToken = this.linkGooglePendingSignal();
    if (!idToken) {
      // No staged token means the modal was opened out-of-band; nothing to
      // do. Returning an error keeps the caller's subscribe contract clean.
      return throwError(
        () => new Error('No hay un inicio de sesión de Google pendiente para vincular.')
      );
    }

    return this.http
      .post<AuthResponse>(`${this.apiUrl}/link-google-with-password`, {
        idToken,
        password,
      })
      .pipe(
        tap((response) => {
          this.authSuccess.handle(response);
          this.linkGooglePendingSignal.set(null);
          this.modals.closeAuthModal();
        }),
        catchError((error: HttpErrorResponse) => {
          // Reuse the blocked-account modal path; if the account got blocked
          // between the original sign-in attempt and this link attempt, the
          // user lands on the same UI as elsewhere in the app.
          this.blocked.triggerAccountBlocked(error);
          return throwError(() => error);
        })
      );
  }

  /**
   * Apple counterpart of `openLinkGoogleModal`. Stages the identityToken
   * plus the (optional) name fields received from Apple's first sign-in,
   * then closes the auth modal so the user sees a single modal at a time.
   */
  openLinkAppleModal(
    identityToken: string,
    firstName?: string,
    lastName?: string,
  ): void {
    this.linkApplePendingSignal.set({ identityToken, firstName, lastName });
    this.modals.closeAuthModal();
  }

  closeLinkAppleModal(): void {
    this.linkApplePendingSignal.set(null);
  }

  /**
   * Apple counterpart of `linkGoogleWithPassword`. Posts the staged
   * identityToken + name fields + the user-supplied local password to
   * `/api/auth/link-apple-with-password`. On success the backend returns
   * the same { token, user } shape as a regular sign-in.
   */
  linkAppleWithPassword(password: string): Observable<AuthResponse> {
    const pending = this.linkApplePendingSignal();
    if (!pending) {
      return throwError(
        () => new Error('No hay un inicio de sesión de Apple pendiente para vincular.'),
      );
    }

    return this.http
      .post<AuthResponse>(`${this.apiUrl}/link-apple-with-password`, {
        identityToken: pending.identityToken,
        password,
        firstName: pending.firstName,
        lastName: pending.lastName,
      })
      .pipe(
        tap((response) => {
          this.authSuccess.handle(response);
          this.linkApplePendingSignal.set(null);
          this.modals.closeAuthModal();
        }),
        catchError((error: HttpErrorResponse) => {
          this.blocked.triggerAccountBlocked(error);
          return throwError(() => error);
        }),
      );
  }
}
