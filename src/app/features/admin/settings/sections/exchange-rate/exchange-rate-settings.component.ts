import { Component, inject, model, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { SettingsService } from '@core/services/settings.service';
import { ExchangeRateService } from '@core/services/exchange-rate.service';

/**
 * "Tasa del Dólar" section: Bs price toggle, official BCV rate refresh and
 * the optional custom rate (set through its own modal). The parent seeds
 * both toggles from the loaded settings.
 */
@Component({
  selector: 'app-exchange-rate-settings',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './exchange-rate-settings.component.html',
  styleUrl: './exchange-rate-settings.component.scss',
})
export class ExchangeRateSettingsComponent {
  private readonly settingsService = inject(SettingsService);
  protected readonly exchangeRateService = inject(ExchangeRateService);

  readonly showBsPrice = model.required<boolean>();
  readonly useCustomRate = model.required<boolean>();

  protected readonly isRefreshing = signal(false);
  protected readonly refreshMessage = signal<string | null>(null);
  protected readonly refreshChanged = signal<boolean | null>(null);
  protected readonly rateError = signal<string | null>(null);
  protected readonly toggleSaving = signal(false);
  protected readonly customToggleSaving = signal(false);
  protected readonly showCustomRateModal = signal(false);
  protected readonly customRateInput = signal<number | null>(null);
  protected readonly customRateSaving = signal(false);
  protected readonly customRateError = signal<string | null>(null);
  protected readonly customRateSuccess = signal<string | null>(null);
  protected readonly isEditingCustom = signal(false);

  protected toggleShowBsPrice(): void {
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

  protected toggleCustomRate(): void {
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

  protected onCustomRateModalInput(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.customRateInput.set(isNaN(value) ? null : value);
  }

  private cancelCustomRateModal(): void {
    this.showCustomRateModal.set(false);
    this.customRateInput.set(null);
    this.customRateError.set(null);
    // Toggle stays OFF
  }

  protected confirmCustomRate(): void {
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

  protected openEditCustomModal(): void {
    const current = this.exchangeRateService.customRate();
    this.customRateInput.set(current);
    this.customRateError.set(null);
    this.isEditingCustom.set(true);
    this.showCustomRateModal.set(true);
  }

  protected confirmEditCustomRate(): void {
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

  protected closeCustomRateModal(): void {
    if (this.isEditingCustom()) {
      this.isEditingCustom.set(false);
      this.showCustomRateModal.set(false);
    } else {
      this.cancelCustomRateModal();
    }
  }

  protected refreshRate(): void {
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
}
