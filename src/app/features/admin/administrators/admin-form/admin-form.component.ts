import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminService } from '../../../../core/services/admin.service';
import { ToastService } from '../../../../shared/services/toast.service';

@Component({
  selector: 'app-admin-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './admin-form.component.html',
  styleUrl: './admin-form.component.scss',
})
export class AdminFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly adminService = inject(AdminService);
  private readonly toastService = inject(ToastService);

  /** ID del admin (si es edición) */
  protected readonly adminId = signal<string | null>(null);

  /** Modo del formulario */
  protected readonly isEditMode = signal(false);

  /** Estado de carga inicial */
  protected readonly isLoading = signal(false);

  /** Estado de envío */
  protected readonly isSubmitting = signal(false);

  /** Mensaje de error */
  protected readonly errorMessage = signal<string | null>(null);

  /** Mostrar contraseña */
  protected readonly showPassword = signal(false);

  /** Formulario */
  protected readonly form: FormGroup = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    isActive: [true],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.adminId.set(id);
      this.isEditMode.set(true);
      this.loadAdmin(id);
      // En edición, la contraseña es opcional
      this.form.get('password')?.clearValidators();
      this.form.get('password')?.setValidators([Validators.minLength(6)]);
      this.form.get('password')?.updateValueAndValidity();
    }
  }

  /**
   * Cargar datos del admin para edición
   */
  private loadAdmin(id: string): void {
    this.isLoading.set(true);
    this.adminService.getById(id).subscribe({
      next: (response) => {
        const admin = response.data;
        this.form.patchValue({
          username: admin.username,
          isActive: admin.isActive,
        });
        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al cargar administrador');
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Toggle mostrar contraseña
   */
  toggleShowPassword(): void {
    this.showPassword.update((value) => !value);
  }

  /**
   * Enviar formulario
   */
  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const formData = this.form.value;

    // Si es edición y no hay contraseña, no la enviamos
    if (this.isEditMode() && !formData.password) {
      delete formData.password;
    }

    const request$ = this.isEditMode()
      ? this.adminService.update(this.adminId()!, formData)
      : this.adminService.create(formData);

    request$.subscribe({
      next: () => {
        this.toastService.success(
          this.isEditMode()
            ? 'Administrador actualizado exitosamente'
            : 'Administrador creado exitosamente',
        );
        this.router.navigate(['/admin/administrators']);
      },
      error: (error) => {
        const msg = error.error?.message || 'Error al guardar administrador';
        this.errorMessage.set(msg);
        this.toastService.error(msg);
        this.isSubmitting.set(false);
      },
    });
  }

  /**
   * Verificar si un campo tiene error
   */
  hasError(field: string, error: string): boolean {
    const control = this.form.get(field);
    return !!(control?.hasError(error) && control?.touched);
  }
}