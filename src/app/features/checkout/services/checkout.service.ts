import { Injectable, computed, signal, inject } from '@angular/core';
import { SettingsService } from '../../../core/services/settings.service';
import { CartService } from '../../../core/services/cart.service';
import { LocationService, BranchSummary } from '../../../core/services/location.service';
import { ShippingAgency } from '../../../models/product.model';
import { Vehicle } from '../../../models/vehicle.model';
import { EngineModificationStatus } from '../../../models/order.model';

// ============================================
// TYPES
// ============================================

export type DispatchType =
  | 'store_pickup'
  | 'shipping_agency'
  | 'local_delivery'
  | 'seller_agreement'
  | 'oil_change_service'
  | 'in_store_oil_change'
  | null;

export interface DispatchOption {
  id: DispatchType;
  name: string;
  description: string;
  icon: string;
  price: number | null;
  isAvailable: boolean;
}

export interface StorePickupInfo {
  address: string;
  schedule: string;
  phone?: string;
  additionalInfo?: string;
}

export interface ShippingRecipientInfo {
  fullName: string;
  documentType: 'V' | 'E' | 'J' | 'P';
  documentNumber: string;
  phone: string;
  alternativePhone?: string;
  email?: string;
  state: string;
  city: string;
  municipality?: string;
  address: string;
  referencePoint?: string;
  agencyOfficeCode?: string;
  notes?: string;
}

export interface LocalDeliveryRecipientInfo {
  fullName: string;
  documentType: 'V' | 'E' | 'J' | 'P';
  documentNumber: string;
  phone: string;
  alternativePhone?: string;
  email?: string;
  cityCode: string;
  cityName: string;
  municipalityCode: string;
  municipalityName: string;
  address: string;
  referencePoint?: string;
  notes?: string;
}

export interface SellerAgreementInfo {
  fullName: string;
  documentType: 'V' | 'E' | 'J' | 'P';
  documentNumber: string;
  phone: string;
  email?: string;
  notes?: string;
}

export interface OilChangeServiceInfo {
  fullName: string;
  documentType: 'V' | 'E' | 'J' | 'P';
  documentNumber: string;
  phone: string;
  email?: string;
  cityCode: string;
  cityName: string;
  municipalityCode: string;
  municipalityName: string;
  address: string;
  referencePoint?: string;
  vehicleInfo?: string;
  notes?: string;
}

export type ServiceDateTier = 'express' | 'tomorrow' | 'scheduled';

export interface RequestedServiceDate {
  tier: ServiceDateTier;
  date: string; // YYYY-MM-DD (local calendar day)
}

export interface BillingAddress {
  source: 'shipping' | 'profile' | 'custom';
  fullName?: string;
  documentType?: string;
  documentNumber?: string;
  address: string;
  city: string;
  municipality?: string;
  state?: string;
  referencePoint?: string;
}

// ============================================
// STATE
// ============================================

export interface CheckoutState {
  dispatchType: DispatchType;
  storePickupInfo: StorePickupInfo | null;
  selectedShippingAgency: ShippingAgency | null;
  shippingRecipientInfo: ShippingRecipientInfo | null;
  localDeliveryRecipientInfo: LocalDeliveryRecipientInfo | null;
  sellerAgreementInfo: SellerAgreementInfo | null;
  oilChangeServiceInfo: OilChangeServiceInfo | null;
  selectedVehicles: Vehicle[];
  selectedBranch: BranchSummary | null;
  requestedServiceDate: RequestedServiceDate | null;
  billingAddress: BillingAddress | null;
  paymentMethod: string | null;
  disclaimerAccepted: boolean;
  engineModification: EngineModificationStatus | null;
}

const BRANCH_AWARE_DISPATCH_TYPES: DispatchType[] = [
  'store_pickup',
  'in_store_oil_change',
  'oil_change_service',
];

const INITIAL_STATE: CheckoutState = {
  dispatchType: null,
  storePickupInfo: null,
  selectedShippingAgency: null,
  shippingRecipientInfo: null,
  localDeliveryRecipientInfo: null,
  sellerAgreementInfo: null,
  oilChangeServiceInfo: null,
  selectedVehicles: [],
  selectedBranch: null,
  requestedServiceDate: null,
  billingAddress: null,
  paymentMethod: null,
  disclaimerAccepted: false,
  engineModification: null,
};

// ============================================
// SERVICE
// ============================================

@Injectable({
  providedIn: 'root',
})
export class CheckoutService {
  private readonly settingsService = inject(SettingsService);
  private readonly cartService = inject(CartService);
  private readonly locationService = inject(LocationService);
  private readonly _state = signal<CheckoutState>(INITIAL_STATE);

  // ==================== PUBLIC READONLY STATE ====================

