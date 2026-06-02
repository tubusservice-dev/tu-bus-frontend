import { Component, inject, signal, OnInit, OnDestroy, computed, effect } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe, CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { CheckoutService, RequestedServiceDate } from '../services/checkout.service';
import { CartService } from '@core/services/cart.service';
import { OrderService } from '@core/services/order.service';
import { LocationService, BranchSummary } from '@core/services/location.service';
import { ProductService } from '@core/services/product.service';
import { ExchangeRateService } from '@core/services/exchange-rate.service';
import { BranchAvailabilityService, AvailabilityMode } from '@core/services/branch-availability.service';
import { BranchAvailability } from '@models/branch-availability.model';
import { CreateOrderRequest, EngineModificationStatus } from '@models/order.model';
import { PaymentMethodGroup } from '@models/payment-method.model';
import { CopyableValueComponent } from '@shared/components/copyable-value/copyable-value.component';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';
import { ServiceDatePickerComponent } from '@shared/components/service-date-picker/service-date-picker.component';
import { BodyScrollLockService } from '@shared/services/body-scroll-lock.service';
import { CheckoutHeaderComponent } from '../components/checkout-header/checkout-header.component';
import { businessTodayIso } from '@shared/utils/business-date.util';
import { CheckoutPaymentUiService } from './services/checkout-payment-ui.service';
import { CheckoutBillingService } from './services/checkout-billing.service';
import { CheckoutBranchStockService } from './services/checkout-branch-stock.service';
import { ANALYTICS, AnalyticsEvent } from '@platform';

@Component({
  selector: 'app-checkout-summary',
  standalone: true,
  imports: [CurrencyPipe, CommonModule, ReactiveFormsModule, CopyableValueComponent, DateInputComponent, ServiceDatePickerComponent, CheckoutHeaderComponent],
  templateUrl: './checkout-summary.component.html',
  styleUrl: './checkout-summary.component.scss',
  providers: [CheckoutPaymentUiService, CheckoutBillingService, CheckoutBranchStockService],
})
export class CheckoutSummaryComponent implements OnInit, OnDestroy {
  // ── Core dependencies ───────────────────────────────────────────────────
  protected readonly checkoutService = inject(CheckoutService);
  protected readonly cartService = inject(CartService);
  private readonly orderService = inject(OrderService);
  protected readonly locationService = inject(LocationService);
  private readonly productService = inject(ProductService);
  private readonly router = inject(Router);
  protected readonly exchangeRateService = inject(ExchangeRateService);
  private readonly scrollLock = inject(BodyScrollLockService);
  private readonly branchAvailabilityService = inject(BranchAvailabilityService);
  private readonly analytics = inject(ANALYTICS);

  // ── Sub-services (per-component lifetime via providers above) ───────────
  private readonly paymentUi = inject(CheckoutPaymentUiService);
  private readonly billing = inject(CheckoutBillingService);
  private readonly branchStock = inject(CheckoutBranchStockService);

  // ──────────────────────────────────────────────────────────────────────
  // Branch availability loader
  //
  // Drives the `<app-service-date-picker>`. Both oil-change flows
  // (at-home and in-store) resolve availability from the union of the
  // branch's active mechanics — the mechanic's schedule is the authority,
  // even for in-store visits. When the branch has no mechanics assigned,
  // the backend transparently falls back to the storefront schedule so
  // the picker keeps working.
  // ──────────────────────────────────────────────────────────────────────
  protected readonly branchAvailability = signal<BranchAvailability | null>(null);
  private fetchedAvailabilityKey: string | null = null;

  private readonly oilChangeAvailabilityMode = (dt: string | null): AvailabilityMode | null => {
    if (dt === 'oil_change_service' || dt === 'in_store_oil_change') return 'mechanics';
    return null;
  };

  constructor() {
    // Branch-availability loader effect. Lives inside the constructor so it
    // registers in the component's injection context without leaving an
    // "unused field" reference behind (the return value of `effect()` is
    // never read — Angular auto-cleans it on destroy).
    effect(() => {
      const branch = this.checkoutService.selectedBranch();
      const dt = this.checkoutService.dispatchType();
      const mode = this.oilChangeAvailabilityMode(dt);
      if (!mode || !branch) {
        this.branchAvailability.set(null);
        this.fetchedAvailabilityKey = null;
        return;
      }
      const key = `${branch.id}:${mode}`;
      if (this.fetchedAvailabilityKey === key) return;
      this.fetchedAvailabilityKey = key;
      this.branchAvailabilityService.getByBranch(branch.id, mode).subscribe({
        next: (data) => this.branchAvailability.set(data),
        error: () => {
          // Permissive on error: leave null so the picker stays unrestricted
          // and the backend stays the single source of truth at submit time.
          this.branchAvailability.set(null);
          this.fetchedAvailabilityKey = null;
        },
      });
    });
  }

