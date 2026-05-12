import { Component, DestroyRef, inject, signal, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { UserNotificationService } from '../../../../core/services/user-notification.service';
import { UserNotification } from '../../../../models/user-notification.model';
import { UserNotificationDetailModalComponent } from '../../../../shared/components/user-notification-detail-modal/user-notification-detail-modal.component';

@Component({
  selector: 'app-notifications-list',
  standalone: true,
  imports: [CommonModule, UserNotificationDetailModalComponent],
  templateUrl: './notifications-list.component.html',
  styleUrl: './notifications-list.component.scss',
})
export class NotificationsListComponent implements OnInit {
  private readonly notifService = inject(UserNotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly notifications = signal<UserNotification[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly currentPage = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly selectedNotification = signal<UserNotification | null>(null);

  ngOnInit(): void {
    this.loadPage(1);
    this.subscribeToPushEvents();
  }

  loadPage(page: number): void {
    this.isLoading.set(true);
    this.notifService.getAll(page, 10).subscribe({
      next: (res) => {
        this.notifications.set(res.data);
        this.totalPages.set(res.pagination.pages);
        this.currentPage.set(page);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  /**
   * Refreshes the current page silently (no spinner) when a new push
   * arrives, so the user sees the new notification appear in real time
   * without leaving the screen. Every push generates a UserNotification
   * on the backend, so we don't filter by type here.
   */
  private silentReloadCurrentPage(): void {
    this.notifService.getAll(this.currentPage(), 10).subscribe({
      next: (res) => {
        this.notifications.set(res.data);
        this.totalPages.set(res.pagination.pages);
      },
      error: () => { /* silent — polling will retry */ },
    });
  }

  private subscribeToPushEvents(): void {
    this.notifService.pushReceived$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.silentReloadCurrentPage());
  }

  openNotification(n: UserNotification): void {
    if (!n.isRead) {
      this.notifService.markAsRead(n.id).subscribe(() => {
        this.notifications.update(list => list.map(x => x.id === n.id ? { ...x, isRead: true } : x));
      });
    }
    this.selectedNotification.set(n);
  }

  closeDetail(): void {
    this.selectedNotification.set(null);
  }

  markAllRead(): void {
    this.notifService.markAllAsRead().subscribe(() => {
      this.notifications.update(list => list.map(n => ({ ...n, isRead: true })));
    });
  }

  getIconClass(icon: string): string {
    const map: Record<string, string> = {
      success: 'icon-success', mechanic: 'icon-mechanic', order: 'icon-order',
      cancel: 'icon-cancel', warning: 'icon-warning', payment: 'icon-payment',
      truck: 'icon-truck', 'user-plus': 'icon-user-plus', box: 'icon-box',
    };
    return map[icon] || 'icon-order';
  }
}
