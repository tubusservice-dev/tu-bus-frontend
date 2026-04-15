/**
 * Modelo de Vehículo - Garaje Virtual
 */

export type VehicleOilType = 'mineral' | 'semi-sintetico' | 'sintetico';

/**
 * Broad classification of the vehicle. Kept decoupled from product-side
 * VehicleType even though current values coincide — different domains.
 */
export type VehicleCategory =
  | 'carro'
  | 'camioneta'
  | 'moto'
  | 'camion'
  | 'autobus'
  | 'maquinaria-pesada';

export interface EngineType {
  fuelType?: 'gasolina' | 'diesel' | 'gas' | 'hibrido';
  displacement?: string;
  cylinders?: number;
  oilCapacityLiters?: number;
  oilType?: VehicleOilType;
}

export interface Vehicle {
  id: string;
  user: string;
  placa?: string;
  marca: string;
  modelo: string;
  vehicleType: VehicleCategory;
  year?: number;
  kilometraje: number;
  engineType?: EngineType;
  isActive: boolean;
  createdAt: Date;
}

export interface CreateVehicleRequest {
  marca: string;
  modelo: string;
  vehicleType: VehicleCategory;
  placa?: string;
  year?: number;
  kilometraje?: number;
  engineType?: EngineType;
}

export interface UpdateVehicleRequest {
  placa?: string;
  marca?: string;
  modelo?: string;
  vehicleType?: VehicleCategory;
  year?: number;
  kilometraje?: number;
  engineType?: EngineType;
  isActive?: boolean;
}

export interface VehicleListResponse {
  success: boolean;
  data: Vehicle[];
  pagination: {
    total: number;
    pages: number;
    page: number;
    limit: number;
  };
}

export interface VehicleResponse {
  success: boolean;
  message?: string;
  data: Vehicle;
}

export const MARCAS_VEHICULOS_VE = [
  'Chevrolet', 'Toyota', 'Ford', 'Hyundai', 'Kia', 'Mitsubishi',
  'Nissan', 'Honda', 'Mazda', 'Jeep', 'Dodge', 'Chrysler',
  'Fiat', 'Renault', 'Peugeot', 'Volkswagen', 'Chery', 'Daewoo',
  'Suzuki', 'Subaru', 'BMW', 'Mercedes-Benz', 'Audi',
  'Iveco', 'Mack', 'International', 'Otro',
] as const;

export const CILINDRADAS = [
  '1.0L', '1.2L', '1.3L', '1.4L', '1.5L', '1.6L', '1.8L',
  '2.0L', '2.2L', '2.4L', '2.5L', '2.7L', '3.0L', '3.5L',
  '4.0L', '4.6L', '5.0L', '5.3L', '5.7L', '6.0L', '6.2L',
] as const;

export const TIPOS_COMBUSTIBLE = [
  { value: 'gasolina', label: 'Gasolina' },
  { value: 'diesel', label: 'Diésel' },
  { value: 'gas', label: 'Gas (GNV)' },
  { value: 'hibrido', label: 'Híbrido' },
] as const;

export const TIPOS_ACEITE = [
  { value: 'mineral', label: 'Mineral' },
  { value: 'semi-sintetico', label: 'Semi Sintético' },
  { value: 'sintetico', label: 'Sintético' },
] as const;

/** Options for the vehicle-type selector (excludes 'all' which is product-only) */
export const VEHICLE_CATEGORY_OPTIONS: { value: VehicleCategory; label: string }[] = [
  { value: 'carro', label: 'Carro' },
  { value: 'camioneta', label: 'Camioneta' },
  { value: 'moto', label: 'Moto' },
  { value: 'camion', label: 'Camión' },
  { value: 'autobus', label: 'Autobús' },
  { value: 'maquinaria-pesada', label: 'Maquinaria Pesada' },
];