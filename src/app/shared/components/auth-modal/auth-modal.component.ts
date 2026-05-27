import { Component, signal, output, input, inject, OnInit, OnDestroy, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subscription, firstValueFrom, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { AuthService, AuthModalMode } from '@core/services';
import { CheckEmailResponse, RegisterRequest } from '@models';
import { ToastService } from '@shared/services/toast.service';
import { PlatformService } from '@platform';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './auth-modal.component.html',
  styleUrl: './auth-modal.component.scss',
})
export class AuthModalComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  /**
   * Exposed as `protected` so the template can gate the "Continue with
   * Apple" button on iOS only (App Store Guideline 4.8 requires it on
   * iOS but Apple Sign-In has no Android/web flow in v1).
   */
  protected readonly platform = inject(PlatformService);
  private emailCheckSub: Subscription | null = null;

  constructor() {
    // Sync the local OAuth spinner with the AuthService's native flow
    // signal. Without this the spinner would stay on forever after the
    // native flow completes (the WebView never reloads on native, so the
    // bfcache failsafe used for web does not fire).
    effect(() => {
      if (!this.authService.nativeOAuthLoading()) {
        this.isOAuthLoading.set(false);
      }
    });
  }

  /**
   * Tracks whether the email currently typed in the register form belongs
   * to a Google-only account. Drives the submit branching: register vs
   * link-account. The user is NOT informed visually — the flow looks the
   * same from their side, just routes to a different endpoint.
   */
  protected readonly emailIsOAuthOnly = signal(false);

  readonly initialMode = input<AuthModalMode>('login');
  readonly prefillEmail = input<string>('');

  readonly closeModal = output<void>();
  /** Emitted after a successful registration that requires verification. */
  readonly verificationPending = output<{ email: string; firstName: string }>();
  /** Emitted after a successful link-account that requires verification. */
  readonly accountLinkPending = output<{ email: string; firstName: string }>();
  /** Emitted when the user clicks "¿Olvidaste tu contraseña?". */
  readonly forgotPasswordRequested = output<void>();

  protected readonly mode = signal<AuthModalMode>('login');
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly sessionExpired = this.authService.sessionExpired;

  protected readonly showLoginPassword = signal(false);
  protected readonly showRegPassword = signal(false);
  protected readonly showRegConfirm = signal(false);
  protected readonly passwordsMismatch = signal(false);

  /** True when the modal renders the register/link-account UI. */
  protected readonly effectiveRegisterMode = computed(() => this.mode() !== 'login');

  protected readonly loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  /**
   * Single-step register form. Personal data (document, phone, etc.) is
   * collected in the "complete profile" modal that opens on /perfil after
   * verification — so OAuth and email sign-ups converge on the same UX.
   */
  protected readonly registerForm: FormGroup = this.fb.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]],
  });

  ngOnInit(): void {
    const initialMode = this.initialMode();
    if (initialMode === 'register' || initialMode === 'linkAccount') {
      this.mode.set(initialMode);
    }
    const prefill = this.prefillEmail();
    if (prefill) {
      this.registerForm.patchValue({ email: prefill });
      this.loginForm.patchValue({ email: prefill });
    }

    if (initialMode === 'linkAccount') {
      this.registerForm.get('email')?.disable();
    }

    if (this.sessionExpired()) {
      setTimeout(() => this.authService.clearSessionExpired(), 5000);
    }

    // Detect Google-only emails silently so submit can route to
    // /auth/link-account without changing anything in the UI.
    const emailCtrl = this.registerForm.get('email');
    if (emailCtrl) {
      const emptyResponse: CheckEmailResponse = {
        success: true,
        data: { exists: false },
      };
      this.emailCheckSub = emailCtrl.valueChanges
        .pipe(
          debounceTime(500),
          distinctUntilChanged(),
          switchMap((value: unknown) => {
            const email = typeof value === 'string' ? value.trim() : '';
            if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
              return of(emptyResponse);
            }
            return this.authService.checkEmail(email).pipe(
              catchError(() => of(emptyResponse))
            );
          })
        )
        .subscribe((res) => {
          const data = res?.data;
          this.emailIsOAuthOnly.set(!!(data?.exists && data.isOAuthOnly));
        });
    }
  }

  ngOnDestroy(): void {
    this.emailCheckSub?.unsubscribe();
    this.oauthFailsafeCleanup?.();
  }

  switchMode(newMode: AuthModalMode): void {
    this.mode.set(newMode);
    this.errorMessage.set(null);
    this.loginForm.reset();
    this.registerForm.reset();
    this.emailIsOAuthOnly.set(false);
  }

  onRegPasswordInput(): void {
    this.errorMessage.set(null);
    const pw = this.registerForm.get('password')?.value || '';
    const confirm = this.registerForm.get('confirmPassword')?.value || '';
    this.passwordsMismatch.set(pw.length > 0 && confirm.length > 0 && pw !== confirm);
  }

  // ========== Submit ==========

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

        if (error.error?.code === 'EMAIL_NOT_VERIFIED') {
          const email = error.error?.details?.email || this.loginForm.value.email;
          this.unverifiedEmail.set(email);
          this.errorMessage.set(
            'Debes verificar tu correo electrónico antes de iniciar sesión.'
          );
          return;
        }

        if (this.authService.triggerAccountBlocked(error)) {
          this.closeModal.emit();
          return;
        }
        this.errorMessage.set(error.error?.message || 'Error al iniciar sesión. Intenta de nuevo.');
      },
    });
  }

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

  onForgotPasswordClick(): void {
    this.forgotPasswordRequested.emit();
  }

  async onRegister(): Promise<void> {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const value = this.registerForm.getRawValue();
    if (value.password !== value.confirmPassword) {
      this.passwordsMismatch.set(true);
      this.errorMessage.set('Las contraseñas no coinciden');
      return;
    }

    const payload: RegisterRequest = {
      email: value.email,
      password: value.password,
      firstName: value.firstName,
      lastName: value.lastName,
    };

    this.isLoading.set(true);
    this.errorMessage.set(null);

    // Pre-flight check: confirm the email status RIGHT BEFORE submitting.
    // The async validator may be stale (rapid typing + submit) and the
    // backend's 409 only fires AFTER linkAccount has already burned a
    // verification email — and email quotas are scarce.
    let isOAuthOnly = this.emailIsOAuthOnly();
    try {
      const check = await firstValueFrom(this.authService.checkEmail(value.email));
      const data = check.data;
      if (data.exists && !data.isOAuthOnly) {
        this.isLoading.set(false);
        this.errorMessage.set(
          'Ya tienes una cuenta con este correo. Inicia sesión o, si no recuerdas tu contraseña, usa nuestro sistema de recuperación de contraseña.'
        );
        return;
      }
      isOAuthOnly = !!(data.exists && data.isOAuthOnly);
    } catch {
      // Network failure: fall through. Backend remains the source of truth.
    }

    if (this.mode() === 'linkAccount' || isOAuthOnly) {
      this.submitLinkAccount(payload);
    } else {
      this.submitRegister(payload);
    }
  }

  private submitRegister(payload: RegisterRequest): void {
    this.authService.register(payload).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        const firstName = response?.data?.user?.firstName || '';
        const email = response?.data?.user?.email || payload.email;

        if (response?.data?.requiresVerification) {
          this.verificationPending.emit({ email, firstName });
          return;
        }

        // Auto-login path (EMAIL_VERIFICATION_REQUIRED=false): drop the
        // user on /perfil with the "complete profile" modal open.
        this.toastService.success(`¡Bienvenido, ${firstName}!`);
        this.closeModal.emit();
        this.router.navigate(['/perfil'], { queryParams: { completeProfile: 'true' } });
      },
      error: (error) => this.handleRegisterError(error),
    });
  }

  private submitLinkAccount(payload: RegisterRequest): void {
    this.authService.linkAccount(payload).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        const firstName = response?.data?.user?.firstName || '';
        const email = response?.data?.user?.email || payload.email;
        this.accountLinkPending.emit({ email, firstName });
      },
      error: (error) => this.handleRegisterError(error),
    });
  }

  private handleRegisterError(error: { error?: { errors?: { message: string }[]; code?: string; message?: string } }): void {
    this.isLoading.set(false);
    const body = error.error;
    if (body?.errors?.length) {
      const details = body.errors.map((e) => e.message).join('. ');
      this.errorMessage.set(details);
    } else if (body?.code === 'EMAIL_ALREADY_REGISTERED') {
      this.errorMessage.set(
        'Ya tienes una cuenta con este correo. Inicia sesión o, si no recuerdas tu contraseña, usa nuestro sistema de recuperación de contraseña.'
      );
    } else {
      this.errorMessage.set(body?.message || 'Error al registrarse. Intenta de nuevo.');
    }
  }

  // ========== OAuth ==========

  protected readonly isOAuthLoading = signal(false);
  private oauthFailsafeCleanup: (() => void) | null = null;

  loginWithGoogle(): void {
    this.isOAuthLoading.set(true);
    this.installOAuthFailsafe();
    this.authService.loginWithOAuth('google');
  }

  /**
   * iOS-only Apple sign-in. No web fallback exists in v1, so the button
   * itself is gated by `platform.isIos()` in the template — this method
   * is never reached on web or Android. The bfcache failsafe used for
   * Google is not needed here because the native flow stays in the app
   * (no browser redirect), so `nativeOAuthLoading` (synced via effect)
   * is the only spinner control needed.
   */
  loginWithApple(): void {
    this.isOAuthLoading.set(true);
    this.authService.loginWithApple();
  }

  /**
   * Resets the OAuth spinner if the user returns to this page without
   * completing the flow (in-app browsers / bfcache restoration).
   */
  private installOAuthFailsafe(): void {
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') cleanup();
    };

    const onPageShow = (event: PageTransitionEvent): void => {
      if (event.persisted) cleanup();
    };

    const cleanup = (): void => {
      this.isOAuthLoading.set(false);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
      this.oauthFailsafeCleanup = null;
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    this.oauthFailsafeCleanup = cleanup;
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
    return 'Campo inválido';
  }
}
