import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CheckoutService, LocalDeliveryRecipientInfo } from '../services/checkout.service';
import { CartService } from '@core/services/cart.service';
import { AuthService } from '@core/services/auth.service';
import { LocationStore } from '@core/services/location-store.service';
import { BranchZoneService } from '@core/services/branch-zone.service';
import {
  NAME_PATTERN, PHONE_VE_PATTERN, DOCUMENT_NUMBER_PATTERN, EMAIL_PATTERN,
  MAX_FULLNAME_LENGTH, MAX_ADDRESS_LENGTH, MAX_REFERENCE_LENGTH, MAX_NOTES_LENGTH,
  noNumbersValidator, scrollToFirstFormError,
} from '@shared/validators/form-validators';
import { CheckoutHeaderComponent } from '../components/checkout-header/checkout-header.component';
import { PhoneMaskDirective } from '@shared/directives/phone-mask.directive';
import { ANALYTICS, AnalyticsEvent } from '@platform';
import { toSlug } from '@shared/utils/slug.util';

@Component({
  selector: 'app-checkout-local-delivery-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CheckoutHeaderComponent, PhoneMaskDirective],
  templateUrl: './checkout-local-delivery-form.component.html',
  styleUrl: './checkout-local-delivery-form.component.scss',
})
export class CheckoutLocalDeliveryFormComponent implements OnInit {
  protected readonly checkoutService = inject(CheckoutService);
  protected readonly cartService = inject(CartService);
  protected readonly authService = inject(AuthService);
  private readonly locationStore = inject(LocationStore);
  private readonly branchZoneService = inject(BranchZoneService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly analytics = inject(ANALYTICS);

  protected deliveryForm!: FormGroup;
  protected readonly branchCities = signal<{ code: string; name: string }[]>([]);
  protected readonly allMunicipalities = signal<{ name: string; slug: string; citySlug: string }[]>([]);
  protected readonly availableMunicipalities = signal<{ code: string; name: string }[]>([]);
  protected readonly selectedCityName = signal('');
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

    if (this.checkoutService.dispatchType() !== 'local_delivery') {
      this.router.navigate(['/checkout/despacho']);
      return;
    }

    // Saved data and profile prefill depend on the coverage lists, so they are
    // applied once the branch zones have loaded (see loadBranchZones).
    this.loadBranchZones();
  }

