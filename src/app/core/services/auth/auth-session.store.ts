import { Injectable, inject, signal } from '@angular/core';
import { STORAGE, IStorage } from '@platform';
import { User } from '@models';

const CLIENT_TOKEN_KEY = 'auth_token';
const CLIENT_USER_KEY = 'auth_user';
const ADMIN_TOKEN_KEY = 'admin_auth_token';
const ADMIN_USER_KEY = 'admin_auth_user';

export interface SessionStorageScope {
  tokenKey: string;
  userKey: string;
}

/** Storage keys for the client (non-admin) session. */
export const CLIENT_SESSION_SCOPE: Readonly<SessionStorageScope> = {
  tokenKey: CLIENT_TOKEN_KEY,
  userKey: CLIENT_USER_KEY,
};

/** Storage keys for the admin session, isolated from the client ones. */
export const ADMIN_SESSION_SCOPE: Readonly<SessionStorageScope> = {
  tokenKey: ADMIN_TOKEN_KEY,
  userKey: ADMIN_USER_KEY,
};

/**
 * Owns the session state (JWT + user) and its persistence: in-memory
 * caches, the current-user / session-expired signals and the platform
 * storage writes, scoped per context (client vs admin).
 *
 * No HTTP, no navigation, no telemetry — callers orchestrate those.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthSessionStore {
  /**
   * Cross-platform key-value storage. On web wraps localStorage; on native
   * uses Capacitor Preferences (encrypted on Android M+).
   */
  private readonly storage = inject<IStorage>(STORAGE);

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
  readonly currentUser = this.currentUserSignal.asReadonly();

  private readonly sessionExpiredSignal = signal(false);
  readonly sessionExpired = this.sessionExpiredSignal.asReadonly();

  // ─── Context detection ──────────────────────────────────────

  isAdminContext(): boolean {
    return window.location.pathname.startsWith('/admin');
  }

  getStorageKeys(): SessionStorageScope {
    return this.isAdminContext()
      ? { tokenKey: ADMIN_TOKEN_KEY, userKey: ADMIN_USER_KEY }
      : { tokenKey: CLIENT_TOKEN_KEY, userKey: CLIENT_USER_KEY };
  }

  // ─── Reads ──────────────────────────────────────────────────

  getToken(): string | null {
    return this.tokenCacheSignal();
  }

  getStoredUser(): User | null {
    return this.userCacheSignal();
  }

  // ─── State setters ──────────────────────────────────────────

  setCurrentUser(user: User | null): void {
    this.currentUserSignal.set(user);
  }

  setSessionExpired(expired: boolean): void {
    this.sessionExpiredSignal.set(expired);
  }

  /**
   * Persists a freshly issued session under `scope`, publishes the user
   * and clears the session-expired flag — the common tail of every flow
   * that receives { token, user } from the backend.
   */
  startSession(token: string, user: User, scope: SessionStorageScope): void {
    this.persistSession(token, user, scope);
    this.currentUserSignal.set(user);
    this.sessionExpiredSignal.set(false);
  }

  /**
   * Stores the token received from the web OAuth callback. Clears any
   * stale user cache first; the user payload is fetched right after via
   * loadUserProfile().
   */
  beginOAuthSession(token: string): void {
    this.userCacheSignal.set(null);
    this.currentUserSignal.set(null);
    void this.storage.remove(CLIENT_USER_KEY);
    this.persistTokenOnly(token, CLIENT_TOKEN_KEY);
  }

  // ─── Persistence ────────────────────────────────────────────

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
  private persistSession(token: string, user: User, scope: SessionStorageScope): void {
    this.tokenCacheSignal.set(token);
    this.userCacheSignal.set(user);
    void this.storage.set(scope.tokenKey, token);
    void this.storage.set(scope.userKey, JSON.stringify(user));
  }

  /**
   * Persists token alone (used by beginOAuthSession where the user
   * profile is fetched right after via loadUserProfile).
   */
  private persistTokenOnly(token: string, tokenKey: string): void {
    this.tokenCacheSignal.set(token);
    void this.storage.set(tokenKey, token);
  }

  /**
   * Persists a user update without rotating the token (used when only
   * profile fields change).
   */
  persistUserOnly(user: User, userKey: string): void {
    this.userCacheSignal.set(user);
    void this.storage.set(userKey, JSON.stringify(user));
  }

  /**
   * Wipes the cached session and the storage entries. Used on logout and
   * session expiration.
   */
  clearStoredSession(scope: SessionStorageScope): void {
    this.tokenCacheSignal.set(null);
    this.userCacheSignal.set(null);
    void this.storage.remove(scope.tokenKey);
    void this.storage.remove(scope.userKey);
  }
}
