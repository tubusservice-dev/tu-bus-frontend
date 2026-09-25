import { Injectable, Injector, computed, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '@env';
import {
  STORAGE,
  IStorage,
  PlatformService,
  ANALYTICS,
  CRASHLYTICS,
  AnalyticsEvent,
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
import { AccountBlockedCode, AccountBlockedStore } from '@core/services/auth/account-blocked.store';
import { AuthModalMode, AuthModalStore } from '@core/services/auth/auth-modal.store';
import {
  AuthSessionStore,
  ADMIN_SESSION_SCOPE,
  CLIENT_SESSION_SCOPE,
} from '@core/services/auth/auth-session.store';
import { AuthSuccessHandler } from '@core/services/auth/auth-success.handler';
import { NativeOAuthSignInService } from '@core/services/auth/native-oauth-sign-in.service';
import { OAuthAccountLinkService } from '@core/services/auth/oauth-account-link.service';

export type { AccountBlockedCode, AccountBlockedInfo } from '@core/services/auth/account-blocked.store';
export type { AuthModalMode } from '@core/services/auth/auth-modal.store';

/**
 * Public authentication facade. Consumers depend only on this class; the
 * actual responsibilities live in focused collaborators under `./auth/`:
 *  - AuthSessionStore: token/user caches, signals and storage persistence.
 *  - AuthSuccessHandler: client-login funnel (session + telemetry).
 *  - AccountBlockedStore: blocked-account modal state.
 *  - AuthModalStore: auth / forgot-password modal state.
 *  - OAuthAccountLinkService: Google/Apple ↔ local-account linking.
 *  - NativeOAuthSignInService: Capacitor Google/Apple sign-in and sign-out.
 */
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
   * Platform detector — used to gate the OAuth flow between web (redirect)
   * and native (idToken exchange via POST /api/auth/google/native).
   */
  private readonly platform = inject(PlatformService);

  /**
   * Telemetry: associates analytics/crashlytics reports with the logged-in
   * user and tracks login/logout funnel events. Best-effort — every call
   * is fire-and-forget so telemetry never blocks the auth flow.
   */
  private readonly analytics = inject(ANALYTICS);
  private readonly crashlytics = inject(CRASHLYTICS);

  private readonly session = inject(AuthSessionStore);
  private readonly authSuccess = inject(AuthSuccessHandler);
  private readonly blocked = inject(AccountBlockedStore);
  private readonly modals = inject(AuthModalStore);
  private readonly accountLink = inject(OAuthAccountLinkService);
  private readonly nativeSignIn = inject(NativeOAuthSignInService);

  // ─── Blocked account ────────────────────────────────────────

  readonly blockedInfo = this.blocked.blockedInfo;

  triggerAccountBlocked(error: HttpErrorResponse | null | undefined): boolean {
    return this.blocked.triggerAccountBlocked(error);
  }

  clearAccountBlocked(): void {
    this.blocked.clearAccountBlocked();
  }

  notifyAccountBlocked(code: AccountBlockedCode, message: string, reason?: string): void {
    this.blocked.notifyAccountBlocked(code, message, reason);
  }

  // ─── Modal state ────────────────────────────────────────────

  readonly nativeOAuthLoading = this.nativeSignIn.nativeOAuthLoading;

  readonly authModalOpen = this.modals.authModalOpen;
  readonly authModalInitialMode = this.modals.authModalInitialMode;
  readonly authModalPrefillEmail = this.modals.authModalPrefillEmail;
  readonly forgotPasswordModalOpen = this.modals.forgotPasswordModalOpen;

  readonly linkGoogleModalOpen = this.accountLink.linkGoogleModalOpen;
  readonly linkAppleModalOpen = this.accountLink.linkAppleModalOpen;

  openAuthModal(mode: AuthModalMode = 'login', prefillEmail = ''): void {
    this.modals.openAuthModal(mode, prefillEmail);
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
    this.modals.closeAuthModal();
  }

  openForgotPasswordModal(): void {
    this.modals.openForgotPasswordModal();
  }

  closeForgotPasswordModal(): void {
    this.modals.closeForgotPasswordModal();
  }

  // ─── OAuth ↔ local account linking ──────────────────────────

  openLinkGoogleModal(idToken: string): void {
    this.accountLink.openLinkGoogleModal(idToken);
  }

  closeLinkGoogleModal(): void {
    this.accountLink.closeLinkGoogleModal();
  }

  linkGoogleWithPassword(password: string): Observable<AuthResponse> {
    return this.accountLink.linkGoogleWithPassword(password);
  }

  openLinkAppleModal(
    identityToken: string,
    firstName?: string,
    lastName?: string,
  ): void {
    this.accountLink.openLinkAppleModal(identityToken, firstName, lastName);
  }

  closeLinkAppleModal(): void {
    this.accountLink.closeLinkAppleModal();
  }

  linkAppleWithPassword(password: string): Observable<AuthResponse> {
    return this.accountLink.linkAppleWithPassword(password);
  }

  // ─── Session state ──────────────────────────────────────────

  readonly currentUser = this.session.currentUser;

  readonly isAuthenticated = computed(() => !!this.session.currentUser());

  readonly sessionExpired = this.session.sessionExpired;

  readonly userFullName = computed(() => {
    const user = this.session.currentUser();
    if (!user) return '';
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.username || user.email || 'Usuario';
  });

  readonly userAvatar = computed(() => {
    const user = this.session.currentUser();
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

  // ─── Métodos públicos ───────────────────────────────────────

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap((response) => this.authSuccess.handle(response)),
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
        if (response.success) {
          // Track the account creation regardless of whether email
          // verification is required (the sign-up itself succeeded).
          void this.analytics.logEvent(AnalyticsEvent.SignUp, { method: 'email' });
        }
        if (
          !response.data?.requiresVerification &&
          !response.data?.requiresLinkVerification &&
          response.data?.token
        ) {
          this.authSuccess.handle(response);
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
            this.session.startSession(response.data.token, response.data.user, CLIENT_SESSION_SCOPE);
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
            this.session.startSession(response.data.token, response.data.user, CLIENT_SESSION_SCOPE);
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

  // ─── OAuth sign-in ──────────────────────────────────────────────

  loginWithOAuth(provider: OAuthProvider): void {
    if (this.platform.isNative()) {
      // Native flow: open OS Google picker → receive idToken → exchange
      // it for the app's JWT via POST /api/auth/google/native.
      void this.nativeSignIn.signInWithGoogle();
      return;
    }
    // Web flow (unchanged): persist return URL and let Passport handle the
    // browser redirect.
    void this.storage.set('oauth_return_url', window.location.pathname);
    window.location.href = `${this.apiUrl}/${provider}`;
  }

  /**
   * Public entry point for the iOS "Continue with Apple" button. Mirrors
   * `loginWithOAuth('google')` in shape — fire-and-forget; the button is
   * already gated by `platform.isIos()` in auth-modal so we don't repeat
   * the check (defensive `appleAuth.isAvailable()` is in the strategy).
   *
   * No web fallback: Apple Sign-In via JS SDK is out of scope for v1. If a
   * web user somehow reaches this method (shouldn't be possible), the
   * native strategy throws and surfaces a toast via the existing handler.
   */
  loginWithApple(): void {
    void this.nativeSignIn.signInWithApple();
  }

  // ─── Session lifecycle ──────────────────────────────────────────

  /**
   * Saves an admin session in admin-only storage keys, leaving the client
   * keys untouched.
   */
  handleAdminLogin(token: string, user: User): void {
    this.session.startSession(token, user, ADMIN_SESSION_SCOPE);
  }

  handleOAuthCallback(token: string): void {
    // Clear any stale user cache before persisting the new token. The
    // user payload is fetched right after via loadUserProfile().
    this.session.beginOAuthSession(token);
  }

  /**
   * Reemplaza el JWT y el user cacheado con una sesión recién emitida por
   * el backend. Se usa cuando un endpoint autenticado (e.g. change-password)
   * invalida el token actual y devuelve uno nuevo para mantener al usuario
   * logueado sin tener que rehacer login.
   */
  applyNewSession(token: string, user: User): void {
    const { tokenKey, userKey } = this.session.getStorageKeys();
    this.session.startSession(token, user, { tokenKey, userKey });
  }

  /**
   * Merges a partial update into the cached user without rotating the JWT.
   * Used by preference endpoints (e.g. notification toggles) that mutate
   * a single field server-side and return the updated payload.
   */
  patchCurrentUser(patch: Partial<User>): void {
    const current = this.session.currentUser();
    if (!current) return;
    const merged: User = { ...current, ...patch };
    const { userKey } = this.session.getStorageKeys();
    this.session.persistUserOnly(merged, userKey);
    this.session.setCurrentUser(merged);
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
    const isAdmin = this.session.isAdminContext();

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
        this.nativeSignIn.signOutGoogleSilent(),
        this.nativeSignIn.signOutAppleSilent(),
      ]),
      new Promise<void>((resolve) => setTimeout(resolve, 1500)),
    ]);

    const { tokenKey, userKey } = this.session.getStorageKeys();

    // Best-effort server notification — proceed with local cleanup
    // regardless of network outcome.
    if (!isAdmin) {
      this.http.post(`${this.apiUrl}/logout`, {}).subscribe({
        next: () => {},
        error: () => {},
      });
    }

    this.session.clearStoredSession({ tokenKey, userKey });
    void this.storage.remove('oauth_return_url');
    this.session.setCurrentUser(null);

    // Telemetry: drop the user correlation so post-logout reports are
    // anonymous, and track the logout event.
    void this.analytics.logEvent(AnalyticsEvent.Logout);
    void this.analytics.setUserId(null);
    void this.crashlytics.setUserId(null);

    this.router.navigate(isAdmin ? ['/admin/login'] : ['/']);
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
    const { tokenKey, userKey } = this.session.getStorageKeys();
    this.session.clearStoredSession({ tokenKey, userKey });
    this.session.setCurrentUser(null);
    this.session.setSessionExpired(true);
  }

  clearSessionExpired(): void {
    this.session.setSessionExpired(false);
  }

  /**
   * Returns the cached JWT for the current scope (cliente or admin),
   * synchronously. Reads from the session store's in-memory cache, NOT
   * from storage — `loadCacheFromStorage()` must have run during
   * APP_INITIALIZER.
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
    return this.session.getToken();
  }

  setUserFromStorage(): void {
    const user = this.session.getStoredUser();
    if (user) {
      this.session.setCurrentUser(user);
    }
  }

  isAdminSession(): boolean {
    return this.session.isAdminContext();
  }

  loadUserProfile(): Observable<{ success: boolean; data: User }> {
    const isAdmin = this.session.isAdminContext();

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
            const { userKey } = this.session.getStorageKeys();
            this.session.persistUserOnly(userData, userKey);
            this.session.setCurrentUser(userData);
          }
        }),
        catchError((error) => {
          if (error.status === 401 || error.status === 403) {
            const { tokenKey, userKey } = this.session.getStorageKeys();
            this.session.clearStoredSession({ tokenKey, userKey });
            this.session.setCurrentUser(null);
          }
          return throwError(() => error);
        })
      );
  }

  /**
   * Hydrates the in-memory token + user caches from the platform storage.
   * MUST be called and AWAITED during APP_INITIALIZER — see
   * `AuthSessionStore.loadCacheFromStorage` for the full contract.
   */
  loadCacheFromStorage(): Promise<void> {
    return this.session.loadCacheFromStorage();
  }

  // ─── Métodos privados ───────────────────────────────────────

  private handleAuthError(error: unknown): Observable<never> {
    return throwError(() => error);
  }
}
