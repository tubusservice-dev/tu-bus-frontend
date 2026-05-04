import { Component, inject, signal, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { OverlayStackService } from './core/services/overlay-stack.service';
import { AuthService } from './core/services/auth.service';
import { ProductDetailPageComponent } from './features/product-detail/product-detail-page/product-detail-page.component';
import { CartOverlayComponent } from './features/cart/cart-overlay/cart-overlay.component';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';
import { BlockedAccountModalComponent } from './shared/components/blocked-account-modal/blocked-account-modal.component';
import { PwaUpdateBannerComponent } from './shared/components/pwa-update-banner/pwa-update-banner.component';
import { PwaInstallModalComponent } from './shared/components/pwa-install-modal/pwa-install-modal.component';
import { AuthModalComponent } from './shared/components/auth-modal/auth-modal.component';
import { ForgotPasswordModalComponent } from './shared/components/forgot-password-modal/forgot-password-modal.component';
import { EmailNotFoundModalComponent } from './shared/components/email-not-found-modal/email-not-found-modal.component';
import { EmailSentModalComponent } from './shared/components/email-sent-modal/email-sent-modal.component';
import { VerifyEmailPendingModalComponent } from './shared/components/verify-email-pending-modal/verify-email-pending-modal.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    ProductDetailPageComponent,
    CartOverlayComponent,
    ToastContainerComponent,
    BlockedAccountModalComponent,
    AuthModalComponent,
    ForgotPasswordModalComponent,
    EmailNotFoundModalComponent,
    EmailSentModalComponent,
    VerifyEmailPendingModalComponent,
    PwaUpdateBannerComponent,
    PwaInstallModalComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly overlayService = inject(OverlayStackService);
  protected readonly authService = inject(AuthService);

  // Auth modal hosted here so it stacks above any feature overlay (product
  // detail, cart) which mount with z-index 1000. Previously these modals
  // lived inside <app-header>, whose fixed z-index 50 created a stacking
  // context that trapped them behind feature overlays.
  protected readonly isAuthModalOpen = this.authService.authModalOpen;
  protected readonly authModalInitialMode = this.authService.authModalInitialMode;
  protected readonly authModalPrefillEmail = this.authService.authModalPrefillEmail;

  // Secondary auth modals — owned here because they're triggered from the
  // root-level auth modal and must share the same stacking context.
  protected readonly showForgotPasswordModal = signal(false);
  protected readonly showEmailNotFoundModal = signal(false);
  protected readonly showEmailSentModal = signal(false);
  protected readonly showVerifyPendingModal = signal(false);

  // Shared context across modals (email / firstName the user just acted on)
  protected readonly emailContext = signal<string>('');
  protected readonly firstNameContext = signal<string>('');

  constructor() {
    // Open the auth modal automatically when the session expires
    effect(() => {
      if (this.authService.sessionExpired()) {
        this.authService.openAuthModal();
      }
    });
  }

  closeAuthModal(): void {
    this.authService.closeAuthModal();
  }

  // ─── Auth modal → secondary modals ─────────────────────────────

  onVerificationPending(payload: { email: string; firstName: string }): void {
    this.authService.closeAuthModal();
    this.emailContext.set(payload.email);
    this.firstNameContext.set(payload.firstName);
    this.showVerifyPendingModal.set(true);
  }

  closeVerifyPendingModal(): void {
    this.showVerifyPendingModal.set(false);
    this.emailContext.set('');
    this.firstNameContext.set('');
  }

  onForgotPasswordRequested(): void {
    this.authService.closeAuthModal();
    this.showForgotPasswordModal.set(true);
  }

  closeForgotPasswordModal(): void {
    this.showForgotPasswordModal.set(false);
  }

  onForgotPasswordSent(email: string): void {
    this.showForgotPasswordModal.set(false);
    this.emailContext.set(email);
    this.showEmailSentModal.set(true);
  }

  closeEmailSentModal(): void {
    this.showEmailSentModal.set(false);
    this.emailContext.set('');
  }

  onForgotPasswordEmailNotFound(email: string): void {
    this.showForgotPasswordModal.set(false);
    this.emailContext.set(email);
    this.showEmailNotFoundModal.set(true);
  }

  closeEmailNotFoundModal(): void {
    this.showEmailNotFoundModal.set(false);
    this.emailContext.set('');
  }

  onGoToRegister(email: string): void {
    this.showEmailNotFoundModal.set(false);
    this.authService.openAuthModal('register', email);
  }
}
