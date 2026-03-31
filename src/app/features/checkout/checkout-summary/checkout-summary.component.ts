import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { CheckoutService } from '../services/checkout.service';
import { CartService } from '../../../core/services/cart.service';
import { OrderService } from '../../../core/services/order.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { LocationService, BranchSummary } from '../../../core/services/location.service';
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
  protected readonly locationService = inject(LocationService);
  private readonly router = inject(Router);

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

  // ========== Branch Selection ==========

  /** Whether branch selection is needed for this dispatch type */
  protected readonly needsBranchSelection = computed(() => {
    const dt = this.checkoutService.dispatchType();
    return dt === 'store_pickup' || dt === 'in_store_oil_change';
  });

  /** Branches available for selection based on dispatch type */
  protected readonly availableBranches = computed<BranchSummary[]>(() => {
    const dt = this.checkoutService.dispatchType();
    if (dt === 'store_pickup') return this.locationService.branches();
    if (dt === 'in_store_oil_change') return this.locationService.branchesWithOilChange();
    return [];
  });

  /** Whether a vehicle is required for this dispatch type */
  protected readonly needsVehicle = computed(() => {
    const dt = this.checkoutService.dispatchType();
    return dt === 'oil_change_service' || dt === 'in_store_oil_change';
  });

  // Can generate order: disclaimer accepted AND payment submitted AND required selections made
  protected readonly canGenerateOrder = computed(() => {
    if (!this.disclaimerAccepted() || !this.paymentSubmitted()) return false;
    if (this.needsBranchSelection() && !this.checkoutService.hasBranch()) return false;
    if (this.needsVehicle() && !this.checkoutService.hasVehicle()) return false;
    return true;
  });

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

    // Auto-select branch if only one available
    if (this.needsBranchSelection()) {
      const branches = this.availableBranches();
      if (branches.length === 1 && !this.checkoutService.selectedBranch()) {
        this.checkoutService.selectBranch(branches[0]);
      }
    }
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
    const dc = this.locationService.deliveryConfig();
    if (!dc) return null;
    return {
      freeDelivery: dc.freeDelivery,
      additionalCharge: !dc.freeDelivery && dc.deliveryCharge > 0,
      additionalChargeAmount: dc.deliveryCharge,
    };
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

  // ========== Branch Selection ==========

  selectBranch(branch: BranchSummary): void {
    this.checkoutService.selectBranch(branch);
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
    const selectedVehicle = this.checkoutService.selectedVehicle();
    const selectedBranch = this.checkoutService.selectedBranch();

    // Build dispatch details based on type
    const dispatchDetails: any = {};

    // Branch info for pickup/in-store types
    if (selectedBranch) {
      dispatchDetails.selectedBranchId = selectedBranch.id;
      dispatchDetails.selectedBranchName = selectedBranch.name;
      dispatchDetails.selectedBranchAddress = selectedBranch.address;
      dispatchDetails.storeAddress = selectedBranch.address;
    }

    // Store pickup fallback
    if (this.dispatchType === 'store_pickup' && !selectedBranch && store) {
      dispatchDetails.storeAddress = store.address;
      dispatchDetails.storeSchedule = store.schedule;
    }

    // Shipping agency + recipient
    if (this.dispatchType === 'shipping_agency') {
      if (agency) {
        dispatchDetails.agencyName = agency.name;
        dispatchDetails.agencyId = agency.id;
      }
      if (recipient) {
        dispatchDetails.recipientName = recipient.fullName;
        dispatchDetails.recipientDocument = `${recipient.documentType}-${recipient.documentNumber}`;
        dispatchDetails.recipientPhone = recipient.phone;
        dispatchDetails.recipientAddress = recipient.address;
        dispatchDetails.recipientState = recipient.state;
        dispatchDetails.recipientCity = recipient.city;
        dispatchDetails.agencyOfficeCode = recipient.agencyOfficeCode;
        dispatchDetails.referencePoint = recipient.referencePoint;
      }
    }

    // Local delivery
    if (this.dispatchType === 'local_delivery' && localDelivery) {
      dispatchDetails.recipientName = localDelivery.fullName;
      dispatchDetails.recipientDocument = `${localDelivery.documentType}-${localDelivery.documentNumber}`;
      dispatchDetails.recipientPhone = localDelivery.phone;
      dispatchDetails.recipientAddress = localDelivery.address;
      dispatchDetails.recipientCity = localDelivery.cityName;
      dispatchDetails.recipientMunicipality = localDelivery.municipalityName;
      dispatchDetails.referencePoint = localDelivery.referencePoint;
    }

    // Seller agreement
    if (this.dispatchType === 'seller_agreement' && sellerAgreement) {
      dispatchDetails.recipientName = sellerAgreement.fullName;
      dispatchDetails.recipientDocument = `${sellerAgreement.documentType}-${sellerAgreement.documentNumber}`;
      dispatchDetails.recipientPhone = sellerAgreement.phone;
    }

    // Oil change service (home)
    if (this.dispatchType === 'oil_change_service' && this.oilChangeServiceInfo) {
      dispatchDetails.recipientName = this.oilChangeServiceInfo.fullName;
      dispatchDetails.recipientDocument = `${this.oilChangeServiceInfo.documentType}-${this.oilChangeServiceInfo.documentNumber}`;
      dispatchDetails.recipientPhone = this.oilChangeServiceInfo.phone;
      dispatchDetails.recipientAddress = this.oilChangeServiceInfo.address;
      dispatchDetails.recipientCity = this.oilChangeServiceInfo.cityName;
      dispatchDetails.recipientMunicipality = this.oilChangeServiceInfo.municipalityName;
      dispatchDetails.referencePoint = this.oilChangeServiceInfo.referencePoint;
    }

    const orderData: CreateOrderRequest = {
      items,
      subtotal: this.cartService.subtotal(),
      shippingCost: this.shippingCost,
      total: this.total,
      dispatchType: this.dispatchType as any,
      paymentMethod: this.submittedPayment()?.methodType as any,
      disclaimerAccepted: this.disclaimerAccepted(),
      vehicle: selectedVehicle?.id,
      selectedBranch: selectedBranch?.id,
      billingAddress: this.checkoutService.billingAddress() || undefined,
      paymentSubmission: this.submittedPayment() || undefined,
      dispatchDetails,
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
    switch (dispatchType) {
      case 'shipping_agency':
        this.router.navigate(['/checkout/envio']);
        break;
      case 'local_delivery':
        this.router.navigate(['/checkout/delivery']);
        break;
      case 'seller_agreement':
      case 'store_pickup':
      case 'in_store_oil_change':
        this.router.navigate(['/checkout/despacho']);
        break;
      case 'oil_change_service':
        this.router.navigate(['/checkout/cambio-aceite']);
        break;
      default:
        this.router.navigate(['/checkout/despacho']);
    }
  }
}
