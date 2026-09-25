import { Component, inject, input, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SettingsService } from '@core/services/settings.service';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';

type CustomerSupportField = 'whatsapp' | 'instagram' | 'facebook' | 'x';

/**
 * "Contacto para atención al Cliente" section: the WhatsApp button and the
 * footer social links shown on the landing.
 */
@Component({
  selector: 'app-customer-support-settings',
  standalone: true,
  imports: [ReactiveFormsModule, ConfirmDialogComponent],
  templateUrl: './customer-support-settings.component.html',
  styleUrl: './customer-support-settings.component.scss',
})
export class CustomerSupportSettingsComponent {
  private readonly settingsService = inject(SettingsService);

  readonly customerSupportForm = input.required<FormGroup>();

  /**
   * Per-field state. Each input (whatsapp / instagram / facebook / x) ships
   * an independent pair of buttons (Guardar / Eliminar) so we track saving
   * and feedback per key instead of a single section-level flag.
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

  /** Contact field awaiting confirmation; `null` closes the dialog. */
  protected readonly customerFieldToDelete = signal<CustomerSupportField | null>(null);

  /**
   * Save a single customer-support field. The other 3 channels are
   * preserved because the backend endpoint accepts a partial payload.
   */
  protected saveCustomerField(field: CustomerSupportField): void {
    const ctrl = this.customerSupportForm().get(field);
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

  protected askDeleteCustomerField(field: CustomerSupportField): void { this.customerFieldToDelete.set(field); }
  protected cancelDeleteCustomerField(): void { this.customerFieldToDelete.set(null); }

  protected confirmDeleteCustomerField(): void {
    const field = this.customerFieldToDelete();
    if (!field) return;
    this.customerFieldToDelete.set(null);
    this.deleteCustomerField(field);
  }

  /**
   * Clear a single customer-support field. Sends an empty string so the
   * backend writes '' — the landing page treats that as "not configured"
   * and falls back to the "Próximamente" toast.
   */
  private deleteCustomerField(field: CustomerSupportField): void {
    this.setCustomerFieldSaving(field, true);
    this.setCustomerFieldError(field, null);

    this.settingsService.updateCustomerSupport({ [field]: '' }).subscribe({
      next: () => {
        this.customerSupportForm().get(field)?.setValue('');
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
}
