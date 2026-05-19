import { Injectable, Injector, signal, computed, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '@env';
import {
  STORAGE,
  IStorage,
  GOOGLE_AUTH,
  IGoogleAuth,
  PlatformService,
} from '@platform';
import {
  User,
  UserRole,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  OAuthProvider,
  ForgotPasswordResponse,
  VerifyResetTokenResponse,
  ResetPasswordResponse,
  VerifyEmailResponse,
  ResendVerificationResponse,
  CheckEmailResponse,
  LinkAccountRequest,
  LinkAccountResponse,
  VerifyAccountLinkResponse,
} from '@models';
import { ToastService } from '@shared/services/toast.service';

const CLIENT_TOKEN_KEY = 'auth_token';
const CLIENT_USER_KEY = 'auth_user';
const ADMIN_TOKEN_KEY = 'admin_auth_token';
const ADMIN_USER_KEY = 'admin_auth_user';

export type AccountBlockedCode =
  | 'ACCOUNT_BLOCKED'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_DELETED'
  | 'ACCOUNT_NOT_FOUND';

export interface AccountBlockedInfo {
  code: AccountBlockedCode;
  message: string;
  reason?: string;
}

const BLOCK_CODES: ReadonlySet<AccountBlockedCode> = new Set<AccountBlockedCode>([
  'ACCOUNT_BLOCKED',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_DELETED',
  'ACCOUNT_NOT_FOUND',
]);

export type AuthModalMode = 'login' | 'register' | 'linkAccount';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  /**
   * Cross-platform key-value storage. On web wraps localStorage; on native
   * uses Capacitor Preferences (encrypted on Android M+).
   */
  private readonly storage = inject<IStorage>(STORAGE);

  /**
   * Cross-platform Google sign-in. On web triggers the redirect-based
   * Passport flow; on native opens the OS Google account picker via the
   * Capacitor Firebase Authentication plugin.
   */
  private readonly googleAuth = inject<IGoogleAuth>(GOOGLE_AUTH);

  /**
   * Platform detector — used to gate the OAuth flow between web (redirect)
   * and native (idToken exchange via POST /api/auth/google/native).
   */
  private readonly platform = inject(PlatformService);

  /**
   * User-facing toast surface. Used to translate silent plugin failures
   * (e.g. native Google sign-in errors that aren't user cancellations)
   * into a visible message — without it, a failed sign-in looks like
   * nothing happened, leaving the user and us with no diagnostic.
   */
  private readonly toast = inject(ToastService);

  /**
   * In-memory cache of the JWT keyed by storage scope. Keeps `getToken()`
   * synchronous (the existing API the auth interceptor relies on) while
   * the underlying storage is allowed to be async (native Preferences).
   *
   * Hydrated by `loadCacheFromStorage()` during APP_INITIALIZER. Writes
   * update this signal synchronously and then fire-and-forget the
   * persist call to storage — the next `getToken()` always sees the
   * fresh value, while the OS-level write happens in background.
   */
  private readonly tokenCacheSignal = signal<string | null>(null);

  /**
   * In-memory cache of the User object — same pattern as tokenCacheSignal.
   */
  private readonly userCacheSignal = signal<User | null>(null);

  private readonly currentUserSignal = signal<User | null>(null);

  private readonly sessionExpiredSignal = signal(false);

  private readonly blockedInfoSignal = signal<AccountBlockedInfo | null>(null);
  readonly blockedInfo = this.blockedInfoSignal.asReadonly();

  triggerAccountBlocked(error: HttpErrorResponse | null | undefined): boolean {
    const body = error?.error as
      | { code?: string; message?: string; details?: { reason?: string } }
      | undefined;
    const code = body?.code;
    if (!code || !BLOCK_CODES.has(code as AccountBlockedCode)) return false;

    this.blockedInfoSignal.set({
      code: code as AccountBlockedCode,
      message: body?.message || 'Tu cuenta no puede acceder al sistema.',
      reason: body?.details?.reason,
    });
    return true;
  }

  clearAccountBlocked(): void {
    this.blockedInfoSignal.set(null);
  }

  notifyAccountBlocked(code: AccountBlockedCode, message: string, reason?: string): void {
    this.blockedInfoSignal.set({ code, message, reason });
  }

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

  private readonly authModalOpenSignal = signal(false);
  readonly authModalOpen = this.authModalOpenSignal.asReadonly();

  private readonly authModalInitialModeSignal = signal<AuthModalMode>('login');
  readonly authModalInitialMode = this.authModalInitialModeSignal.asReadonly();

  private readonly authModalPrefillEmailSignal = signal<string>('');
  readonly authModalPrefillEmail = this.authModalPrefillEmailSignal.asReadonly();

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

  openAuthModal(mode: AuthModalMode = 'login', prefillEmail = ''): void {
    this.authModalInitialModeSignal.set(mode);
    this.authModalPrefillEmailSignal.set(prefillEmail);
    this.authModalOpenSignal.set(true);
  }

  /**
   * Convenience for the forgot-password flow when the email belongs to a
   * Google-only account: opens the auth modal pre-configured for the
   * link-account branch.
   */
  openAccountLinkModal(prefillEmail: string): void {
    this.openAuthModal('linkAccount', prefillEmail);
  }

  closeAuthModal(): void {
    this.authModalOpenSignal.set(false);
    this.authModalInitialModeSignal.set('login');
    this.authModalPrefillEmailSignal.set('');
  }

  /**
   * Stages a Google idToken for the link-with-password modal. Called from
   * `signInWithGoogleNative` when the backend rejects the native sign-in
   * with EMAIL_ALREADY_REGISTERED_LOCAL — the user already has a local
   * account and must prove ownership via password to attach Google.
   *
   * Closes the auth modal in the same step so the user sees ONE modal at a
   * time — same pattern used by `onAccountLinkPending` and the verify-email
   * handoff in app.ts. Without this, the auth modal stays mounted behind
   * the link modal and reappears when the link modal closes.
   */
  openLinkGoogleModal(idToken: string): void {
    this.linkGooglePendingSignal.set(idToken);
    this.closeAuthModal();
  }

  closeLinkGoogleModal(): void {
    this.linkGooglePendingSignal.set(null);
  }

  /**
   * Posts the staged idToken + the user-supplied local password to the
   * link endpoint. On success the backend returns the same { token, user }
   * shape as a regular sign-in, so we route through `handleAuthSuccess`
   * exactly like a normal login — the linked Google account is now
   * authoritatively logged in, modal closes, blocked flow handled.
   *
   * Observable surface keeps the same error semantics as the rest of the
   * service so callers can `.subscribe` with a typed HttpErrorResponse and
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
          this.handleAuthSuccess(response);
          this.linkGooglePendingSignal.set(null);
          this.closeAuthModal();
        }),
        catchError((error: HttpErrorResponse) => {
          // Reuse the blocked-account modal path; if the account got blocked
          // between the original sign-in attempt and this link attempt, the
          // user lands on the same UI as elsewhere in the app.
          this.triggerAccountBlocked(error);
          return throwError(() => error);
        })
      );
  }

  readonly currentUser = this.currentUserSignal.asReadonly();

  readonly isAuthenticated = computed(() => !!this.currentUserSignal());

  readonly sessionExpired = this.sessionExpiredSignal.asReadonly();

  readonly userFullName = computed(() => {
    const user = this.currentUserSignal();
    if (!user) return '';
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.username || user.email || 'Usuario';
  });

  readonly userAvatar = computed(() => {
    const user = this.currentUserSignal();
    if (user?.avatar) return user.avatar;
    const name = this.userFullName();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=001d56&color=fff&size=128`;
  });

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
    /**
     * Used to resolve UserNotificationService / AdminNotificationsService
     * dynamically inside `logout()` without creating a static circular
     * dependency (those services already inject AuthService).
     */
    private readonly injector: Injector
  ) {}

  // ─── Helpers para detectar contexto ─────────────────────────

  private isAdminContext(): boolean {
    return window.location.pathname.startsWith('/admin');
  }

  private getStorageKeys(): { tokenKey: string; userKey: string } {
    return this.isAdminContext()
      ? { tokenKey: ADMIN_TOKEN_KEY, userKey: ADMIN_USER_KEY }
      : { tokenKey: CLIENT_TOKEN_KEY, userKey: CLIENT_USER_KEY };
  }

  // ─── Métodos públicos ───────────────────────────────────────

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap((response) => this.handleAuthSuccess(response)),
      catchError((error) => this.handleAuthError(error))
    );
  }

  /**
   * Registers a brand-new user. The backend may respond with one of:
   *  - JWT token (auto-login when EMAIL_VERIFICATION_REQUIRED=false).
   *  - `requiresVerification: true` when verification is required.
   *
   * NOTE: Caso 3 (Google-only collision) is handled by `linkAccount` instead.
   */
  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, data).pipe(
      tap((response) => {
        if (
          !response.data?.requiresVerification &&
          !response.data?.requiresLinkVerification &&
          response.data?.token
        ) {
          this.handleAuthSuccess(response);
        }
      }),
      catchError((error) => this.handleAuthError(error))
    );
  }

  /**
   * Caso 3 — POST /auth/link-account. The backend detects Google-only
   * accounts and dispatches the verification email. The response NEVER
   * contains a JWT — the user must click the email link.
   */
  linkAccount(data: LinkAccountRequest): Observable<LinkAccountResponse> {
    return this.http.post<LinkAccountResponse>(`${this.apiUrl}/link-account`, data);
  }

  /**
   * Consumes the account-link token and finalises the linking. On success,
   * the backend returns a JWT for auto-login.
   */
  verifyAccountLink(token: string): Observable<VerifyAccountLinkResponse> {
    return this.http
      .post<VerifyAccountLinkResponse>(`${this.apiUrl}/verify-account-link`, { token })
      .pipe(
        tap((response) => {
          if (response.success && response.data?.token) {
            // Caso 3 (link account) is always client-scope by design.
            this.persistSession(response.data.token, response.data.user, {
              tokenKey: CLIENT_TOKEN_KEY,
              userKey: CLIENT_USER_KEY,
            });
            this.currentUserSignal.set(response.data.user);
            this.sessionExpiredSignal.set(false);
          }
        })
      );
  }

  // ─── Forgot / reset password ────────────────────────────────────

  forgotPassword(email: string): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(`${this.apiUrl}/forgot-password`, { email });
  }

  verifyResetToken(token: string): Observable<VerifyResetTokenResponse> {
    return this.http.get<VerifyResetTokenResponse>(
      `${this.apiUrl}/reset-password/verify`,
      { params: { token } }
    );
  }

  resetPassword(token: string, newPassword: string): Observable<ResetPasswordResponse> {
    return this.http.post<ResetPasswordResponse>(
      `${this.apiUrl}/reset-password`,
      { token, newPassword }
    );
  }

  // ─── Email verification ─────────────────────────────────────────

  verifyEmail(token: string): Observable<VerifyEmailResponse> {
    return this.http
      .post<VerifyEmailResponse>(`${this.apiUrl}/verify-email`, { token })
      .pipe(
        tap((response) => {
          // Auto-login when the backend returns credentials: drop the user
          // straight on /perfil with the "complete profile" modal open.
          if (response.success && response.data?.token && response.data?.user) {
            this.persistSession(response.data.token, response.data.user, {
              tokenKey: CLIENT_TOKEN_KEY,
              userKey: CLIENT_USER_KEY,
            });
            this.currentUserSignal.set(response.data.user);
            this.sessionExpiredSignal.set(false);
          }
        })
      );
  }

  resendVerification(email: string): Observable<ResendVerificationResponse> {
    return this.http.post<ResendVerificationResponse>(
      `${this.apiUrl}/resend-verification`,
      { email }
    );
  }

  // ─── Async email uniqueness ─────────────────────────────────────

  checkEmail(email: string): Observable<CheckEmailResponse> {
    return this.http.post<CheckEmailResponse>(`${this.apiUrl}/check-email`, { email });
  }

  // ─── Forgot-password modal control ─────────────────────────────

  private readonly forgotPasswordModalOpenSignal = signal(false);
  readonly forgotPasswordModalOpen = this.forgotPasswordModalOpenSignal.asReadonly();

  openForgotPasswordModal(): void {
    this.closeAuthModal();
    this.forgotPasswordModalOpenSignal.set(true);
  }

  closeForgotPasswordModal(): void {
    this.forgotPasswordModalOpenSignal.set(false);
  }

  loginWithOAuth(provider: OAuthProvider): void {
    if (this.platform.isNative()) {
      // Native flow: open OS Google picker → receive idToken → exchange
      // it for the app's JWT via POST /api/auth/google/native.
      void this.signInWithGoogleNative();
      return;
    }
    // Web flow (unchanged): persist return URL and let Passport handle the
    // browser redirect.
    void this.storage.set('oauth_return_url', window.location.pathname);
    window.location.href = `${this.apiUrl}/${provider}`;
  }

  /**
   * Native Google sign-in pipeline:
   *   1. Open the OS Google account picker via the Capacitor plugin.
   *   2. Receive the idToken.
   *   3. POST it to /api/auth/google/native — backend verifies and
   *      returns the app's own JWT + user payload.
   *   4. Persist as a normal client session (handleAuthSuccess pattern).
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
  private async signInWithGoogleNative(): Promise<void> {
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
        tap((response) => this.handleAuthSuccess(response)),
        catchError((error: HttpErrorResponse) => {
          // Reuse the same blocked-account modal path as the web flow.
          this.triggerAccountBlocked(error);
          return throwError(() => error);
        })
      )
      .subscribe({
        next: () => {
          // Profile is already in the response; route to home (or wherever
          // the user came from). Mirrors the web AuthCallbackComponent
          // behaviour for the post-login redirect.
          const user = this.currentUserSignal();
          if (user && user.profileCompleted === false) {
            this.router.navigate(['/perfil'], { queryParams: { completeProfile: 'true' } });
          } else {
            this.router.navigate(['/']);
          }
          this.closeAuthModal();
          this.nativeOAuthLoadingSignal.set(false);
        },
        error: (err: HttpErrorResponse) => {
          console.warn('[AuthService] Google native exchange failed:', err);
          this.nativeOAuthLoadingSignal.set(false);

          // `triggerAccountBlocked` (in catchError above) already opened the
          // dedicated blocked-account modal for ACCOUNT_BLOCKED/SUSPENDED/
          // DELETED/NOT_FOUND. Avoid layering a toast on top of that modal.
          if (this.blockedInfoSignal()) return;

          const body = err?.error as { code?: string; message?: string } | undefined;
          const code = body?.code;

          // Symmetric account-linking entry point: the user has a local
          // account for this email and is now signing in with Google. Open
          // the link modal so they can supply their password and attach
          // Google to their account. `idToken` is in the enclosing closure
          // because we only reach the .subscribe.error AFTER a successful
          // plugin sign-in (the earlier try/catch already exited otherwise).
          if (code === 'EMAIL_ALREADY_REGISTERED_LOCAL') {
            this.openLinkGoogleModal(idToken);
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
   * Saves an admin session in admin-only storage keys, leaving the client
   * keys untouched.
   */
  handleAdminLogin(token: string, user: User): void {
    this.persistSession(token, user, {
      tokenKey: ADMIN_TOKEN_KEY,
      userKey: ADMIN_USER_KEY,
    });
    this.currentUserSignal.set(user);
    this.sessionExpiredSignal.set(false);
  }

  handleOAuthCallback(token: string): void {
    // Clear any stale user cache before persisting the new token. The
    // user payload is fetched right after via loadUserProfile().
    this.userCacheSignal.set(null);
    this.currentUserSignal.set(null);
    void this.storage.remove(CLIENT_USER_KEY);
    this.persistTokenOnly(token, CLIENT_TOKEN_KEY);
  }

  /**
   * Reemplaza el JWT y el user cacheado con una sesión recién emitida por
   * el backend. Se usa cuando un endpoint autenticado (e.g. change-password)
   * invalida el token actual y devuelve uno nuevo para mantener al usuario
   * logueado sin tener que rehacer login.
   */
  applyNewSession(token: string, user: User): void {
    const { tokenKey, userKey } = this.getStorageKeys();
    this.persistSession(token, user, { tokenKey, userKey });
    this.currentUserSignal.set(user);
    this.sessionExpiredSignal.set(false);
  }

  /**
   * Merges a partial update into the cached user without rotating the JWT.
   * Used by preference endpoints (e.g. notification toggles) that mutate
   * a single field server-side and return the updated payload.
   */
  patchCurrentUser(patch: Partial<User>): void {
    const current = this.currentUserSignal();
    if (!current) return;
    const merged: User = { ...current, ...patch };
    const { userKey } = this.getStorageKeys();
    this.persistUserOnly(merged, userKey);
    this.currentUserSignal.set(merged);
  }

  /**
   * Closes the user's session both client- and server-side. Server-side
   * uses the `tokensInvalidatedAt` mass-invalidation marker so JWTs are
   * rejected on the next request from any device.
   *
   * The outer method stays synchronous to preserve the existing call-site
   * signature; the async helper performs FCM unregister BEFORE clearing
   * the JWT so the DELETE request travels with valid auth.
   */
  logout(): void {
    void this.performLogoutAsync();
  }

  private async performLogoutAsync(): Promise<void> {
    const isAdmin = this.isAdminContext();

    // Best-effort cleanup BEFORE clearing the JWT:
    //   - Unregister FCM token (so the backend stops pushing to this device).
    //   - Sign out from the native Google session (so a subsequent
    //     signInWithGoogle isn't rejected by Android Credential Manager
    //     with "No credentials available" — see signOutGoogleSilent).
    // Run them in parallel and cap the whole batch at 1.5 s so a slow
    // network can't make the logout button feel stuck. `allSettled` lets a
    // failure in one path proceed with the other; both methods are silent
    // internally, this is belt-and-braces.
    await Promise.race([
      Promise.allSettled([
        this.unregisterFcmTokenSilent(isAdmin),
        this.signOutGoogleSilent(),
      ]),
      new Promise<void>((resolve) => setTimeout(resolve, 1500)),
    ]);

    const { tokenKey, userKey } = this.getStorageKeys();

    // Best-effort server notification — proceed with local cleanup
    // regardless of network outcome.
    if (!isAdmin) {
      this.http.post(`${this.apiUrl}/logout`, {}).subscribe({
        next: () => {},
        error: () => {},
      });
    }

    this.clearStoredSession({ tokenKey, userKey });
    void this.storage.remove('oauth_return_url');
    this.currentUserSignal.set(null);
    this.router.navigate(isAdmin ? ['/admin/login'] : ['/']);
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
   * app-level logout — same contract as `unregisterFcmTokenSilent`.
   */
  private async signOutGoogleSilent(): Promise<void> {
    try {
      await this.googleAuth.signOut();
    } catch {
      /* silent — Google sign-out failure must not block app logout */
    }
  }

  /**
   * Resolves the matching notifications service via dynamic import to
   * avoid a static circular dep, then calls its unregisterToken().
   */
  private async unregisterFcmTokenSilent(isAdmin: boolean): Promise<void> {
    try {
      if (isAdmin) {
        const { AdminNotificationsService } = await import('./admin-notifications.service');
        await this.injector.get(AdminNotificationsService).unregisterToken();
      } else {
        const { UserNotificationService } = await import('./user-notification.service');
        await this.injector.get(UserNotificationService).unregisterToken();
      }
    } catch {
      /* silent — stale tokens are reaped by the weekly cron */
    }
  }

  handleSessionExpired(): void {
    const { tokenKey, userKey } = this.getStorageKeys();
    this.clearStoredSession({ tokenKey, userKey });
    this.currentUserSignal.set(null);
    this.sessionExpiredSignal.set(true);
  }

  clearSessionExpired(): void {
    this.sessionExpiredSignal.set(false);
  }

  /**
   * Returns the cached JWT for the current scope (cliente or admin),
   * synchronously. Reads from `tokenCacheSignal`, NOT from storage —
   * `loadCacheFromStorage()` must have run during APP_INITIALIZER.
   *
   * Note: the cache stores ONE token at a time. If the user navigates
   * between /admin/* and / contexts, the active scope changes. We
   * compare the cached scope against the current path; if they differ
   * we re-load (synchronously falling back to null if not yet loaded).
   *
   * In practice the cache rarely needs the cross-scope swap because the
   * navigations that would trigger it pass through a logout/login first.
   */
  getToken(): string | null {
    return this.tokenCacheSignal();
  }

  setUserFromStorage(): void {
    const user = this.getStoredUser();
    if (user) {
      this.currentUserSignal.set(user);
    }
  }

  isAdminSession(): boolean {
    return this.isAdminContext();
  }

  loadUserProfile(): Observable<{ success: boolean; data: User }> {
    const isAdmin = this.isAdminContext();

    const profileUrl = isAdmin
      ? `${environment.apiUrl}/admin/profile`
      : `${environment.apiUrl}/users/profile`;

    return this.http
      .get<{ success: boolean; data: User }>(profileUrl)
      .pipe(
        tap((response) => {
          if (response.success && response.data) {
            const role: UserRole = isAdmin ? UserRole.ADMIN : response.data.role;
            const userData = { ...response.data, role };
            const { userKey } = this.getStorageKeys();
            this.persistUserOnly(userData, userKey);
            this.currentUserSignal.set(userData);
          }
        }),
        catchError((error) => {
          if (error.status === 401 || error.status === 403) {
            const { tokenKey, userKey } = this.getStorageKeys();
            this.clearStoredSession({ tokenKey, userKey });
            this.currentUserSignal.set(null);
          }
          return throwError(() => error);
        })
      );
  }

  // ─── Métodos privados ───────────────────────────────────────

  private handleAuthSuccess(response: AuthResponse): void {
    if (response.success && response.data && response.data.token) {
      this.persistSession(response.data.token, response.data.user, {
        tokenKey: CLIENT_TOKEN_KEY,
        userKey: CLIENT_USER_KEY,
      });
      this.currentUserSignal.set(response.data.user);
      this.sessionExpiredSignal.set(false);
    }
  }

  private handleAuthError(error: unknown): Observable<never> {
    return throwError(() => error);
  }

  private getStoredUser(): User | null {
    return this.userCacheSignal();
  }

  /**
   * Hydrates the in-memory token + user caches from the platform storage
   * (localStorage on web, Capacitor Preferences on native).
   *
   * MUST be called and AWAITED during APP_INITIALIZER before any code
   * reads `getToken()` or `currentUser()`. The existing
   * `auth.interceptor.ts` reads the token synchronously on every request;
   * if this method has not run yet, the interceptor would send requests
   * without auth even when the user is logged in.
   *
   * Idempotent: safe to call multiple times. Each call overwrites the
   * cache with the latest persisted values. Reads both client and admin
   * keys so a user with both sessions (cliente + admin in the same
   * device) doesn't lose either cache when navigating between contexts.
   */
  async loadCacheFromStorage(): Promise<void> {
    // Resolve which keys apply based on the current path. On boot the
    // path is whatever URL the user landed on (typically '/' but could
    // be '/admin/...').
    const { tokenKey, userKey } = this.getStorageKeys();

    const [token, userStr] = await Promise.all([
      this.storage.get(tokenKey),
      this.storage.get(userKey),
    ]);

    this.tokenCacheSignal.set(token);

    if (userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        this.userCacheSignal.set(user);
        this.currentUserSignal.set(user);
      } catch {
        this.userCacheSignal.set(null);
        this.currentUserSignal.set(null);
      }
    } else {
      this.userCacheSignal.set(null);
      this.currentUserSignal.set(null);
    }
  }

  /**
   * Persists token + user atomically (from the consumer's POV — both
   * caches update synchronously, storage writes are awaited together).
   * Fire-and-forget at the storage layer keeps the API non-blocking for
   * call sites that already assume sync behaviour.
   */
  private persistSession(token: string, user: User, scope: { tokenKey: string; userKey: string }): void {
    this.tokenCacheSignal.set(token);
    this.userCacheSignal.set(user);
    void this.storage.set(scope.tokenKey, token);
    void this.storage.set(scope.userKey, JSON.stringify(user));
  }

  /**
   * Persists token alone (used by handleOAuthCallback where the user
   * profile is fetched right after via loadUserProfile).
   */
  private persistTokenOnly(token: string, tokenKey: string): void {
    this.tokenCacheSignal.set(token);
    void this.storage.set(tokenKey, token);
  }

  /**
   * Persists a user update without rotating the token (used by
   * patchCurrentUser when only profile fields change).
   */
  private persistUserOnly(user: User, userKey: string): void {
    this.userCacheSignal.set(user);
    void this.storage.set(userKey, JSON.stringify(user));
  }

  /**
   * Wipes the cached session and the storage entries. Used on logout and
   * session expiration.
   */
  private clearStoredSession(scope: { tokenKey: string; userKey: string }): void {
    this.tokenCacheSignal.set(null);
    this.userCacheSignal.set(null);
    void this.storage.remove(scope.tokenKey);
    void this.storage.remove(scope.userKey);
  }
}
