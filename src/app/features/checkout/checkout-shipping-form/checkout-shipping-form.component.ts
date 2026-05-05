import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CheckoutService, ShippingRecipientInfo } from '../services/checkout.service';
import { CartService } from '../../../core/services/cart.service';
import { AuthService } from '../../../core/services/auth.service';
import { getStates, getCitiesByState, getMunicipalitiesByState } from '../../../shared/data/venezuela-states';
import {
  NAME_PATTERN, PHONE_VE_PATTERN, DOCUMENT_NUMBER_PATTERN, EMAIL_PATTERN,
  MAX_FULLNAME_LENGTH, MAX_ADDRESS_LENGTH, MAX_REFERENCE_LENGTH, MAX_NOTES_LENGTH,
  MAX_PHONE_LENGTH, MAX_DOCUMENT_LENGTH, noNumbersValidator, scrollToFirstFormError,
} from '../../../shared/validators/form-validators';
import { CheckoutHeaderComponent } from '../components/checkout-header/checkout-header.component';

@Component({
  selector: 'app-checkout-shipping-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CheckoutHeaderComponent],
  templateUrl: './checkout-shipping-form.component.html',
  styleUrl: './checkout-shipping-form.component.scss',
})
export class CheckoutShippingFormComponent implements OnInit {
  protected readonly checkoutService = inject(CheckoutService);
  protected readonly cartService = inject(CartService);
  protected readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected shippingForm!: FormGroup;
  protected readonly selectedAgency = this.checkoutService.selectedShippingAgency;
  protected readonly lockedFields = signal<Record<string, boolean>>({});

  // Reference data — all 24 Venezuelan states with cities and municipalities
  protected readonly states = signal<{ code: string; name: string }[]>([]);
  protected readonly cities = signal<{ code: string; name: string }[]>([]);
  protected readonly municipalities = signal<{ code: string; name: string }[]>([]);

  protected readonly documentTypes = [
    { code: 'V', name: 'V - Venezolano' },
    { code: 'E', name: 'E - Extranjero' },
    { code: 'J', name: 'J - Jurídico' },
    { code: 'P', name: 'P - Pasaporte' },
  ];

  ngOnInit(): void {
    if (!this.selectedAgency()) {
      this.router.navigate(['/checkout/agencia']);
      return;
    }

    this.initForm();
    this.loadReferenceStates();
    this.loadSavedData();
  }

  private loadReferenceStates(): void {
    this.states.set(getStates());
  }

