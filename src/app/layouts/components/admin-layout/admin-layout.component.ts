import { Component, inject, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService, AdminNotificationService } from '../../../core/services';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly notificationService = inject(AdminNotificationService);

  /** Nombre de la aplicación */
  protected readonly appName = environment.appName;

  /** Estado del sidebar en móvil */
  protected readonly isSidebarOpen = signal(false);

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

  /** Avatar del usuario */
  protected readonly userAvatar = computed(() => {
    const user = this.user();
    if (user?.avatar) return user.avatar;
    const name = this.userName();
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=991b1b&color=fff&size=128`;
  });

  /** Items del menú de navegación */
  protected readonly menuItems = [
    {
      label: 'Dashboard',
      icon: 'dashboard',
      route: '/admin',
      exact: true,
    },
    {
      label: 'Administradores',
      icon: 'admin',
      route: '/admin/administrators',
      exact: false,
    },
    {
      label: 'Usuarios',
      icon: 'users',
      route: '/admin/users',
      exact: false,
    },
    {
      label: 'Productos',
      icon: 'products',
      route: '/admin/products',
      exact: false,
    },
    {
      label: 'Líneas',
      icon: 'lines',
      route: '/admin/lines',
      exact: false,
    },
    {
      label: 'Categorías',
      icon: 'categories',
      route: '/admin/categories',
      exact: false,
    },
    {
      label: 'Marcas',
      icon: 'brands',
      route: '/admin/brands',
      exact: false,
    },
    {
      label: 'Agencias de Envío',
      icon: 'shipping',
      route: '/admin/shipping-agencies',
      exact: false,
    },
    {
      label: 'Zonas',
      icon: 'zones',
      route: '/admin/zones',
      exact: false,
    },
    {
      label: 'Mecanicos',
      icon: 'wrench',
      route: '/admin/mechanics',
      exact: false,
    },
    {
      label: 'Ordenes',
      icon: 'orders',
      route: '/admin/orders',
      exact: false,
    },
    {
      label: 'Configuraciones',
      icon: 'settings',
      route: '/admin/settings',
      exact: true,
    },
  ];

  ngOnInit(): void {
    this.notificationService.startPolling();
  }

  ngOnDestroy(): void {
    this.notificationService.stopPolling();
  }

  /** Toggle del sidebar en móvil */
  toggleSidebar(): void {
    this.isSidebarOpen.update((value) => !value);
  }

  /** Cerrar sidebar */
  closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }

  /** Cerrar sesión */
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/admin/login']);
  }
}