import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '@core/services';

type Phase = 'verifying' | 'invalid' | 'form' | 'success';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  protected readonly phase = signal<Phase>('verifying');
  protected readonly invalidReason = signal<string | null>(null);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly showConfirm = signal(false);
  protected readonly passwordsMismatch = signal(false);

  protected readonly form: FormGroup = this.fb.group({
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]],
  });

  private token = '';

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) {
      this.phase.set('invalid');
      this.invalidReason.set('Link inválido. Solicita un nuevo enlace de recuperación.');
      return;
    }

    this.authService.verifyResetToken(this.token).subscribe({
      next: (res) => {
        if (res.data.valid) {
          this.phase.set('form');
        } else {
          this.phase.set('invalid');
          this.invalidReason.set(this.messageForReason(res.data.reason));
        }
      },
      error: () => {
        this.phase.set('invalid');
        this.invalidReason.set('No pudimos validar el enlace. Intenta de nuevo más tarde.');
      },
    });
  }

  onPasswordChange(): void {
    this.errorMessage.set(null);
    const a = this.form.value.newPassword || '';
    const b = this.form.value.confirmPassword || '';
    this.passwordsMismatch.set(a.length > 0 && b.length > 0 && a !== b);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { newPassword, confirmPassword } = this.form.value;
    if (newPassword !== confirmPassword) {
      this.errorMessage.set('Las contraseñas no coinciden');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.authService.resetPassword(this.token, newPassword).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.phase.set('success');
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const code = err.error?.code;
        if (code === 'EXPIRED_RESET_TOKEN') {
          this.phase.set('invalid');
          this.invalidReason.set('El link expiró. Solicita uno nuevo.');
          return;
        }
        if (code === 'INVALID_RESET_TOKEN') {
          this.phase.set('invalid');
          this.invalidReason.set('El link es inválido o ya fue usado.');
          return;
        }
        this.errorMessage.set(err.error?.message || 'Error al cambiar la contraseña.');
      },
    });
  }

  goToLogin(): void {
    this.router.navigate(['/']).then(() => this.authService.openAuthModal());
  }

  goToHome(): void {
    this.router.navigate(['/']);
  }

  hasError(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && control.touched;
  }

  getErrorMessage(field: string): string {
    const control = this.form.get(field);
    if (!control || !control.errors) return '';
    if (control.errors['required']) return 'Este campo es requerido';
    if (control.errors['minlength']) {
      return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`;
    }
    return 'Campo inválido';
  }

  private messageForReason(reason?: string): string {
    switch (reason) {
      case 'expired':
        return 'El link expiró. Solicita un nuevo enlace de recuperación.';
      case 'used':
        return 'Este link ya fue usado. Solicita uno nuevo si lo necesitas.';
      default:
        return 'Link inválido. Solicita un nuevo enlace de recuperación.';
    }
  }
}
