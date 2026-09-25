import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { User } from '@models/user.model';
import {
  ADDRESS_FIELDS, CheckoutFieldLocks, PERSONAL_FIELDS, clearPersonalFields, fieldErrorMessage, profileAddressLine,
} from './checkout-contact-form';

/** A form like the oil-change one: no alternative phone. */
const buildForm = () =>
  new FormGroup({
    fullName: new FormControl(''),
    documentType: new FormControl('V'),
    documentNumber: new FormControl(''),
    phone: new FormControl(''),
    email: new FormControl(''),
    location: new FormControl<unknown>(null),
    address: new FormControl(''),
    referencePoint: new FormControl(''),
  });

const user = {
  firstName: 'Ana', lastName: 'Pérez', documentType: 'V', documentNumber: '12345678',
  phone: '04141234567', alternativePhone: '04241234567', email: 'ana@correo.com',
  street: 'Av. Bolívar', houseNumber: '12', neighborhood: 'Centro',
} as unknown as User;

describe('CheckoutFieldLocks', () => {
  let form: ReturnType<typeof buildForm>;
  let locks: CheckoutFieldLocks;

  beforeEach(() => {
    form = buildForm();
    locks = TestBed.runInInjectionContext(() => new CheckoutFieldLocks(() => form));
  });

  it('fills and locks the personal data of the profile', () => {
    locks.lockPersonalFromProfile(user);

    expect(form.getRawValue().fullName).toBe('Ana Pérez');
    expect(form.get('documentNumber')!.disabled).toBeTrue();
    expect(locks.hasLockedPersonal()).toBeTrue();
    expect(locks.hasLockedAddress()).toBeFalse();
  });

  it('skips fields the form does not have', () => {
    expect(() => locks.lockPersonalFromProfile(user)).not.toThrow();
    expect(form.get('alternativePhone')).toBeNull();
  });

  it('leaves empty profile values unlocked', () => {
    locks.lockPersonalFromProfile({ ...user, phone: undefined } as unknown as User);

    expect(form.get('phone')!.enabled).toBeTrue();
  });

  it('unlocks only the fields asked for', () => {
    locks.lockPersonalFromProfile(user);
    locks.lock('address', 'Av. Bolívar');

    locks.unlock(PERSONAL_FIELDS);

    expect(locks.hasLockedPersonal()).toBeFalse();
    expect(locks.hasLockedAddress()).toBeTrue();
    expect(form.get('fullName')!.enabled).toBeTrue();
    expect(form.get('address')!.disabled).toBeTrue();

    locks.unlock(ADDRESS_FIELDS);
    expect(locks.hasLockedAddress()).toBeFalse();
  });
});

describe('checkout contact helpers', () => {
  it('empties the personal fields and resets the document type', () => {
    const form = buildForm();
    form.patchValue({ fullName: 'Ana', documentType: 'E', phone: '0414' });

    clearPersonalFields(form);

    expect(form.getRawValue()).toEqual(jasmine.objectContaining({ fullName: '', documentType: 'V', phone: '' }));
  });

  it('joins the profile address in one line', () => {
    expect(profileAddressLine(user)).toBe('Av. Bolívar, 12, Centro');
    expect(profileAddressLine({} as User)).toBe('');
  });

  it('uses the per-field required message when given', () => {
    const control = new FormControl(null, Validators.required);

    expect(fieldErrorMessage(control, 'location', { location: 'Elige la ciudad y la parroquia' }))
      .toBe('Elige la ciudad y la parroquia');
    expect(fieldErrorMessage(control, 'address')).toBe('Este campo es obligatorio');
  });

  it('explains the phone format', () => {
    const control = new FormControl('123', Validators.pattern(/^04\d{9}$/));

    expect(fieldErrorMessage(control, 'alternativePhone')).toContain('04XX-XXXXXXX');
  });
});
