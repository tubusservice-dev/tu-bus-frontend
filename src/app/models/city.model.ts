/**
 * Municipality within a City (seed reference data).
 */
export interface Municipality {
  name: string;
  slug: string;
  /** Whether any branch delivers here. Present only on the coverage listing,
   *  which is what the location picker loads. */
  hasDelivery?: boolean;
}

/**
 * City — static reference data seeded from backend.
 * Admin does not manage cities directly.
 */
export interface City {
  id: string;
  name: string;
  slug: string;
  municipalities: Municipality[];
  isActive: boolean;
}

export interface CityListResponse {
  success: boolean;
  data: City[];
}

export interface CityResponse {
  success: boolean;
  data: City;
}
