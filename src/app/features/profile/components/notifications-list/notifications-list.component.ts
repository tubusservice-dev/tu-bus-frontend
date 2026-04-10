import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserNotificationService } from '../../../../core/services/user-notification.service';
import { UserNotification } from '../../../../models/user-notification.model';

@Component({
  selector: 'app-notifications-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications-list.component.html',
  styleUrl: './notifications-list.component.scss',
})
export class NotificationsListComponent implements OnInit {
  private readonly notifService = inject(UserNotificationService);
  private readonly router = inject(Router);

  protected readonly notifications = signal<UserNotification[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly currentPage = signal(1);
  protected readonly totalPages = signal(1);

  ngOnInit(): void {
    this.loadPage(1);
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

  openNotification(n: UserNotification): void {
    if (!n.isRead) {
      this.notifService.markAsRead(n.id).subscribe(() => {
        this.notifications.update(list => list.map(x => x.id === n.id ? { ...x, isRead: true } : x));
      });
    }
    const orderId = typeof n.relatedOrder === 'object' ? (n.relatedOrder?.id || '') : String(n.relatedOrder || '');
    if (orderId) {
      this.router.navigate(['/perfil/pedidos', orderId]);
    }
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
    };
    return map[icon] || 'icon-order';
  }
}
