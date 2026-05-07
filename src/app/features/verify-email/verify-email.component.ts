import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@core/services';
import { ToastService } from '@shared/services/toast.service';

type Phase = 'verifying' | 'success' | 'invalid';

/**
 * Landing page for the email-verification link.
 *
 * Two outcomes drive the UX:
 *   - success: the backend returned a JWT alongside the verification result
 *     (auto-login). Click "Continuar" sends the user to /perfil with the
 *     "complete profile" modal open — same flow as Google sign-up.
 *   - invalid: bad/expired/used token. Offer "Volver al inicio".
 */
@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.scss',
})
export class VerifyEmailComponent implements OnInit {
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

    this.authService.verifyEmail(token).subscribe({
      next: () => this.phase.set('success'),
      error: (err) => {
        this.phase.set('invalid');
        const code = err.error?.code;
        if (code === 'EXPIRED_VERIFICATION_TOKEN') {
          this.errorMessage.set('El link expiró. Solicita uno nuevo desde tu cuenta.');
        } else if (code === 'INVALID_VERIFICATION_TOKEN') {
          this.errorMessage.set('Este link es inválido o ya fue usado.');
        } else {
          this.errorMessage.set(err.error?.message || 'No pudimos verificar tu correo.');
        }
      },
    });
  }

  /**
   * Continue after a successful verification. The backend auto-logged the
   * user in, so we route them to /perfil and surface the "complete
   * profile" modal — same destination Google sign-ups land on.
   */
  continueAfterSuccess(): void {
    const firstName = this.authService.currentUser()?.firstName;
    this.toastService.success(
      firstName ? `¡Bienvenido, ${firstName}!` : 'Correo verificado exitosamente.'
    );
    this.router.navigate(['/perfil'], { queryParams: { completeProfile: 'true' } });
  }

  goToHome(): void {
    this.router.navigate(['/']);
  }
}
