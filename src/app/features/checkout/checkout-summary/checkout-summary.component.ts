import { Component, inject, signal, OnInit, OnDestroy, computed } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe, CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { CheckoutService, RequestedServiceDate } from '../services/checkout.service';
import { CartService } from '@core/services/cart.service';
import { OrderService } from '@core/services/order.service';
import { AuthService } from '@core/services/auth.service';
import { LocationService, BranchSummary } from '@core/services/location.service';
import { PaymentMethodService } from '@core/services/payment-method.service';
import { UploadService } from '@core/services/upload.service';
import { BranchProductService } from '@core/services/branch-product.service';
import { ProductService } from '@core/services/product.service';
import { ExchangeRateService } from '@core/services/exchange-rate.service';
import { CreateOrderRequest, PaymentSubmission, EngineModificationStatus } from '@models/order.model';
import {
  PaymentMethodConfig,
  PaymentMethodType,
  PaymentMethodGroup,
  PAYMENT_METHOD_TYPE_LABELS,
  PAYMENT_METHOD_ICON_CLASS,
  PAYMENT_TYPES_WITH_FORM,
  PAYMENT_TYPES_INFO_ONLY,
} from '@models/payment-method.model';
import { CopyableValueComponent } from '@shared/components/copyable-value/copyable-value.component';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';
import { ServiceDatePickerComponent } from '@shared/components/service-date-picker/service-date-picker.component';
import { ClipboardService } from '@shared/services/clipboard.service';
import { BodyScrollLockService } from '@shared/services/body-scroll-lock.service';
import { CheckoutHeaderComponent } from '../components/checkout-header/checkout-header.component';
import { businessTodayIso } from '@shared/utils/business-date.util';
import { jsDowToBranchDay } from '@shared/utils/branch-day.util';

@Component({
  selector: 'app-checkout-summary',
  standalone: true,
  imports: [CurrencyPipe, CommonModule, ReactiveFormsModule, CopyableValueComponent, DateInputComponent, ServiceDatePickerComponent, CheckoutHeaderComponent],
  templateUrl: './checkout-summary.component.html',
  styleUrl: './checkout-summary.component.scss',
})
export class CheckoutSummaryComponent implements OnInit, OnDestroy {
  protected readonly checkoutService = inject(CheckoutService);
  protected readonly cartService = inject(CartService);
  private readonly orderService = inject(OrderService);
  private readonly authService = inject(AuthService);
  private readonly uploadService = inject(UploadService);
  private readonly paymentMethodService = inject(PaymentMethodService);
  private readonly fb = inject(FormBuilder);
  protected readonly locationService = inject(LocationService);
  private readonly branchProductService = inject(BranchProductService);
  private readonly productService = inject(ProductService);
  private readonly router = inject(Router);
  protected readonly exchangeRateService = inject(ExchangeRateService);
  private readonly clipboard = inject(ClipboardService);
  private readonly scrollLock = inject(BodyScrollLockService);

  /**
   * Local counter mirroring how many BodyScrollLock acquisitions this
   * component currently holds. ngOnDestroy drains it so a back-gesture
   * with a modal still open never leaves the page underneath frozen.
   */
  private heldScrollLocks = 0;
  /**
   * Pending setTimeout id for the order-confirmation processing window.
   * Tracked so it can be cancelled in ngOnDestroy and not fire callbacks
   * (and HTTP calls) on a destroyed component.
   */
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

  // Transient "Copiado" feedback for the "Copiar todo" action (1.5s).
  protected readonly copiedAll = signal(false);
  private copyAllTimeout: ReturnType<typeof setTimeout> | null = null;

  // State signals
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
  protected readonly isSubmittingPayment = signal(false);

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
  protected readonly formSenderName = signal('');
  protected readonly formAmount = signal('');
  protected readonly formPaymentDate = signal('');
  protected readonly formProofFile = signal<File | null>(null);
  protected readonly formProofPreview = signal<string | null>(null);

  /** True cuando la fecha del pago es posterior a hoy (inválida) */
  protected readonly isPaymentDateInvalid = computed(() => {
    const d = this.formPaymentDate();
    return !!d && d > this.todayStr;
  });

