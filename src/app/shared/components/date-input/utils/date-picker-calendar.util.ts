/**
 * Pure calendar math for the date-picker panel.
 *
 * - No Angular dependencies (testable in isolation).
 * - "Now" is always passed in by the caller, so every function is deterministic.
 * - Dates travel as ISO `YYYY-MM-DD` (local calendar), same contract as
 *   `date-format.util`.
 */
import {
  formatIsoLocal,
  parseIsoLocal,
  compareIso,
  isWithinBounds,
  MONTH_NAMES_ES_SHORT,
} from './date-format.util';

/** Single cell rendered in the month (day) grid. */
export interface DayCell {
  iso: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
}

/** Single cell rendered in the month-selector grid. */
export interface MonthCell {
  monthIndex: number;     // 0-11
  monthName: string;      // "Ene", "Feb", ...
  isSelected: boolean;
  isCurrent: boolean;
  isDisabled: boolean;
}

/** Single cell rendered in the year-selector grid. */
export interface YearCell {
  year: number;
  isSelected: boolean;
  isCurrent: boolean;
  isDisabled: boolean;
}

/** Inclusive start/end years of one year-selector page. */
export interface YearRange {
  start: number;
  end: number;
}

/** Year + month (0-11) pair the day grid is showing. */
export interface MonthView {
  year: number;
  month: number;
}

/**
 * Three navigation views in ascending specificity:
 *   - `years`  → pick a year (drill-down entry point).
 *   - `months` → pick a month within the chosen year.
 *   - `days`   → pick a day within the chosen year+month.
 */
export type ViewMode = 'days' | 'months' | 'years';

/** Size of the year grid — 16 cells (4 columns × 4 rows). */
export const YEAR_PAGE_SIZE = 16;

/** Number of cells in the day grid — 6 weeks × 7 days. */
const DAY_GRID_SIZE = 42;

/** Inputs shared by every cell of the day grid. */
export interface DayGridOptions {
  draft: string;
  today: string;
  minBound: string | null;
  maxBound: string | null;
  /** Days of the week (0=Sunday … 6=Saturday) rendered as disabled. */
  closedDows: number[];
}

/** Year-selector page that contains `center`. */
export function getYearRange(center: number): YearRange {
  const start = center - Math.floor(YEAR_PAGE_SIZE / 2) + 1;
  return { start, end: start + YEAR_PAGE_SIZE - 1 };
}

/** 42-cell month grid (6 weeks × 7 days) starting on Monday. */
export function buildDayCells(year: number, month: number, options: DayGridOptions): DayCell[] {
  const firstOfMonth = new Date(year, month, 1);
  const firstDay = (firstOfMonth.getDay() + 6) % 7; // Monday=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const out: DayCell[] = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    out.push(buildDayCell(new Date(year, month, -i), false, options));
  }
  for (let day = 1; day <= daysInMonth; day++) {
    out.push(buildDayCell(new Date(year, month, day), true, options));
  }
  const remaining = DAY_GRID_SIZE - out.length;
  for (let day = 1; day <= remaining; day++) {
    out.push(buildDayCell(new Date(year, month + 1, day), false, options));
  }

  return out;
}

function buildDayCell(date: Date, isCurrentMonth: boolean, options: DayGridOptions): DayCell {
  const iso = formatIsoLocal(date);
  const outsideBounds = !isWithinBounds(iso, options.minBound, options.maxBound);
  const closedByDow =
    options.closedDows.length > 0 && options.closedDows.includes(date.getDay());
  return {
    iso,
    dayNumber: date.getDate(),
    isCurrentMonth,
    isToday: iso === options.today,
    isSelected: iso === options.draft,
    isDisabled: outsideBounds || closedByDow,
  };
}

