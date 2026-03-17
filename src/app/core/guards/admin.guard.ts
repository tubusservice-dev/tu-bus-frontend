import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services';

/**
 * Guard para proteger rutas de administrador
 * Verifica que el usuario esté autenticado y tenga rol de admin
 */
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.currentUser();

  // Verificar si está autenticado
  if (!authService.isAuthenticated()) {
    router.navigate(['/admin/login']);
    return false;
  }

  // Verificar si es admin
  if (user?.role !== 'admin') {
    router.navigate(['/admin/login']);
    return false;
  }

  return true;
};

/**
 * Guard para la página de login de admin
 * Si ya está autenticado como admin, redirige al dashboard
 */
export const adminLoginGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.currentUser();

  // Si ya está autenticado como admin, redirigir al dashboard
  if (authService.isAuthenticated() && user?.role === 'admin') {
    router.navigate(['/admin']);
    return false;
  }

  return true;
};