  readonly state = this._state.asReadonly();
  readonly dispatchType = computed(() => this._state().dispatchType);
  readonly hasDispatchType = computed(() => this._state().dispatchType !== null);

  // Dispatch config from admin settings
  private readonly dispatchConfig = computed(() => this.settingsService.dispatchConfig());

  // Store pickup info (from settings fallback)
  readonly storeInfo = computed<StorePickupInfo>(() => {
    const config = this.dispatchConfig();
    return {
      address: config.storePickup.address,
      schedule: config.storePickup.schedule,
      phone: config.storePickup.phone,
      additionalInfo: config.storePickup.additionalInfo,
    };
  });

  // ==================== DISPATCH OPTIONS ====================

  readonly dispatchOptions = computed<DispatchOption[]>(() => {
    const config = this.dispatchConfig();
    const modules = config.modules;
    const options: DispatchOption[] = [];
    const hasCoverage = this.locationService.hasCoverage();
    const hasOilChange = this.cartService.hasOilChangeService();

    // 1. Cambio de Aceite a Domicilio — oil combo + coverage (priority)
    if (hasOilChange && hasCoverage) {
      options.push({
        id: 'oil_change_service',
        name: 'Cambio de Aceite a Domicilio',
        description: 'Servicio de cambio de aceite gratis incluido con tu compra',
        icon: 'oil',
        price: null,
        isAvailable: true,
      });
    }

    // 2. Cambio de Aceite en Tienda — oil combo + branch has service
    if (hasOilChange && this.locationService.hasInStoreOilChange()) {
      options.push({
        id: 'in_store_oil_change',
        name: 'Cambio de Aceite en Tienda',
        description: 'Lleva tu vehiculo a la sucursal para el cambio de aceite',
        icon: 'wrench',
        price: null,
        isAvailable: true,
      });
    }

    // 3. Retiro en Tienda — ALWAYS
    if (modules.storePickup) {
      options.push({
        id: 'store_pickup',
        name: 'Retiro en Tienda',
        description: 'Recoge tu pedido en nuestra tienda sin costo adicional',
        icon: 'store',
        price: null,
        isAvailable: true,
      });
    }

    // 4. Delivery Local — ONLY if coverage AND delivery enabled
    if (hasCoverage && this.locationService.hasDelivery()) {
      const dc = this.locationService.deliveryConfig();
      const isFree = dc?.freeDelivery ?? false;
      const charge = dc?.deliveryCharge ?? 0;
      options.push({
        id: 'local_delivery',
        name: 'Delivery Local',
        description: isFree
          ? 'Entrega a domicilio gratis en tu zona'
          : `Entrega a domicilio en tu zona ($${charge.toFixed(2)})`,
        icon: 'bike',
        price: isFree ? null : charge,
        isAvailable: true,
      });
    }

    // 5. Envio por Agencia — ALWAYS
    if (modules.shippingAgency) {
      options.push({
        id: 'shipping_agency',
        name: 'Envio por Agencia',
        description: 'Envio a traves de agencias a nivel nacional',
        icon: 'truck',
        price: null,
        isAvailable: true,
      });
    }

    // 6. Acordar con Vendedor — ALWAYS
    if (modules.sellerAgreement) {
      options.push({
        id: 'seller_agreement',
        name: 'Acordar con Vendedor',
        description: 'Coordina directamente con nosotros el metodo de entrega',
        icon: 'chat',
        price: null,
        isAvailable: true,
      });
    }

    return options;
  });

  // ==================== STATE COMPUTEDS ====================

  readonly selectedShippingAgency = computed(() => this._state().selectedShippingAgency);
  readonly shippingRecipientInfo = computed(() => this._state().shippingRecipientInfo);
  readonly localDeliveryRecipientInfo = computed(() => this._state().localDeliveryRecipientInfo);
  readonly sellerAgreementInfo = computed(() => this._state().sellerAgreementInfo);
  readonly oilChangeServiceInfo = computed(() => this._state().oilChangeServiceInfo);
  readonly selectedVehicles = computed(() => this._state().selectedVehicles);
  readonly selectedVehicle = computed(() => this._state().selectedVehicles[0] ?? null); // @deprecated compat
  readonly selectedBranch = computed(() => this._state().selectedBranch);
  readonly requestedServiceDate = computed(() => this._state().requestedServiceDate);
  readonly hasRequestedServiceDate = computed(() => this._state().requestedServiceDate !== null);
  readonly billingAddress = computed(() => this._state().billingAddress);
  readonly paymentMethod = computed(() => this._state().paymentMethod);
  readonly disclaimerAccepted = computed(() => this._state().disclaimerAccepted);
  readonly engineModification = computed(() => this._state().engineModification);

