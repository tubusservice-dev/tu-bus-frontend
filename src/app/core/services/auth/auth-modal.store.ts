import { Injectable, signal } from '@angular/core';

export type AuthModalMode = 'login' | 'register' | 'linkAccount';

/**
 * Open/closed state of the auth modal (login / register / link-account)
 * and of the forgot-password modal. Pure UI state — no HTTP, no storage.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthModalStore {
  private readonly authModalOpenSignal = signal(false);
  readonly authModalOpen = this.authModalOpenSignal.asReadonly();

  private readonly authModalInitialModeSignal = signal<AuthModalMode>('login');
  readonly authModalInitialMode = this.authModalInitialModeSignal.asReadonly();

  private readonly authModalPrefillEmailSignal = signal<string>('');
  readonly authModalPrefillEmail = this.authModalPrefillEmailSignal.asReadonly();

  private readonly forgotPasswordModalOpenSignal = signal(false);
  readonly forgotPasswordModalOpen = this.forgotPasswordModalOpenSignal.asReadonly();

  openAuthModal(mode: AuthModalMode = 'login', prefillEmail = ''): void {
    this.authModalInitialModeSignal.set(mode);
    this.authModalPrefillEmailSignal.set(prefillEmail);
    this.authModalOpenSignal.set(true);
  }

  closeAuthModal(): void {
    this.authModalOpenSignal.set(false);
    this.authModalInitialModeSignal.set('login');
    this.authModalPrefillEmailSignal.set('');
  }

  openForgotPasswordModal(): void {
    this.closeAuthModal();
    this.forgotPasswordModalOpenSignal.set(true);
  }

  closeForgotPasswordModal(): void {
    this.forgotPasswordModalOpenSignal.set(false);
  }
}
