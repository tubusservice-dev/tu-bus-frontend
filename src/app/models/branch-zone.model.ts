import { Branch } from './branch.model';
import { Zone } from './zone.model';
import { CityDeliveryConfig } from './geo.model';

/**
 * Delivery configuration for a single municipality within a BranchZone.
 */
export interface DeliveryConfigItem {
  municipality: string;
  hasDelivery: boolean;
  freeDelivery: boolean;
  deliveryCharge: number;
}

/**
 * BranchZone — pivot between Branch and Zone.
 * Contains delivery configuration per municipality.
 */
export interface BranchZone {
  id: string;
  branch: Branch | string;
  zone: Zone | string;
  deliveryConfig: DeliveryConfigItem[];
  /** Ubicaciones v2: delivery per geo city of the zone. */
  cityConfig?: CityDeliveryConfig[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBranchZoneBatchRequest {
  branchId: string;
  zones: Array<{
    zoneId: string;
    deliveryConfig?: DeliveryConfigItem[];
  }>;
}

export interface UpdateBranchZoneRequest {
  deliveryConfig?: DeliveryConfigItem[];
  isActive?: boolean;
}

export interface BranchZoneResponse {
  success: boolean;
  data: BranchZone;
  message?: string;
}

export interface BranchZoneListResponse {
  success: boolean;
  data: BranchZone[];
}

/**
 * Delivery coverage as the public `/branch-zones/coverage` route returns it:
 * the cities and municipalities a set of branches reaches, and nothing else.
 */
export interface CoverageCity {
  slug: string;
  name: string;
}

export interface CoverageMunicipality {
  slug: string;
  name: string;
  citySlug: string;
  /** Home delivery available here. The oil-change form lists every
   *  municipality; the local-delivery form keeps only these. */
  hasDelivery: boolean;
}

export interface BranchZoneCoverageResponse {
  success: boolean;
  data: {
    cities: CoverageCity[];
    municipalities: CoverageMunicipality[];
  };
}
