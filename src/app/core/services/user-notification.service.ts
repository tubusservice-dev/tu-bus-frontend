import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { Observable, tap, interval, Subscription, filter } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import {
  UserNotification,
  UserNotificationListResponse,
  UserUnreadCountResponse,
} from '../../models/user-notification.model';

@Injectable({
  providedIn: 'root',
})
export class UserNotificationService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly apiUrl = `${environment.apiUrl}/user-notifications`;
  private pollSub?: Subscription;
  private lastKnownCount = 0;
  private initialCountFetched = false;

  private readonly _unreadCount = signal(0);
  private readonly _notifications = signal<UserNotification[]>([]);
  private readonly _showPopover = signal(false);

  readonly unreadCount = this._unreadCount.asReadonly();
  readonly notifications = this._notifications.asReadonly();
  readonly showPopover = this._showPopover.asReadonly();

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
  }

  startPolling(): void {
    this.fetchUnreadCount();
    this.pollSub = interval(30000).subscribe(() => {
      if (this.authService.isAuthenticated()) {
        this.fetchUnreadCount();
      }
    });
  }

  stopPolling(): void {
    this.pollSub?.unsubscribe();
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

        // Trigger browser push when count increases (skip the first fetch)
        if (this.initialCountFetched && newCount > previousCount) {
          this.triggerBrowserPush();
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

  markAsRead(id: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${id}/read`, {}).pipe(
      tap(() => {
        this._notifications.update(list => list.filter(n => n.id !== id));
        this._unreadCount.update(c => Math.max(0, c - 1));
        // Refetch to fill the 5 slots with remaining unread
        this.fetchRecent();
      })
    );
  }

  markAllAsRead(): Observable<any> {
    return this.http.patch(`${this.apiUrl}/read-all`, {}).pipe(
      tap(() => {
        this._notifications.update(list => list.map(n => ({ ...n, isRead: true })));
        this._unreadCount.set(0);
      })
    );
  }

  /**
   * Request browser notification permission on startup.
   * Silent fail if user dismisses or denies.
   */
  async requestNotificationPermission(): Promise<void> {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch {
        // Silent fail
      }
    }
  }

  /**
   * Fire a browser push notification when unreadCount increases.
   * Unlike admin, the client always receives push if permission is granted (no preference toggle).
   */
  private triggerBrowserPush(): void {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    // Fetch latest notification to get title/message
    this.http.get<UserNotificationListResponse>(`${this.apiUrl}?limit=1`).subscribe({
      next: (res) => {
        const latest = res.data?.[0];
        if (!latest) return;

        try {
          const notif = new Notification(latest.title || 'Nueva notificación', {
            body: latest.message,
            icon: '/autobus.png',
            badge: '/autobus.png',
            tag: `user-notif-${latest.id}`,
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
