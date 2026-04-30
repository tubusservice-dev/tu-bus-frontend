import { Component, input, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services';

/**
 * Post-registration modal shown when EMAIL_VERIFICATION_REQUIRED is on.
 *
 * Lets the user resend the verification email. Closes when the user chooses
 * "Continuar" — the user remains NOT logged in until they click the link in
 * the actual email.
 */
@Component({
  selector: 'app-verify-email-pending-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './verify-email-pending-modal.component.html',
  styleUrl: './verify-email-pending-modal.component.scss',
})
export class VerifyEmailPendingModalComponent {
  private readonly authService = inject(AuthService);

  readonly email = input<string>('');
  readonly firstName = input<string>('');

  readonly closeModal = output<void>();

  protected readonly isResending = signal(false);
  protected readonly resendSuccess = signal(false);
  protected readonly resendError = signal<string | null>(null);

  onResend(): void {
    const email = this.email();
    if (!email) return;

    this.isResending.set(true);
    this.resendError.set(null);
    this.resendSuccess.set(false);

    this.authService.resendVerification(email).subscribe({
      next: () => {
        this.isResending.set(false);
        this.resendSuccess.set(true);
        // Reset success message after 5s for clarity
        setTimeout(() => this.resendSuccess.set(false), 5000);
      },
      error: (err) => {
        this.isResending.set(false);
        this.resendError.set(
          err.error?.message ||
            'No pudimos reenviar el correo. Intenta de nuevo más tarde.'
        );
      },
    });
  }
}
