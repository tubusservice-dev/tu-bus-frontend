import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Modal shown when a forgot-password request hits an unregistered email.
 * Offers two actions: register or cancel.
 */
@Component({
  selector: 'app-email-not-found-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './email-not-found-modal.component.html',
  styleUrl: './email-not-found-modal.component.scss',
})
export class EmailNotFoundModalComponent {
  /** Email the user attempted to reset. Shown in the message. */
  readonly email = input<string>('');

  readonly closeModal = output<void>();
  /** Emit when user clicks "Registrarme". Parent should open auth-modal in register tab. */
  readonly goToRegister = output<string>();

  onRegisterClick(): void {
    this.goToRegister.emit(this.email());
  }
}
