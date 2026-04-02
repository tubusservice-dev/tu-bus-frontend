/**
 * Tipo de combustible del motor
 */
export enum FuelType {
  GASOLINA = 'gasolina',
  DIESEL = 'diesel',
  GAS = 'gas',
  HIBRIDO = 'hibrido',
}

/**
 * Viscosidad del aceite
 */
export enum OilViscosity {
  SAE_5W20 = '5W-20',
  SAE_5W30 = '5W-30',
  SAE_10W30 = '10W-30',
  SAE_10W40 = '10W-40',
  SAE_15W40 = '15W-40',
  SAE_20W50 = '20W-50',
  SAE_0W20 = '0W-20',
  SAE_0W40 = '0W-40',
}

/**
 * Tipo de aceite
 */
export enum OilType {
  MINERAL = 'mineral',
  SEMI_SINTETICO = 'semi-sintetico',
  SINTETICO = 'sintetico',
  ALTO_KILOMETRAJE = 'alto-kilometraje',
}

/**
 * Tipo de vehículo al que aplica el producto
 */
export enum VehicleType {
  ALL = 'all',
  CARRO = 'carro',
  CAMIONETA = 'camioneta',
  MOTO = 'moto',
  CAMION = 'camion',
  AUTOBUS = 'autobus',
  MAQUINARIA_PESADA = 'maquinaria-pesada',
}

/**
 * Labels para mostrar en UI del tipo de vehículo
 */
export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  [VehicleType.ALL]: 'Todos los vehículos',
  [VehicleType.CARRO]: 'Carro',
  [VehicleType.CAMIONETA]: 'Camioneta',
  [VehicleType.MOTO]: 'Moto',
  [VehicleType.CAMION]: 'Camión',
  [VehicleType.AUTOBUS]: 'Autobús',
  [VehicleType.MAQUINARIA_PESADA]: 'Maquinaria pesada',
};

/**
 * Motor compatible
 */
export interface CompatibleEngine {
  fuelType: FuelType;
  displacement: string;
  cylinders: number;
}

/**
 * Categoría
 */
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  isActive: boolean;
}

/**
 * Línea de productos
 */
export interface Line {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  isActive: boolean;
}

/**
 * Marca de productos
 */
export interface Brand {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  isActive: boolean;
}

/**
 * Configuración de cargos de envío
 */
export interface ShippingConfig {
  collectOnDelivery: boolean;
  freeShipping: boolean;
  additionalCharge: boolean;
  additionalChargeAmount: number;
}

/**
 * Agencia de envío
 */
export interface ShippingAgency {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  isActive: boolean;
  config: ShippingConfig;
}

/**
 * Producto
 */
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  sku: string;
  images: string[];
  brand?: string | Brand;
  productModel: string;
  vehicleType: VehicleType;
  compatibleEngines?: CompatibleEngine[];
  oilViscosity?: OilViscosity;
  oilType?: OilType;
  oilCapacityLiters?: number;
  disclaimerRequired?: boolean;
  price: number;
  comparePrice?: number;
  line?: string | Line;
  categories: (string | Category)[];
  tags: string[];
  isActive: boolean;
  isFeatured: boolean;
  isCombo: boolean;
  freeOilChangeService: boolean;
  createdAt: Date;
  /** Aggregated stock across zone branches (present when branchIds filter used) */
  totalStock?: number;
}

/**
 * Request para crear producto
 */
export interface CreateProductRequest {
  name: string;
  description?: string;
  sku?: string;
  images?: string[];
  brand?: string;
  productModel?: string;
  vehicleType?: VehicleType;
  compatibleEngines?: CompatibleEngine[];
  oilViscosity?: OilViscosity;
  oilType?: OilType;
  oilCapacityLiters?: number;
  disclaimerRequired?: boolean;
  price: number;
  comparePrice?: number;
  line?: string;
  categories?: string[];
  tags?: string[];
  isActive?: boolean;
  isFeatured?: boolean;
  isCombo?: boolean;
  freeOilChangeService?: boolean;
}

/**
 * Request para actualizar producto
 */
export type UpdateProductRequest = Partial<CreateProductRequest>;

/**
 * Respuesta de lista de productos
 */
export interface ProductListResponse {
  success: boolean;
  data: Product[];
  pagination: {
    total: number;
    pages: number;
    page: number;
    limit: number;
  };
}

/**
 * Respuesta de producto individual
 */
export interface ProductResponse {
  success: boolean;
  message?: string;
  data: Product;
}