import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { CheckoutService } from '../services/checkout.service';
import { CartService } from '../../../core/services/cart.service';
import { OrderService } from '../../../core/services/order.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { ZoneService } from '../../../core/services/zone.service';
import { BranchService } from '../../../core/services/branch.service';
import { Branch, ServiceMunicipality } from '../../../models/branch.model';
import { PaymentMethodService } from '../../../core/services/payment-method.service';
import { CreateOrderRequest, PaymentSubmission } from '../../../models/order.model';
import {
  PaymentMethodConfig,
  PaymentMethodType,
  PaymentMethodGroup,
  PAYMENT_METHOD_TYPE_LABELS,
  PAYMENT_METHOD_ICON_CLASS,
  PAYMENT_TYPES_WITH_FORM,
  PAYMENT_TYPES_INFO_ONLY,
} from '../../../models/payment-method.model';

@Component({
  selector: 'app-checkout-summary',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './checkout-summary.component.html',
  styleUrl: './checkout-summary.component.scss',
})
export class CheckoutSummaryComponent implements OnInit {
  protected readonly checkoutService = inject(CheckoutService);
  protected readonly cartService = inject(CartService);
  private readonly orderService = inject(OrderService);
  private readonly vehicleService = inject(VehicleService);
  private readonly paymentMethodService = inject(PaymentMethodService);
  private readonly zoneService = inject(ZoneService);
  private readonly branchService = inject(BranchService);
  private readonly router = inject(Router);

  // Branches for delivery config
  private readonly activeBranches = signal<Branch[]>([]);

  // State signals
  protected readonly isGenerating = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly disclaimerAccepted = signal(false);
  protected readonly showConfirmModal = signal(false);
  protected readonly isProcessingConfirm = signal(false);

  // Payment methods from API
  protected readonly paymentMethods = signal<PaymentMethodConfig[]>([]);
  protected readonly loadingMethods = signal(true);

  // Payment method groups (grouped by type)
  protected readonly paymentGroups = computed<PaymentMethodGroup[]>(() => {
    const methods = this.paymentMethods();
    const groupMap = new Map<PaymentMethodType, PaymentMethodConfig[]>();

    for (const method of methods) {
      const existing = groupMap.get(method.type) || [];
      existing.push(method);
      groupMap.set(method.type, existing);
    }

    return Array.from(groupMap.entries()).map(([type, methods]) => ({
      type,
      label: PAYMENT_METHOD_TYPE_LABELS[type],
      methods,
    }));
  });

  // Modal state
  protected readonly showModal = signal(false);
  protected readonly selectedGroup = signal<PaymentMethodGroup | null>(null);
  protected readonly selectedMethodInModal = signal<PaymentMethodConfig | null>(null);

  // Lista de bancos de Venezuela
  protected readonly venezuelanBanks: string[] = [
    'Banco de Venezuela (BDV)',
    'Banco Nacional de Crédito (BNC)',
    'Banco Mercantil',
    'Banco Provincial (BBVA)',
    'Banesco',
    'Banco del Tesoro',
    'Banco Bicentenario',
    'Banco Exterior',
    'Banco Caroní',
    'Banco Venezolano de Crédito',
    'Banco Plaza',
    'Banco Fondo Común (BFC)',
    'Banco Sofitasa',
    'Banco del Caribe (Bancaribe)',
    'Banco Activo',
    'Bancrecer',
    'Mi Banco',
    'Banco Agrícola de Venezuela',
    'Banplus',
    'Banco Internacional de Desarrollo',
    'Bancamiga',
    'Banco de la Fuerza Armada Nacional Bolivariana (BANFANB)',
    '100% Banco',
    'Banco de la Gente Emprendedora (Bangente)',
  ];

  // Payment form state
  protected readonly formReferenceNumber = signal('');
  protected readonly formSourceBank = signal('');
  protected readonly formAmount = signal('');
  protected readonly formPaymentDate = signal('');
  protected readonly formProofFile = signal<File | null>(null);
  protected readonly formProofPreview = signal<string | null>(null);

  // Post-submission state
  protected readonly paymentSubmitted = signal(false);
  protected readonly submittedPayment = signal<PaymentSubmission | null>(null);
  protected readonly submittedMethodType = signal<PaymentMethodType | null>(null);

  // Can generate order: disclaimer accepted AND payment submitted
  protected readonly canGenerateOrder = computed(() =>
    this.disclaimerAccepted() && this.paymentSubmitted()
  );

