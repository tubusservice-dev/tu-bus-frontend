import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../../../core/services/admin.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Admin } from '../../../../models/admin.model';

/** Predefined deterministic gradients (HSL pairs) for avatar backgrounds. */
const AVATAR_GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ['#3b82f6', '#1d4ed8'], // blue
  ['#10b981', '#047857'], // emerald
  ['#f59e0b', '#b45309'], // amber
  ['#ec4899', '#9d174d'], // pink
  ['#8b5cf6', '#6d28d9'], // violet
  ['#06b6d4', '#0e7490'], // cyan
  ['#ef4444', '#b91c1c'], // red
  ['#84cc16', '#4d7c0f'], // lime
];

@Component({
  selector: 'app-admin-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-list.component.html',
  styleUrl: './admin-list.component.scss',
})
export class AdminListComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly authService = inject(AuthService);

  /** Lista de administradores */
  protected readonly administrators = signal<Admin[]>([]);

  /** Estado de carga */
  protected readonly isLoading = signal(true);

  /** Mensaje de error */
  protected readonly errorMessage = signal<string | null>(null);

  /** Admin seleccionado para eliminar */
  protected readonly adminToDelete = signal<Admin | null>(null);

  /** Estado de eliminación */
  protected readonly isDeleting = signal(false);

  /** Texto de búsqueda en vivo (filtra por username). */
  protected readonly searchTerm = signal('');

  /** ID del admin que está autenticado en esta sesión (para flag "Tú"). */
  protected readonly currentUserId = computed(() => this.authService.currentUser()?.id ?? null);

  /** Lista filtrada por `searchTerm`. */
  protected readonly filteredAdministrators = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    const list = this.administrators();
    if (!q) return list;
    return list.filter((a) => a.username.toLowerCase().includes(q));
  });

  /** Métricas para el resumen superior. */
  protected readonly totalCount = computed(() => this.administrators().length);
  protected readonly activeCount = computed(() => this.administrators().filter((a) => a.isActive).length);
  protected readonly inactiveCount = computed(() => this.totalCount() - this.activeCount());

  ngOnInit(): void {
    this.loadAdministrators();
  }

  loadAdministrators(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.adminService.getAll().subscribe({
      next: (response) => {
        this.administrators.set(response.data);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al cargar administradores');
        this.isLoading.set(false);
      },
    });
  }

  confirmDelete(admin: Admin): void {
    this.adminToDelete.set(admin);
  }

  cancelDelete(): void {
    this.adminToDelete.set(null);
  }

  deleteAdmin(): void {
    const admin = this.adminToDelete();
    if (!admin) return;

    this.isDeleting.set(true);

    this.adminService.delete(admin.id).subscribe({
      next: () => {
        this.administrators.update((list) => list.filter((a) => a.id !== admin.id));
        this.adminToDelete.set(null);
        this.isDeleting.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al eliminar administrador');
        this.isDeleting.set(false);
      },
    });
  }

  toggleStatus(admin: Admin): void {
    // Optimistic-friendly: only mutate after server confirms.
    this.adminService.toggleStatus(admin.id, !admin.isActive).subscribe({
      next: () => {
        this.administrators.update((list) =>
          list.map((a) => (a.id === admin.id ? { ...a, isActive: !a.isActive } : a))
        );
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al cambiar estado');
      },
    });
  }

  /** Returns true if `admin` is the currently authenticated session. */
  protected isCurrentUser(admin: Admin): boolean {
    const me = this.currentUserId();
    return !!me && me === admin.id;
  }

  /** Deterministic gradient picker so the same username always gets the same colors. */
  protected getAvatarGradient(username: string): string {
    if (!username) return `linear-gradient(135deg, ${AVATAR_GRADIENTS[0][0]}, ${AVATAR_GRADIENTS[0][1]})`;
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = (hash * 31 + username.charCodeAt(i)) | 0;
    }
    const idx = Math.abs(hash) % AVATAR_GRADIENTS.length;
    const [from, to] = AVATAR_GRADIENTS[idx];
    return `linear-gradient(135deg, ${from}, ${to})`;
  }

  /** Human-friendly relative date used in the cards. */
  protected getRelativeDate(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return '—';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays < 0) return date.toLocaleDateString('es-VE');
    if (diffDays === 0) return 'Hoy';
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      return weeks === 1 ? 'Hace 1 semana' : `Hace ${weeks} semanas`;
    }
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return months === 1 ? 'Hace 1 mes' : `Hace ${months} meses`;
    }
    const years = Math.floor(diffDays / 365);
    return years === 1 ? 'Hace 1 año' : `Hace ${years} años`;
  }
}
