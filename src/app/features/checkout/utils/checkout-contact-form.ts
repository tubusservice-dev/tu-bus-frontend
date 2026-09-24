import { computed, signal } from '@angular/core';
import { AbstractControl, FormGroup } from '@angular/forms';
import { User } from '@models/user.model';

/** Document types offered by the checkout contact forms. */
export const DOCUMENT_TYPES = [
  { code: 'V', name: 'V - Venezolano' },
  { code: 'E', name: 'E - Extranjero' },
  { code: 'J', name: 'J - Jurídico' },
  { code: 'P', name: 'P - Pasaporte' },
] as const;

export const PERSONAL_FIELDS = ['fullName', 'documentType', 'documentNumber', 'phone', 'alternativePhone', 'email'] as const;
export const ADDRESS_FIELDS = ['location', 'address', 'referencePoint'] as const;

/**
 * Profile values pre-filled into a checkout form are shown locked until the
 * customer unlocks them. One instance per form; fields the form does not have
 * are skipped, so every checkout form can share the same field lists.
 *
 * Takes a getter because the forms build their `FormGroup` in `ngOnInit`.
 */
export class CheckoutFieldLocks {
  private readonly locked = signal<Readonly<Record<string, true>>>({});

  readonly hasLockedPersonal = computed(() => PERSONAL_FIELDS.some((f) => this.locked()[f]));
  readonly hasLockedAddress = computed(() => ADDRESS_FIELDS.some((f) => this.locked()[f]));

  constructor(private readonly form: () => FormGroup) {}

  /** Fills a field with a profile value and locks it. */
  lock(field: string, value: unknown): void {
    const control = this.form().get(field);
    if (!control) return;
    control.patchValue(value);
    control.disable();
    this.locked.update((locked) => ({ ...locked, [field]: true }));
  }

  /** Disables the locked fields again, e.g. after the whole form was enabled. */
  reapply(): void {
    Object.keys(this.locked()).forEach((field) => this.form().get(field)?.disable({ emitEvent: false }));
  }

  unlock(fields: readonly string[]): void {
    fields.forEach((field) => this.form().get(field)?.enable());
    this.locked.update((locked) => {
      const next = { ...locked };
      fields.forEach((field) => delete next[field]);
      return next;
    });
  }

  /** Name, document, phones and email from the customer's profile. */
  lockPersonalFromProfile(user: User): void {
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    if (fullName) this.lock('fullName', fullName);
    if (user.documentType) this.lock('documentType', user.documentType);
    if (user.documentNumber) this.lock('documentNumber', user.documentNumber);
    if (user.phone) this.lock('phone', user.phone);
    if (user.alternativePhone) this.lock('alternativePhone', user.alternativePhone);
    if (user.email) this.lock('email', user.email);
  }
}

/** Empties the personal fields the form has (document type back to «V»). */
export function clearPersonalFields(form: FormGroup): void {
  const blank: Record<string, string> = {
    fullName: '', documentType: 'V', documentNumber: '', phone: '', alternativePhone: '', email: '',
  };
  PERSONAL_FIELDS.forEach((field) => form.get(field)?.setValue(blank[field]));
}

/** The profile's street address as one line, or '' when it has none. */
export function profileAddressLine(user: User): string {
  return [user.street, user.houseNumber, user.neighborhood].filter(Boolean).join(', ');
}

export function fieldHasError(control: AbstractControl | null): boolean {
  return control ? control.invalid && control.touched : false;
}

/**
 * The message shown under a checkout contact field. `requiredMessages`
 * overrides the generic «Este campo es obligatorio» for specific fields.
 */
export function fieldErrorMessage(
  control: AbstractControl | null,
  field: string,
  requiredMessages: Readonly<Record<string, string>> = {},
): string {
  if (!control || !control.errors) return '';
  const errors = control.errors;

  if (errors['required']) return requiredMessages[field] ?? 'Este campo es obligatorio';
  if (errors['minlength']) return `Mínimo ${errors['minlength'].requiredLength} caracteres`;
  if (errors['maxlength']) return `Máximo ${errors['maxlength'].requiredLength} caracteres`;
  if (errors['noNumbers']) return 'No se permiten números en este campo';
  if (errors['pattern']) {
    if (field === 'documentNumber') return 'Solo números, entre 6 y 10 dígitos';
    if (field === 'phone' || field === 'alternativePhone') return 'Formato: 04XX-XXXXXXX (ej: 04141234567)';
    if (field === 'email') return 'Ingresa un email válido (ej: nombre@correo.com)';
    if (field === 'fullName') return 'Solo letras, sin números';
    return 'Formato inválido';
  }
  if (errors['email']) return 'Ingresa un email válido';

  return 'Campo inválido';
}