  ngOnInit(): void {
    if (!this.checkoutService.hasDispatchType()) {
      this.router.navigate(['/checkout/despacho']);
      return;
    }

    const dispatchType = this.checkoutService.dispatchType();

    if (dispatchType === 'shipping_agency') {
      if (!this.checkoutService.hasShippingAgency()) {
        this.router.navigate(['/checkout/agencia']);
        return;
      }
      if (!this.checkoutService.hasShippingRecipientInfo()) {
        this.router.navigate(['/checkout/envio']);
        return;
      }
    }

    if (dispatchType === 'local_delivery') {
      if (!this.checkoutService.hasLocalDeliveryRecipientInfo()) {
        this.router.navigate(['/checkout/delivery']);
        return;
      }
    }

    if (dispatchType === 'seller_agreement') {
      if (!this.checkoutService.hasSellerAgreementInfo()) {
        this.router.navigate(['/checkout/vendedor']);
        return;
      }
    }

    if (dispatchType === 'oil_change_service') {
      if (!this.checkoutService.hasOilChangeServiceInfo()) {
        this.router.navigate(['/checkout/cambio-aceite']);
        return;
      }
    }

    if (this.cartService.isEmpty()) {
      this.router.navigate(['/carrito']);
      return;
    }

    // Load active payment methods from API
    this.loadPaymentMethods();

    // Load active branches for delivery config
    this.branchService.getActive().subscribe({
      next: (res) => this.activeBranches.set(res.data || []),
      error: () => this.activeBranches.set([]),
    });
  }

  private loadPaymentMethods(): void {
    this.loadingMethods.set(true);
    this.paymentMethodService.getActive().subscribe({
      next: (res) => {
        this.paymentMethods.set(res.data);
        this.loadingMethods.set(false);
      },
      error: () => {
        this.loadingMethods.set(false);
      },
    });
  }

  // ========== Getters ==========

  get selectedDispatch() {
    const type = this.checkoutService.dispatchType();
    return this.checkoutService.getDispatchOption(type);
  }

  get dispatchType() {
    return this.checkoutService.dispatchType();
  }

  get storeInfo() {
    return this.checkoutService.storeInfo();
  }

  get shippingAgency() {
    return this.checkoutService.selectedShippingAgency();
  }

  get recipientInfo() {
    return this.checkoutService.shippingRecipientInfo();
  }

  get localDeliveryInfo() {
    return this.checkoutService.localDeliveryRecipientInfo();
  }

  get sellerAgreementInfo() {
    return this.checkoutService.sellerAgreementInfo();
  }

  get oilChangeServiceInfo() {
    return this.checkoutService.oilChangeServiceInfo();
  }

  get shippingCostLabel(): string {
    if (this.dispatchType === 'shipping_agency') {
      return this.checkoutService.getShippingCostLabel();
    }
    if (this.dispatchType === 'local_delivery') {
      const deliveryConfig = this.getLocalDeliveryConfig();
      if (deliveryConfig?.additionalCharge) {
        return `+$${deliveryConfig.additionalChargeAmount.toFixed(2)}`;
      }
      return 'Delivery gratis';
    }
    return 'Gratis';
  }

  get shippingCost(): number {
    if (this.dispatchType === 'shipping_agency') {
      return this.checkoutService.getShippingCost() ?? 0;
    }
    if (this.dispatchType === 'local_delivery') {
      const deliveryConfig = this.getLocalDeliveryConfig();
      if (deliveryConfig?.additionalCharge) {
        return deliveryConfig.additionalChargeAmount;
      }
      return 0;
    }
    return 0;
  }

  private getLocalDeliveryConfig(): { freeDelivery: boolean; additionalCharge: boolean; additionalChargeAmount: number } | null {
    const localDelivery = this.localDeliveryInfo;
    if (!localDelivery) return null;

    // Search in active branches for the municipality's delivery config
    const branches = this.activeBranches();
    for (const branch of branches) {
      const sm = branch.serviceMunicipalities.find(
        m => m.municipalityCode === localDelivery.municipalityCode && m.hasDelivery
      );
      if (sm) {
        return {
          freeDelivery: sm.freeDelivery,
          additionalCharge: !sm.freeDelivery && sm.deliveryCharge > 0,
          additionalChargeAmount: sm.deliveryCharge,
        };
      }
    }

    // Default: free delivery if no branch config found
    return { freeDelivery: true, additionalCharge: false, additionalChargeAmount: 0 };
  }

