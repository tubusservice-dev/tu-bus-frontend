import { Component, inject, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService, AdminNotificationService } from '../../../core/services';
import { AdminNotificationsService } from '../../../core/services/admin-notifications.service';
import { AdminNotification } from '../../../models/notification.model';
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
  protected readonly adminNotifications = inject(AdminNotificationsService);
  protected readonly selectedNotification = signal<AdminNotification | null>(null);

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
      label: 'Sucursales',
      icon: 'branch',
      route: '/admin/branches',
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

  private originalBodyBg = '';

  ngOnInit(): void {
    this.notificationService.startPolling();
    this.adminNotifications.startPolling();
    this.originalBodyBg = document.body.style.backgroundColor;
    this.updateBodyBg();
    this.mutationObserver = new MutationObserver(() => this.updateBodyBg());
    this.mutationObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }

  private mutationObserver?: MutationObserver;

  private updateBodyBg(): void {
    const isDark = document.documentElement.classList.contains('dark');
    document.body.style.backgroundColor = isDark ? '#111827' : '#f3f4f6';
  }

  ngOnDestroy(): void {
    this.notificationService.stopPolling();
    this.adminNotifications.stopPolling();
    document.body.style.backgroundColor = this.originalBodyBg;
    this.mutationObserver?.disconnect();
  }

  openNotification(n: AdminNotification): void {
    this.selectedNotification.set(n);
    this.adminNotifications.closePopover();
    if (!n.isRead) {
      this.adminNotifications.markAsRead(n.id).subscribe();
    }
  }

  closeNotification(): void {
    this.selectedNotification.set(null);
  }

  getOrderId(n: AdminNotification): string {
    if (n.relatedOrder && typeof n.relatedOrder === 'object') return n.relatedOrder.id || n.relatedOrder._id || '';
    return String(n.relatedOrder || '');
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