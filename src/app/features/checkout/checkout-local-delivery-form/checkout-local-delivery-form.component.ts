import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CheckoutService, LocalDeliveryRecipientInfo } from '../services/checkout.service';
import { CartService } from '../../../core/services/cart.service';
import { ZoneService, City, Municipality } from '../../../core/services/zone.service';

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
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  /** Formulario de datos de delivery */
  protected deliveryForm!: FormGroup;

  /** Ciudades activas disponibles */
  protected readonly activeCities = this.zoneService.activeCities;

  /** Municipios disponibles para la ciudad seleccionada */
  protected readonly availableMunicipalities = signal<Municipality[]>([]);

  /** Ciudad seleccionada */
  protected readonly selectedCityName = signal('');

  /** Tipos de documento */
  protected readonly documentTypes = [
    { code: 'V', name: 'V - Venezolano' },
    { code: 'E', name: 'E - Extranjero' },
    { code: 'J', name: 'J - Jurídico' },
    { code: 'P', name: 'P - Pasaporte' },
  ];

  ngOnInit(): void {
    // Redirigir si no es delivery local
    if (this.checkoutService.dispatchType() !== 'local_delivery') {
      this.router.navigate(['/checkout/despacho']);
      return;
    }

    // Cargar ciudades si no están cargadas
    if (this.zoneService.activeCities().length === 0) {
      this.zoneService.loadCities().subscribe();
    }

    this.initForm();
    this.loadSavedData();
  }

  /**
   * Inicializar formulario
   */
  private initForm(): void {
    this.deliveryForm = this.fb.group({
      // Datos del destinatario
      fullName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      documentType: ['V', Validators.required],
      documentNumber: ['', [Validators.required, Validators.pattern(/^\d{6,10}$/)]],
      phone: ['', [Validators.required, Validators.pattern(/^(0414|0424|0412|0416|0426)\d{7}$/)]],
      alternativePhone: ['', [Validators.pattern(/^(0414|0424|0412|0416|0426)\d{7}$/)]],
      email: ['', [Validators.email]],

      // Zona de entrega (restringida por zonas del sistema)
      cityCode: ['', Validators.required],
      municipalityCode: ['', Validators.required],

      // Dirección de entrega
      address: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(300)]],
      referencePoint: ['', Validators.maxLength(200)],

      // Notas adicionales
      notes: ['', Validators.maxLength(500)],
    });
  }

  /**
   * Cargar datos guardados previamente
   */
  private loadSavedData(): void {
    const savedInfo = this.checkoutService.localDeliveryRecipientInfo();
    if (savedInfo) {
      // Cargar municipios de la ciudad guardada
      const city = this.activeCities().find(c => c.code === savedInfo.cityCode);
      if (city) {
        this.availableMunicipalities.set(city.municipalities.filter(m => m.isActive));
        this.selectedCityName.set(city.name);
      }

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
      // Pre-popular con la zona seleccionada en el header
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

  /**
   * Manejar cambio de ciudad
   */
  onCityChange(cityCode: string): void {
    const city = this.activeCities().find(c => c.code === cityCode);
    if (city) {
      const activeMunicipalities = city.municipalities.filter(m => m.isActive);
      this.availableMunicipalities.set(activeMunicipalities);
      this.selectedCityName.set(city.name);

      // Reset municipio
      this.deliveryForm.patchValue({ municipalityCode: '' });

      // Si solo hay un municipio, seleccionarlo automáticamente
      if (activeMunicipalities.length === 1) {
        this.deliveryForm.patchValue({ municipalityCode: activeMunicipalities[0].code });
      }
    } else {
      this.availableMunicipalities.set([]);
      this.selectedCityName.set('');
      this.deliveryForm.patchValue({ municipalityCode: '' });
    }
  }

  /**
   * Continuar al resumen
   */
  onSubmit(): void {
    if (this.deliveryForm.invalid) {
      this.deliveryForm.markAllAsTouched();
      return;
    }

    const formValue = this.deliveryForm.value;
    const city = this.activeCities().find(c => c.code === formValue.cityCode);
    const municipality = this.availableMunicipalities().find(m => m.code === formValue.municipalityCode);

    if (!city || !municipality) {
      return;
    }

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

  /**
   * Volver a selección de despacho
   */
  goBack(): void {
    this.router.navigate(['/checkout/despacho']);
  }

  /**
   * Verificar si un campo tiene error
   */
  hasError(field: string): boolean {
    const control = this.deliveryForm.get(field);
    return control ? control.invalid && control.touched : false;
  }

  /**
   * Obtener mensaje de error para un campo
   */
  getErrorMessage(field: string): string {
    const control = this.deliveryForm.get(field);
    if (!control || !control.errors) return '';

    if (control.errors['required']) return 'Este campo es obligatorio';
    if (control.errors['minlength']) {
      return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`;
    }
    if (control.errors['maxlength']) {
      return `Máximo ${control.errors['maxlength'].requiredLength} caracteres`;
    }
    if (control.errors['pattern']) {
      if (field === 'documentNumber') return 'Ingresa un número de documento válido (6-10 dígitos)';
      if (field === 'phone' || field === 'alternativePhone') {
        return 'Formato: 04XX-XXXXXXX';
      }
    }
    if (control.errors['email']) return 'Ingresa un email válido';

    return 'Campo inválido';
  }
}
