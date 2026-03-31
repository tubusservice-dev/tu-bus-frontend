import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { CheckoutService, OilChangeServiceInfo } from '../services/checkout.service';
import { CartService } from '../../../core/services/cart.service';
import { AuthService } from '../../../core/services/auth.service';
import { LocationService } from '../../../core/services/location.service';
import { BranchZoneService } from '../../../core/services/branch-zone.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { Vehicle } from '../../../models/vehicle.model';

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
  protected readonly authService = inject(AuthService);
  private readonly locationService = inject(LocationService);
  private readonly branchZoneService = inject(BranchZoneService);
  protected readonly vehicleService = inject(VehicleService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected readonly lockedFields = signal<Record<string, boolean>>({});

  protected oilChangeForm!: FormGroup;

  // Zone data
  protected readonly branchCities = signal<{ code: string; name: string }[]>([]);
  private readonly allMunicipalities = signal<{ name: string; slug: string; citySlug: string }[]>([]);
  protected readonly availableMunicipalities = signal<{ code: string; name: string }[]>([]);
  protected readonly selectedCityName = signal('');

  // Vehicle selection
  protected readonly vehicles = signal<Vehicle[]>([]);
  protected readonly selectedVehicle = signal<Vehicle | null>(null);
  protected readonly showVehicleForm = signal(false);
  protected readonly isLoadingVehicles = signal(false);

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
    this.loadVehicles();
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

  private loadVehicles(): void {
    this.isLoadingVehicles.set(true);
    this.vehicleService.getMyVehicles(1, 50).subscribe({
      next: (res: any) => {
        const vehicleList = res.data || [];
        this.vehicles.set(vehicleList);
        this.isLoadingVehicles.set(false);

        // Auto-select if only one vehicle
        if (vehicleList.length === 1) {
          this.selectVehicle(vehicleList[0]);
        }

        // Restore previously selected vehicle
        const prev = this.checkoutService.selectedVehicle();
        if (prev) {
          this.selectedVehicle.set(prev);
        }
      },
      error: () => this.isLoadingVehicles.set(false),
    });
  }

  protected selectVehicle(vehicle: Vehicle): void {
    this.selectedVehicle.set(vehicle);
    this.checkoutService.selectVehicle(vehicle);
  }

  protected clearVehicleSelection(): void {
    this.selectedVehicle.set(null);
    this.checkoutService.clearVehicle();
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
    const munis = this.allMunicipalities()
      .filter((m) => m.citySlug === cityCode)
      .map((m) => ({ code: m.slug, name: m.name }));
    this.availableMunicipalities.set(munis);
    const city = this.branchCities().find((c) => c.code === cityCode);
    this.selectedCityName.set(city?.name || '');
    this.oilChangeForm.patchValue({ municipalityCode: '' });
  }

  onSubmit(): void {
    if (this.oilChangeForm.invalid) {
      this.oilChangeForm.markAllAsTouched();
      return;
    }

    // Vehicle is mandatory for oil change service
    if (!this.selectedVehicle()) {
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
