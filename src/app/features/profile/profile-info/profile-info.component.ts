import { Component, inject, signal, OnInit, computed, HostListener, viewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService, UserService, UploadService, UpdateProfileRequest, UserNotificationService } from '../../../core';
import { PushPermissionToggleComponent } from '../../../shared/components/push-permission-toggle/push-permission-toggle.component';
import { getStates, getCitiesByState, getMunicipalitiesByState } from '../../../shared/data/venezuela-states';
import {
  NAME_PATTERN, PHONE_VE_PATTERN, DOCUMENT_NUMBER_PATTERN, RIF_PATTERN, ZIPCODE_PATTERN,
  MAX_NAME_LENGTH, MAX_ADDRESS_LENGTH, MAX_REFERENCE_LENGTH, MAX_COMPANY_NAME_LENGTH,
  MAX_STREET_LENGTH, MAX_HOUSE_NUMBER_LENGTH, MAX_ZIPCODE_LENGTH, MAX_DOCUMENT_LENGTH,
  noNumbersValidator,
} from '../../../shared/validators/form-validators';
import { ChangePasswordModalComponent } from '../change-password-modal/change-password-modal.component';
import { CopyableValueComponent } from '../../../shared/components/copyable-value/copyable-value.component';
import { DateInputComponent } from '../../../shared/components/date-input/date-input.component';