  private initForm(): void {
    this.deliveryForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(MAX_FULLNAME_LENGTH), Validators.pattern(NAME_PATTERN), noNumbersValidator]],
      documentType: ['V', Validators.required],
      documentNumber: ['', [Validators.required, Validators.pattern(DOCUMENT_NUMBER_PATTERN)]],
      phone: ['', [Validators.required, Validators.pattern(PHONE_VE_PATTERN)]],
      alternativePhone: ['', [Validators.pattern(PHONE_VE_PATTERN)]],
      email: ['', [Validators.pattern(EMAIL_PATTERN)]],
      cityCode: ['', Validators.required],
      municipalityCode: ['', Validators.required],
      address: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(MAX_ADDRESS_LENGTH)]],
      referencePoint: ['', Validators.maxLength(MAX_REFERENCE_LENGTH)],
      notes: ['', Validators.maxLength(MAX_NOTES_LENGTH)],
    });
  }

  private loadBranchZones(): void {
    const branches = this.locationStore.branches();
    if (branches.length === 0) {
      this.loadSavedData();
      return;
    }

    // One public call for every branch at once. This used to be one admin-only
    // request per branch, which started returning 403 to customers and left
    // both dropdowns empty.
    this.branchZoneService.getCoverage(branches.map((b) => b.id)).subscribe({
      next: ({ data }) => {
        this.branchCities.set(data.cities.map((c) => ({ code: c.slug, name: c.name })));
        this.allMunicipalities.set(
          data.municipalities
            .filter((m) => m.hasDelivery)
            .map((m) => ({ name: m.name, slug: m.slug, citySlug: m.citySlug })),
        );
        this.loadSavedData();
      },
      // Personal data can still be restored even if coverage failed to load.
      error: () => this.loadSavedData(),
    });
  }

  private loadSavedData(): void {
    const savedInfo = this.checkoutService.localDeliveryRecipientInfo();
    if (savedInfo) {
      this.populateMunicipalitiesForCity(savedInfo.cityCode);

      this.deliveryForm.patchValue({
        fullName: savedInfo.fullName,
        documentType: savedInfo.documentType,
        documentNumber: savedInfo.documentNumber,
        phone: savedInfo.phone,
        alternativePhone: savedInfo.alternativePhone || '',
        email: savedInfo.email || '',
        cityCode: savedInfo.cityCode,
        municipalityCode: savedInfo.municipalityCode,
        address: savedInfo.address,
        referencePoint: savedInfo.referencePoint || '',
        notes: savedInfo.notes || '',
      });
    } else {
      // Refresh user profile from server, then prefill
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
      this.deliveryForm.patchValue({ fullName });
      this.deliveryForm.get('fullName')?.disable();
      locked['fullName'] = true;
    }
    if (user.documentType) {
      this.deliveryForm.patchValue({ documentType: user.documentType });
      this.deliveryForm.get('documentType')?.disable();
      locked['documentType'] = true;
    }
    if (user.documentNumber) {
      this.deliveryForm.patchValue({ documentNumber: user.documentNumber });
      this.deliveryForm.get('documentNumber')?.disable();
      locked['documentNumber'] = true;
    }
    if (user.phone) {
      this.deliveryForm.patchValue({ phone: user.phone });
      this.deliveryForm.get('phone')?.disable();
      locked['phone'] = true;
    }
    if (user.alternativePhone) {
      this.deliveryForm.patchValue({ alternativePhone: user.alternativePhone });
      this.deliveryForm.get('alternativePhone')?.disable();
      locked['alternativePhone'] = true;
    }
    if (user.email) {
      this.deliveryForm.patchValue({ email: user.email });
      this.deliveryForm.get('email')?.disable();
      locked['email'] = true;
    }

    // Prefill address if user profile location is within coverage.
    // The profile stores names from the static state list ("Valencia",
    // "Carlos Arvelo") while coverage uses seeded slugs ("valencia",
    // "carabobo"), so compare by slug. The coverage city may be the profile
    // city or a state-wide entry named after the state.
    if (user.municipalityCode) {
      const muniSlug = toSlug(user.municipalityCode);
      const citySlugs = [user.cityCode, user.cityName, user.stateName].filter(Boolean).map(toSlug);
      const muniMatch = this.allMunicipalities().find(
        (m) => m.slug === muniSlug && citySlugs.includes(m.citySlug)
      );
      if (muniMatch) {
        this.populateMunicipalitiesForCity(muniMatch.citySlug);
        this.deliveryForm.patchValue({ cityCode: muniMatch.citySlug, municipalityCode: muniMatch.slug });
        this.deliveryForm.get('cityCode')?.disable();
        this.deliveryForm.get('municipalityCode')?.disable();
        locked['cityCode'] = true;
        locked['municipalityCode'] = true;

        const addressParts = [user.street, user.houseNumber, user.neighborhood].filter(Boolean);
        if (addressParts.length > 0) {
          this.deliveryForm.patchValue({ address: addressParts.join(', ') });
          this.deliveryForm.get('address')?.disable();
          locked['address'] = true;
        }
        if (user.referencePoint) {
          this.deliveryForm.patchValue({ referencePoint: user.referencePoint });
          this.deliveryForm.get('referencePoint')?.disable();
          locked['referencePoint'] = true;
        }
      }
    }

    this.lockedFields.set(locked);
  }

  protected readonly hasLockedFields = computed(() => {
    const locked = this.lockedFields();
    return ['fullName', 'documentType', 'documentNumber', 'phone', 'alternativePhone', 'email'].some(f => locked[f]);
  });

  protected readonly hasLockedAddressFields = computed(() => {
    const locked = this.lockedFields();
    return ['cityCode', 'municipalityCode', 'address', 'referencePoint'].some(f => locked[f]);
  });

  protected unlockPersonalFields(): void {
    const fields = ['fullName', 'documentType', 'documentNumber', 'phone', 'alternativePhone', 'email'];
    fields.forEach(field => this.deliveryForm.get(field)?.enable());
    const updated = { ...this.lockedFields() };
    fields.forEach(f => delete updated[f]);
    this.lockedFields.set(updated);
  }

  protected clearPersonalFields(): void {
    this.deliveryForm.patchValue({
      fullName: '',
      documentType: 'V',
      documentNumber: '',
      phone: '',
      alternativePhone: '',
      email: '',
    });
  }

  protected unlockAddressFields(): void {
    const fields = ['cityCode', 'municipalityCode', 'address', 'referencePoint'];
    fields.forEach(field => this.deliveryForm.get(field)?.enable());
    const updated = { ...this.lockedFields() };
    fields.forEach(f => delete updated[f]);
    this.lockedFields.set(updated);
  }

  protected clearDeliveryFields(): void {
    const fields = ['cityCode', 'municipalityCode', 'address', 'referencePoint', 'notes'];
    fields.forEach(field => this.deliveryForm.get(field)?.enable());
    this.deliveryForm.patchValue({
      cityCode: '',
      municipalityCode: '',
      address: '',
      referencePoint: '',
      notes: '',
    });
    const updated = { ...this.lockedFields() };
    fields.forEach(f => delete updated[f]);
    this.lockedFields.set(updated);
    this.availableMunicipalities.set([]);
    this.selectedCityName.set('');
  }

  /** User picked a different city: refresh municipalities and clear the choice. */
  onCityChange(cityCode: string): void {
    this.populateMunicipalitiesForCity(cityCode);
    this.deliveryForm.patchValue({ municipalityCode: '' });
  }

  /** Fills the municipality list for `cityCode` without touching the selected value. */
  private populateMunicipalitiesForCity(cityCode: string): void {
    const munis = this.allMunicipalities()
      .filter((m) => m.citySlug === cityCode)
      .map((m) => ({ code: m.slug, name: m.name }));
    this.availableMunicipalities.set(munis);
    const city = this.branchCities().find((c) => c.code === cityCode);
    this.selectedCityName.set(city?.name || '');
  }

  onSubmit(): void {
    if (this.deliveryForm.invalid) {
      this.deliveryForm.markAllAsTouched();
      void this.analytics.logEvent(AnalyticsEvent.FormError, { screen: 'checkout_delivery' });
      scrollToFirstFormError();
      return;
    }

    const formValue = this.deliveryForm.getRawValue();
    const city = this.branchCities().find(c => c.code === formValue.cityCode);
    const municipality = this.availableMunicipalities().find(m => m.code === formValue.municipalityCode);

    if (!city || !municipality) {
      // The selected values are no longer in the coverage lists (e.g. data
      // saved before coverage changed). Surface it on the field instead of
      // leaving the submit button doing nothing.
      this.flagOutOfCoverage(!city ? 'cityCode' : 'municipalityCode');
      return;
    }

    const deliveryInfo: LocalDeliveryRecipientInfo = {
      fullName: formValue.fullName.trim(),
      documentType: formValue.documentType,
      documentNumber: formValue.documentNumber,
      phone: formValue.phone,
      alternativePhone: formValue.alternativePhone || undefined,
      email: formValue.email || undefined,
      cityCode: city.code,
      cityName: city.name,
      municipalityCode: municipality.code,
      municipalityName: municipality.name,
      address: formValue.address.trim(),
      referencePoint: formValue.referencePoint?.trim() || undefined,
      notes: formValue.notes?.trim() || undefined,
    };

    this.checkoutService.setLocalDeliveryRecipientInfo(deliveryInfo);
    this.router.navigate(['/checkout/resumen']);
  }

  /** Clears an out-of-coverage selection so the field shows its required error. */
  private flagOutOfCoverage(field: 'cityCode' | 'municipalityCode'): void {
    const control = this.deliveryForm.get(field);
    control?.enable();
    control?.setValue('');
    control?.markAsTouched();
    const updated = { ...this.lockedFields() };
    delete updated[field];
    this.lockedFields.set(updated);
    void this.analytics.logEvent(AnalyticsEvent.FormError, { screen: 'checkout_delivery' });
    scrollToFirstFormError();
  }

  goBack(): void {
    this.router.navigate(['/checkout/despacho']);
  }

  hasError(field: string): boolean {
    const control = this.deliveryForm.get(field);
    return control ? control.invalid && control.touched : false;
  }

  getErrorMessage(field: string): string {
    const control = this.deliveryForm.get(field);
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
