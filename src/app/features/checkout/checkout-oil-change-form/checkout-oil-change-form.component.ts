import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CheckoutService, OilChangeServiceInfo } from '../services/checkout.service';
import { CartService } from '../../../core/services/cart.service';
import { ZoneService, Municipality } from '../../../core/services/zone.service';

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
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected oilChangeForm!: FormGroup;

  protected readonly activeCities = this.zoneService.activeCities;
  protected readonly availableMunicipalities = signal<Municipality[]>([]);
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

    if (this.zoneService.activeCities().length === 0) {
      this.zoneService.loadCities().subscribe();
    }

    this.initForm();
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

  private loadSavedData(): void {
    const savedInfo = this.checkoutService.oilChangeServiceInfo();
    if (savedInfo) {
      const city = this.activeCities().find(c => c.code === savedInfo.cityCode);
      if (city) {
        this.availableMunicipalities.set(city.municipalities.filter(m => m.isActive));
        this.selectedCityName.set(city.name);
      }

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

  onCityChange(cityCode: string): void {
    const city = this.activeCities().find(c => c.code === cityCode);
    if (city) {
      const activeMunicipalities = city.municipalities.filter(m => m.isActive);
      this.availableMunicipalities.set(activeMunicipalities);
      this.selectedCityName.set(city.name);
      this.oilChangeForm.patchValue({ municipalityCode: '' });
      if (activeMunicipalities.length === 1) {
        this.oilChangeForm.patchValue({ municipalityCode: activeMunicipalities[0].code });
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

    const formValue = this.oilChangeForm.value;
    const city = this.activeCities().find(c => c.code === formValue.cityCode);
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
