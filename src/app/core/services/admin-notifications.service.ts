import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, interval, Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdminNotification,
  NotificationListResponse,
  UnreadCountResponse,
  NotificationResponse,
} from '../../models/notification.model';

@Injectable({
  providedIn: 'root',
})
export class AdminNotificationsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/notifications`;
  private pollSub?: Subscription;

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

  togglePopover(): void {
    const next = !this._showPopover();
    this._showPopover.set(next);
    if (next) this.fetchRecent();
  }

  closePopover(): void {
    this._showPopover.set(false);
  }

  fetchUnreadCount(): void {
    this.http.get<UnreadCountResponse>(`${this.apiUrl}/unread-count`).subscribe({
      next: (res) => this._unreadCount.set(res.data.count),
      error: () => {},
    });
  }

  fetchRecent(): void {
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
}
