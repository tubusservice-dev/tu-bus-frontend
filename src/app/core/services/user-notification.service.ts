import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { Observable, tap, interval, Subscription, filter, firstValueFrom } from 'rxjs';
import { environment } from '@env';
import { AuthService } from './auth.service';
import { DeviceTokenService } from './device-token.service';
import { FirebaseMessagingService } from '@core/firebase';
import {
  UserNotification,
  UserNotificationListResponse,
  UserUnreadCountResponse,
} from '@models/user-notification.model';
import { browserNotify } from '@shared/utils/browser-notify.util';

/** Polling cadence when FCM is NOT active — push fallback via local toast. */
const POLL_INTERVAL_NO_FCM_MS = 30_000;

/** Polling cadence when FCM IS active — only used for eventual UI consistency. */
const POLL_INTERVAL_WITH_FCM_MS = 120_000;

/**
 * Wider view of the browser's notification permission state. Adds the
 * `'unsupported'` sentinel for environments where the API is missing
 * (e.g. iOS Safari without PWA installation).
 */
export type NotificationPermissionState =
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported';

/**
 * Snapshot reader that maps the browser's permission value into our
 * extended sentinel. Safe to call in any context — returns
 * `'unsupported'` when the API does not exist.
 */
const readBrowserPermission = (): NotificationPermissionState => {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
};