  // Post-submission state
  protected readonly paymentSubmitted = signal(false);
  protected readonly submittedPayment = signal<PaymentSubmission | null>(null);
  protected readonly submittedMethodType = signal<PaymentMethodType | null>(null);

  /**
   * Modal copy for info-only payment methods (tarjeta / efectivo). The wording
   * adapts to the current dispatch type so the message stays truthful for each
   * combination — e.g. for a delivery the customer pays at the door, not at
   * the store; for an agency we coordinate the charge before dispatch; etc.
   */
  protected readonly infoOnlyMessage = computed<string>(() => {
    const group = this.selectedGroup();
    if (!group) return '';
    const dispatch = this.checkoutService.dispatchType();

    if (group.type === PaymentMethodType.TARJETA) {
      switch (dispatch) {
        case 'store_pickup':
        case 'in_store_oil_change':
          return 'Pagarás con tu tarjeta directamente en la tienda al retirar tu pedido. Aceptamos débito y crédito.';
        case 'oil_change_service':
          return 'Nuestro técnico llevará el punto de venta. Pagarás con tu tarjeta cuando finalice el servicio.';
        case 'local_delivery':
          return 'Nuestro repartidor llevará el punto de venta. Pagarás con tu tarjeta al recibir tu pedido.';
        case 'shipping_agency':
          return 'Te contactaremos para coordinar el pago con tarjeta antes de despachar a la agencia.';
        case 'seller_agreement':
        default:
          return 'Te contactaremos para coordinar el pago con tarjeta.';
      }
    }

    if (group.type === PaymentMethodType.EFECTIVO_DIVISAS) {
      switch (dispatch) {
        case 'store_pickup':
        case 'in_store_oil_change':
          return 'Pagarás en efectivo (USD) directamente en la tienda al retirar tu pedido.';
        case 'oil_change_service':
          return 'Pagarás en efectivo (USD) al finalizar el servicio. Te sugerimos tener el monto exacto.';
        case 'local_delivery':
          return 'Pagarás en efectivo (USD) al recibir tu pedido. Te sugerimos tener el monto exacto.';
        case 'shipping_agency':
          return 'Te contactaremos para coordinar el pago en efectivo (USD) antes de despachar a la agencia.';
        case 'seller_agreement':
        default:
          return 'Te contactaremos para coordinar el pago en efectivo (USD).';
      }
    }

    return '';
  });

  // ========== Branch Selection (Pickup & In-Store Only) ==========

  /** Whether branch selection should be shown (only store_pickup and in_store_oil_change) */
  protected readonly needsBranchSelection = computed(() => {
    const dt = this.checkoutService.dispatchType();
    return dt === 'store_pickup' || dt === 'in_store_oil_change';
  });

  /** Whether branch selection is mandatory (only pickup/in-store) */
  protected readonly isBranchMandatory = computed(() => {
    const dt = this.checkoutService.dispatchType();
    return dt === 'store_pickup' || dt === 'in_store_oil_change';
  });

  /** All branches based on dispatch type (before stock filtering) */
  private readonly allBranches = computed<BranchSummary[]>(() => {
    const dt = this.checkoutService.dispatchType();
    if (dt === 'in_store_oil_change') return this.locationService.branchesWithOilChange();
    return this.locationService.branches();
  });

  /**
   * Per-branch stock map: branchId → Map<productId, stock>
   * Used to determine which branches can fulfill the entire cart.
   */
  protected readonly branchStockMap = signal<Map<string, Map<string, number>>>(new Map());
  protected readonly isLoadingBranchStock = signal(false);

  /** Branches that have sufficient stock for ALL cart items */
  protected readonly availableBranches = computed<(BranchSummary & { insufficientStock?: boolean })[]>(() => {
    const branches = this.allBranches();
    const stockMap = this.branchStockMap();
    const cartItems = this.cartService.items();

    // If stock data not loaded yet, show all branches without stock info
    if (stockMap.size === 0) return branches;

    return branches.map(branch => {
      const branchStock = stockMap.get(branch.id);
      if (!branchStock) return { ...branch, insufficientStock: true };

      const hasEnough = cartItems.every(item => {
        const stock = branchStock.get(item.id) ?? 0;
        return stock >= item.quantity;
      });

      return { ...branch, insufficientStock: !hasEnough };
    }).sort((a, b) => {
      // Branches with sufficient stock first
      if (a.insufficientStock && !b.insufficientStock) return 1;
      if (!a.insufficientStock && b.insufficientStock) return -1;
      return 0;
    });
  });

