import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

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
              class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
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

  error: string | null = null;

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    const errorParam = this.route.snapshot.queryParamMap.get('error');

    if (errorParam) {
      this.error = 'No se pudo iniciar sesión con Google. Por favor, intenta de nuevo.';
      return;
    }

    if (token) {
      // Limpiar sesión anterior y almacenar nuevo token
      this.authService.handleOAuthCallback(token);
      // Cargar perfil desde el servidor y redirigir a la página donde estaba
      this.authService.loadUserProfile().subscribe({
        next: () => {
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
}
