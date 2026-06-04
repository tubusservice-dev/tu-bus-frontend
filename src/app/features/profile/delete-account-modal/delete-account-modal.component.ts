import { Component, inject, signal, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, UserService } from '../../../core';
import { ToastService } from '@shared/services/toast.service';

/**
 * Irreversible account-deletion confirmation modal (Google Play
 * account-deletion policy). Renders one of two verification fields:
 *   - Local accounts (hasPassword) confirm with their current password.
 *   - OAuth-only accounts type the confirmation phrase, since there is no
 *     password to verify.
 *
 * On success the backend has already anonymized the account and invalidated
 * the JWT, so we immediately log the user out — the success toast survives
 * the navigation via the global toast container.
 */
@Component({
  selector: 'app-delete-account-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './delete-account-modal.component.html',
  styleUrl: './delete-account-modal.component.scss',
})
export class DeleteAccountModalComponent {
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly toast = inject(ToastService);

  readonly close = output<void>();

  /** Literal phrase OAuth-only users must type. Mirrors the backend constant. */
  protected readonly confirmationPhrase = 'ELIMINAR';

  /**
   * Snapshot of whether the account has a local password, captured at
   * construction. Drives which verification field renders: a password input
   * for local accounts, the confirmation-phrase input for OAuth-only ones.
   */
  protected readonly hasPassword = signal(!!this.authService.currentUser()?.hasPassword);

  protected readonly password = signal('');
  protected readonly typedPhrase = signal('');
  protected readonly acknowledged = signal(false);
  protected readonly showPassword = signal(false);

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  /** Submit unlocks only when identity proof is provided AND the user ticked the ack box. */
  protected readonly canSubmit = computed(() => {
    if (this.isLoading() || !this.acknowledged()) return false;
    return this.hasPassword()
      ? this.password().length > 0
      : this.typedPhrase().trim().toUpperCase() === this.confirmationPhrase;
  });

  onClose(): void {
    if (this.isLoading()) return;
    this.close.emit();
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  submit(): void {
    if (!this.canSubmit()) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const payload = this.hasPassword()
      ? { currentPassword: this.password() }
      : { confirmationPhrase: this.typedPhrase().trim() };

    this.userService.deleteAccount(payload).subscribe({
      next: () => {
        // Session is dead server-side; clear it locally and bounce home.
        this.toast.success('Tu cuenta ha sido eliminada. Lamentamos verte partir.');
        this.authService.logout();
      },
      error: (error) => {
        this.errorMessage.set(
          error.error?.message || 'No se pudo eliminar la cuenta. Intenta de nuevo.',
        );
        this.isLoading.set(false);
      },
    });
  }
}