  // ========== Vehicle Selection (Multi-vehicle) ==========

  /** Whether vehicles are required for this dispatch type */
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

  // Vehicle selection is handled in oil-change-form; summary is read-only

  // ========== Billing Address ==========

  protected billingSource = signal<'shipping' | 'profile' | 'custom'>('profile');
  protected billingForm!: FormGroup;

  protected readonly canUseShippingAddress = computed(() => {
    const dt = this.checkoutService.dispatchType();
    return dt === 'local_delivery' || dt === 'shipping_agency' || dt === 'oil_change_service';
  });

  onBillingSourceChange(source: 'shipping' | 'profile' | 'custom'): void {
    this.billingSource.set(source);

    if (source === 'shipping') {
      this.buildBillingFromShipping();
    } else if (source === 'profile') {
      this.buildBillingFromProfile();
    }
    // 'custom' waits for form submission
  }

  private buildBillingFromShipping(): void {
    const dt = this.checkoutService.dispatchType();
    let address = '', city = '', municipality = '', state = '', fullName = '', docType = '', docNum = '', refPoint = '';

    if (dt === 'local_delivery') {
      const info = this.localDeliveryInfo;
      if (info) {
        fullName = info.fullName; docType = info.documentType; docNum = info.documentNumber;
        address = info.address; city = info.cityName; municipality = info.municipalityName;
        refPoint = info.referencePoint || '';
      }
    } else if (dt === 'shipping_agency') {
      const info = this.recipientInfo;
      if (info) {
        fullName = info.fullName; docType = info.documentType; docNum = info.documentNumber;
        address = info.address; city = info.city; state = info.state;
        municipality = info.municipality || ''; refPoint = info.referencePoint || '';
      }
    } else if (dt === 'oil_change_service') {
      const info = this.oilChangeServiceInfo;
      if (info) {
        fullName = info.fullName; docType = info.documentType; docNum = info.documentNumber;
        address = info.address; city = info.cityName; municipality = info.municipalityName;
        refPoint = info.referencePoint || '';
      }
    }

    this.checkoutService.setBillingAddress({
      source: 'shipping', fullName, documentType: docType, documentNumber: docNum,
      address, city, municipality, state, referencePoint: refPoint,
    });
  }

  private buildBillingFromProfile(): void {
    const user = this.authService.currentUser();
    if (!user) return;

    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    const addressParts = [user.street, user.houseNumber, user.neighborhood].filter(Boolean);

    this.checkoutService.setBillingAddress({
      source: 'profile',
      fullName,
      documentType: user.documentType,
      documentNumber: user.documentNumber,
      address: addressParts.length > 0 ? addressParts.join(', ') : (user as any).address || '',
      city: user.cityName || '',
      municipality: user.municipalityName || '',
      state: user.stateName || '',
      referencePoint: user.referencePoint || '',
    });
  }

  onBillingFormSubmit(): void {
    if (this.billingForm.invalid) {
      this.billingForm.markAllAsTouched();
      return;
    }
    const v = this.billingForm.getRawValue();
    this.checkoutService.setBillingAddress({
      source: 'custom',
      fullName: v.fullName?.trim(),
      documentType: v.documentType,
      documentNumber: v.documentNumber?.trim(),
      address: v.address?.trim(),
      city: v.city?.trim(),
      municipality: v.municipality?.trim(),
      state: v.state?.trim(),
      referencePoint: v.referencePoint?.trim(),
    });
  }

  // ========== Can Generate Order ==========

