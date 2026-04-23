import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { UserNotification } from '../../../models/user-notification.model';

/**
 * Full-screen (mobile) / centered (desktop) modal that replaces the in-popover
 * detail view for user-facing notifications. Keeps the payload minimal — the
 * user notification schema only carries title/message/icon/relatedOrder.
 */
@Component({
  selector: 'app-user-notification-detail-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-notification-detail-modal.component.html',
  styleUrl: './user-notification-detail-modal.component.scss',
})
export class UserNotificationDetailModalComponent {
  private readonly router = inject(Router);
  private readonly _notification = signal<UserNotification | null>(null);

  @Input({ required: true })
  set notification(value: UserNotification | null) {
    this._notification.set(value);
  }

  @Output() closed = new EventEmitter<void>();

  protected readonly n = this._notification.asReadonly();

  protected readonly orderId = computed(() => {
    const notif = this._notification();
    if (!notif?.relatedOrder) return '';
    if (typeof notif.relatedOrder === 'object') {
      return notif.relatedOrder.id || notif.relatedOrder._id || '';
    }
    return String(notif.relatedOrder);
  });

  protected close(): void {
    this.closed.emit();
  }

  protected goToOrder(): void {
    const id = this.orderId();
    if (!id) return;
    this.close();
    this.router.navigate(['/perfil/pedidos', id]);
  }
}
