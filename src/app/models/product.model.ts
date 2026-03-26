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
 * Región del producto (ciudad + municipio)
 */
export interface ProductRegion {
  city: string | { id: string; name: string; code: string; municipalities?: Array<{ code: string; name: string; isActive: boolean }> };
  municipalityCode: string;
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
  compatibleEngines?: CompatibleEngine[];
  oilViscosity?: OilViscosity;
  oilType?: OilType;
  oilCapacityLiters?: number;
  disclaimerRequired?: boolean;
  price: number;
  comparePrice?: number;
  stock: number;
  line?: string | Line;
  categories: (string | Category)[];
  tags: string[];
  isActive: boolean;
  isFeatured: boolean;
  isCombo: boolean;
  freeOilChangeService: boolean;
  branches?: any[];
  createdAt: Date;
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
  compatibleEngines?: CompatibleEngine[];
  oilViscosity?: OilViscosity;
  oilType?: OilType;
  oilCapacityLiters?: number;
  disclaimerRequired?: boolean;
  price: number;
  comparePrice?: number;
  stock?: number;
  line?: string;
  categories?: string[];
  tags?: string[];
  isActive?: boolean;
  isFeatured?: boolean;
  isCombo?: boolean;
  freeOilChangeService?: boolean;
  branches?: string[];
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