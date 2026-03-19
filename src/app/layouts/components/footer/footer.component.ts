import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';

interface FooterLink {
  label: string;
  href: string;
}

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
  /** Nombre de la aplicación */
  protected readonly appName = environment.appName;

  /** Año actual para el copyright */
  protected readonly currentYear = new Date().getFullYear();

  /** Links de navegación */
  protected readonly navLinks = [
    { label: 'Inicio', route: '/' },
    { label: 'Catálogo', route: '/catalogo' },
    { label: 'Carrito', route: '/carrito' },
  ];

  /** Links legales */
  protected readonly legalLinks: FooterLink[] = [
    { label: 'Términos y Condiciones', href: '#' },
    { label: 'Política de Privacidad', href: '#' },
    { label: 'Política de Cookies', href: '#' },
  ];

  /** Redes sociales */
  protected readonly socialLinks: SocialLink[] = [
    { name: 'Facebook', href: '#', icon: 'facebook' },
    { name: 'Instagram', href: '#', icon: 'instagram' },
    { name: 'Twitter', href: '#', icon: 'twitter' },
  ];
}