import { Component, inject, input, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../shared/services/toast.service';
import { SettingsService } from '../../../core/services/settings.service';

interface SocialLink {
  name: string;
  icon: 'facebook' | 'instagram' | 'x';
  url: string;
}

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss'
})
export class FooterComponent {
  private readonly toast = inject(ToastService);
  private readonly settings = inject(SettingsService);

  /** En modo minimal solo muestra copyright (checkout mobile) */
  readonly minimal = input(false);

  /** En modo landing los links de nav hacen scroll en vez de routerLink */
  readonly landingMode = input(false);

  /** Nombre de la aplicación */
  protected readonly appName = environment.appName;

  /** Año actual para el copyright */
  protected readonly currentYear = new Date().getFullYear();

  /** Links de navegación (tienda) */
  protected readonly navLinks = [
    { label: 'Inicio', route: '/' },
    { label: 'Catálogo', route: '/catalogo' },
    { label: 'Carrito', route: '/carrito' },
  ];

  /** Links de navegación (landing - scroll) */
  protected readonly landingLinks = [
    { label: 'Servicios', sectionId: 'servicios' },
    { label: 'Combos', sectionId: 'combos' },
    { label: 'Beneficios', sectionId: 'beneficios' },
    { label: 'Contacto', sectionId: 'contacto' },
  ];

  /** Links legales — todos públicos, no requieren sesión. */
  protected readonly legalLinks = [
    { label: 'Términos y Condiciones', route: '/legal/terminos' },
    { label: 'Política de Privacidad', route: '/legal/privacidad' },
    { label: 'Política de Cookies', route: '/legal/cookies' },
  ];

  /**
   * Social links resolved from `customerSupport` settings. Each entry keeps
   * its `url` even when empty so the template can render the icon and the
   * click handler decides whether to open the link or show "Próximamente".
   */
  protected readonly socialLinks = computed<SocialLink[]>(() => {
    const cs = this.settings.customerSupportConfig();
    return [
      { name: 'Facebook', icon: 'facebook', url: cs.facebook },
      { name: 'Instagram', icon: 'instagram', url: cs.instagram },
      { name: 'X', icon: 'x', url: cs.x },
    ];
  });

  /** Scroll suave a sección (landing mode) */
  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  /**
   * Open the configured URL in a new tab, or show a "Próximamente" toast
   * when the field is empty (admin hasn't configured that social channel).
   */
  protected onSocialClick(social: SocialLink): void {
    const url = social.url?.trim();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      this.toast.info('Próximamente');
    }
  }
}