  protected readonly canGenerateOrder = computed(() => {
    const hasBranchIfRequired = !this.isBranchMandatory() || this.checkoutService.hasBranch();
    const hasVehicleIfRequired = !this.needsVehicle() || this.checkoutService.hasVehicle();
    const hasServiceDateIfOilChange =
      this.checkoutService.dispatchType() !== 'oil_change_service'
      || (this.checkoutService.hasRequestedServiceDate()
          && this.isRequestedServiceDateAlignedWithSchedule());
    // Disclaimer is only required when the cart contains a combo.
    const disclaimerOk = !this.cartHasCombo() || this.hasDisclaimerSelection();
    return disclaimerOk
      && this.paymentSubmitted()
      && hasBranchIfRequired
      && hasVehicleIfRequired
      && hasServiceDateIfOilChange;
  });

  /**
   * Re-valida que la fecha solicitada cae en un día con atención según el
   * `schedule` de la sucursal asignada. Defense in depth — la UI ya bloquea
   * los botones inválidos pero un cambio de sucursal posterior podría dejar
   * la fecha previa fuera del horario.
   */
  private isRequestedServiceDateAlignedWithSchedule(): boolean {
    const requested = this.checkoutService.requestedServiceDate();
    if (!requested) return false;
    const branch = this.checkoutService.selectedBranch();
    const schedule = branch?.schedule;
    if (!schedule || schedule.length === 0) return true; // sin info → permisivo
    // `Date.getDay()` retorna en convención JS (0=Sun … 6=Sat) — el schedule
    // de Branch usa convención local (0=Lun … 6=Dom). Convertir antes del lookup.
    const branchDay = jsDowToBranchDay(new Date(requested.date + 'T00:00:00').getDay());
    const day = schedule.find((d) => d.day === branchDay);
    return !!day && !day.isClosed;
  }

  protected onServiceDateChange(value: RequestedServiceDate | null): void {
    this.checkoutService.setRequestedServiceDate(value);
  }

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

    // Load active payment methods from API
    this.loadPaymentMethods();

    // Back-fill vehicleTypes on legacy cart items so the compatibility
    // warning can evaluate correctly.
    this.rehydrateLegacyCartItems();

