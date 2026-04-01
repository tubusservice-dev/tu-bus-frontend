import { Component, signal, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services';
import { ThemeService } from '../../../core/services/theme.service';
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
  protected readonly themeService = inject(ThemeService);

  protected readonly user = this.authService.currentUser;
  protected readonly userName = this.authService.userFullName;
  protected readonly userAvatar = this.authService.userAvatar;
  protected readonly userEmail = computed(() => this.user()?.email ?? '');

  protected readonly isMenuOpen = signal(false);
  protected readonly showLogoutModal = signal(false);

  toggleMenu(): void {
    this.isMenuOpen.update(value => !value);
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

  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const name = this.userName();
    img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=001d56&color=fff&size=128`;
  }
}
