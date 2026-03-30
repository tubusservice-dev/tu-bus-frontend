import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SettingsService } from '../../../core/services/settings.service';
import { PaymentMethodService } from '../../../core/services/payment-method.service';
import { UploadService } from '../../../core/services/upload.service';
import { Settings, HeroImage, FloatingStat, PAGINATION_OPTIONS } from '../../../models/settings.model';
import {
  PaymentMethodConfig,
  PaymentMethodType,
  PAYMENT_METHOD_TYPE_LABELS,
} from '../../../models/payment-method.model';

type SectionKey = 'heroImages' | 'homeHero' | 'whatsapp' | 'carousels' | 'pagination' | 'dispatchModules' | 'dispatch' | 'paymentMethods';
type PaginationSubKey = 'catalogLimit' | 'adminLimit';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly settingsService = inject(SettingsService);
  private readonly paymentMethodService = inject(PaymentMethodService);
  private readonly uploadService = inject(UploadService);

  // Estado
  protected readonly isLoading = signal(true);
  protected readonly settings = signal<Settings | null>(null);
  protected readonly activeSection = signal<SectionKey | null>('heroImages');

  // Hero Images
  protected readonly heroImages = signal<HeroImage[]>([]);
  protected readonly isUploadingHeroImage = signal(false);
  protected readonly heroImagePreview = signal<string | null>(null);

  // Métodos de pago
  protected readonly paymentMethods = signal<PaymentMethodConfig[]>([]);
  protected readonly isLoadingMethods = signal(false);
  protected readonly isTogglingMethod = signal<string | null>(null);
  protected readonly isDeletingMethod = signal<string | null>(null);
  protected readonly methodToDelete = signal<PaymentMethodConfig | null>(null);

  // Estados de guardado por sección
  protected readonly isSaving = signal<Record<SectionKey, boolean>>({
    heroImages: false,
    homeHero: false,
    whatsapp: false,
    carousels: false,
    pagination: false,
    dispatchModules: false,
    dispatch: false,
    paymentMethods: false,
  });

  protected readonly saveSuccess = signal<Record<SectionKey, boolean>>({
    heroImages: false,
    homeHero: false,
    whatsapp: false,
    carousels: false,
    pagination: false,
    dispatchModules: false,
    dispatch: false,
    paymentMethods: false,
  });

  protected readonly errorMessage = signal<Record<SectionKey, string | null>>({
    heroImages: null,
    homeHero: null,
    whatsapp: null,
    carousels: null,
    pagination: null,
    dispatchModules: null,
    dispatch: null,
    paymentMethods: null,
  });

  // Opciones de paginación
  protected readonly paginationOptions = PAGINATION_OPTIONS;

  // Estados de guardado separados para paginación
  protected readonly paginationSaving = signal<Record<PaginationSubKey, boolean>>({
    catalogLimit: false,
    adminLimit: false,
  });

  protected readonly paginationSuccess = signal<Record<PaginationSubKey, boolean>>({
    catalogLimit: false,
    adminLimit: false,
  });

  protected readonly paginationError = signal<Record<PaginationSubKey, string | null>>({
    catalogLimit: null,
    adminLimit: null,
  });

  // Formularios
  protected heroImagesCarouselForm!: FormGroup;
  protected floatingStatsForm!: FormGroup;
  protected homeHeroForm!: FormGroup;
  protected whatsappForm!: FormGroup;
  protected carouselsForm!: FormGroup;
  protected paginationForm!: FormGroup;
  protected dispatchModulesForm!: FormGroup;
  protected dispatchForm!: FormGroup;

  ngOnInit(): void {
    this.initForms();
    this.loadSettings();
  }

  private initForms(): void {
    this.heroImagesCarouselForm = this.fb.group({
      isEnabled: [true],
      interval: [5000, [Validators.required, Validators.min(1000), Validators.max(15000)]],
    });

    this.floatingStatsForm = this.fb.group({
      stat1: this.fb.group({
        value: ['500+', [Validators.required, Validators.maxLength(10), Validators.pattern(/^[\d.,+%\s]{1,10}$/)]],
        label: ['Servicios', [Validators.required, Validators.maxLength(20)]],
        isVisible: [true],
      }),
      stat2: this.fb.group({
        value: ['4.9', [Validators.required, Validators.maxLength(10), Validators.pattern(/^[\d.,+%\s]{1,10}$/)]],
        label: ['Valoración', [Validators.required, Validators.maxLength(20)]],
        isVisible: [true],
      }),
    });

    this.homeHeroForm = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(100)]],
      titleAccent: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', [Validators.required, Validators.maxLength(500)]],
    });

    this.whatsappForm = this.fb.group({
      phoneNumber: ['', [Validators.required, Validators.pattern(/^\d{10,15}$/)]],
      isEnabled: [true],
    });

    this.carouselsForm = this.fb.group({
      homeCarousel: this.fb.group({
        isEnabled: [true],
        interval: [5000, [Validators.required, Validators.min(1000), Validators.max(15000)]],
      }),
    });

    this.paginationForm = this.fb.group({
      catalogLimit: [20, Validators.required],
      adminLimit: [20, Validators.required],
      allowUserCustomization: [true],
    });

    this.dispatchModulesForm = this.fb.group({
      storePickup: [true],
      shippingAgency: [false],
      localDelivery: [false],
      sellerAgreement: [false],
    });

    this.dispatchForm = this.fb.group({
      storePickup: this.fb.group({
        address: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(300)]],
        schedule: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(200)]],
        phone: ['', [Validators.required, Validators.minLength(7), Validators.maxLength(20)]],
        additionalInfo: ['', Validators.maxLength(500)],
      }),
    });
  }

  private loadSettings(): void {
    this.isLoading.set(true);
    this.settingsService.getSettings().subscribe({
      next: (response) => {
        const data = response.data;
        this.settings.set(data);

        // Poblar formularios
        if (data.heroImages) {
          this.heroImages.set(data.heroImages.images || []);
          if (data.heroImages.carousel) {
            this.heroImagesCarouselForm.patchValue(data.heroImages.carousel);
          }
          if (data.heroImages.floatingStats?.length) {
            const left = data.heroImages.floatingStats.find((s) => s.position === 'left');
            const right = data.heroImages.floatingStats.find((s) => s.position === 'right');
            if (left) {
              this.floatingStatsForm.get('stat1')?.patchValue(left);
            }
            if (right) {
              this.floatingStatsForm.get('stat2')?.patchValue(right);
            }
          }
        }
        this.homeHeroForm.patchValue(data.homeHero);
        this.whatsappForm.patchValue(data.whatsapp);
        this.carouselsForm.patchValue(data.carousels);
        if (data.pagination) {
          this.paginationForm.patchValue(data.pagination);
        }
        if (data.dispatch) {
          if (data.dispatch.modules) {
            this.dispatchModulesForm.patchValue(data.dispatch.modules);
          }
          if (data.dispatch.storePickup) {
            this.dispatchForm.patchValue({ storePickup: data.dispatch.storePickup });
          }
        }

        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Error cargando configuraciones:', error);
        this.isLoading.set(false);
      },
    });
  }

  toggleSection(section: SectionKey): void {
    if (this.activeSection() === section) {
      this.activeSection.set(null);
    } else {
      this.activeSection.set(section);
      if (section === 'paymentMethods') {
        this.loadPaymentMethods();
      }
    }
  }

  // ========== Hero Images ==========
  onHeroImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (this.heroImages().length >= 5) {
      this.setError('heroImages', 'Máximo 5 imágenes permitidas');
      input.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.setError('heroImages', 'Solo se permiten archivos de imagen');
      input.value = '';
      return;
    }

    this.isUploadingHeroImage.set(true);
    this.clearMessages('heroImages');

    this.uploadService.uploadImage(file, 'hero').subscribe({
      next: (response) => {
        const newImage: HeroImage = {
          url: response.data.url,
          publicId: response.data.publicId,
          order: this.heroImages().length,
        };
        this.heroImages.update((images) => [...images, newImage]);
        this.isUploadingHeroImage.set(false);
        input.value = '';
      },
      error: (error) => {
        this.isUploadingHeroImage.set(false);
        this.setError('heroImages', error.error?.message || 'Error al subir imagen');
        input.value = '';
      },
    });
  }

  removeHeroImage(index: number): void {
    const image = this.heroImages()[index];
    if (!image) return;

    this.uploadService.deleteImage(image.publicId).subscribe({
      next: () => {
        this.heroImages.update((images) => {
          const updated = images.filter((_, i) => i !== index);
          return updated.map((img, i) => ({ ...img, order: i }));
        });
      },
      error: () => {
        // Remove from local state even if Cloudinary delete fails
        this.heroImages.update((images) => {
          const updated = images.filter((_, i) => i !== index);
          return updated.map((img, i) => ({ ...img, order: i }));
        });
      },
    });
  }

  moveHeroImage(index: number, direction: 'up' | 'down'): void {
    const images = [...this.heroImages()];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= images.length) return;

    [images[index], images[targetIndex]] = [images[targetIndex], images[index]];
    this.heroImages.set(images.map((img, i) => ({ ...img, order: i })));
  }

  saveHeroImages(): void {
    if (this.floatingStatsForm.invalid) {
      this.floatingStatsForm.markAllAsTouched();
      this.setError('heroImages', 'Revisa los campos de los indicadores flotantes');
      return;
    }

    this.setSaving('heroImages', true);
    this.clearMessages('heroImages');

    const stat1 = this.floatingStatsForm.get('stat1')?.value;
    const stat2 = this.floatingStatsForm.get('stat2')?.value;

    const floatingStats: FloatingStat[] = [
      { ...stat1, position: 'left' as const },
      { ...stat2, position: 'right' as const },
    ];

    const payload = {
      images: this.heroImages(),
      carousel: this.heroImagesCarouselForm.value,
      floatingStats,
    };

    this.settingsService.updateHeroImages(payload).subscribe({
      next: () => {
        this.setSaving('heroImages', false);
        this.setSuccess('heroImages', true);
        setTimeout(() => this.setSuccess('heroImages', false), 3000);
      },
      error: (error) => {
        this.setSaving('heroImages', false);
        this.setError('heroImages', error.error?.message || 'Error al guardar');
      },
    });
  }

  openHeroImagePreview(url: string): void {
    this.heroImagePreview.set(url);
  }

  closeHeroImagePreview(): void {
    this.heroImagePreview.set(null);
  }

  getHeroCarouselIntervalInSeconds(): number {
    return (this.heroImagesCarouselForm.get('interval')?.value || 5000) / 1000;
  }

  // ========== Home Hero ==========
  saveHomeHero(): void {
    if (this.homeHeroForm.invalid) {
      this.homeHeroForm.markAllAsTouched();
      return;
    }

    this.setSaving('homeHero', true);
    this.clearMessages('homeHero');

    this.settingsService.updateHomeHero(this.homeHeroForm.value).subscribe({
      next: () => {
        this.setSaving('homeHero', false);
        this.setSuccess('homeHero', true);
        setTimeout(() => this.setSuccess('homeHero', false), 3000);
      },
      error: (error) => {
        this.setSaving('homeHero', false);
        this.setError('homeHero', error.error?.message || 'Error al guardar');
      },
    });
  }

  // ========== WhatsApp ==========
  saveWhatsApp(): void {
    if (this.whatsappForm.invalid) {
      this.whatsappForm.markAllAsTouched();
      return;
    }

    this.setSaving('whatsapp', true);
    this.clearMessages('whatsapp');

    this.settingsService.updateWhatsApp(this.whatsappForm.value).subscribe({
      next: () => {
        this.setSaving('whatsapp', false);
        this.setSuccess('whatsapp', true);
        setTimeout(() => this.setSuccess('whatsapp', false), 3000);
      },
      error: (error) => {
        this.setSaving('whatsapp', false);
        this.setError('whatsapp', error.error?.message || 'Error al guardar');
      },
    });
  }

  // ========== Carruseles ==========
  saveCarousels(): void {
    if (this.carouselsForm.invalid) {
      this.carouselsForm.markAllAsTouched();
      return;
    }

    this.setSaving('carousels', true);
    this.clearMessages('carousels');

    this.settingsService.updateCarousels(this.carouselsForm.value).subscribe({
      next: () => {
        this.setSaving('carousels', false);
        this.setSuccess('carousels', true);
        setTimeout(() => this.setSuccess('carousels', false), 3000);
      },
      error: (error) => {
        this.setSaving('carousels', false);
        this.setError('carousels', error.error?.message || 'Error al guardar');
      },
    });
  }

  getIntervalInSeconds(control: string): number {
    const group = this.carouselsForm.get(control) as FormGroup;
    return (group?.get('interval')?.value || 5000) / 1000;
  }

  // ========== Paginación ==========
  saveCatalogSettings(): void {
    const catalogLimit = Number(this.paginationForm.get('catalogLimit')?.value);
    const allowUserCustomization = this.paginationForm.get('allowUserCustomization')?.value;
    this.savePaginationField('catalogLimit', { catalogLimit, allowUserCustomization });
  }

  saveAdminLimit(): void {
    const value = Number(this.paginationForm.get('adminLimit')?.value);
    this.savePaginationField('adminLimit', { adminLimit: value });
  }

  saveAllowUserCustomization(): void {
    const value = this.paginationForm.get('allowUserCustomization')?.value;
    this.settingsService.updatePagination({ allowUserCustomization: value }).subscribe();
  }

  private savePaginationField(field: PaginationSubKey, data: Record<string, unknown>): void {
    this.paginationSaving.update((s) => ({ ...s, [field]: true }));
    this.paginationError.update((s) => ({ ...s, [field]: null }));
    this.paginationSuccess.update((s) => ({ ...s, [field]: false }));

    this.settingsService.updatePagination(data).subscribe({
      next: () => {
        this.paginationSaving.update((s) => ({ ...s, [field]: false }));
        this.paginationSuccess.update((s) => ({ ...s, [field]: true }));
        setTimeout(() => {
          this.paginationSuccess.update((s) => ({ ...s, [field]: false }));
        }, 2000);
      },
      error: (error) => {
        this.paginationSaving.update((s) => ({ ...s, [field]: false }));
        this.paginationError.update((s) => ({ ...s, [field]: error.error?.message || 'Error al guardar' }));
      },
    });
  }

  // ========== Módulos de Despacho ==========
  saveDispatchModule(module: 'storePickup' | 'shippingAgency' | 'localDelivery' | 'sellerAgreement'): void {
    const value = this.dispatchModulesForm.get(module)?.value;
    this.settingsService.updateDispatch({ modules: { [module]: value } }).subscribe();
  }

  // ========== Despacho (Configuración) ==========
  saveDispatch(): void {
    if (this.dispatchForm.invalid) {
      this.dispatchForm.markAllAsTouched();
      return;
    }

    this.setSaving('dispatch', true);
    this.clearMessages('dispatch');

    this.settingsService.updateDispatch(this.dispatchForm.value).subscribe({
      next: () => {
        this.setSaving('dispatch', false);
        this.setSuccess('dispatch', true);
        setTimeout(() => this.setSuccess('dispatch', false), 3000);
      },
      error: (error) => {
        this.setSaving('dispatch', false);
        this.setError('dispatch', error.error?.message || 'Error al guardar');
      },
    });
  }

  // ========== Métodos de Pago ==========
  loadPaymentMethods(): void {
    if (this.paymentMethods().length > 0) return; // Ya cargados
    this.isLoadingMethods.set(true);
    this.paymentMethodService.getAll().subscribe({
      next: (response) => {
        this.paymentMethods.set(response.data);
        this.isLoadingMethods.set(false);
      },
      error: () => {
        this.isLoadingMethods.set(false);
      },
    });
  }

  getMethodTypeLabel(type: PaymentMethodType): string {
    return PAYMENT_METHOD_TYPE_LABELS[type] || type;
  }

  getMethodDetails(method: PaymentMethodConfig): string {
    switch (method.type) {
      case PaymentMethodType.PAGO_MOVIL:
        return method.pagoMovil ? `${method.pagoMovil.phoneNumber} - ${method.pagoMovil.bankName}` : '-';
      case PaymentMethodType.TRANSFERENCIA:
        return method.transferencia ? `${method.transferencia.accountNumber} - ${method.transferencia.bankName}` : '-';
      case PaymentMethodType.EFECTIVO_DIVISAS:
      case PaymentMethodType.TARJETA:
        return method.customMessage || 'Sin mensaje';
      default:
        return '-';
    }
  }

  toggleMethodStatus(method: PaymentMethodConfig): void {
    this.isTogglingMethod.set(method.id);
    this.paymentMethodService.toggleActive(method.id).subscribe({
      next: (response) => {
        this.paymentMethods.update((items) =>
          items.map((m) => (m.id === method.id ? response.data : m))
        );
        this.isTogglingMethod.set(null);
      },
      error: () => {
        this.isTogglingMethod.set(null);
      },
    });
  }

  openDeleteMethodModal(method: PaymentMethodConfig): void {
    this.methodToDelete.set(method);
  }

  closeDeleteMethodModal(): void {
    this.methodToDelete.set(null);
  }

  confirmDeleteMethod(): void {
    const method = this.methodToDelete();
    if (!method) return;

    this.isDeletingMethod.set(method.id);
    this.paymentMethodService.delete(method.id).subscribe({
      next: () => {
        this.paymentMethods.update((items) => items.filter((m) => m.id !== method.id));
        this.isDeletingMethod.set(null);
        this.methodToDelete.set(null);
      },
      error: () => {
        this.isDeletingMethod.set(null);
      },
    });
  }

  // ========== Helpers ==========
  private setSaving(section: SectionKey, value: boolean): void {
    this.isSaving.update((state) => ({ ...state, [section]: value }));
  }

  private setSuccess(section: SectionKey, value: boolean): void {
    this.saveSuccess.update((state) => ({ ...state, [section]: value }));
  }

  private setError(section: SectionKey, message: string | null): void {
    this.errorMessage.update((state) => ({ ...state, [section]: message }));
  }

  private clearMessages(section: SectionKey): void {
    this.setError(section, null);
    this.setSuccess(section, false);
  }
}
