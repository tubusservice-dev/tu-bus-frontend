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

export interface HeroImage {
  url: string;
  publicId: string;
  order: number;
}

export type FloatingStatPosition = 'left' | 'right';

export interface FloatingStat {
  value: string;
  label: string;
  isVisible: boolean;
  position: FloatingStatPosition;
}

export interface HeroImagesConfig {
  images: HeroImage[];
  carousel: CarouselConfig;
  floatingStats: FloatingStat[];
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

export interface ExchangeRateConfig {
  showBsPrice: boolean;
  useCustomRate: boolean;
}

export interface SupportContactConfig {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

export interface AdminNotificationsConfig {
  newOrder: boolean;
  paymentNote: boolean;
  mechanicRejection: boolean;
  customerCancellation: boolean;
  serviceProgress: boolean;
  browserPush: boolean;
}

export const PAGINATION_OPTIONS = [10, 20, 50, 100] as const;

export interface Settings {
  whatsapp: WhatsAppConfig;
  carousels: CarouselsConfig;
  homeHero: HomeHeroConfig;
  heroImages: HeroImagesConfig;
  pagination: PaginationConfig;
  dispatch: DispatchConfig;
  exchangeRate: ExchangeRateConfig;
  supportContact: SupportContactConfig;
  adminNotifications: AdminNotificationsConfig;
  updatedAt?: string;
}

export interface UpdateHeroImagesDto {
  images?: HeroImage[];
  carousel?: Partial<CarouselConfig>;
  floatingStats?: FloatingStat[];
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
  heroImages: {
    images: [],
    carousel: { isEnabled: true, interval: 5000 },
    floatingStats: [
      { value: '500+', label: 'Servicios', isVisible: true, position: 'left' },
      { value: '4.9', label: 'Valoración', isVisible: true, position: 'right' },
    ],
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
  exchangeRate: {
    showBsPrice: false,
    useCustomRate: false,
  },
  supportContact: {
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
  },
  adminNotifications: {
    newOrder: true,
    paymentNote: true,
    mechanicRejection: true,
    customerCancellation: true,
    serviceProgress: true,
    browserPush: true,
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
