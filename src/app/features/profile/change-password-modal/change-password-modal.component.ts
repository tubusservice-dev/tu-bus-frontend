import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { UserService } from '../../../core';

@Component({
  selector: 'app-change-password-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './change-password-modal.component.html',
  styleUrl: './change-password-modal.component.scss',
})
export class ChangePasswordModalComponent {
  private readonly userService = inject(UserService);
  private readonly fb = inject(FormBuilder);

  readonly close = output<void>();

  protected readonly isLoading = signal(false);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  // Password visibility toggles
  protected readonly showCurrentPassword = signal(false);
  protected readonly showNewPassword = signal(false);
  protected readonly showConfirmPassword = signal(false);

  // Mismatch tracking (signal-driven since reactive forms don't trigger computed)
  protected readonly passwordsMismatch = signal(false);
  protected readonly canSubmit = signal(false);

  protected passwordForm: FormGroup;

  constructor() {
    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required, Validators.minLength(6)]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    });
  }

  onClose(): void {
    this.close.emit();
  }

  toggleVisibility(field: 'current' | 'new' | 'confirm'): void {
    switch (field) {
      case 'current': this.showCurrentPassword.update(v => !v); break;
      case 'new': this.showNewPassword.update(v => !v); break;
      case 'confirm': this.showConfirmPassword.update(v => !v); break;
    }
  }

  /** Recheck passwords match when input changes */
  onPasswordInput(): void {
    this.errorMessage.set(null);
    const newPass = this.passwordForm.get('newPassword')?.value || '';
    const confirm = this.passwordForm.get('confirmPassword')?.value || '';
    const hasBoth = newPass.length > 0 && confirm.length > 0;
    this.passwordsMismatch.set(hasBoth && newPass !== confirm);
    this.canSubmit.set(this.passwordForm.valid && hasBoth && newPass === confirm && !this.isLoading());
  }

  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = this.passwordForm.value;

    if (newPassword !== confirmPassword) {
      this.errorMessage.set('Las contraseñas no coinciden');
      return;
    }

    this.isLoading.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    this.userService.changePassword({ currentPassword, newPassword }).subscribe({
      next: (response) => {
        this.successMessage.set(response.message || 'Contraseña actualizada exitosamente');
        this.isLoading.set(false);
        setTimeout(() => this.onClose(), 2000);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al cambiar la contraseña');
        this.isLoading.set(false);
      },
    });
  }

  hasError(field: string): boolean {
    const control = this.passwordForm.get(field);
    return !!control && control.invalid && control.touched;
  }

  getErrorMessage(field: string): string {
    const control = this.passwordForm.get(field);
    if (!control || !control.errors) return '';
    if (control.errors['required']) return 'Este campo es requerido';
    if (control.errors['minlength']) return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`;
    return 'Campo inválido';
  }
}