  // ── Scroll lock helpers (used only for the confirm-order modal; the
  //    payment modal has its own counter inside CheckoutPaymentUiService) ─
  private heldScrollLocks = 0;
  private confirmTimeoutId: ReturnType<typeof setTimeout> | null = null;

  ngOnDestroy(): void {
    if (this.confirmTimeoutId !== null) {
      clearTimeout(this.confirmTimeoutId);
      this.confirmTimeoutId = null;
    }
    while (this.heldScrollLocks > 0) {
      this.scrollLock.unlock();
      this.heldScrollLocks--;
    }
  }

  private acquireScrollLock(): void {
    this.scrollLock.lock();
    this.heldScrollLocks++;
  }

  private releaseScrollLock(): void {
    if (this.heldScrollLocks <= 0) return;
    this.scrollLock.unlock();
    this.heldScrollLocks--;
  }

  protected readonly todayStr = businessTodayIso();

  // ── Component-owned state ───────────────────────────────────────────────

  protected readonly isGenerating = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /**
   * Two mutually-exclusive disclaimer checkboxes. The user must tick exactly
   * one to generate the order; ticking both at once is a contradiction and
   * blocks submission with an inline warning.
   */
  protected readonly originalEngineChecked = signal(false);
  protected readonly modifiedEngineChecked = signal(false);

  /**
   * Whether the "modified engine" disclaimer is visible. Collapsed by default
   * so the common case (stock engine) stays uncluttered. Collapsing also
   * unchecks the underlying box — we never keep an invisible acknowledgment.
   */
  protected readonly isModifiedSectionExpanded = signal(false);
  protected readonly showConfirmModal = signal(false);
  protected readonly isProcessingConfirm = signal(false);

  /**
   * True when at least one combo product is in the cart. The engine/filter
   * disclaimer is only relevant for combos (which bundle a filter), so the
   * UI hides it entirely otherwise.
   */
  protected readonly cartHasCombo = computed(
    () => this.cartService.items().some((item) => item.isCombo === true),
  );

  /** True when exactly one disclaimer is selected (XOR). */
  protected readonly hasDisclaimerSelection = computed(
    () => this.originalEngineChecked() !== this.modifiedEngineChecked(),
  );

  /** True when the user accidentally ticked both checkboxes. */
  protected readonly hasDisclaimerConflict = computed(
    () => this.originalEngineChecked() && this.modifiedEngineChecked(),
  );

  /**
   * Resolved engine-modification value to send to the backend, or `null`
   * while no valid selection exists.
   */
  protected readonly selectedEngineModification = computed<EngineModificationStatus | null>(() => {
    if (!this.hasDisclaimerSelection()) return null;
    return this.originalEngineChecked() ? 'original' : 'modified';
  });

  /**
   * Optional free-form note the user can include for the admin team. Persisted
   * by the backend as the first entry in the order's comments thread so it
   * surfaces in the same conversation widget used for follow-ups.
   */
  protected readonly customerNote = signal('');
  protected readonly customerNoteMaxLength = 1000;

  // ── Passthrough handles to sub-services (preserve template API) ─────────

  // Payment UI ─ template-facing signals/methods
  protected readonly paymentMethods = this.paymentUi.paymentMethods;
  protected readonly loadingMethods = this.paymentUi.loadingMethods;
  protected readonly paymentGroups = this.paymentUi.paymentGroups;
  protected readonly showModal = this.paymentUi.showModal;
  protected readonly selectedGroup = this.paymentUi.selectedGroup;
  protected readonly selectedMethodInModal = this.paymentUi.selectedMethodInModal;
  protected readonly isSubmittingPayment = this.paymentUi.isSubmittingPayment;
  protected readonly formReferenceNumber = this.paymentUi.formReferenceNumber;
  protected readonly formSourceBank = this.paymentUi.formSourceBank;
  protected readonly formSenderName = this.paymentUi.formSenderName;
  protected readonly formAmount = this.paymentUi.formAmount;
  protected readonly formPaymentDate = this.paymentUi.formPaymentDate;
  protected readonly formProofFile = this.paymentUi.formProofFile;
  protected readonly formProofPreview = this.paymentUi.formProofPreview;
  protected readonly isPaymentDateInvalid = this.paymentUi.isPaymentDateInvalid;
  protected readonly paymentSubmitted = this.paymentUi.paymentSubmitted;
  protected readonly submittedPayment = this.paymentUi.submittedPayment;
  protected readonly submittedMethodType = this.paymentUi.submittedMethodType;
  protected readonly copiedAll = this.paymentUi.copiedAll;
  protected readonly venezuelanBanks = this.paymentUi.venezuelanBanks;
  protected readonly infoOnlyMessage = this.paymentUi.infoOnlyMessage;
  protected readonly amountReadonly = this.paymentUi.amountReadonly;

