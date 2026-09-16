import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '@env';
import { AuthService } from '../services/auth.service';

/** Origin of our own API. The session token must never travel anywhere else. */
const API_ORIGIN = toOrigin(environment.apiUrl);

function toOrigin(url: string): string {
  try {
    // Relative API urls resolve against the page, which is our own origin.
    return new URL(url, globalThis.location?.href ?? 'http://localhost').origin;
  } catch {
    return '';
  }
}

/** True when the request goes to our backend and may carry the token. */
function targetsOwnApi(url: string): boolean {
  return API_ORIGIN !== '' && toOrigin(url) === API_ORIGIN;
}

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

  // Clonar la petición y agregar el token si existe.
  // Solo hacia nuestra propia API: una integración con un tercero no debe
  // recibir jamás la sesión del usuario.
  if (token && targetsOwnApi(req.url)) {
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
