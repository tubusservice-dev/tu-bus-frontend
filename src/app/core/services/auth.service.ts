import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
} from '../../models';

// Keys separadas para cliente y admin — nunca se pisan entre sí
const CLIENT_TOKEN_KEY = 'auth_token';
const CLIENT_USER_KEY = 'auth_user';
const ADMIN_TOKEN_KEY = 'admin_auth_token';
const ADMIN_USER_KEY = 'admin_auth_user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  /** Estado del usuario actual */
  private readonly currentUserSignal = signal<User | null>(this.getStoredUser());

  /** Indica si la sesión expiró (para mostrar mensaje) */
  private readonly sessionExpiredSignal = signal(false);

  /** Controla la visibilidad del modal de auth desde cualquier componente */
  private readonly authModalOpenSignal = signal(false);
  readonly authModalOpen = this.authModalOpenSignal.asReadonly();

  openAuthModal(): void {
    this.authModalOpenSignal.set(true);
  }

  closeAuthModal(): void {
    this.authModalOpenSignal.set(false);
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
   * Registra un nuevo usuario (cliente)
   */
  register(data: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, data).pipe(
      tap((response) => this.handleAuthSuccess(response)),
      catchError((error) => this.handleAuthError(error))
    );
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
   * Llamado desde el interceptor cuando recibe un 401.
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
    if (response.success && response.data) {
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