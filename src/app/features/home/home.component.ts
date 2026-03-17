import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { SettingsService } from '../../core/services/settings.service';
import { ZoneService } from '../../core/services/zone.service';
import { Product } from '../../models/product.model';
import {
  ProductCardComponent,
  ProductCardData,
} from '../../shared/components/product-card/product-card.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCardComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly productService = inject(ProductService);
  private readonly settingsService = inject(SettingsService);
  private readonly zoneService = inject(ZoneService);

  @ViewChild('carouselContainer') carouselContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('carouselTrack') carouselTrack!: ElementRef<HTMLDivElement>;

  protected readonly isLoading = signal(true);
  private readonly allFeaturedProducts = signal<ProductCardData[]>([]);
  protected readonly featuredProducts = computed(() => this.filterByZone(this.allFeaturedProducts()));

  // Home Hero config desde settings
  protected readonly homeHero = this.settingsService.homeHeroConfig;

  // Número de cards visibles (responsive)
  protected readonly visibleCards = signal(4);

  // Carrusel infinito - productos extendidos con clones al inicio y final
  protected readonly extendedProducts = computed(() => {
    const products = this.featuredProducts();
    if (products.length === 0) return [];

    const visible = this.visibleCards();
    // Clonamos suficientes productos para el efecto infinito
    const firstClones = products.slice(0, visible);
    const lastClones = products.slice(-visible);

    return [...lastClones, ...products, ...firstClones];
  });

  // Carrusel state - usamos porcentaje para posicionar
  protected readonly currentIndex = signal(0);
  protected readonly isTransitioning = signal(true);
  protected readonly dragOffset = signal(0); // Offset de drag en porcentaje
  private autoPlayInterval: ReturnType<typeof setInterval> | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // Drag state
  private isDragging = false;
  private startX = 0;
  private currentX = 0;

  // Porcentaje del ancho de una card (100 / visibleCards)
  protected readonly cardWidthPercent = computed(() => {
    return 100 / this.visibleCards();
  });

  // Posición del track en porcentaje
  protected readonly trackPosition = computed(() => {
    const visible = this.visibleCards();
    const cardPercent = 100 / visible;
    // Offset inicial por los clones al principio
    const cloneOffset = visible * cardPercent;
    // Posición actual
    const currentOffset = this.currentIndex() * cardPercent;
    // Añadir el offset del drag
    return -(cloneOffset + currentOffset) + this.dragOffset();
  });

  // Indicadores del carrusel
  protected readonly carouselDots = computed(() => {
    const products = this.featuredProducts();
    return Array(products.length).fill(0);
  });

  ngOnInit(): void {
    this.loadFeaturedProducts();
    this.updateVisibleCards();
    window.addEventListener('resize', this.handleResize);
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.startAutoPlay();
    }, 100);
  }

  ngOnDestroy(): void {
    this.stopAutoPlay();
    window.removeEventListener('resize', this.handleResize);
    this.resizeObserver?.disconnect();
  }

  private handleResize = (): void => {
    this.updateVisibleCards();
  };

  private filterByZone(products: ProductCardData[]): ProductCardData[] {
    const zone = this.zoneService.selectedZone();
    if (!zone) return products;

    return products.filter(p => {
      const product = p as unknown as Product;
      if (product.allRegions) return true;
      if (!product.regions || product.regions.length === 0) return true;

      return product.regions.some(r => {
        const cityId = typeof r.city === 'string' ? r.city : r.city?.id;
        return cityId === zone.city.id && r.municipalityCode === zone.municipality.code;
      });
    });
  }

  private loadFeaturedProducts(): void {
    this.productService
      .getAll({
        limit: 12,
        isFeatured: true,
        isActive: true,
      })
      .subscribe({
        next: (response) => {
          this.allFeaturedProducts.set(response.data);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
        },
      });
  }

  private updateVisibleCards(): void {
    const width = window.innerWidth;
    if (width >= 1280) {
      this.visibleCards.set(4); // XL: 4 cards
    } else if (width >= 1024) {
      this.visibleCards.set(3); // LG: 3 cards
    } else if (width >= 768) {
      this.visibleCards.set(2); // MD: 2 cards
    } else {
      this.visibleCards.set(1); // SM: 1 card
    }
  }

  // Auto-play
  private startAutoPlay(): void {
    this.stopAutoPlay();

    const carouselConfig = this.settingsService.carouselsConfig().homeCarousel;
    if (!carouselConfig.isEnabled) return;

    this.autoPlayInterval = setInterval(() => {
      this.nextSlide();
    }, carouselConfig.interval);
  }

  private stopAutoPlay(): void {
    if (this.autoPlayInterval) {
      clearInterval(this.autoPlayInterval);
      this.autoPlayInterval = null;
    }
  }

  private nextSlide(): void {
    const totalProducts = this.featuredProducts().length;
    if (totalProducts === 0) return;

    this.isTransitioning.set(true);
    const nextIndex = this.currentIndex() + 1;
    this.currentIndex.set(nextIndex);

    // Si llegamos al final (después de los productos reales), saltar al inicio
    if (nextIndex >= totalProducts) {
      this.scheduleInfiniteJump(0);
    }
  }

  private prevSlide(): void {
    const totalProducts = this.featuredProducts().length;
    if (totalProducts === 0) return;

    this.isTransitioning.set(true);
    const prevIndex = this.currentIndex() - 1;
    this.currentIndex.set(prevIndex);

    // Si llegamos antes del inicio, saltar al final
    if (prevIndex < 0) {
      this.scheduleInfiniteJump(totalProducts - 1);
    }
  }

  private scheduleInfiniteJump(targetIndex: number): void {
    // Esperar a que termine la transición CSS y luego saltar sin animación
    setTimeout(() => {
      this.isTransitioning.set(false);
      this.currentIndex.set(targetIndex);

      // Reactivar transición después de un frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          this.isTransitioning.set(true);
        });
      });
    }, 600); // Coincide con la duración de la transición CSS
  }

  goToSlide(index: number): void {
    this.stopAutoPlay();
    this.isTransitioning.set(true);
    this.currentIndex.set(index);
    this.startAutoPlay();
  }

  // Mouse drag
  onDragStart(event: MouseEvent): void {
    this.isDragging = true;
    this.startX = event.clientX;
    this.currentX = event.clientX;
    this.dragOffset.set(0);
    this.isTransitioning.set(false);
    this.stopAutoPlay();
  }

  onDragMove(event: MouseEvent): void {
    if (!this.isDragging) return;
    event.preventDefault();
    this.currentX = event.clientX;
    this.updateDragOffset();
  }

  onDragEnd(): void {
    if (!this.isDragging) return;
    this.isDragging = false;

    const container = this.carouselContainer?.nativeElement;
    if (!container) return;

    const containerWidth = container.offsetWidth;
    const cardWidth = containerWidth / this.visibleCards();
    const diff = this.currentX - this.startX;
    const threshold = cardWidth / 4;

    // Resetear el offset del drag
    this.dragOffset.set(0);
    this.isTransitioning.set(true);

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        this.prevSlide();
      } else {
        this.nextSlide();
      }
    }
    // Si no supera el threshold, la transición lo llevará de vuelta

    this.startAutoPlay();
  }

  // Touch events
  onTouchStart(event: TouchEvent): void {
    this.isDragging = true;
    this.startX = event.touches[0].clientX;
    this.currentX = event.touches[0].clientX;
    this.dragOffset.set(0);
    this.isTransitioning.set(false);
    this.stopAutoPlay();
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.isDragging) return;
    this.currentX = event.touches[0].clientX;
    this.updateDragOffset();
  }

  private updateDragOffset(): void {
    const container = this.carouselContainer?.nativeElement;
    if (!container) return;

    const containerWidth = container.offsetWidth;
    const diff = this.currentX - this.startX;
    // Convertir píxeles a porcentaje del contenedor
    const offsetPercent = (diff / containerWidth) * 100;
    this.dragOffset.set(offsetPercent);
  }

  // Obtener índice real para los indicadores (normalizado de 0 a length-1)
  protected getActiveIndex(): number {
    const total = this.featuredProducts().length;
    if (total === 0) return 0;
    const idx = this.currentIndex();
    return ((idx % total) + total) % total;
  }
}
