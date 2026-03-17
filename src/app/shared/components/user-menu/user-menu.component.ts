import { Component, signal, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './user-menu.component.html',
  styleUrl: './user-menu.component.scss'
})
export class UserMenuComponent {
  private readonly authService = inject(AuthService);

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
}
