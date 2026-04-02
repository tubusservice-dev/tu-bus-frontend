import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { ExchangeRateService } from '../../../core/services/exchange-rate.service';
import {
  Order, OrderStatus,
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS,
  DISPATCH_STATUS_LABELS, DISPATCH_STATUS_COLORS,
} from '../../../models/order.model';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.scss',
})
export class OrderDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orderService = inject(OrderService);
  protected readonly exchangeRateService = inject(ExchangeRateService);

  // Order data
  protected readonly order = signal<Order | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);

  // Labels
  protected readonly statusLabels = ORDER_STATUS_LABELS;
  protected readonly statusColors = ORDER_STATUS_COLORS;
  protected readonly dispatchStatusLabels = DISPATCH_STATUS_LABELS;
  protected readonly dispatchStatusColors = DISPATCH_STATUS_COLORS;

  // Cancel flow (2-step: reason → confirm)
  protected readonly showReasonModal = signal(false);
  protected readonly showConfirmModal = signal(false);
  protected readonly cancelReason = signal('');
  protected readonly isCancelling = signal(false);

  // Payment detail expanded
  protected readonly isPaymentExpanded = signal(false);

  // Payment note
  protected readonly paymentNote = signal('');
  protected readonly isSavingNote = signal(false);
  protected readonly noteSuccess = signal<string | null>(null);
  protected readonly noteError = signal<string | null>(null);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('ID de orden no proporcionado');
      this.isLoading.set(false);
      return;
    }
    this.loadOrder(id);
  }

  // ==================== DATA LOADING ====================

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

  // ==================== NAVIGATION ====================

  goBack(): void {
    this.router.navigate(['/perfil'], { fragment: 'pedidos' });
  }

  // ==================== LABELS & HELPERS ====================

  getStatusLabel(status: OrderStatus | string): string {
    return this.statusLabels[status as OrderStatus] || status;
  }

  getStatusClass(status: OrderStatus | string): string {
    return this.statusColors[status as OrderStatus] || '';
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

  getDispatchStatusLabel(status: string): string {
    return this.dispatchStatusLabels[status] || status;
  }

  getDispatchStatusClass(status: string): string {
    return this.dispatchStatusColors[status] || '';
  }

  getBillingSourceLabel(source: string): string {
    const labels: Record<string, string> = {
      shipping: 'Dirección de envío',
      profile: 'Dirección del perfil',
      custom: 'Dirección personalizada',
    };
    return labels[source] || source;
  }

  formatDate(date: string): string {
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

  getVehicleLabel(vehicle: any): string {
    if (!vehicle) return '';
    if (typeof vehicle === 'string') return vehicle;
    return `${vehicle.marca} ${vehicle.modelo} ${vehicle.year} - ${vehicle.placa}`;
  }

  // ==================== CANCEL ORDER (2-STEP) ====================

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

  // ==================== PAYMENT DETAIL ====================

  togglePaymentDetail(): void {
    this.isPaymentExpanded.update((v) => !v);
  }

  // ==================== PAYMENT NOTE ====================

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
}
