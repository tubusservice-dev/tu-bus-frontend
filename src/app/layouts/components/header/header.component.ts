import { Component, signal, inject, OnInit, OnDestroy, effect } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle.component';
import { UserMenuComponent } from '../../../shared/components/user-menu/user-menu.component';
import { CartPopoverComponent } from '../../../shared/components/cart-popover/cart-popover.component';
import { AuthModalComponent } from '../../../shared/components/auth-modal/auth-modal.component';
import { ForgotPasswordModalComponent } from '../../../shared/components/forgot-password-modal/forgot-password-modal.component';
import { EmailNotFoundModalComponent } from '../../../shared/components/email-not-found-modal/email-not-found-modal.component';
import { EmailSentModalComponent } from '../../../shared/components/email-sent-modal/email-sent-modal.component';
import { VerifyEmailPendingModalComponent } from '../../../shared/components/verify-email-pending-modal/verify-email-pending-modal.component';
import { UserNotificationsBellComponent } from '../../../shared/components/user-notifications-bell/user-notifications-bell.component';
import { AuthService } from '../../../core/services';
import { environment } from '../../../../environments/environment';

type AuthMode = 'login' | 'register';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    RouterLink,
    ThemeToggleComponent,
    UserMenuComponent,
    CartPopoverComponent,
    AuthModalComponent,
    ForgotPasswordModalComponent,
    EmailNotFoundModalComponent,
    EmailSentModalComponent,
    VerifyEmailPendingModalComponent,
    UserNotificationsBellComponent,
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent implements OnInit, OnDestroy {
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private routerSub?: Subscription;

  protected readonly appName = environment.appName;
  protected readonly isProfilePage = signal(false);
  protected readonly isLoggedIn = this.authService.isAuthenticated;
  protected readonly isAuthModalOpen = this.authService.authModalOpen;

  // Auth-modal initial state controls (used when redirecting from email-not-found → register)
  protected readonly authModalInitialMode = signal<AuthMode>('login');
  protected readonly authModalPrefillEmail = signal<string>('');

  // Visibility for the secondary auth modals
  protected readonly showForgotPasswordModal = signal(false);
  protected readonly showEmailNotFoundModal = signal(false);
  protected readonly showEmailSentModal = signal(false);
  protected readonly showVerifyPendingModal = signal(false);

  // Shared context across modals (email/firstName the user just acted on)
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

  ngOnInit(): void {
    this.isProfilePage.set(this.router.url === '/perfil');
    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.isProfilePage.set((event as NavigationEnd).url === '/perfil');
      });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  // ─── Auth modal triggers ───────────────────────────────────────

  onLoginClick(): void {
    this.authModalInitialMode.set('login');
    this.authModalPrefillEmail.set('');
    this.authService.openAuthModal();
  }

  closeAuthModal(): void {
    this.authService.closeAuthModal();
    this.authModalInitialMode.set('login');
    this.authModalPrefillEmail.set('');
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
    this.authModalInitialMode.set('register');
    this.authModalPrefillEmail.set(email);
    this.authService.openAuthModal();
  }
}
