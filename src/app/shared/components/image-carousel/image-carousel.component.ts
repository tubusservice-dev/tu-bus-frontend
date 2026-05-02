import {
  Component,
  Input,
  signal,
  computed,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IMAGE_PLACEHOLDER_DATA_URL,
  onImageError,
} from '../../utils/image-placeholder.util';

@Component({
  selector: 'app-image-carousel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './image-carousel.component.html',
  styleUrl: './image-carousel.component.scss',
})
export class ImageCarouselComponent {
  /** Imágenes a mostrar */
  @Input() images: string[] = [];

  /** Mostrar indicadores */
  @Input() showIndicators = true;

  /** Mostrar flechas de navegación */
  @Input() showArrows = true;

  /** Altura del carrusel */
  @Input() height = '300px';

  /** Imagen placeholder si no hay imágenes */
  @Input() placeholder: string = IMAGE_PLACEHOLDER_DATA_URL;

  /** Bound to (error) on the <img> for runtime fallback. */
  protected readonly handleImageError = onImageError;

  /** Modo de ajuste de imagen: 'cover' recorta para llenar, 'contain' muestra completa */
  @Input() imageFit: 'cover' | 'contain' = 'contain';

  /** Habilitar efecto hover para mostrar imagen completa (cuando imageFit es 'cover') */
  @Input() hoverReveal = false;

  /** Índice de la imagen actual */
  protected readonly currentIndex = signal(0);

  /** Imágenes a mostrar (con placeholder si está vacío) */
  protected readonly displayImages = computed(() => {
    return this.images.length > 0 ? this.images : [this.placeholder];
  });

  /** Imagen actual */
  protected readonly currentImage = computed(() => {
    const images = this.displayImages();
    const index = this.currentIndex();
    return images[index] || this.placeholder;
  });

  constructor() {
    // Reiniciar índice cuando cambian las imágenes
    effect(() => {
      const images = this.displayImages();
      if (this.currentIndex() >= images.length) {
        this.currentIndex.set(0);
      }
    });
  }

  /**
   * Ir a la siguiente imagen
   */
  next(): void {
    const images = this.displayImages();
    this.currentIndex.update((i) => (i + 1) % images.length);
  }

  /**
   * Ir a la imagen anterior
   */
  prev(): void {
    const images = this.displayImages();
    this.currentIndex.update((i) => (i - 1 + images.length) % images.length);
  }

  /**
   * Ir a una imagen específica
   */
  goTo(index: number): void {
    this.currentIndex.set(index);
  }
}
