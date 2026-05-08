import { Injectable, Injector, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '@env';
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

  private readonly currentUserSignal = signal<User | null>(this.getStoredUser());

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

  private readonly authModalOpenSignal = signal(false);
  readonly authModalOpen = this.authModalOpenSignal.asReadonly();

  private readonly authModalInitialModeSignal = signal<AuthModalMode>('login');
  readonly authModalInitialMode = this.authModalInitialModeSignal.asReadonly();

  private readonly authModalPrefillEmailSignal = signal<string>('');
  readonly authModalPrefillEmail = this.authModalPrefillEmailSignal.asReadonly();

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
            localStorage.setItem(CLIENT_TOKEN_KEY, response.data.token);
            localStorage.setItem(CLIENT_USER_KEY, JSON.stringify(response.data.user));
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
            localStorage.setItem(CLIENT_TOKEN_KEY, response.data.token);
            localStorage.setItem(CLIENT_USER_KEY, JSON.stringify(response.data.user));
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
    localStorage.setItem('oauth_return_url', window.location.pathname);
    window.location.href = `${this.apiUrl}/${provider}`;
  }

  /**
   * Saves an admin session in admin-only storage keys, leaving the client
   * keys untouched.
   */
  handleAdminLogin(token: string, user: User): void {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
    this.currentUserSignal.set(user);
    this.sessionExpiredSignal.set(false);
  }

  handleOAuthCallback(token: string): void {
    localStorage.removeItem(CLIENT_USER_KEY);
    this.currentUserSignal.set(null);
    localStorage.setItem(CLIENT_TOKEN_KEY, token);
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

    // Best-effort: unregister FCM token before clearing the JWT. Capped
    // at 1.5 s so a slow network can't make the logout button feel stuck.
    await Promise.race([
      this.unregisterFcmTokenSilent(isAdmin),
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

    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    localStorage.removeItem('oauth_return_url');
    this.currentUserSignal.set(null);
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
    const { tokenKey, userKey } = this.getStorageKeys();
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    this.currentUserSignal.set(null);
    this.sessionExpiredSignal.set(true);
  }

  clearSessionExpired(): void {
    this.sessionExpiredSignal.set(false);
  }

  getToken(): string | null {
    const { tokenKey } = this.getStorageKeys();
    return localStorage.getItem(tokenKey);
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
            localStorage.setItem(userKey, JSON.stringify(userData));
            this.currentUserSignal.set(userData);
          }
        }),
        catchError((error) => {
          if (error.status === 401 || error.status === 403) {
            const { tokenKey, userKey } = this.getStorageKeys();
            localStorage.removeItem(tokenKey);
            localStorage.removeItem(userKey);
            this.currentUserSignal.set(null);
          }
          return throwError(() => error);
        })
      );
  }

  // ─── Métodos privados ───────────────────────────────────────

  private handleAuthSuccess(response: AuthResponse): void {
    if (response.success && response.data && response.data.token) {
      localStorage.setItem(CLIENT_TOKEN_KEY, response.data.token);
      localStorage.setItem(CLIENT_USER_KEY, JSON.stringify(response.data.user));
      this.currentUserSignal.set(response.data.user);
      this.sessionExpiredSignal.set(false);
    }
  }

  private handleAuthError(error: unknown): Observable<never> {
    return throwError(() => error);
  }

  private getStoredUser(): User | null {
    const { userKey } = this.getStorageKeys();
    const userStr = localStorage.getItem(userKey);
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch {
        return null;
      }
    }
    return null;
  }
}
