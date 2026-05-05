import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { CheckoutService, OilChangeServiceInfo } from '../services/checkout.service';
import { CartService } from '@core/services/cart.service';
import { AuthService } from '@core/services/auth.service';
import { LocationService } from '@core/services/location.service';
import { BranchZoneService } from '@core/services/branch-zone.service';
import { VehicleService } from '@core/services/vehicle.service';
import { ProductService } from '@core/services/product.service';
import { Vehicle } from '@models/vehicle.model';
import {
  NAME_PATTERN, PHONE_VE_PATTERN, DOCUMENT_NUMBER_PATTERN, EMAIL_PATTERN,
  MAX_FULLNAME_LENGTH, MAX_ADDRESS_LENGTH, MAX_REFERENCE_LENGTH, MAX_NOTES_LENGTH,
  noNumbersValidator, scrollToFirstFormError,
} from '@shared/validators/form-validators';
import { VehicleFormComponent } from '@features/garage/vehicle-form/vehicle-form.component';
import { CheckoutHeaderComponent } from '../components/checkout-header/checkout-header.component';

@Component({
  selector: 'app-checkout-oil-change-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, VehicleFormComponent, CheckoutHeaderComponent],
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
  private readonly productService = inject(ProductService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected readonly lockedFields = signal<Record<string, boolean>>({});

  /** Flips to `true` once the user tries to submit at least once. Used to
   *  surface domain-level errors (e.g. "no vehicle selected") that live
   *  outside the FormGroup and therefore can't rely on `touched`. */
  protected readonly submitAttempted = signal(false);

  /** Submit-time error surfaced when the form is valid but referential data
   *  (city/municipality objects) cannot be resolved — covers the edge case
   *  where an admin removed a zone after the user saved their selection. */
  protected readonly submitError = signal<string | null>(null);

  protected oilChangeForm!: FormGroup;

  // Zone data
  protected readonly branchCities = signal<{ code: string; name: string }[]>([]);
  private readonly allMunicipalities = signal<{ name: string; slug: string; citySlug: string }[]>([]);
  protected readonly availableMunicipalities = signal<{ code: string; name: string }[]>([]);
  protected readonly selectedCityName = signal('');

  // Vehicle selection (multi-select)
  protected readonly vehicles = signal<Vehicle[]>([]);
  protected readonly showVehicleForm = signal(false);
  protected readonly isLoadingVehicles = signal(false);

  protected readonly documentTypes = [
    { code: 'V', name: 'V - Venezolano' },
    { code: 'E', name: 'E - Extranjero' },
    { code: 'J', name: 'J - Jurídico' },
    { code: 'P', name: 'P - Pasaporte' },
  ];

  ngOnInit(): void {
    // Initialize the form FIRST so the template has a valid FormGroup during
    // the async navigation tick, even when we need to redirect away.
    this.initForm();

    if (this.checkoutService.dispatchType() !== 'oil_change_service') {
      this.router.navigate(['/checkout/despacho']);
      return;
    }

    this.loadBranchZones();
    this.loadVehicles();
    this.loadSavedData();
    this.rehydrateLegacyCartItems();
  }

  /**
   * Back-fills `vehicleTypes` on cart items persisted before this metadata
   * existed. Queries the product-detail endpoint for each cart item id in
   * parallel and pushes the missing fields into CartService. Idempotent —
   * no-op when all items already carry `vehicleTypes`.
   */
  private rehydrateLegacyCartItems(): void {
    if (!this.cartService.hasStaleMetadata()) return;

    const items = this.cartService.items();
    if (items.length === 0) return;

    const requests = items.map((it) => this.productService.getDetail(it.id));

    forkJoin(requests).subscribe({
      next: (responses) => {
        const map = new Map<
          string,
          { vehicleTypes?: string[]; freeOilChangeService?: boolean }
        >();
        for (const res of responses) {
          const p = res.data.product as any;
          if (!p?.id) continue;
          map.set(p.id, {
            vehicleTypes: p.vehicleTypes,
            freeOilChangeService: p.freeOilChangeService,
          });
        }
        this.cartService.syncItemMetadata(map);
      },
      error: () => {
        /* silent — warning simply won't trigger for legacy items */
      },
    });
  }

  private initForm(): void {
    this.oilChangeForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(MAX_FULLNAME_LENGTH), Validators.pattern(NAME_PATTERN), noNumbersValidator]],
      documentType: ['V', Validators.required],
      documentNumber: ['', [Validators.required, Validators.pattern(DOCUMENT_NUMBER_PATTERN)]],
      phone: ['', [Validators.required, Validators.pattern(PHONE_VE_PATTERN)]],
      email: ['', [Validators.pattern(EMAIL_PATTERN)]],
      cityCode: ['', Validators.required],
      municipalityCode: ['', Validators.required],
      address: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(MAX_ADDRESS_LENGTH)]],
      referencePoint: ['', Validators.maxLength(MAX_REFERENCE_LENGTH)],
      vehicleInfo: ['', Validators.maxLength(MAX_REFERENCE_LENGTH)],
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
              const muni = city.municipalities?.find((m: any) => m.slug === dc.municipality);
              if (muni && !muniList.some((m) => m.slug === muni.slug && m.citySlug === city.slug)) {
                muniList.push({ name: muni.name, slug: muni.slug, citySlug: city.slug });
              }
            }
          }
        }

        this.branchCities.set(Array.from(cityMap.values()));
        this.allMunicipalities.set(muniList);

        // If the user returned to this screen with pre-saved data, loadSavedData()
        // already ran while allMunicipalities was empty — the municipality dropdown
        // stayed blank and submit couldn't resolve the object. Re-populate it now
        // using the saved cityCode (municipalityCode in the form is already correct).
        const savedInfo = this.checkoutService.oilChangeServiceInfo();
        if (savedInfo?.cityCode) {
          this.populateMunicipalitiesForCity(savedInfo.cityCode);
        }
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

        // Auto-select if only one vehicle and none selected
        if (vehicleList.length === 1 && this.checkoutService.selectedVehicles().length === 0) {
          this.checkoutService.addVehicle(vehicleList[0]);
        }
      },
      error: () => this.isLoadingVehicles.set(false),
    });
  }

  protected isVehicleSelected(vehicleId: string): boolean {
    return this.checkoutService.selectedVehicles().some((v) => v.id === vehicleId);
  }

  /** Etiqueta descriptiva con el conteo y nombres de los vehículos seleccionados */
  protected readonly selectedVehiclesLabel = computed(() => {
    const selected = this.checkoutService.selectedVehicles();
    if (selected.length === 0) return '';
    const names = selected.map((v) => `${v.marca} ${v.modelo}`).join(', ');
    return `${selected.length} seleccionado${selected.length > 1 ? 's' : ''}: ${names}`;
  });

  protected toggleVehicle(vehicle: Vehicle): void {
    this.checkoutService.toggleVehicle(vehicle);
  }

  protected openInlineVehicleForm(): void {
    this.showVehicleForm.set(true);
  }

  protected cancelInlineVehicle(): void {
    this.showVehicleForm.set(false);
  }

  protected onInlineVehicleSave(data: any): void {
    this.vehicleService.create(data).subscribe({
      next: (res: any) => {
        const newVehicle = res.data;
        this.vehicles.update((list) => [newVehicle, ...list]);
        this.checkoutService.addVehicle(newVehicle);
        this.showVehicleForm.set(false);
      },
    });
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

  /**
   * Populates availableMunicipalities + selectedCityName for a given cityCode.
   * Does NOT mutate the FormGroup — safe to call during re-hydration when the
   * async zones payload arrives after saved form data was already patched in.
   */
  private populateMunicipalitiesForCity(cityCode: string): void {
    const munis = this.allMunicipalities()
      .filter((m) => m.citySlug === cityCode)
      .map((m) => ({ code: m.slug, name: m.name }));
    this.availableMunicipalities.set(munis);
    const city = this.branchCities().find((c) => c.code === cityCode);
    this.selectedCityName.set(city?.name || '');
  }

  onCityChange(cityCode: string): void {
    this.populateMunicipalitiesForCity(cityCode);
    this.oilChangeForm.patchValue({ municipalityCode: '' });
  }

  onSubmit(): void {
    // Always flip this first so domain-level errors (e.g. no vehicle selected)
    // are allowed to render even if the FormGroup itself is valid.
    this.submitAttempted.set(true);

    if (this.oilChangeForm.invalid) {
      this.oilChangeForm.markAllAsTouched();
      scrollToFirstFormError();
      return;
    }

    // At least one vehicle is mandatory for oil change service
    if (this.checkoutService.selectedVehicles().length === 0) {
      scrollToFirstFormError();
      return;
    }

    const formValue = this.oilChangeForm.getRawValue();
    const city = this.branchCities().find(c => c.code === formValue.cityCode);
    const municipality = this.availableMunicipalities().find(m => m.code === formValue.municipalityCode);

    if (!city || !municipality) {
      this.submitError.set(
        'No se pudo validar la ciudad o el municipio seleccionado. Por favor, vuelve a elegirlos.'
      );
      scrollToFirstFormError();
      return;
    }
    this.submitError.set(null);

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
    if (control.errors['noNumbers']) return 'No se permiten números en este campo';
    if (control.errors['pattern']) {
      if (field === 'documentNumber') return 'Solo números, entre 6 y 10 dígitos';
      if (field === 'phone') return 'Formato: 04XX-XXXXXXX (ej: 04141234567)';
      if (field === 'email') return 'Ingresa un email válido (ej: nombre@correo.com)';
      if (field === 'fullName') return 'Solo letras, sin números';
      return 'Formato inválido';
    }
    if (control.errors['email']) return 'Ingresa un email válido';

    return 'Campo inválido';
  }
}
