import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { toVenezuelanE164 } from '../utils/phone.util';

// ==================== REGEX PATTERNS ====================

/** Only letters (including accented), spaces, apostrophes, hyphens */
export const NAME_PATTERN = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]+$/;

/** Venezuelan mobile: 0414, 0424, 0412, 0416, 0426 + optional hyphen + 7 digits */
export const PHONE_VE_PATTERN = /^(0414|0424|0412|0416|0426)-?\d{7}$/;

/** Venezuelan landline: 02XX + optional hyphen + 7 digits */
export const LANDLINE_VE_PATTERN = /^(02\d{2})-?\d{7}$/;

/** Venezuelan cedula/document: 6 to 10 digits only */
export const DOCUMENT_NUMBER_PATTERN = /^\d{6,10}$/;

/** Venezuelan RIF: J-12345678-9, V-12345678-9, etc. */
export const RIF_PATTERN = /^[JVEGPC]-\d{8}-\d$/;

/** Strict email pattern */
export const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/** Venezuelan zip code: 4-5 digits */
export const ZIPCODE_PATTERN = /^\d{4,5}$/;

/** GPS coordinates: lat, lng */
export const COORDINATES_PATTERN = /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/;

// ==================== MAX LENGTH CONSTANTS ====================

export const MAX_NAME_LENGTH = 20;
export const MAX_FULLNAME_LENGTH = 100;
export const MAX_ADDRESS_LENGTH = 300;
export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_NOTES_LENGTH = 500;
export const MAX_REFERENCE_LENGTH = 200;
export const MAX_PHONE_LENGTH = 12;
export const MAX_DOCUMENT_LENGTH = 10;
export const MAX_ZIPCODE_LENGTH = 5;
export const MAX_COMPANY_NAME_LENGTH = 100;
export const MAX_STREET_LENGTH = 100;
export const MAX_HOUSE_NUMBER_LENGTH = 20;
export const MAX_MODEL_LENGTH = 50;
export const MAX_BRANCH_NAME_LENGTH = 100;

// ==================== CUSTOM VALIDATORS ====================

/** Rejects values containing digits — use for name fields */
export function noNumbersValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  if (/\d/.test(control.value)) {
    return { noNumbers: true };
  }
  return null;
}

/**
 * Accepts Venezuelan mobile numbers in either local (`04XXXXXXXXX`) or
 * international (`+58XXXXXXXXXX` / `58XXXXXXXXXX`) format. Empty values are
 * skipped so `Validators.required` owns emptiness.
 */
export function venezuelanPhoneValidator(control: AbstractControl): ValidationErrors | null {
  if (!control.value) return null;
  return toVenezuelanE164(control.value) ? null : { venezuelanPhone: true };
}

/**
 * Ensures the ISO date (`YYYY-MM-DD`) represents at least `minAge` full years
 * relative to today. Skips empty values so `Validators.required` owns emptiness.
 * Returns `{ minAge: { requiredAge, actualAge } }` on failure.
 */
export function minAgeValidator(minAge: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value: string | null = control.value;
    if (!value) return null;

    const birth = new Date(value);
    if (Number.isNaN(birth.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age < minAge ? { minAge: { requiredAge: minAge, actualAge: age } } : null;
  };
}

// ==================== UI HELPERS ====================

/**
 * Scrolls the first visible invalid/error field into view and focuses it.
 *
 * Call this AFTER `form.markAllAsTouched()` inside `onSubmit()` so Angular has
 * already stamped the `.ng-invalid.ng-touched` classes (or the project's own
 * `.input.error` class) on the offending controls.
 *
 * Uses a micro-delay (requestAnimationFrame) to wait for Angular's change
 * detection to flush the CSS classes into the DOM before querying.
 */
export function scrollToFirstFormError(container?: HTMLElement | null): void {
  // Defer one frame so template bindings ([class.error]) are applied first
  requestAnimationFrame(() => {
    const root: ParentNode = container ?? document;
    const selector = '.input.error, .ng-invalid.ng-touched, .field-error-anchor';
    const target = root.querySelector<HTMLElement>(selector);
    if (!target) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Focus the input if it's focusable — helps screen readers and keyboard users
    if (typeof target.focus === 'function') {
      try {
        target.focus({ preventScroll: true });
      } catch {
        /* noop — some elements throw on focus() */
      }
    }
  });
}
