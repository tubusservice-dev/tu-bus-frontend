import { Component, DestroyRef, computed, inject, signal, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { interval } from 'rxjs';
import { OrderService } from '@core/services/order.service';
import { UserNotificationService } from '@core/services/user-notification.service';
import {
  Order,
  OrderComment,
  ORDER_STATUS_LABELS,
  DISPATCH_TYPE_LABELS,
  DispatchType,
  isOilChangeOrder,
  orderCommentKey,
} from '@models/order.model';
import { CustomerSupportActionComponent } from '@shared/components/customer-support-action/customer-support-action.component';
import { OrderMessagingModalComponent } from '@shared/components/order-messaging-modal/order-messaging-modal.component';

@Component({
  selector: 'app-checkout-confirmation',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, CustomerSupportActionComponent, OrderMessagingModalComponent],
  templateUrl: './checkout-confirmation.component.html',
  styleUrl: './checkout-confirmation.component.scss',
})
export class CheckoutConfirmationComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orderService = inject(OrderService);
  private readonly userNotifications = inject(UserNotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly order = signal<Order | null>(null);
  protected readonly isLoading = signal(true);

  // ========== MESSAGING ==========
  protected readonly showMessagingModal = signal(false);
  protected readonly hasUnreadMessages = signal(false);
  protected readonly highlightCommentId = signal<string | null>(null);
  private highlightTimer: ReturnType<typeof setTimeout> | null = null;

  /** True when this order is a service (oil change at home or in-store). */
  protected readonly isOilChange = computed(() => {
    const o = this.order();
    return o ? isOilChangeOrder(o) : false;
  });

  /** True when the order carries at least one vehicle (populated or id-only). */
  protected readonly hasVehicles = computed(
    () => (this.order()?.vehicles?.length ?? 0) > 0,
  );

  /**
   * Returns only populated vehicles (objects with `placa/marca/modelo`).
   * Filters out id-only entries so the template can iterate safely without
   * needing `typeof` guards (unsupported in Angular templates).
   */
  protected readonly populatedVehicles = computed(() => {
    const vs = this.order()?.vehicles ?? [];
    return vs.filter(
      (v): v is { id: string; placa: string; marca: string; modelo: string; year: number } =>
        !!v && typeof v === 'object',
    );
  });

  /** True when the payment submission exists and has at least one populated field. */
  protected readonly hasPaymentSubmission = computed(() => {
    const ps = this.order()?.paymentSubmission;
    return !!(ps && (ps.referenceNumber || ps.amount || ps.sourceBank));
  });

  /** True when a non-empty billing address was captured. */
  protected readonly hasBillingAddress = computed(() => {
    const ba = this.order()?.billingAddress;
    return !!(ba && (ba.fullName || ba.address));
  });

  /**
   * Long-form Spanish label for the requested service date (UTC-anchored to
   * avoid off-by-one on ISO `YYYY-MM-DD` strings). Empty when not applicable.
   */
  protected readonly requestedDateLabel = computed<string>(() => {
    const raw = this.order()?.requestedServiceDate;
    if (!raw) return '';
    try {
      const [y, m, d] = raw.slice(0, 10).split('-').map(Number);
      const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
      return new Intl.DateTimeFormat('es-VE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(date);
    } catch {
      return raw;
    }
  });

  /**
   * Human label for the shipping-cost row, chosen by dispatch type so the
   * wording matches the rest of the checkout flow (service / envío / despacho).
   */
  protected readonly deliveryConceptLabel = computed<string>(() => {
    const dt = this.order()?.dispatchType;
    switch (dt) {
      case 'oil_change_service':
      case 'in_store_oil_change':
        return 'Coste del Servicio';
      case 'shipping_agency':
      case 'local_delivery':
        return 'Coste del Envío';
      case 'store_pickup':
      case 'seller_agreement':
        return 'Coste del Despacho';
      default:
        return 'Envío';
    }
  });

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('orderId');
    if (!orderId) {
      this.router.navigate(['/catalogo']);
      return;
    }

    this.orderService.getOrderById(orderId).subscribe({
      next: (response) => {
        this.order.set(response.data);
        this.isLoading.set(false);
        this.refreshUnreadMessages(orderId);
      },
      error: () => {
        this.isLoading.set(false);
        this.router.navigate(['/catalogo']);
      },
    });

    this.subscribeToPushEvents();
    this.startThreadPolling();
  }

  // ============================================
  // MESSAGING — push subscription, polling, dot, modal lifecycle
  // ============================================

  /**
   * Pulls the unread `order_comment` notification count for this order
   * once the order is loaded. Drives the red dot on the messaging trigger
   * when the customer lands on this screen with unread messages (e.g.
   * page refresh with the order detail already showing the screen).
   */
  private refreshUnreadMessages(orderId: string): void {
    this.userNotifications.getOrderUnreadCount(orderId, 'order_comment').subscribe({
      next: ({ count }) => this.hasUnreadMessages.set(count > 0),
      error: () => { /* silent — non-critical signal */ },
    });
  }

  /**
   * Listens to FCM push events targeting this order. The thread refresh
   * AND the unread-dot logic live inside `silentReloadOrder` (diff-based),
   * so this handler is just a forwarder.
   */
  private subscribeToPushEvents(): void {
    this.userNotifications.pushReceived$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        const currentId = this.order()?.id;
        if (!currentId) return;
        if (event.relatedOrder !== currentId) return;
        this.silentReloadOrder(currentId);
      });
  }

  /**
   * Local resilience floor: refresh the order every 30 s while the
   * confirmation screen is mounted. Mirrors the polling on order-detail
   * — independent from FCM and from the global unread polling — so the
   * chat reflects new admin messages even when push delivery is broken.
   */
  private startThreadPolling(): void {
    interval(30_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const id = this.order()?.id;
        if (id) this.silentReloadOrder(id);
      });
  }

  /**
   * Refreshes the order without flipping `isLoading`. Compares the
   * incoming comments list against the previous snapshot to detect new
   * admin-authored messages — those trigger the pulse highlight and
   * either raise the unread dot (modal closed) or sync the backend
   * read-state (modal open).
   */
  private silentReloadOrder(id: string): void {
    const previousKeys = new Set(
      (this.order()?.comments || []).map(orderCommentKey),
    );
    this.orderService.getOrderById(id).subscribe({
      next: (res) => {
        this.order.set(res.data);
        const incomingAdminComment = (res.data.comments || [])
          .filter((c: OrderComment) => c.authorType === 'admin')
          .filter((c: OrderComment) => !previousKeys.has(orderCommentKey(c)))
          .pop();
        if (!incomingAdminComment) return;

        this.triggerCommentHighlight(orderCommentKey(incomingAdminComment));

        if (this.showMessagingModal()) {
          this.userNotifications
            .markOrderAsRead(id, 'order_comment')
            .subscribe({ error: () => { /* silent */ } });
        } else {
          this.hasUnreadMessages.set(true);
        }
      },
      error: () => { /* silent — polling fallback will retry */ },
    });
  }

  /** Sets the highlight signal for ~3 s so the new bubble pulses once. */
  private triggerCommentHighlight(key: string): void {
    this.highlightCommentId.set(key);
    if (this.highlightTimer) clearTimeout(this.highlightTimer);
    this.highlightTimer = setTimeout(() => this.highlightCommentId.set(null), 3000);
  }

  protected openMessaging(): void {
    this.showMessagingModal.set(true);
    const id = this.order()?.id;
    if (!id) return;
    this.hasUnreadMessages.set(false);
    this.userNotifications
      .markOrderAsRead(id, 'order_comment')
      .subscribe({ error: () => { /* silent — UI already optimistic */ } });
  }

  protected closeMessaging(): void {
    this.showMessagingModal.set(false);
  }

  protected onCommentsUpdated(updatedOrder: Order): void {
    this.order.set(updatedOrder);
  }

  getStatusLabel(status: string): string {
    return ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS] || status;
  }

  /** Human label for a dispatch type, e.g. "Cambio de Aceite". */
  getDispatchLabel(type: string): string {
    return DISPATCH_TYPE_LABELS[type as DispatchType] || type;
  }

  /**
   * Human label for a billing address source. Explains to the user where
   * the billing data came from when the address line itself is missing.
   */
  getBillingSourceLabel(source?: string): string {
    switch (source) {
      case 'shipping': return 'Misma dirección de envío';
      case 'profile':  return 'Dirección del perfil';
      case 'custom':   return 'Dirección personalizada';
      default:         return 'Facturación';
    }
  }

  /**
   * Compose a recipient line "Address[, City[, Municipality[, State]]]".
   * Filters out empty/undefined parts to avoid dangling commas.
   */
  buildLocationLine(parts: (string | undefined)[]): string {
    return parts.filter((p) => !!p && String(p).trim() !== '').join(', ');
  }

  /** Track-by helper for items list. */
  trackByIndex = (index: number): number => index;

  goToOrders(): void {
    this.router.navigate(['/perfil'], { fragment: 'orders' });
  }

  goToStore(): void {
    this.router.navigate(['/catalogo']);
  }
}
