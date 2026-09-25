import { Component, inject, input, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SettingsService } from '@core/services/settings.service';

/** "Contacto de soporte para el mecánico" section: admin contact shown to mechanics. */
@Component({
  selector: 'app-support-contact-settings',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './support-contact-settings.component.html',
  styleUrl: './support-contact-settings.component.scss',
})
export class SupportContactSettingsComponent {
  private readonly settingsService = inject(SettingsService);

  readonly supportContactForm = input.required<FormGroup>();

  protected readonly isSaving = signal(false);
  protected readonly saveSuccess = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected saveSupportContact(): void {
    const form = this.supportContactForm();
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.saveSuccess.set(false);

    this.settingsService.updateSupportContact(form.value).subscribe({
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
}
