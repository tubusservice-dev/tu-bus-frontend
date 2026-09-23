/**
 * Geographic catalogue (ubicaciones v2): State › Municipality › City › Parish,
 * and the delivery terms zones and branch assignments carry.
 */

export interface GeoState {
  id: string;
  code: string;
  name: string;
  slug: string;
  isActive?: boolean;
}

export interface GeoAdminParish {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

export interface GeoAdminCity {
  id: string;
  name: string;
  slug: string;
  isCapital: boolean;
  isActive: boolean;
  parishes: GeoAdminParish[];
}

export interface GeoAdminMunicipality {
  id: string;
  name: string;
  slug: string;
  aliases: string[];
  isActive: boolean;
  cities: GeoAdminCity[];
}

/** One state with its whole tree, inactive entries included (admin view). */
export interface GeoAdminTree {
  state: GeoState & { isActive: boolean };
  municipalities: GeoAdminMunicipality[];
}

/** A state with coverage, as the public coverage tree returns it. */
export interface GeoCoverageState {
  state: { id: string; name: string; slug: string };
  hint: string;
  municipalities: Array<{ id: string; name: string; slug: string; deliveryStatus: 'full' | 'partial' | 'none' }>;
}

export interface DeliveryTerms {
  hasDelivery: boolean;
  freeDelivery: boolean;
  deliveryCharge: number;
}

/** Delivery of one city of a zone for one branch, with per-parish exceptions. */
export interface CityDeliveryConfig extends DeliveryTerms {
  city: string;
  parishOverrides: Array<DeliveryTerms & { parish: string }>;
}

export interface CreateGeoZoneRequest {
  name: string;
  parishes: string[];
  isActive?: boolean;
}

export type UpdateGeoZoneRequest = Partial<CreateGeoZoneRequest>;

export interface CreateGeoAssignmentsRequest {
  branchId: string;
  zones: Array<{ zoneId: string; cityConfig?: CityDeliveryConfig[] }>;
}

export interface UpdateGeoAssignmentRequest {
  cityConfig?: CityDeliveryConfig[];
  isActive?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/** Terms a city gets when first added to an assigned zone (same default as the server). */
export const NEW_CITY_TERMS: DeliveryTerms = { hasDelivery: true, freeDelivery: true, deliveryCharge: 0 };
