/**
 * Business-timezone helpers for the client. Mirrors the backend contract:
 *   - The business operates on `BUSINESS_TZ` (Venezuela) — every "today",
 *     "tomorrow" and slot-clock decision must be evaluated against that
 *     calendar, not the host browser's clock.
 *   - Service dates received from the backend arrive as ISO strings whose
 *     time component is `00:00:00.000Z`. They represent the *calendar day*,
 *     not an instant — so they must be rendered with `timeZone: 'UTC'` to
 *     avoid the off-by-one drift that occurs when `new Date(iso)` falls
 *     into the previous day in negative-offset zones.
 *
 * Anyone formatting/comparing service dates in the UI must go through this
 * module so the rule cannot be silently broken in a new component.
 */

export const BUSINESS_TZ = 'America/Caracas';

/** Returns YYYY-MM-DD of the business calendar day at `at` (default: now). */
export function businessTodayIso(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** YYYY-MM-DD that is `days` calendar days after the business "today". */
export function businessIsoOffset(days: number, at: Date = new Date()): string {
  const today = businessTodayIso(at);
  const [y, m, d] = today.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

/** Extract YYYY-MM-DD from a backend-provided service date (string or Date). */
export function isoFromBackend(raw: string | Date | null | undefined): string {
  if (!raw) return '';
  const s = raw instanceof Date ? raw.toISOString() : String(raw);
  return s.slice(0, 10);
}

/**
 * Format a backend service date in Spanish, anchored to UTC so it always
 * renders the calendar day stored — never shifts by one in late-evening
 * timezones.
 */
export function formatBusinessDate(
  raw: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  const iso = isoFromBackend(raw);
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('es-VE', { ...options, timeZone: 'UTC' }).format(date);
}
