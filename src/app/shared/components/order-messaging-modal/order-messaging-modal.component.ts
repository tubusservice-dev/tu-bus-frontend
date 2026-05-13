import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Order, OrderComment } from '@models/order.model';
import { OrderCommentsComponent } from '@shared/components/order-comments/order-comments.component';

/**
 * Modal wrapper around `OrderCommentsComponent` — owns the dialog chrome
 * (backdrop, header with title and close button, mobile fullscreen
 * presentation) and forwards inputs/outputs to the embedded thread.
 *
 * Replaces the previously inline placement of `<app-order-comments>` on
 * both the customer and admin order-detail screens. The parent decides
 * when to open it (via the `open` input) and reacts to `closed` and
 * `commentsUpdated` outputs.
 */
@Component({
  selector: 'app-order-messaging-modal',
  standalone: true,
  imports: [CommonModule, OrderCommentsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-messaging-modal.component.html',
  styleUrl: './order-messaging-modal.component.scss',
})
export class OrderMessagingModalComponent {
  readonly open = input<boolean>(false);
  readonly orderId = input.required<string>();
  readonly comments = input.required<OrderComment[]>();
  readonly mode = input.required<'client' | 'admin'>();
  readonly highlightId = input<string | null>(null);
  /** Display name of the OTHER party — the user the current viewer is
   *  chatting with. Defaults to the company agent label for the client
   *  flow, which is by far the dominant case. The admin flow (when it
   *  re-adopts the modal) passes the customer's full name explicitly. */
  readonly interlocutorName = input<string>('Agente TuBusExpress');

  readonly closed = output<void>();
  readonly commentsUpdated = output<Order>();

  constructor() {
    // Page scroll lock while the modal is open. Locks BOTH `<html>` and
    // `<body>` because the actual scroll container varies by browser
    // (Chrome desktop scrolls the documentElement; Safari iOS scrolls the
    // body; Angular components hosted under a fixed app shell may add
    // another layer). Locking both is the only way to consistently freeze
    // the underlying page across all engines.
    effect(() => {
      const isOpen = this.open();
      if (typeof document === 'undefined') return;
      const value = isOpen ? 'hidden' : '';
      document.body.style.overflow = value;
      document.documentElement.style.overflow = value;
    });

    // Restore page scroll on destroy. The effect above only fires when
    // the signal changes; a component teardown while still open would
    // otherwise leave the page locked.
    inject(DestroyRef).onDestroy(() => {
      if (typeof document === 'undefined') return;
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    });
  }

  protected onBackdropClick(): void {
    this.closed.emit();
  }

  protected onClose(): void {
    this.closed.emit();
  }

  protected onCommentsUpdated(order: Order): void {
    this.commentsUpdated.emit(order);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open()) this.closed.emit();
  }
}
