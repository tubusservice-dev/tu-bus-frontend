import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
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
} from '../../models';

// Keys separadas para cliente y admin — nunca se pisan entre sí
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

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  /** Estado del usuario actual */
  private readonly currentUserSignal = signal<User | null>(this.getStoredUser());

  /** Indica si la sesión expiró (para mostrar mensaje) */
  private readonly sessionExpiredSignal = signal(false);

  /** Información estructurada cuando una cuenta no puede usar el sistema. */
  private readonly blockedInfoSignal = signal<AccountBlockedInfo | null>(null);
  readonly blockedInfo = this.blockedInfoSignal.asReadonly();

  /**
   * Reads an HTTP error and, if its `code` matches a blocked-account status,
   * raises the global account-blocked modal. Returns true when the modal was
   * triggered so callers can skip their inline error handling.
   */
  triggerAccountBlocked(error: HttpErrorResponse | null | undefined): boolean {
    const body = error?.error as { code?: string; message?: string; details?: { reason?: string } } | undefined;
    const code = body?.code;
    if (!code || !BLOCK_CODES.has(code as AccountBlockedCode)) return false;

    this.blockedInfoSignal.set({
      code: code as AccountBlockedCode,
      message: body?.message || 'Tu cuenta no puede acceder al sistema.',
      reason: body?.details?.reason,
    });
    return true;
  }

  /** Dismisses the account-blocked modal. */
  clearAccountBlocked(): void {
    this.blockedInfoSignal.set(null);
  }

  /**
   * Raises the blocked-account modal with an explicit code/message, for
   * callers that don't have a full HttpErrorResponse — e.g. the OAuth
   * callback decoding the error from query params.
   */
  notifyAccountBlocked(code: AccountBlockedCode, message: string, reason?: string): void {
    this.blockedInfoSignal.set({ code, message, reason });
  }

  /** Controla la visibilidad del modal de auth desde cualquier componente */
  private readonly authModalOpenSignal = signal(false);
  readonly authModalOpen = this.authModalOpenSignal.asReadonly();

  /**
   * Initial state for the global auth modal. Owned by the service so any
   * component can request a specific open mode (login vs register, with an
   * optional email prefill) without holding local copies of these signals.
   * The modal itself is mounted at the application root — see app.html.
   */
  private readonly authModalInitialModeSignal = signal<'login' | 'register'>('login');
  readonly authModalInitialMode = this.authModalInitialModeSignal.asReadonly();

  private readonly authModalPrefillEmailSignal = signal<string>('');
  readonly authModalPrefillEmail = this.authModalPrefillEmailSignal.asReadonly();

  openAuthModal(mode: 'login' | 'register' = 'login', prefillEmail = ''): void {
    this.authModalInitialModeSignal.set(mode);
    this.authModalPrefillEmailSignal.set(prefillEmail);
    this.authModalOpenSignal.set(true);
  }

  closeAuthModal(): void {
    this.authModalOpenSignal.set(false);
    this.authModalInitialModeSignal.set('login');
    this.authModalPrefillEmailSignal.set('');
  }

  /** Usuario actual (solo lectura) */
  readonly currentUser = this.currentUserSignal.asReadonly();

  /** Indica si el usuario está autenticado */
  readonly isAuthenticated = computed(() => !!this.currentUserSignal());

  /** Indica si la sesión expiró */
  readonly sessionExpired = this.sessionExpiredSignal.asReadonly();

  /** Nombre completo del usuario */
  readonly userFullName = computed(() => {
    const user = this.currentUserSignal();
    if (!user) return '';
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.username || user.email || 'Usuario';
  });

  /** Avatar del usuario */
  readonly userAvatar = computed(() => {
    const user = this.currentUserSignal();
    if (user?.avatar) return user.avatar;
    const name = this.userFullName();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=001d56&color=fff&size=128`;
  });

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {
    // La inicialización de sesión se hace en APP_INITIALIZER
  }

  // ─── Helpers para detectar contexto ─────────────────────────

  /** Detecta si estamos en rutas /admin (funciona antes de que el Router esté listo) */
  private isAdminContext(): boolean {
    return window.location.pathname.startsWith('/admin');
  }

  /** Retorna las keys de localStorage según el contexto actual */
  private getStorageKeys(): { tokenKey: string; userKey: string } {
    return this.isAdminContext()
      ? { tokenKey: ADMIN_TOKEN_KEY, userKey: ADMIN_USER_KEY }
      : { tokenKey: CLIENT_TOKEN_KEY, userKey: CLIENT_USER_KEY };
  }

  // ─── Métodos públicos ───────────────────────────────────────

  /**
   * Inicia sesión con email y contraseña (cliente)
   */
  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap((response) => this.handleAuthSuccess(response)),
      catchError((error) => this.handleAuthError(error))
    );
  }

  /**
   * Registra un nuevo usuario (cliente).
   *
   * Si el backend devuelve `requiresVerification: true`, NO se hace auto-login —
   * el componente debe mostrar el modal de verificación pendiente.
   */
  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, data).pipe(
      tap((response) => {
        // Only auto-login when no verification is pending
        if (!response.data?.requiresVerification && response.data?.token) {
          this.handleAuthSuccess(response);
        }
      }),
      catchError((error) => this.handleAuthError(error))
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
    return this.http.post<VerifyEmailResponse>(`${this.apiUrl}/verify-email`, { token });
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

  // ─── Forgot-password modal control (for cross-component triggers) ───

  private readonly forgotPasswordModalOpenSignal = signal(false);
  readonly forgotPasswordModalOpen = this.forgotPasswordModalOpenSignal.asReadonly();

  openForgotPasswordModal(): void {
    this.closeAuthModal();
    this.forgotPasswordModalOpenSignal.set(true);
  }

  closeForgotPasswordModal(): void {
    this.forgotPasswordModalOpenSignal.set(false);
  }

  /**
   * Inicia el flujo de OAuth
   */
  loginWithOAuth(provider: OAuthProvider): void {
    // Guardar la URL actual para redirigir después del callback
    localStorage.setItem('oauth_return_url', window.location.pathname);
    window.location.href = `${this.apiUrl}/${provider}`;
  }

  /**
   * Maneja el login de admin.
   * Guarda SOLO en las keys de admin, sin tocar las del cliente.
   */
  handleAdminLogin(token: string, user: User): void {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
    this.currentUserSignal.set(user);
    this.sessionExpiredSignal.set(false);
  }

  /**
   * Procesa el callback de OAuth (siempre cliente).
   */
  handleOAuthCallback(token: string): void {
    localStorage.removeItem(CLIENT_USER_KEY);
    this.currentUserSignal.set(null);
    localStorage.setItem(CLIENT_TOKEN_KEY, token);
  }

  /**
   * Cierra la sesión según el contexto actual (admin o cliente).
   */
  logout(): void {
    const { tokenKey, userKey } = this.getStorageKeys();
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    this.currentUserSignal.set(null);
    this.router.navigate(['/']);
  }

  /**
   * Maneja la expiración de sesión.
   * Llamado desde el interceptor cuando recibe un 401 o un 403 de cuenta bloqueada.
   * El mensaje específico de bloqueo vive en blockedInfo — este método solo
   * se encarga de limpiar la sesión local.
   */
  handleSessionExpired(): void {
    const { tokenKey, userKey } = this.getStorageKeys();
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    this.currentUserSignal.set(null);
    this.sessionExpiredSignal.set(true);
  }

  /**
   * Limpia el flag de sesión expirada
   */
  clearSessionExpired(): void {
    this.sessionExpiredSignal.set(false);
  }

  /**
   * Obtiene el token almacenado según el contexto (admin o cliente)
   */
  getToken(): string | null {
    const { tokenKey } = this.getStorageKeys();
    return localStorage.getItem(tokenKey);
  }

  /**
   * Actualiza el estado del usuario desde localStorage
   */
  setUserFromStorage(): void {
    const user = this.getStoredUser();
    if (user) {
      this.currentUserSignal.set(user);
    }
  }

  /**
   * Indica si el token actual es de admin
   */
  isAdminSession(): boolean {
    return this.isAdminContext();
  }

  /**
   * Carga el perfil del usuario desde el servidor.
   * Usa el endpoint correcto según el contexto (admin vs cliente).
   */
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

  /**
   * Maneja la respuesta exitosa de autenticación (login/register de cliente)
   */
  private handleAuthSuccess(response: AuthResponse): void {
    if (response.success && response.data && response.data.token) {
      localStorage.setItem(CLIENT_TOKEN_KEY, response.data.token);
      localStorage.setItem(CLIENT_USER_KEY, JSON.stringify(response.data.user));
      this.currentUserSignal.set(response.data.user);
      this.sessionExpiredSignal.set(false);
    }
  }

  /**
   * Maneja errores de autenticación
   */
  private handleAuthError(error: unknown): Observable<never> {
    return throwError(() => error);
  }

  /**
   * Obtiene el usuario almacenado según el contexto
   */
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