import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { OrderService } from '../../../core/services/order.service';
import {
  Order, OrderStatus, PaymentSubmission,
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS,
  DISPATCH_STATUS_LABELS,
} from '../../../models/order.model';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './order-list.component.html',
  styleUrl: './order-list.component.scss',
})
export class OrderListComponent implements OnInit {
  protected readonly orderService = inject(OrderService);
  protected readonly selectedOrder = signal<Order | null>(null);
  protected readonly isLoadingDetail = signal(false);
  protected readonly statusLabels = ORDER_STATUS_LABELS;
  protected readonly statusColors = ORDER_STATUS_COLORS;
  protected readonly dispatchStatusLabels = DISPATCH_STATUS_LABELS;

  // Payment edit state
  protected readonly isEditingPayment = signal(false);
  protected readonly isSavingPayment = signal(false);
  protected readonly paymentEditError = signal<string | null>(null);
  protected readonly paymentEditSuccess = signal<string | null>(null);

  // Payment form fields
  protected readonly editReferenceNumber = signal('');
  protected readonly editSourceBank = signal('');
  protected readonly editAmount = signal('');
  protected readonly editPaymentDate = signal('');
  protected readonly editProofPreview = signal<string | null>(null);
  private editProofFile: File | null = null;

  protected readonly venezuelanBanks: string[] = [
    'Banco de Venezuela (BDV)', 'Banco Nacional de Crédito (BNC)',
    'Banco Mercantil', 'Banco Provincial (BBVA)', 'Banesco',
    'Banco del Tesoro', 'Banco Bicentenario', 'Banco Exterior',
    'Banco Caroní', 'Banco Venezolano de Crédito', 'Banco Plaza',
    'Banco Fondo Común (BFC)', 'Banco Sofitasa', 'Bancaribe',
    'Banco Activo', 'Bancrecer', 'Mi Banco',
    'Banco Agrícola de Venezuela', 'Banplus',
    'Banco Internacional de Desarrollo', 'Bancamiga',
    'BANFANB', '100% Banco', 'Bangente',
  ];

  ngOnInit(): void {
    this.orderService.getMyOrders().subscribe();
  }

  getStatusLabel(status: OrderStatus | string): string {
    return this.statusLabels[status as OrderStatus] || status;
  }

  getStatusClass(status: OrderStatus | string): string {
    return this.statusColors[status as OrderStatus] || '';
  }

  getDispatchLabel(type: string): string {
    const labels: Record<string, string> = {
      store_pickup: 'Retiro en Tienda',
      shipping_agency: 'Envio por Agencia',
      local_delivery: 'Delivery Local',
      seller_agreement: 'Acordar con Vendedor',
      oil_change_service: 'Cambio de Aceite a Domicilio',
      in_store_oil_change: 'Cambio de Aceite en Tienda',
    };
    return labels[type] || type;
  }

  viewDetail(order: Order): void {
    this.isLoadingDetail.set(true);
    this.selectedOrder.set(order);
    this.resetPaymentEdit();
    document.body.style.overflow = 'hidden';

    this.orderService.getOrderById(order.id).subscribe({
      next: (res) => {
        this.selectedOrder.set(res.data);
        this.isLoadingDetail.set(false);
      },
      error: () => this.isLoadingDetail.set(false),
    });
  }

  closeDetail(): void {
    this.selectedOrder.set(null);
    this.resetPaymentEdit();
    document.body.style.overflow = '';
  }

  cancelOrder(order: Order): void {
    if (!confirm(`Cancelar la orden ${order.orderNumber}?`)) return;

    this.orderService.cancelOrder(order.id).subscribe({
      next: () => {
        this.closeDetail();
        this.orderService.getMyOrders().subscribe();
      },
    });
  }

  // ==================== PAYMENT EDIT ====================

  get canEditPayment(): boolean {
    const order = this.selectedOrder();
    if (!order) return false;
    return order.status === 'pending' || order.status === 'confirmed';
  }

  startEditingPayment(): void {
    const order = this.selectedOrder();
    if (!order) return;

    const ps = order.paymentSubmission;
    this.editReferenceNumber.set(ps?.referenceNumber || '');
    this.editSourceBank.set(ps?.sourceBank || '');
    this.editAmount.set(ps?.amount?.toString() || '');
    this.editPaymentDate.set(ps?.paymentDate || '');
    this.paymentEditError.set(null);
    this.paymentEditSuccess.set(null);
    this.isEditingPayment.set(true);
  }

  cancelEditingPayment(): void {
    this.isEditingPayment.set(false);
    this.paymentEditError.set(null);
  }

  onPaymentFieldChange(field: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    switch (field) {
      case 'referenceNumber': this.editReferenceNumber.set(value); break;
      case 'sourceBank': this.editSourceBank.set(value); break;
      case 'amount': this.editAmount.set(value); break;
      case 'paymentDate': this.editPaymentDate.set(value); break;
    }
  }

  savePayment(): void {
    const order = this.selectedOrder();
    if (!order || !order.paymentSubmission) return;

    this.isSavingPayment.set(true);
    this.paymentEditError.set(null);

    const updated: PaymentSubmission = {
      ...order.paymentSubmission,
      referenceNumber: this.editReferenceNumber().trim() || undefined,
      sourceBank: this.editSourceBank().trim() || undefined,
      amount: parseFloat(this.editAmount()) || undefined,
      paymentDate: this.editPaymentDate() || undefined,
    };

    this.orderService.updatePayment(order.id, updated).subscribe({
      next: (res) => {
        this.selectedOrder.set(res.data);
        this.isEditingPayment.set(false);
        this.isSavingPayment.set(false);
        this.paymentEditSuccess.set('Pago actualizado correctamente');
        setTimeout(() => this.paymentEditSuccess.set(null), 3000);
        // Refresh list
        this.orderService.getMyOrders().subscribe();
      },
      error: (err) => {
        this.isSavingPayment.set(false);
        this.paymentEditError.set(err.error?.message || 'Error al actualizar el pago');
      },
    });
  }

  onProofFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.editProofFile = file;
      const reader = new FileReader();
      reader.onload = () => this.editProofPreview.set(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  removeProofFile(): void {
    this.editProofFile = null;
    this.editProofPreview.set(null);
  }

  private resetPaymentEdit(): void {
    this.isEditingPayment.set(false);
    this.isSavingPayment.set(false);
    this.paymentEditError.set(null);
    this.paymentEditSuccess.set(null);
    this.editProofFile = null;
    this.editProofPreview.set(null);
  }

  // ==================== HELPERS ====================

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
}
