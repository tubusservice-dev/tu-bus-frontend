import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Post-link-account modal: shown after the user submits the link-account
 * form. Tells them to check their inbox for the verification link.
 *
 * No "resend" CTA: re-sending an account-link verification requires the
 * full payload (password + identity), which lives only in the form. If the
 * user re-submits the form a second time, the previous token is invalidated
 * to keep at most one valid link per user. We surface that explanation in
 * the verify-account-link landing page when the user clicks an outdated
 * link.
 */
@Component({
  selector: 'app-account-link-pending-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './account-link-pending-modal.component.html',
  styleUrl: './account-link-pending-modal.component.scss',
})
export class AccountLinkPendingModalComponent {
  readonly email = input<string>('');
  readonly firstName = input<string>('');

  readonly closeModal = output<void>();
}
