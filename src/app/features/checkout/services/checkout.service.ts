import { Injectable, computed, signal, inject } from '@angular/core';
import { SettingsService } from '../../../core/services/settings.service';
import { CartService } from '../../../core/services/cart.service';
import { LocationService, BranchSummary } from '../../../core/services/location.service';
import { ShippingAgency } from '../../../models/product.model';
import { Vehicle } from '../../../models/vehicle.model';

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
  selectedVehicle: Vehicle | null;
  selectedBranch: BranchSummary | null;
  billingAddress: BillingAddress | null;
  paymentMethod: string | null;
  disclaimerAccepted: boolean;
}

const INITIAL_STATE: CheckoutState = {
  dispatchType: null,
  storePickupInfo: null,
  selectedShippingAgency: null,
  shippingRecipientInfo: null,
  localDeliveryRecipientInfo: null,
  sellerAgreementInfo: null,
  oilChangeServiceInfo: null,
  selectedVehicle: null,
  selectedBranch: null,
  billingAddress: null,
  paymentMethod: null,
  disclaimerAccepted: false,
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

    // 1. Retiro en Tienda — ALWAYS
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

    // 2. Delivery Local — ONLY if coverage AND delivery enabled
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

    // 3. Envio por Agencia — ALWAYS (user may be in a different state)
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

    // 4. Acordar con Vendedor — ALWAYS
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

    // 5. Cambio de Aceite a Domicilio — oil combo + coverage
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

    // 6. Cambio de Aceite en Tienda — oil combo + branch has service
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

    return options;
  });

  // ==================== STATE COMPUTEDS ====================

  readonly selectedShippingAgency = computed(() => this._state().selectedShippingAgency);
  readonly shippingRecipientInfo = computed(() => this._state().shippingRecipientInfo);
  readonly localDeliveryRecipientInfo = computed(() => this._state().localDeliveryRecipientInfo);
  readonly sellerAgreementInfo = computed(() => this._state().sellerAgreementInfo);
  readonly oilChangeServiceInfo = computed(() => this._state().oilChangeServiceInfo);
  readonly selectedVehicle = computed(() => this._state().selectedVehicle);
  readonly selectedBranch = computed(() => this._state().selectedBranch);
  readonly billingAddress = computed(() => this._state().billingAddress);
  readonly paymentMethod = computed(() => this._state().paymentMethod);
  readonly disclaimerAccepted = computed(() => this._state().disclaimerAccepted);

  readonly hasShippingAgency = computed(() => this._state().selectedShippingAgency !== null);
  readonly hasShippingRecipientInfo = computed(() => this._state().shippingRecipientInfo !== null);
  readonly hasLocalDeliveryRecipientInfo = computed(() => this._state().localDeliveryRecipientInfo !== null);
  readonly hasSellerAgreementInfo = computed(() => this._state().sellerAgreementInfo !== null);
  readonly hasOilChangeServiceInfo = computed(() => this._state().oilChangeServiceInfo !== null);
  readonly hasVehicle = computed(() => this._state().selectedVehicle !== null);
  readonly hasBranch = computed(() => this._state().selectedBranch !== null);
  readonly hasPaymentMethod = computed(() => this._state().paymentMethod !== null);

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
      // Preserve vehicle for oil change types
      selectedVehicle: (type === 'oil_change_service' || type === 'in_store_oil_change')
        ? state.selectedVehicle : null,
      // Preserve branch for pickup/in-store types
      selectedBranch: (type === 'store_pickup' || type === 'in_store_oil_change')
        ? state.selectedBranch : null,
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

  selectVehicle(vehicle: Vehicle): void {
    this._state.update((s) => ({ ...s, selectedVehicle: vehicle }));
  }

  clearVehicle(): void {
    this._state.update((s) => ({ ...s, selectedVehicle: null }));
  }

  selectBranch(branch: BranchSummary): void {
    this._state.update((s) => ({ ...s, selectedBranch: branch }));
  }

  clearBranch(): void {
    this._state.update((s) => ({ ...s, selectedBranch: null }));
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
      selectedVehicle: null,
      selectedBranch: null,
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
