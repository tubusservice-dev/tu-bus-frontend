/**
 * Phone normalization for Venezuelan mobile numbers.
 *
 * Canonical storage format: E.164 international (`+58XXXXXXXXXX`).
 * Accepts user input as either local (`04XXXXXXXXX`, with optional dashes/
 * spaces) or international (`+58XXXXXXXXXX` / `58XXXXXXXXXX`).
 */

const VE_LOCAL_RE = /^(0414|0424|0412|0416|0426)\d{7}$/;
const VE_INTL_DIGITS_RE = /^58(414|424|412|416|426)\d{7}$/;

function stripNonDigits(input: string | null | undefined): string {
  return (input ?? '').replace(/\D/g, '');
}

/**
 * Normalizes any accepted Venezuelan phone format to E.164 (`+58XXXXXXXXXX`).
 * Returns '' if the input cannot be parsed.
 */
export function toVenezuelanE164(input: string | null | undefined): string {
  const digits = stripNonDigits(input);
  if (!digits) return '';
  if (VE_LOCAL_RE.test(digits)) return '+58' + digits.substring(1);
  if (VE_INTL_DIGITS_RE.test(digits)) return '+' + digits;
  return '';
}

/**
 * Returns the digits used in `wa.me/<digits>` links — international format
 * without the leading `+`. Returns '' if the input cannot be parsed.
 */
export function toWhatsAppDigits(input: string | null | undefined): string {
  const e164 = toVenezuelanE164(input);
  return e164 ? e164.substring(1) : '';
}

/** True when input matches a valid VE local or international mobile. */
export function isValidVenezuelanPhone(input: string | null | undefined): boolean {
  return toVenezuelanE164(input) !== '';
}
