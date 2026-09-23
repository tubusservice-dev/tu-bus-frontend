import { Component, signal, inject, OnInit, OnDestroy, effect } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { ThemeToggleComponent } from '@shared/components/theme-toggle/theme-toggle.component';
import { UserMenuComponent } from '@shared/components/user-menu/user-menu.component';
import { CartPopoverComponent } from '@shared/components/cart-popover/cart-popover.component';
import { ZoningModalComponent, ZonePick } from '@shared/components/zoning-modal/zoning-modal.component';
import { UserNotificationsBellComponent } from '@shared/components/user-notifications-bell/user-notifications-bell.component';
import { PwaInstallButtonComponent } from '@shared/components/pwa-install-button/pwa-install-button.component';
import { HeaderShellComponent } from '@shared/components/header-shell/header-shell.component';
import { AuthService } from '@core/services';
import { LocationStore } from '@core/services/location-store.service';
import { LocationChangePlan, LocationChangeService } from '@core/services/location-change.service';
import { ToastService } from '@shared/services/toast.service';

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
  protected readonly locationStore = inject(LocationStore);
  private readonly locationChange = inject(LocationChangeService);
  private readonly toastService = inject(ToastService);
  private routerSub?: Subscription;

  /** Whether we are on the profile page */
  protected readonly isProfilePage = signal(false);

  /** Auth state from service */
  protected readonly isLoggedIn = this.authService.isAuthenticated;

  /** Zoning modal visibility */
  protected readonly showZoneModal = signal(false);
  /** The picked place is being checked against the cart. */
  protected readonly zoneBusy = signal(false);
  /** A change that would remove items from the cart, waiting for the customer's answer. */
  protected readonly pendingZoneChange = signal<LocationChangePlan | null>(null);
  private zoneAutoOpenDone = false;

  constructor() {
    // Auto-open auth modal when session expires
    effect(() => {
      if (this.authService.sessionExpired()) {
        this.authService.openAuthModal();
      }
    });

    // Ask for the zone once, only when nothing was ever decided (a customer
    // who chose to explore is not asked again). A location from the previous
    // version is translated by the server first, so this waits for the store.
    effect(() => {
      if (this.zoneAutoOpenDone || !this.locationStore.isResolved()) return;
      this.zoneAutoOpenDone = true;
      if (this.locationStore.status() === 'undecided') this.showZoneModal.set(true);
    });
  }


  ngOnInit(): void {
    // Check initial route
    this.isProfilePage.set(this.matchesProfileRoot(this.router.url));

    // Listen for route changes
    this.routerSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.isProfilePage.set(
          this.matchesProfileRoot((event as NavigationEnd).urlAfterRedirects),
        );
      });
  }

  // Strip fragment and query so the match still holds when the profile
  // tabs switch via fragments (`/perfil#garaje`, `/perfil#pedidos`, ...).
  // The previous strict equality check hid the back arrow on every tab
  // other than the default one.
  private matchesProfileRoot(url: string): boolean {
    const path = url.split('#')[0].split('?')[0];
    return path === '/perfil';
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  openZoneModal(): void {
    this.showZoneModal.set(true);
  }

  /**
   * A place was picked: check what it means for the cart first. Only when
   * some items are not carried there does the customer have to confirm, and
   * then only those items leave the cart.
   */
  onZonePicked(pick: ZonePick): void {
    this.zoneBusy.set(true);
    this.locationChange.prepare(pick.state, pick.municipality).subscribe({
      next: (plan) => {
        this.zoneBusy.set(false);
        this.showZoneModal.set(false);
        if (plan.unavailable.length) this.pendingZoneChange.set(plan);
        else this.locationChange.apply(plan);
      },
      error: () => {
        this.zoneBusy.set(false);
        this.toastService.error('No pudimos comprobar esa zona. Intenta de nuevo.');
      },
    });
  }

  confirmZoneChange(): void {
    const plan = this.pendingZoneChange();
    if (plan) this.locationChange.apply(plan);
    this.pendingZoneChange.set(null);
  }

  /** Keeps the current place and the whole cart. */
  cancelZoneChange(): void {
    this.pendingZoneChange.set(null);
  }

  /** "Ahora no, solo quiero explorar". */
  onZoneExplore(): void {
    this.showZoneModal.set(false);
    this.locationStore.browseWithoutLocation();
  }

  /** Closing without a pick keeps any place already set; with none, it means exploring. */
  onZoneModalClosed(): void {
    this.showZoneModal.set(false);
    if (this.locationStore.status() === 'undecided') this.locationStore.browseWithoutLocation();
  }

  /** Auth modal is hosted at the application root — see app.ts/app.html. */
  onLoginClick(): void {
    this.authService.openAuthModal('login');
  }
}