  // Billing ─ template-facing signals
  protected readonly billingSource = this.billing.billingSource;
  protected readonly canUseShippingAddress = this.billing.canUseShippingAddress;
  // `billingForm` is initialized lazily; expose a getter so the template can
  // read it after init() runs in ngOnInit.
  protected get billingForm() { return this.billing.billingForm; }

  // Branch stock ─ template-facing signals
  protected readonly branchStockMap = this.branchStock.branchStockMap;
  protected readonly isLoadingBranchStock = this.branchStock.isLoadingBranchStock;
  protected readonly availableBranches = this.branchStock.availableBranches;

  // ── Branch selection computeds (kept here — small enough) ───────────────

  /** Whether branch selection should be shown (only store_pickup and in_store_oil_change). */
  protected readonly needsBranchSelection = computed(() => {
    const dt = this.checkoutService.dispatchType();
    return dt === 'store_pickup' || dt === 'in_store_oil_change';
  });

  /** Whether branch selection is mandatory (only pickup/in-store). */
  protected readonly isBranchMandatory = computed(() => {
    const dt = this.checkoutService.dispatchType();
    return dt === 'store_pickup' || dt === 'in_store_oil_change';
  });

  // ── Vehicle + delivery concept ──────────────────────────────────────────

  /** Whether vehicles are required for this dispatch type. */
  protected readonly needsVehicle = computed(() => {
    const dt = this.checkoutService.dispatchType();
    return dt === 'oil_change_service' || dt === 'in_store_oil_change';
  });