  private initForm(): void {
    this.shippingForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(MAX_FULLNAME_LENGTH), Validators.pattern(NAME_PATTERN), noNumbersValidator]],
      documentType: ['V', Validators.required],
      documentNumber: ['', [Validators.required, Validators.pattern(DOCUMENT_NUMBER_PATTERN)]],
      phone: ['', [Validators.required, Validators.pattern(PHONE_VE_PATTERN)]],
      alternativePhone: ['', [Validators.pattern(PHONE_VE_PATTERN)]],
      email: ['', [Validators.pattern(EMAIL_PATTERN)]],
      stateCode: ['', Validators.required],
      cityCode: ['', Validators.required],
      municipalityCode: [''],
      address: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(MAX_ADDRESS_LENGTH)]],
      referencePoint: ['', Validators.maxLength(MAX_REFERENCE_LENGTH)],
      agencyOfficeCode: ['', Validators.maxLength(50)],
      notes: ['', Validators.maxLength(MAX_NOTES_LENGTH)],
    });
  }

  private loadSavedData(): void {
    const savedInfo = this.checkoutService.shippingRecipientInfo();
    if (savedInfo) {
      this.shippingForm.patchValue(savedInfo);
    } else {
      // Refresh user profile from server to get latest data, then prefill
      this.authService.loadUserProfile().subscribe({
        next: () => this.prefillFromUserProfile(),
        error: () => this.prefillFromUserProfile(),
      });
    }
  }

  private prefillFromUserProfile(): void {
    const user = this.authService.currentUser();
    if (!user) return;

    const locked: Record<string, boolean> = {};
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();

    if (fullName) {
      this.shippingForm.patchValue({ fullName });
      this.shippingForm.get('fullName')?.disable();
      locked['fullName'] = true;
    }
    if (user.documentType) {
      this.shippingForm.patchValue({ documentType: user.documentType });
      this.shippingForm.get('documentType')?.disable();
      locked['documentType'] = true;
    }
    if (user.documentNumber) {
      this.shippingForm.patchValue({ documentNumber: user.documentNumber });
      this.shippingForm.get('documentNumber')?.disable();
      locked['documentNumber'] = true;
    }
    if (user.phone) {
      this.shippingForm.patchValue({ phone: user.phone });
      this.shippingForm.get('phone')?.disable();
      locked['phone'] = true;
    }
    if (user.alternativePhone) {
      this.shippingForm.patchValue({ alternativePhone: user.alternativePhone });
      this.shippingForm.get('alternativePhone')?.disable();
      locked['alternativePhone'] = true;
    }
    if (user.email) {
      this.shippingForm.patchValue({ email: user.email });
      this.shippingForm.get('email')?.disable();
      locked['email'] = true;
    }

    // Prefill address fields and lock them
    if (user.stateName) {
      const stateMatch = this.states().find((s: any) => s.name === user.stateName);
      if (stateMatch) {
        this.shippingForm.patchValue({ stateCode: stateMatch.code });
        this.shippingForm.get('stateCode')?.disable();
        locked['stateCode'] = true;
        this.loadReferenceCities(stateMatch.code, user.cityCode, user.municipalityCode);
      }
    }
    if (user.cityCode || user.cityName) {
      locked['cityCode'] = true;
    }
    if (user.municipalityCode || user.municipalityName) {
      locked['municipalityCode'] = true;
    }
    const addressParts = [user.street, user.houseNumber, user.neighborhood].filter(Boolean);
    if (addressParts.length > 0) {
      this.shippingForm.patchValue({ address: addressParts.join(', ') });
      this.shippingForm.get('address')?.disable();
      locked['address'] = true;
    }
    if (user.referencePoint) {
      this.shippingForm.patchValue({ referencePoint: user.referencePoint });
      this.shippingForm.get('referencePoint')?.disable();
      locked['referencePoint'] = true;
    }

    this.lockedFields.set(locked);
  }

  protected onStateChange(): void {
    const stateCode = this.shippingForm.get('stateCode')?.value;
    this.shippingForm.patchValue({ cityCode: '', municipalityCode: '' });
    this.cities.set([]);
    this.municipalities.set([]);
    if (stateCode) {
      this.cities.set(getCitiesByState(stateCode));
      this.municipalities.set(getMunicipalitiesByState(stateCode));
    }
  }

  protected onCityChange(): void {
    // City and municipality are independent lists within a state — no cascade needed
  }

  private loadReferenceCities(stateCode: string, preselectedCity?: string, preselectedMuni?: string): void {
    this.cities.set(getCitiesByState(stateCode));
    this.municipalities.set(getMunicipalitiesByState(stateCode));

    if (preselectedCity) {
      this.shippingForm.patchValue({ cityCode: preselectedCity });
      this.shippingForm.get('cityCode')?.disable();
    }
    if (preselectedMuni) {
      this.shippingForm.patchValue({ municipalityCode: preselectedMuni });
      this.shippingForm.get('municipalityCode')?.disable();
    }
  }

  private loadReferenceMunicipalities(_stateCode: string, _cityName: string): void {
    // Municipalities loaded together with cities in onStateChange
  }

  protected readonly hasLockedFields = computed(() => {
    const locked = this.lockedFields();
    return ['fullName', 'documentType', 'documentNumber', 'phone', 'alternativePhone', 'email']
      .some(f => locked[f]);
  });

  protected readonly hasLockedAddressFields = computed(() => {
    const locked = this.lockedFields();
    return ['stateCode', 'cityCode', 'municipalityCode', 'address', 'referencePoint']
      .some(f => locked[f]);
  });

  protected unlockAddressFields(): void {
    const fields = ['stateCode', 'cityCode', 'municipalityCode', 'address', 'referencePoint'];
    fields.forEach(field => this.shippingForm.get(field)?.enable());
    const updated = { ...this.lockedFields() };
    fields.forEach(f => delete updated[f]);
    this.lockedFields.set(updated);
  }

  protected unlockPersonalFields(): void {
    const allFields = ['fullName', 'documentType', 'documentNumber', 'phone', 'alternativePhone', 'email',
      'stateCode', 'cityCode', 'municipalityCode', 'address', 'referencePoint'];
    allFields.forEach(field => this.shippingForm.get(field)?.enable());
    this.lockedFields.set({});
  }

  protected clearPersonalFields(): void {
    this.shippingForm.patchValue({
      fullName: '',
      documentType: 'V',
      documentNumber: '',
      phone: '',
      alternativePhone: '',
      email: '',
    });
  }

  protected clearShippingFields(): void {
    const addressFields = ['stateCode', 'cityCode', 'municipalityCode', 'address', 'referencePoint', 'agencyOfficeCode', 'notes'];
    addressFields.forEach(field => this.shippingForm.get(field)?.enable());
    this.shippingForm.patchValue({
      stateCode: '',
      cityCode: '',
      municipalityCode: '',
      address: '',
      referencePoint: '',
      agencyOfficeCode: '',
      notes: '',
    });
    // Remove address locks
    const updated = { ...this.lockedFields() };
    addressFields.forEach(f => delete updated[f]);
    this.lockedFields.set(updated);
    this.cities.set([]);
    this.municipalities.set([]);
  }

  onSubmit(): void {
    if (this.shippingForm.invalid) {
      this.shippingForm.markAllAsTouched();
      scrollToFirstFormError();
      return;
    }

    const formValue = this.shippingForm.getRawValue();
    const selectedState = this.states().find((s: any) => s.code === formValue.stateCode);
    const selectedCity = this.cities().find((c: any) => c.code === formValue.cityCode);
    const selectedMuni = this.municipalities().find((m: any) => m.code === formValue.municipalityCode);

    const shippingInfo: ShippingRecipientInfo = {
      fullName: formValue.fullName.trim(),
      documentType: formValue.documentType,
      documentNumber: formValue.documentNumber,
      phone: formValue.phone,
      alternativePhone: formValue.alternativePhone || undefined,
      email: formValue.email || undefined,
      state: selectedState?.name || formValue.stateCode,
      city: selectedCity?.name || formValue.cityCode,
      municipality: selectedMuni?.name || undefined,
      address: formValue.address.trim(),
      referencePoint: formValue.referencePoint?.trim() || undefined,
      agencyOfficeCode: formValue.agencyOfficeCode?.trim() || undefined,
      notes: formValue.notes?.trim() || undefined,
    };

    this.checkoutService.setShippingRecipientInfo(shippingInfo);
    this.router.navigate(['/checkout/resumen']);
  }

  goBack(): void {
    this.router.navigate(['/checkout/agencia']);
  }

  getStateName(code: string): string {
    return this.states().find((s: any) => s.code === code)?.name || code;
  }

  hasError(field: string): boolean {
    const control = this.shippingForm.get(field);
    return control ? control.invalid && control.touched : false;
  }

  getErrorMessage(field: string): string {
    const control = this.shippingForm.get(field);
    if (!control || !control.errors) return '';

    if (control.errors['required']) return 'Este campo es obligatorio';
    if (control.errors['minlength']) return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`;
    if (control.errors['maxlength']) return `Máximo ${control.errors['maxlength'].requiredLength} caracteres`;
    if (control.errors['noNumbers']) return 'No se permiten números en este campo';
    if (control.errors['pattern']) {
      if (field === 'documentNumber') return 'Solo números, entre 6 y 10 dígitos';
      if (field === 'phone' || field === 'alternativePhone') return 'Formato: 04XX-XXXXXXX (ej: 04141234567)';
      if (field === 'email') return 'Ingresa un email válido (ej: nombre@correo.com)';
      if (field === 'fullName') return 'Solo letras, sin números';
      return 'Formato inválido';
    }
    if (control.errors['email']) return 'Ingresa un email válido';

    return 'Campo inválido';
  }
}
