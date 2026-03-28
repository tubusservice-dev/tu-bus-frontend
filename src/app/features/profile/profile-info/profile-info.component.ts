import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService, UserService, UploadService, ZoneService } from '../../../core';
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
  private readonly zoneService = inject(ZoneService);
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

  // Zone data for selects (all Venezuela reference data)
  protected readonly allStates = signal<any[]>([]);
  protected readonly availableCities = signal<any[]>([]);
  protected readonly availableMunicipalities = signal<any[]>([]);

  // Computed: is juridical person (J)
  protected readonly isJuridical = computed(() => {
    return this.profileForm?.get('documentType')?.value === 'J';
  });

  protected profileForm!: FormGroup;

  ngOnInit(): void {
    this.initForm();
    this.loadProfile();
    this.loadAllStates();
  }

  private initForm(): void {
    const user = this.user();
    this.profileForm = this.fb.group({
      // Datos personales
      firstName: [user?.firstName || '', [Validators.required, Validators.minLength(2)]],
      lastName: [user?.lastName || '', [Validators.required, Validators.minLength(2)]],
      birthDate: [user?.birthDate ? this.formatDateForInput(user.birthDate) : ''],
      email: [{ value: user?.email || '', disabled: true }],
      // Documento
      documentType: [user?.documentType || ''],
      documentNumber: [user?.documentNumber || ''],
      // Contacto
      phone: [user?.phone || '', [Validators.pattern(/^(0414|0424|0412|0416|0426)\d{7}$/)]],
      alternativePhone: [user?.alternativePhone || ''],
      // Direccion
      stateCode: [user?.stateCode || ''],
      cityCode: [user?.cityCode || ''],
      municipalityCode: [user?.municipalityCode || ''],
      neighborhood: [user?.neighborhood || ''],
      street: [user?.street || ''],
      houseNumber: [user?.houseNumber || ''],
      referencePoint: [user?.referencePoint || ''],
      zipCode: [user?.zipCode || ''],
      address: [user?.address || ''],
      // Datos fiscales (juridico)
      companyName: [user?.companyName || ''],
      companyRif: [user?.companyRif || ''],
    });

    // Load cities/municipalities if user already has data
    if (user?.stateCode) {
      this.loadReferenceCities(user.stateCode, user?.cityCode);
    }
  }

  protected onStateChange(): void {
    const stateCode = this.profileForm.get('stateCode')?.value;
    this.profileForm.get('cityCode')?.setValue('');
    this.profileForm.get('municipalityCode')?.setValue('');
    this.availableCities.set([]);
    this.availableMunicipalities.set([]);
    if (stateCode) {
      this.loadReferenceCities(stateCode);
    }
  }

  protected onCityChange(): void {
    const cityCode = this.profileForm.get('cityCode')?.value;
    this.profileForm.get('municipalityCode')?.setValue('');
    this.availableMunicipalities.set([]);
    if (cityCode) {
      this.loadReferenceMunicipalities(cityCode);
    }
  }

  private loadReferenceCities(stateCode: string, preselectedCityCode?: string): void {
    // TODO: Refactor for new zone architecture — getReferenceCities no longer exists in ZoneService
  }

  private loadReferenceMunicipalities(cityCode: string): void {
    // TODO: Refactor for new zone architecture — getReferenceCityByCode no longer exists in ZoneService
  }

  private loadAllStates(): void {
    // TODO: Refactor for new zone architecture — getAllStates no longer exists in ZoneService
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

      // Get names from codes
      const selectedState = this.allStates().find((s: any) => s.code === this.profileForm.get('stateCode')?.value);
      const selectedCity = this.availableCities().find((c: any) => c.code === this.profileForm.get('cityCode')?.value);
      const selectedMuni = this.availableMunicipalities().find((m: any) => m.code === this.profileForm.get('municipalityCode')?.value);

      const updateData: any = {
        firstName: this.profileForm.get('firstName')?.value,
        lastName: this.profileForm.get('lastName')?.value,
        birthDate: this.profileForm.get('birthDate')?.value || undefined,
        documentType: this.profileForm.get('documentType')?.value || undefined,
        documentNumber: this.profileForm.get('documentNumber')?.value || undefined,
        phone: this.profileForm.get('phone')?.value || undefined,
        alternativePhone: this.profileForm.get('alternativePhone')?.value || undefined,
        // Direccion
        stateCode: this.profileForm.get('stateCode')?.value || undefined,
        stateName: selectedState?.name || undefined,
        cityCode: this.profileForm.get('cityCode')?.value || undefined,
        cityName: selectedCity?.name || undefined,
        municipalityCode: this.profileForm.get('municipalityCode')?.value || undefined,
        municipalityName: selectedMuni?.name || undefined,
        neighborhood: this.profileForm.get('neighborhood')?.value || undefined,
        street: this.profileForm.get('street')?.value || undefined,
        houseNumber: this.profileForm.get('houseNumber')?.value || undefined,
        referencePoint: this.profileForm.get('referencePoint')?.value || undefined,
        zipCode: this.profileForm.get('zipCode')?.value || undefined,
        address: this.profileForm.get('address')?.value || undefined,
        // Datos fiscales
        companyName: this.profileForm.get('companyName')?.value || undefined,
        companyRif: this.profileForm.get('companyRif')?.value || undefined,
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
    if (control.errors['pattern']) {
      if (field === 'phone') return 'Formato: 04XX-XXXXXXX';
      if (field === 'companyRif') return 'Formato: J-12345678-9';
      return 'Formato inválido';
    }
    return 'Campo inválido';
  }

  formatDate(date: Date | string): string {
    if (!date) return 'No especificado';
    return new Date(date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  // Build full address string for display
  protected getFullAddress(): string {
    const u = this.user();
    if (!u) return 'No especificado';

    const parts = [];
    if (u.street) parts.push(u.street);
    if (u.houseNumber) parts.push(u.houseNumber);
    if (u.neighborhood) parts.push(u.neighborhood);
    if (u.municipalityName) parts.push(u.municipalityName);
    if (u.cityName) parts.push(u.cityName);
    if (u.stateName) parts.push(u.stateName);

    if (parts.length > 0) return parts.join(', ');
    return u.address || 'No especificado';
  }
}
