import {
  Injectable,
  signal,
  computed,
  effect,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';

export type Theme = 'light' | 'dark';

/** localStorage keys — one per context. Admin and client are independent. */
const CLIENT_THEME_KEY = 'e-commerce-theme';
const ADMIN_THEME_KEY = 'admin-theme';

/**
 * Theme service with **two independent contexts** — client (public site)
 * and admin (back-office). Switching between `/admin/...` and any other
 * route automatically swaps the active theme; toggling in one context
 * does NOT leak into the other.
 *
 * Defaults differ on purpose:
 *   - Client first-boot: respects `prefers-color-scheme: dark` (web
 *     convention — users with a dark OS expect a dark site).
 *   - Admin first-boot: **always light**, regardless of OS. The admin is
 *     an operational panel; consistent screenshots, color-matched
 *     dashboards and visibility under bright office lighting matter more
 *     than honoring the OS preference here.
 *
 * Persistence keys:
 *   - `e-commerce-theme` — client choice (kept as-is for backward compat
 *     with sessions already saved in production).
 *   - `admin-theme`      — admin choice (new).
 */
@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly router = inject(Router);

  /** Per-context theme state, hydrated from storage on first construction. */
  private readonly clientThemeSignal = signal<Theme>(this.getInitialClientTheme());
  private readonly adminThemeSignal = signal<Theme>(this.getInitialAdminTheme());

  /**
   * Whether the current URL falls under `/admin`. Updated on every
   * NavigationEnd so the active theme follows the user's navigation
   * without consumers needing to re-read the route.
   */
  private readonly isAdminContextSignal = signal<boolean>(this.computeIsAdmin());

  /** Active theme for the CURRENT context. Components read this. */
  readonly theme = computed<Theme>(() =>
    this.isAdminContextSignal()
      ? this.adminThemeSignal()
      : this.clientThemeSignal()
  );

  /** Computed for templates that only care about the dark check. */
  readonly isDark = (): boolean => this.theme() === 'dark';

  constructor() {
    // Keep the context signal in sync with the route. NavigationEnd is the
    // moment Angular finished switching pages — reading window.location
    // here is safe and consistent. No unsubscribe: this service is
    // providedIn: 'root', so it lives for the whole app session.
    if (this.isBrowser) {
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe(() => this.isAdminContextSignal.set(this.computeIsAdmin()));
    }

    // Single source of DOM truth: any change to client theme, admin theme,
    // OR active context re-runs applyTheme with the correct theme for the
    // active context, and persists it under the correct storage key.
    effect(() => {
      this.applyTheme(this.theme(), this.isAdminContextSignal());
    });
  }

  /** Toggles the theme in the ACTIVE context only. The other is untouched. */
  toggleTheme(): void {
    if (this.isAdminContextSignal()) {
      this.adminThemeSignal.update((t) => (t === 'light' ? 'dark' : 'light'));
    } else {
      this.clientThemeSignal.update((t) => (t === 'light' ? 'dark' : 'light'));
    }
  }

  /** Sets the theme for the ACTIVE context. */
  setTheme(theme: Theme): void {
    if (this.isAdminContextSignal()) {
      this.adminThemeSignal.set(theme);
    } else {
      this.clientThemeSignal.set(theme);
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────

  /**
   * Pathname-based context detection. Mirrors the convention used by
   * `AuthService.isAdminContext()` — the URL prefix `/admin` is the
   * single source of truth for which scope the user is currently in.
   */
  private computeIsAdmin(): boolean {
    if (!this.isBrowser) return false;
    return window.location.pathname.startsWith('/admin');
  }

  /**
   * Client initial theme:
   *   1) saved client preference if any.
   *   2) OS preference (prefers-color-scheme).
   *   3) light as ultimate fallback.
   */
  private getInitialClientTheme(): Theme {
    if (!this.isBrowser) return 'light';

    const saved = localStorage.getItem(CLIENT_THEME_KEY) as Theme | null;
    if (saved === 'light' || saved === 'dark') return saved;

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }

  /**
   * Admin initial theme: saved value if any, otherwise ALWAYS light. We
   * deliberately ignore `prefers-color-scheme` here — see class JSDoc.
   */
  private getInitialAdminTheme(): Theme {
    if (!this.isBrowser) return 'light';

    const saved = localStorage.getItem(ADMIN_THEME_KEY) as Theme | null;
    if (saved === 'light' || saved === 'dark') return saved;

    return 'light';
  }

  /**
   * Writes the active theme to the DOM and persists it under the storage
   * key of the active context. Called from the effect so it stays in sync
   * with every signal update.
   */
  private applyTheme(theme: Theme, isAdmin: boolean): void {
    if (!this.isBrowser) return;

    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Persist under the active context's key. Writes are idempotent so
    // re-applying the same value during a navigation transition is a no-op
    // from the user's perspective.
    const key = isAdmin ? ADMIN_THEME_KEY : CLIENT_THEME_KEY;
    localStorage.setItem(key, theme);
  }
}
