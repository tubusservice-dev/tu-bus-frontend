import { Injectable, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { CheckoutService } from '@features/checkout/services/checkout.service';

/**
 * Encapsulates the billing-address sub-flow on the checkout summary:
 *   - `billingSource` selector (shipping / profile / custom).
 *   - The custom-address `FormGroup` with its validators.
 *   - The three builders that synthesize a `BillingAddress` from the chosen
 *     source and push it to the central `CheckoutService`.
 *
 * Registered via `providers: [...]` on `CheckoutSummaryComponent`, so its
 * instance is scoped to the component lifetime.
 */
@Injectable()
export class CheckoutBillingService {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly checkoutService = inject(CheckoutService);

  readonly billingSource = signal<'shipping' | 'profile' | 'custom'>('profile');

  /**
   * Reactive form for the "custom" billing branch. Built lazily by `init()`
   * so the FormBuilder dependency resolves once the component is alive.
   */
  billingForm!: FormGroup;

  /**
   * True when the active dispatch type provides a shipping/recipient address
   * that can legitimately be reused as the billing address.
   */
  readonly canUseShippingAddress = computed(() => {
    const dt = this.checkoutService.dispatchType();
    return dt === 'local_delivery' || dt === 'shipping_agency' || dt === 'oil_change_service';
  });

  /** Builds the custom-address form. Idempotent. */
  init(): void {
    if (this.billingForm) return;
    this.billingForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(3)]],
      documentType: ['V', Validators.required],
      documentNumber: ['', [Validators.required, Validators.pattern(/^\d{6,10}$/)]],
      address: ['', [Validators.required, Validators.minLength(10)]],
      city: ['', Validators.required],
      municipality: [''],
      state: [''],
      referencePoint: [''],
    });
  }

  onBillingSourceChange(source: 'shipping' | 'profile' | 'custom'): void {
    this.billingSource.set(source);

    if (source === 'shipping') {
      this.buildFromShipping();
    } else if (source === 'profile') {
      this.buildFromProfile();
    }
    // 'custom' waits for form submission
  }

  /**
   * Copies the active dispatch-flow's recipient info into the billing address.
   * The chosen fields differ per flow because each form captures a different
   * shape (e.g. shipping agency carries `state` while local delivery doesn't).
   */
  buildFromShipping(): void {
    const dt = this.checkoutService.dispatchType();
    let address = '', city = '', municipality = '', state = '', fullName = '', docType = '', docNum = '', refPoint = '';

    if (dt === 'local_delivery') {
      const info = this.checkoutService.localDeliveryRecipientInfo();
      if (info) {
        fullName = info.fullName; docType = info.documentType; docNum = info.documentNumber;
        address = info.address; city = info.cityName; municipality = info.municipalityName;
        refPoint = info.referencePoint || '';
      }
    } else if (dt === 'shipping_agency') {
      const info = this.checkoutService.shippingRecipientInfo();
      if (info) {
        fullName = info.fullName; docType = info.documentType; docNum = info.documentNumber;
        address = info.address; city = info.city; state = info.state;
        municipality = info.municipality || ''; refPoint = info.referencePoint || '';
      }
    } else if (dt === 'oil_change_service') {
      const info = this.checkoutService.oilChangeServiceInfo();
      if (info) {
        fullName = info.fullName; docType = info.documentType; docNum = info.documentNumber;
        address = info.address; city = info.cityName; municipality = info.municipalityName;
        refPoint = info.referencePoint || '';
      }
    }

    this.checkoutService.setBillingAddress({
      source: 'shipping', fullName, documentType: docType, documentNumber: docNum,
      address, city, municipality, state, referencePoint: refPoint,
    });
  }

  /** Copies the authenticated user's profile data into the billing address. */
  buildFromProfile(): void {
    const user = this.authService.currentUser();
    if (!user) return;

    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
    const addressParts = [user.street, user.houseNumber, user.neighborhood].filter(Boolean);

    this.checkoutService.setBillingAddress({
      source: 'profile',
      fullName,
      documentType: user.documentType,
      documentNumber: user.documentNumber,
      address: addressParts.length > 0 ? addressParts.join(', ') : (user as any).address || '',
      city: user.cityName || '',
      municipality: user.municipalityName || '',
      state: user.stateName || '',
      referencePoint: user.referencePoint || '',
    });
  }

  onBillingFormSubmit(): void {
    if (!this.billingForm) return;
    if (this.billingForm.invalid) {
      this.billingForm.markAllAsTouched();
      return;
    }
    const v = this.billingForm.getRawValue();
    this.checkoutService.setBillingAddress({
      source: 'custom',
      fullName: v.fullName?.trim(),
      documentType: v.documentType,
      documentNumber: v.documentNumber?.trim(),
      address: v.address?.trim(),
      city: v.city?.trim(),
      municipality: v.municipality?.trim(),
      state: v.state?.trim(),
      referencePoint: v.referencePoint?.trim(),
    });
  }
}
