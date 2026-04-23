import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

const BLOCK_ERROR_CODES = new Set([
  'ACCOUNT_BLOCKED',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_DELETED',
  'ACCOUNT_NOT_FOUND',
]);

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
      const code = (error.error && (error.error as any).code) as string | undefined;
      const isBlockedByBackend = code ? BLOCK_ERROR_CODES.has(code) : false;

      // 401 o 403 con código de bloqueo → la sesión deja de ser válida.
      const shouldInvalidate =
        (error.status === 401 || (error.status === 403 && isBlockedByBackend)) &&
        authService.isAuthenticated();

      if (shouldInvalidate) {
        authService.handleSessionExpired();
        // Raise the blocked-account modal if the reason was a block/suspension.
        authService.triggerAccountBlocked(error);

        if (router.url.startsWith('/admin')) {
          router.navigate(['/admin/login']);
        } else if (router.url.startsWith('/perfil') || isBlockedByBackend) {
          router.navigate(['/']);
        }
      }

      return throwError(() => error);
    })
  );
};
