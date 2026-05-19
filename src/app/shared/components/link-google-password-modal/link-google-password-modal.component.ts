import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '@core/services/auth.service';

/**
 * Bidirectional account-linking modal: opens when a native Google sign-in
 * attempt collides with an existing LOCAL account (backend returns 409
 * with code EMAIL_ALREADY_REGISTERED_LOCAL). The user supplies the local
 * password to prove ownership; the service posts both the staged idToken
 * and the password to `/auth/link-google-with-password` and persists the
 * resulting session — the Google identity is now attached to the local
 * account, so future sign-ins can use either method.
 *
 * Visibility is driven by `authService.linkGoogleModalOpen` and rendered
 * at app-root so it stacks above any feature overlay or auth modal.
 */
@Component({
  selector: 'app-link-google-password-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './link-google-password-modal.component.html',
  styleUrl: './link-google-password-modal.component.scss',
})
export class LinkGooglePasswordModalComponent {
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

    this.authService.linkGoogleWithPassword(pwd).subscribe({
      next: () => {
        // The service handles handleAuthSuccess, closeLinkGoogleModal and
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
          case 'GOOGLE_ALREADY_LINKED':
            // Idempotency edge case: a parallel session linked it first.
            this.errorMessage.set(
              'Esta cuenta ya tiene Google vinculado. Cierra este modal e inicia sesión con Google.'
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
          default:
            this.errorMessage.set(
              body?.message ?? 'No se pudo vincular Google. Intenta de nuevo.'
            );
        }
      },
    });
  }

  protected onClose(): void {
    if (this.loading()) return;
    this.password.set('');
    this.errorMessage.set('');
    this.authService.closeLinkGoogleModal();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.onClose();
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }
}