  readonly hasShippingAgency = computed(() => this._state().selectedShippingAgency !== null);
  readonly hasShippingRecipientInfo = computed(() => this._state().shippingRecipientInfo !== null);
  readonly hasLocalDeliveryRecipientInfo = computed(() => this._state().localDeliveryRecipientInfo !== null);
  readonly hasSellerAgreementInfo = computed(() => this._state().sellerAgreementInfo !== null);
  readonly hasOilChangeServiceInfo = computed(() => this._state().oilChangeServiceInfo !== null);
  readonly hasVehicle = computed(() => this._state().selectedVehicles.length > 0);
  readonly hasVehicles = computed(() => this._state().selectedVehicles.length > 0);
  readonly hasBranch = computed(() => this._state().selectedBranch !== null);
  readonly hasPaymentMethod = computed(() => this._state().paymentMethod !== null);

  // ==================== VEHICLE ↔ PRODUCT COMPATIBILITY ====================

  /**
   * Reactive compatibility report. For each selected vehicle, counts how many
   * cart items are incompatible with its type. A product is compatible when:
   *   - It has no vehicleTypes metadata (unknown → assumed compatible), OR
   *   - Its vehicleTypes includes 'all' (universal category), OR
   *   - Its vehicleTypes includes the vehicle's type.
   *
   * Otherwise the product is counted as incompatible. The report is permissive
   * by design — we warn the user but never block the purchase.
   */
  readonly vehicleCompatibilityReport = computed(() => {
    const vehicles = this._state().selectedVehicles;
    const items = this.cartService.items();

    if (vehicles.length === 0 || items.length === 0) {
      return {
        hasAnyMismatch: false,
        allVehiclesMismatch: false,
        incompatibleVehicleNames: [] as string[],
        incompatibleProductCount: 0,
      };
    }

    const isCompatible = (
      itemVTs: string[] | undefined,
      vType: string | undefined
    ): boolean => {
      // Missing product metadata → permissive (no warning to avoid false positives)
      if (!itemVTs || itemVTs.length === 0) return true;
      // Universal category applies to every vehicle
      if (itemVTs.includes('all')) return true;
      // Missing vehicle type → treat as incompatible so the user notices
      if (!vType) return false;
      return itemVTs.includes(vType);
    };

    const incompatibleVehicleNames: string[] = [];
    const globalIncompatibleProductIds = new Set<string>();

    for (const v of vehicles) {
      const badItems = items.filter((it) => !isCompatible(it.vehicleTypes, v.vehicleType));
      if (badItems.length > 0) {
        incompatibleVehicleNames.push(`${v.marca} ${v.modelo}`.trim());
        for (const it of badItems) globalIncompatibleProductIds.add(it.id);
      }
    }

    return {
      hasAnyMismatch: incompatibleVehicleNames.length > 0,
      allVehiclesMismatch:
        incompatibleVehicleNames.length > 0 &&
        incompatibleVehicleNames.length === vehicles.length,
      incompatibleVehicleNames,
      incompatibleProductCount: globalIncompatibleProductIds.size,
    };
  });

  // ==================== DISPATCH ACTIONS ====================

  selectDispatchType(type: DispatchType): void {
    this._state.update((state) => ({
      ...state,
      dispatchType: type,
      storePickupInfo: type === 'store_pickup' ? this.storeInfo() : null,
      selectedShippingAgency: type === 'shipping_agency' ? state.selectedShippingAgency : null,
      shippingRecipientInfo: type === 'shipping_agency' ? state.shippingRecipientInfo : null,
      localDeliveryRecipientInfo: type === 'local_delivery' ? state.localDeliveryRecipientInfo : null,
      sellerAgreementInfo: type === 'seller_agreement' ? state.sellerAgreementInfo : null,
      oilChangeServiceInfo: type === 'oil_change_service' ? state.oilChangeServiceInfo : null,
      // Preserve vehicles only for oil change types
      selectedVehicles: (type === 'oil_change_service' || type === 'in_store_oil_change')
        ? state.selectedVehicles : [],
      // Preserve branch only for dispatch types that consume it
      selectedBranch: BRANCH_AWARE_DISPATCH_TYPES.includes(type!)
        ? state.selectedBranch
        : null,
      // Requested service date applies exclusively to home oil change
      requestedServiceDate: type === 'oil_change_service'
        ? state.requestedServiceDate
        : null,
    }));
  }

  selectShippingAgency(agency: ShippingAgency): void {
    this._state.update((s) => ({ ...s, selectedShippingAgency: agency }));
  }

  setShippingRecipientInfo(info: ShippingRecipientInfo): void {
    this._state.update((s) => ({ ...s, shippingRecipientInfo: info }));
  }

