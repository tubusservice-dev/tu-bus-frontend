import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { CheckoutService, LocalDeliveryRecipientInfo } from '../services/checkout.service';
import { CartService } from '../../../core/services/cart.service';
import { AuthService } from '../../../core/services/auth.service';
import { LocationService } from '../../../core/services/location.service';
import { BranchZoneService } from '../../../core/services/branch-zone.service';
import {
  NAME_PATTERN, PHONE_VE_PATTERN, DOCUMENT_NUMBER_PATTERN, EMAIL_PATTERN,
  MAX_FULLNAME_LENGTH, MAX_ADDRESS_LENGTH, MAX_REFERENCE_LENGTH, MAX_NOTES_LENGTH,
  noNumbersValidator,
} from '../../../shared/validators/form-validators';

@Component({
  selector: 'app-checkout-local-delivery-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './checkout-local-delivery-form.component.html',
  styleUrl: './checkout-local-delivery-form.component.scss',
})
export class CheckoutLocalDeliveryFormComponent implements OnInit {
  protected readonly checkoutService = inject(CheckoutService);
  protected readonly cartService = inject(CartService);
  protected readonly authService = inject(AuthService);
  private readonly locationService = inject(LocationService);
  private readonly branchZoneService = inject(BranchZoneService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

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
    if (this.checkoutService.dispatchType() !== 'local_delivery') {
      this.router.navigate(['/checkout/despacho']);
      return;
    }

    this.initForm();
    this.loadBranchZones();
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
      cityCode: ['', Validators.required],
      municipalityCode: ['', Validators.required],
      address: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(MAX_ADDRESS_LENGTH)]],
      referencePoint: ['', Validators.maxLength(MAX_REFERENCE_LENGTH)],
      notes: ['', Validators.maxLength(MAX_NOTES_LENGTH)],
    });
  }

  private loadBranchZones(): void {
    const branches = this.locationService.branches();
    if (branches.length === 0) return;

    const requests = branches.map((b) => this.branchZoneService.getByBranch(b.id));

    forkJoin(requests).subscribe({
      next: (responses) => {
        const cityMap = new Map<string, { code: string; name: string }>();
        const muniList: { name: string; slug: string; citySlug: string }[] = [];

        for (const res of responses) {
          for (const bz of (res as any).data || []) {
            const zone = bz.zone as any;
            const city = zone?.city as any;
            if (!city) continue;

            cityMap.set(city.slug, { code: city.slug, name: city.name });

            for (const dc of bz.deliveryConfig) {
              if (!dc.hasDelivery) continue;
              const muni = city.municipalities?.find((m: any) => m.slug === dc.municipality);
              if (muni && !muniList.some((m) => m.slug === muni.slug && m.citySlug === city.slug)) {
                muniList.push({ name: muni.name, slug: muni.slug, citySlug: city.slug });
              }
            }
          }
        }

        this.branchCities.set(Array.from(cityMap.values()));
        this.allMunicipalities.set(muniList);
      },
    });
  }

  private loadSavedData(): void {
    const savedInfo = this.checkoutService.localDeliveryRecipientInfo();
    if (savedInfo) {
      this.onCityChange(savedInfo.cityCode);

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

    // Prefill address if user profile location is within coverage
    if (user.cityCode && user.municipalityCode) {
      const muniMatch = this.allMunicipalities().find(
        (m) => m.slug === user.municipalityCode && m.citySlug === user.cityCode
      );
      if (muniMatch) {
        this.onCityChange(user.cityCode);
        this.deliveryForm.patchValue({ cityCode: user.cityCode, municipalityCode: user.municipalityCode });
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

  onCityChange(cityCode: string): void {
    const munis = this.allMunicipalities()
      .filter((m) => m.citySlug === cityCode)
      .map((m) => ({ code: m.slug, name: m.name }));
    this.availableMunicipalities.set(munis);
    const city = this.branchCities().find((c) => c.code === cityCode);
    this.selectedCityName.set(city?.name || '');
    this.deliveryForm.patchValue({ municipalityCode: '' });
  }

  onSubmit(): void {
    if (this.deliveryForm.invalid) {
      this.deliveryForm.markAllAsTouched();
      return;
    }

    const formValue = this.deliveryForm.getRawValue();
    const city = this.branchCities().find(c => c.code === formValue.cityCode);
    const municipality = this.availableMunicipalities().find(m => m.code === formValue.municipalityCode);

    if (!city || !municipality) return;

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
