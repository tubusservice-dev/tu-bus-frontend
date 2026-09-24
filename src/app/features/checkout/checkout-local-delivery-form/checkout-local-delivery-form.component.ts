import { Component, inject, signal, computed, effect, untracked, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CheckoutService, LocalDeliveryRecipientInfo } from '../services/checkout.service';
import { CartService } from '@core/services/cart.service';
import { AuthService } from '@core/services/auth.service';
import { LocationStore } from '@core/services/location-store.service';
import { LocationRef, ParishDelivery } from '@models/geo.model';
import {
  NAME_PATTERN, PHONE_VE_PATTERN, DOCUMENT_NUMBER_PATTERN, EMAIL_PATTERN,
  MAX_FULLNAME_LENGTH, MAX_ADDRESS_LENGTH, MAX_REFERENCE_LENGTH, MAX_NOTES_LENGTH,
  noNumbersValidator, scrollToFirstFormError,
} from '@shared/validators/form-validators';
import { fromStoredLocation } from '@shared/utils/location-ref.util';
import { CheckoutHeaderComponent } from '../components/checkout-header/checkout-header.component';
import { LocationCascadeComponent } from '@shared/components/location-cascade/location-cascade.component';
import { PhoneMaskDirective } from '@shared/directives/phone-mask.directive';
import { ANALYTICS, AnalyticsEvent } from '@platform';
import {
  ADDRESS_FIELDS, CheckoutFieldLocks, DOCUMENT_TYPES, PERSONAL_FIELDS,
  clearPersonalFields, fieldErrorMessage, fieldHasError, profileAddressLine,
} from '../utils/checkout-contact-form';

/**
 * Local delivery: who receives it and where. The state and municipality are
 * the customer's location; the form asks for the city and parish, and the
 * parish fixes the delivery price.
 */
@Component({
  selector: 'app-checkout-local-delivery-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, CheckoutHeaderComponent, LocationCascadeComponent, PhoneMaskDirective],
  templateUrl: './checkout-local-delivery-form.component.html',
  styleUrl: './checkout-local-delivery-form.component.scss',
})
export class CheckoutLocalDeliveryFormComponent implements OnInit {
  protected readonly checkoutService = inject(CheckoutService);
  protected readonly cartService = inject(CartService);
  protected readonly authService = inject(AuthService);
  private readonly locationStore = inject(LocationStore);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly analytics = inject(ANALYTICS);

  protected deliveryForm!: FormGroup;
  private readonly locks = new CheckoutFieldLocks(() => this.deliveryForm);
  protected readonly hasLockedFields = this.locks.hasLockedPersonal;
  protected readonly hasLockedAddressFields = this.locks.hasLockedAddress;
  protected readonly quote = this.checkoutService.deliveryQuote;
  /** Set when the parish picked gets no delivery (e.g. restored from the profile). */
  protected readonly parishWithoutDelivery = signal(false);

  /** The customer's state and municipality, shown above the city and parish selects. */
  protected readonly fixedPlace = computed<Partial<LocationRef> | null>(() => this.locationStore.location());

  protected readonly documentTypes = DOCUMENT_TYPES;

  /** The customer's municipality gets no delivery at all: the form is blocked. */
  protected readonly noDeliveryHere = computed(
    () => this.locationStore.isResolved() && this.locationStore.deliveryStatus() === 'none',
  );

  constructor() {
    // A new location (changed from the header, e.g. in another tab) voids the
    // city and parish picked for the previous one, and their price. The cascade
    // starts over on its own; a place locked from the profile is released.
    effect(() => {
      this.locationStore.location();
      untracked(() => {
        const control = this.deliveryForm?.get('location');
        if (control?.value && !this.inCurrentMunicipality(control.value)) {
          this.locks.unlock(['location']);
          control.setValue(null);
          this.onDelivery(null);
        }
      });
    });

    // Without delivery in the municipality nothing can be filled in (the
    // dispatch step hides delivery there; this guards a coverage change while
    // the form is open). Profile locks survive the round trip.
    effect(() => {
      const blocked = this.noDeliveryHere();
      untracked(() => this.applyDeliveryBlock(blocked));
    });
  }

  private applyDeliveryBlock(blocked: boolean): void {
    if (!this.deliveryForm) return;
    if (blocked) {
      this.deliveryForm.disable({ emitEvent: false });
    } else {
      this.deliveryForm.enable({ emitEvent: false });
      this.locks.reapply();
    }
  }

  ngOnInit(): void {
    // Initialize the form FIRST so the template has a valid FormGroup during
    // the async navigation tick, even when we need to redirect away. Reloading
    // this URL drops the in-memory checkout state, so the redirect below is the
    // common path, not the rare one.
    this.initForm();

    if (this.checkoutService.dispatchType() !== 'local_delivery' || !this.locationStore.hasLocation()) {
      this.router.navigate(['/checkout/despacho']);
      return;
    }
    this.loadSavedData();
    // The effect may have run before the form existed.
    if (this.noDeliveryHere()) this.applyDeliveryBlock(true);
  }

