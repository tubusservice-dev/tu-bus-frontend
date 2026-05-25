import { Component, DestroyRef, computed, inject, signal, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OrderService } from '@core/services/order.service';
import { ExchangeRateService } from '@core/services/exchange-rate.service';
import { UploadService } from '@core/services/upload.service';
import { ReviewService } from '@core/services/review.service';
import { UserNotificationService } from '@core/services/user-notification.service';
import { PRINT } from '@platform';
import {
  Order, OrderStatus, DispatchStatus,
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, ORDER_STATUS_DESCRIPTIONS,
  DISPATCH_STATUS_LABELS, DISPATCH_STATUS_COLORS, DISPATCH_STATUS_DESCRIPTIONS,
  isShippingOrder, isOilChangeOrder,
  ServiceDateState, getServiceDateState, getServiceDateIso,
  orderCommentKey, OrderComment,
} from '@models/order.model';

/** Client-facing copy for the service-date card. Keyed by lifecycle state. */
const CLIENT_SERVICE_DATE_BADGE: Record<ServiceDateState, { label: string; cls: string }> = {
  pending:     { label: 'Por confirmar', cls: 'badge-amber' },
  confirmed:   { label: 'Confirmada',     cls: 'badge-emerald' },
  rescheduled: { label: 'Reprogramada',   cls: 'badge-blue' },
};

