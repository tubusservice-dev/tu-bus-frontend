import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminService } from '../../../../core/services/admin.service';
import { Admin } from '../../../../models/admin.model';

@Component({
  selector: 'app-admin-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-list.component.html',
  styleUrl: './admin-list.component.scss',
})
export class AdminListComponent implements OnInit {
  private readonly adminService = inject(AdminService);

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

  ngOnInit(): void {
    this.loadAdministrators();
  }

  /**
   * Cargar lista de administradores
   */
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

  /**
   * Abrir modal de confirmación de eliminación
   */
  confirmDelete(admin: Admin): void {
    this.adminToDelete.set(admin);
  }

  /**
   * Cancelar eliminación
   */
  cancelDelete(): void {
    this.adminToDelete.set(null);
  }

  /**
   * Eliminar administrador
   */
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

  /**
   * Cambiar estado activo/inactivo
   */
  toggleStatus(admin: Admin): void {
    this.adminService.toggleStatus(admin.id, !admin.isActive).subscribe({
      next: (response) => {
        this.administrators.update((list) =>
          list.map((a) => (a.id === admin.id ? { ...a, isActive: !a.isActive } : a))
        );
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al cambiar estado');
      },
    });
  }
}