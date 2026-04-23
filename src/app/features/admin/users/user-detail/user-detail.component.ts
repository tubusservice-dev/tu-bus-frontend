import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  AdminUserService,
  AdminUserStatsResponse,
  UpdateUserStatusRequest,
} from '../../../../core/services/admin-user.service';
import { AdminUser, UserRole, UserStatus } from '../../../../models';
import { Order, OrderStatus } from '../../../../models/order.model';
import { Vehicle } from '../../../../models/vehicle.model';

type TabKey = 'info' | 'orders' | 'vehicles' | 'audit';

interface StatusModal {
  target: UserStatus;
  title: string;
  confirmLabel: string;
  danger: boolean;
  requiresReason: boolean;
  allowsDuration: boolean;
}

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './user-detail.component.html',
  styleUrl: './user-detail.component.scss',
})
export class UserDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly adminUserService = inject(AdminUserService);

  protected readonly user = signal<AdminUser | null>(null);
  protected readonly stats = signal<AdminUserStatsResponse['data'] | null>(null);
  protected readonly orders = signal<Order[]>([]);
  protected readonly vehicles = signal<Vehicle[]>([]);

  protected readonly isLoading = signal(true);
  protected readonly isLoadingOrders = signal(false);
  protected readonly isLoadingVehicles = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly ordersError = signal<string | null>(null);
  protected readonly vehiclesError = signal<string | null>(null);

  // Track whether each tab has been loaded at least once to avoid re-fetching
  // on every tab switch while still allowing an explicit reload button.
  private readonly ordersLoaded = signal(false);
  private readonly vehiclesLoaded = signal(false);

  protected readonly activeTab = signal<TabKey>('info');

  protected readonly ordersPage = signal(1);
  protected readonly ordersPages = signal(1);
  protected readonly ordersTotal = signal(0);
  protected readonly ordersStatusFilter = signal<'all' | OrderStatus>('all');

  protected readonly statusModal = signal<StatusModal | null>(null);
  protected readonly modalReason = signal('');
  protected readonly modalSuspendedUntil = signal('');
  protected readonly modalError = signal<string | null>(null);
  protected readonly modalBusy = signal(false);

  protected readonly orderStatusChips: { key: 'all' | OrderStatus; label: string }[] = [
    { key: 'all', label: 'Todas' },
    { key: OrderStatus.PENDING, label: 'Pendientes' },
    { key: OrderStatus.APPROVED, label: 'Aprobadas' },
    { key: OrderStatus.COMPLETED, label: 'Completadas' },
    { key: OrderStatus.CANCELLATION_REQUESTED, label: 'Cancelación solicitada' },
    { key: OrderStatus.CANCELLED, label: 'Canceladas' },
  ];

  protected readonly displayName = computed(() => {
    const u = this.user();
    if (!u) return '';
    const full = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
    return full || u.email || u.username || 'Usuario';
  });

  protected readonly avatarUrl = computed(() => {
    const u = this.user();
    if (!u) return '';
    if (u.avatar) return u.avatar;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.displayName())}&background=001d56&color=fff&size=160`;
  });

  protected readonly fullAddress = computed(() => {
    const u = this.user();
    if (!u) return '';
    const parts: string[] = [];
    if (u.street) parts.push(u.street);
    if (u.houseNumber) parts.push(`Nº ${u.houseNumber}`);
    if (u.neighborhood) parts.push(u.neighborhood);
    const locality = [u.municipalityName, u.cityName, u.stateName].filter(Boolean).join(', ');
    if (locality) parts.push(locality);
    if (parts.length === 0 && u.address) return u.address;
    return parts.join(' · ');
  });

  protected readonly ordersPageNumbers = computed(() => {
    const total = this.ordersPages();
    const current = this.ordersPage();
    const out: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) out.push(i);
    return out;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/admin/users']);
      return;
    }
    this.loadAll(id);
  }

  private loadAll(id: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.ordersLoaded.set(false);
    this.vehiclesLoaded.set(false);

    this.adminUserService.getById(id).subscribe({
      next: (response) => {
        this.user.set(response.data);
        this.isLoading.set(false);
        // Stats are always needed for the header cards.
        this.loadStats();
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Error al cargar el usuario');
        this.isLoading.set(false);
      },
    });
  }

  /** Forces an orders reload regardless of prior state (used by retry button). */
  reloadOrders(): void {
    this.ordersLoaded.set(false);
    this.loadOrdersIfNeeded(true);
  }

  /** Forces a vehicles reload regardless of prior state (used by retry button). */
  reloadVehicles(): void {
    this.vehiclesLoaded.set(false);
    this.loadVehiclesIfNeeded(true);
  }

  private loadOrdersIfNeeded(force = false): void {
    if (!force && this.ordersLoaded()) return;
    const u = this.user();
    if (!u) return;
    this.isLoadingOrders.set(true);
    this.ordersError.set(null);
    const status = this.ordersStatusFilter() === 'all' ? undefined : this.ordersStatusFilter();
    this.adminUserService.getOrders(u.id, this.ordersPage(), 10, status).subscribe({
      next: (res) => {
        this.orders.set(res.data);
        this.ordersTotal.set(res.pagination.total);
        this.ordersPages.set(res.pagination.pages);
        this.isLoadingOrders.set(false);
        this.ordersLoaded.set(true);
      },
      error: (err) => {
        this.ordersError.set(err?.error?.message || 'No se pudieron cargar las órdenes');
        this.isLoadingOrders.set(false);
        this.ordersLoaded.set(false);
      },
    });
  }

  private loadVehiclesIfNeeded(force = false): void {
    if (!force && this.vehiclesLoaded()) return;
    const u = this.user();
    if (!u) return;
    this.isLoadingVehicles.set(true);
    this.vehiclesError.set(null);
    this.adminUserService.getVehicles(u.id).subscribe({
      next: (res) => {
        this.vehicles.set(res.data);
        this.isLoadingVehicles.set(false);
        this.vehiclesLoaded.set(true);
      },
      error: (err) => {
        this.vehiclesError.set(err?.error?.message || 'No se pudo cargar el garaje');
        this.isLoadingVehicles.set(false);
        this.vehiclesLoaded.set(false);
      },
    });
  }

  private loadStats(): void {
    const u = this.user();
    if (!u) return;
    this.adminUserService.getStats(u.id).subscribe({
      next: (res) => this.stats.set(res.data),
    });
  }

  setTab(tab: TabKey): void {
    this.activeTab.set(tab);
    if (tab === 'orders') this.loadOrdersIfNeeded();
    else if (tab === 'vehicles') this.loadVehiclesIfNeeded();
  }

  setOrdersStatus(value: 'all' | OrderStatus): void {
    this.ordersStatusFilter.set(value);
    this.ordersPage.set(1);
    this.loadOrdersIfNeeded(true);
  }

  goToOrdersPage(page: number): void {
    if (page < 1 || page > this.ordersPages() || page === this.ordersPage()) return;
    this.ordersPage.set(page);
    this.loadOrdersIfNeeded(true);
  }

  viewOrder(order: Order): void {
    if (!order?.id) return;
    this.router.navigate(['/admin/orders', order.id]);
  }

  // Status modal
  openStatusModal(target: UserStatus): void {
    const titleMap: Record<UserStatus, string> = {
      [UserStatus.ACTIVE]: 'Reactivar cuenta',
      [UserStatus.SUSPENDED]: 'Suspender cuenta',
      [UserStatus.BLOCKED]: 'Bloquear cuenta',
      [UserStatus.DELETED]: 'Eliminar cuenta',
    };
    const confirmMap: Record<UserStatus, string> = {
      [UserStatus.ACTIVE]: 'Reactivar',
      [UserStatus.SUSPENDED]: 'Suspender',
      [UserStatus.BLOCKED]: 'Bloquear',
      [UserStatus.DELETED]: 'Eliminar',
    };
    this.modalReason.set('');
    this.modalSuspendedUntil.set('');
    this.modalError.set(null);
    this.modalBusy.set(false);
    this.statusModal.set({
      target,
      title: titleMap[target],
      confirmLabel: confirmMap[target],
      danger: target === UserStatus.BLOCKED || target === UserStatus.DELETED,
      requiresReason: target === UserStatus.SUSPENDED || target === UserStatus.BLOCKED,
      allowsDuration: target === UserStatus.SUSPENDED,
    });
  }

  closeStatusModal(): void {
    if (this.modalBusy()) return;
    this.statusModal.set(null);
  }

  confirmStatusChange(): void {
    const modal = this.statusModal();
    const u = this.user();
    if (!modal || !u) return;

    if (modal.target === UserStatus.DELETED) {
      this.modalBusy.set(true);
      this.adminUserService.delete(u.id).subscribe({
        next: () => {
          this.modalBusy.set(false);
          this.statusModal.set(null);
          this.router.navigate(['/admin/users']);
        },
        error: (err) => {
          this.modalBusy.set(false);
          this.modalError.set(err?.error?.message || 'No se pudo eliminar el usuario');
        },
      });
      return;
    }

    const reason = this.modalReason().trim();
    if (modal.requiresReason && !reason) {
      this.modalError.set('El motivo es obligatorio.');
      return;
    }

    const payload: UpdateUserStatusRequest = {
      status: modal.target,
      ...(reason ? { reason } : {}),
      ...(modal.allowsDuration && this.modalSuspendedUntil()
        ? { suspendedUntil: new Date(this.modalSuspendedUntil()).toISOString() }
        : {}),
    };

    this.modalBusy.set(true);
    this.adminUserService.updateStatus(u.id, payload).subscribe({
      next: (response) => {
        this.user.set(response.data);
        this.modalBusy.set(false);
        this.statusModal.set(null);
      },
      error: (err) => {
        this.modalBusy.set(false);
        this.modalError.set(err?.error?.message || 'No se pudo actualizar el estado');
      },
    });
  }

  // Helpers de presentación
  statusLabel(status: UserStatus): string {
    const map: Record<UserStatus, string> = {
      [UserStatus.ACTIVE]: 'Activo',
      [UserStatus.SUSPENDED]: 'Suspendido',
      [UserStatus.BLOCKED]: 'Bloqueado',
      [UserStatus.DELETED]: 'Eliminado',
    };
    return map[status] || status;
  }

  statusClass(status: UserStatus): string {
    const map: Record<UserStatus, string> = {
      [UserStatus.ACTIVE]: 'badge-green',
      [UserStatus.SUSPENDED]: 'badge-yellow',
      [UserStatus.BLOCKED]: 'badge-red',
      [UserStatus.DELETED]: 'badge-gray',
    };
    return map[status] || 'badge-gray';
  }

  roleLabel(role: UserRole): string {
    const map: Record<UserRole, string> = {
      [UserRole.CUSTOMER]: 'Cliente',
      [UserRole.SELLER]: 'Vendedor',
      [UserRole.ADMIN]: 'Admin',
    };
    return map[role] || role;
  }

  orderStatusLabel(status: OrderStatus): string {
    const map: Record<OrderStatus, string> = {
      [OrderStatus.PENDING]: 'Pendiente',
      [OrderStatus.APPROVED]: 'Aprobada',
      [OrderStatus.COMPLETED]: 'Completada',
      [OrderStatus.CANCELLATION_REQUESTED]: 'Cancelación solicitada',
      [OrderStatus.CANCELLED]: 'Cancelada',
    };
    return map[status] || status;
  }

  orderStatusClass(status: OrderStatus): string {
    const map: Record<OrderStatus, string> = {
      [OrderStatus.PENDING]: 'badge-yellow',
      [OrderStatus.APPROVED]: 'badge-blue',
      [OrderStatus.COMPLETED]: 'badge-green',
      [OrderStatus.CANCELLATION_REQUESTED]: 'badge-amber',
      [OrderStatus.CANCELLED]: 'badge-gray',
    };
    return map[status] || 'badge-gray';
  }

  vehicleLabel(v: Vehicle): string {
    const parts = [v.marca, v.modelo, v.year].filter(Boolean);
    return parts.join(' ');
  }

  get UserStatusEnum(): typeof UserStatus {
    return UserStatus;
  }
}
