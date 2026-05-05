import { Component, signal, inject, OnInit, OnDestroy, effect } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { ThemeToggleComponent } from '@shared/components/theme-toggle/theme-toggle.component';
import { UserMenuComponent } from '@shared/components/user-menu/user-menu.component';
import { CartPopoverComponent } from '@shared/components/cart-popover/cart-popover.component';
import { ZoningModalComponent } from '@shared/components/zoning-modal/zoning-modal.component';
import { UserNotificationsBellComponent } from '@shared/components/user-notifications-bell/user-notifications-bell.component';
import { PwaInstallButtonComponent } from '@shared/components/pwa-install-button/pwa-install-button.component';
import { HeaderShellComponent } from '@shared/components/header-shell/header-shell.component';
import { AuthService } from '@core/services';
import { LocationService } from '@core/services/location.service';
import { CartService } from '@core/services/cart.service';

@Component({
  selector: 'app-tubus-header',
  standalone: true,
  imports: [
    RouterLink,
    ThemeToggleComponent,
    UserMenuComponent,
    CartPopoverComponent,
    ZoningModalComponent,
    UserNotificationsBellComponent,
    PwaInstallButtonComponent,
    HeaderShellComponent,
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

  /** Auth modal is hosted at the application root — see app.ts/app.html. */
  onLoginClick(): void {
    this.authService.openAuthModal('login');
  }
}
