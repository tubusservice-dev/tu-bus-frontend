export interface CarouselConfig {
  isEnabled: boolean;
  interval: number; // milliseconds
}

export interface WhatsAppConfig {
  phoneNumber: string;
  isEnabled: boolean;
}

export interface CarouselsConfig {
  /** Carrusel automático de productos destacados en el Home */
  homeCarousel: CarouselConfig;
}

export interface HomeHeroConfig {
  title: string;
  titleAccent: string;
  description: string;
}

export interface PaginationConfig {
  catalogLimit: number;
  adminLimit: number;
  allowUserCustomization: boolean;
}

export interface StorePickupConfig {
  address: string;
  schedule: string;
  phone: string;
  additionalInfo?: string;
}

export interface DispatchModulesConfig {
  storePickup: boolean;
  shippingAgency: boolean;
  localDelivery: boolean;
  sellerAgreement: boolean;
}

export interface DispatchConfig {
  modules: DispatchModulesConfig;
  storePickup: StorePickupConfig;
}

export const PAGINATION_OPTIONS = [10, 20, 50, 100] as const;

export interface Settings {
  whatsapp: WhatsAppConfig;
  carousels: CarouselsConfig;
  homeHero: HomeHeroConfig;
  pagination: PaginationConfig;
  dispatch: DispatchConfig;
  updatedAt?: string;
}

export interface UpdateDispatchDto {
  modules?: Partial<DispatchModulesConfig>;
  storePickup?: Partial<StorePickupConfig>;
}

export interface SettingsResponse {
  success: boolean;
  message?: string;
  data: Settings;
}

// Valores por defecto
export const DEFAULT_SETTINGS: Settings = {
  whatsapp: {
    phoneNumber: '573001234567',
    isEnabled: true,
  },
  carousels: {
    homeCarousel: { isEnabled: true, interval: 5000 },
  },
  homeHero: {
    title: 'Mantenimiento',
    titleAccent: 'Automotriz',
    description: 'Descubre nuestra selección de productos automotrices. Aceites, filtros, repuestos y combos para el mantenimiento de tu vehículo.',
  },
  pagination: {
    catalogLimit: 20,
    adminLimit: 20,
    allowUserCustomization: true,
  },
  dispatch: {
    modules: {
      storePickup: true,
      shippingAgency: false,
      localDelivery: false,
      sellerAgreement: false,
    },
    storePickup: {
      address: 'Av. Principal #123, Local 4, Centro Comercial Plaza',
      schedule: 'Lunes a Viernes: 9:00 AM - 6:00 PM | Sábados: 9:00 AM - 1:00 PM',
      phone: '+58 412-1234567',
      additionalInfo: '',
    },
  },
};

// Colores configurados en código (no editables desde admin) - TuBus Express
export const STORE_COLORS = {
  primary: '#001d56',      // rgb(0, 29, 86)
  secondary: '#003e99',    // rgb(0, 62, 153)
};

export const ADMIN_COLORS = {
  primary: '#001d56',      // rgb(0, 29, 86)
  secondary: '#00143c',    // rgb(0, 20, 60)
};
