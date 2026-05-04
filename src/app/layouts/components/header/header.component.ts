import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle.component';
import { UserMenuComponent } from '../../../shared/components/user-menu/user-menu.component';
import { CartPopoverComponent } from '../../../shared/components/cart-popover/cart-popover.component';
import { UserNotificationsBellComponent } from '../../../shared/components/user-notifications-bell/user-notifications-bell.component';
import { PwaInstallButtonComponent } from '../../../shared/components/pwa-install-button/pwa-install-button.component';
import { AuthService } from '../../../core/services';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    RouterLink,
    ThemeToggleComponent,
    UserMenuComponent,
    CartPopoverComponent,
    UserNotificationsBellComponent,
    PwaInstallButtonComponent,
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

  /** Auth modal is hosted at the application root — see app.ts/app.html. */
  onLoginClick(): void {
    this.authService.openAuthModal('login');
  }
}
