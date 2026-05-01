import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/services';
import { ToastService } from '../../../shared/services/toast.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.scss',
})
export class AdminLoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  /** Formulario de login */
  protected loginForm: FormGroup = this.fb.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  /** Estado de carga */
  protected readonly isLoading = signal(false);

  /** Mensaje de error */
  protected readonly errorMessage = signal<string | null>(null);

  /**
   * Envía el formulario de login
   */
  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { username, password } = this.loginForm.value;

    this.http.post<any>(`${environment.apiUrl}/admin/login`, { username, password }).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        if (response.success && response.data) {
          // Usar AuthService para guardar token y usuario (evitar manipular localStorage directamente)
          this.authService.handleAdminLogin(response.data.token, response.data.user);
          const firstName = response.data.user?.firstName;
          const message = firstName
            ? `¡Bienvenido de vuelta, ${firstName}!`
            : '¡Inicio de sesión exitoso!';
          this.toastService.success(message);
          // Navegar al dashboard de admin
          this.router.navigate(['/admin']);
        }
      },
      error: (error) => {
        this.isLoading.set(false);
        if (this.authService.triggerAccountBlocked(error)) {
          return;
        }
        this.errorMessage.set(error.error?.message || 'Error al iniciar sesión');
      },
    });
  }

  /**
   * Verifica si un campo tiene error
   */
  hasError(field: string): boolean {
    const control = this.loginForm.get(field);
    return !!control && control.invalid && control.touched;
  }

  /**
   * Obtiene el mensaje de error de un campo
   */
  getErrorMessage(field: string): string {
    const control = this.loginForm.get(field);
    if (!control || !control.errors) return '';

    if (control.errors['required']) return 'Este campo es requerido';
    if (control.errors['minlength']) {
      return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`;
    }

    return 'Campo inválido';
  }
}
