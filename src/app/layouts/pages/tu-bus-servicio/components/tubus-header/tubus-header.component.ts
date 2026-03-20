import { Component, signal, inject, OnInit, OnDestroy, effect } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { ThemeToggleComponent } from '../../../../../shared/components/theme-toggle/theme-toggle.component';
import { UserMenuComponent } from '../../../../../shared/components/user-menu/user-menu.component';
import { CartPopoverComponent } from '../../../../../shared/components/cart-popover/cart-popover.component';
import { AuthModalComponent } from '../../../../../shared/components/auth-modal/auth-modal.component';
import { AuthService, ZoneService } from '../../../../../core/services';
import { CartService } from '../../../../../core/services/cart.service';

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
  protected readonly cartService = inject(CartService);
  private routerSub?: Subscription;

  /** Verifica si estamos en la página de perfil */
  protected readonly isProfilePage = signal(false);

  /** Estado de autenticación desde el servicio */
  protected readonly isLoggedIn = this.authService.isAuthenticated;

  /** Modal de auth controlado por el AuthService */
  protected readonly isAuthModalOpen = this.authService.authModalOpen;

  /** Modal de confirmación de cambio de zona */
  protected readonly showZoneConfirm = signal(false);

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
   * Si hay items en el carrito, muestra confirmación primero
   */
  openZoneModal(): void {
    if (this.cartService.totalItems() > 0) {
      this.showZoneConfirm.set(true);
    } else {
      this.zoneService.clearSelection();
    }
  }

  /** Confirma cambio de zona y limpia carrito */
  confirmZoneChange(): void {
    this.cartService.clearCart();
    this.showZoneConfirm.set(false);
    this.zoneService.clearSelection();
  }

  /** Cancela el cambio de zona */
  cancelZoneChange(): void {
    this.showZoneConfirm.set(false);
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
