import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent {
  private readonly authService = inject(AuthService);

  /** Nombre de la aplicación */
  protected readonly appName = environment.appName;

  /** Usuario actual */
  protected readonly user = this.authService.currentUser;

  /** Nombre del usuario */
  protected readonly userName = computed(() => {
    const user = this.user();
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user?.username || 'Admin';
  });

  /** Cards del dashboard */
  protected readonly dashboardCards = [
    {
      title: 'Administradores',
      description: 'Gestiona los administradores del sistema',
      icon: 'admin',
      route: '/admin/administrators',
      color: 'red',
    },
    {
      title: 'Usuarios',
      description: 'Gestiona los usuarios de la tienda',
      icon: 'users',
      route: '/admin/users',
      color: 'blue',
    },
    {
      title: 'Productos',
      description: 'Gestiona el catálogo de productos',
      icon: 'products',
      route: '/admin/products',
      color: 'green',
    },
    {
      title: 'Líneas',
      description: 'Gestiona las líneas de productos',
      icon: 'lines',
      route: '/admin/lines',
      color: 'purple',
    },
    {
      title: 'Categorías',
      description: 'Gestiona las categorías de productos',
      icon: 'categories',
      route: '/admin/categories',
      color: 'orange',
    },
  ];
}