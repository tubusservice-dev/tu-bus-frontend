import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CheckoutService, LocalDeliveryRecipientInfo } from '../services/checkout.service';
import { CartService } from '../../../core/services/cart.service';
import { ZoneService, City, Municipality } from '../../../core/services/zone.service';
import { AuthService } from '../../../core/services/auth.service';

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
  protected readonly zoneService = inject(ZoneService);
  protected readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected deliveryForm!: FormGroup;
  protected readonly branchCities = signal<{ code: string; name: string }[]>([]);
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
      fullName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      documentType: ['V', Validators.required],
      documentNumber: ['', [Validators.required, Validators.pattern(/^\d{6,10}$/)]],
      phone: ['', [Validators.required, Validators.pattern(/^(0414|0424|0412|0416|0426)\d{7}$/)]],
      alternativePhone: ['', [Validators.pattern(/^(0414|0424|0412|0416|0426)\d{7}$/)]],
      email: ['', [Validators.email]],
      cityCode: ['', Validators.required],
      municipalityCode: ['', Validators.required],
      address: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(300)]],
      referencePoint: ['', Validators.maxLength(200)],
      notes: ['', Validators.maxLength(500)],
    });
  }

  private loadBranchZones(): void {
    const branch = this.checkoutService.zoneBranch();
    if (!branch?.serviceZones) return;

    const cities = branch.serviceZones.map(sz => ({
      code: sz.cityCode,
      name: sz.cityName,
    }));
    this.branchCities.set(cities);
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

      const selectedZone = this.zoneService.selectedZone();
      if (selectedZone) {
        this.onCityChange(selectedZone.city.code);
        this.deliveryForm.patchValue({
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

    // Only prefill address if user's zone is within branch coverage
    if (user.cityCode && user.municipalityCode) {
      const branch = this.checkoutService.zoneBranch();
      const isInBranchZone = branch?.serviceZones?.some(sz =>
        sz.cityCode === user.cityCode &&
        sz.municipalities.some(m => m.municipalityCode === user.municipalityCode)
      );
      if (isInBranchZone) {
        this.deliveryForm.get('cityCode')?.disable();
        locked['cityCode'] = true;
        this.deliveryForm.get('municipalityCode')?.disable();
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
    const branch = this.checkoutService.zoneBranch();
    const zone = branch?.serviceZones?.find(sz => sz.cityCode === cityCode);
    if (zone) {
      const municipalities = zone.municipalities.map(m => ({ code: m.municipalityCode, name: m.municipalityName }));
      this.availableMunicipalities.set(municipalities);
      this.selectedCityName.set(zone.cityName);
      this.deliveryForm.patchValue({ municipalityCode: '' });
      if (municipalities.length === 1) {
        this.deliveryForm.patchValue({ municipalityCode: municipalities[0].code });
      }
    } else {
      this.availableMunicipalities.set([]);
      this.selectedCityName.set('');
      this.deliveryForm.patchValue({ municipalityCode: '' });
    }
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
    if (control.errors['pattern']) {
      if (field === 'documentNumber') return 'Ingresa un número de documento válido (6-10 dígitos)';
      if (field === 'phone' || field === 'alternativePhone') return 'Formato: 04XX-XXXXXXX';
    }
    if (control.errors['email']) return 'Ingresa un email válido';

    return 'Campo inválido';
  }
}
