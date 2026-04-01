import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { OrderService } from '../../../core/services/order.service';
import { UploadService } from '../../../core/services/upload.service';
import {
  Order, OrderStatus, PaymentSubmission,
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS,
  DISPATCH_STATUS_LABELS, DISPATCH_STATUS_COLORS,
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
  private readonly uploadService = inject(UploadService);

  protected readonly selectedOrder = signal<Order | null>(null);
  protected readonly isLoadingDetail = signal(false);
  protected readonly statusLabels = ORDER_STATUS_LABELS;
  protected readonly statusColors = ORDER_STATUS_COLORS;
  protected readonly dispatchStatusLabels = DISPATCH_STATUS_LABELS;
  protected readonly dispatchStatusColors = DISPATCH_STATUS_COLORS;

  // Pagination
  protected readonly currentPage = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly totalItems = signal(0);

  // Filters
  protected readonly statusFilter = signal<OrderStatus | ''>('');
  protected readonly searchQuery = signal('');
  private searchTimeout: any = null;

  // Cancel order modal
  protected readonly showCancelModal = signal(false);
  protected readonly isCancelling = signal(false);

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

  protected readonly filterStatuses = [
    { value: '', label: 'Todas' },
    { value: OrderStatus.PENDING, label: 'Pendientes' },
    { value: OrderStatus.CONFIRMED, label: 'Confirmadas' },
    { value: OrderStatus.PROCESSING, label: 'En Proceso' },
    { value: OrderStatus.SHIPPED, label: 'Enviadas' },
    { value: OrderStatus.COMPLETED, label: 'Completadas' },
    { value: OrderStatus.CANCELLED, label: 'Canceladas' },
  ];

  ngOnInit(): void {
    this.loadOrders();
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
      },
    });
  }

  onStatusFilterChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.statusFilter.set(value as OrderStatus | '');
    this.loadOrders(1);
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery.set(value);
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.loadOrders(1), 300);
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
      shipping_agency: 'Envio por Agencia',
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

  // ==================== ORDER DETAIL ====================

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

  openCancelModal(): void {
    this.showCancelModal.set(true);
  }

  closeCancelModal(): void {
    this.showCancelModal.set(false);
  }

  confirmCancelOrder(): void {
    const order = this.selectedOrder();
    if (!order) return;

    this.isCancelling.set(true);
    this.orderService.cancelOrder(order.id).subscribe({
      next: () => {
        this.isCancelling.set(false);
        this.showCancelModal.set(false);
        this.closeDetail();
        this.loadOrders(this.currentPage());
      },
      error: () => {
        this.isCancelling.set(false);
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

    // Upload proof file if selected, then save payment
    if (this.editProofFile) {
      this.uploadService.uploadImage(this.editProofFile, 'payment-proofs').subscribe({
        next: (uploadRes) => {
          updated.proofUrl = uploadRes.data.url;
          updated.proofPublicId = uploadRes.data.publicId;
          this.sendPaymentUpdate(order.id, updated);
        },
        error: () => {
          this.isSavingPayment.set(false);
          this.paymentEditError.set('Error al subir el comprobante');
        },
      });
    } else {
      this.sendPaymentUpdate(order.id, updated);
    }
  }

  private sendPaymentUpdate(orderId: string, updated: PaymentSubmission): void {
    this.orderService.updatePayment(orderId, updated).subscribe({
      next: (res) => {
        this.selectedOrder.set(res.data);
        this.isEditingPayment.set(false);
        this.isSavingPayment.set(false);
        this.paymentEditSuccess.set('Pago actualizado correctamente');
        setTimeout(() => this.paymentEditSuccess.set(null), 3000);
        this.loadOrders(this.currentPage());
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

  // ==================== FORMAT HELPERS ====================

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
