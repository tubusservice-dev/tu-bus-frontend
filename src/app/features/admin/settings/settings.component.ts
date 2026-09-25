import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SettingsService } from '@core/services/settings.service';
import { ExchangeRateService } from '@core/services/exchange-rate.service';
import { HeroImage } from '@models/settings.model';
import { SettingsAccordionItemComponent } from '@features/admin/settings/accordion-item/settings-accordion-item.component';
import { HeroImagesSettingsComponent } from '@features/admin/settings/sections/hero-images/hero-images-settings.component';
import { CarouselsSettingsComponent } from '@features/admin/settings/sections/carousels/carousels-settings.component';
import { PaginationSettingsComponent } from '@features/admin/settings/sections/pagination/pagination-settings.component';
import { DispatchModulesSettingsComponent } from '@features/admin/settings/sections/dispatch-modules/dispatch-modules-settings.component';
import { PaymentMethodsSettingsComponent } from '@features/admin/settings/sections/payment-methods/payment-methods-settings.component';
import { ExchangeRateSettingsComponent } from '@features/admin/settings/sections/exchange-rate/exchange-rate-settings.component';
import { AdminNotificationsSettingsComponent } from '@features/admin/settings/sections/admin-notifications/admin-notifications-settings.component';
import { SupportContactSettingsComponent } from '@features/admin/settings/sections/support-contact/support-contact-settings.component';
import { CustomerSupportSettingsComponent } from '@features/admin/settings/sections/customer-support/customer-support-settings.component';
import { SETTINGS_SECTION_ICONS, SettingsSectionKey } from '@features/admin/settings/settings-sections';

/**
 * Admin settings page. Loads the settings once, owns every section form and
 * the open accordion section; each section component edits and saves its
 * own slice.
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    SettingsAccordionItemComponent,
    HeroImagesSettingsComponent,
    CarouselsSettingsComponent,
    PaginationSettingsComponent,
    DispatchModulesSettingsComponent,
    PaymentMethodsSettingsComponent,
    ExchangeRateSettingsComponent,
    AdminNotificationsSettingsComponent,
    SupportContactSettingsComponent,
    CustomerSupportSettingsComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly settingsService = inject(SettingsService);
  private readonly exchangeRateService = inject(ExchangeRateService);

  protected readonly icons = SETTINGS_SECTION_ICONS;

  // Estado
  protected readonly isLoading = signal(true);
  protected readonly activeSection = signal<SettingsSectionKey | null>('heroImages');

  // Loaded values edited by the sections (two-way bound)
  protected readonly heroImages = signal<HeroImage[]>([]);
  protected readonly showBsPrice = signal(false);
  protected readonly useCustomRate = signal(false);

  // Formularios
  protected heroImagesCarouselForm!: FormGroup;
  protected floatingStatsForm!: FormGroup;
  protected carouselsForm!: FormGroup;
  protected paginationForm!: FormGroup;
  protected dispatchModulesForm!: FormGroup;
  protected supportContactForm!: FormGroup;
  protected customerSupportForm!: FormGroup;
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
    });
  }

  private loadSettings(): void {
    this.isLoading.set(true);
    this.settingsService.getSettings().subscribe({
      next: (response) => {
        const data = response.data;

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
        this.carouselsForm.patchValue(data.carousels);
        if (data.pagination) {
          this.paginationForm.patchValue(data.pagination);
        }
        if (data.dispatch?.modules) {
          this.dispatchModulesForm.patchValue(data.dispatch.modules);
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

  protected toggleSection(section: SettingsSectionKey): void {
    this.activeSection.update((current) => (current === section ? null : section));
  }
}
