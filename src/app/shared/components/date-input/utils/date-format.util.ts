/**
 * Pure utility functions for date parsing, formatting, and masking.
 *
 * - No Angular dependencies (testable in isolation).
 * - Uses native Intl.DateTimeFormat — zero external libs.
 * - Internal contract: backend-facing dates are always ISO `YYYY-MM-DD`
 *   (local-calendar interpretation, NOT UTC).
 */

/** Pattern matching a valid ISO calendar-date string (no time component). */
const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Spanish month names indexed 0-11 (matches Date.getMonth()). */
export const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** Short 3-letter month labels — used in the compact month-selector grid. */
export const MONTH_NAMES_ES_SHORT = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
];

/** Short weekday names starting Monday (matches ISO week convention). */
export const WEEKDAY_NAMES_SHORT_ES = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

/**
 * Parse an ISO `YYYY-MM-DD` string as LOCAL midnight.
 * Avoids the classic `new Date("2026-04-15")` bug where the string is
 * interpreted as UTC and shifts a day in negative-offset timezones.
 */
export function parseIsoLocal(iso: string): Date | null {
  const match = ISO_DATE_REGEX.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const date = new Date(year, month - 1, day);
  // Guard against invalid rollover (e.g. 2026-02-30 -> March)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/**
 * Format a Date as ISO `YYYY-MM-DD` using LOCAL calendar fields.
 * Never uses `toISOString()` to avoid UTC drift.
 */
export function formatIsoLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format a Date for display as `DD/MM/YYYY` (es-VE convention).
 */
export function formatDisplay(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * Convert ISO `YYYY-MM-DD` to display `DD/MM/YYYY`.
 * Returns empty string when input is falsy or invalid.
 */
export function isoToDisplay(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = parseIsoLocal(iso);
  return date ? formatDisplay(date) : '';
}

/**
 * Parse a user-typed string into ISO `YYYY-MM-DD`.
 *
 * Accepts flexible input per NN/g guidelines:
 *   - "15/04/2026"  ✓
 *   - "15-04-2026"  ✓
 *   - "15.4.26"     ✓ (2-digit year → 20xx)
 *   - "15042026"    ✓ (no separators)
 *   - "1/4/2026"    ✓ (no leading zeros)
 *
 * Returns null when the input cannot be parsed as a valid calendar date.
 */
export function parseFlexibleDate(input: string): string | null {
  if (!input) return null;
  const clean = input.trim();
  if (!clean) return null;

  // Remove all non-digit characters, keep just the digits
  const digits = clean.replace(/\D/g, '');

  let day: number, month: number, year: number;

  if (digits.length === 8) {
    // DDMMYYYY
    day = Number(digits.slice(0, 2));
    month = Number(digits.slice(2, 4));
    year = Number(digits.slice(4, 8));
  } else if (digits.length === 6) {
    // DDMMYY
    day = Number(digits.slice(0, 2));
    month = Number(digits.slice(2, 4));
    year = 2000 + Number(digits.slice(4, 6));
  } else {
    // Try separator-based parsing for variable-length parts (1/4/2026 etc.)
    const parts = clean.split(/[\/\-. ]+/).filter(Boolean);
    if (parts.length !== 3) return null;
    day = Number(parts[0]);
    month = Number(parts[1]);
    year = Number(parts[2]);
    if (year < 100) year += 2000;
  }

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return formatIsoLocal(date);
}

/**
 * Apply progressive mask `DD/MM/YYYY` as the user types.
 *
 * - Strips non-digits, auto-inserts `/` at positions 2 and 4.
 * - Caps at 8 digits (DDMMYYYY).
 * - Returns the masked string for display in the input.
 *
 * Example: "15042" → "15/04/2"
 */
export function applyMask(rawInput: string): string {
  const digits = rawInput.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Compare two ISO dates. Returns negative if a<b, 0 if equal, positive if a>b.
 * Safe for string comparison since ISO `YYYY-MM-DD` is lexicographically ordered.
 */
export function compareIso(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Check whether an ISO date falls within [min, max]. Nulls are treated as
 * unbounded — `isWithinBounds('2026-04-15', null, null)` is always true.
 */
export function isWithinBounds(
  iso: string,
  min: string | null,
  max: string | null,
): boolean {
  if (min && compareIso(iso, min) < 0) return false;
  if (max && compareIso(iso, max) > 0) return false;
  return true;
}

/** Returns today as ISO `YYYY-MM-DD` in local calendar. */
export function todayIso(): string {
  return formatIsoLocal(new Date());
}
