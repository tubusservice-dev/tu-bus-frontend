import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';

interface SocialLink {
  name: string;
  href: string;
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

  /** Redes sociales */
  protected readonly socialLinks: SocialLink[] = [
    { name: 'Facebook', href: '#', icon: 'facebook' },
    { name: 'Instagram', href: '#', icon: 'instagram' },
    { name: 'Twitter', href: '#', icon: 'twitter' },
  ];

  /** Scroll suave a sección (landing mode) */
  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }
}