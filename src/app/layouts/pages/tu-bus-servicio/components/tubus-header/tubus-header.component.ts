import { Component, signal, inject, OnInit, OnDestroy, effect } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { ThemeToggleComponent } from '../../../../../shared/components/theme-toggle/theme-toggle.component';
import { UserMenuComponent } from '../../../../../shared/components/user-menu/user-menu.component';
import { CartPopoverComponent } from '../../../../../shared/components/cart-popover/cart-popover.component';
import { AuthModalComponent } from '../../../../../shared/components/auth-modal/auth-modal.component';
import { ClickOutsideDirective } from '../../../../../shared/directives';
import { AuthService, ZoneService, City, Municipality } from '../../../../../core/services';

@Component({
  selector: 'app-tubus-header',
  standalone: true,
  imports: [
    RouterLink,
    ThemeToggleComponent,
    UserMenuComponent,
    CartPopoverComponent,
    AuthModalComponent,
    ClickOutsideDirective,
  ],
  templateUrl: './tubus-header.component.html',
  styleUrl: './tubus-header.component.scss'
})
export class TubusHeaderComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly zoneService = inject(ZoneService);
  private routerSub?: Subscription;

  /** Controla la visibilidad del dropdown de zonas */
  protected readonly isZoneDropdownOpen = signal(false);

  /** Paso actual del selector: 'city' o 'municipality' */
  protected readonly selectorStep = signal<'city' | 'municipality'>('city');

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
   * Toggle del dropdown de zonas
   */
  toggleZoneDropdown(): void {
    if (this.isZoneDropdownOpen()) {
      this.closeZoneDropdown();
    } else {
      // Si ya hay ciudad seleccionada, mostrar municipios
      if (this.zoneService.selectedCity()) {
        this.selectorStep.set('municipality');
      } else {
        this.selectorStep.set('city');
      }
      this.isZoneDropdownOpen.set(true);
    }
  }

  /**
   * Cierra el dropdown de zonas
   */
  closeZoneDropdown(): void {
    this.isZoneDropdownOpen.set(false);
  }

  /**
   * Selecciona una ciudad
   */
  selectCity(city: City): void {
    this.zoneService.selectCity(city);
    if (city.isActive && city.municipalities.length > 0) {
      this.selectorStep.set('municipality');
    } else {
      this.closeZoneDropdown();
    }
  }

  /**
   * Selecciona un municipio
   */
  selectMunicipality(municipality: Municipality): void {
    this.zoneService.selectMunicipality(municipality);
    this.closeZoneDropdown();
  }

  /**
   * Volver a selección de ciudad
   */
  backToCity(): void {
    this.selectorStep.set('city');
  }

  /**
   * Cambiar zona (reset)
   */
  changeZone(): void {
    this.zoneService.clearSelection();
    this.selectorStep.set('city');
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
