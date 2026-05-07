import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@core/services';
import { ToastService } from '@shared/services/toast.service';

type Phase = 'verifying' | 'success' | 'invalid';

/**
 * Landing page for the account-link verification email (Caso 3).
 * Consumes the token, auto-logs the user in, and surfaces the
 * "cuenta vinculada y verificada" success modal.
 *
 * Idempotency: Gmail's link preview occasionally pre-fetches the URL
 * which would consume the token before the user actually clicks. If the
 * user is already authenticated when this page loads, we skip the verify
 * call and treat it as a successful flow. The same applies when the user
 * accidentally double-clicks the link.
 */
@Component({
  selector: 'app-verify-account-link',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './verify-account-link.component.html',
  styleUrl: './verify-account-link.component.scss',
})
export class VerifyAccountLinkComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);

  protected readonly phase = signal<Phase>('verifying');
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!token) {
      this.phase.set('invalid');
      this.errorMessage.set('Link inválido. No recibimos un token.');
      return;
    }

    // Already authenticated → the link was probably consumed by a prior
    // visit (or a Gmail prefetch). Treat as success.
    if (this.authService.isAuthenticated()) {
      this.phase.set('success');
      return;
    }

    this.authService.verifyAccountLink(token).subscribe({
      next: () => this.phase.set('success'),
      error: (err) => {
        this.phase.set('invalid');
        const code = err.error?.code;
        if (code === 'EXPIRED_ACCOUNT_LINK_TOKEN') {
          this.errorMessage.set(
            'El link expiró. Solicita un nuevo registro desde "Crear cuenta".'
          );
        } else if (code === 'INVALID_ACCOUNT_LINK_TOKEN') {
          // Most likely cause: the user submitted the form again and the
          // newer request invalidated this link. Point them at the latest
          // email instead of leaving them stuck.
          this.errorMessage.set(
            'Este link ya fue reemplazado por uno más reciente. Revisa tu bandeja de entrada y abre el correo más nuevo.'
          );
        } else {
          this.errorMessage.set(err.error?.message || 'No pudimos vincular tu cuenta.');
        }
      },
    });
  }

  /**
   * On success the user is auto-logged. Drop them on /perfil and surface
   * the "complete profile" modal — same destination Google sign-ups land on.
   */
  continueAfterSuccess(): void {
    const user = this.authService.currentUser();
    const firstName = user?.firstName;
    this.toastService.success(
      firstName ? `¡Bienvenido, ${firstName}!` : 'Cuenta vinculada exitosamente.'
    );

    const queryParams = user?.profileCompleted ? {} : { completeProfile: 'true' };
    this.router.navigate(['/perfil'], { queryParams });
  }

  goToLogin(): void {
    this.router.navigate(['/']).then(() => this.authService.openAuthModal('login'));
  }

  goToHome(): void {
    this.router.navigate(['/']);
  }
}