  private initForm(): void {
    this.deliveryForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(MAX_FULLNAME_LENGTH), Validators.pattern(NAME_PATTERN), noNumbersValidator]],
      documentType: ['V', Validators.required],
      documentNumber: ['', [Validators.required, Validators.pattern(DOCUMENT_NUMBER_PATTERN)]],
      phone: ['', [Validators.required, Validators.pattern(PHONE_VE_PATTERN)]],
      alternativePhone: ['', [Validators.pattern(PHONE_VE_PATTERN)]],
      email: ['', [Validators.pattern(EMAIL_PATTERN)]],
      location: [null as LocationRef | null, Validators.required],
      address: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(MAX_ADDRESS_LENGTH)]],
      referencePoint: ['', Validators.maxLength(MAX_REFERENCE_LENGTH)],
      notes: ['', Validators.maxLength(MAX_NOTES_LENGTH)],
    });
  }

  private loadSavedData(): void {
    const savedInfo = this.checkoutService.localDeliveryRecipientInfo();
    if (savedInfo) {
      this.deliveryForm.patchValue({
        fullName: savedInfo.fullName,
        documentType: savedInfo.documentType,
        documentNumber: savedInfo.documentNumber,
        phone: savedInfo.phone,
        alternativePhone: savedInfo.alternativePhone || '',
        email: savedInfo.email || '',
        location: this.inCurrentMunicipality(savedInfo.location) ? savedInfo.location : null,
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

    this.locks.lockPersonalFromProfile(user);

    // The profile address only helps when it is in the municipality being served.
    const profilePlace = user.location ? fromStoredLocation(user.location) : null;
    if (profilePlace?.parish && this.inCurrentMunicipality(profilePlace)) {
      this.locks.lock('location', profilePlace);
      const address = profileAddressLine(user);
      if (address) this.locks.lock('address', address);
      if (user.referencePoint) this.locks.lock('referencePoint', user.referencePoint);
    }
  }

  private inCurrentMunicipality(place: LocationRef | null | undefined): boolean {
    return Boolean(place && place.municipality.id === this.locationStore.location()?.municipality.id);
  }

  protected unlockPersonalFields(): void {
    this.locks.unlock(PERSONAL_FIELDS);
  }

  protected clearPersonalFields(): void {
    clearPersonalFields(this.deliveryForm);
  }

  protected unlockAddressFields(): void {
    this.locks.unlock(ADDRESS_FIELDS);
  }

  protected clearDeliveryFields(): void {
    this.locks.unlock([...ADDRESS_FIELDS, 'notes']);
    this.deliveryForm.patchValue({ location: null, address: '', referencePoint: '', notes: '' });
    this.onDelivery(null);
  }

  /** The parish picked fixes the price shown here and in the summary. */
  protected onDelivery(delivery: ParishDelivery | null): void {
    this.checkoutService.setDeliveryQuote(delivery);
    this.parishWithoutDelivery.set(Boolean(delivery && !delivery.hasDelivery));
  }

  onSubmit(): void {
    if (this.noDeliveryHere()) return;
    const quote = this.quote();
    if (this.deliveryForm.invalid || !quote?.hasDelivery) {
      this.deliveryForm.markAllAsTouched();
      if (quote && !quote.hasDelivery) this.parishWithoutDelivery.set(true);
      void this.analytics.logEvent(AnalyticsEvent.FormError, { screen: 'checkout_delivery' });
      scrollToFirstFormError();
      return;
    }

    const formValue = this.deliveryForm.getRawValue();
    const deliveryInfo: LocalDeliveryRecipientInfo = {
      fullName: formValue.fullName.trim(),
      documentType: formValue.documentType,
      documentNumber: formValue.documentNumber,
      phone: formValue.phone,
      alternativePhone: formValue.alternativePhone || undefined,
      email: formValue.email || undefined,
      location: formValue.location,
      address: formValue.address.trim(),
      referencePoint: formValue.referencePoint?.trim() || undefined,
      notes: formValue.notes?.trim() || undefined,
    };

    this.checkoutService.setLocalDeliveryRecipientInfo(deliveryInfo);
    this.router.navigate(['/checkout/resumen']);
  }

  goBack(): void {
    this.router.navigate(['/checkout/despacho']);
  }

  hasError(field: string): boolean {
    return fieldHasError(this.deliveryForm.get(field));
  }

  getErrorMessage(field: string): string {
    return fieldErrorMessage(this.deliveryForm.get(field), field, { location: 'Elige la ciudad y la parroquia' });
  }
}
