import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, interval, Subscription } from 'rxjs';
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
  private readonly apiUrl = `${environment.apiUrl}/user-notifications`;
  private pollSub?: Subscription;

  private readonly _unreadCount = signal(0);
  private readonly _notifications = signal<UserNotification[]>([]);
  private readonly _showPopover = signal(false);

  readonly unreadCount = this._unreadCount.asReadonly();
  readonly notifications = this._notifications.asReadonly();
  readonly showPopover = this._showPopover.asReadonly();

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
      next: (res) => this._unreadCount.set(res.data.count),
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
}
