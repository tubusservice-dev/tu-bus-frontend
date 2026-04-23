import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../../core/services/order.service';
import { ExchangeRateService } from '../../../../core/services/exchange-rate.service';
import { ClipboardService } from '../../../../shared/services/clipboard.service';
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
  isInStoreOilChange,
  getAvailableDispatchStatuses,
  getOptionsMenuStatuses,
} from '../../../../models/order.model';
import { PAYMENT_METHOD_TYPE_LABELS, PaymentMethodType } from '../../../../models/payment-method.model';
import { MechanicAssignment, ProgressStep } from '../../../../models/mechanic-assignment.model';
import { OrderDispatchModalComponent } from '../order-dispatch-modal/order-dispatch-modal.component';
import { MechanicAvatarComponent } from '../../../../shared/components/mechanic-avatar/mechanic-avatar.component';
import { OrderCommentsComponent } from '../../../../shared/components/order-comments/order-comments.component';
import { ClickOutsideDirective } from '../../../../shared/directives/click-outside.directive';
import { MechanicAssignmentService } from '../../../../core/services/mechanic-assignment.service';

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

  // ========== IMAGE LIGHTBOX ==========
  protected readonly proofPreview = signal<string | null>(null);

  // ========== PHONE POPOVERS ==========
  protected readonly activePhonePopover = signal<string | null>(null);

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
   * requested service date. UTC-anchored to avoid off-by-one on ISO dates.
   */
  protected readonly requestedDateLabel = computed<string>(() => {
    const raw = this.order()?.requestedServiceDate;
    if (!raw) return '';
    try {
      const d = new Date(raw);
      return new Intl.DateTimeFormat('es-VE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(d);
    } catch {
      return String(raw);
    }
  });

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
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/admin/orders']);
      return;
    }
    this.loadOrder(id);
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

  // ========== PHONE POPOVERS ==========

  togglePhonePopover(id: string): void {
    this.activePhonePopover.update((current) => (current === id ? null : id));
  }

  closePhonePopovers(): void {
    this.activePhonePopover.set(null);
  }

  callPhone(phone: string): void {
    if (!phone) return;
    const cleaned = phone.replace(/-/g, '').replace(/\s/g, '');
    const international = '+58' + cleaned.replace(/^0/, '');
    window.open(`tel:${international}`, '_self');
    this.activePhonePopover.set(null);
  }

  openWhatsApp(phone: string): void {
    if (!phone) return;
    const cleaned = phone.replace(/-/g, '').replace(/\s/g, '');
    const international = '58' + cleaned.replace(/^0/, '');
    window.open(`https://wa.me/${international}`, '_blank');
    this.activePhonePopover.set(null);
  }

  // ========== NAVIGATION ==========

  goBack(): void {
    this.router.navigate(['/admin/orders']);
  }
}
