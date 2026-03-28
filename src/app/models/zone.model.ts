import { City } from './city.model';

/**
 * Zone — operational coverage area created by admin.
 * References a City and contains a subset of its municipality slugs.
 */
export interface Zone {
  id: string;
  name: string;
  city: City | string;
  municipalities: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateZoneRequest {
  name: string;
  city: string;
  municipalities: string[];
  isActive?: boolean;
}

export interface UpdateZoneRequest {
  name?: string;
  city?: string;
  municipalities?: string[];
  isActive?: boolean;
}

export interface ZoneResponse {
  success: boolean;
  data: Zone;
  message?: string;
}

export interface ZoneListResponse {
  success: boolean;
  data: Zone[];
}

export interface CheckNameResponse {
  success: boolean;
  data: { exists: boolean };
}
