import { Coordinates, ScheduleDay } from './branch.model';

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

// ==================== Public catalogue (customer side) ====================

/** Any place of the catalogue, as the public routes name it. */
export interface GeoPlace {
  id: string;
  name: string;
  slug: string;
}

export interface GeoMunicipality extends GeoPlace {
  aliases: string[];
}

export interface GeoCity extends GeoPlace {
  isCapital: boolean;
}

export type GeoParish = GeoPlace;

/**
 * A place picked in the cascade: state and municipality always, city and
 * parish when the form asks for them. Names travel with the ids so an order
 * reads the same even if a place is renamed later.
 */
export interface LocationRef {
  state: { id: string; name: string };
  municipality: { id: string; name: string };
  city?: { id: string; name: string };
  parish?: { id: string; name: string };
}

/**
 * A place as orders and profiles store it on the server: ids plus names,
 * flattened. See `shared/utils/location-ref.util` to convert from and to
 * `LocationRef`.
 */
export interface StoredLocation {
  state: string;
  stateName: string;
  municipality: string;
  municipalityName: string;
  city?: string;
  cityName?: string;
  parish?: string;
  parishName?: string;
}

/** `full`: every covered parish gets delivery; `partial`: some; `none`: store pickup only. */
export type DeliveryStatus = 'full' | 'partial' | 'none';

/** A state with coverage, as the public coverage tree returns it. */
export interface GeoCoverageState {
  state: GeoPlace;
  hint: string;
  municipalities: Array<GeoPlace & { deliveryStatus: DeliveryStatus }>;
}

/** A municipality found by the search box, by its name, an alias or one of its cities. */
export interface GeoSearchHit {
  municipality: GeoPlace;
  state: GeoPlace;
  matchedBy: 'municipality' | 'alias' | 'city';
  cityName?: string;
}

export interface DeliveryTerms {
  hasDelivery: boolean;
  freeDelivery: boolean;
  deliveryCharge: number;
}

/** A branch as the coverage routes summarise it. */
export interface BranchSummary {
  id: string;
  name: string;
  address: string;
  whatsappPhone: string;
  schedule: ScheduleDay[];
  coordinates?: Coordinates;
  hasInStoreOilChange: boolean;
}

/** Who serves a municipality and on what terms, parish by parish (`/geo/coverage/municipalities/:id`). */
export interface MunicipalityCoverage {
  branches: BranchSummary[];
  cities: Array<{ id: string; name: string; parishes: Array<{ id: string; name: string } & DeliveryTerms> }>;
  deliveryStatus: DeliveryStatus;
  /** Cheapest delivery charge among the parishes that get delivery; null when none does. */
  minDeliveryCharge: number | null;
  /** Every parish with delivery is free (and at least one delivers). */
  allFree: boolean;
}

/** Delivery to one parish, folded over the branches that serve it (`/geo/coverage/parishes/:id`). */
export interface ParishDelivery extends DeliveryTerms {
  branchIds: string[];
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

/**
 * One zone of a branch as the panel saves it. `id` names an existing
 * assignment; an existing one sent without `cityConfig` is kept as it is.
 * Zones of the branch left out of the list are removed.
 */
export interface BranchAssignmentSave {
  id: string | null;
  zoneId: string;
  cityConfig?: CityDeliveryConfig[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

/** Terms a city gets when first added to an assigned zone (same default as the server). */
export const NEW_CITY_TERMS: DeliveryTerms = { hasDelivery: true, freeDelivery: true, deliveryCharge: 0 };
