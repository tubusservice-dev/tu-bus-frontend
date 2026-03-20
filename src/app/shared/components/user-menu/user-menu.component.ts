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

  /** Usuario actual desde el servicio */
  protected readonly user = this.authService.currentUser;

  /** Nombre completo del usuario */
  protected readonly userName = this.authService.userFullName;

  /** Avatar del usuario */
  protected readonly userAvatar = this.authService.userAvatar;

  /** Email del usuario */
  protected readonly userEmail = computed(() => this.user()?.email ?? '');

  /** Controla si el menú desplegable está abierto */
  protected readonly isMenuOpen = signal(false);

  toggleMenu(): void {
    this.isMenuOpen.update(value => !value);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  logout(): void {
    this.closeMenu();
    this.authService.logout();
  }

  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    const name = this.userName();
    img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=001d56&color=fff&size=128`;
  }
}