/** 12 month cells for `year`. */
export function buildMonthCells(
  year: number,
  draft: string,
  today: Date,
  minBound: string | null,
  maxBound: string | null,
): MonthCell[] {
  const draftDate = draft ? parseIsoLocal(draft) : null;
  const draftYear = draftDate ? draftDate.getFullYear() : null;
  const draftMonth = draftDate ? draftDate.getMonth() : null;

  const out: MonthCell[] = [];
  for (let m = 0; m < 12; m++) {
    // A month is disabled when the entire month falls outside [min, max]
    const firstIso = formatIsoLocal(new Date(year, m, 1));
    const lastIso = formatIsoLocal(new Date(year, m + 1, 0));
    const isDisabled =
      (minBound !== null && compareIso(lastIso, minBound) < 0) ||
      (maxBound !== null && compareIso(firstIso, maxBound) > 0);

    out.push({
      monthIndex: m,
      monthName: MONTH_NAMES_ES_SHORT[m],
      isSelected: draftYear === year && draftMonth === m,
      isCurrent: today.getFullYear() === year && today.getMonth() === m,
      isDisabled,
    });
  }
  return out;
}

/**
 * Year cells for one page. With no draft, the year being viewed is marked as
 * selected so the grid always shows where the user is.
 */
export function buildYearCells(
  range: YearRange,
  draft: string,
  viewYear: number,
  currentYear: number,
  minBound: string | null,
  maxBound: string | null,
): YearCell[] {
  const draftYear = draft ? Number(draft.slice(0, 4)) : null;
  const minYear = minBound ? Number(minBound.slice(0, 4)) : null;
  const maxYear = maxBound ? Number(maxBound.slice(0, 4)) : null;

  const out: YearCell[] = [];
  for (let y = range.start; y <= range.end; y++) {
    const isDisabled =
      (minYear !== null && y < minYear) || (maxYear !== null && y > maxYear);
    out.push({
      year: y,
      isSelected: y === draftYear || (draftYear === null && y === viewYear),
      isCurrent: y === currentYear,
      isDisabled,
    });
  }
  return out;
}

/** Whether the back arrow may move past the current page, given `minBound`. */
export function canNavigatePrev(
  mode: ViewMode,
  view: MonthView,
  range: YearRange,
  minBound: string | null,
): boolean {
  if (!minBound) return true;
  const minYear = Number(minBound.slice(0, 4));

  switch (mode) {
    case 'years':
      return range.start > minYear;
    case 'months':
      return view.year > minYear;
    default: {
      const firstOfCurrent = formatIsoLocal(new Date(view.year, view.month, 1));
      return compareIso(firstOfCurrent, minBound) > 0;
    }
  }
}

/** Whether the forward arrow may move past the current page, given `maxBound`. */
export function canNavigateNext(
  mode: ViewMode,
  view: MonthView,
  range: YearRange,
  maxBound: string | null,
): boolean {
  if (!maxBound) return true;
  const maxYear = Number(maxBound.slice(0, 4));

  switch (mode) {
    case 'years':
      return range.end < maxYear;
    case 'months':
      return view.year < maxYear;
    default: {
      const lastOfCurrent = formatIsoLocal(new Date(view.year, view.month + 1, 0));
      return compareIso(lastOfCurrent, maxBound) < 0;
    }
  }
}

/** Moves a month view by `delta` months (±1), rolling the year over. */
export function shiftMonth(view: MonthView, delta: 1 | -1): MonthView {
  if (delta < 0 && view.month === 0) return { year: view.year - 1, month: 11 };
  if (delta > 0 && view.month === 11) return { year: view.year + 1, month: 0 };
  return { year: view.year, month: view.month + delta };
}

/**
 * Date the grid opens on when there is no value: today, clamped into
 * [min, max] so bounded pickers never open on a fully-disabled month
 * (e.g. age-gated birth date).
 */
export function computeInitialAnchor(
  today: Date,
  minBound: string | null,
  maxBound: string | null,
): Date {
  const todayIsoStr = formatIsoLocal(today);

  if (maxBound && compareIso(todayIsoStr, maxBound) > 0) {
    return parseIsoLocal(maxBound) ?? today;
  }
  if (minBound && compareIso(todayIsoStr, minBound) < 0) {
    return parseIsoLocal(minBound) ?? today;
  }
  return today;
}
