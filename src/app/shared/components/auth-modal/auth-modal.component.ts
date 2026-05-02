import { Component, signal, output, input, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services';
import { RegisterRequest } from '../../../models/auth.model';
import { DateInputComponent } from '../date-input/date-input.component';
import { minAgeValidator } from '../../validators/form-validators';
import { emailUniqueValidator } from '../../validators/email-unique.validator';
import { ToastService } from '../../services/toast.service';

/** Minimum age (years) required to create an account. */
const MIN_REGISTRATION_AGE = 18;

type AuthMode = 'login' | 'register';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DateInputComponent],
  templateUrl: './auth-modal.component.html',
  styleUrl: './auth-modal.component.scss',
})
export class AuthModalComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private docTypeSub: Subscription | null = null;

  /** Optional: parent can request the modal to open in register mode with prefilled email. */
  readonly initialMode = input<AuthMode>('login');
  readonly prefillEmail = input<string>('');

  readonly closeModal = output<void>();
  /** Emitted after a successful registration that requires verification. */
  readonly verificationPending = output<{ email: string; firstName: string }>();
  /** Emitted when the user clicks "¿Olvidaste tu contraseña?" — parent opens forgot modal. */
  readonly forgotPasswordRequested = output<void>();

  /**
   * Latest ISO `YYYY-MM-DD` a user may pick as birth date.
   * Equals today minus `MIN_REGISTRATION_AGE` years — enforces the age gate at
   * the calendar level so underage dates are visually unreachable.
   */
  protected readonly maxBirthDateStr = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - MIN_REGISTRATION_AGE);
    return d.toISOString().split('T')[0];
  })();

  protected readonly mode = signal<AuthMode>('login');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly sessionExpired = this.authService.sessionExpired;

  // Stepper — always 2 steps
  protected readonly currentStep = signal(1);
  protected readonly isJuridical = signal(false);

  // Registration success state — shown after POST /register returns OK.
  // Keeps the modal open on a confirmation screen until the user presses Continuar.
  protected readonly registrationSuccess = signal(false);
  protected readonly registeredFirstName = signal('');

  // Password visibility
  protected readonly showLoginPassword = signal(false);
  protected readonly showRegPassword = signal(false);
  protected readonly showRegConfirm = signal(false);
  protected readonly passwordsMismatch = signal(false);

  // Login form
  protected readonly loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  // Step 1: Credentials
  protected readonly step1Form: FormGroup = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    email: [
      '',
      {
        validators: [Validators.required, Validators.email],
        asyncValidators: [emailUniqueValidator(this.authService)],
        updateOn: 'blur',
      },
    ],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]],
  });

  // Step 2: Identity & Contact (+ companyName conditional)
  protected readonly step2Form: FormGroup = this.fb.group({
    documentType: ['', [Validators.required]],
    documentNumber: ['', [Validators.required]],
    birthDate: [''],
    phone: ['', [Validators.required, Validators.pattern(/^(0414|0424|0412|0416|0426)-?\d{7}$/)]],
    companyName: [''],
  });

  ngOnInit(): void {
    // Apply initial mode + prefill if the parent requested register-with-email
    if (this.initialMode() === 'register') {
      this.mode.set('register');
    }
    const prefill = this.prefillEmail();
    if (prefill) {
      this.step1Form.patchValue({ email: prefill });
      this.loginForm.patchValue({ email: prefill });
    }

    if (this.sessionExpired()) {
      setTimeout(() => this.authService.clearSessionExpired(), 5000);
    }

    this.docTypeSub = this.step2Form.get('documentType')!.valueChanges.subscribe((type) => {
      this.isJuridical.set(type === 'J');

      const docCtrl = this.step2Form.get('documentNumber')!;
      const birthCtrl = this.step2Form.get('birthDate')!;
      const companyCtrl = this.step2Form.get('companyName')!;

      const patterns: Record<string, RegExp> = {
        V: /^\d{6,8}$/,
        E: /^\d{6,8}$/,
        J: /^\d{8,9}$/,
        P: /^[a-zA-Z0-9]{5,15}$/,
        G: /^\d{6,15}$/,
      };

      const pattern = patterns[type];
      if (pattern) {
        docCtrl.setValidators([Validators.required, Validators.pattern(pattern)]);
      } else {
        docCtrl.setValidators([Validators.required]);
      }
      docCtrl.updateValueAndValidity();

      if (type === 'J') {
        birthCtrl.clearValidators();
        birthCtrl.setValue('');
        companyCtrl.setValidators([Validators.required, Validators.minLength(3), Validators.maxLength(100)]);
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

  switchMode(newMode: AuthMode): void {
    this.mode.set(newMode);
    this.errorMessage.set(null);
    this.currentStep.set(1);
    this.isJuridical.set(false);
    this.registrationSuccess.set(false);
    this.registeredFirstName.set('');
    this.loginForm.reset();
    this.step1Form.reset();
    this.step2Form.reset();
  }

  // ========== Navigation ==========

  onRegPasswordInput(): void {
    this.errorMessage.set(null);
    const pw = this.step1Form.get('password')?.value || '';
    const confirm = this.step1Form.get('confirmPassword')?.value || '';
    this.passwordsMismatch.set(pw.length > 0 && confirm.length > 0 && pw !== confirm);
  }

  nextStep(): void {
    if (this.step1Form.invalid) {
      this.step1Form.markAllAsTouched();
      return;
    }

    const s1 = this.step1Form.value;
    if (s1.password !== s1.confirmPassword) {
      this.errorMessage.set('Las contraseñas no coinciden');
      return;
    }

    this.errorMessage.set(null);
    this.currentStep.set(2);
  }

  prevStep(): void {
    this.errorMessage.set(null);
    this.currentStep.set(1);
  }

  // ========== Submit ==========

  // Tracks the unverified email so the user can resend the verification mail
  protected readonly unverifiedEmail = signal<string | null>(null);
  protected readonly resendingVerification = signal(false);
  protected readonly resendFeedback = signal<string | null>(null);

  onLogin(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.unverifiedEmail.set(null);
    this.resendFeedback.set(null);

    this.authService.login(this.loginForm.value).subscribe({
      next: () => {
        this.isLoading.set(false);
        const firstName = this.authService.currentUser()?.firstName;
        const message = firstName
          ? `¡Bienvenido de vuelta, ${firstName}!`
          : '¡Inicio de sesión exitoso!';
        this.toastService.success(message);
        this.closeModal.emit();
      },
      error: (error) => {
        this.isLoading.set(false);

        // EMAIL_NOT_VERIFIED → render inline message + "Reenviar correo" CTA
        if (error.error?.code === 'EMAIL_NOT_VERIFIED') {
          const email = error.error?.details?.email || this.loginForm.value.email;
          this.unverifiedEmail.set(email);
          this.errorMessage.set(
            'Debes verificar tu correo electrónico antes de iniciar sesión.'
          );
          return;
        }

        // When the account is blocked/suspended/deleted, raise the global
        // modal and close this form — the inline error is insufficient.
        if (this.authService.triggerAccountBlocked(error)) {
          this.closeModal.emit();
          return;
        }
        this.errorMessage.set(error.error?.message || 'Error al iniciar sesión. Intenta de nuevo.');
      },
    });
  }

  /** Re-sends the verification email when login was blocked by EMAIL_NOT_VERIFIED. */
  onResendVerificationFromLogin(): void {
    const email = this.unverifiedEmail();
    if (!email) return;

    this.resendingVerification.set(true);
    this.resendFeedback.set(null);

    this.authService.resendVerification(email).subscribe({
      next: () => {
        this.resendingVerification.set(false);
        this.resendFeedback.set('Correo reenviado. Revisa tu bandeja de entrada.');
      },
      error: (err) => {
        this.resendingVerification.set(false);
        this.resendFeedback.set(
          err.error?.message || 'No pudimos reenviar el correo. Intenta más tarde.'
        );
      },
    });
  }

  /** Triggered by the "¿Olvidaste tu contraseña?" link in login mode. */
  onForgotPasswordClick(): void {
    this.forgotPasswordRequested.emit();
  }

  onRegister(): void {
    if (this.step2Form.invalid) {
      this.step2Form.markAllAsTouched();
      return;
    }

    const { confirmPassword, ...s1 } = this.step1Form.value;
    const s2 = this.step2Form.value;

    const payload: RegisterRequest = {
      ...s1,
      documentType: s2.documentType,
      documentNumber: s2.documentNumber,
      phone: s2.phone,
    };

    if (s2.documentType !== 'J' && s2.birthDate) {
      payload.birthDate = s2.birthDate;
    }

    if (s2.documentType === 'J' && s2.companyName) {
      payload.companyName = s2.companyName;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.register(payload).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        const firstName = response?.data?.user?.firstName || '';
        const email = response?.data?.user?.email || payload.email;

        // Verification-pending path: backend did NOT return a token,
        // user is NOT authenticated. Delegate to parent to show the
        // verify-email-pending modal.
        if (response?.data?.requiresVerification) {
          this.verificationPending.emit({ email, firstName });
          return;
        }

        // Legacy path (auto-login already happened in the service): show
        // the in-modal success screen.
        this.registeredFirstName.set(firstName);
        this.registrationSuccess.set(true);
      },
      error: (error) => {
        this.isLoading.set(false);
        const body = error.error;
        if (body?.errors?.length) {
          const details = body.errors.map((e: { message: string }) => e.message).join('. ');
          this.errorMessage.set(details);
        } else if (body?.code === 'EMAIL_ALREADY_REGISTERED') {
          this.errorMessage.set('Este correo ya está registrado. Intenta iniciar sesión.');
        } else {
          this.errorMessage.set(body?.message || 'Error al registrarse. Intenta de nuevo.');
        }
      },
    });
  }

  continueAfterRegistration(): void {
    this.registrationSuccess.set(false);
    this.closeModal.emit();
  }

  // ========== OAuth ==========

  protected readonly isOAuthLoading = signal(false);

  loginWithGoogle(): void {
    this.isOAuthLoading.set(true);
    this.authService.loginWithOAuth('google');
  }

  loginWithFacebook(): void {
    this.authService.loginWithOAuth('facebook');
  }

  // ========== Helpers ==========

  hasError(form: FormGroup, field: string): boolean {
    const control = form.get(field);
    return !!control && control.invalid && control.touched;
  }

  getErrorMessage(form: FormGroup, field: string): string {
    const control = form.get(field);
    if (!control || !control.errors) return '';

    if (control.errors['required']) return 'Este campo es requerido';
    if (control.errors['email']) return 'Ingresa un email válido';
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
      return `Debes tener al menos ${control.errors['minAge'].requiredAge} años para registrarte`;
    }
    if (control.errors['emailTaken']) {
      return 'Este correo ya está registrado';
    }

    return 'Campo inválido';
  }

  getDocNumberPlaceholder(): string {
    const type = this.step2Form.get('documentType')?.value;
    switch (type) {
      case 'V': case 'E': return 'Ej: 12345678';
      case 'J': return 'Ej: 123456789';
      case 'P': return 'Ej: AB1234567';
      case 'G': return 'Ej: 123456';
      default: return 'Número de documento';
    }
  }
}
