import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HERO_CONTENT } from '../../data/mock-data';

@Component({
  selector: 'app-tubus-hero',
  standalone: true,
  imports: [],
  templateUrl: './tubus-hero.component.html',
  styleUrl: './tubus-hero.component.scss'
})
export class TubusHeroComponent {
  private readonly router = inject(Router);
  protected readonly hero = HERO_CONTENT;

  goToCatalog(): void {
    this.router.navigate(['/catalogo']);
  }

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
