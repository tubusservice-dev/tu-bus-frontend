import { Component, inject, input, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SettingsService } from '@core/services/settings.service';

/** "Carruseles" section: storefront carousel toggle and interval. */
@Component({
  selector: 'app-carousels-settings',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './carousels-settings.component.html',
  styleUrl: './carousels-settings.component.scss',
})
export class CarouselsSettingsComponent {
  private readonly settingsService = inject(SettingsService);

  readonly carouselsForm = input.required<FormGroup>();

  protected readonly isSaving = signal(false);
  protected readonly saveSuccess = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected saveCarousels(): void {
    const form = this.carouselsForm();
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.saveSuccess.set(false);

    this.settingsService.updateCarousels(form.value).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.saveSuccess.set(true);
        setTimeout(() => this.saveSuccess.set(false), 3000);
      },
      error: (error) => {
        this.isSaving.set(false);
        this.errorMessage.set(error.error?.message || 'Error al guardar');
      },
    });
  }

  protected getIntervalInSeconds(control: string): number {
    const group = this.carouselsForm().get(control) as FormGroup;
    return (group?.get('interval')?.value || 5000) / 1000;
  }
}
