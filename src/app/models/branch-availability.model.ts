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

/**
 * Effective sub-window for a single mechanic on a specific calendar date,
 * with `dateBlocks` already applied. Times are expressed in minutes since
 * 00:00 in the business timezone (so the client compares them directly
 * against its own "now minutes" snapshot).
 */
export interface MechanicEffectiveWindow {
  openMin: number;
  closeMin: number;
  serviceDurationMinutes: number;
}

export interface BranchAvailability {
  branchId: string;
  schedule: BranchAvailabilityDay[];
  fullyBlockedDates: string[];
  minServiceDurationMinutes: number;
  hasMechanics: boolean;
  /** Business "today" at the moment the envelope was built (YYYY-MM-DD). */
  todayIso: string;
  /** Business "tomorrow" (today + 1, YYYY-MM-DD). */
  tomorrowIso: string;
  /** Effective per-mechanic sub-windows for `todayIso`. Empty array means
   *  no mechanic can attend today (weekly closed or fully blocked). */
  todayWindows: MechanicEffectiveWindow[];
  /** Effective per-mechanic sub-windows for `tomorrowIso`. */
  tomorrowWindows: MechanicEffectiveWindow[];
}

export interface BranchAvailabilityResponse {
  success: boolean;
  data: BranchAvailability;
}
