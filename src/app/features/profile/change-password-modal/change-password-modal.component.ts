import { Component, inject, signal, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService, UserService } from '../../../core';

type PasswordModalMode = 'set' | 'change';

@Component({
  selector: 'app-change-password-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './change-password-modal.component.html',
  styleUrl: './change-password-modal.component.scss',
})
export class ChangePasswordModalComponent {
  private readonly authService = inject(AuthService);
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

  /**
   * Snapshot del modo capturado en construcción. NO reactivo a propósito —
   * un re-fetch del perfil mid-flight no debe cambiar el modo del form ni el
   * endpoint al que apunta el submit (deep-debug 2026-05-09).
   */
  protected readonly mode = signal<PasswordModalMode>(
    this.authService.currentUser()?.hasPassword ? 'change' : 'set'
  );

  protected readonly title = computed(() =>
    this.mode() === 'set' ? 'Agregar Contraseña' : 'Cambiar Contraseña'
  );

  protected readonly submitLabel = computed(() =>
    this.mode() === 'set' ? 'Guardar Contraseña' : 'Cambiar Contraseña'
  );

  protected passwordForm: FormGroup;

  constructor() {
    const isChange = this.mode() === 'change';
    this.passwordForm = this.fb.group({
      ...(isChange
        ? { currentPassword: ['', [Validators.required, Validators.minLength(6)]] }
        : {}),
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

  submit(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const { newPassword, confirmPassword } = this.passwordForm.value;

    if (newPassword !== confirmPassword) {
      this.errorMessage.set('Las contraseñas no coinciden');
      return;
    }

    this.isLoading.set(true);
    this.successMessage.set(null);
    this.errorMessage.set(null);

    if (this.mode() === 'set') {
      this.userService.setPassword({ newPassword }).subscribe({
        next: (response) => {
          this.successMessage.set(response.message || 'Contraseña configurada exitosamente');
          // Refresh the cached user so future opens render in `change` mode.
          this.authService.loadUserProfile().subscribe({ next: () => {}, error: () => {} });
          this.isLoading.set(false);
          setTimeout(() => this.onClose(), 2000);
        },
        error: (error) => {
          this.errorMessage.set(error.error?.message || 'Error al configurar la contraseña');
          this.isLoading.set(false);
        },
      });
      return;
    }

    const currentPassword = this.passwordForm.get('currentPassword')?.value;
    this.userService.changePassword({ currentPassword, newPassword }).subscribe({
      next: (response) => {
        // El backend invalida el JWT actual via passwordChangedAt y emite uno
        // nuevo en la respuesta — lo persistimos para mantener la sesión
        // sin sacar al usuario.
        if (response.data?.token && response.data?.user) {
          this.authService.applyNewSession(response.data.token, response.data.user);
        }
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