    // Initialize billing form for custom address
    this.billingForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(3)]],
      documentType: ['V', Validators.required],
      documentNumber: ['', [Validators.required, Validators.pattern(/^\d{6,10}$/)]],
      address: ['', [Validators.required, Validators.minLength(10)]],
      city: ['', Validators.required],
      municipality: [''],
      state: [''],
      referencePoint: [''],
    });

    // Load per-branch stock to determine which branches can fulfill the cart
    this.loadBranchStockForCart();

    // Default billing address to profile
    if (!this.checkoutService.billingAddress()) {
      this.buildBillingFromProfile();
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

  /**
   * Load per-branch stock for each cart product.
   * Builds a map: branchId → Map<productId, stock>
   */
  private loadBranchStockForCart(): void {
    const cartItems = this.cartService.items();
    const branchIds = this.locationService.branchIds();
    if (cartItems.length === 0 || branchIds.length === 0) return;

    this.isLoadingBranchStock.set(true);

    const requests = cartItems.map(item =>
      this.branchProductService.getAggregatedStock(item.id, branchIds)
    );

    forkJoin(requests).subscribe({
      next: (responses) => {
        const map = new Map<string, Map<string, number>>();

        responses.forEach((res, idx) => {
          const productId = cartItems[idx].id;
          for (const entry of res.data.byBranch) {
            if (!map.has(entry.branchId)) {
              map.set(entry.branchId, new Map());
            }
            map.get(entry.branchId)!.set(productId, entry.stock);
          }
        });

        this.branchStockMap.set(map);
        this.isLoadingBranchStock.set(false);

        // Auto-select best branch if only one has sufficient stock or only one branch
        this.autoSelectBestBranch();
      },
      error: () => {
        this.isLoadingBranchStock.set(false);
      },
    });
  }

  /**
   * Auto-select the branch with highest stock if appropriate.
   */
  private autoSelectBestBranch(): void {
    const branches = this.availableBranches();
    const validBranches = branches.filter(b => !b.insufficientStock);

    if (validBranches.length === 1 && !this.checkoutService.selectedBranch()) {
      this.checkoutService.selectBranch(validBranches[0]);
    }
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

  // ========== Copyable payment amounts ==========

  /** Raw USD total as a paste-ready decimal string (no currency symbol). */
  protected totalUsdRaw(): string {
    return this.total.toFixed(2);
  }

  /** Raw Bs total as a paste-ready decimal string, or '' when rate unavailable. */
  protected totalBsRaw(): string {
    const bs = this.exchangeRateService.convertToBs(this.total);
    return bs !== null ? bs.toFixed(2) : '';
  }

  /**
   * Builds a human-readable payment-details block that consolidates the
   * selected account info + the amount due. Output shape (example):
   *
   *   Banco: Banesco
   *   Teléfono: 0412-1234567
   *   Cédula: V-12345678
   *   Monto: 1234.56 Bs
   */
  private buildPaymentSummary(): string {
    const method = this.selectedMethodInModal();
    const group = this.selectedGroup();
    if (!method || !group) return '';

    const lines: string[] = [];

    if (method.type === 'pago_movil' && method.pagoMovil) {
      lines.push(`Banco: ${method.pagoMovil.bankName}`);
      lines.push(`Teléfono: ${method.pagoMovil.phoneNumber}`);
      lines.push(`Cédula: ${method.pagoMovil.documentId}`);
    } else if (method.type === 'transferencia' && method.transferencia) {
      lines.push(`Banco: ${method.transferencia.bankName}`);
      lines.push(`Cuenta: ${method.transferencia.accountNumber}`);
      lines.push(`Cédula: ${method.transferencia.documentId}`);
    } else if (method.type === 'zelle' && method.zelle) {
      if (method.zelle.phoneNumber) lines.push(`Teléfono: ${method.zelle.phoneNumber}`);
      if (method.zelle.email) lines.push(`Correo: ${method.zelle.email}`);
    }

    if (group.type === 'pago_movil' || group.type === 'transferencia') {
      const bs = this.totalBsRaw();
      if (bs) lines.push(`Monto: ${bs} Bs`);
    } else {
      lines.push(`Monto: ${this.totalUsdRaw()} USD`);
    }

    return lines.join('\n');
  }

  async copyAllPaymentDetails(): Promise<void> {
    const text = this.buildPaymentSummary();
    if (!text) return;

    const ok = await this.clipboard.write(text);
    if (!ok) return;

    this.copiedAll.set(true);
    if (this.copyAllTimeout) clearTimeout(this.copyAllTimeout);
    this.copyAllTimeout = setTimeout(() => this.copiedAll.set(false), 1500);
  }

  isFormType(type: PaymentMethodType): boolean {
    return PAYMENT_TYPES_WITH_FORM.includes(type);
  }

  isInfoOnlyType(type: PaymentMethodType): boolean {
    return PAYMENT_TYPES_INFO_ONLY.includes(type);
  }

  // ========== Branch Selection ==========

  selectBranch(branch: BranchSummary & { insufficientStock?: boolean }): void {
    if (branch.insufficientStock) return; // Prevent selecting branch with insufficient stock
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
    // Prefill amount with the exact figure the user should pay. For
    // pago_movil/transferencia it's the Bs conversion; for binance it's the
    // USD total (≈ USDT). Leaves empty when Bs conversion is unavailable so
    // the user can manually type.
    const prefilled = this.computePrefilledAmount(group.type);
    this.formAmount.set(prefilled);
    this.showModal.set(true);
    this.acquireScrollLock();
  }

  /** Returns the pre-filled amount for the current modal's payment type */
  private computePrefilledAmount(type: PaymentMethodType): string {
    if (type === PaymentMethodType.PAGO_MOVIL || type === PaymentMethodType.TRANSFERENCIA) {
      const bs = this.exchangeRateService.convertToBs(this.total);
      return bs !== null ? bs.toFixed(2) : '';
    }
    if (type === PaymentMethodType.ZELLE) {
      // Zelle settles in USD directly — prefill with the order total, no
      // Bs conversion needed.
      return this.total.toFixed(2);
    }
    return '';
  }

  /**
   * True when the amount field should be locked. For Bs-based methods it
   * requires a valid exchange rate; when the rate is unavailable we fall back
   * to editable so the user can still complete the form manually. Zelle is
   * always locked because USD is native to the order total.
   */
  protected readonly amountReadonly = computed<boolean>(() => {
    const g = this.selectedGroup();
    if (!g) return false;
    if (g.type === PaymentMethodType.PAGO_MOVIL || g.type === PaymentMethodType.TRANSFERENCIA) {
      return this.exchangeRateService.convertToBs(this.total) !== null;
    }
    return g.type === PaymentMethodType.ZELLE;
  });

  /** Label for the reference-number input. Zelle users copy a confirmation
   *  number from their banking app, so the wording changes to match. */
  protected referenceLabel(): string {
    return this.selectedGroup()?.type === PaymentMethodType.ZELLE
      ? 'Número de confirmación'
      : 'Número de referencia';
  }

  closeModal(): void {
    this.showModal.set(false);
    this.selectedGroup.set(null);
    this.selectedMethodInModal.set(null);
    this.isSubmittingPayment.set(false);
    this.resetForm();
    this.releaseScrollLock();
  }

  selectMethodInModal(method: PaymentMethodConfig): void {
    this.selectedMethodInModal.set(method);
  }

  private resetForm(): void {
    this.formReferenceNumber.set('');
    this.formSourceBank.set('');
    this.formSenderName.set('');
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
      case 'senderName': this.formSenderName.set(value); break;
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
      // Zelle has a distinct field set: no sourceBank (USA banks not listed),
      // plus a required senderName to match the incoming Zelle notification.
      if (group.type === PaymentMethodType.ZELLE) {
        return !!(
          this.formReferenceNumber().trim() &&
          this.formSenderName().trim() &&
          this.formAmount().trim() &&
          this.formPaymentDate().trim()
        );
      }
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
    if (this.isSubmittingPayment()) return;

    const group = this.selectedGroup();
    const selectedMethod = this.selectedMethodInModal();
    if (!group) return;

    const submission: PaymentSubmission = {
      methodType: group.type,
      methodLabel: selectedMethod?.label || group.label,
      selectedMethodId: selectedMethod?.id,
    };

    if (this.isFormType(group.type)) {
      // Validate payment date is not in the future
      const paymentDate = this.formPaymentDate();
      if (paymentDate && paymentDate > this.todayStr) {
        this.errorMessage.set('La fecha de pago no puede ser futura');
        return;
      }
      submission.referenceNumber = this.formReferenceNumber().trim();
      submission.amount = parseFloat(this.formAmount()) || 0;
      submission.paymentDate = paymentDate;
      // Zelle ships senderName instead of sourceBank (no VE banks apply).
      if (group.type === PaymentMethodType.ZELLE) {
        submission.senderName = this.formSenderName().trim();
      } else {
        submission.sourceBank = this.formSourceBank().trim();
      }
    }

    this.isSubmittingPayment.set(true);
    this.errorMessage.set(null);

    // Upload proof file if selected, then finalize
    if (this.formProofFile()) {
      this.uploadService.uploadImage(this.formProofFile()!, 'payment-proofs').subscribe({
        next: (uploadRes) => {
          if (!uploadRes?.data?.url) {
            this.isSubmittingPayment.set(false);
            this.errorMessage.set('Error al subir el comprobante: respuesta invalida del servidor. Intenta nuevamente.');
            return;
          }
          submission.proofUrl = uploadRes.data.url;
          submission.proofPublicId = uploadRes.data.publicId;
          this.finalizePaymentSubmission(submission, group.type);
        },
        error: (err) => {
          // Stop the submission and surface the error so the user can retry
          this.isSubmittingPayment.set(false);
          const msg = err?.error?.message || 'No se pudo subir el comprobante. Verifica tu conexion e intenta nuevamente.';
          this.errorMessage.set(msg);
        },
      });
    } else {
      this.finalizePaymentSubmission(submission, group.type);
    }
  }

  private finalizePaymentSubmission(submission: PaymentSubmission, methodType: PaymentMethodType): void {
    this.submittedPayment.set(submission);
    this.submittedMethodType.set(methodType);
    this.paymentSubmitted.set(true);
    this.isSubmittingPayment.set(false);
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
        this.dispatchType === 'oil_change_service' && requestedDate ? requestedDate.date : undefined,
      requestedServiceTier:
        this.dispatchType === 'oil_change_service' && requestedDate ? requestedDate.tier : undefined,
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
}
