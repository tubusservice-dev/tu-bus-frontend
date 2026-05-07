import { Component, inject, signal, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { OverlayStackService } from '@core/services/overlay-stack.service';
import { AuthService } from '@core/services/auth.service';
import { ProductDetailPageComponent } from '@features/product-detail/product-detail-page/product-detail-page.component';
import { CartOverlayComponent } from '@features/cart/cart-overlay/cart-overlay.component';
import { ToastContainerComponent } from '@shared/components/toast-container/toast-container.component';
import { BlockedAccountModalComponent } from '@shared/components/blocked-account-modal/blocked-account-modal.component';
import { PwaUpdateBannerComponent } from '@shared/components/pwa-update-banner/pwa-update-banner.component';
import { PwaInstallModalComponent } from '@shared/components/pwa-install-modal/pwa-install-modal.component';
import { AuthModalComponent } from '@shared/components/auth-modal/auth-modal.component';
import { ForgotPasswordModalComponent } from '@shared/components/forgot-password-modal/forgot-password-modal.component';
import { EmailNotFoundModalComponent } from '@shared/components/email-not-found-modal/email-not-found-modal.component';
import { EmailSentModalComponent } from '@shared/components/email-sent-modal/email-sent-modal.component';
import { VerifyEmailPendingModalComponent } from '@shared/components/verify-email-pending-modal/verify-email-pending-modal.component';
import { AccountLinkPendingModalComponent } from '@shared/components/account-link-pending-modal/account-link-pending-modal.component';

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
    AccountLinkPendingModalComponent,
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
  // detail, cart) which mount with z-index 1000.
  protected readonly isAuthModalOpen = this.authService.authModalOpen;
  protected readonly authModalInitialMode = this.authService.authModalInitialMode;
  protected readonly authModalPrefillEmail = this.authService.authModalPrefillEmail;

  // Secondary auth modals owned at app-root so they share the same stacking
  // context and survive route changes.
  protected readonly showForgotPasswordModal = signal(false);
  protected readonly showEmailNotFoundModal = signal(false);
  protected readonly showEmailSentModal = signal(false);
  protected readonly showVerifyPendingModal = signal(false);
  protected readonly showAccountLinkPendingModal = signal(false);

  protected readonly emailContext = signal<string>('');
  protected readonly firstNameContext = signal<string>('');

  constructor() {
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

  // Caso 3 — link-account verification email dispatched.
  onAccountLinkPending(payload: { email: string; firstName: string }): void {
    this.authService.closeAuthModal();
    this.emailContext.set(payload.email);
    this.firstNameContext.set(payload.firstName);
    this.showAccountLinkPendingModal.set(true);
  }

  closeAccountLinkPendingModal(): void {
    this.showAccountLinkPendingModal.set(false);
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

  // Caso 5 — Google-only account: redirect the user to the link-account
  // form with the email pre-filled.
  onForgotPasswordAccountLinkRequired(email: string): void {
    this.showForgotPasswordModal.set(false);
    this.authService.openAccountLinkModal(email);
  }

  onGoToRegister(email: string): void {
    this.showEmailNotFoundModal.set(false);
    this.authService.openAuthModal('register', email);
  }
}
