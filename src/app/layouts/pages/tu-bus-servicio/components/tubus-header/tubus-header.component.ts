import { Component, signal, inject, OnInit, OnDestroy, effect } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { ThemeToggleComponent } from '@shared/components/theme-toggle/theme-toggle.component';
import { UserMenuComponent } from '@shared/components/user-menu/user-menu.component';
import { CartPopoverComponent } from '@shared/components/cart-popover/cart-popover.component';
import { UserNotificationsBellComponent } from '@shared/components/user-notifications-bell/user-notifications-bell.component';
import { PwaInstallButtonComponent } from '@shared/components/pwa-install-button/pwa-install-button.component';
import { HeaderShellComponent } from '@shared/components/header-shell/header-shell.component';
import { AuthService } from '@core/services';
import { LocationStore } from '@core/services/location-store.service';
import { ZoneSelectorService } from '@core/services/zone-selector.service';

@Component({
  selector: 'app-tubus-header',
  standalone: true,
  imports: [
    RouterLink,
    ThemeToggleComponent,
    UserMenuComponent,
    CartPopoverComponent,
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
  private readonly zoneSelector = inject(ZoneSelectorService);
  private routerSub?: Subscription;

  /** Whether we are on the profile page */
  protected readonly isProfilePage = signal(false);

  /** Auth state from service */
  protected readonly isLoggedIn = this.authService.isAuthenticated;

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
      if (this.locationStore.status() === 'undecided') this.zoneSelector.open();
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
    this.zoneSelector.open();
  }

  /** Auth modal is hosted at the application root — see app.ts/app.html. */
  onLoginClick(): void {
    this.authService.openAuthModal('login');
  }
}
