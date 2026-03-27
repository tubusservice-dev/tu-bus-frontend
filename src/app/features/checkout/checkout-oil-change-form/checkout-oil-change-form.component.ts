import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CheckoutService, OilChangeServiceInfo } from '../services/checkout.service';
import { CartService } from '../../../core/services/cart.service';
import { ZoneService, Municipality } from '../../../core/services/zone.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-checkout-oil-change-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './checkout-oil-change-form.component.html',
  styleUrl: './checkout-oil-change-form.component.scss',
})
export class CheckoutOilChangeFormComponent implements OnInit {
  protected readonly checkoutService = inject(CheckoutService);
  protected readonly cartService = inject(CartService);
  protected readonly zoneService = inject(ZoneService);
  protected readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  // Track which personal fields are locked (have user profile data)
  protected readonly lockedFields = signal<Record<string, boolean>>({});

  protected oilChangeForm!: FormGroup;

  // Branch-based zone data (only cities/municipalities served by the branch)
  protected readonly branchCities = signal<{ code: string; name: string }[]>([]);
  protected readonly availableMunicipalities = signal<{ code: string; name: string }[]>([]);
  protected readonly selectedCityName = signal('');

  protected readonly documentTypes = [
    { code: 'V', name: 'V - Venezolano' },
    { code: 'E', name: 'E - Extranjero' },
    { code: 'J', name: 'J - Jurídico' },
    { code: 'P', name: 'P - Pasaporte' },
  ];

  ngOnInit(): void {
    if (this.checkoutService.dispatchType() !== 'oil_change_service') {
      this.router.navigate(['/checkout/despacho']);
      return;
    }

    this.initForm();
    this.loadBranchZones();
    this.loadSavedData();
  }

