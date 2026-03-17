import { Component, signal, inject, OnInit, OnDestroy, effect } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { ThemeToggleComponent } from '../../../shared/components/theme-toggle/theme-toggle.component';
import { UserMenuComponent } from '../../../shared/components/user-menu/user-menu.component';
import { CartPopoverComponent } from '../../../shared/components/cart-popover/cart-popover.component';
import { AuthModalComponent } from '../../../shared/components/auth-modal/auth-modal.component';
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
    AuthModalComponent,
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private routerSub?: Subscription;

  /** Nombre de la aplicación */
  protected readonly appName = environment.appName;

  /** Verifica si estamos en la página de perfil */
  protected readonly isProfilePage = signal(false);

  /** Estado de autenticación desde el servicio */
  protected readonly isLoggedIn = this.authService.isAuthenticated;

  /** Controla la visibilidad del modal de autenticación */
  protected readonly isAuthModalOpen = signal(false);

  constructor() {
    // Abrir modal automáticamente cuando la sesión expira
    effect(() => {
      if (this.authService.sessionExpired()) {
        this.isAuthModalOpen.set(true);
      }
    });
  }

  ngOnInit(): void {
    // Verificar ruta inicial
    this.isProfilePage.set(this.router.url === '/perfil');

    // Escuchar cambios de ruta
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
   * Abre el modal de autenticación
   */
  onLoginClick(): void {
    this.isAuthModalOpen.set(true);
  }

  /**
   * Cierra el modal de autenticación
   */
  closeAuthModal(): void {
    this.isAuthModalOpen.set(false);
  }
}