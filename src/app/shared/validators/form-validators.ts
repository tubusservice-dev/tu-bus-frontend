import { AbstractControl, ValidationErrors } from '@angular/forms';

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
