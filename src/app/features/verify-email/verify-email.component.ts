import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services';

type Phase = 'verifying' | 'success' | 'invalid';

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

  goToLogin(): void {
    this.router.navigate(['/']).then(() => this.authService.openAuthModal());
  }

  goToHome(): void {
    this.router.navigate(['/']);
  }
}
