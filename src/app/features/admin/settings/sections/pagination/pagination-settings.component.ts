import { Component, inject, input, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SettingsService } from '@core/services/settings.service';
import { PAGINATION_OPTIONS } from '@models/settings.model';

type PaginationSubKey = 'catalogLimit' | 'adminLimit';

/**
 * "Paginación" section: page size of the catalog and of the admin lists.
 * Each select saves on its own, so saving state is tracked per field.
 */
@Component({
  selector: 'app-pagination-settings',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './pagination-settings.component.html',
  styleUrl: './pagination-settings.component.scss',
})
export class PaginationSettingsComponent {
  private readonly settingsService = inject(SettingsService);

  readonly paginationForm = input.required<FormGroup>();

  protected readonly paginationOptions = PAGINATION_OPTIONS;

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

  protected saveCatalogSettings(): void {
    const form = this.paginationForm();
    const catalogLimit = Number(form.get('catalogLimit')?.value);
    const allowUserCustomization = form.get('allowUserCustomization')?.value;
    this.savePaginationField('catalogLimit', { catalogLimit, allowUserCustomization });
  }

  protected saveAdminLimit(): void {
    const value = Number(this.paginationForm().get('adminLimit')?.value);
    this.savePaginationField('adminLimit', { adminLimit: value });
  }

  protected saveAllowUserCustomization(): void {
    const value = this.paginationForm().get('allowUserCustomization')?.value;
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
}
