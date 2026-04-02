import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderService } from '../../../core/services/order.service';
import { UploadService } from '../../../core/services/upload.service';
import {
  Order, OrderStatus, PaymentSubmission,
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
  private readonly uploadService = inject(UploadService);

  // Order data
  protected readonly order = signal<Order | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);

  // Labels
  protected readonly statusLabels = ORDER_STATUS_LABELS;
  protected readonly statusColors = ORDER_STATUS_COLORS;
  protected readonly dispatchStatusLabels = DISPATCH_STATUS_LABELS;
  protected readonly dispatchStatusColors = DISPATCH_STATUS_COLORS;

  // Cancel modal
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

  protected readonly canEditPayment = computed(() => {
    const o = this.order();
    if (!o) return false;
    return o.status === 'pending' || o.status === 'confirmed';
  });

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

  // ==================== CANCEL ORDER ====================

  openCancelModal(): void {
    this.showCancelModal.set(true);
  }

  closeCancelModal(): void {
    this.showCancelModal.set(false);
  }

  confirmCancelOrder(): void {
    const o = this.order();
    if (!o) return;

    this.isCancelling.set(true);
    this.orderService.cancelOrder(o.id).subscribe({
      next: () => {
        this.isCancelling.set(false);
        this.showCancelModal.set(false);
        this.goBack();
      },
      error: () => {
        this.isCancelling.set(false);
      },
    });
  }

  // ==================== PAYMENT EDIT ====================

  startEditingPayment(): void {
    const o = this.order();
    if (!o) return;

    const ps = o.paymentSubmission;
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
    const o = this.order();
    if (!o || !o.paymentSubmission) return;

    this.isSavingPayment.set(true);
    this.paymentEditError.set(null);

    const updated: PaymentSubmission = {
      ...o.paymentSubmission,
      referenceNumber: this.editReferenceNumber().trim() || undefined,
      sourceBank: this.editSourceBank().trim() || undefined,
      amount: parseFloat(this.editAmount()) || undefined,
      paymentDate: this.editPaymentDate() || undefined,
    };

    if (this.editProofFile) {
      this.uploadService.uploadImage(this.editProofFile, 'payment-proofs').subscribe({
        next: (uploadRes) => {
          updated.proofUrl = uploadRes.data.url;
          updated.proofPublicId = uploadRes.data.publicId;
          this.sendPaymentUpdate(o.id, updated);
        },
        error: () => {
          this.isSavingPayment.set(false);
          this.paymentEditError.set('Error al subir el comprobante');
        },
      });
    } else {
      this.sendPaymentUpdate(o.id, updated);
    }
  }

  private sendPaymentUpdate(orderId: string, updated: PaymentSubmission): void {
    this.orderService.updatePayment(orderId, updated).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.isEditingPayment.set(false);
        this.isSavingPayment.set(false);
        this.paymentEditSuccess.set('Pago actualizado correctamente');
        setTimeout(() => this.paymentEditSuccess.set(null), 3000);
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
}
