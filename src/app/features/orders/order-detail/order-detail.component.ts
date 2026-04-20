import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { ExchangeRateService } from '../../../core/services/exchange-rate.service';
import {
  Order, OrderStatus,
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, ORDER_STATUS_DESCRIPTIONS,
} from '../../../models/order.model';
import { MechanicAvatarComponent } from '../../../shared/components/mechanic-avatar/mechanic-avatar.component';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, RouterLink, MechanicAvatarComponent],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.scss',
})
export class OrderDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orderService = inject(OrderService);
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

  // ========== COMENTARIO DE PAGO ==========
  protected readonly paymentNote = signal('');
  protected readonly isSavingNote = signal(false);
  protected readonly noteSuccess = signal<string | null>(null);
  protected readonly noteError = signal<string | null>(null);

  // ========== POPOVERS DE TELÉFONO ==========
  protected readonly activePhonePopover = signal<string | null>(null);

  // ========== IMPRESIÓN ==========
  protected printedAt = '';

  // ========== LABELS ==========
  protected readonly statusLabels = ORDER_STATUS_LABELS;
  protected readonly statusColors = ORDER_STATUS_COLORS;

  // ============================================
  // CICLO DE VIDA
  // ============================================
  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('ID de orden no proporcionado');
      this.isLoading.set(false);
      return;
    }
    this.loadOrder(id);
  }

  private loadOrder(id: string): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.orderService.getOrderById(id).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.paymentNote.set(res.data.paymentSubmission?.notes || '');
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Error al cargar la orden');
        this.isLoading.set(false);
      },
    });
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

    // Fuente 3: el status implica que hay un mecánico asignado
    const statusesWithMechanic = ['mechanic_assigned', 'en_route', 'in_service'];
    if (statusesWithMechanic.includes(order.status)) return true;

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
  // COMENTARIO DE PAGO
  // ============================================
  savePaymentNote(): void {
    const o = this.order();
    if (!o || !o.paymentSubmission) return;

    const note = this.paymentNote().trim();
    this.isSavingNote.set(true);
    this.noteError.set(null);

    const updated = { ...o.paymentSubmission, notes: note || undefined };

    this.orderService.updatePayment(o.id, updated).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.isSavingNote.set(false);
        this.noteSuccess.set('Comentario guardado');
        setTimeout(() => this.noteSuccess.set(null), 3000);
      },
      error: (err) => {
        this.isSavingNote.set(false);
        this.noteError.set(err.error?.message || 'Error al guardar el comentario');
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
