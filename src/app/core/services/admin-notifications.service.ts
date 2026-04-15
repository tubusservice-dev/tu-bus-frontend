import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, interval, Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminNotification,
  NotificationListResponse,
  UnreadCountResponse,
  NotificationResponse,
} from '../../models/notification.model';
import { SettingsService } from './settings.service';

@Injectable({
  providedIn: 'root',
})
export class AdminNotificationsService {
  private readonly http = inject(HttpClient);
  private readonly settingsService = inject(SettingsService);
  private readonly apiUrl = `${environment.apiUrl}/admin/notifications`;
  private pollSub?: Subscription;
  private lastKnownCount = 0;
  private initialCountFetched = false;

  private readonly _unreadCount = signal(0);
  private readonly _notifications = signal<AdminNotification[]>([]);
  private readonly _showPopover = signal(false);

  readonly unreadCount = this._unreadCount.asReadonly();
  readonly notifications = this._notifications.asReadonly();
  readonly showPopover = this._showPopover.asReadonly();

  startPolling(): void {
    this.fetchUnreadCount();
    this.pollSub = interval(30000).subscribe(() => this.fetchUnreadCount());
  }

  stopPolling(): void {
    this.pollSub?.unsubscribe();
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

        // Trigger browser push when count increases (skip the first fetch)
        if (this.initialCountFetched && newCount > previousCount) {
          this.triggerBrowserPush(newCount - previousCount);
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
   * Request browser notification permission on startup.
   * Called by AdminLayoutComponent.ngOnInit().
   */
  async requestNotificationPermission(): Promise<void> {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {
        // Silent fail — user may have dismissed or denied
      }
    }
  }

  /**
   * Fire a browser push notification if enabled in settings and permission granted.
   */
  private triggerBrowserPush(newCount: number): void {
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

        try {
          const notif = new Notification(latest.title || 'Nueva notificación', {
            body: latest.message,
            icon: '/autobus.png',
            badge: '/autobus.png',
            tag: `admin-notif-${latest.id}`,
            requireInteraction: false,
          });

          notif.onclick = () => {
            window.focus();
            notif.close();
          };
        } catch {
          // Silent fail — some browsers may block
        }
      },
      error: () => {},
    });
  }
}
