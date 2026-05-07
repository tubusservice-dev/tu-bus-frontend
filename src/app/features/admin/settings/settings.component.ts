import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SettingsService } from '../../../core/services/settings.service';
import { PaymentMethodService } from '../../../core/services/payment-method.service';
import { UploadService } from '../../../core/services/upload.service';
import { ExchangeRateService } from '../../../core/services/exchange-rate.service';
import { Settings, HeroImage, FloatingStat, PAGINATION_OPTIONS } from '../../../models/settings.model';
import {
  PaymentMethodConfig,
  PaymentMethodType,
  PAYMENT_METHOD_TYPE_LABELS,
  getPaymentMethodSummary,
} from '../../../models/payment-method.model';

type SectionKey = 'heroImages' | 'homeHero' | 'whatsapp' | 'carousels' | 'pagination' | 'dispatchModules' | 'dispatch' | 'paymentMethods' | 'exchangeRate' | 'supportContact' | 'customerSupport' | 'adminNotifications';
type CustomerSupportField = 'whatsapp' | 'instagram' | 'facebook' | 'x';
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
  protected readonly exchangeRateService = inject(ExchangeRateService);

  // Current site location — used in inline help text so prod admins see
  // their real domain instead of "localhost:4200".
  protected readonly currentHost = window.location.host;
  protected readonly currentOrigin = window.location.origin;

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

  // Exchange Rate
  protected readonly isRefreshing = signal(false);
  protected readonly refreshMessage = signal<string | null>(null);
  protected readonly refreshChanged = signal<boolean | null>(null);
  protected readonly rateError = signal<string | null>(null);
  protected readonly showBsPrice = signal(false);
  protected readonly toggleSaving = signal(false);
  protected readonly useCustomRate = signal(false);
  protected readonly customToggleSaving = signal(false);
  protected readonly showCustomRateModal = signal(false);
  protected readonly customRateInput = signal<number | null>(null);
  protected readonly customRateSaving = signal(false);
  protected readonly customRateError = signal<string | null>(null);
  protected readonly customRateSuccess = signal<string | null>(null);
  protected readonly isEditingCustom = signal(false);

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
    exchangeRate: false,
    supportContact: false,
    customerSupport: false,
    adminNotifications: false,
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
    exchangeRate: false,
    supportContact: false,
    customerSupport: false,
    adminNotifications: false,
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
    exchangeRate: null,
    supportContact: null,
    customerSupport: null,
    adminNotifications: null,
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
  protected supportContactForm!: FormGroup;
  protected customerSupportForm!: FormGroup;

  /**
   * Per-field state for the "Atención al Cliente" accordion. Each input
   * (whatsapp / instagram / facebook / x) ships an independent pair of
   * buttons (Guardar / Eliminar) so we track saving and feedback per key
   * instead of a single section-level flag.
   */
  protected readonly customerFieldSaving = signal<Record<CustomerSupportField, boolean>>({
    whatsapp: false, instagram: false, facebook: false, x: false,
  });
  protected readonly customerFieldSuccess = signal<Record<CustomerSupportField, boolean>>({
    whatsapp: false, instagram: false, facebook: false, x: false,
  });
  protected readonly customerFieldError = signal<Record<CustomerSupportField, string | null>>({
    whatsapp: null, instagram: null, facebook: null, x: null,
  });
  protected adminNotificationsForm!: FormGroup;

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
        value: ['500', [Validators.required, Validators.pattern(/^[0-9]{1,4}$/)]],
        isVisible: [true],
      }),
      stat2: this.fb.group({
        value: ['5', [Validators.required, Validators.pattern(/^[1-5]$/)]],
        isVisible: [true],
        source: ['manual'],
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

    this.supportContactForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.maxLength(20)]],
      lastName: ['', [Validators.required, Validators.maxLength(20)]],
      phone: ['', [Validators.required, Validators.pattern(/^04\d{2}-?\d{7}$/)]],
      whatsapp: ['', [Validators.pattern(/^(?:\+?\d{1,3})?[\s-]?\d{10,11}$/), Validators.maxLength(20)]],
    });

    this.customerSupportForm = this.fb.group({
      whatsapp: ['', [Validators.pattern(/^(?:\+?\d{1,3})?[\s-]?\d{10,11}$/), Validators.maxLength(20)]],
      instagram: ['', [Validators.pattern(/^(https?:\/\/.+)?$/), Validators.maxLength(200)]],
      facebook: ['', [Validators.pattern(/^(https?:\/\/.+)?$/), Validators.maxLength(200)]],
      x: ['', [Validators.pattern(/^(https?:\/\/.+)?$/), Validators.maxLength(200)]],
    });

    this.adminNotificationsForm = this.fb.group({
      newOrder: [true],
      paymentNote: [true],
      mechanicRejection: [true],
      customerCancellation: [true],
      serviceProgress: [true],
      browserPush: [true],
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
              // Sanitize legacy values like "500+" → "500" to satisfy the new pattern.
              const cleanValue = String(left.value ?? '').replace(/\D/g, '').slice(0, 3) || '500';
              this.floatingStatsForm.get('stat1')?.patchValue({ ...left, value: cleanValue });
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

        // Support contact
        if (data.supportContact) {
          this.supportContactForm.patchValue(data.supportContact);
        }

        // Customer support contact
        if (data.customerSupport) {
          this.customerSupportForm.patchValue(data.customerSupport);
        }

        // Admin notifications preferences
        if (data.adminNotifications) {
          this.adminNotificationsForm.patchValue(data.adminNotifications);
        }

        // Exchange rate config
        if (data.exchangeRate) {
          this.showBsPrice.set(data.exchangeRate.showBsPrice);
          this.useCustomRate.set(data.exchangeRate.useCustomRate ?? false);
        }

        // Load current exchange rate
        this.exchangeRateService.loadAdminRate();

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

  protected isAutoRating(): boolean {
    return this.floatingStatsForm.get('stat2.source')?.value === 'reviews_average';
  }

  protected toggleAutoRating(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.floatingStatsForm.get('stat2.source')?.setValue(checked ? 'reviews_average' : 'manual');
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

    // Labels are hardcoded on the landing, but the backend schema requires
    // the field — we inject a fixed placeholder to satisfy validation.
    const floatingStats: FloatingStat[] = [
      { ...stat1, label: 'Servicios', position: 'left' as const, source: 'manual' as const },
      { ...stat2, label: 'Valoración', position: 'right' as const },
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

  /** Template-facing alias that delegates to the shared helper so both admin
   *  list views (this settings section and `/admin/payment-methods`) stay
   *  in sync when a new PaymentMethodType is added. */
  protected readonly getMethodDetails = getPaymentMethodSummary;

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

  // ========== Contacto de Soporte ==========
  saveSupportContact(): void {
    if (this.supportContactForm.invalid) {
      this.supportContactForm.markAllAsTouched();
      return;
    }

    this.setSaving('supportContact', true);
    this.clearMessages('supportContact');

    this.settingsService.updateSupportContact(this.supportContactForm.value).subscribe({
      next: () => {
        this.setSaving('supportContact', false);
        this.setSuccess('supportContact', true);
        setTimeout(() => this.setSuccess('supportContact', false), 3000);
      },
      error: (error) => {
        this.setSaving('supportContact', false);
        this.setError('supportContact', error.error?.message || 'Error al guardar');
      },
    });
  }

  // ========== Contacto para Atención al Cliente (per-field save/delete) ==========

  /**
   * Save a single customer-support field. The other 3 channels are
   * preserved because the backend endpoint accepts a partial payload.
   */
  saveCustomerField(field: CustomerSupportField): void {
    const ctrl = this.customerSupportForm.get(field);
    if (!ctrl || ctrl.invalid) {
      ctrl?.markAsTouched();
      return;
    }
    this.setCustomerFieldSaving(field, true);
    this.setCustomerFieldError(field, null);

    this.settingsService.updateCustomerSupport({ [field]: ctrl.value || '' }).subscribe({
      next: () => {
        this.setCustomerFieldSaving(field, false);
        this.setCustomerFieldSuccess(field, true);
        setTimeout(() => this.setCustomerFieldSuccess(field, false), 2500);
      },
      error: (error) => {
        this.setCustomerFieldSaving(field, false);
        this.setCustomerFieldError(field, error.error?.message || 'Error al guardar');
      },
    });
  }

  /**
   * Clear a single customer-support field. Sends an empty string so the
   * backend writes '' — the landing page treats that as "not configured"
   * and falls back to the "Próximamente" toast.
   */
  deleteCustomerField(field: CustomerSupportField): void {
    this.setCustomerFieldSaving(field, true);
    this.setCustomerFieldError(field, null);

    this.settingsService.updateCustomerSupport({ [field]: '' }).subscribe({
      next: () => {
        this.customerSupportForm.get(field)?.setValue('');
        this.setCustomerFieldSaving(field, false);
        this.setCustomerFieldSuccess(field, true);
        setTimeout(() => this.setCustomerFieldSuccess(field, false), 2500);
      },
      error: (error) => {
        this.setCustomerFieldSaving(field, false);
        this.setCustomerFieldError(field, error.error?.message || 'Error al eliminar');
      },
    });
  }

  private setCustomerFieldSaving(field: CustomerSupportField, value: boolean): void {
    this.customerFieldSaving.update((s) => ({ ...s, [field]: value }));
  }
  private setCustomerFieldSuccess(field: CustomerSupportField, value: boolean): void {
    this.customerFieldSuccess.update((s) => ({ ...s, [field]: value }));
  }
  private setCustomerFieldError(field: CustomerSupportField, value: string | null): void {
    this.customerFieldError.update((s) => ({ ...s, [field]: value }));
  }

  // ========== Notificaciones del Admin ==========
  saveAdminNotificationToggle(
    field: 'newOrder' | 'paymentNote' | 'mechanicRejection' | 'customerCancellation' | 'serviceProgress' | 'browserPush'
  ): void {
    const value = this.adminNotificationsForm.get(field)?.value;
    this.settingsService.updateAdminNotifications({ [field]: value }).subscribe({
      next: () => {
        this.setSuccess('adminNotifications', true);
        setTimeout(() => this.setSuccess('adminNotifications', false), 2000);
      },
      error: (error) => {
        this.setError('adminNotifications', error.error?.message || 'Error al guardar');
      },
    });
  }

  async requestBrowserPushPermission(): Promise<void> {
    if (!('Notification' in window)) {
      this.setError('adminNotifications', 'Tu navegador no soporta notificaciones push');
      return;
    }
    if (Notification.permission === 'granted') return;
    if (Notification.permission === 'denied') {
      this.setError('adminNotifications', 'Las notificaciones están bloqueadas. Revisa las instrucciones abajo para habilitarlas.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        this.setError('adminNotifications', 'Permiso de notificaciones denegado');
      }
    } catch {
      this.setError('adminNotifications', 'No se pudo solicitar permiso');
    }
  }

  /** Estado actual del permiso de notificaciones */
  protected getBrowserPushStatus(): 'granted' | 'denied' | 'default' | 'unsupported' {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  }

  /** Dispara una notificación de prueba para verificar permisos y sonido */
  async testBrowserPushNotification(): Promise<void> {
    if (!('Notification' in window)) {
      this.setError('adminNotifications', 'Tu navegador no soporta notificaciones push');
      return;
    }

    // Si no hay permiso, solicitarlo
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        this.setError('adminNotifications', 'Permiso denegado. Habilítalo desde los ajustes del navegador.');
        return;
      }
    }

    if (Notification.permission === 'denied') {
      this.setError('adminNotifications', 'Las notificaciones están bloqueadas. Revisa las instrucciones abajo para habilitarlas.');
      return;
    }

    try {
      const notif = new Notification('TuBus Express — Prueba', {
        body: 'Si ves este mensaje, las notificaciones push están funcionando correctamente.',
        icon: '/autobus.png',
        badge: '/autobus.png',
        tag: `test-notification-${Date.now()}`,
      });
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
      this.setSuccess('adminNotifications', true);
      setTimeout(() => this.setSuccess('adminNotifications', false), 3000);
    } catch {
      this.setError('adminNotifications', 'No se pudo mostrar la notificación de prueba');
    }
  }

  // ========== Tasa de Cambio ==========
  toggleShowBsPrice(): void {
    const newValue = !this.showBsPrice();
    this.toggleSaving.set(true);
    this.settingsService.updateExchangeRateConfig({ showBsPrice: newValue }).subscribe({
      next: () => {
        this.showBsPrice.set(newValue);
        this.toggleSaving.set(false);
      },
      error: () => {
        this.toggleSaving.set(false);
      },
    });
  }

  toggleCustomRate(): void {
    if (this.useCustomRate()) {
      // Turning OFF → disable custom rate
      this.customToggleSaving.set(true);
      this.settingsService.updateExchangeRateConfig({ useCustomRate: false }).subscribe({
        next: () => {
          this.useCustomRate.set(false);
          this.customToggleSaving.set(false);
        },
        error: () => this.customToggleSaving.set(false),
      });
    } else {
      // Turning ON → open modal to set custom rate
      this.customRateInput.set(null);
      this.customRateError.set(null);
      this.showCustomRateModal.set(true);
    }
  }

  onCustomRateModalInput(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.customRateInput.set(isNaN(value) ? null : value);
  }

  cancelCustomRateModal(): void {
    this.showCustomRateModal.set(false);
    this.customRateInput.set(null);
    this.customRateError.set(null);
    // Toggle stays OFF
  }

  confirmCustomRate(): void {
    const value = this.customRateInput();
    if (!value || value <= 0) {
      this.customRateError.set('Ingresa un valor mayor a 0');
      return;
    }

    this.customRateSaving.set(true);
    this.customRateError.set(null);

    this.exchangeRateService.updateCustomRate(value).subscribe({
      next: () => {
        // Save custom rate, then enable useCustomRate in settings
        this.settingsService.updateExchangeRateConfig({ useCustomRate: true }).subscribe({
          next: () => {
            this.useCustomRate.set(true);
            this.customRateSaving.set(false);
            this.showCustomRateModal.set(false);
          },
          error: () => {
            this.customRateSaving.set(false);
            this.showCustomRateModal.set(false);
          },
        });
      },
      error: (error) => {
        this.customRateSaving.set(false);
        this.customRateError.set(error.error?.message || 'Error al guardar la tasa');
      },
    });
  }

  openEditCustomModal(): void {
    const current = this.exchangeRateService.customRate();
    this.customRateInput.set(current);
    this.customRateError.set(null);
    this.isEditingCustom.set(true);
    this.showCustomRateModal.set(true);
  }

  confirmEditCustomRate(): void {
    const value = this.customRateInput();
    if (!value || value <= 0) {
      this.customRateError.set('Ingresa un valor mayor a 0');
      return;
    }

    this.customRateSaving.set(true);
    this.customRateError.set(null);

    this.exchangeRateService.updateCustomRate(value).subscribe({
      next: () => {
        this.customRateSaving.set(false);
        this.showCustomRateModal.set(false);
        this.isEditingCustom.set(false);
        this.customRateSuccess.set('Tasa personalizada actualizada');
        setTimeout(() => this.customRateSuccess.set(null), 3000);
      },
      error: (error) => {
        this.customRateSaving.set(false);
        this.customRateError.set(error.error?.message || 'Error al guardar la tasa');
      },
    });
  }

  closeCustomRateModal(): void {
    if (this.isEditingCustom()) {
      this.isEditingCustom.set(false);
      this.showCustomRateModal.set(false);
    } else {
      this.cancelCustomRateModal();
    }
  }

  refreshRate(): void {
    this.isRefreshing.set(true);
    this.rateError.set(null);
    this.refreshMessage.set(null);
    this.refreshChanged.set(null);

    this.exchangeRateService.refreshRate().subscribe({
      next: (response) => {
        this.isRefreshing.set(false);
        this.refreshChanged.set(response.changed ?? false);
        this.refreshMessage.set(response.message ?? 'Consulta realizada');
        setTimeout(() => {
          this.refreshMessage.set(null);
          this.refreshChanged.set(null);
        }, 5000);
      },
      error: (error) => {
        this.isRefreshing.set(false);
        this.rateError.set(error.error?.message || 'Error al consultar la tasa BCV');
        setTimeout(() => this.rateError.set(null), 5000);
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
