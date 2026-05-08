import { Component, signal, output, inject, computed, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService, UserService } from '@core/services';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';
import {
  PHONE_VE_PATTERN,
  minAgeValidator,
} from '@shared/validators/form-validators';
import { ToastService } from '@shared/services/toast.service';

const MIN_REGISTRATION_AGE = 18;

interface DocumentTypeOption {
  code: 'V' | 'E' | 'J' | 'P' | 'G';
  label: string;
}

const DOCUMENT_TYPE_OPTIONS: DocumentTypeOption[] = [
  { code: 'V', label: 'V - Venezolano' },
  { code: 'E', label: 'E - Extranjero' },
  { code: 'J', label: 'J - Jurídico' },
  { code: 'P', label: 'P - Pasaporte' },
  { code: 'G', label: 'G - Gubernamental' },
];

/**
 * Caso 1 — Modal "Completa tu perfil" surfaced after a Google sign-in
 * when the user has not yet filled the mandatory personal data
 * (`profileCompleted=false`).
 *
 * Dismissable: ✕ button, click on backdrop, and Escape close the modal
 * without persisting any data. The user can resume browsing and complete
 * the profile later when starting a checkout flow.
 */
@Component({
  selector: 'app-complete-profile-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DateInputComponent],
  templateUrl: './complete-profile-modal.component.html',
  styleUrl: './complete-profile-modal.component.scss',
})
export class CompleteProfileModalComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly toastService = inject(ToastService);

  readonly closeModal = output<void>();
  readonly profileCompleted = output<void>();

  protected readonly maxBirthDateStr = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - MIN_REGISTRATION_AGE);
    return d.toISOString().split('T')[0];
  })();

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isJuridical = computed(() => this.form.get('documentType')?.value === 'J');

  /**
   * Custom dropdown state for the document-type selector. We render our
   * own dropdown (instead of a native `<select>`) so the trigger shows
   * only the document letter while the dropdown still lists the full
   * descriptive labels.
   *
   * `selectedDocumentTypeCode` is a real signal (not `computed` over
   * `form.get(...)?.value`) because Angular signals don't track Reactive
   * Forms changes — we sync it manually in ngOnInit and on selection.
   */
  protected readonly documentTypeOptions = DOCUMENT_TYPE_OPTIONS;
  protected readonly isDocTypeDropdownOpen = signal(false);
  protected readonly selectedDocumentTypeCode = signal<string>('');
  /**
   * Dirección de apertura del dropdown. Se recalcula en cada toggle según
   * el espacio disponible bajo y sobre el trigger — evita que el dropdown
   * se corte por el borde inferior del modal o del viewport en mobile.
   */
  protected readonly docTypeDropdownDirection = signal<'down' | 'up'>('down');

  private docTypeSub: Subscription | null = null;

  protected readonly form: FormGroup = this.fb.group({
    documentType: ['', [Validators.required]],
    documentNumber: ['', [Validators.required]],
    phone: ['', [Validators.required, Validators.pattern(PHONE_VE_PATTERN)]],
    birthDate: [''],
    companyName: [''],
  });

  ngOnInit(): void {
    // Pre-fill from currentUser when those fields are already set
    const user = this.authService.currentUser();
    if (user) {
      this.form.patchValue({
        documentType: user.documentType ?? '',
        documentNumber: user.documentNumber ?? '',
        phone: user.phone ?? '',
        birthDate: user.birthDate ? String(user.birthDate).substring(0, 10) : '',
        companyName: user.companyName ?? '',
      });
      this.selectedDocumentTypeCode.set(user.documentType ?? '');
    }

    this.docTypeSub = this.form.get('documentType')!.valueChanges.subscribe((type) => {
      const docCtrl = this.form.get('documentNumber')!;
      const birthCtrl = this.form.get('birthDate')!;
      const companyCtrl = this.form.get('companyName')!;

      const patterns: Record<string, RegExp> = {
        V: /^\d{6,8}$/,
        E: /^\d{6,8}$/,
        J: /^\d{8,9}$/,
        P: /^[a-zA-Z0-9]{5,15}$/,
        G: /^\d{6,15}$/,
      };
      const pattern = patterns[type];
      docCtrl.setValidators(
        pattern
          ? [Validators.required, Validators.pattern(pattern)]
          : [Validators.required]
      );
      docCtrl.updateValueAndValidity();

      if (type === 'J') {
        birthCtrl.clearValidators();
        birthCtrl.setValue('');
        companyCtrl.setValidators([
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(100),
        ]);
      } else {
        birthCtrl.setValidators([Validators.required, minAgeValidator(MIN_REGISTRATION_AGE)]);
        companyCtrl.clearValidators();
        companyCtrl.setValue('');
      }
      birthCtrl.updateValueAndValidity();
      companyCtrl.updateValueAndValidity();
    });
  }

  ngOnDestroy(): void {
    this.docTypeSub?.unsubscribe();
  }

  // Dismissable: Escape key closes the modal.
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isDocTypeDropdownOpen()) {
      this.isDocTypeDropdownOpen.set(false);
      return;
    }
    this.closeModal.emit();
  }

  // Close the dropdown when the user clicks anywhere else.
  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.isDocTypeDropdownOpen()) {
      this.isDocTypeDropdownOpen.set(false);
    }
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeModal.emit();
    }
  }

  toggleDocTypeDropdown(event: MouseEvent): void {
    event.stopPropagation();
    // Antes de abrir, decidir si el dropdown va hacia arriba o hacia abajo
    // según el espacio disponible respecto al trigger. Sin esto, en mobile
    // o cerca del borde inferior del modal, las últimas opciones quedaban
    // recortadas (ej. "G - Gubernamental" cortado).
    if (!this.isDocTypeDropdownOpen()) {
      const trigger = event.currentTarget as HTMLElement;
      const rect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // Estimación: 5 opciones × ~40px + padding ≈ 240px.
      const DROPDOWN_HEIGHT = 240;
      this.docTypeDropdownDirection.set(
        spaceBelow < DROPDOWN_HEIGHT && spaceAbove > spaceBelow ? 'up' : 'down',
      );
    }
    this.isDocTypeDropdownOpen.update((open) => !open);
  }

  selectDocumentType(code: DocumentTypeOption['code'], event: MouseEvent): void {
    event.stopPropagation();
    this.form.get('documentType')?.setValue(code);
    this.form.get('documentType')?.markAsTouched();
    this.selectedDocumentTypeCode.set(code);
    this.isDocTypeDropdownOpen.set(false);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const value = this.form.value;
    const payload: Record<string, string | undefined> = {
      documentType: value.documentType,
      documentNumber: value.documentNumber,
      phone: value.phone,
    };
    if (value.documentType !== 'J' && value.birthDate) {
      payload['birthDate'] = value.birthDate;
    }
    if (value.documentType === 'J' && value.companyName) {
      payload['companyName'] = value.companyName;
    }

    this.userService.updateProfile(payload).subscribe({
      next: () => {
        this.authService.loadUserProfile().subscribe({
          next: () => {
            this.isLoading.set(false);
            this.toastService.success('Perfil completado exitosamente.');
            this.profileCompleted.emit();
            this.closeModal.emit();
          },
          error: () => {
            this.isLoading.set(false);
            this.toastService.success('Perfil actualizado.');
            this.profileCompleted.emit();
            this.closeModal.emit();
          },
        });
      },
      error: (error) => {
        this.isLoading.set(false);
        const body = error.error;
        if (body?.errors?.length) {
          this.errorMessage.set(
            (body.errors as { message: string }[]).map((e) => e.message).join('. ')
          );
        } else {
          this.errorMessage.set(body?.message || 'Error al guardar. Intenta de nuevo.');
        }
      },
    });
  }

  hasError(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && control.touched;
  }

  getErrorMessage(field: string): string {
    const control = this.form.get(field);
    if (!control || !control.errors) return '';
    if (control.errors['required']) return 'Este campo es requerido';
    if (control.errors['minlength']) {
      return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`;
    }
    if (control.errors['maxlength']) {
      return `Máximo ${control.errors['maxlength'].requiredLength} caracteres`;
    }
    if (control.errors['pattern']) {
      if (field === 'phone') return 'Formato: 04XX seguido de 7 dígitos';
      if (field === 'documentNumber') return 'Formato de documento inválido';
      return 'Formato inválido';
    }
    if (control.errors['minAge']) {
      return `Debes tener al menos ${control.errors['minAge'].requiredAge} años`;
    }
    return 'Campo inválido';
  }

  getDocNumberPlaceholder(): string {
    const type = this.form.get('documentType')?.value;
    switch (type) {
      case 'V': case 'E': return 'Ej: 12345678';
      case 'J': return 'Ej: 123456789';
      case 'P': return 'Ej: AB1234567';
      case 'G': return 'Ej: 123456';
      default: return 'Número de documento';
    }
  }

  /** Máximo de caracteres permitidos por tipo — refleja el upper bound del regex. */
  getDocNumberMaxLength(): number {
    const type = this.form.get('documentType')?.value;
    switch (type) {
      case 'V': case 'E': return 8;
      case 'J': return 9;
      case 'P': return 15;
      case 'G': return 15;
      default: return 20;
    }
  }

  /**
   * `inputmode` del input: numeric para todos excepto Pasaporte (alfanumérico).
   * Esto hace que en mobile aparezca el teclado numérico para V/E/J/G.
   */
  getDocNumberInputMode(): 'numeric' | 'text' {
    return this.form.get('documentType')?.value === 'P' ? 'text' : 'numeric';
  }

  /**
   * Filtro reactivo del input: descarta caracteres inválidos (letras en
   * V/E/J/G; cualquier no-alfanumérico en P) y respeta el `maxLength` del
   * tipo. Evita que el usuario teclee `hhiouhiohihi` cuando seleccionó "E"
   * o que pegue un valor de 30 dígitos que luego sería rechazado.
   */
  onDocumentNumberInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const type = this.form.get('documentType')?.value as string | null;
    const maxLen = this.getDocNumberMaxLength();
    const allowed = type === 'P' ? /[^a-zA-Z0-9]/g : /\D/g;
    const cleaned = input.value.replace(allowed, '').slice(0, maxLen);
    if (cleaned !== input.value) {
      input.value = cleaned;
    }
    this.form.get('documentNumber')?.setValue(cleaned, { emitEvent: false });
  }

  /**
   * Filtro reactivo para teléfono venezolano (04XX-XXXXXXX). Solo dígitos
   * y el guión opcional, máximo 12 caracteres.
   */
  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cleaned = input.value.replace(/[^\d-]/g, '').slice(0, 12);
    if (cleaned !== input.value) {
      input.value = cleaned;
    }
    this.form.get('phone')?.setValue(cleaned, { emitEvent: false });
  }
}