const CLIENT_SERVICE_DATE_MESSAGE: Record<ServiceDateState, string> = {
  pending:
    'Fecha solicitada por el cliente a la espera de la confirmación por parte del equipo de soporte. Ten en cuenta que la fecha puede ser reprogramada si en la fecha solicitada no contamos con disponibilidad.',
  confirmed:
    'Tu servicio ha sido confirmado para esta fecha. Nuestro equipo está listo para brindarte la mejor atención.',
  rescheduled:
    'Tu servicio fue agendado para esta nueva fecha. En la fecha solicitada originalmente no contábamos con disponibilidad. Nuestro equipo está listo para brindarte la mejor atención.',
};
import { PAYMENT_TYPES_WITH_FORM, PaymentMethodType } from '@models/payment-method.model';
import { MechanicAvatarComponent } from '@shared/components/mechanic-avatar/mechanic-avatar.component';
import { RatingModalComponent } from '@shared/components/rating-modal/rating-modal.component';
import { PhoneActionPopoverComponent } from '@shared/components/phone-action-popover/phone-action-popover.component';
import { CustomerSupportActionComponent } from '@shared/components/customer-support-action/customer-support-action.component';
import { OrderMessagingModalComponent } from '@shared/components/order-messaging-modal/order-messaging-modal.component';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, RouterLink, MechanicAvatarComponent, RatingModalComponent, PhoneActionPopoverComponent, CustomerSupportActionComponent, OrderMessagingModalComponent],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.scss',
})
export class OrderDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orderService = inject(OrderService);
  private readonly uploadService = inject(UploadService);
  private readonly reviewService = inject(ReviewService);
  private readonly userNotifications = inject(UserNotificationService);
  private readonly destroyRef = inject(DestroyRef);
  // Platform-aware print abstraction: window.print() on web, native
  // PrintManager (PDF / printer / share) on Android WebView.
  private readonly printer = inject(PRINT);
  protected readonly exchangeRateService = inject(ExchangeRateService);

  // ========== ESTADO PRINCIPAL ==========
  protected readonly order = signal<Order | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);

  // ========== COMMENT HIGHLIGHT (push-driven pulse) ==========
  protected readonly highlightCommentId = signal<string | null>(null);
  private highlightTimer: ReturnType<typeof setTimeout> | null = null;

  // ========== MESSAGING MODAL ==========
  protected readonly showMessagingModal = signal(false);
  protected readonly hasUnreadMessages = signal(false);
  /**
   * True when the route was entered with `?openMessages=1` but the order
   * data has not finished loading yet. Cleared once the modal opens. Lets
   * the notification-tap flow defer the modal until comments are available.
   */
  private pendingOpenMessages = false;

  // ========== LIGHTBOX COMPROBANTE ==========
  protected readonly proofPreview = signal<string | null>(null);

  // ========== CANCELACIÓN (2 pasos) ==========
  protected readonly showReasonModal = signal(false);
  protected readonly showConfirmModal = signal(false);
  protected readonly cancelReason = signal('');
  protected readonly isCancelling = signal(false);

  // ========== DETALLE DE PAGO ==========
  protected readonly isPaymentExpanded = signal(false);

  // ========== RE-SUBIDA DE COMPROBANTE ==========
  protected readonly uploadProofFile = signal<File | null>(null);
  protected readonly uploadProofPreview = signal<string | null>(null);
  protected readonly isUploadingProof = signal(false);
  protected readonly uploadProofError = signal<string | null>(null);
  protected readonly uploadProofSuccess = signal<string | null>(null);

  // ========== IMPRESIÓN ==========
  protected printedAt = '';

  // ========== RATING / VALORACIÓN ==========
  protected readonly showRatingModal = signal(false);
  protected readonly isSubmittingRating = signal(false);
  protected readonly ratingSubmitError = signal<string | null>(null);
  /** Prevents duplicate review lookups while the same order is loaded. */
  private hasCheckedReview = false;
  /** sessionStorage key prefix for "user dismissed the modal for order X". */
  private readonly REVIEW_DISMISSED_KEY = 'review-modal-dismissed';

  // ========== LABELS ==========
  protected readonly statusLabels = ORDER_STATUS_LABELS;
  protected readonly statusColors = ORDER_STATUS_COLORS;
  protected readonly dispatchStatusLabels = DISPATCH_STATUS_LABELS;
  protected readonly dispatchStatusColors = DISPATCH_STATUS_COLORS;

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

  /**
   * Combined timeline for the "Estado de la Orden" card. Merges statusHistory
   * (order status transitions) with serviceEvents (reschedules and future
   * service-level events), sorted newest first. Each entry carries its own
   * label, description and color class ready for rendering.
   */
  protected readonly timelineEntries = computed(() => {
    const o = this.order();
    if (!o) return [] as Array<{
      kind: 'status' | 'event';
      label: string;
      description: string;
      colorClass: string;
      note?: string;
      timestamp: string;
    }>;

    const statusEntries = (o.statusHistory || []).map(s => ({
      kind: 'status' as const,
      label: this.getStatusLabel(s.status),
      description: this.getStatusDescription(s.status),
      colorClass: this.getStatusClass(s.status),
      note: s.note,
      timestamp: s.timestamp,
    }));

    const eventEntries = (o.serviceEvents || []).map(ev => {
      if (ev.type === 'date_rescheduled') {
        const newDate = ev.metadata?.newDate
          ? this.formatLongDate(ev.metadata.newDate)
          : '';
        return {
          kind: 'event' as const,
          label: 'Fecha reprogramada',
          description: newDate ? `Nueva fecha: ${newDate}` : 'La fecha del servicio fue reprogramada.',
          colorClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
          note: ev.note,
          timestamp: ev.timestamp,
        };
      }
      return {
        kind: 'event' as const,
        label: 'Evento del servicio',
        description: '',
        colorClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        note: ev.note,
        timestamp: ev.timestamp,
      };
    });

    return [...statusEntries, ...eventEntries].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  });

  /** Format an ISO date (YYYY-MM-DD) as a long Spanish label, UTC-anchored. */
  private formatLongDate(iso: string): string {
    try {
      const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
      const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
      return new Intl.DateTimeFormat('es-VE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(date);
    } catch {
      return iso;
    }
  }

  // ============================================
  // FECHA DEL SERVICIO (oil-change orders)
  // ============================================

  /** True when the order has a requested service date — gates card visibility. */
  protected readonly hasRequestedServiceDate = computed(
    () => !!this.order()?.requestedServiceDate
  );

  /** Lifecycle state derived from the populated mechanicAssignment. */
  protected readonly serviceDateState = computed<ServiceDateState>(() => {
    const o = this.order();
    return o ? getServiceDateState(o) : 'pending';
  });

  /** Long-form Spanish label for the date currently driving the card. */
  protected readonly serviceDateLabel = computed<string>(() => {
    const o = this.order();
    if (!o) return '';
    const iso = getServiceDateIso(o);
    return iso ? this.formatLongDate(iso) : '';
  });

  protected readonly serviceDateBadge = computed(
    () => CLIENT_SERVICE_DATE_BADGE[this.serviceDateState()]
  );

  protected readonly serviceDateMessage = computed(
    () => CLIENT_SERVICE_DATE_MESSAGE[this.serviceDateState()]
  );

  // ============================================
  // CICLO DE VIDA
  // ============================================
  ngOnInit(): void {
    // Subscribe to paramMap (not snapshot) so Angular router reuse across
    // /perfil/pedidos/:id → /perfil/pedidos/:other-id triggers a reload.
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const id = params.get('id');
        if (!id) {
          this.error.set('ID de orden no proporcionado');
          this.isLoading.set(false);
          return;
        }
        // Reset per-order flags so the review modal can re-evaluate for the new order.
        this.hasCheckedReview = false;
        this.showRatingModal.set(false);
        this.ratingSubmitError.set(null);
        this.loadOrder(id);
      });

    // Notification-tap query params. Set by the backend on the FCM
    // `data.url` so a tap on a notification lands the user already in
    // the right context — and, for comment-type notifications, opens
    // the messaging modal automatically.
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const notifId = params.get('notif');
        if (notifId) {
          // Best-effort mark-as-read; the popover/list will resync on next view.
          this.userNotifications.markAsRead(notifId).subscribe({
            error: () => { /* silent — non-critical */ },
          });
        }
        if (params.get('openMessages') === '1') {
          this.pendingOpenMessages = true;
          this.tryOpenPendingMessaging();
        }
      });

    this.subscribeToPushEvents();
    this.startThreadPolling();
  }

  /**
   * Opens the messaging modal if both conditions hold:
   *   1. A pending request from the notification-tap query param exists.
   *   2. The order data has finished loading (so the modal renders with
   *      the actual thread, not an empty placeholder).
   *
   * Called twice: when the query param arrives (may be too early) and
   * from `loadOrder`'s success handler (may be too late if the param
   * arrives later). The `pendingOpenMessages` guard makes both calls idempotent.
   */
  private tryOpenPendingMessaging(): void {
    if (!this.pendingOpenMessages) return;
    if (!this.order()) return;
    this.pendingOpenMessages = false;
    this.openMessaging();
  }

  /**
   * Local resilience floor: pull the order fresh every 30 s while the
   * detail screen is mounted. Independent from FCM and from the global
   * notification polling — guarantees the chat reflects new admin
   * messages even when push delivery is broken (no token registered,
   * unsecure dev context, SW asleep). `silentReloadOrder` is idempotent
   * and diff-based, so calls without changes are cheap and produce no
   * UI flicker.
   */
  private startThreadPolling(): void {
    interval(30_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const id = this.order()?.id;
        if (id) this.silentReloadOrder(id);
      });
  }

  private loadOrder(id: string): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.orderService.getOrderById(id).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.isLoading.set(false);
        if (res.data.status === OrderStatus.COMPLETED) {
          this.checkReviewAndMaybeOpenModal(res.data.id);
        }
        this.refreshUnreadMessages(id);
        // Honour pending `?openMessages=1` request from a notification tap
        // now that the comments thread is loaded.
        this.tryOpenPendingMessaging();
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Error al cargar la orden');
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Asks the backend for the unread `order_comment` notification count for
   * this order. Drives the red dot on the messaging trigger. Called on
   * first load and whenever a relevant push arrives while the modal is
   * closed.
   */
  private refreshUnreadMessages(orderId: string): void {
    this.userNotifications.getOrderUnreadCount(orderId, 'order_comment').subscribe({
      next: ({ count }) => this.hasUnreadMessages.set(count > 0),
      error: () => { /* silent — non-critical signal */ },
    });
  }

  /**
   * Refreshes the order without flipping `isLoading`, so the already
   * rendered UI stays visible while the new data swaps in. Triggered by
   * a push relevant to this order — the user perceives the update live.
   *
   * Side effect: if a brand-new admin-authored comment appeared between
   * snapshots, schedule a pulse highlight on the comments panel so the
   * customer notices the reply without scrolling.
   */
  private silentReloadOrder(id: string): void {
    const previousKeys = new Set(
      (this.order()?.comments || []).map(orderCommentKey)
    );
    this.orderService.getOrderById(id).subscribe({
      next: (res) => {
        this.order.set(res.data);
        const incomingAdminComment = (res.data.comments || [])
          .filter((c: OrderComment) => c.authorType === 'admin')
          .filter((c: OrderComment) => !previousKeys.has(orderCommentKey(c)))
          .pop();
        if (!incomingAdminComment) return;

        // Always trigger the pulse highlight — useful both inside the
        // modal (drawing the eye to the new bubble) and right after the
        // user opens it next time.
        this.triggerCommentHighlight(orderCommentKey(incomingAdminComment));

        // Diff-driven dot logic — independent from the FCM push event
        // payload, so it works on the polling fallback path too:
        //   - Modal closed → light the unread dot.
        //   - Modal open   → user is already watching; sync the backend
        //                    immediately so the dot doesn't ghost back on.
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

  /**
   * Lights up the new comment for ~3 s. Reset on every fire so back-to-back
   * pushes restart the animation instead of leaving it stuck.
   */
  private triggerCommentHighlight(key: string): void {
    this.highlightCommentId.set(key);
    if (this.highlightTimer) clearTimeout(this.highlightTimer);
    this.highlightTimer = setTimeout(() => this.highlightCommentId.set(null), 3000);
  }

  /**
   * Reacts to FCM push events that target this client tab. Filters by
   * the currently-viewed order id so unrelated pushes are ignored.
   * Foreground and background SW push events share the same stream.
   */
  private subscribeToPushEvents(): void {
    this.userNotifications.pushReceived$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        // [diagnostics] temporary log — confirms FCM delivery while the
        // messaging feature is being verified end-to-end. Safe to remove
        // once the unread flow is stable in production.
        console.info('[OrderDetail] push received:', event);

        const currentId = this.order()?.id;
        if (!currentId) return;
        if (event.relatedOrder !== currentId) return;
        // `silentReloadOrder` owns both the in-page refresh AND the
        // unread-dot logic (diff-based). No need to second-guess here.
        this.silentReloadOrder(currentId);
      });
  }

  // ============================================
  // RATING / VALORACIÓN
  // ============================================
  /**
   * Gate + fetch: only runs once per loaded order. If the user already
   * dismissed the modal for this order in the current browser session, we
   * stay quiet. Otherwise we ask the backend if a review exists; if not,
   * the modal opens.
   */
  private checkReviewAndMaybeOpenModal(orderId: string): void {
    if (this.hasCheckedReview) return;
    this.hasCheckedReview = true;

    if (this.wasReviewDismissed(orderId)) return;

    this.reviewService.getByOrder(orderId).subscribe({
      next: (res) => {
        if (!res.data) {
          this.showRatingModal.set(true);
        }
      },
      error: () => {
        // Silent: offline, 401, 403 → simply skip opening the modal.
      },
    });
  }

  protected onRatingClosed(): void {
    const id = this.order()?.id;
    if (id) this.markReviewDismissed(id);
    this.showRatingModal.set(false);
    this.ratingSubmitError.set(null);
  }

  protected onRatingSubmitted(payload: { rating: number; comment: string }): void {
    const id = this.order()?.id;
    if (!id) return;

    this.isSubmittingRating.set(true);
    this.ratingSubmitError.set(null);

    this.reviewService.create({
      orderId: id,
      rating: payload.rating,
      comment: payload.comment || undefined,
    }).subscribe({
      next: () => {
        this.isSubmittingRating.set(false);
        this.showRatingModal.set(false);
      },
      error: (err) => {
        this.isSubmittingRating.set(false);
        this.ratingSubmitError.set(
          err?.error?.message ?? 'No pudimos guardar tu valoración. Intenta nuevamente.',
        );
      },
    });
  }

  private wasReviewDismissed(orderId: string): boolean {
    try {
      return sessionStorage.getItem(`${this.REVIEW_DISMISSED_KEY}:${orderId}`) === '1';
    } catch {
      return false;
    }
  }

  private markReviewDismissed(orderId: string): void {
    try {
      sessionStorage.setItem(`${this.REVIEW_DISMISSED_KEY}:${orderId}`, '1');
    } catch {
      // SSR or storage disabled — ignore silently.
    }
  }

  // ============================================
  // NAVEGACIÓN
  // ============================================
  goBack(): void {
    this.router.navigate(['/perfil'], { fragment: 'pedidos' });
  }

  // ============================================
  // LABELS Y HELPERS
  // ============================================
  getStatusLabel(status: OrderStatus | string): string {
    return this.statusLabels[status as OrderStatus] || status;
  }

  getStatusClass(status: OrderStatus | string): string {
    return this.statusColors[status as OrderStatus] || '';
  }

  getStatusDescription(status: OrderStatus | string): string {
    return ORDER_STATUS_DESCRIPTIONS[status as OrderStatus] || '';
  }

  // ========== DISPATCH STATUS HELPERS ==========

  getDispatchStatusLabel(status?: DispatchStatus | string): string {
    if (!status) return '';
    return DISPATCH_STATUS_LABELS[status as DispatchStatus] || status;
  }

  getDispatchStatusClass(status?: DispatchStatus | string): string {
    if (!status) return '';
    return DISPATCH_STATUS_COLORS[status as DispatchStatus] || '';
  }

  getDispatchStatusDescription(status?: DispatchStatus | string): string {
    if (!status) return '';
    return DISPATCH_STATUS_DESCRIPTIONS[status as DispatchStatus] || '';
  }

  /** Whether to show the dispatch tracking section (shipping/delivery orders after approval) */
  showDispatchTracking(order: Order): boolean {
    return isShippingOrder(order);
  }

  isOilChange(order: Order): boolean {
    return isOilChangeOrder(order);
  }

  /**
   * Whether the order contains at least one combo item. Used to decide if the
   * customer disclaimer section ("Motor sin/con modificaciones") should render
   * — combos bundle a filter, so the disclaimer only applies to them.
   */
  orderHasCombo(order: Order): boolean {
    return order.items?.some((item) => item.isCombo === true) ?? false;
  }

  getDispatchLabel(type: string): string {
    const labels: Record<string, string> = {
      store_pickup: 'Retiro en Tienda',
      shipping_agency: 'Envío por Agencia',
      local_delivery: 'Delivery Local',
      seller_agreement: 'Acordar con Vendedor',
      oil_change_service: 'Cambio de Aceite a Domicilio',
      in_store_oil_change: 'Cambio de Aceite en Tienda',
    };
    return labels[type] || type;
  }

  formatDate(date: string): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getCurrencySymbol(type?: string): string {
    if (!type) return '$';
    if (type === 'pago_movil' || type === 'transferencia') return 'Bs';
    if (type === 'binance') return 'USDT';
    return '$';
  }

  // ============================================
  // MECÁNICO — Triple fallback
  // ============================================
  /**
   * Retorna true si la orden tiene información del mecánico disponible por cualquier vía.
   * Fuentes (en orden): order.mechanic populado, order.mechanicAssignment.mechanic populado, o status indica servicio activo.
   */
  hasMechanic(order: Order): boolean {
    // Fuente 1: mechanic populado directamente
    const m = order.mechanic as any;
    if (m && typeof m === 'object' && (m.name || m.whatsapp)) return true;

    // Fuente 2: mechanic populado dentro del assignment
    const a = order.mechanicAssignment as any;
    if (a && typeof a === 'object' && a.mechanic && typeof a.mechanic === 'object' && (a.mechanic.name || a.mechanic.whatsapp)) return true;

    // Fuente 3: mechanicAssignment populated means mechanic was assigned
    return !!(order.mechanicAssignment && typeof order.mechanicAssignment === 'object');
  }

  mechanicName(order: Order): string {
    const m = order.mechanic as any;
    if (m && typeof m === 'object' && m.name) return m.name;

    const a = order.mechanicAssignment as any;
    if (a && typeof a === 'object' && a.mechanic && typeof a.mechanic === 'object' && a.mechanic.name) {
      return a.mechanic.name;
    }

    return 'Mecánico asignado';
  }

  mechanicWhatsapp(order: Order): string {
    const m = order.mechanic as any;
    if (m && typeof m === 'object' && m.whatsapp) return m.whatsapp;

    const a = order.mechanicAssignment as any;
    if (a && typeof a === 'object' && a.mechanic && typeof a.mechanic === 'object' && a.mechanic.whatsapp) {
      return a.mechanic.whatsapp;
    }

    return '';
  }

  /**
   * Phone is only exposed to the client while the mechanic is en route
   * (`en_camino`) or actively performing the service (`in_progress`).
   */
  canShowMechanicPhone(order: Order): boolean {
    const a = order.mechanicAssignment as any;
    const status = a && typeof a === 'object' ? a.status : null;
    return status === 'en_camino' || status === 'in_progress';
  }

  /**
   * Returns the display label + color classes for the mechanic assignment
   * status. This is the source for the badge on the "Mecánico Asignado"
   * card — it reflects the service lifecycle (asignado → en camino → en
   * servicio → completado), NOT the order's own status (pending/approved/
   * completed/cancelled). Keeping the two badges semantically separate
   * removes the ambiguity the owner reported.
   *
   * Falls back to a neutral "Asignado" pill when the order has a mechanic
   * but no assignment object (legacy data path or partial population).
   */
  assignmentStatusBadge(order: Order): { label: string; colorClass: string } {
    const a = order.mechanicAssignment as any;
    const status = a && typeof a === 'object' ? a.status : null;
    const map: Record<string, { label: string; colorClass: string }> = {
      scheduled:   { label: 'Mecánico Asignado', colorClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
      en_camino:   { label: 'En Camino',         colorClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300' },
      in_progress: { label: 'En Servicio',       colorClass: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
      completed:   { label: 'Servicio Completo', colorClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
      paused:      { label: 'En Pausa',          colorClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
      cancelled:   { label: 'Cancelado',         colorClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
      expired:     { label: 'Expirado',          colorClass: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' },
    };
    return status && map[status]
      ? map[status]
      : { label: 'Asignado', colorClass: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' };
  }

  /**
   * True when the "Mecánico Asignado" card should be promoted to the top
   * of the detail layout (above the two-column grid). Conditions:
   *   1. The order has a mechanic populated.
   *   2. The order is still in progress — not completed and not cancelled.
   *
   * The card stays in its original position (right column, sección 7) for
   * historical orders so the layout doesn't draw the eye to a service
   * that already finished or got cancelled.
   */
  protected readonly mechanicCardOnTop = computed(() => {
    const o = this.order();
    if (!o) return false;
    if (!this.hasMechanic(o)) return false;
    if (o.status === OrderStatus.COMPLETED) return false;
    if (o.status === OrderStatus.CANCELLED) return false;
    return true;
  });

  mechanicAvatar(order: Order): string {
    const m = order.mechanic as any;
    if (m && typeof m === 'object' && m.avatar) return m.avatar;

    const a = order.mechanicAssignment as any;
    if (a && typeof a === 'object' && a.mechanic && typeof a.mechanic === 'object' && a.mechanic.avatar) {
      return a.mechanic.avatar;
    }

    return '';
  }

  onCommentsUpdated(updatedOrder: Order): void {
    this.order.set(updatedOrder);
  }

  // ============================================
  // MESSAGING MODAL
  // ============================================
  protected openMessaging(): void {
    this.showMessagingModal.set(true);
    const id = this.order()?.id;
    if (!id) return;
    // Optimistic: clear the dot immediately, then sync with the backend.
    this.hasUnreadMessages.set(false);
    this.userNotifications
      .markOrderAsRead(id, 'order_comment')
      .subscribe({ error: () => { /* silent — UI already optimistic */ } });
  }

  protected closeMessaging(): void {
    this.showMessagingModal.set(false);
  }

  // ============================================
  // CANCELACIÓN (2 pasos)
  // ============================================
  openReasonModal(): void {
    this.cancelReason.set('');
    this.showReasonModal.set(true);
  }

  closeReasonModal(): void {
    this.showReasonModal.set(false);
  }

  proceedToConfirm(): void {
    this.showReasonModal.set(false);
    this.showConfirmModal.set(true);
  }

  closeConfirmModal(): void {
    this.showConfirmModal.set(false);
  }

  confirmCancelOrder(): void {
    const o = this.order();
    if (!o) return;

    this.isCancelling.set(true);
    const reason = this.cancelReason().trim() || undefined;
    this.orderService.cancelOrder(o.id, reason).subscribe({
      next: (res) => {
        this.isCancelling.set(false);
        this.showConfirmModal.set(false);
        this.order.set(res.data);
      },
      error: () => {
        this.isCancelling.set(false);
      },
    });
  }

  // ============================================
  // DETALLE DE PAGO (expandir/colapsar)
  // ============================================
  togglePaymentDetail(): void {
    this.isPaymentExpanded.update((v) => !v);
  }

  /**
   * True only when the submission carries at least one of the fields gated
   * behind the eye-toggle (`referenceNumber`, `sourceBank`, `senderName`,
   * `paymentDate`). Card / cash payments expose only `methodLabel` and
   * `amount`, which are already rendered unconditionally — for those the
   * toggle would expand nothing, so we hide it entirely.
   */
  hasExpandablePaymentDetails(order: Order): boolean {
    const ps = order.paymentSubmission;
    if (!ps) return false;
    return !!(ps.referenceNumber || ps.sourceBank || ps.senderName || ps.paymentDate);
  }

  // ============================================
  // RE-SUBIDA DE COMPROBANTE DE PAGO
  // ============================================

  /** Determines whether the re-upload section should be visible */
  canUploadProof(order: Order): boolean {
    if (!order.paymentSubmission) return false;
    if (order.paymentSubmission.proofUrl) return false;

    // Only payment methods that generate a proof (pago_movil, transferencia)
    // can be in a "missing proof" state. Card / cash are paid in person and
    // have no proof by design.
    const methodType = order.paymentSubmission.methodType as PaymentMethodType;
    if (!PAYMENT_TYPES_WITH_FORM.includes(methodType)) return false;

    const editable: string[] = [OrderStatus.PENDING, OrderStatus.APPROVED];
    return editable.includes(order.status);
  }

  onProofFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Reset previous messages
    this.uploadProofError.set(null);
    this.uploadProofSuccess.set(null);

    // Validate type and size client-side
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      this.uploadProofError.set('Tipo de archivo no permitido. Usa JPG, PNG, WebP o GIF.');
      input.value = '';
      return;
    }
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      this.uploadProofError.set('El archivo excede el tamano maximo de 5MB.');
      input.value = '';
      return;
    }

    this.uploadProofFile.set(file);
    const reader = new FileReader();
    reader.onload = () => this.uploadProofPreview.set(reader.result as string);
    reader.readAsDataURL(file);
    input.value = '';
  }

  removeProofSelection(): void {
    this.uploadProofFile.set(null);
    this.uploadProofPreview.set(null);
    this.uploadProofError.set(null);
  }

  saveProof(): void {
    const o = this.order();
    const file = this.uploadProofFile();
    if (!o || !o.paymentSubmission || !file) return;

    this.isUploadingProof.set(true);
    this.uploadProofError.set(null);
    this.uploadProofSuccess.set(null);

    this.uploadService.uploadImage(file, 'payment-proofs').subscribe({
      next: (uploadRes) => {
        if (!uploadRes?.data?.url) {
          this.isUploadingProof.set(false);
          this.uploadProofError.set('Error al subir el comprobante: respuesta invalida del servidor.');
          return;
        }

        // Preserve all existing paymentSubmission fields, add proofUrl and proofPublicId
        const updated = {
          ...o.paymentSubmission!,
          proofUrl: uploadRes.data.url,
          proofPublicId: uploadRes.data.publicId,
        };

        this.orderService.updatePayment(o.id, updated).subscribe({
          next: (res) => {
            this.order.set(res.data);
            this.uploadProofFile.set(null);
            this.uploadProofPreview.set(null);
            this.isUploadingProof.set(false);
            this.uploadProofSuccess.set('Comprobante guardado exitosamente');
            setTimeout(() => this.uploadProofSuccess.set(null), 3000);
          },
          error: (err) => {
            this.isUploadingProof.set(false);
            this.uploadProofError.set(err?.error?.message || 'Error al guardar el comprobante.');
          },
        });
      },
      error: (err) => {
        this.isUploadingProof.set(false);
        this.uploadProofError.set(err?.error?.message || 'No se pudo subir el comprobante. Intenta nuevamente.');
      },
    });
  }

  // ============================================
  // IMPRESIÓN / PDF
  // ============================================
  printOrder(): void {
    this.printedAt = new Date().toISOString();
    // Give Angular one tick to render the print-only header before the OS
    // dialog grabs the document snapshot. The platform strategy dispatches
    // to window.print() on web and to the native PrintManager on Android.
    setTimeout(() => {
      const orderNumber = this.order()?.orderNumber ?? 'documento';
      void this.printer.print({ title: `orden_${orderNumber}` });
    }, 50);
  }
}
