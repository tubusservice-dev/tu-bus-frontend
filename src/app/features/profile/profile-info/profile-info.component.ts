import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService, UserService, UploadService } from '../../../core';
import { ChangePasswordModalComponent } from '../change-password-modal/change-password-modal.component';

@Component({
  selector: 'app-profile-info',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ChangePasswordModalComponent],
  templateUrl: './profile-info.component.html',
  styleUrl: './profile-info.component.scss',
})
export class ProfileInfoComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly uploadService = inject(UploadService);
  private readonly fb = inject(FormBuilder);

  protected readonly user = this.authService.currentUser;
  protected readonly userAvatar = this.authService.userAvatar;
  protected readonly isEditing = signal(false);
  protected readonly isPasswordModalOpen = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly isUploadingAvatar = signal(false);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly avatarPreview = signal<string | null>(null);
  private selectedAvatarFile: File | null = null;

  protected profileForm!: FormGroup;

  ngOnInit(): void {
    this.initForm();
    this.loadProfile();
  }

  private initForm(): void {
    const user = this.user();
    this.profileForm = this.fb.group({
      firstName: [user?.firstName || '', [Validators.required, Validators.minLength(2)]],
      lastName: [user?.lastName || '', [Validators.required, Validators.minLength(2)]],
      birthDate: [user?.birthDate ? this.formatDateForInput(user.birthDate) : ''],
      email: [{ value: user?.email || '', disabled: true }],
      documentType: [user?.documentType || ''],
      documentNumber: [user?.documentNumber || ''],
      phone: [user?.phone || ''],
      address: [user?.address || ''],
    });
  }

  private formatDateForInput(date: string | Date): string {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  private loadProfile(): void {
    this.authService.loadUserProfile().subscribe({
      next: () => this.initForm(),
      error: () => this.errorMessage.set('Error al cargar el perfil'),
    });
  }

  startEditing(): void {
    this.isEditing.set(true);
    this.clearMessages();
  }

  cancelEditing(): void {
    this.isEditing.set(false);
    this.initForm();
    this.avatarPreview.set(null);
    this.selectedAvatarFile = null;
    this.clearMessages();
  }

  openPasswordModal(): void {
    this.isPasswordModalOpen.set(true);
  }

  closePasswordModal(): void {
    this.isPasswordModalOpen.set(false);
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      if (!file.type.startsWith('image/')) {
        this.errorMessage.set('Por favor selecciona una imagen válida');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        this.errorMessage.set('La imagen no debe superar los 5MB');
        return;
      }

      this.selectedAvatarFile = file;

      const reader = new FileReader();
      reader.onload = (e) => this.avatarPreview.set(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  }

  async saveProfile(): Promise<void> {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.clearMessages();

    try {
      let avatarUrl: string | undefined;

      if (this.selectedAvatarFile) {
        this.isUploadingAvatar.set(true);
        const uploadResult = await this.uploadService.uploadAvatar(this.selectedAvatarFile).toPromise();
        avatarUrl = uploadResult?.data.url;
        this.isUploadingAvatar.set(false);
      }

      const updateData = {
        firstName: this.profileForm.get('firstName')?.value,
        lastName: this.profileForm.get('lastName')?.value,
        birthDate: this.profileForm.get('birthDate')?.value || undefined,
        documentType: this.profileForm.get('documentType')?.value || undefined,
        documentNumber: this.profileForm.get('documentNumber')?.value || undefined,
        phone: this.profileForm.get('phone')?.value || undefined,
        address: this.profileForm.get('address')?.value || undefined,
        ...(avatarUrl && { avatar: avatarUrl }),
      };

      this.userService.updateProfile(updateData).subscribe({
        next: () => {
          this.successMessage.set('Perfil actualizado exitosamente');
          this.isEditing.set(false);
          this.avatarPreview.set(null);
          this.selectedAvatarFile = null;
          this.isLoading.set(false);
          this.loadProfile();
        },
        error: (error) => {
          this.errorMessage.set(error.error?.message || 'Error al actualizar el perfil');
          this.isLoading.set(false);
        },
      });
    } catch {
      this.errorMessage.set('Error al subir la imagen');
      this.isLoading.set(false);
      this.isUploadingAvatar.set(false);
    }
  }

  private clearMessages(): void {
    this.successMessage.set(null);
    this.errorMessage.set(null);
  }

  hasError(field: string): boolean {
    const control = this.profileForm.get(field);
    return !!control && control.invalid && control.touched;
  }

  getErrorMessage(field: string): string {
    const control = this.profileForm.get(field);
    if (!control || !control.errors) return '';
    if (control.errors['required']) return 'Este campo es requerido';
    if (control.errors['minlength']) return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`;
    return 'Campo inválido';
  }

  formatDate(date: Date | string): string {
    if (!date) return 'No especificado';
    return new Date(date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  }
}