@Component({
  selector: 'app-profile-info',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ChangePasswordModalComponent, CopyableValueComponent, DateInputComponent, PushPermissionToggleComponent],
  templateUrl: './profile-info.component.html',
  styleUrl: './profile-info.component.scss',
})
export class ProfileInfoComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly uploadService = inject(UploadService);
  private readonly fb = inject(FormBuilder);
  protected readonly userNotifService = inject(UserNotificationService);

  /**
   * Derives the badge shown next to the "Notificaciones" sidebar title.
   * Mirrors the states the push-permission-toggle renders internally, but
   * we own it here so the badge can sit in the card header instead of
   * crowding the toggle row.
   */
  protected readonly pushStatusBadge = computed(() => {
    const perm = this.userNotifService.permissionState();
    const enabled = this.userNotifService.pushEnabled();
    if (perm === 'granted') {
      return enabled
        ? { variant: 'on', text: 'Permitido' }
        : { variant: 'paused', text: 'Pausado' };
    }
    if (perm === 'default') return { variant: 'pending', text: 'Pendiente' };
    if (perm === 'denied') return { variant: 'blocked', text: 'Bloqueado' };
    return { variant: 'unsupported', text: 'No soportado' };
  });

  /** Controls the expand/collapse of the unblock-instructions panel. */
  protected readonly showPushHelpPanel = signal(false);
  protected togglePushHelpPanel(): void {
    this.showPushHelpPanel.update((v) => !v);
  }

  protected readonly user = this.authService.currentUser;
  protected readonly userAvatar = this.authService.userAvatar;
  protected readonly todayStr = new Date().toISOString().split('T')[0];
  protected readonly isEditing = signal(false);
  protected readonly isPasswordModalOpen = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly isUploadingAvatar = signal(false);
  protected readonly successMessage = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly avatarPreview = signal<string | null>(null);
  private selectedAvatarFile: File | null = null;

  // Document type custom dropdown
  protected readonly showDocDropdown = signal(false);
  protected readonly docTypeOptions = [
    { code: 'V', label: 'Venezolano' },
    { code: 'E', label: 'Extranjero' },
    { code: 'J', label: 'Jurídico' },
    { code: 'P', label: 'Pasaporte' },
    { code: 'G', label: 'Gubernamental' },
  ];

  // Zone data for selects (all Venezuela reference data)
  protected readonly allStates = signal<any[]>([]);
  protected readonly availableCities = signal<any[]>([]);
  protected readonly availableMunicipalities = signal<any[]>([]);

  // Computed: is juridical person (J)
  protected readonly isJuridical = computed(() => {
    return this.profileForm?.get('documentType')?.value === 'J';
  });

  protected profileForm!: FormGroup;

  /** Top of the edit-mode card. Used to scroll the user to the form header
   *  (NOT the page top) when "Editar Perfil" is clicked from the sidebar. */
  private readonly editFormTop = viewChild<ElementRef<HTMLElement>>('editFormTop');

  ngOnInit(): void {
    this.initForm();
    this.loadProfile();
    this.loadAllStates();
  }

  private initForm(): void {
    const user = this.user();
    this.profileForm = this.fb.group({
      // Datos personales
      firstName: [user?.firstName || '', [Validators.required, Validators.minLength(2), Validators.maxLength(MAX_NAME_LENGTH), Validators.pattern(NAME_PATTERN), noNumbersValidator]],
      lastName: [user?.lastName || '', [Validators.required, Validators.minLength(2), Validators.maxLength(MAX_NAME_LENGTH), Validators.pattern(NAME_PATTERN), noNumbersValidator]],
      birthDate: [user?.birthDate ? this.formatDateForInput(user.birthDate) : ''],
      email: [{ value: user?.email || '', disabled: true }],
      // Documento
      documentType: [user?.documentType || ''],
      documentNumber: [user?.documentNumber || '', [Validators.pattern(DOCUMENT_NUMBER_PATTERN)]],
      // Contacto
      phone: [user?.phone || '', [Validators.pattern(PHONE_VE_PATTERN)]],
      alternativePhone: [user?.alternativePhone || '', [Validators.pattern(PHONE_VE_PATTERN)]],
      // Direccion
      stateCode: [user?.stateCode || ''],
      cityCode: [user?.cityCode || ''],
      municipalityCode: [user?.municipalityCode || ''],
      neighborhood: [user?.neighborhood || '', [Validators.maxLength(MAX_STREET_LENGTH)]],
      street: [user?.street || '', [Validators.maxLength(MAX_STREET_LENGTH)]],
      houseNumber: [user?.houseNumber || '', [Validators.maxLength(MAX_HOUSE_NUMBER_LENGTH)]],
      referencePoint: [user?.referencePoint || '', [Validators.maxLength(MAX_REFERENCE_LENGTH)]],
      zipCode: [user?.zipCode || '', [Validators.pattern(ZIPCODE_PATTERN)]],
      address: [user?.address || '', [Validators.maxLength(MAX_ADDRESS_LENGTH)]],
      // Datos fiscales (juridico)
      companyName: [user?.companyName || '', [Validators.maxLength(MAX_COMPANY_NAME_LENGTH)]],
      companyRif: [user?.companyRif || '', [Validators.pattern(RIF_PATTERN)]],
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
      this.availableCities.set(getCitiesByState(stateCode));
      this.availableMunicipalities.set(getMunicipalitiesByState(stateCode));
    }
  }

  protected onCityChange(): void {
    // City and municipality are independent lists — no cascade
  }

  private loadReferenceCities(stateCode: string, preselectedCityCode?: string): void {
    this.availableCities.set(getCitiesByState(stateCode));
    this.availableMunicipalities.set(getMunicipalitiesByState(stateCode));

    if (preselectedCityCode) {
      this.profileForm.get('cityCode')?.setValue(preselectedCityCode);
    }
  }

  private loadAllStates(): void {
    this.allStates.set(getStates());

    // If user already has a state saved, pre-load the cities cascade
    const user = this.user();
    if (user?.stateCode) {
      this.loadReferenceCities(user.stateCode, user.cityCode);
    }
  }


  private formatDateForInput(date: string | Date): string {
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
      return date.substring(0, 10);
    }
    const d = new Date(date);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private loadProfile(): void {
    this.authService.loadUserProfile().subscribe({
      next: () => this.initForm(),
      error: () => this.errorMessage.set('Error al cargar el perfil'),
    });
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.showDocDropdown.set(false);
  }

  toggleDocDropdown(): void {
    this.showDocDropdown.update(v => !v);
  }

  selectDocType(code: string): void {
    this.profileForm.get('documentType')?.setValue(code);
    this.showDocDropdown.set(false);
  }

  /**
   * Máximo de caracteres permitidos en `documentNumber` según tipo:
   * V/E → 8, J → 9, P/G → 15. Reflect el upper bound del regex.
   */
  getDocNumberMaxLength(): number {
    const type = this.profileForm.get('documentType')?.value;
    switch (type) {
      case 'V': case 'E': return 8;
      case 'J': return 9;
      case 'P': return 15;
      case 'G': return 15;
      default: return 20;
    }
  }

  /** `inputmode` numeric salvo Pasaporte (alfanumérico). */
  getDocNumberInputMode(): 'numeric' | 'text' {
    return this.profileForm.get('documentType')?.value === 'P' ? 'text' : 'numeric';
  }

  /**
   * Filtro reactivo: descarta caracteres no permitidos al teclear o pegar.
   * Mantiene sincronizado el input del DOM con el FormControl.
   */
  onDocumentNumberInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const type = this.profileForm.get('documentType')?.value as string | null;
    const maxLen = this.getDocNumberMaxLength();
    const allowed = type === 'P' ? /[^a-zA-Z0-9]/g : /\D/g;
    const cleaned = input.value.replace(allowed, '').slice(0, maxLen);
    if (cleaned !== input.value) {
      input.value = cleaned;
    }
    this.profileForm.get('documentNumber')?.setValue(cleaned, { emitEvent: false });
  }

  /**
   * Filtro reactivo para teléfonos venezolanos (04XX-XXXXXXX o 04XXXXXXXXXX).
   * Solo dígitos y guión opcional, máximo 12 caracteres.
   */
  onPhoneInput(event: Event, controlName: 'phone' | 'alternativePhone' = 'phone'): void {
    const input = event.target as HTMLInputElement;
    const cleaned = input.value.replace(/[^\d-]/g, '').slice(0, 12);
    if (cleaned !== input.value) {
      input.value = cleaned;
    }
    this.profileForm.get(controlName)?.setValue(cleaned, { emitEvent: false });
  }

  startEditing(): void {
    this.isEditing.set(true);
    this.clearMessages();
    // Defer to next frame so the form is rendered before scrolling. Targets
    // the form card (NOT the page top) so the sidebar's "Acciones"/"Cuenta"
    // sections aren't left awkwardly above the edit area on mobile.
    requestAnimationFrame(() => {
      this.editFormTop()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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

      const rawData: Record<string, unknown> = {
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

      // Drop undefined entries — JSON.stringify omits them, but the backend
      // service uses Object.assign on the loaded user document, where an
      // explicit undefined would mark the field as modified and overwrite it.
      const updateData = Object.fromEntries(
        Object.entries(rawData).filter(([, v]) => v !== undefined)
      ) as UpdateProfileRequest;

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
    if (control.errors['maxlength']) return `Máximo ${control.errors['maxlength'].requiredLength} caracteres`;
    if (control.errors['noNumbers']) return 'No se permiten números';
    if (control.errors['pattern']) {
      if (field === 'phone' || field === 'alternativePhone') return 'Formato: 04XX-XXXXXXX (ej: 04141234567)';
      if (field === 'companyRif') return 'Formato: J-12345678-9';
      if (field === 'documentNumber') return 'Solo números, entre 6 y 10 dígitos';
      if (field === 'zipCode') return 'Código postal: 4-5 dígitos';
      if (field === 'firstName' || field === 'lastName') return 'Solo letras, sin números';
      return 'Formato inválido';
    }
    return 'Campo inválido';
  }

  formatDate(date: Date | string): string {
    if (!date) return 'No especificado';
    // Use UTC to avoid timezone offset shifting the day
    const d = new Date(date);
    return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  }

  /**
   * Toggle ON path: prompts the browser permission if needed, registers
   * the FCM token and persists `pushEnabled: true` on the backend. Must
   * run inside the user click so the browser treats it as a user gesture.
   */
  async enablePushNotifications(): Promise<void> {
    await this.userNotifService.requestNotificationPermission();
  }

  /** Toggle OFF path: persists `pushEnabled: false`. Keeps the FCM token. */
  async disablePushNotifications(): Promise<void> {
    await this.userNotifService.disablePushPreference();
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