  setLocalDeliveryRecipientInfo(info: LocalDeliveryRecipientInfo): void {
    this._state.update((s) => ({ ...s, localDeliveryRecipientInfo: info }));
  }

  setSellerAgreementInfo(info: SellerAgreementInfo): void {
    this._state.update((s) => ({ ...s, sellerAgreementInfo: info }));
  }

  setOilChangeServiceInfo(info: OilChangeServiceInfo): void {
    this._state.update((s) => ({ ...s, oilChangeServiceInfo: info }));
  }

  addVehicle(vehicle: Vehicle): void {
    this._state.update((s) => {
      const exists = s.selectedVehicles.some((v) => v.id === vehicle.id);
      if (exists) return s;
      return { ...s, selectedVehicles: [...s.selectedVehicles, vehicle] };
    });
  }

  removeVehicle(vehicleId: string): void {
    this._state.update((s) => ({
      ...s,
      selectedVehicles: s.selectedVehicles.filter((v) => v.id !== vehicleId),
    }));
  }

  toggleVehicle(vehicle: Vehicle): void {
    const exists = this._state().selectedVehicles.some((v) => v.id === vehicle.id);
    if (exists) {
      this.removeVehicle(vehicle.id);
    } else {
      this.addVehicle(vehicle);
    }
  }

  clearVehicles(): void {
    this._state.update((s) => ({ ...s, selectedVehicles: [] }));
  }

  /** @deprecated Use addVehicle() instead */
  selectVehicle(vehicle: Vehicle): void {
    this._state.update((s) => ({ ...s, selectedVehicles: [vehicle] }));
  }

  /** @deprecated Use clearVehicles() instead */
  clearVehicle(): void {
    this._state.update((s) => ({ ...s, selectedVehicles: [] }));
  }

  selectBranch(branch: BranchSummary): void {
    this._state.update((s) => ({ ...s, selectedBranch: branch }));
  }

  clearBranch(): void {
    this._state.update((s) => ({ ...s, selectedBranch: null }));
  }

  setRequestedServiceDate(value: RequestedServiceDate | null): void {
    this._state.update((s) => ({ ...s, requestedServiceDate: value }));
  }

  setBillingAddress(address: BillingAddress): void {
    this._state.update((s) => ({ ...s, billingAddress: address }));
  }

  selectPaymentMethod(method: string): void {
    this._state.update((s) => ({ ...s, paymentMethod: method }));
  }

  setDisclaimerAccepted(accepted: boolean): void {
    this._state.update((s) => ({ ...s, disclaimerAccepted: accepted }));
  }

  setEngineModification(value: EngineModificationStatus | null): void {
    this._state.update((s) => ({ ...s, engineModification: value }));
  }

  // ==================== CLEAR / RESET ====================

  clearShippingAgency(): void {
    this._state.update((s) => ({
      ...s,
      selectedShippingAgency: null,
      shippingRecipientInfo: null,
    }));
  }

  clearDispatchType(): void {
    this._state.update((s) => ({
      ...s,
      dispatchType: null,
      storePickupInfo: null,
      selectedShippingAgency: null,
      shippingRecipientInfo: null,
      localDeliveryRecipientInfo: null,
      sellerAgreementInfo: null,
      oilChangeServiceInfo: null,
      selectedVehicles: [],
      selectedBranch: null,
      requestedServiceDate: null,
    }));
  }

  resetCheckout(): void {
    this._state.set(INITIAL_STATE);
  }

  // ==================== HELPERS ====================

  getDispatchOption(id: DispatchType): DispatchOption | undefined {
    return this.dispatchOptions().find((option) => option.id === id);
  }

  getShippingCost(): number | null {
    const state = this._state();

    // Delivery local cost
    if (state.dispatchType === 'local_delivery') {
      const dc = this.locationService.deliveryConfig();
      if (dc?.freeDelivery) return 0;
      return dc?.deliveryCharge ?? null;
    }

    // Agency cost
    const agency = state.selectedShippingAgency;
    if (!agency) return null;

    if (agency.config.freeShipping) return 0;
    if (agency.config.additionalCharge) return agency.config.additionalChargeAmount;

    return null;
  }

  getShippingCostLabel(): string {
    const state = this._state();

    if (state.dispatchType === 'local_delivery') {
      const dc = this.locationService.deliveryConfig();
      if (dc?.freeDelivery) return 'Delivery gratis';
      if (dc?.deliveryCharge) return `+$${dc.deliveryCharge.toFixed(2)}`;
      return '';
    }

    const agency = state.selectedShippingAgency;
    if (!agency) return '';

    if (agency.config.freeShipping) return 'Envio gratis';
    if (agency.config.additionalCharge) return `+$${agency.config.additionalChargeAmount.toFixed(2)}`;

    return 'Pago en destino';
  }
}
