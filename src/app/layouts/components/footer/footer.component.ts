import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { ToastService } from '../../../shared/services/toast.service';

interface SocialLink {
  name: string;
  icon: string;
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
   * Redes sociales — placeholders por ahora. Click muestra un toast
   * "Próximamente" hasta que existan las URLs reales (ver `onSocialClick`).
   */
  protected readonly socialLinks: SocialLink[] = [
    { name: 'Facebook', icon: 'facebook' },
    { name: 'Instagram', icon: 'instagram' },
    { name: 'Twitter', icon: 'twitter' },
  ];

  /** Scroll suave a sección (landing mode) */
  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  /**
   * Toast placeholder for unconfigured social links — replaces the previous
   * `href="#"` which scrolled the page to the top on click.
   */
  protected onSocialClick(): void {
    this.toast.info('Próximamente');
  }
}