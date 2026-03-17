import { Component, signal, output, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services';

type AuthMode = 'login' | 'register';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './auth-modal.component.html',
  styleUrl: './auth-modal.component.scss',
})
export class AuthModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  /** Evento para cerrar el modal */
  readonly closeModal = output<void>();

  /** Modo actual del modal (login o registro) */
  protected readonly mode = signal<AuthMode>('login');

  /** Estado de carga */
  protected readonly isLoading = signal(false);

  /** Mensaje de error */
  protected readonly errorMessage = signal<string | null>(null);

  /** Indica si la sesión expiró */
  protected readonly sessionExpired = this.authService.sessionExpired;

  /** Formulario de login */
  protected readonly loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  /** Formulario de registro */
  protected readonly registerForm: FormGroup = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]],
  });

  ngOnInit(): void {
    // Si la sesión expiró, mostrar mensaje y limpiar el flag después de un tiempo
    if (this.sessionExpired()) {
      setTimeout(() => {
        this.authService.clearSessionExpired();
      }, 5000);
    }
  }

  /**
   * Cambia entre modo login y registro
   */
  switchMode(newMode: AuthMode): void {
    this.mode.set(newMode);
    this.errorMessage.set(null);
    this.loginForm.reset();
    this.registerForm.reset();
  }

  /**
   * Envía el formulario de login
   */
  onLogin(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.login(this.loginForm.value).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.closeModal.emit();
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          error.error?.message || 'Error al iniciar sesión. Intenta de nuevo.'
        );
      },
    });
  }

  /**
   * Envía el formulario de registro
   */
  onRegister(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const { confirmPassword, ...registerData } = this.registerForm.value;

    if (registerData.password !== confirmPassword) {
      this.errorMessage.set('Las contraseñas no coinciden');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.register(registerData).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.closeModal.emit();
      },
      error: (error) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          error.error?.message || 'Error al registrarse. Intenta de nuevo.'
        );
      },
    });
  }

  /**
   * Inicia sesión con OAuth
   */
  loginWithGoogle(): void {
    this.authService.loginWithOAuth('google');
  }

  loginWithFacebook(): void {
    this.authService.loginWithOAuth('facebook');
  }

  /**
   * Cierra el modal al hacer click en el overlay
   */
  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.closeModal.emit();
    }
  }

  /**
   * Verifica si un campo tiene error
   */
  hasError(form: FormGroup, field: string): boolean {
    const control = form.get(field);
    return !!control && control.invalid && control.touched;
  }

  /**
   * Obtiene el mensaje de error de un campo
   */
  getErrorMessage(form: FormGroup, field: string): string {
    const control = form.get(field);
    if (!control || !control.errors) return '';

    if (control.errors['required']) return 'Este campo es requerido';
    if (control.errors['email']) return 'Ingresa un email válido';
    if (control.errors['minlength']) {
      const minLength = control.errors['minlength'].requiredLength;
      return `Mínimo ${minLength} caracteres`;
    }

    return 'Campo inválido';
  }
}