@Injectable({
  providedIn: 'root',
})
export class UserNotificationService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fcm = inject(FirebaseMessagingService);
  private readonly deviceTokenService = inject(DeviceTokenService);
  private readonly apiUrl = `${environment.apiUrl}/user-notifications`;
  private pollSub?: Subscription;
  private foregroundSub?: Subscription;
  private lastKnownCount = 0;
  private initialCountFetched = false;

  private readonly _unreadCount = signal(0);
  private readonly _notifications = signal<UserNotification[]>([]);
  private readonly _showPopover = signal(false);
  private readonly _currentToken = signal<string | null>(null);
  private readonly _permissionState = signal<NotificationPermissionState>(
    readBrowserPermission()
  );

  readonly unreadCount = this._unreadCount.asReadonly();
  readonly notifications = this._notifications.asReadonly();
  readonly showPopover = this._showPopover.asReadonly();
  /** True when this browser has an active FCM token registered with the backend. */
  readonly hasFcmToken = computed(() => this._currentToken() !== null);
  /** Current `Notification.permission` view exposed as a signal so the UI can react. */
  readonly permissionState = this._permissionState.asReadonly();

  /**
   * Stream of push events targeted at the customer scope. Surfaces every
   * push reaching this tab — foreground (`onMessage`) and background
   * (SW → postMessage) — so any client screen can react. Subscribers
   * MUST filter by `event.type` / `event.relatedOrder` to act only on
   * relevant events.
   */
  readonly pushReceived$ = this.fcm.onPushReceived$;

  constructor() {
    // The popover floats outside <router-outlet>; auto-close on any navigation
    // completion keeps it in sync with the visible view. Backstop for in-panel
    // CTAs (e.g. "Ver pedido") that navigate to a lazy-loaded route — prevents
    // the panel from appearing stuck during the chunk download. Cancel/Error
    // covered so a rejected guard doesn't leave it hanging.
    this.router.events
      .pipe(
        filter(
          (e): e is NavigationEnd | NavigationCancel | NavigationError =>
            e instanceof NavigationEnd ||
            e instanceof NavigationCancel ||
            e instanceof NavigationError,
        ),
      )
      .subscribe(() => {
        if (this._showPopover()) {
          this._showPopover.set(false);
        }
      });

    // React to auth state. When the customer logs in (or reloads while
    // authenticated) AND the browser already granted notifications in a
    // previous session, silently rehydrate the FCM token. We deliberately
    // do NOT auto-prompt for permission — modern browsers (Safari, Brave,
    // Firefox iOS, etc.) ignore prompts that lack a user gesture, so the
    // user just never sees it. The explicit toggle in the user menu owns
    // the prompt path now; that click is the gesture the browser needs.
    effect(() => {
      const user = this.authService.currentUser();
      this._permissionState.set(readBrowserPermission());
      if (!user) return;
      // Skip on admin context — AdminNotificationsService handles that subject.
      if (user.role === 'admin') return;
      if (this._currentToken() !== null) return;
      if (readBrowserPermission() !== 'granted') return;
      void this.rehydrateFcmToken();
    });
  }

  /**
   * Silently re-registers the FCM token when the browser already granted
   * permission in a previous session. No prompt, no UI noise — just
   * ensures the backend has an up-to-date target for this device.
   */
  private async rehydrateFcmToken(): Promise<void> {
    try {
      const token = await this.fcm.requestToken();
      if (!token) return;
      await firstValueFrom(this.deviceTokenService.registerForUser(token));
      this._currentToken.set(token);
      this.attachForegroundListener();
      this.adjustPollingInterval();
    } catch (err) {
      console.warn('[UserNotificationService] Token rehydration failed:', err);
    }
  }

  startPolling(): void {
    // Default cadence assumes no FCM. Once a token is registered,
    // adjustPollingInterval() switches to the slower cadence.
    this.startPollingWithInterval(POLL_INTERVAL_NO_FCM_MS);
  }

  stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
    // Reset tracking so future sessions don't mistakenly trigger push from stale state
    this.initialCountFetched = false;
    this.lastKnownCount = 0;
  }

  togglePopover(): void {
    const next = !this._showPopover();
    this._showPopover.set(next);
    if (next) this.fetchRecent();
  }

  closePopover(): void {
    this._showPopover.set(false);
  }

  fetchUnreadCount(): void {
    if (!this.authService.isAuthenticated()) return;
    this.http.get<UserUnreadCountResponse>(`${this.apiUrl}/unread-count`).subscribe({
      next: (res) => {
        const newCount = res.data.count;
        const previousCount = this._unreadCount();
        this._unreadCount.set(newCount);

        // Polling-based fallback push: only when FCM is NOT registered,
        // simulate a push by surfacing a local notification on count rise.
        // If FCM is active, the real push arrived (or will arrive) via SW —
        // do NOT double-notify.
        if (
          this.initialCountFetched &&
          newCount > previousCount &&
          this._currentToken() === null
        ) {
          this.triggerBrowserPushFromPolling();
        }
        this.initialCountFetched = true;
        this.lastKnownCount = newCount;
      },
      error: () => {},
    });
  }

  fetchRecent(): void {
    this.http.get<UserNotificationListResponse>(`${this.apiUrl}?limit=5&isRead=false`).subscribe({
      next: (res) => this._notifications.set(res.data),
      error: () => {},
    });
  }

  getAll(page = 1, limit = 20): Observable<UserNotificationListResponse> {
    return this.http.get<UserNotificationListResponse>(`${this.apiUrl}?page=${page}&limit=${limit}`);
  }

  markAsRead(id: string): Observable<unknown> {
    return this.http.patch(`${this.apiUrl}/${id}/read`, {}).pipe(
      tap(() => {
        this._notifications.update(list => list.filter(n => n.id !== id));
        this._unreadCount.update(c => Math.max(0, c - 1));
        // Refetch to fill the 5 slots with remaining unread
        this.fetchRecent();
      })
    );
  }

  markAllAsRead(): Observable<unknown> {
    return this.http.patch(`${this.apiUrl}/read-all`, {}).pipe(
      tap(() => {
        this._notifications.update(list => list.map(n => ({ ...n, isRead: true })));
        this._unreadCount.set(0);
      })
    );
  }

  /**
   * Request browser notification permission and register the FCM token
   * with the backend if granted.
   *
   * MUST be invoked from a user gesture (click/tap on the toggle) so the
   * browser actually shows its native prompt — automatic calls are ignored
   * by Safari/Firefox/Brave and silently dropped.
   *
   * Idempotent: safe to call multiple times. Always re-syncs `permissionState`
   * with the browser before returning.
   */
  async requestNotificationPermission(): Promise<void> {
    if (!this.fcm.isMessagingSupportedSync()) {
      this._permissionState.set('unsupported');
      return;
    }

    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {
        this._permissionState.set(readBrowserPermission());
        return;
      }
    }
    this._permissionState.set(readBrowserPermission());
    if (Notification.permission !== 'granted') return;

    const token = await this.fcm.requestToken();
    if (!token) return;

    try {
      await firstValueFrom(this.deviceTokenService.registerForUser(token));
      this._currentToken.set(token);
      this.attachForegroundListener();
      this.adjustPollingInterval();
    } catch (err) {
      console.warn('[UserNotificationService] Failed to register FCM token:', err);
    }
  }

  /**
   * Unregister the active FCM token from the backend. Used both on logout
   * (called by AuthService before clearing the JWT) and when the user
   * deliberately deactivates push from the toggle.
   */
  async unregisterToken(): Promise<void> {
    const token = this._currentToken();
    if (!token) return;
    try {
      await firstValueFrom(this.deviceTokenService.unregisterForUser(token));
    } catch (err) {
      console.warn('[UserNotificationService] Failed to unregister token on logout:', err);
    }
    this._currentToken.set(null);
    this.foregroundSub?.unsubscribe();
    this.foregroundSub = undefined;
    // Refresh permission view in case the user changed it in browser settings.
    this._permissionState.set(readBrowserPermission());
  }

  private startPollingWithInterval(ms: number): void {
    this.pollSub?.unsubscribe();
    this.fetchUnreadCount();
    this.pollSub = interval(ms).subscribe(() => {
      if (this.authService.isAuthenticated()) {
        this.fetchUnreadCount();
      }
    });
  }

  private adjustPollingInterval(): void {
    // FCM is now active — slow the polling down. It still runs as an
    // eventual-consistency backstop in case a push is missed.
    this.startPollingWithInterval(POLL_INTERVAL_WITH_FCM_MS);
  }

  private attachForegroundListener(): void {
    if (this.foregroundSub) return;
    this.foregroundSub = this.fcm.onForegroundMessage$.subscribe((payload) => {
      this.fetchUnreadCount();
      // Always surface the native OS toast in foreground. The FCM SDK
      // intentionally skips the system notification when the page is open;
      // we re-emit it manually so the customer gets the same audible cue
      // regardless of tab visibility — matches the behaviour of any other
      // chat-like app (WhatsApp etc.).
      this.showNativeFromPayload(payload);
    });
  }

  private showNativeFromPayload(payload: {
    notification?: { title?: string; body?: string };
    data?: Record<string, string>;
  }): void {
    const title = payload.notification?.title || 'Nueva notificación';
    const body = payload.notification?.body || '';
    const url = payload.data?.['url'] || '/perfil#notificaciones';

    browserNotify(title, {
      body,
      icon: '/autobus.png',
      badge: '/autobus.png',
      tag: `user-notif-fg-${Date.now()}`,
      data: { url },
    });
  }

  /**
   * Fallback path: when FCM is NOT active, simulate a push by surfacing
   * a local OS notification when the polling detects an unread-count rise.
   */
  private triggerBrowserPushFromPolling(): void {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    this.http.get<UserNotificationListResponse>(`${this.apiUrl}?limit=1`).subscribe({
      next: (res) => {
        const latest = res.data?.[0];
        if (!latest) return;

        browserNotify(latest.title || 'Nueva notificación', {
          body: latest.message,
          icon: '/autobus.png',
          badge: '/autobus.png',
          tag: `user-notif-${latest.id}`,
          data: { url: '/perfil#notificaciones' },
        });
      },
      error: () => {},
    });
  }
}
