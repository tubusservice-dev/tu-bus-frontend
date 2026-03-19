import { Injectable, computed, signal, inject } from '@angular/core';
import { SettingsService } from '../../../core/services/settings.service';
import { ShippingAgency } from '../../../models/product.model';

export type DispatchType = 'store_pickup' | 'shipping_agency' | 'local_delivery' | 'seller_agreement' | null;

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

/** Información del destinatario del envío */
export interface ShippingRecipientInfo {
  fullName: string;
  documentType: 'V' | 'E' | 'J' | 'P';
  documentNumber: string;
  phone: string;
  alternativePhone?: string;
  email?: string;
  state: string;
  city: string;
  address: string;
  referencePoint?: string;
  agencyOfficeCode?: string;
  notes?: string;
}

/** Información del destinatario para delivery local */
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

export interface CheckoutState {
  dispatchType: DispatchType;
  storePickupInfo: StorePickupInfo | null;
  selectedShippingAgency: ShippingAgency | null;
  shippingRecipientInfo: ShippingRecipientInfo | null;
  localDeliveryRecipientInfo: LocalDeliveryRecipientInfo | null;
  paymentMethod: string | null;
  disclaimerAccepted: boolean;
}

const INITIAL_STATE: CheckoutState = {
  dispatchType: null,
  storePickupInfo: null,
  selectedShippingAgency: null,
  shippingRecipientInfo: null,
  localDeliveryRecipientInfo: null,
  paymentMethod: null,
  disclaimerAccepted: false,
};

@Injectable({
  providedIn: 'root',
})
export class CheckoutService {
  private readonly settingsService = inject(SettingsService);
  private readonly _state = signal<CheckoutState>(INITIAL_STATE);

  /** Estado público de solo lectura */
  readonly state = this._state.asReadonly();

  /** Tipo de despacho seleccionado */
  readonly dispatchType = computed(() => this._state().dispatchType);

  /** Verificar si hay un tipo de despacho seleccionado */
  readonly hasDispatchType = computed(() => this._state().dispatchType !== null);

  /** Configuración de dispatch desde settings */
  private readonly dispatchConfig = computed(() => this.settingsService.dispatchConfig());

  /** Información de la tienda para retiro (desde configuración) */
  readonly storeInfo = computed<StorePickupInfo>(() => {
    const config = this.dispatchConfig();
    return {
      address: config.storePickup.address,
      schedule: config.storePickup.schedule,
      phone: config.storePickup.phone,
      additionalInfo: config.storePickup.additionalInfo,
    };
  });

  /** Opciones de despacho disponibles (filtradas según configuración de módulos) */
  readonly dispatchOptions = computed<DispatchOption[]>(() => {
    const config = this.dispatchConfig();
    const modules = config.modules;
    const options: DispatchOption[] = [];

    // Retiro en Tienda - solo si está habilitado en módulos
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

    // Agencias de Envío - solo si está habilitado en módulos
    if (modules.shippingAgency) {
      options.push({
        id: 'shipping_agency',
        name: 'Agencias de Envío',
        description: 'Envío a través de agencias a nivel nacional',
        icon: 'truck',
        price: null,
        isAvailable: true,
      });
    }

    // Delivery Local - solo si está habilitado en módulos
    if (modules.localDelivery) {
      options.push({
        id: 'local_delivery',
        name: 'Delivery Local',
        description: 'Entrega a domicilio en tu zona de cobertura',
        icon: 'bike',
        price: null,
        isAvailable: true,
      });
    }

    // Acordar con Vendedor - solo si está habilitado en módulos (visual, no seleccionable)
    if (modules.sellerAgreement) {
      options.push({
        id: 'seller_agreement',
        name: 'Acordar con Vendedor',
        description: 'Coordina directamente con nosotros el método de entrega',
        icon: 'chat',
        price: null,
        isAvailable: false,
      });
    }

    return options;
  });

  /** Agencia de envío seleccionada */
  readonly selectedShippingAgency = computed(() => this._state().selectedShippingAgency);

  /** Información del destinatario (envío por agencia) */
  readonly shippingRecipientInfo = computed(() => this._state().shippingRecipientInfo);

  /** Información del destinatario (delivery local) */
  readonly localDeliveryRecipientInfo = computed(() => this._state().localDeliveryRecipientInfo);