  private initForm(): void {
    this.oilChangeForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      documentType: ['V', Validators.required],
      documentNumber: ['', [Validators.required, Validators.pattern(/^\d{6,10}$/)]],
      phone: ['', [Validators.required, Validators.pattern(/^(0414|0424|0412|0416|0426)\d{7}$/)]],
      email: ['', [Validators.email]],
      cityCode: ['', Validators.required],
      municipalityCode: ['', Validators.required],
      address: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(300)]],
      referencePoint: ['', Validators.maxLength(200)],
      vehicleInfo: ['', Validators.maxLength(200)],
      notes: ['', Validators.maxLength(500)],
    });
  }

  private loadBranchZones(): void {
    const branch = this.checkoutService.zoneBranch();
    if (!branch?.serviceZones) return;

    const cities = branch.serviceZones.map(sz => ({
      code: sz.cityCode,
      name: sz.cityName,
      municipalities: sz.municipalities.map(m => ({ code: m.municipalityCode, name: m.municipalityName })),
    }));
    this.branchCities.set(cities);
  }

  private loadSavedData(): void {
    const savedInfo = this.checkoutService.oilChangeServiceInfo();
    if (savedInfo) {
      this.onCityChange(savedInfo.cityCode);
      this.oilChangeForm.patchValue({
        fullName: savedInfo.fullName,
        documentType: savedInfo.documentType,
        documentNumber: savedInfo.documentNumber,
        phone: savedInfo.phone,
        email: savedInfo.email || '',
        cityCode: savedInfo.cityCode,
        municipalityCode: savedInfo.municipalityCode,
        address: savedInfo.address,
        referencePoint: savedInfo.referencePoint || '',
        vehicleInfo: savedInfo.vehicleInfo || '',
        notes: savedInfo.notes || '',
      });
    } else {
      // Refresh user profile from server, then prefill
      this.authService.loadUserProfile().subscribe({
        next: () => this.prefillFromUserProfile(),
        error: () => this.prefillFromUserProfile(),
      });

      // Prefill zone from header selection
      const selectedZone = this.zoneService.selectedZone();
      if (selectedZone) {
        this.onCityChange(selectedZone.city.code);
        this.oilChangeForm.patchValue({
          cityCode: selectedZone.city.code,
          municipalityCode: selectedZone.municipality.code,
        });
      }
    }
  }

  private prefillFromUserProfile(): void {
    const user = this.authService.currentUser();
    if (!user) return;

    const locked: Record<string, boolean> = {};
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();

    if (fullName) {
      this.oilChangeForm.patchValue({ fullName });
      this.oilChangeForm.get('fullName')?.disable();
      locked['fullName'] = true;
    }
    if (user.documentType) {
      this.oilChangeForm.patchValue({ documentType: user.documentType });
      this.oilChangeForm.get('documentType')?.disable();
      locked['documentType'] = true;
    }
    if (user.documentNumber) {
      this.oilChangeForm.patchValue({ documentNumber: user.documentNumber });
      this.oilChangeForm.get('documentNumber')?.disable();
      locked['documentNumber'] = true;
    }
    if (user.phone) {
      this.oilChangeForm.patchValue({ phone: user.phone });
      this.oilChangeForm.get('phone')?.disable();
      locked['phone'] = true;
    }
    if (user.email) {
      this.oilChangeForm.patchValue({ email: user.email });
      this.oilChangeForm.get('email')?.disable();
      locked['email'] = true;
    }

    // Only prefill address if user's zone is within branch coverage
    if (user.cityCode && user.municipalityCode) {
      const branch = this.checkoutService.zoneBranch();
      const isInBranchZone = branch?.serviceZones?.some(sz =>
        sz.cityCode === user.cityCode &&
        sz.municipalities.some(m => m.municipalityCode === user.municipalityCode)
      );
      if (isInBranchZone) {
        // Lock city and municipality
        this.oilChangeForm.get('cityCode')?.disable();
        locked['cityCode'] = true;
        this.oilChangeForm.get('municipalityCode')?.disable();
        locked['municipalityCode'] = true;

        const addressParts = [user.street, user.houseNumber, user.neighborhood].filter(Boolean);
        if (addressParts.length > 0) {
          this.oilChangeForm.patchValue({ address: addressParts.join(', ') });
          this.oilChangeForm.get('address')?.disable();
          locked['address'] = true;
        }
        if (user.referencePoint) {
          this.oilChangeForm.patchValue({ referencePoint: user.referencePoint });
          this.oilChangeForm.get('referencePoint')?.disable();
          locked['referencePoint'] = true;
        }
      }
    }

    this.lockedFields.set(locked);
  }

  protected readonly hasLockedFields = computed(() => {
    const locked = this.lockedFields();
    return ['fullName', 'documentType', 'documentNumber', 'phone', 'email'].some(f => locked[f]);
  });

  protected readonly hasLockedAddressFields = computed(() => {
    const locked = this.lockedFields();
    return ['cityCode', 'municipalityCode', 'address', 'referencePoint'].some(f => locked[f]);
  });

  protected unlockPersonalFields(): void {
    const fields = ['fullName', 'documentType', 'documentNumber', 'phone', 'email'];
    fields.forEach(field => this.oilChangeForm.get(field)?.enable());
    const updated = { ...this.lockedFields() };
    fields.forEach(f => delete updated[f]);
    this.lockedFields.set(updated);
  }

  protected clearPersonalFields(): void {
    this.oilChangeForm.patchValue({
      fullName: '',
      documentType: 'V',
      documentNumber: '',
      phone: '',
      email: '',
    });
  }

  protected unlockAddressFields(): void {
    const fields = ['cityCode', 'municipalityCode', 'address', 'referencePoint'];
    fields.forEach(field => this.oilChangeForm.get(field)?.enable());
    const updated = { ...this.lockedFields() };
    fields.forEach(f => delete updated[f]);
    this.lockedFields.set(updated);
  }

  protected clearServiceFields(): void {
    const fields = ['cityCode', 'municipalityCode', 'address', 'referencePoint', 'vehicleInfo', 'notes'];
    fields.forEach(field => this.oilChangeForm.get(field)?.enable());
    this.oilChangeForm.patchValue({
      cityCode: '',
      municipalityCode: '',
      address: '',
      referencePoint: '',
      vehicleInfo: '',
      notes: '',
    });
    const updated = { ...this.lockedFields() };
    fields.forEach(f => delete updated[f]);
    this.lockedFields.set(updated);
    this.availableMunicipalities.set([]);
    this.selectedCityName.set('');
  }

  onCityChange(cityCode: string): void {
    const branch = this.checkoutService.zoneBranch();
    const zone = branch?.serviceZones?.find(sz => sz.cityCode === cityCode);
    if (zone) {
      const municipalities = zone.municipalities.map(m => ({ code: m.municipalityCode, name: m.municipalityName }));
      this.availableMunicipalities.set(municipalities);
      this.selectedCityName.set(zone.cityName);
      this.oilChangeForm.patchValue({ municipalityCode: '' });
      if (municipalities.length === 1) {
        this.oilChangeForm.patchValue({ municipalityCode: municipalities[0].code });
      }
    } else {
      this.availableMunicipalities.set([]);
      this.selectedCityName.set('');
      this.oilChangeForm.patchValue({ municipalityCode: '' });
    }
  }

  onSubmit(): void {
    if (this.oilChangeForm.invalid) {
      this.oilChangeForm.markAllAsTouched();
      return;
    }

    const formValue = this.oilChangeForm.getRawValue();
    const city = this.branchCities().find(c => c.code === formValue.cityCode);
    const municipality = this.availableMunicipalities().find(m => m.code === formValue.municipalityCode);

    if (!city || !municipality) return;

    const info: OilChangeServiceInfo = {
      fullName: formValue.fullName.trim(),
      documentType: formValue.documentType,
      documentNumber: formValue.documentNumber,
      phone: formValue.phone,
      email: formValue.email || undefined,
      cityCode: city.code,
      cityName: city.name,
      municipalityCode: municipality.code,
      municipalityName: municipality.name,
      address: formValue.address.trim(),
      referencePoint: formValue.referencePoint?.trim() || undefined,
      vehicleInfo: formValue.vehicleInfo?.trim() || undefined,
      notes: formValue.notes?.trim() || undefined,
    };

    this.checkoutService.setOilChangeServiceInfo(info);
    this.router.navigate(['/checkout/resumen']);
  }

  goBack(): void {
    this.router.navigate(['/checkout/despacho']);
  }

  hasError(field: string): boolean {
    const control = this.oilChangeForm.get(field);
    return control ? control.invalid && control.touched : false;
  }

  getErrorMessage(field: string): string {
    const control = this.oilChangeForm.get(field);
    if (!control || !control.errors) return '';

    if (control.errors['required']) return 'Este campo es obligatorio';
    if (control.errors['minlength']) return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`;
    if (control.errors['maxlength']) return `Máximo ${control.errors['maxlength'].requiredLength} caracteres`;
    if (control.errors['pattern']) {
      if (field === 'documentNumber') return 'Ingresa un número de documento válido (6-10 dígitos)';
      if (field === 'phone') return 'Formato: 04XX-XXXXXXX';
    }
    if (control.errors['email']) return 'Ingresa un email válido';

    return 'Campo inválido';
  }
}
