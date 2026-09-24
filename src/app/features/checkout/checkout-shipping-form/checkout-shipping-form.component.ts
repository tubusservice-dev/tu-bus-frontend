import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CheckoutService, ShippingRecipientInfo } from '../services/checkout.service';
import { CartService } from '@core/services/cart.service';
import { AuthService } from '@core/services/auth.service';
import { LocationRef } from '@models/geo.model';
import { fromStoredLocation } from '@shared/utils/location-ref.util';
import {
  NAME_PATTERN, PHONE_VE_PATTERN, DOCUMENT_NUMBER_PATTERN, EMAIL_PATTERN,
  MAX_FULLNAME_LENGTH, MAX_ADDRESS_LENGTH, MAX_REFERENCE_LENGTH, MAX_NOTES_LENGTH,
  noNumbersValidator, scrollToFirstFormError,
} from '@shared/validators/form-validators';
import { CheckoutHeaderComponent } from '../components/checkout-header/checkout-header.component';
import { LocationCascadeComponent } from '@shared/components/location-cascade/location-cascade.component';
import { PhoneMaskDirective } from '@shared/directives/phone-mask.directive';
import { ANALYTICS, AnalyticsEvent } from '@platform';

@Component({
  selector: 'app-checkout-shipping-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CheckoutHeaderComponent, LocationCascadeComponent, PhoneMaskDirective],
  templateUrl: './checkout-shipping-form.component.html',
  styleUrl: './checkout-shipping-form.component.scss',
})
export class CheckoutShippingFormComponent implements OnInit {
  protected readonly checkoutService = inject(CheckoutService);
  protected readonly cartService = inject(CartService);
  protected readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly analytics = inject(ANALYTICS);

  protected shippingForm!: FormGroup;
  protected readonly selectedAgency = this.checkoutService.selectedShippingAgency;
  protected readonly lockedFields = signal<Record<string, boolean>>({});

  protected readonly documentTypes = [
    { code: 'V', name: 'V - Venezolano' },
    { code: 'E', name: 'E - Extranjero' },
    { code: 'J', name: 'J - Jurídico' },
    { code: 'P', name: 'P - Pasaporte' },
  ];

  ngOnInit(): void {
    // Initialize the form FIRST so the template has a valid FormGroup during
    // the async navigation tick, even when we need to redirect away. Reloading
    // this URL drops the in-memory checkout state, so the redirect below is the
    // common path, not the rare one.
    this.initForm();

    if (!this.selectedAgency()) {
      this.router.navigate(['/checkout/agencia']);
      return;
    }

    this.loadSavedData();
  }

  private initForm(): void {
    this.shippingForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(MAX_FULLNAME_LENGTH), Validators.pattern(NAME_PATTERN), noNumbersValidator]],
      documentType: ['V', Validators.required],
      documentNumber: ['', [Validators.required, Validators.pattern(DOCUMENT_NUMBER_PATTERN)]],
      phone: ['', [Validators.required, Validators.pattern(PHONE_VE_PATTERN)]],
      alternativePhone: ['', [Validators.pattern(PHONE_VE_PATTERN)]],
      email: ['', [Validators.pattern(EMAIL_PATTERN)]],
      location: [null as LocationRef | null, Validators.required],
      address: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(MAX_ADDRESS_LENGTH)]],
      referencePoint: ['', Validators.maxLength(MAX_REFERENCE_LENGTH)],
      agencyOfficeCode: ['', Validators.maxLength(50)],
      notes: ['', Validators.maxLength(MAX_NOTES_LENGTH)],
    });
  }

  private loadSavedData(): void {
    const savedInfo = this.checkoutService.shippingRecipientInfo();
    if (savedInfo) {
      this.shippingForm.patchValue({ ...savedInfo, location: savedInfo.location ?? null });
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
    if (user.location) {
      const { parish: _parish, ...place } = fromStoredLocation(user.location);
      this.shippingForm.patchValue({ location: place });
      this.shippingForm.get('location')?.disable();
      locked['location'] = true;
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

  protected readonly hasLockedFields = computed(() => {
    const locked = this.lockedFields();
    return ['fullName', 'documentType', 'documentNumber', 'phone', 'alternativePhone', 'email']
      .some(f => locked[f]);
  });

  protected readonly hasLockedAddressFields = computed(() => {
    const locked = this.lockedFields();
    return ['location', 'address', 'referencePoint']
      .some(f => locked[f]);
  });

  protected unlockAddressFields(): void {
    const fields = ['location', 'address', 'referencePoint'];
    fields.forEach(field => this.shippingForm.get(field)?.enable());
    const updated = { ...this.lockedFields() };
    fields.forEach(f => delete updated[f]);
    this.lockedFields.set(updated);
  }

  protected unlockPersonalFields(): void {
    const allFields = ['fullName', 'documentType', 'documentNumber', 'phone', 'alternativePhone', 'email',
      'location', 'address', 'referencePoint'];
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
    const addressFields = ['location', 'address', 'referencePoint', 'agencyOfficeCode', 'notes'];
    addressFields.forEach(field => this.shippingForm.get(field)?.enable());
    this.shippingForm.patchValue({
      location: null,
      address: '',
      referencePoint: '',
      agencyOfficeCode: '',
      notes: '',
    });
    // Remove address locks
    const updated = { ...this.lockedFields() };
    addressFields.forEach(f => delete updated[f]);
    this.lockedFields.set(updated);
  }

  onSubmit(): void {
    if (this.shippingForm.invalid) {
      this.shippingForm.markAllAsTouched();
      void this.analytics.logEvent(AnalyticsEvent.FormError, { screen: 'checkout_shipping' });
      scrollToFirstFormError();
      return;
    }

    const formValue = this.shippingForm.getRawValue();
    const location: LocationRef = formValue.location;

    const shippingInfo: ShippingRecipientInfo = {
      fullName: formValue.fullName.trim(),
      documentType: formValue.documentType,
      documentNumber: formValue.documentNumber,
      phone: formValue.phone,
      alternativePhone: formValue.alternativePhone || undefined,
      email: formValue.email || undefined,
      location,
      state: location.state.name,
      city: location.city?.name ?? location.municipality.name,
      municipality: location.municipality.name,
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