  get isPayOnDelivery(): boolean {
    if (this.dispatchType === 'shipping_agency' && this.shippingAgency) {
      return this.shippingAgency.config.collectOnDelivery;
    }
    return false;
  }

  get total(): number {
    return this.cartService.subtotal() + this.shippingCost;
  }

  // ========== Payment Method Helpers ==========

  getIconClass(type: PaymentMethodType): string {
    return PAYMENT_METHOD_ICON_CLASS[type] || '';
  }

  getCurrencySymbol(type?: string): string {
    if (!type) return '$';
    if (type === 'pago_movil' || type === 'transferencia') return 'Bs';
    if (type === 'binance') return 'USDT';
    return '$';
  }

  formatPaymentAmount(amount?: number, type?: string): string {
    if (!amount) return '';
    const symbol = this.getCurrencySymbol(type);
    const formatted = amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${symbol} ${formatted}`;
  }

  isFormType(type: PaymentMethodType): boolean {
    return PAYMENT_TYPES_WITH_FORM.includes(type);
  }

  isInfoOnlyType(type: PaymentMethodType): boolean {
    return PAYMENT_TYPES_INFO_ONLY.includes(type);
  }

  // ========== Modal Actions ==========

  openPaymentModal(group: PaymentMethodGroup): void {
    if (this.paymentSubmitted()) return;
    this.selectedGroup.set(group);
    // Auto-select first method if only one
    if (group.methods.length === 1) {
      this.selectedMethodInModal.set(group.methods[0]);
    } else {
      this.selectedMethodInModal.set(null);
    }
    this.resetForm();
    this.showModal.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeModal(): void {
    this.showModal.set(false);
    this.selectedGroup.set(null);
    this.selectedMethodInModal.set(null);
    this.resetForm();
    document.body.style.overflow = '';
  }

  selectMethodInModal(method: PaymentMethodConfig): void {
    this.selectedMethodInModal.set(method);
  }

  private resetForm(): void {
    this.formReferenceNumber.set('');
    this.formSourceBank.set('');
    this.formAmount.set('');
    this.formPaymentDate.set('');
    this.formProofFile.set(null);
    this.formProofPreview.set(null);
  }

  onFormInput(field: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    switch (field) {
      case 'referenceNumber': this.formReferenceNumber.set(value); break;
      case 'sourceBank': this.formSourceBank.set(value); break;
      case 'amount': this.formAmount.set(value); break;
      case 'paymentDate': this.formPaymentDate.set(value); break;
    }
  }

  onProofFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.formProofFile.set(file);
      const reader = new FileReader();
      reader.onload = () => this.formProofPreview.set(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  removeProofFile(): void {
    this.formProofFile.set(null);
    this.formProofPreview.set(null);
  }

  isFormValid(): boolean {
    const group = this.selectedGroup();
    if (!group) return false;

    if (this.isInfoOnlyType(group.type)) {
      return true; // No form required
    }

    if (this.isFormType(group.type)) {
      return !!(
        this.formReferenceNumber().trim() &&
        this.formSourceBank().trim() &&
        this.formAmount().trim() &&
        this.formPaymentDate().trim()
      );
    }

    return false;
  }

  submitPayment(): void {
    const group = this.selectedGroup();
    const selectedMethod = this.selectedMethodInModal();
    if (!group) return;

    const submission: PaymentSubmission = {
      methodType: group.type,
      methodLabel: selectedMethod?.label || group.label,
      selectedMethodId: selectedMethod?.id,
    };

    if (this.isFormType(group.type)) {
      submission.referenceNumber = this.formReferenceNumber().trim();
      submission.sourceBank = this.formSourceBank().trim();
      submission.amount = parseFloat(this.formAmount()) || 0;
      submission.paymentDate = this.formPaymentDate();
    }

    // TODO: Upload proof file to cloud storage if needed
    // For now we store the submission data without the file

    this.submittedPayment.set(submission);
    this.submittedMethodType.set(group.type);
    this.paymentSubmitted.set(true);
    this.closeModal();
  }

  clearPaymentSubmission(): void {
    this.paymentSubmitted.set(false);
    this.submittedPayment.set(null);
    this.submittedMethodType.set(null);
  }

  // ========== Order Generation ==========

  onGenerateOrder(): void {
    if (!this.canGenerateOrder()) return;
    this.showConfirmModal.set(true);
  }

  onCancelOrder(): void {
    this.showConfirmModal.set(false);
  }

  onConfirmOrder(): void {
    if (this.isProcessingConfirm()) return;
    this.isProcessingConfirm.set(true);

    setTimeout(() => {
      this.isProcessingConfirm.set(false);
      this.showConfirmModal.set(false);
      this.isGenerating.set(true);
      this.errorMessage.set(null);
      this.executeOrder();
    }, 2000);
  }

  private executeOrder(): void {

    const items = this.cartService.items().map((item) => ({
      product: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      image: item.image,
    }));

    const recipient = this.recipientInfo;
    const localDelivery = this.localDeliveryInfo;
    const sellerAgreement = this.sellerAgreementInfo;
    const agency = this.shippingAgency;
    const store = this.storeInfo;
    const selectedVehicle = this.vehicleService.selectedVehicle();

    const orderData: CreateOrderRequest = {
      items,
      subtotal: this.cartService.subtotal(),
      shippingCost: this.shippingCost,
      total: this.total,
      dispatchType: this.dispatchType as any,
      paymentMethod: this.submittedPayment()?.methodType as any,
      disclaimerAccepted: this.disclaimerAccepted(),
      vehicle: selectedVehicle?.id,
      paymentSubmission: this.submittedPayment() || undefined,
      dispatchDetails: {
        ...(this.dispatchType === 'store_pickup' && store
          ? { storeAddress: store.address, storeSchedule: store.schedule }
          : {}),
        ...(this.dispatchType === 'shipping_agency' && agency
          ? { agencyName: agency.name, agencyId: agency.id }
          : {}),
        ...(this.dispatchType === 'shipping_agency' && recipient
          ? {
              recipientName: recipient.fullName,
              recipientDocument: `${recipient.documentType}-${recipient.documentNumber}`,
              recipientPhone: recipient.phone,
              recipientAddress: recipient.address,
              recipientState: recipient.state,
              recipientCity: recipient.city,
              agencyOfficeCode: recipient.agencyOfficeCode,
              referencePoint: recipient.referencePoint,
            }
          : {}),
        ...(this.dispatchType === 'local_delivery' && localDelivery
          ? {
              recipientName: localDelivery.fullName,
              recipientDocument: `${localDelivery.documentType}-${localDelivery.documentNumber}`,
              recipientPhone: localDelivery.phone,
              recipientAddress: localDelivery.address,
              recipientCity: localDelivery.cityName,
              recipientMunicipality: localDelivery.municipalityName,
              referencePoint: localDelivery.referencePoint,
            }
          : {}),
        ...(this.dispatchType === 'seller_agreement' && sellerAgreement
          ? {
              recipientName: sellerAgreement.fullName,
              recipientDocument: `${sellerAgreement.documentType}-${sellerAgreement.documentNumber}`,
              recipientPhone: sellerAgreement.phone,
            }
          : {}),
        ...(this.dispatchType === 'oil_change_service' && this.oilChangeServiceInfo
          ? {
              recipientName: this.oilChangeServiceInfo.fullName,
              recipientDocument: `${this.oilChangeServiceInfo.documentType}-${this.oilChangeServiceInfo.documentNumber}`,
              recipientPhone: this.oilChangeServiceInfo.phone,
              recipientAddress: this.oilChangeServiceInfo.address,
              recipientCity: this.oilChangeServiceInfo.cityName,
              recipientMunicipality: this.oilChangeServiceInfo.municipalityName,
              referencePoint: this.oilChangeServiceInfo.referencePoint,
            }
          : {}),
      },
    };

    this.orderService.createOrder(orderData).subscribe({
      next: (response) => {
        this.isGenerating.set(false);
        this.cartService.clearCart();
        this.checkoutService.resetCheckout();
        this.router.navigate(['/checkout/confirmacion', response.data.id]);
      },
      error: (err) => {
        this.isGenerating.set(false);
        this.errorMessage.set(err.error?.message || 'Error al procesar la orden');
      },
    });
  }

  onDisclaimerChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.disclaimerAccepted.set(checked);
    this.checkoutService.setDisclaimerAccepted(checked);
  }

  goBack(): void {
    const dispatchType = this.checkoutService.dispatchType();
    if (dispatchType === 'shipping_agency') {
      this.router.navigate(['/checkout/envio']);
    } else if (dispatchType === 'local_delivery') {
      this.router.navigate(['/checkout/delivery']);
    } else if (dispatchType === 'seller_agreement') {
      this.router.navigate(['/checkout/vendedor']);
    } else if (dispatchType === 'oil_change_service') {
      this.router.navigate(['/checkout/cambio-aceite']);
    } else {
      this.router.navigate(['/checkout/despacho']);
    }
  }
}
