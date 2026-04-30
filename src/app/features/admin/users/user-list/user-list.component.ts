import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  AdminUserService,
  AdminUserFilters,
  UpdateUserStatusRequest,
} from '../../../../core/services/admin-user.service';
import { SettingsService } from '../../../../core/services/settings.service';
import { AdminUser, UserStatus } from '../../../../models';
import { PAGINATION_OPTIONS } from '../../../../models/settings.model';
import { SearchInputComponent } from '../../../../shared/components/search-input/search-input.component';
import {
  KebabMenuComponent,
  KebabMenuAction,
} from '../../../../shared/components/kebab-menu/kebab-menu.component';
import { UserAvatarComponent } from '../../../../shared/components/user-avatar/user-avatar.component';

type StatusFilter = 'all' | UserStatus;

interface StatusModal {
  user: AdminUser;
  target: UserStatus;
  title: string;
  confirmLabel: string;
  danger: boolean;
  requiresReason: boolean;
  allowsDuration: boolean;
}

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SearchInputComponent,
    KebabMenuComponent,
    UserAvatarComponent,
  ],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.scss',
})
export class UserListComponent implements OnInit {
  private readonly adminUserService = inject(AdminUserService);
  private readonly settingsService = inject(SettingsService);
  private readonly router = inject(Router);

