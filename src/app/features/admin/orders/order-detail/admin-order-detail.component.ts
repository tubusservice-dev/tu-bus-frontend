import { Component, DestroyRef, inject, signal, computed, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OrderService } from '@core/services/order.service';
import { ExchangeRateService } from '@core/services/exchange-rate.service';
import { AdminNotificationsService } from '@core/services/admin-notifications.service';
import { ClipboardService } from '@shared/services/clipboard.service';
import {
  Order,
  OrderStatus,
  DispatchStatus,
  DispatchType,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  DISPATCH_STATUS_LABELS,
  DISPATCH_STATUS_COLORS,
  DISPATCH_TYPE_LABELS,
  DISPATCH_TYPE_COLORS,
  isOilChangeOrder,
  isShippingOrder,
  getAvailableDispatchStatuses,
  getOptionsMenuStatuses,
  ServiceDateState,
  getServiceDateState,
  orderCommentKey,
  OrderComment,
} from '@models/order.model';

/** Admin-facing copy for the service-date card. Operational tone, not coloquial. */
const ADMIN_SERVICE_DATE_BADGE: Record<ServiceDateState, { label: string; cls: string }> = {
  pending:     { label: 'Agendado',    cls: 'badge-amber' },
  confirmed:   { label: 'Confirmado',  cls: 'badge-emerald' },
  rescheduled: { label: 'Reprogramado', cls: 'badge-blue' },
};

const ADMIN_SERVICE_DATE_MESSAGE: Record<ServiceDateState, string> = {
  pending:
    'Fecha solicitada por el cliente, a la espera de confirmar disponibilidad. Para asignar un mecánico y confirmar la cita usa el botón «Asignar/Mecánico Asignado» en el encabezado.',
  confirmed:
    'La cita fue confirmada y el mecánico ya fue asignado en la fecha solicitada por el cliente.',
  rescheduled:
    'La cita fue reprogramada porque no había disponibilidad en la fecha originalmente solicitada por el cliente. Se asignó la opción más cercana disponible.',
};
import { PAYMENT_METHOD_TYPE_LABELS, PaymentMethodType } from '@models/payment-method.model';
import { MechanicAssignment, ProgressStep } from '@models/mechanic-assignment.model';
import { OrderDispatchModalComponent } from '../order-dispatch-modal/order-dispatch-modal.component';
import { MechanicAvatarComponent } from '@shared/components/mechanic-avatar/mechanic-avatar.component';
import { OrderCommentsComponent } from '@shared/components/order-comments/order-comments.component';
import { ClickOutsideDirective } from '@shared/directives/click-outside.directive';
import { MechanicAssignmentService } from '@core/services/mechanic-assignment.service';
import { PhoneActionPopoverComponent } from '@shared/components/phone-action-popover/phone-action-popover.component';

