import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Generic confirmation modal: "we sent an email, check your inbox".
 * Used for both forgot-password and post-verification-resend flows.
 */
@Component({
  selector: 'app-email-sent-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './email-sent-modal.component.html',
  styleUrl: './email-sent-modal.component.scss',
})
export class EmailSentModalComponent {
  /** Email shown in the message body. */
  readonly email = input<string>('');
  /** Optional contextual subtitle. */
  readonly subtitle = input<string>('Te hemos enviado un correo. Revisa tu bandeja de entrada.');

  readonly closeModal = output<void>();
}
