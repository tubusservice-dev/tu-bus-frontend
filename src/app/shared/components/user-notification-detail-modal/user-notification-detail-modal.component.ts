import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { UserNotification } from '../../../models/user-notification.model';
import { resolveUserNotificationCta } from '../../utils/notification-cta.util';

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

  /**
   * Contextual call-to-action derived from the notification type. Null when
   * the notification has no related order, in which case the modal shows no
   * navigation button (e.g. system-wide notices).
   */
  protected readonly cta = computed(() => resolveUserNotificationCta(this._notification()));

  protected close(): void {
    this.closed.emit();
  }

  /**
   * Navigates to the CTA destination, then closes the modal. Navigation is
   * issued first so the intent is captured on the live Router before the
   * parent unmounts this component on `closed`.
   */
  protected goToCta(): void {
    const cta = this.cta();
    if (!cta) return;
    this.router.navigate(cta.commands, cta.extras);
    this.close();
  }
}
