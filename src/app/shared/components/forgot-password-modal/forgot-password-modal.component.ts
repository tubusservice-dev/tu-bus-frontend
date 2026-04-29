import { Component, signal, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services';

/**
 * Standalone modal that asks the user for an email and triggers
 * `POST /api/auth/forgot-password`. Emits an event to its parent indicating
 * which follow-up modal should be shown:
 *  - 'sent'    → email-sent-modal (success path)
 *  - 'notFound' → email-not-found-modal (email not registered)
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

  /** Emitted when the user closes the modal without acting. */
  readonly closeModal = output<void>();
  /** Emitted on successful send — payload is the email used. */
  readonly emailSent = output<string>();
  /** Emitted when the email is not registered. */
  readonly emailNotFound = output<string>();

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
