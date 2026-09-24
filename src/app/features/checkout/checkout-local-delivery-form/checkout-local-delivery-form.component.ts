import { Component, inject, signal, computed, effect, untracked, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CheckoutService, LocalDeliveryRecipientInfo } from '../services/checkout.service';
import { CartService } from '@core/services/cart.service';
import { AuthService } from '@core/services/auth.service';
import { LocationStore } from '@core/services/location-store.service';
import { ZoneSelectorService } from '@core/services/zone-selector.service';
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

const PERSONAL_FIELDS = ['fullName', 'documentType', 'documentNumber', 'phone', 'alternativePhone', 'email'];
const ADDRESS_FIELDS = ['location', 'address', 'referencePoint'];

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
  private readonly zoneSelector = inject(ZoneSelectorService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly analytics = inject(ANALYTICS);

  protected deliveryForm!: FormGroup;
  protected readonly lockedFields = signal<Record<string, boolean>>({});
  protected readonly quote = this.checkoutService.deliveryQuote;
  /** Set when the parish picked gets no delivery (e.g. restored from the profile). */
  protected readonly parishWithoutDelivery = signal(false);

  /** The customer's state and municipality, shown above the city and parish selects. */
  protected readonly fixedPlace = computed<Partial<LocationRef> | null>(() => this.locationStore.location());

  protected readonly documentTypes = [
    { code: 'V', name: 'V - Venezolano' },
    { code: 'E', name: 'E - Extranjero' },
    { code: 'J', name: 'J - Jurídico' },
    { code: 'P', name: 'P - Pasaporte' },
  ];

  constructor() {
    // A new location from the selector ("cambiar") voids the city and parish
    // picked for the previous one, and their price.
    effect(() => {
      this.locationStore.location();
      untracked(() => {
        const control = this.deliveryForm?.get('location');
        if (control?.value && !this.inCurrentMunicipality(control.value)) {
          control.enable();
          control.setValue(null);
          this.onDelivery(null);
        }
      });
    });
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

    const locked: Record<string, boolean> = {};
    const lock = (field: string, value: unknown) => {
      this.deliveryForm.patchValue({ [field]: value });
      this.deliveryForm.get(field)?.disable();
      locked[field] = true;
    };

    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    if (fullName) lock('fullName', fullName);
    if (user.documentType) lock('documentType', user.documentType);
    if (user.documentNumber) lock('documentNumber', user.documentNumber);
    if (user.phone) lock('phone', user.phone);
    if (user.alternativePhone) lock('alternativePhone', user.alternativePhone);
    if (user.email) lock('email', user.email);

    // The profile address only helps when it is in the municipality being served.
    const profilePlace = user.location ? fromStoredLocation(user.location) : null;
    if (profilePlace?.parish && this.inCurrentMunicipality(profilePlace)) {
      lock('location', profilePlace);
      const addressParts = [user.street, user.houseNumber, user.neighborhood].filter(Boolean);
      if (addressParts.length > 0) lock('address', addressParts.join(', '));
      if (user.referencePoint) lock('referencePoint', user.referencePoint);
    }

    this.lockedFields.set(locked);
  }

  private inCurrentMunicipality(place: LocationRef | null | undefined): boolean {
    return Boolean(place && place.municipality.id === this.locationStore.location()?.municipality.id);
  }

  protected readonly hasLockedFields = computed(() => PERSONAL_FIELDS.some((f) => this.lockedFields()[f]));
  protected readonly hasLockedAddressFields = computed(() => ADDRESS_FIELDS.some((f) => this.lockedFields()[f]));

  protected unlockPersonalFields(): void {
    this.unlock(PERSONAL_FIELDS);
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
    this.unlock(ADDRESS_FIELDS);
  }

  protected clearDeliveryFields(): void {
    this.unlock([...ADDRESS_FIELDS, 'notes']);
    this.deliveryForm.patchValue({ location: null, address: '', referencePoint: '', notes: '' });
    this.onDelivery(null);
  }

  private unlock(fields: string[]): void {
    fields.forEach((field) => this.deliveryForm.get(field)?.enable());
    const updated = { ...this.lockedFields() };
    fields.forEach((f) => delete updated[f]);
    this.lockedFields.set(updated);
  }

  /** The parish picked fixes the price shown here and in the summary. */
  protected onDelivery(delivery: ParishDelivery | null): void {
    this.checkoutService.setDeliveryQuote(delivery);
    this.parishWithoutDelivery.set(Boolean(delivery && !delivery.hasDelivery));
  }

  /** "cambiar" next to the state and municipality: that is the customer's location. */
  protected changeLocation(): void {
    this.zoneSelector.open();
  }

  onSubmit(): void {
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
    const control = this.deliveryForm.get(field);
    return control ? control.invalid && control.touched : false;
  }

  getErrorMessage(field: string): string {
    const control = this.deliveryForm.get(field);
    if (!control || !control.errors) return '';

    if (control.errors['required']) return field === 'location' ? 'Elige la ciudad y la parroquia' : 'Este campo es obligatorio';
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