@Component({
  selector: 'app-admin-order-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    OrderDispatchModalComponent,
    MechanicAvatarComponent,
    OrderCommentsComponent,
    ClickOutsideDirective,
    PhoneActionPopoverComponent,
  ],
  templateUrl: './admin-order-detail.component.html',
  styleUrl: './admin-order-detail.component.scss',
})
export class AdminOrderDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orderService = inject(OrderService);
  private readonly assignmentService = inject(MechanicAssignmentService);
  protected readonly exchangeRateService = inject(ExchangeRateService);
  private readonly clipboard = inject(ClipboardService);
  private readonly adminNotifications = inject(AdminNotificationsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isLoading = signal(true);
  protected readonly order = signal<Order | null>(null);
  protected readonly error = signal<string | null>(null);

  // ========== APPROVE / CANCEL (pending state) ==========
  protected readonly showApproveModal = signal(false);
  protected readonly showCancelOrderModal = signal(false);
  protected readonly approveNote = signal('');
  protected readonly cancelReason = signal('');
  protected readonly isApproving = signal(false);
  protected readonly isCancelling = signal(false);

  // ========== OPTIONS MENU (3-dot) ==========
  protected readonly showOptionsMenu = signal(false);
  protected readonly showOptionsStatusModal = signal(false);
  protected readonly selectedMenuStatus = signal<OrderStatus | null>(null);
  protected readonly optionsStatusNote = signal('');
  protected readonly isChangingFromOptions = signal(false);

  // ========== CANCELLATION REQUEST ACTIONS ==========
  protected readonly showApproveCancellationModal = signal(false);
  protected readonly showRejectCancellationModal = signal(false);
  protected readonly cancellationActionNote = signal('');
  protected readonly isHandlingCancellation = signal(false);

  // ========== DISPATCH STATUS ==========
  protected readonly showDispatchModal = signal(false);
  protected readonly pendingDispatchStatus = signal<DispatchStatus | null>(null);
  protected readonly dispatchNote = signal('');
  protected readonly isUpdatingDispatch = signal(false);

  // ========== MECHANIC DISPATCH MODAL ==========
  protected readonly dispatchModalOpen = signal(false);

  // ========== SERVICE TRACKING ==========
  protected readonly serviceAssignment = signal<MechanicAssignment | null>(null);
  protected readonly isLoadingService = signal(false);

  // ========== NOTES EDITING ==========
  protected readonly isEditingNotes = signal(false);
  protected readonly editNotesValue = signal('');
  protected readonly isSavingNotes = signal(false);

  /** True when the admin note is long enough that inline layout breaks.
   *  Drives the `.info-row-stacked` modifier on the Notas row. */
  protected readonly hasLongNotes = computed(() => {
    const n = this.order()?.notes ?? '';
    return n.length > 40;
  });

  /**
   * Compact log of every admin-authored note attached to the order. Combines
   * `statusHistory` (approval, cancellation, completion) with `serviceEvents`
   * (date reschedules, mechanic reassignments) and keeps only entries that
   * actually carry a note. Newest first.
   *
   * Rendered as a sub-block inside the "Informacion General" card so admins
   * can audit what was written, when, and from which action — without losing
   * notes when a new one is added (the backend already accumulates them; the
   * admin UI was the only side not surfacing them).
   */
  protected readonly noteHistory = computed(() => {
    const o = this.order();
    if (!o) return [] as Array<{ origin: string; tone: string; note: string; timestamp: string | Date }>;

    const statusOrigin: Partial<Record<OrderStatus, { origin: string; tone: string }>> = {
      [OrderStatus.PENDING]:                 { origin: 'Pendiente',              tone: 'tone-gray' },
      [OrderStatus.APPROVED]:                { origin: 'Aprobada',               tone: 'tone-emerald' },
      [OrderStatus.COMPLETED]:               { origin: 'Completada',             tone: 'tone-blue' },
      [OrderStatus.CANCELLATION_REQUESTED]:  { origin: 'Cancelacion solicitada', tone: 'tone-amber' },
      [OrderStatus.CANCELLED]:               { origin: 'Cancelada',              tone: 'tone-red' },
    };

    const statusEntries = (o.statusHistory || [])
      .filter(s => s.note && s.note.trim().length > 0)
      .map(s => {
        const meta = statusOrigin[s.status as OrderStatus] || { origin: 'Cambio de estado', tone: 'tone-gray' };
        return { origin: meta.origin, tone: meta.tone, note: s.note!, timestamp: s.timestamp };
      });

    const eventEntries = (o.serviceEvents || [])
      .filter(ev => ev.note && ev.note.trim().length > 0)
      .map(ev => {
        if (ev.type === 'date_rescheduled') {
          return { origin: 'Reprogramacion', tone: 'tone-amber', note: ev.note!, timestamp: ev.timestamp };
        }
        if (ev.type === 'mechanic_reassigned') {
          return { origin: 'Mecanico reasignado', tone: 'tone-blue', note: ev.note!, timestamp: ev.timestamp };
        }
        return { origin: 'Nota', tone: 'tone-gray', note: ev.note!, timestamp: ev.timestamp };
      });

    return [...statusEntries, ...eventEntries].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  });

  // ========== IMAGE LIGHTBOX ==========
  protected readonly proofPreview = signal<string | null>(null);

  // ========== COMMENT HIGHLIGHT (push-driven pulse) ==========
  /**
   * Stable key of the newest incoming comment that should pulse in the
   * comments panel. Set when `silentReloadOrder` detects a brand-new
   * client comment after a push, cleared 3 s later by `highlightTimer`.
   */
  protected readonly highlightCommentId = signal<string | null>(null);
  private highlightTimer: ReturnType<typeof setTimeout> | null = null;

  // ========== CONSTANTS ==========
  protected readonly ORDER_STATUS_LABELS = ORDER_STATUS_LABELS;
  protected readonly DISPATCH_STATUS_LABELS = DISPATCH_STATUS_LABELS;
  protected readonly DispatchStatus = DispatchStatus;
  protected readonly OrderStatus = OrderStatus;

  // ========== COMPUTED FLAGS ==========
  protected readonly isPending = computed(() => this.order()?.status === OrderStatus.PENDING);
  protected readonly isApproved = computed(() => this.order()?.status === OrderStatus.APPROVED);
  protected readonly isCompleted = computed(() => this.order()?.status === OrderStatus.COMPLETED);
  protected readonly isCancelled = computed(() => this.order()?.status === OrderStatus.CANCELLED);
  protected readonly hasCancellationRequest = computed(() => this.order()?.status === OrderStatus.CANCELLATION_REQUESTED);

  protected readonly isOilChange = computed(() => {
    const o = this.order();
    return o ? isOilChangeOrder(o) : false;
  });

  protected readonly isShipping = computed(() => {
    const o = this.order();
    return o ? isShippingOrder(o) : false;
  });

  protected readonly showDispatchSelector = computed(() => {
    return this.isShipping() && (this.isApproved() || this.isCompleted()) && !this.isCancelled();
  });

  protected readonly showMechanicButton = computed(() => {
    return this.isOilChange() && (this.isApproved() || this.isCompleted());
  });

  protected readonly hasMechanicAssigned = computed(() => {
    const o = this.order();
    if (!o) return false;
    return !!(o.mechanicAssignment && typeof o.mechanicAssignment === 'object');
  });

  /**
   * True when the order has a requested service date. Drives the visibility
   * of the "Fecha del Servicio" card in the left column.
   */
  protected readonly hasRequestedServiceDate = computed(() => !!this.order()?.requestedServiceDate);

  /**
   * Spanish label for the requested service tier (express/mañana/agendado).
   */
  protected readonly requestedTierLabel = computed<string>(() => {
    const tier = this.order()?.requestedServiceTier;
    switch (tier) {
      case 'express':   return 'Express (hoy)';
      case 'tomorrow':  return 'Mañana';
      case 'scheduled': return 'Agendado';
      default:          return '';
    }
  });

  /**
   * Long-form date in Spanish (e.g. "miércoles, 22 de abril de 2026") for the
   * service date currently driving the card — the confirmed `scheduledDate`
   * when an assignment exists, otherwise the date originally requested by the
   * client. UTC-anchored to avoid off-by-one on ISO dates.
   */
  protected readonly requestedDateLabel = computed<string>(() => {
    const o = this.order();
    if (!o) return '';
    const a = o.mechanicAssignment as { scheduledDate?: string } | string | undefined;
    const raw = (a && typeof a === 'object' && a.scheduledDate)
      ? a.scheduledDate
      : o.requestedServiceDate;
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
      return String(raw);
    }
  });

  /** Lifecycle state of the service date — drives header badge and body copy. */
  protected readonly serviceDateState = computed<ServiceDateState>(() => {
    const o = this.order();
    return o ? getServiceDateState(o) : 'pending';
  });

  protected readonly serviceDateBadge = computed(
    () => ADMIN_SERVICE_DATE_BADGE[this.serviceDateState()]
  );

  protected readonly serviceDateMessage = computed(
    () => ADMIN_SERVICE_DATE_MESSAGE[this.serviceDateState()]
  );

  /**
   * Narrative description per dispatch type — gives the admin an at-a-glance
   * understanding of what this order entails without having to cross-reference
   * multiple sections. Empty string for unknown types (defensive).
   */
  protected readonly dispatchTypeDescription = computed<string>(() => {
    const dt = this.order()?.dispatchType;
    switch (dt) {
      case 'oil_change_service':
        return 'Esta orden fue marcada como Servicio de Cambio de Aceite a Domicilio. Un mecánico se trasladará a la dirección del cliente para realizar el servicio.';
      case 'in_store_oil_change':
        return 'Esta orden fue marcada como Cambio de Aceite en Tienda. El cliente llevará su vehículo a la sucursal seleccionada.';
      case 'store_pickup':
        return 'Esta orden fue marcada como Retiro en Tienda. El cliente recogerá personalmente el pedido.';
      case 'local_delivery':
        return 'Esta orden fue marcada como Delivery Local. Un repartidor llevará el pedido a la dirección del cliente dentro de la zona de cobertura.';
      case 'shipping_agency':
        return 'Esta orden será enviada por Agencia. El pedido se despachará a través de una agencia de envío a nivel nacional.';
      case 'seller_agreement':
        return 'El método de entrega se coordinará directamente con el cliente a través de nuestro equipo de ventas.';
      default:
        return '';
    }
  });

  protected readonly availableDispatchStatuses = computed(() => {
    const o = this.order();
    return getAvailableDispatchStatuses(o?.dispatchStatus);
  });

  protected readonly optionsMenuStatuses = computed(() => {
    const o = this.order();
    if (!o) return [];
    return getOptionsMenuStatuses(o.status);
  });

  // ========== LIFECYCLE ==========

  ngOnInit(): void {
    // Subscribe to paramMap (not snapshot) so Angular's component reuse on
    // /admin/orders/:id → /admin/orders/:other-id reloads the order instead
    // of sticking with the one that was loaded on first mount — which is
    // exactly the case when the admin clicks "Ver orden" inside the push
    // notification modal while already viewing another order's detail.
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const id = params.get('id');
        if (!id) {
          this.router.navigate(['/admin/orders']);
          return;
        }
        // Reset transient per-order UI state so it doesn't leak across orders.
        this.serviceAssignment.set(null);
        this.error.set(null);
        this.loadOrder(id);
      });

    // Push subscription registered once for the component's lifetime; the
    // handler reads `this.order()?.id` at fire time so it always filters
    // against the *currently loaded* order, not the original one.
    this.subscribeToPushEvents();
  }

  private loadOrder(id: string): void {
    this.isLoading.set(true);
    this.orderService.getAdminOrderById(id).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.isLoading.set(false);
        if (this.isOilChange()) {
          this.loadServiceTracking(id);
        }
      },
      error: () => {
        this.error.set('No se pudo cargar la orden');
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Refreshes the order in place without flipping `isLoading`, so the
   * already-rendered UI stays visible while the new data swaps in. Used
   * when a push notification reports a change for the order currently
   * being viewed — the user perceives the update as "live".
   *
   * Side effect: if a brand-new client-authored comment appeared between
   * the previous snapshot and the new one, schedule a pulse highlight on
   * the comments panel so the admin notices the message without scrolling.
   */
  private silentReloadOrder(id: string): void {
    const previousKeys = new Set(
      (this.order()?.comments || []).map(orderCommentKey)
    );
    this.orderService.getAdminOrderById(id).subscribe({
      next: (res) => {
        this.order.set(res.data);
        if (this.isOilChange()) {
          this.loadServiceTracking(id);
        }
        const incomingClientComment = (res.data.comments || [])
          .filter((c: OrderComment) => c.authorType === 'client')
          .filter((c: OrderComment) => !previousKeys.has(orderCommentKey(c)))
          .pop();
        if (incomingClientComment) {
          this.triggerCommentHighlight(orderCommentKey(incomingClientComment));
        }
      },
      // Silent on error: the user is already seeing valid (stale) data and
      // another push or the polling will retry eventually.
      error: () => { /* no-op */ },
    });
  }

  /**
   * Sets the highlight signal for ~3 s so the new comment's pulse
   * animation runs exactly once. Re-firing during the window resets the
   * timer (rare: multiple pushes arriving in <3 s for the same order).
   */
  private triggerCommentHighlight(key: string): void {
    this.highlightCommentId.set(key);
    if (this.highlightTimer) clearTimeout(this.highlightTimer);
    this.highlightTimer = setTimeout(() => this.highlightCommentId.set(null), 3000);
  }

  /**
   * Reacts to FCM push events that target this admin tab. Filters by the
   * currently-viewed order id so unrelated pushes (other orders, generic
   * notifications) are ignored. Both foreground and background SW push
   * events flow through the same stream.
   */
  private subscribeToPushEvents(): void {
    this.adminNotifications.pushReceived$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        const currentId = this.order()?.id;
        if (!currentId) return;
        if (event.relatedOrder !== currentId) return;
        this.silentReloadOrder(currentId);
      });
  }

  private loadServiceTracking(orderId: string): void {
    this.isLoadingService.set(true);
    this.assignmentService.getByOrder(orderId).subscribe({
      next: (res) => {
        const active = res.data?.find((a) => !['cancelled', 'expired'].includes(a.status));
        this.serviceAssignment.set(active || null);
        this.isLoadingService.set(false);
      },
      error: () => this.isLoadingService.set(false),
    });
  }

  // ========== DATA HELPERS ==========

  getClientName(order: Order): string {
    if (typeof order.user === 'object' && order.user) {
      const name = `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim();
      return name || order.user.email || '-';
    }
    return String(order.user || '-');
  }

  /**
   * Whether the order contains at least one combo item. Used to decide if the
   * disclaimer row should render — combos bundle a filter, so the disclaimer
   * only applies to them.
   */
  orderHasCombo(order: Order): boolean {
    return order.items?.some((item) => item.isCombo === true) ?? false;
  }

  getClientEmail(order: Order): string {
    if (typeof order.user === 'object' && order.user) {
      return order.user.email || '';
    }
    return '';
  }

  getClientField(order: Order, field: string): string {
    if (typeof order.user === 'object' && order.user) {
      return (order.user as any)[field] || '';
    }
    return '';
  }

  getClientDocument(order: Order): string {
    if (typeof order.user !== 'object' || !order.user) return '';
    const type = order.user.documentType;
    const number = order.user.documentNumber;
    if (!type || !number) return '';
    return `${type}-${number}`;
  }

  getClientLocation(order: Order): string {
    if (typeof order.user !== 'object' || !order.user) return '';
    const parts = [
      order.user.municipalityName,
      order.user.cityName,
      order.user.stateName,
    ].filter(Boolean);
    return parts.join(', ');
  }

  getStatusLabel(status: OrderStatus): string {
    return ORDER_STATUS_LABELS[status] || status;
  }

  getStatusColor(status: OrderStatus): string {
    return ORDER_STATUS_COLORS[status] || '';
  }

  getDispatchStatusLabel(status?: DispatchStatus): string {
    if (!status) return '-';
    return DISPATCH_STATUS_LABELS[status] || status;
  }

  getDispatchStatusColor(status?: DispatchStatus): string {
    if (!status) return '';
    return DISPATCH_STATUS_COLORS[status] || '';
  }

  getDispatchTypeColor(type: string): string {
    return DISPATCH_TYPE_COLORS[type as DispatchType] || '';
  }

  getDispatchTypeLabel(type: string): string {
    return DISPATCH_TYPE_LABELS[type as DispatchType] || type;
  }

  getPaymentMethodLabel(type?: string): string {
    if (!type) return '-';
    return PAYMENT_METHOD_TYPE_LABELS[type as PaymentMethodType] || type;
  }

  getCurrencySymbol(type?: string): string {
    if (!type) return '$';
    if (type === 'pago_movil' || type === 'transferencia') return 'Bs';
    if (type === 'binance') return 'USDT';
    return '$';
  }

  formatPaymentAmount(amount?: number, type?: string): string {
    if (!amount) return '-';
    const symbol = this.getCurrencySymbol(type);
    const formatted = amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${symbol} ${formatted}`;
  }

  formatDate(date: string | Date): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatScheduledDate(date?: string | Date): string {
    if (!date) return '';
    try {
      const d = new Date(date);
      return new Intl.DateTimeFormat('es-VE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(d);
    } catch {
      return String(date);
    }
  }

  getVehicleInfo(order: Order): string {
    const vehicles = order.vehicles?.length ? order.vehicles : (order.vehicle ? [order.vehicle] : []);
    if (!vehicles.length) return '-';
    return vehicles.map(v => {
      if (typeof v === 'object') return `${v.marca} ${v.modelo} ${v.year} - ${v.placa}`;
      return String(v);
    }).join(' | ');
  }

  getVehicles(order: Order): any[] {
    const vehicles = order.vehicles?.length ? order.vehicles : (order.vehicle ? [order.vehicle] : []);
    return vehicles.filter((v) => typeof v === 'object') as any[];
  }

  getBillingSourceLabel(source?: string): string {
    const labels: Record<string, string> = {
      shipping: 'Direccion de envio',
      profile: 'Direccion del perfil',
      custom: 'Direccion personalizada',
    };
    return labels[source || ''] || source || '-';
  }

  // ========== SERVICE TRACKING HELPERS ==========

  getMechanicName(): string {
    const a = this.serviceAssignment();
    if (!a || typeof a.mechanic === 'string') return '';
    return a.mechanic.name || '';
  }

  getMechanicWhatsapp(): string {
    const a = this.serviceAssignment();
    if (!a || typeof a.mechanic === 'string') return '';
    return a.mechanic.whatsapp || '';
  }

  getMechanicAvatar(): string {
    const a = this.serviceAssignment();
    if (!a || typeof a.mechanic === 'string') return '';
    return (a.mechanic as any).avatar || '';
  }

  getServiceSteps(): ProgressStep[] {
    return this.serviceAssignment()?.progressSteps || [];
  }

  getCurrentStepIndex(): number {
    const steps = this.getServiceSteps();
    let last = -1;
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].completedAt) last = i;
    }
    return last;
  }

  getStepLabel(step: ProgressStep): string {
    const labels: Record<string, string> = {
      asignado: 'Asignado',
      en_camino: 'En Camino',
      en_proceso: 'En Servicio',
      completado: 'Completado',
    };
    return labels[step.step] || step.label;
  }

  // ========== ACTIONS: APPROVE ==========

  openApproveModal(): void {
    this.approveNote.set('');
    this.showApproveModal.set(true);
  }

  closeApproveModal(): void {
    this.showApproveModal.set(false);
  }

  confirmApprove(): void {
    const order = this.order();
    if (!order) return;

    this.isApproving.set(true);
    this.orderService.updateOrderStatus(order.id, OrderStatus.APPROVED, this.approveNote() || undefined).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.isApproving.set(false);
        this.closeApproveModal();
      },
      error: () => this.isApproving.set(false),
    });
  }

  // ========== ACTIONS: CANCEL ORDER (from pending) ==========

  openCancelOrderModal(): void {
    this.cancelReason.set('');
    this.showCancelOrderModal.set(true);
  }

  closeCancelOrderModal(): void {
    this.showCancelOrderModal.set(false);
  }

  confirmCancelOrder(): void {
    const order = this.order();
    if (!order) return;

    this.isCancelling.set(true);
    const note = this.cancelReason().trim() || 'Orden cancelada por administrador';
    this.orderService.updateOrderStatus(order.id, OrderStatus.CANCELLED, note).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.isCancelling.set(false);
        this.closeCancelOrderModal();
      },
      error: () => this.isCancelling.set(false),
    });
  }

  // ========== ACTIONS: OPTIONS MENU ==========

  toggleOptionsMenu(): void {
    this.showOptionsMenu.update((v) => !v);
  }

  closeOptionsMenu(): void {
    this.showOptionsMenu.set(false);
  }

  selectOptionsStatus(status: OrderStatus): void {
    this.selectedMenuStatus.set(status);
    this.optionsStatusNote.set('');
    this.showOptionsMenu.set(false);
    this.showOptionsStatusModal.set(true);
  }

  closeOptionsStatusModal(): void {
    this.showOptionsStatusModal.set(false);
    this.selectedMenuStatus.set(null);
  }

  confirmOptionsStatusChange(): void {
    const order = this.order();
    const status = this.selectedMenuStatus();
    if (!order || !status) return;

    this.isChangingFromOptions.set(true);
    this.orderService.forceOrderStatus(order.id, status, this.optionsStatusNote() || undefined).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.isChangingFromOptions.set(false);
        this.closeOptionsStatusModal();
      },
      error: () => this.isChangingFromOptions.set(false),
    });
  }

  // ========== ACTIONS: CANCELLATION REQUEST ==========

  openApproveCancellationModal(): void {
    this.cancellationActionNote.set('');
    this.showApproveCancellationModal.set(true);
  }

  openRejectCancellationModal(): void {
    this.cancellationActionNote.set('');
    this.showRejectCancellationModal.set(true);
  }

  closeApproveCancellationModal(): void {
    this.showApproveCancellationModal.set(false);
  }

  closeRejectCancellationModal(): void {
    this.showRejectCancellationModal.set(false);
  }

  confirmApproveCancellation(): void {
    const order = this.order();
    if (!order) return;

    this.isHandlingCancellation.set(true);
    const note = this.cancellationActionNote().trim() || 'Cancelacion aprobada por administrador';
    this.orderService.updateOrderStatus(order.id, OrderStatus.CANCELLED, note).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.isHandlingCancellation.set(false);
        this.closeApproveCancellationModal();
      },
      error: () => this.isHandlingCancellation.set(false),
    });
  }

  confirmRejectCancellation(): void {
    const order = this.order();
    if (!order) return;

    this.isHandlingCancellation.set(true);
    const note = this.cancellationActionNote().trim() || 'Solicitud de cancelacion rechazada';
    this.orderService.updateOrderStatus(order.id, OrderStatus.PENDING, note).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.isHandlingCancellation.set(false);
        this.closeRejectCancellationModal();
      },
      error: () => this.isHandlingCancellation.set(false),
    });
  }

  // ========== ACTIONS: DISPATCH STATUS ==========

  onDispatchStatusSelect(status: DispatchStatus): void {
    this.pendingDispatchStatus.set(status);
    this.dispatchNote.set('');
    this.showDispatchModal.set(true);
  }

  closeDispatchModal(): void {
    this.showDispatchModal.set(false);
    this.pendingDispatchStatus.set(null);
  }

  confirmDispatchChange(): void {
    const order = this.order();
    const status = this.pendingDispatchStatus();
    if (!order || !status) return;

    this.isUpdatingDispatch.set(true);
    this.orderService.updateDispatchStatus(order.id, status, this.dispatchNote() || undefined).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.isUpdatingDispatch.set(false);
        this.closeDispatchModal();
      },
      error: () => this.isUpdatingDispatch.set(false),
    });
  }

  // ========== MECHANIC DISPATCH MODAL ==========

  openMechanicDispatchModal(): void {
    this.dispatchModalOpen.set(true);
  }

  closeMechanicDispatchModal(): void {
    this.dispatchModalOpen.set(false);
  }

  onMechanicAssigned(updatedOrder: Order): void {
    this.order.set(updatedOrder);
    this.loadServiceTracking(updatedOrder.id);
  }

  onServiceRescheduled(): void {
    // Reload full order so the requested date card + modal reflect the change
    const id = this.order()?.id;
    if (id) this.loadOrder(id);
  }

  onCommentsUpdated(updatedOrder: Order): void {
    this.order.set(updatedOrder);
  }

  // ========== COPY REFERENCE NUMBER ==========

  protected readonly referenceCopied = signal(false);
  private referenceCopyTimeout: ReturnType<typeof setTimeout> | null = null;

  async copyReference(): Promise<void> {
    const ref = this.order()?.paymentSubmission?.referenceNumber;
    if (!ref) return;
    const ok = await this.clipboard.write(ref);
    if (!ok) return;
    this.referenceCopied.set(true);
    if (this.referenceCopyTimeout) clearTimeout(this.referenceCopyTimeout);
    this.referenceCopyTimeout = setTimeout(() => this.referenceCopied.set(false), 1500);
  }

  // ========== NOTES ==========

  startEditingNotes(): void {
    const order = this.order();
    this.editNotesValue.set(order?.notes || '');
    this.isEditingNotes.set(true);
  }

  cancelEditingNotes(): void {
    this.isEditingNotes.set(false);
  }

  saveNotes(): void {
    const order = this.order();
    if (!order) return;

    this.isSavingNotes.set(true);
    this.orderService.updateNotes(order.id, this.editNotesValue()).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.isSavingNotes.set(false);
        this.isEditingNotes.set(false);
      },
      error: () => this.isSavingNotes.set(false),
    });
  }

  // ========== NAVIGATION ==========

  goBack(): void {
    this.router.navigate(['/admin/orders']);
  }
}
