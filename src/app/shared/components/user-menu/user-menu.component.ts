import { Component, signal, inject, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services';
import { ThemeService } from '../../../core/services/theme.service';
import { UserNotificationService } from '../../../core/services/user-notification.service';
import { ClickOutsideDirective } from '../../directives/click-outside.directive';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [RouterLink, ClickOutsideDirective],
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.scss'
})
export class UserMenuComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly themeService = inject(ThemeService);

  protected readonly user = this.authService.currentUser;
  protected readonly userName = this.authService.userFullName;
  protected readonly userAvatar = this.authService.userAvatar;
  protected readonly userEmail = computed(() => this.user()?.email ?? '');

  protected readonly isMenuOpen = signal(false);
  protected readonly showLogoutModal = signal(false);

  protected readonly userNotifService = inject(UserNotificationService);

  toggleMenu(): void {
    this.isMenuOpen.update(value => !value);
    if (this.isMenuOpen()) this.userNotifService.closePopover();
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  requestLogout(): void {
    this.closeMenu();
    this.showLogoutModal.set(true);
    document.body.style.overflow = 'hidden';
  }

  cancelLogout(): void {
    this.showLogoutModal.set(false);
    document.body.style.overflow = '';
  }

  confirmLogout(): void {
    this.showLogoutModal.set(false);
    document.body.style.overflow = '';
    this.authService.logout();
  }

  isActive(path: string, fragment?: string): boolean {
    const url = this.router.url.split('?')[0];
    if (fragment) {
      return url === `${path}#${fragment}`;
    }
    // "Mi Perfil" active only when no fragment or unknown fragments
    return url === path || (url.startsWith(path + '#') && !url.includes('#pedidos') && !url.includes('#garaje'));
  }

  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const name = this.userName();
    img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=001d56&color=fff&size=128`;
  }
}
