import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Interceptor funcional para agregar el token JWT a las peticiones
 * y manejar errores de autenticación
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  // Clonar la petición y agregar el token si existe
  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Manejar errores de autenticación (401)
      if (error.status === 401 && authService.isAuthenticated()) {
        authService.handleSessionExpired();

        // Redirigir al home si está en una ruta protegida
        if (router.url.startsWith('/admin') || router.url.startsWith('/perfil')) {
          router.navigate(['/']);
        }
      }

      return throwError(() => error);
    })
  );
};
