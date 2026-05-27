import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '@core/services/auth.service';

/**
 * Bidirectional account-linking modal for Apple — symmetric counterpart
 * of `link-google-password-modal`. Opens when a native Apple sign-in
 * attempt collides with an existing LOCAL account (backend returns 409
 * with code EMAIL_ALREADY_REGISTERED_LOCAL). The user supplies the local
 * password to prove ownership; the service posts both the staged
 * identityToken (plus first/last name if Apple returned them on this
 * first sign-in) and the password to `/auth/link-apple-with-password`
 * and persists the resulting session — the Apple identity is now
 * attached to the local account, so future sign-ins can use either method.
 *
 * Visibility is driven by `authService.linkAppleModalOpen` and rendered
 * at app-root so it stacks above any feature overlay or auth modal.
 *
 * Decision D13 (`05-decisions-log.md`): we intentionally KEEP this as a
 * separate component from the Google equivalent (cero risk of regression
 * in the Android-production Google modal). Possible future refactor to a
 * generic `link-oauth-password-modal` is documented as deuda técnica.
 */
@Component({
  selector: 'app-link-apple-password-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './link-apple-password-modal.component.html',
  styleUrl: './link-apple-password-modal.component.scss',
})
export class LinkApplePasswordModalComponent {
  protected readonly authService = inject(AuthService);

  protected readonly password = signal('');
  protected readonly showPassword = signal(false);
  protected readonly loading = signal(false);
  protected readonly errorMessage = signal('');

  protected onSubmit(): void {
    const pwd = this.password().trim();
    if (!pwd) {
      this.errorMessage.set('Ingresa tu contraseña.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    this.authService.linkAppleWithPassword(pwd).subscribe({
      next: () => {
        // The service handles handleAuthSuccess, closeLinkAppleModal and
        // closeAuthModal — we only reset local UI state.
        this.password.set('');
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        const body = err?.error as { code?: string; message?: string } | undefined;
        const code = body?.code;
        switch (code) {
          case 'INVALID_PASSWORD':
            this.errorMessage.set('Contraseña incorrecta.');
            break;
          case 'APPLE_ALREADY_LINKED':
            // Idempotency edge case: a parallel session linked it first.
            this.errorMessage.set(
              'Esta cuenta ya tiene Apple vinculado. Cierra este modal e inicia sesión con Apple.'
            );
            break;
          case 'ACCOUNT_HAS_NO_PASSWORD':
            this.errorMessage.set(
              'Esta cuenta no tiene contraseña. Usa "¿Olvidaste tu contraseña?" para crearla primero.'
            );
            break;
          case 'ACCOUNT_NOT_FOUND':
            this.errorMessage.set('La cuenta asociada a este correo ya no existe.');
            break;
          case 'APPLE_EMAIL_MISSING':
            // Edge case unique to Apple: user enabled "Hide My Email" on a
            // subsequent sign-in and the identityToken came without email.
            // The link flow cannot match without an email — surface a
            // dedicated copy that points the user to support.
            this.errorMessage.set(
              'No pudimos obtener tu correo desde Apple. Si elegiste "Ocultar mi correo", contacta a soporte.'
            );
            break;
          default:
            this.errorMessage.set(
              body?.message ?? 'No se pudo vincular Apple. Intenta de nuevo.'
            );
        }
      },
    });
  }

  protected onClose(): void {
    if (this.loading()) return;
    this.password.set('');
    this.errorMessage.set('');
    this.authService.closeLinkAppleModal();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.onClose();
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }
}
