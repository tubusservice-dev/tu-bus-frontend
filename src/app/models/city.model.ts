/**
 * Municipality within a City (seed reference data).
 */
export interface Municipality {
  name: string;
  slug: string;
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
