import { Component, DestroyRef, computed, inject, signal, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { ExchangeRateService } from '../../../core/services/exchange-rate.service';
import { UploadService } from '../../../core/services/upload.service';
import { ReviewService } from '../../../core/services/review.service';
import {
  Order, OrderStatus, DispatchStatus,
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, ORDER_STATUS_DESCRIPTIONS,
  DISPATCH_STATUS_LABELS, DISPATCH_STATUS_COLORS, DISPATCH_STATUS_DESCRIPTIONS,
  isShippingOrder, isOilChangeOrder,
  ServiceDateState, getServiceDateState, getServiceDateIso,
} from '../../../models/order.model';

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
import { PAYMENT_TYPES_WITH_FORM, PaymentMethodType } from '../../../models/payment-method.model';
import { MechanicAvatarComponent } from '../../../shared/components/mechanic-avatar/mechanic-avatar.component';
import { OrderCommentsComponent } from '../../../shared/components/order-comments/order-comments.component';
import { RatingModalComponent } from '../../../shared/components/rating-modal/rating-modal.component';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, RouterLink, MechanicAvatarComponent, OrderCommentsComponent, RatingModalComponent],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.scss',
})
export class OrderDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orderService = inject(OrderService);
  private readonly uploadService = inject(UploadService);
  private readonly reviewService = inject(ReviewService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly exchangeRateService = inject(ExchangeRateService);

  // ========== ESTADO PRINCIPAL ==========
  protected readonly order = signal<Order | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);

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

  // ========== POPOVERS DE TELÉFONO ==========
  protected readonly activePhonePopover = signal<string | null>(null);

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
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Error al cargar la orden');
        this.isLoading.set(false);
      },
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
    if (order.mechanicAssignment && typeof order.mechanicAssignment === 'object') return true;

    return false;
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

  mechanicAvatar(order: Order): string {
    const m = order.mechanic as any;
    if (m && typeof m === 'object' && m.avatar) return m.avatar;

    const a = order.mechanicAssignment as any;
    if (a && typeof a === 'object' && a.mechanic && typeof a.mechanic === 'object' && a.mechanic.avatar) {
      return a.mechanic.avatar;
    }

    return '';
  }

  // ============================================
  // POPOVERS DE TELÉFONO
  // ============================================
  togglePhonePopover(id: string): void {
    this.activePhonePopover.update((current) => (current === id ? null : id));
  }

  closePopovers(): void {
    this.activePhonePopover.set(null);
  }

  onCommentsUpdated(updatedOrder: Order): void {
    this.order.set(updatedOrder);
  }

  openWhatsApp(phone: string): void {
    if (!phone) return;
    const cleaned = phone.replace(/-/g, '').replace(/\s/g, '');
    const international = '58' + cleaned.replace(/^0/, '');
    window.open(`https://wa.me/${international}`, '_blank');
    this.activePhonePopover.set(null);
  }

  callPhone(phone: string): void {
    if (!phone) return;
    const cleaned = phone.replace(/-/g, '').replace(/\s/g, '');
    const international = '+58' + cleaned.replace(/^0/, '');
    window.open(`tel:${international}`, '_self');
    this.activePhonePopover.set(null);
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
    // Damos un tick a Angular para renderizar el header de impresión antes de abrir el diálogo
    setTimeout(() => window.print(), 50);
  }
}
