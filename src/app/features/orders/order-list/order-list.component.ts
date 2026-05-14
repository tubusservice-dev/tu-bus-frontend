import { Component, DestroyRef, inject, signal, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { OrderService } from '@core/services/order.service';
import { ExchangeRateService } from '@core/services/exchange-rate.service';
import { UserNotificationService } from '@core/services/user-notification.service';
import {
  Order, OrderComment, OrderStatus,
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS,
  orderCommentKey,
} from '@models/order.model';
import { SearchInputComponent } from '@shared/components/search-input/search-input.component';
import { CustomerSupportActionComponent } from '@shared/components/customer-support-action/customer-support-action.component';
import { OrderMessagingModalComponent } from '@shared/components/order-messaging-modal/order-messaging-modal.component';

/**
 * Push event `type` prefixes that imply something in this user's order list
 * has changed and the screen should refresh itself silently. Built as a
 * whitelist so unrelated pushes (announcements, future feature events)
 * don't trigger unnecessary HTTP calls.
 */
const ORDER_AFFECTING_PUSH_PREFIXES = [
  'order_',
  'dispatch_',
  'mechanic_',
  'service_',
  'cancellation_',
];

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, SearchInputComponent, CustomerSupportActionComponent, OrderMessagingModalComponent],
  templateUrl: './order-list.component.html',
  styleUrl: './order-list.component.scss',
})
export class OrderListComponent implements OnInit {
  protected readonly orderService = inject(OrderService);
  protected readonly exchangeRateService = inject(ExchangeRateService);
  private readonly userNotifications = inject(UserNotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  protected readonly isSearching = signal(false);
  protected readonly statusLabels = ORDER_STATUS_LABELS;
  protected readonly statusColors = ORDER_STATUS_COLORS;

  /** Exposed to the template so the in-card support button can hide on
   *  completed orders without resorting to magic strings in the HTML. */
  protected readonly COMPLETED = OrderStatus.COMPLETED;

  // ========== MESSAGING MODAL (per-card opener) ==========
  /**
   * Order whose thread is currently open in the modal. When null, no
   * modal is mounted. Updated by `silentReloadActiveOrder` when a push or
   * a poll tick brings in new comments so the modal renders live.
   */
  protected readonly messagingOrder = signal<Order | null>(null);
  protected readonly showMessagingModal = signal(false);
  protected readonly highlightCommentId = signal<string | null>(null);
  private highlightTimer: ReturnType<typeof setTimeout> | null = null;
  /** Subscriptions scoped to the lifetime of an open modal — torn down
   *  on close so the list doesn't keep polling for an order the user is
   *  no longer watching. */
  private modalPushSub?: Subscription;
  private modalPollSub?: Subscription;

  // Pagination
  protected readonly currentPage = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly totalItems = signal(0);

  // Filters
  protected readonly statusFilter = signal<OrderStatus | ''>('');
  protected readonly searchQuery = signal('');

  protected readonly filterStatuses = [
    { value: '', label: 'Todas' },
    { value: OrderStatus.PENDING, label: 'Pendientes' },
    { value: OrderStatus.APPROVED, label: 'Aprobadas' },
    { value: OrderStatus.COMPLETED, label: 'Completadas' },
    { value: OrderStatus.CANCELLED, label: 'Canceladas' },
  ];

  ngOnInit(): void {
    this.loadOrders();
    this.subscribeToPushEvents();
  }

  // ==================== DATA LOADING ====================

  loadOrders(page = 1): void {
    const status = this.statusFilter() || undefined;
    const search = this.searchQuery().trim() || undefined;

    this.orderService.getMyOrders(page, 10, status as OrderStatus, search).subscribe({
      next: (res) => {
        this.currentPage.set(res.pagination.page);
        this.totalPages.set(res.pagination.pages);
        this.totalItems.set(res.pagination.total);
        this.isSearching.set(false);
      },
      error: () => {
        this.isSearching.set(false);
      },
    });
  }

  /**
   * Refreshes the current page with the active filters but without
   * lighting the search spinner. Triggered by relevant FCM push events
   * so the list stays in sync without the user reloading.
   */
  private silentReloadOrders(): void {
    const status = this.statusFilter() || undefined;
    const search = this.searchQuery().trim() || undefined;
    this.orderService.getMyOrders(this.currentPage(), 10, status as OrderStatus, search).subscribe({
      next: (res) => {
        this.currentPage.set(res.pagination.page);
        this.totalPages.set(res.pagination.pages);
        this.totalItems.set(res.pagination.total);
      },
      error: () => { /* silent — polling fallback retries */ },
    });
  }

  /**
   * React to FCM pushes that touch this user's orders (status changes,
   * dispatch updates, mechanic assignments, comments, …) by silently
   * refreshing the current page in place.
   */
  private subscribeToPushEvents(): void {
    this.userNotifications.pushReceived$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        const t = event.type || '';
        if (!ORDER_AFFECTING_PUSH_PREFIXES.some((p) => t.startsWith(p))) return;
        this.silentReloadOrders();
      });
  }

  onStatusFilterChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.statusFilter.set(value as OrderStatus | '');
    this.loadOrders(1);
  }

  /** Fired on every keystroke (pre-debounce) — lights the spinner */
  onSearchTyping(value: string): void {
    if (value !== this.searchQuery()) {
      this.isSearching.set(true);
    }
  }

  /** Fired after debounce — triggers the HTTP request */
  onSearchCommit(value: string): void {
    this.searchQuery.set(value);
    this.loadOrders(1);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.loadOrders(page);
  }

  get visiblePages(): number[] {
    const current = this.currentPage();
    const total = this.totalPages();
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  // ==================== LABELS ====================

  getStatusLabel(status: OrderStatus | string): string {
    return this.statusLabels[status as OrderStatus] || status;
  }

  getStatusClass(status: OrderStatus | string): string {
    return this.statusColors[status as OrderStatus] || '';
  }

  // ==================== NAVIGATION ====================

  viewDetail(order: Order): void {
    this.router.navigate(['/perfil/pedidos', order.id]);
  }

  /**
   * Triggered from the customer-support popover inside each card when the
   * user picks "Mensajería". Opens the messaging modal locally on top of
   * the list — does NOT navigate to the order detail. Reuses the same
   * `OrderMessagingModalComponent` that powers detail and confirmation,
   * so the visual experience is identical; the difference is who owns
   * the lifecycle (here: scoped to the open modal).
   */
  protected openMessagingFromList(order: Order): void {
    this.messagingOrder.set(order);
    this.showMessagingModal.set(true);
    // User is opening the thread → sync backend read-state immediately so
    // the unread bell elsewhere on the app calms down without waiting for
    // the user to close the modal.
    this.userNotifications
      .markOrderAsRead(order.id, 'order_comment')
      .subscribe({ error: () => { /* silent */ } });
    this.attachActiveOrderListeners(order.id);
  }

  protected closeMessaging(): void {
    this.showMessagingModal.set(false);
    this.detachActiveOrderListeners();
  }

  protected onMessagingCommentsUpdated(updated: Order): void {
    this.messagingOrder.set(updated);
  }

  /**
   * While the modal is open, react to FCM pushes targeting this exact
   * order AND poll every 30 s as a resilience floor (covers no-FCM
   * scenarios, dropped pushes, stale SW). Both paths funnel into
   * `silentReloadActiveOrder` which diff-detects new admin messages and
   * triggers the pulse highlight inside the modal.
   */
  private attachActiveOrderListeners(orderId: string): void {
    this.detachActiveOrderListeners();

    this.modalPushSub = this.userNotifications.pushReceived$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        if (event.relatedOrder !== orderId) return;
        this.silentReloadActiveOrder(orderId);
      });

    this.modalPollSub = interval(30_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.silentReloadActiveOrder(orderId));
  }

  private detachActiveOrderListeners(): void {
    this.modalPushSub?.unsubscribe();
    this.modalPushSub = undefined;
    this.modalPollSub?.unsubscribe();
    this.modalPollSub = undefined;
  }

  private silentReloadActiveOrder(id: string): void {
    const previousKeys = new Set(
      (this.messagingOrder()?.comments || []).map(orderCommentKey),
    );
    this.orderService.getOrderById(id).subscribe({
      next: (res) => {
        this.messagingOrder.set(res.data);
        const incomingAdminComment = (res.data.comments || [])
          .filter((c: OrderComment) => c.authorType === 'admin')
          .filter((c: OrderComment) => !previousKeys.has(orderCommentKey(c)))
          .pop();
        if (!incomingAdminComment) return;

        this.triggerCommentHighlight(orderCommentKey(incomingAdminComment));
        // Modal is open (this code path only runs while it is) — keep
        // the backend in sync so the bell doesn't fire stale unread.
        this.userNotifications
          .markOrderAsRead(id, 'order_comment')
          .subscribe({ error: () => { /* silent */ } });
      },
      error: () => { /* silent — next poll / push retries */ },
    });
  }

  private triggerCommentHighlight(key: string): void {
    this.highlightCommentId.set(key);
    if (this.highlightTimer) clearTimeout(this.highlightTimer);
    this.highlightTimer = setTimeout(() => this.highlightCommentId.set(null), 3000);
  }

  // ==================== FORMAT HELPERS ====================

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
}