  /** Verificar si hay una agencia seleccionada */
  readonly hasShippingAgency = computed(() => this._state().selectedShippingAgency !== null);

  /** Verificar si hay información de destinatario completa (envío por agencia) */
  readonly hasShippingRecipientInfo = computed(() => this._state().shippingRecipientInfo !== null);

  /** Verificar si hay información de destinatario completa (delivery local) */
  readonly hasLocalDeliveryRecipientInfo = computed(() => this._state().localDeliveryRecipientInfo !== null);

  /** Método de pago seleccionado */
  readonly paymentMethod = computed(() => this._state().paymentMethod);

  /** Verificar si hay un método de pago seleccionado */
  readonly hasPaymentMethod = computed(() => this._state().paymentMethod !== null);

  /** Disclaimer aceptado */
  readonly disclaimerAccepted = computed(() => this._state().disclaimerAccepted);

  /**
   * Seleccionar tipo de despacho
   */
  selectDispatchType(type: DispatchType): void {
    this._state.update((state) => ({
      ...state,
      dispatchType: type,
      storePickupInfo: type === 'store_pickup' ? this.storeInfo() : null,
      // Limpiar datos de envío si cambia el tipo
      selectedShippingAgency: type === 'shipping_agency' ? state.selectedShippingAgency : null,
      shippingRecipientInfo: type === 'shipping_agency' ? state.shippingRecipientInfo : null,
      localDeliveryRecipientInfo: type === 'local_delivery' ? state.localDeliveryRecipientInfo : null,
    }));
  }

  /**
   * Seleccionar agencia de envío
   */
  selectShippingAgency(agency: ShippingAgency): void {
    this._state.update((state) => ({
      ...state,
      selectedShippingAgency: agency,
    }));
  }

  /**
   * Establecer información del destinatario (envío por agencia)
   */
  setShippingRecipientInfo(info: ShippingRecipientInfo): void {
    this._state.update((state) => ({
      ...state,
      shippingRecipientInfo: info,
    }));
  }

  /**
   * Establecer información del destinatario (delivery local)
   */
  setLocalDeliveryRecipientInfo(info: LocalDeliveryRecipientInfo): void {
    this._state.update((state) => ({
      ...state,
      localDeliveryRecipientInfo: info,
    }));
  }

  /**
   * Seleccionar método de pago
   */
  selectPaymentMethod(method: string): void {
    this._state.update((state) => ({ ...state, paymentMethod: method }));
  }

  /**
   * Establecer aceptación del disclaimer
   */
  setDisclaimerAccepted(accepted: boolean): void {
    this._state.update((state) => ({ ...state, disclaimerAccepted: accepted }));
  }

  /**
   * Limpiar selección de agencia
   */
  clearShippingAgency(): void {
    this._state.update((state) => ({
      ...state,
      selectedShippingAgency: null,
      shippingRecipientInfo: null,
    }));
  }

  /**
   * Limpiar selección de despacho
   */
  clearDispatchType(): void {
    this._state.update((state) => ({
      ...state,
      dispatchType: null,
      storePickupInfo: null,
      selectedShippingAgency: null,
      shippingRecipientInfo: null,
      localDeliveryRecipientInfo: null,
    }));
  }

  /**
   * Resetear todo el estado del checkout
   */
  resetCheckout(): void {
    this._state.set(INITIAL_STATE);
  }

  /**
   * Obtener opción de despacho por ID
   */
  getDispatchOption(id: DispatchType): DispatchOption | undefined {
    return this.dispatchOptions().find((option) => option.id === id);
  }

  /**
   * Calcular costo de envío basado en la agencia seleccionada
   */
  getShippingCost(): number | null {
    const agency = this._state().selectedShippingAgency;
    if (!agency) return null;

    if (agency.config.freeShipping) {
      return 0;
    }

    if (agency.config.additionalCharge) {
      return agency.config.additionalChargeAmount;
    }

    // collectOnDelivery - el costo se paga al recibir
    return null;
  }

  /**
   * Obtener descripción del costo de envío
   */
  getShippingCostLabel(): string {
    const agency = this._state().selectedShippingAgency;
    if (!agency) return '';

    if (agency.config.freeShipping) {
      return 'Envío gratis';
    }

    if (agency.config.additionalCharge) {
      return `+$${agency.config.additionalChargeAmount.toFixed(2)}`;
    }

    return 'Pago en destino';
  }
}
