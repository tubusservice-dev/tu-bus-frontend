import { Injectable, inject, signal, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, interval, Subscription, firstValueFrom } from 'rxjs';
import { environment } from '@env';
import {
  AdminNotification,
  NotificationListResponse,
  UnreadCountResponse,
  NotificationResponse,
} from '@models/notification.model';
import { SettingsService } from './settings.service';
import { AuthService } from './auth.service';
import { DeviceTokenService } from './device-token.service';
import { FirebaseMessagingService } from '@core/firebase';
import { browserNotify } from '@shared/utils/browser-notify.util';

/** Polling cadence when FCM is NOT active. */
const POLL_INTERVAL_NO_FCM_MS = 30_000;

/** Polling cadence when FCM IS active — eventual-consistency backstop only. */
const POLL_INTERVAL_WITH_FCM_MS = 120_000;

@Injectable({
  providedIn: 'root',
})
export class AdminNotificationsService {
  private readonly http = inject(HttpClient);
  private readonly settingsService = inject(SettingsService);
  private readonly authService = inject(AuthService);
  private readonly fcm = inject(FirebaseMessagingService);
  private readonly deviceTokenService = inject(DeviceTokenService);
  private readonly apiUrl = `${environment.apiUrl}/admin/notifications`;
  private pollSub?: Subscription;
  private foregroundSub?: Subscription;
  private currentToken: string | null = null;
  private permissionRequestedThisSession = false;
  private lastKnownCount = 0;
  private initialCountFetched = false;

  private readonly _unreadCount = signal(0);
  private readonly _notifications = signal<AdminNotification[]>([]);
  private readonly _showPopover = signal(false);

  readonly unreadCount = this._unreadCount.asReadonly();
  readonly notifications = this._notifications.asReadonly();
  readonly showPopover = this._showPopover.asReadonly();

  /**
   * Stream of push events targeted at the admin scope. Surfaces every
   * push reaching this tab — foreground (`onMessage`) and background
   * (SW → postMessage) — so any admin screen can react: order-detail
   * refreshes when a comment arrives, order list could highlight new
   * orders, etc. Subscribers MUST filter by `event.type` /
   * `event.relatedOrder` to act only on relevant events.
   */
  readonly pushReceived$ = this.fcm.onPushReceived$;

  constructor() {
    // Auto-trigger FCM registration on admin login or page reload while
    // authenticated. Mirrors the customer flow in UserNotificationService —
    // the two services target distinct subjectTypes on the backend, each
    // requesting its own token via the matching admin/user endpoint.
    effect(() => {
      const user = this.authService.currentUser();
      if (!user) {
        this.permissionRequestedThisSession = false;
        return;
      }
      if (user.role !== 'admin') return;
      if (this.permissionRequestedThisSession) return;
      this.permissionRequestedThisSession = true;
      setTimeout(() => {
        this.requestNotificationPermission().catch(() => {
          /* silent — polling fallback covers it */
        });
      }, 1500);
    });
  }

  startPolling(): void {
    this.startPollingWithInterval(POLL_INTERVAL_NO_FCM_MS);
  }

  stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
  }

  /** Retorna true si hay token de admin en localStorage (usuario admin logueado) */
  private hasAdminToken(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return !!localStorage.getItem('admin_auth_token');
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
    if (!this.hasAdminToken()) return;
    this.http.get<UnreadCountResponse>(`${this.apiUrl}/unread-count`).subscribe({
      next: (res) => {
        const newCount = res.data.count;
        const previousCount = this._unreadCount();
        this._unreadCount.set(newCount);

        // Polling-based fallback push: only when FCM is NOT registered.
        // If FCM is active, the real push arrived via SW — no double-notify.
        if (
          this.initialCountFetched &&
          newCount > previousCount &&
          !this.currentToken
        ) {
          this.triggerBrowserPushFromPolling(newCount - previousCount);
        }
        this.initialCountFetched = true;
        this.lastKnownCount = newCount;
      },
      error: () => {},
    });
  }

  fetchRecent(): void {
    if (!this.hasAdminToken()) return;
    this.http.get<NotificationListResponse>(`${this.apiUrl}?limit=5`).subscribe({
      next: (res) => this._notifications.set(res.data),
      error: () => {},
    });
  }

  getAll(page = 1, limit = 20): Observable<NotificationListResponse> {
    return this.http.get<NotificationListResponse>(`${this.apiUrl}?page=${page}&limit=${limit}`);
  }

  markAsRead(id: string): Observable<NotificationResponse> {
    return this.http.patch<NotificationResponse>(`${this.apiUrl}/${id}/read`, {}).pipe(
      tap(() => {
        this._notifications.update(list =>
          list.map(n => n.id === id ? { ...n, isRead: true } : n)
        );
        this._unreadCount.update(c => Math.max(0, c - 1));
      })
    );
  }

  /**
   * Request browser notification permission and register the admin's
   * FCM token with the backend if granted. Idempotent.
   *
   * Auto-invoked on admin login via the constructor effect. Still callable
   * by AdminLayoutComponent.ngOnInit() for explicit re-prompts.
   */
  async requestNotificationPermission(): Promise<void> {
    if (!this.fcm.isMessagingSupportedSync()) return;
    if (!('Notification' in window)) return;

    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {
        return;
      }
    }
    if (Notification.permission !== 'granted') return;

    const token = await this.fcm.requestToken();
    if (!token) return;

    try {
      await firstValueFrom(this.deviceTokenService.registerForAdmin(token));
      this.currentToken = token;
      this.attachForegroundListener();
      this.adjustPollingInterval();
    } catch (err) {
      console.warn('[AdminNotificationsService] Failed to register FCM token:', err);
    }
  }

  /**
   * Unregister the active admin FCM token. Called by AuthService before
   * clearing the JWT so the DELETE request travels authenticated.
   */
  async unregisterToken(): Promise<void> {
    if (!this.currentToken) return;
    const token = this.currentToken;
    try {
      await firstValueFrom(this.deviceTokenService.unregisterForAdmin(token));
    } catch (err) {
      console.warn('[AdminNotificationsService] Failed to unregister token:', err);
    }
    this.currentToken = null;
    this.foregroundSub?.unsubscribe();
    this.foregroundSub = undefined;
  }

  private startPollingWithInterval(ms: number): void {
    this.pollSub?.unsubscribe();
    this.fetchUnreadCount();
    this.pollSub = interval(ms).subscribe(() => this.fetchUnreadCount());
  }

  private adjustPollingInterval(): void {
    this.startPollingWithInterval(POLL_INTERVAL_WITH_FCM_MS);
  }

  private attachForegroundListener(): void {
    if (this.foregroundSub) return;
    this.foregroundSub = this.fcm.onForegroundMessage$.subscribe((payload) => {
      this.fetchUnreadCount();

      // Always surface the native OS toast in foreground. The FCM SDK
      // intentionally skips the system notification when the page is open;
      // we re-emit it manually so the admin gets the same audible cue
      // regardless of tab visibility — the user explicitly wants the
      // sound/banner every time a push arrives.
      //
      // Still gated by the global `browserPush` settings flag so admins
      // can mute the channel without losing the in-app badge.
      const prefs = this.settingsService.adminNotificationsConfig();
      if (!prefs?.browserPush) return;
      if (Notification.permission !== 'granted') return;

      const title = payload.notification?.title || 'Nueva notificación';
      const body = payload.notification?.body || '';
      const url = (payload.data && (payload.data as Record<string, string>)['url']) || '/admin';

      browserNotify(title, {
        body,
        icon: '/autobus.png',
        badge: '/autobus.png',
        tag: `admin-notif-fg-${Date.now()}`,
        data: { url },
      });
    });
  }

  /**
   * Fire a browser push notification if enabled in settings and permission granted.
   * Uses `browserNotify` so the call works on mobile Chrome with an active
   * Service Worker (where `new Notification()` throws TypeError).
   *
   * This is the FALLBACK path when FCM is not registered — driven by the
   * polling unread-count rise.
   */
  private triggerBrowserPushFromPolling(_newCount: number): void {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    // Check admin preferences
    const prefs = this.settingsService.adminNotificationsConfig();
    if (!prefs?.browserPush) return;

    // Fetch latest to get title/message of the newest notification
    this.http.get<NotificationListResponse>(`${this.apiUrl}?limit=1`).subscribe({
      next: (res) => {
        const latest = res.data?.[0];
        if (!latest) return;

        browserNotify(latest.title || 'Nueva notificación', {
          body: latest.message,
          icon: '/autobus.png',
          badge: '/autobus.png',
          tag: `admin-notif-${latest.id}`,
          requireInteraction: false,
          data: { url: '/admin' },
        });
      },
      error: () => {},
    });
  }
}
