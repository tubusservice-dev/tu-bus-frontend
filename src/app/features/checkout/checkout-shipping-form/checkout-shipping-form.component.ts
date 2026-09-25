import { Component, inject, OnInit } from '@angular/core';
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
import {
  ADDRESS_FIELDS, CheckoutFieldLocks, DOCUMENT_TYPES, PERSONAL_FIELDS,
  clearPersonalFields, fieldErrorMessage, fieldHasError, profileAddressLine,
} from '../utils/checkout-contact-form';

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
  private readonly locks = new CheckoutFieldLocks(() => this.shippingForm);
  protected readonly hasLockedFields = this.locks.hasLockedPersonal;
  protected readonly hasLockedAddressFields = this.locks.hasLockedAddress;

  protected readonly documentTypes = DOCUMENT_TYPES;

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

    this.locks.lockPersonalFromProfile(user);
    if (user.location) {
      const { parish: _parish, ...place } = fromStoredLocation(user.location);
      this.locks.lock('location', place);
    }
    const address = profileAddressLine(user);
    if (address) this.locks.lock('address', address);
    if (user.referencePoint) this.locks.lock('referencePoint', user.referencePoint);
  }

  protected unlockAddressFields(): void {
    this.locks.unlock(ADDRESS_FIELDS);
  }

  /** Here the personal unlock also frees the address (unlike the other forms). */
  protected unlockPersonalFields(): void {
    this.locks.unlock([...PERSONAL_FIELDS, ...ADDRESS_FIELDS]);
  }

  protected clearPersonalFields(): void {
    clearPersonalFields(this.shippingForm);
  }

  protected clearShippingFields(): void {
    this.locks.unlock([...ADDRESS_FIELDS, 'agencyOfficeCode', 'notes']);
    this.shippingForm.patchValue({
      location: null,
      address: '',
      referencePoint: '',
      agencyOfficeCode: '',
      notes: '',
    });
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
    return fieldHasError(this.shippingForm.get(field));
  }

  getErrorMessage(field: string): string {
    return fieldErrorMessage(this.shippingForm.get(field), field);
  }
}
