import { Branch } from './branch.model';
import { Zone } from './zone.model';

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
