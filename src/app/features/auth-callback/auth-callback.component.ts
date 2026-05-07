import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AccountBlockedCode, AuthService } from '@core/services/auth.service';
import { ToastService } from '@shared/services/toast.service';

const BLOCK_CODES: ReadonlySet<string> = new Set<string>([
  'ACCOUNT_BLOCKED',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_DELETED',
  'ACCOUNT_NOT_FOUND',
]);

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-100">
      <div class="text-center">
        @if (error) {
          <div class="bg-white p-8 rounded-lg shadow-md">
            <svg class="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <h2 class="text-xl font-semibold text-gray-800 mb-2">Error de autenticación</h2>
            <p class="text-gray-600 mb-4">{{ error }}</p>
            <button
              (click)="goHome()"
              class="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-950 transition-colors">
              Volver al inicio
            </button>
          </div>
        } @else {
          <div class="bg-white p-8 rounded-lg shadow-md">
            <div class="animate-spin w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p class="text-gray-600">Iniciando sesión...</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class AuthCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);

  error: string | null = null;

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    const errorParam = this.route.snapshot.queryParamMap.get('error');

    if (errorParam) {
      // Account-blocked errors raise the global modal instead of an inline page.
      if (BLOCK_CODES.has(errorParam)) {
        this.authService.notifyAccountBlocked(
          errorParam as AccountBlockedCode,
          this.messageForError(errorParam)
        );
        this.router.navigate(['/']);
        return;
      }
      this.error = this.messageForError(errorParam);
      return;
    }

    if (token) {
      this.authService.handleOAuthCallback(token);
      this.authService.loadUserProfile().subscribe({
        next: () => {
          const user = this.authService.currentUser();
          const firstName = user?.firstName;
          const message = firstName
            ? `¡Bienvenido de vuelta, ${firstName}!`
            : '¡Inicio de sesión exitoso!';
          this.toastService.success(message);

          // Caso 1 — OAuth users land on the profile page when they still
          // need to fill the mandatory personal data. Otherwise resume
          // wherever they were before clicking "Sign in with Google".
          if (user && user.profileCompleted === false) {
            localStorage.removeItem('oauth_return_url');
            this.router.navigate(['/perfil'], {
              queryParams: { completeProfile: 'true' },
            });
            return;
          }

          const returnUrl = localStorage.getItem('oauth_return_url') || '/';
          localStorage.removeItem('oauth_return_url');
          this.router.navigateByUrl(returnUrl);
        },
        error: () => {
          this.error = 'Error al cargar el perfil. Por favor, intenta de nuevo.';
        },
      });
    } else {
      this.error = 'No se recibió el token de autenticación.';
    }
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  private messageForError(code: string): string {
    switch (code) {
      case 'ACCOUNT_BLOCKED':
        return 'Tu cuenta está bloqueada. Contacta al soporte para más información.';
      case 'ACCOUNT_SUSPENDED':
        return 'Tu cuenta está suspendida. No puedes iniciar sesión en este momento.';
      case 'ACCOUNT_DELETED':
        return 'Esta cuenta ya no existe.';
      case 'ACCOUNT_NOT_FOUND':
        return 'No se encontró una cuenta asociada.';
      case 'EMAIL_ALREADY_REGISTERED_LOCAL':
        return 'Este correo ya tiene una cuenta. Inicia sesión con tu contraseña.';
      default:
        return 'No se pudo iniciar sesión. Por favor, intenta de nuevo.';
    }
  }
}
