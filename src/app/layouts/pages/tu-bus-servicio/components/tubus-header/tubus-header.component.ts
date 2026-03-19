import { Component, signal, inject, OnInit, OnDestroy, effect } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { ThemeToggleComponent } from '../../../../../shared/components/theme-toggle/theme-toggle.component';
import { UserMenuComponent } from '../../../../../shared/components/user-menu/user-menu.component';
import { CartPopoverComponent } from '../../../../../shared/components/cart-popover/cart-popover.component';
import { AuthModalComponent } from '../../../../../shared/components/auth-modal/auth-modal.component';
import { AuthService, ZoneService } from '../../../../../core/services';

@Component({
  selector: 'app-tubus-header',
  standalone: true,
  imports: [
    RouterLink,
    ThemeToggleComponent,
    UserMenuComponent,
    CartPopoverComponent,
    AuthModalComponent,
  ],
  templateUrl: './tubus-header.component.html',
  styleUrl: './tubus-header.component.scss'
})
export class TubusHeaderComponent implements OnInit, OnDestroy {
  protected readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly zoneService = inject(ZoneService);
  private routerSub?: Subscription;

  /** Verifica si estamos en la página de perfil */
  protected readonly isProfilePage = signal(false);

  /** Estado de autenticación desde el servicio */
  protected readonly isLoggedIn = this.authService.isAuthenticated;

  /** Modal de auth controlado por el AuthService */
  protected readonly isAuthModalOpen = this.authService.authModalOpen;

  constructor() {
    // Abrir modal automáticamente cuando la sesión expira
    effect(() => {
      if (this.authService.sessionExpired()) {
        this.authService.openAuthModal();
      }
    });
  }

  ngOnInit(): void {
    // Cargar ciudades desde el API
    this.zoneService.loadCities().subscribe();

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
   * Abre el modal de selección de zona
   */
  openZoneModal(): void {
    this.zoneService.clearSelection();
  }

  /**
   * Abre el modal de autenticación
   */
  onLoginClick(): void {
    this.authService.openAuthModal();
  }

  /**
   * Cierra el modal de autenticación
   */
  closeAuthModal(): void {
    this.authService.closeAuthModal();
  }
}
