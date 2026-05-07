import { Component, signal, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '@core/services';

/**
 * Standalone modal that asks the user for an email and triggers
 * `POST /api/auth/forgot-password`. Emits one of three events to its parent:
 *  - 'sent'                  → standard reset (email-sent-modal)
 *  - 'notFound'              → email not registered (register? modal)
 *  - 'accountLinkRequired'   → Google-only account → reroute to register
 *                              modal in linkAccount mode with prefilled email.
 *
 * Decoupled from the rest of the auth flow; parent owns visibility.
 */
@Component({
  selector: 'app-forgot-password-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './forgot-password-modal.component.html',
  styleUrl: './forgot-password-modal.component.scss',
})
export class ForgotPasswordModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  readonly closeModal = output<void>();
  readonly emailSent = output<string>();
  readonly emailNotFound = output<string>();
  /**
   * Emitted when the email belongs to a Google-only account. Caller should
   * close this modal and open the auth modal in `linkAccount` mode with
   * the email prefilled.
   */
  readonly accountLinkRequired = output<string>();

  protected readonly form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const email: string = this.form.value.email.trim().toLowerCase();
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.forgotPassword(email).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.data.exists && res.data.requiresAccountLink) {
          this.accountLinkRequired.emit(email);
          return;
        }
        if (res.data.exists) {
          this.emailSent.emit(email);
        } else {
          this.emailNotFound.emit(email);
        }
      },
      error: (err) => {
        this.isLoading.set(false);
        const body = err.error;
        this.errorMessage.set(body?.message || 'Error al enviar el correo. Intenta de nuevo.');
      },
    });
  }

  hasError(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && control.touched;
  }

  getErrorMessage(field: string): string {
    const control = this.form.get(field);
    if (!control || !control.errors) return '';
    if (control.errors['required']) return 'Este campo es requerido';
    if (control.errors['email']) return 'Ingresa un email válido';
    return 'Campo inválido';
  }
}
