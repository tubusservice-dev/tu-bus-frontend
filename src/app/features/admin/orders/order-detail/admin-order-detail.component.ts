import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OrderService } from '../../../../core/services/order.service';
import {
  Order,
  OrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  isOilChangeService,
  getAvailableStatuses,
} from '../../../../models/order.model';
import { PAYMENT_METHOD_TYPE_LABELS, PaymentMethodType } from '../../../../models/payment-method.model';
import { OrderDispatchModalComponent } from '../order-dispatch-modal/order-dispatch-modal.component';

@Component({
  selector: 'app-admin-order-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, OrderDispatchModalComponent],
  templateUrl: './admin-order-detail.component.html',
  styleUrl: './admin-order-detail.component.scss',
})
export class AdminOrderDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orderService = inject(OrderService);

  protected readonly isLoading = signal(true);
  protected readonly order = signal<Order | null>(null);
  protected readonly error = signal<string | null>(null);

  // Status change
  protected readonly showStatusModal = signal(false);
  protected readonly newStatus = signal<string>('');
  protected readonly statusNote = signal('');
  protected readonly isChangingStatus = signal(false);

  // Cancel modal (oil change)
  protected readonly showCancelModal = signal(false);
  protected readonly cancelNote = signal('');

  // Dispatch modal
  protected readonly dispatchModalOpen = signal(false);
  protected readonly proofPreview = signal<string | null>(null);

  // Notes editing
  protected readonly isEditingNotes = signal(false);
  protected readonly editNotesValue = signal('');
  protected readonly isSavingNotes = signal(false);

  protected readonly orderStatuses = Object.values(OrderStatus);
  protected readonly ORDER_STATUS_LABELS = ORDER_STATUS_LABELS;

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
      },
      error: () => {
        this.error.set('No se pudo cargar la orden');
        this.isLoading.set(false);
      },
    });
  }

  // ========== Helpers ==========

  getClientName(order: Order): string {
    if (typeof order.user === 'object' && order.user) {
      const name = `${order.user.firstName || ''} ${order.user.lastName || ''}`.trim();
      return name || order.user.email || '-';
    }
    return String(order.user || '-');
  }

  getClientEmail(order: Order): string {
    if (typeof order.user === 'object' && order.user) {
      return order.user.email;
    }
    return '';
  }

  getStatusLabel(status: OrderStatus): string {
    return ORDER_STATUS_LABELS[status] || status;
  }

  getStatusColor(status: OrderStatus): string {
    return ORDER_STATUS_COLORS[status] || '';
  }

  getDispatchLabel(type: string): string {
    const labels: Record<string, string> = {
      store_pickup: 'Retiro en Tienda',
      shipping_agency: 'Agencia de Envío',
      local_delivery: 'Delivery Local',
      seller_agreement: 'Acordar con Vendedor',
      oil_change_service: 'Cambio de Aceite a Domicilio',
      in_store_oil_change: 'Cambio de Aceite en Tienda',
    };
    return labels[type] || type;
  }

  isOilChange(): boolean {
    const o = this.order();
    return o ? isOilChangeService(o) : false;
  }

  isMechanicAssigned(): boolean {
    const o = this.order();
    if (!o) return false;
    const mechanicStatuses: string[] = [
      OrderStatus.MECHANIC_ASSIGNED,
      OrderStatus.EN_ROUTE,
      OrderStatus.IN_SERVICE,
      OrderStatus.COMPLETED,
    ];
    return mechanicStatuses.includes(o.status);
  }

  availableStatuses(): OrderStatus[] {
    const o = this.order();
    if (!o) return [];
    return getAvailableStatuses(o.dispatchType, o.status);
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

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getVehicleInfo(order: Order): string {
    const vehicles = order.vehicles?.length ? order.vehicles : (order.vehicle ? [order.vehicle] : []);
    if (!vehicles.length) return '-';
    return vehicles.map(v => {
      if (typeof v === 'object') return `${v.marca} ${v.modelo} ${v.year} - ${v.placa}`;
      return String(v);
    }).join(' | ');
  }

  // ========== Actions ==========

  openDispatchModal(): void {
    this.dispatchModalOpen.set(true);
  }

  closeDispatchModal(): void {
    this.dispatchModalOpen.set(false);
  }

  onMechanicAssigned(updatedOrder: Order): void {
    this.order.set(updatedOrder);
  }

  // ========== Dispatch Status ==========

  // ========== Notes Editing ==========

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

  getBillingSourceLabel(source?: string): string {
    const labels: Record<string, string> = {
      shipping: 'Dirección de envío',
      profile: 'Dirección del perfil',
      custom: 'Dirección personalizada',
    };
    return labels[source || ''] || source || '-';
  }

  openCancelModal(): void {
    this.cancelNote.set('');
    this.showCancelModal.set(true);
  }

  closeCancelModal(): void {
    this.showCancelModal.set(false);
  }

  confirmCancelOrder(): void {
    const order = this.order();
    if (!order) return;

    this.isChangingStatus.set(true);
    const note = this.cancelNote().trim() || 'Orden cancelada por administrador';
    this.orderService.updateOrderStatus(order.id, OrderStatus.CANCELLED, note).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.isChangingStatus.set(false);
        this.closeCancelModal();
      },
      error: () => {
        this.isChangingStatus.set(false);
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/admin/orders']);
  }

  openStatusModal(): void {
    const order = this.order();
    if (!order) return;
    const available = this.availableStatuses();
    this.newStatus.set(available.length > 0 ? available[0] : order.status);
    this.statusNote.set('');
    this.showStatusModal.set(true);
  }

  closeStatusModal(): void {
    this.showStatusModal.set(false);
  }

  confirmStatusChange(): void {
    const order = this.order();
    if (!order || !this.newStatus()) return;

    this.isChangingStatus.set(true);
    this.orderService.updateOrderStatus(order.id, this.newStatus() as OrderStatus, this.statusNote() || undefined).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.isChangingStatus.set(false);
        this.closeStatusModal();
      },
      error: () => {
        this.isChangingStatus.set(false);
      },
    });
  }
}
