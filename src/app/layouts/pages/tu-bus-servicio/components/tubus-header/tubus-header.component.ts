import { Component, signal, inject, OnInit, OnDestroy, effect } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { ThemeToggleComponent } from '../../../../../shared/components/theme-toggle/theme-toggle.component';
import { UserMenuComponent } from '../../../../../shared/components/user-menu/user-menu.component';
import { CartPopoverComponent } from '../../../../../shared/components/cart-popover/cart-popover.component';
import { AuthModalComponent } from '../../../../../shared/components/auth-modal/auth-modal.component';
import { ForgotPasswordModalComponent } from '../../../../../shared/components/forgot-password-modal/forgot-password-modal.component';
import { EmailNotFoundModalComponent } from '../../../../../shared/components/email-not-found-modal/email-not-found-modal.component';
import { EmailSentModalComponent } from '../../../../../shared/components/email-sent-modal/email-sent-modal.component';
import { VerifyEmailPendingModalComponent } from '../../../../../shared/components/verify-email-pending-modal/verify-email-pending-modal.component';
import { ZoningModalComponent } from '../../../../../shared/components/zoning-modal/zoning-modal.component';
import { UserNotificationsBellComponent } from '../../../../../shared/components/user-notifications-bell/user-notifications-bell.component';
import { AuthService } from '../../../../../core/services';
import { LocationService } from '../../../../../core/services/location.service';
import { CartService } from '../../../../../core/services/cart.service';

type AuthMode = 'login' | 'register';

@Component({
  selector: 'app-tubus-header',
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
    ZoningModalComponent,
    UserNotificationsBellComponent,
  ],
  templateUrl: './tubus-header.component.html',
  styleUrl: './tubus-header.component.scss'
})
export class TubusHeaderComponent implements OnInit, OnDestroy {
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly locationService = inject(LocationService);
  protected readonly cartService = inject(CartService);
  private routerSub?: Subscription;

  /** Whether we are on the profile page */
  protected readonly isProfilePage = signal(false);

  /** Auth state from service */
  protected readonly isLoggedIn = this.authService.isAuthenticated;

  /** Auth modal controlled by AuthService */
  protected readonly isAuthModalOpen = this.authService.authModalOpen;

  /** Zone change confirmation modal */
  protected readonly showZoneConfirm = signal(false);

  /** Zoning modal visibility */
  protected readonly showZoneModal = signal(false);

  constructor() {
    // Auto-open auth modal when session expires
    effect(() => {
      if (this.authService.sessionExpired()) {
        this.authService.openAuthModal();
      }
    });
  }

  ngOnInit(): void {
    // Auto-open zone modal if no location selected
    if (!this.locationService.hasLocation()) {
      this.showZoneModal.set(true);
    }

    // Check initial route
    this.isProfilePage.set(this.router.url === '/perfil');

    // Listen for route changes
    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.isProfilePage.set((event as NavigationEnd).url === '/perfil');
      });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  /**
   * Open zone selection modal.
   * If cart has items, show confirmation first.
   */
  openZoneModal(): void {
    if (this.cartService.totalItems() > 0) {
      this.showZoneConfirm.set(true);
    } else {
      this.showZoneModal.set(true);
    }
  }

  /** Confirm zone change: clear cart, then open modal */
  confirmZoneChange(): void {
    this.cartService.clearCart();
    this.locationService.clearLocation();
    this.showZoneConfirm.set(false);
    this.showZoneModal.set(true);
  }

  /** Cancel zone change */
  cancelZoneChange(): void {
    this.showZoneConfirm.set(false);
  }

  /** Called when zoning modal closes */
  onZoneModalClosed(): void {
    this.showZoneModal.set(false);
  }

  // ─── Auth modal initial state ──────────────────────────────────

  protected readonly authModalInitialMode = signal<AuthMode>('login');
  protected readonly authModalPrefillEmail = signal<string>('');

  // ─── Visibility for the secondary auth modals ──────────────────

  protected readonly showForgotPasswordModal = signal(false);
  protected readonly showEmailNotFoundModal = signal(false);
  protected readonly showEmailSentModal = signal(false);
  protected readonly showVerifyPendingModal = signal(false);

  protected readonly emailContext = signal<string>('');
  protected readonly firstNameContext = signal<string>('');

  /** Open auth modal */
  onLoginClick(): void {
    this.authModalInitialMode.set('login');
    this.authModalPrefillEmail.set('');
    this.authService.openAuthModal();
  }

  /** Close auth modal */
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
