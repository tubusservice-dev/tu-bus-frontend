import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ShippingAgencyService } from '../../../../core/services/shipping-agency.service';
import { UploadService } from '../../../../core/services/upload.service';

type ConfigOption = 'collectOnDelivery' | 'freeShipping' | 'additionalCharge';

@Component({
  selector: 'app-shipping-agency-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './shipping-agency-form.component.html',
  styleUrl: './shipping-agency-form.component.scss',
})
export class ShippingAgencyFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly shippingAgencyService = inject(ShippingAgencyService);
  private readonly uploadService = inject(UploadService);

  protected readonly agencyId = signal<string | null>(null);
  protected readonly isEditMode = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly isUploading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly imagePreview = signal<string | null>(null);

  // Estados para guardar configuración inline
  protected readonly configSaving = signal(false);
  protected readonly configSuccess = signal(false);
  protected readonly configError = signal<string | null>(null);

  protected readonly form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    image: [''],
    isActive: [true],
    // Configuración
    collectOnDelivery: [true],
    freeShipping: [false],
    additionalCharge: [false],
    additionalChargeAmount: [0, [Validators.min(0)]],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.agencyId.set(id);
      this.isEditMode.set(true);
      this.loadAgency(id);
    }
  }

  private loadAgency(id: string): void {
    this.isLoading.set(true);
    this.shippingAgencyService.getById(id).subscribe({
      next: (response) => {
        const agency = response.data;
        this.form.patchValue({
          name: agency.name,
          description: agency.description || '',
          image: agency.image || '',
          isActive: agency.isActive,
          collectOnDelivery: agency.config?.collectOnDelivery ?? true,
          freeShipping: agency.config?.freeShipping ?? false,
          additionalCharge: agency.config?.additionalCharge ?? false,
          additionalChargeAmount: agency.config?.additionalChargeAmount ?? 0,
        });
        if (agency.image) {
          this.imagePreview.set(agency.image);
        }
        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al cargar agencia');
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Maneja el cambio de toggles de configuración
   * Solo permite una opción activa a la vez
   */
  onConfigToggle(event: Event, option: ConfigOption): void {
    event.preventDefault();
    event.stopPropagation();

    const currentValue = this.form.get(option)?.value;

    // Si ya está activo, no hacer nada (siempre debe haber uno seleccionado)
    if (currentValue) {
      return;
    }

    // Desactivar todas las opciones y activar solo la seleccionada
    this.form.patchValue({
      collectOnDelivery: option === 'collectOnDelivery',
      freeShipping: option === 'freeShipping',
      additionalCharge: option === 'additionalCharge',
    });
  }

  /**
   * Guarda solo la configuración (modo edición)
   */
  saveConfig(): void {
    if (!this.isEditMode() || !this.agencyId()) return;

    const config = {
      collectOnDelivery: this.form.get('collectOnDelivery')?.value,
      freeShipping: this.form.get('freeShipping')?.value,
      additionalCharge: this.form.get('additionalCharge')?.value,
      additionalChargeAmount: Number(this.form.get('additionalChargeAmount')?.value) || 0,
    };

    // Validar que si additionalCharge está activo, el monto sea mayor a 0
    if (config.additionalCharge && config.additionalChargeAmount <= 0) {
      this.configError.set('El monto debe ser mayor a 0');
      return;
    }

    this.configSaving.set(true);
    this.configError.set(null);
    this.configSuccess.set(false);

    this.shippingAgencyService.updateConfig(this.agencyId()!, config).subscribe({
      next: () => {
        this.configSaving.set(false);
        this.configSuccess.set(true);
        setTimeout(() => this.configSuccess.set(false), 2000);
      },
      error: (error) => {
        this.configSaving.set(false);
        this.configError.set(error.error?.message || 'Error al guardar configuración');
      },
    });
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    this.isUploading.set(true);
    this.errorMessage.set(null);

    try {
      const response = await this.uploadService.uploadImage(file, 'shipping-agencies').toPromise();
      if (response?.data?.url) {
        this.form.patchValue({ image: response.data.url });
        this.imagePreview.set(response.data.url);
      }
    } catch (error: any) {
      this.errorMessage.set(error.error?.message || 'Error al subir imagen');
    }

    this.isUploading.set(false);
    input.value = '';
  }

  removeImage(): void {
    this.form.patchValue({ image: '' });
    this.imagePreview.set(null);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // Validar configuración
    const additionalCharge = this.form.get('additionalCharge')?.value;
    const additionalChargeAmount = Number(this.form.get('additionalChargeAmount')?.value) || 0;

    if (additionalCharge && additionalChargeAmount <= 0) {
      this.errorMessage.set('El monto adicional debe ser mayor a 0 cuando la opción está activa');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const formValue = this.form.value;
    const data = {
      name: formValue.name,
      description: formValue.description,
      image: formValue.image,
      isActive: formValue.isActive,
      config: {
        collectOnDelivery: formValue.collectOnDelivery,
        freeShipping: formValue.freeShipping,
        additionalCharge: formValue.additionalCharge,
        additionalChargeAmount: Number(formValue.additionalChargeAmount) || 0,
      },
    };

    const request$ = this.isEditMode()
      ? this.shippingAgencyService.update(this.agencyId()!, data)
      : this.shippingAgencyService.create(data);

    request$.subscribe({
      next: () => {
        this.router.navigate(['/admin/shipping-agencies']);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al guardar agencia');
        this.isSubmitting.set(false);
      },
    });
  }

  hasError(field: string, error: string): boolean {
    const control = this.form.get(field);
    return !!(control?.hasError(error) && control?.touched);
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!(control?.invalid && control?.touched);
  }

  get showAdditionalAmount(): boolean {
    return this.form.get('additionalCharge')?.value === true;
  }
}