  /**
   * Concept label for the cost row in the order summary. Changes the wording
   * based on dispatch type so it reads naturally to the user — e.g. an oil
   * change service is a "servicio", an agency delivery is an "envío", and
   * a store pickup is a "despacho".
   */
  protected readonly deliveryConceptLabel = computed<string>(() => {
    const dt = this.checkoutService.dispatchType();
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

  // ── Service-date gating ─────────────────────────────────────────────────

  /** True when the active dispatch type requires the date picker. */
  private readonly needsServiceDate = computed(() => {
    const dt = this.checkoutService.dispatchType();
    return dt === 'oil_change_service' || dt === 'in_store_oil_change';
  });

  protected readonly canGenerateOrder = computed(() => {
    const hasBranchIfRequired = !this.isBranchMandatory() || this.checkoutService.hasBranch();
    const hasVehicleIfRequired = !this.needsVehicle() || this.checkoutService.hasVehicle();
    const hasServiceDateIfNeeded =
      !this.needsServiceDate()
      || (this.checkoutService.hasRequestedServiceDate()
          && this.isRequestedServiceDateAlignedWithSchedule());
    // Disclaimer is only required when the cart contains a combo.
    const disclaimerOk = !this.cartHasCombo() || this.hasDisclaimerSelection();
    return disclaimerOk
      && this.paymentSubmitted()
      && hasBranchIfRequired
      && hasVehicleIfRequired
      && hasServiceDateIfNeeded;
  });

  /**
   * Re-valida que la fecha solicitada cae en un día con atención según la
   * disponibilidad agregada de los mecánicos de la sucursal. Defense in
   * depth — la UI ya bloquea los botones inválidos, pero un cambio de
   * sucursal posterior o una recarga podrían dejar la fecha previa fuera
   * de los horarios reales de los mecánicos.
   *
   * Para hoy/mañana prefiere las ventanas efectivas (con dateBlocks aplicados);
   * para fechas más adelante cae al schedule semanal + fullyBlockedDates.
   */
  private isRequestedServiceDateAlignedWithSchedule(): boolean {
    const requested = this.checkoutService.requestedServiceDate();
    if (!requested) return false;
    const availability = this.branchAvailability();
    if (!availability) return true; // sin info → permisivo, backend valida
    if (availability.fullyBlockedDates.includes(requested.date)) return false;

    if (requested.date === availability.todayIso) {
      return availability.todayWindows.length > 0;
    }
    if (requested.date === availability.tomorrowIso) {
      return availability.tomorrowWindows.length > 0;
    }
    const jsDow = new Date(requested.date + 'T00:00:00').getDay();
    const day = availability.schedule[jsDow];
    return !!day && !day.isClosed;
  }

  protected onServiceDateChange(value: RequestedServiceDate | null): void {
    this.checkoutService.setRequestedServiceDate(value);
  }

  // ── Order total (signal-backed so the payment service can react) ────────

  private readonly shippingCostSignal = computed<number>(() => {
    const dt = this.checkoutService.dispatchType();
    if (dt === 'shipping_agency') {
      return this.checkoutService.getShippingCost() ?? 0;
    }
    if (dt === 'local_delivery') {
      const config = this.getLocalDeliveryConfig();
      if (config?.additionalCharge) return config.additionalChargeAmount;
      return 0;
    }
    return 0;
  });

  private readonly totalSignal = computed(
    () => this.cartService.subtotal() + this.shippingCostSignal(),
  );

  // ── Lifecycle ───────────────────────────────────────────────────────────

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

    if (dispatchType === 'in_store_oil_change') {
      // Vehicle picker lives in /checkout/cambio-aceite-tienda. If the user
      // lands here without a vehicle, send them back to select one.
      if (!this.checkoutService.hasVehicle()) {
        this.router.navigate(['/checkout/cambio-aceite-tienda']);
        return;
      }
    }

    if (this.cartService.isEmpty()) {
      this.router.navigate(['/carrito']);
      return;
    }

    // Wire the payment service to the component's reactive context BEFORE
    // any consumer reads its dependent computeds (infoOnlyMessage, amountReadonly).
    this.paymentUi.init({
      total: this.totalSignal,
      dispatchType: this.checkoutService.dispatchType,
      todayStr: this.todayStr,
      reportError: (msg) => this.errorMessage.set(msg),
    });

    // Initialize the billing form (FormBuilder is only safe to use inside
    // the component lifetime, hence not in the service constructor).
    this.billing.init();

    // Load active payment methods from API
    this.paymentUi.loadPaymentMethods();

    // Back-fill vehicleTypes on legacy cart items so the compatibility
    // warning can evaluate correctly.
    this.rehydrateLegacyCartItems();

    // Load per-branch stock to determine which branches can fulfill the cart
    this.branchStock.loadBranchStockForCart();

    // Default billing address to profile
    if (!this.checkoutService.billingAddress()) {
      this.billing.buildFromProfile();
    }
  }

  /**
   * Back-fills `vehicleTypes` on cart items persisted before this metadata
   * existed. Idempotent — no-op when all items already carry the field.
   */
  private rehydrateLegacyCartItems(): void {
    if (!this.cartService.hasStaleMetadata()) return;

    const items = this.cartService.items();
    if (items.length === 0) return;

    const requests = items.map((it) => this.productService.getDetail(it.id));

    forkJoin(requests).subscribe({
      next: (responses) => {
        const map = new Map<
          string,
          { vehicleTypes?: string[]; freeOilChangeService?: boolean }
        >();
        for (const res of responses) {
          const p = res.data.product as any;
          if (!p?.id) continue;
          map.set(p.id, {
            vehicleTypes: p.vehicleTypes,
            freeOilChangeService: p.freeOilChangeService,
          });
        }
        this.cartService.syncItemMetadata(map);
      },
      error: () => {
        /* silent — warning simply won't trigger for legacy items */
      },
    });
  }

  // ── Read-only getters consumed by the template ──────────────────────────

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
      const config = this.getLocalDeliveryConfig();
      if (config?.additionalCharge) {
        return `+$${config.additionalChargeAmount.toFixed(2)}`;
      }
      return 'Delivery gratis';
    }
    return 'Gratis';
  }

  get shippingCost(): number {
    return this.shippingCostSignal();
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
    return this.totalSignal();
  }

  // ── Payment-method passthroughs (template-facing methods) ───────────────

  getIconClass = (type: Parameters<CheckoutPaymentUiService['getIconClass']>[0]) => this.paymentUi.getIconClass(type);
  getCurrencySymbol = (type?: string) => this.paymentUi.getCurrencySymbol(type);
  formatPaymentAmount = (amount?: number, type?: string) => this.paymentUi.formatPaymentAmount(amount, type);
  protected totalUsdRaw = () => this.paymentUi.totalUsdRaw();
  protected totalBsRaw = () => this.paymentUi.totalBsRaw();
  copyAllPaymentDetails = () => this.paymentUi.copyAllPaymentDetails();
  isFormType = (type: Parameters<CheckoutPaymentUiService['isFormType']>[0]) => this.paymentUi.isFormType(type);
  isInfoOnlyType = (type: Parameters<CheckoutPaymentUiService['isInfoOnlyType']>[0]) => this.paymentUi.isInfoOnlyType(type);
  selectBranch = (branch: BranchSummary & { insufficientStock?: boolean }) => {
    if (branch.insufficientStock) return; // Prevent selecting branch with insufficient stock
    this.checkoutService.selectBranch(branch);
  };
  openPaymentModal = (group: PaymentMethodGroup) => this.paymentUi.openPaymentModal(group);
  protected referenceLabel = () => this.paymentUi.referenceLabel();
  closeModal = () => this.paymentUi.closeModal();
  selectMethodInModal = (m: Parameters<CheckoutPaymentUiService['selectMethodInModal']>[0]) => this.paymentUi.selectMethodInModal(m);
  onFormInput = (field: string, event: Event) => this.paymentUi.onFormInput(field, event);
  onProofFileChange = (event: Event) => this.paymentUi.onProofFileChange(event);
  removeProofFile = () => this.paymentUi.removeProofFile();
  isFormValid = () => this.paymentUi.isFormValid();
  submitPayment = () => this.paymentUi.submitPayment();
  clearPaymentSubmission = () => this.paymentUi.clearPaymentSubmission();

  // ── Billing passthroughs ────────────────────────────────────────────────

  onBillingSourceChange = (source: 'shipping' | 'profile' | 'custom') => this.billing.onBillingSourceChange(source);
  onBillingFormSubmit = () => this.billing.onBillingFormSubmit();

  // ── Order generation ────────────────────────────────────────────────────

  onGenerateOrder(): void {
    if (!this.canGenerateOrder()) return;
    this.showConfirmModal.set(true);
    this.acquireScrollLock();
  }

  onCancelOrder(): void {
    this.showConfirmModal.set(false);
    this.releaseScrollLock();
  }

  onConfirmOrder(): void {
    if (this.isProcessingConfirm()) return;
    this.isProcessingConfirm.set(true);

    this.confirmTimeoutId = setTimeout(() => {
      this.confirmTimeoutId = null;
      this.isProcessingConfirm.set(false);
      this.showConfirmModal.set(false);
      this.releaseScrollLock();
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
    const selectedVehicles = this.checkoutService.selectedVehicles();
    const selectedBranch = this.checkoutService.selectedBranch();

    // Build dispatch details based on type
    const dispatchDetails: any = {};

    // Branch info for pickup/in-store types. `selectedBranchPhone` is captured
    // as a historical snapshot — if the branch updates its WhatsApp number
    // later, this order still surfaces the contact the client saw at checkout.
    //
    // For flows without an explicit `selectedBranch` (e.g. oil_change_service
    // when the zone has multiple options), the backend resolves the actual
    // servicing branch from the stock reservations and populates these fields
    // post-create — see `order.service.ts:create`.
    if (selectedBranch) {
      dispatchDetails.selectedBranchId = selectedBranch.id;
      dispatchDetails.selectedBranchName = selectedBranch.name;
      dispatchDetails.selectedBranchAddress = selectedBranch.address;
      dispatchDetails.selectedBranchPhone = selectedBranch.whatsappPhone;
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

    const requestedDate = this.checkoutService.requestedServiceDate();

    const orderData: CreateOrderRequest = {
      items,
      subtotal: this.cartService.subtotal(),
      shippingCost: this.shippingCost,
      total: this.total,
      dispatchType: this.dispatchType as any,
      paymentMethod: this.submittedPayment()?.methodType as any,
      disclaimerAccepted: this.hasDisclaimerSelection(),
      engineModification: this.selectedEngineModification() ?? undefined,
      vehicles: selectedVehicles.length > 0 ? selectedVehicles.map((v) => v.id) : undefined,
      selectedBranch: selectedBranch?.id,
      billingAddress: this.checkoutService.billingAddress() || undefined,
      paymentSubmission: this.submittedPayment() || undefined,
      dispatchDetails,
      requestedServiceDate:
        this.needsServiceDate() && requestedDate ? requestedDate.date : undefined,
      requestedServiceTier:
        this.needsServiceDate() && requestedDate ? requestedDate.tier : undefined,
      customerNote: this.buildCustomerNote(),
    };

    this.orderService.createOrder(orderData).subscribe({
      next: (response) => {
        this.isGenerating.set(false);
        // Purchase conversion: log BEFORE clearing the cart so item context
        // is still available. GA4 `purchase` semantics (transaction_id + value).
        void this.analytics.logEvent(AnalyticsEvent.Purchase, {
          transaction_id: response.data.id,
          currency: 'USD',
          value: this.total,
          shipping: this.shippingCost,
          dispatch_type: this.dispatchType,
          items_count: items.length,
        });
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

  // ── Disclaimer handlers ─────────────────────────────────────────────────

  onOriginalEngineChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.originalEngineChecked.set(checked);
    this.syncDisclaimerState();
  }

  onModifiedEngineChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.modifiedEngineChecked.set(checked);
    this.syncDisclaimerState();
  }

  toggleModifiedSection(): void {
    const next = !this.isModifiedSectionExpanded();
    this.isModifiedSectionExpanded.set(next);

    // Collapsing invalidates any prior acknowledgment so the user never keeps
    // a ticked-but-hidden disclaimer.
    if (!next && this.modifiedEngineChecked()) {
      this.modifiedEngineChecked.set(false);
      this.syncDisclaimerState();
    }
  }

  /**
   * Propagates the XOR state to the checkout service. While the user has both
   * boxes ticked (conflict) we keep `disclaimerAccepted=false` so downstream
   * gates also stay closed, not just the submit button.
   */
  private syncDisclaimerState(): void {
    const accepted = this.hasDisclaimerSelection();
    this.checkoutService.setDisclaimerAccepted(accepted);
    this.checkoutService.setEngineModification(this.selectedEngineModification());
  }

  // ── Navigation ──────────────────────────────────────────────────────────

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
        this.router.navigate(['/checkout/vendedor']);
        break;
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

  // ==========================================================================
  // Customer note assembly
  //
  // Each dispatch flow has its own "notes" textarea inside its dedicated form
  // (oil change, local delivery, shipping agency, seller agreement). We
  // consolidate those with the optional note captured in this summary screen
  // and ship the combined text as `customerNote`, which the backend persists
  // as the first entry in the order's comments thread.
  // ==========================================================================

  /** Reads the per-flow `notes` field from the active dispatch's saved info. */
  private collectFlowNote(): string {
    switch (this.dispatchType) {
      case 'oil_change_service':
        return this.oilChangeServiceInfo?.notes?.trim() || '';
      case 'local_delivery':
        return this.localDeliveryInfo?.notes?.trim() || '';
      case 'shipping_agency':
        return this.recipientInfo?.notes?.trim() || '';
      case 'seller_agreement':
        return this.sellerAgreementInfo?.notes?.trim() || '';
      default:
        return '';
    }
  }

  /**
   * Combines the per-flow note (from the dispatch form) with the optional
   * customer note (from the summary textarea) into a single string that the
   * backend will persist as the first comment of the order's thread.
   *
   * Format rules:
   *   - Both empty → returns `undefined` (no comment is created).
   *   - Only one present → returned as-is, no label (the origin is obvious).
   *   - Both present → joined with double newline and soft labels so the
   *     admin can tell which textarea each block came from.
   *   - Hard-capped at 1000 chars (mirrors the backend `addComment` cap).
   */
  private buildCustomerNote(): string | undefined {
    const MAX = 1000;
    const flow = this.collectFlowNote();
    const summary = this.customerNote().trim();

    let combined: string;
    if (flow && summary) {
      combined = `Notas del formulario:\n${flow}\n\nNota adicional:\n${summary}`;
    } else if (flow) {
      combined = flow;
    } else if (summary) {
      combined = summary;
    } else {
      return undefined;
    }

    if (combined.length > MAX) {
      // Truncate with ellipsis so the admin sees a clear cut-off marker.
      combined = combined.slice(0, MAX - 1) + '…';
    }

    return combined;
  }
}