  protected readonly users = signal<AdminUser[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly searchTerm = signal('');
  protected readonly statusFilter = signal<StatusFilter>('all');

  protected readonly page = signal(1);
  protected readonly limit = signal(
    this.settingsService.paginationConfig().adminLimit || 20
  );
  protected readonly total = signal(0);
  protected readonly pages = signal(1);

  protected readonly paginationConfig = this.settingsService.paginationConfig;
  protected readonly paginationOptions = PAGINATION_OPTIONS;

  protected readonly processingId = signal<string | null>(null);
  protected readonly statusModal = signal<StatusModal | null>(null);
  protected readonly userToDelete = signal<AdminUser | null>(null);
  protected readonly modalReason = signal('');
  protected readonly modalSuspendedUntil = signal('');
  protected readonly modalError = signal<string | null>(null);
  protected readonly modalBusy = signal(false);

  protected readonly statusChips: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: UserStatus.ACTIVE, label: 'Activos' },
    { key: UserStatus.SUSPENDED, label: 'Suspendidos' },
    { key: UserStatus.BLOCKED, label: 'Bloqueados' },
    { key: UserStatus.DELETED, label: 'Eliminados' },
  ];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const filters: AdminUserFilters = {
      page: this.page(),
      limit: this.limit(),
      search: this.searchTerm() || undefined,
      status: this.statusFilter() === 'all' ? undefined : (this.statusFilter() as UserStatus),
    };

    this.adminUserService.getAll(filters).subscribe({
      next: (response) => {
        this.users.set(response.data);
        this.total.set(response.pagination.total);
        this.pages.set(response.pagination.pages);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Error al cargar usuarios');
        this.isLoading.set(false);
      },
    });
  }

  onSearchChanged(value: string): void {
    this.searchTerm.set(value);
    this.page.set(1);
    this.load();
  }

  setStatus(status: StatusFilter): void {
    this.statusFilter.set(status);
    this.page.set(1);
    this.load();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.pages() || page === this.page()) return;
    this.page.set(page);
    this.load();
  }

  onLimitChange(newLimit: number): void {
    this.limit.set(Number(newLimit));
    this.page.set(1);
    this.load();
  }

  /** Visible page numbers with ellipsis: matches catalog UX. */
  getVisiblePages(): (number | '...')[] {
    const total = this.pages();
    const current = this.page();
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const out: (number | '...')[] = [1];
    if (current > 3) out.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) out.push(i);
    if (current < total - 2) out.push('...');
    out.push(total);
    return out;
  }

  navigateToDetail(user: AdminUser): void {
    this.router.navigate(['/admin/users', user.id]);
  }

  fullName(user: AdminUser): string {
    const full = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    return full || user.email || user.username || 'Sin nombre';
  }

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

  actionsFor(user: AdminUser): KebabMenuAction[] {
    const status = user.status;
    const notDeleted = status !== UserStatus.DELETED;
    return [
      { key: 'view', label: 'Ver detalle' },
      { key: 'edit', label: 'Editar', hidden: !notDeleted },
      { key: 'divider-1', label: '', divider: true, hidden: !notDeleted },
      {
        key: 'reactivate',
        label: 'Reactivar',
        hidden: status === UserStatus.ACTIVE || status === UserStatus.DELETED,
      },
      {
        key: 'suspend',
        label: 'Suspender',
        hidden: status !== UserStatus.ACTIVE,
      },
      {
        key: 'block',
        label: 'Bloquear',
        danger: true,
        hidden: status === UserStatus.BLOCKED || status === UserStatus.DELETED,
      },
      { key: 'divider-2', label: '', divider: true, hidden: !notDeleted },
      {
        key: 'delete',
        label: 'Eliminar',
        danger: true,
        hidden: status === UserStatus.DELETED,
      },
    ];
  }

  onAction(user: AdminUser, key: string): void {
    switch (key) {
      case 'view':
        this.navigateToDetail(user);
        break;
      case 'edit':
        this.router.navigate(['/admin/users', user.id], { queryParams: { edit: 1 } });
        break;
      case 'reactivate':
        this.openStatusModal(user, UserStatus.ACTIVE);
        break;
      case 'suspend':
        this.openStatusModal(user, UserStatus.SUSPENDED);
        break;
      case 'block':
        this.openStatusModal(user, UserStatus.BLOCKED);
        break;
      case 'delete':
        this.userToDelete.set(user);
        break;
    }
  }

  openStatusModal(user: AdminUser, target: UserStatus): void {
    const requiresReason = target === UserStatus.SUSPENDED || target === UserStatus.BLOCKED;
    const allowsDuration = target === UserStatus.SUSPENDED;
    const titleMap: Record<UserStatus, string> = {
      [UserStatus.ACTIVE]: 'Reactivar usuario',
      [UserStatus.SUSPENDED]: 'Suspender usuario',
      [UserStatus.BLOCKED]: 'Bloquear usuario',
      [UserStatus.DELETED]: 'Eliminar usuario',
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
      user,
      target,
      title: titleMap[target],
      confirmLabel: confirmMap[target],
      danger: target === UserStatus.BLOCKED,
      requiresReason,
      allowsDuration,
    });
  }

  closeStatusModal(): void {
    if (this.modalBusy()) return;
    this.statusModal.set(null);
  }

  confirmStatusChange(): void {
    const modal = this.statusModal();
    if (!modal) return;

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
    this.processingId.set(modal.user.id);

    this.adminUserService.updateStatus(modal.user.id, payload).subscribe({
      next: (response) => {
        this.users.update((list) =>
          list.map((u) => (u.id === modal.user.id ? response.data : u))
        );
        this.modalBusy.set(false);
        this.processingId.set(null);
        this.statusModal.set(null);
      },
      error: (err) => {
        this.modalBusy.set(false);
        this.processingId.set(null);
        this.modalError.set(err?.error?.message || 'No se pudo actualizar el estado');
      },
    });
  }

  closeDeleteModal(): void {
    if (this.modalBusy()) return;
    this.userToDelete.set(null);
  }

  confirmDelete(): void {
    const user = this.userToDelete();
    if (!user) return;

    this.modalBusy.set(true);
    this.processingId.set(user.id);

    this.adminUserService.delete(user.id).subscribe({
      next: () => {
        this.load();
        this.modalBusy.set(false);
        this.processingId.set(null);
        this.userToDelete.set(null);
      },
      error: (err) => {
        this.modalBusy.set(false);
        this.processingId.set(null);
        this.modalError.set(err?.error?.message || 'No se pudo eliminar el usuario');
      },
    });
  }
}
