/**
 * Marcas de vehículos populares
 */
export const VEHICLE_BRANDS = [
  'Acura', 'Alfa Romeo', 'Aston Martin', 'Audi', 'Bentley', 'BMW', 'Bugatti',
  'Buick', 'Cadillac', 'Chevrolet', 'Chrysler', 'Citroën', 'Datsun', 'Dodge',
  'Ferrari', 'Fiat', 'Ford', 'GMC', 'Honda', 'Hummer', 'Hyundai', 'Infiniti',
  'Jaguar', 'Jeep', 'Kia', 'Koenigsegg', 'Lamborghini', 'Land Rover', 'Lexus',
  'Lincoln', 'Lotus', 'Maserati', 'Mazda', 'McLaren', 'Mercedes-Benz', 'Mercury',
  'Mini', 'Mitsubishi', 'Nissan', 'Oldsmobile', 'Opel', 'Pagani', 'Peugeot',
  'Plymouth', 'Pontiac', 'Porsche', 'Ram', 'Renault', 'Rolls-Royce', 'Saab',
  'Shelby', 'Subaru', 'Suzuki', 'Tesla', 'Toyota', 'Triumph', 'Volkswagen',
  'Volvo', 'Custom', 'Fantasy', 'Otro'
] as const;

/**
 * Opciones de marcas para select
 */
export const BRAND_OPTIONS = VEHICLE_BRANDS.map((brand) => ({
  value: brand,
  label: brand,
}));