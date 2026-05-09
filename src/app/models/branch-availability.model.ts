/**
 * Aggregated availability of a branch — the union of every active mechanic's
 * weekly schedule and date blocks. Returned by `GET /api/branches/:id/availability`.
 *
 * The `day` field follows JS convention (0 = Sunday … 6 = Saturday) so it can
 * be compared directly against `new Date(iso).getDay()`.
 */
export interface BranchAvailabilityDay {
  day: number;
  isClosed: boolean;
  earliestOpen: string;
  latestClose: string;
}

export interface BranchAvailability {
  branchId: string;
  schedule: BranchAvailabilityDay[];
  fullyBlockedDates: string[];
  minServiceDurationMinutes: number;
  hasMechanics: boolean;
}

export interface BranchAvailabilityResponse {
  success: boolean;
  data: BranchAvailability;
}
