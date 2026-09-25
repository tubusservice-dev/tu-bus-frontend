import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PaymentMethodService } from '@core/services/payment-method.service';
import {
  PaymentMethodConfig,
  PaymentMethodType,
  PAYMENT_METHOD_TYPE_LABELS,
  getPaymentMethodSummary,
} from '@models/payment-method.model';

/**
 * "Métodos de Pago" section: quick list of the checkout payment methods with
 * activate / delete actions. The list is fetched the first time the section
 * is opened, not with the rest of the settings.
 */
@Component({
  selector: 'app-payment-methods-settings',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './payment-methods-settings.component.html',
  styleUrl: './payment-methods-settings.component.scss',
})
export class PaymentMethodsSettingsComponent {
  private readonly paymentMethodService = inject(PaymentMethodService);

  /** Whether the accordion section is open; opening it triggers the load. */
  readonly active = input(false);

  protected readonly paymentMethods = signal<PaymentMethodConfig[]>([]);
  protected readonly isLoadingMethods = signal(false);
  protected readonly isTogglingMethod = signal<string | null>(null);
  protected readonly isDeletingMethod = signal<string | null>(null);
  protected readonly methodToDelete = signal<PaymentMethodConfig | null>(null);

  /** Template-facing alias that delegates to the shared helper so both admin
   *  list views (this settings section and `/admin/payment-methods`) stay
   *  in sync when a new PaymentMethodType is added. */
  protected readonly getMethodDetails = getPaymentMethodSummary;

  constructor() {
    // Only `active` is tracked: the list itself must not re-trigger a load.
    effect(() => {
      if (this.active()) untracked(() => this.loadPaymentMethods());
    });
  }

  private loadPaymentMethods(): void {
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

  protected getMethodTypeLabel(type: PaymentMethodType): string {
    return PAYMENT_METHOD_TYPE_LABELS[type] || type;
  }

  protected toggleMethodStatus(method: PaymentMethodConfig): void {
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

  protected openDeleteMethodModal(method: PaymentMethodConfig): void {
    this.methodToDelete.set(method);
  }

  protected closeDeleteMethodModal(): void {
    this.methodToDelete.set(null);
  }

  protected confirmDeleteMethod(): void {
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
}
