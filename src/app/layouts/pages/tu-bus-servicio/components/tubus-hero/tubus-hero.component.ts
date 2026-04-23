import { Component, inject, signal, computed, effect, DestroyRef } from '@angular/core';
import { Router } from '@angular/router';
import { HERO_CONTENT } from '../../data/mock-data';
import { SettingsService } from '../../../../../core/services/settings.service';
import { ReviewService } from '../../../../../core/services/review.service';
import { FloatingStat } from '../../../../../models/settings.model';

@Component({
  selector: 'app-tubus-hero',
  standalone: true,
  imports: [],
  templateUrl: './tubus-hero.component.html',
  styleUrl: './tubus-hero.component.scss'
})
export class TubusHeroComponent {
  private readonly router = inject(Router);
  private readonly settingsService = inject(SettingsService);
  private readonly reviewService = inject(ReviewService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly reviewsAverage = signal<number | null>(null);

  protected readonly hero = HERO_CONTENT;
  private static readonly FALLBACK_IMAGE = 'assets/img/promociones.jpg';

  private intervalId: ReturnType<typeof setInterval> | null = null;

  /**
   * activeLayer alternates between 0 and 1.
   * Layer 0 = bottom image, Layer 1 = top image.
   * The "active" layer is fully opaque; the other is transparent.
   * On each advance we:
   *   1. Set the NEXT image URL on the inactive layer (hidden, so no flash)
   *   2. Flip activeLayer → CSS transition fades the new layer in smoothly
   */
  protected readonly activeLayer = signal<0 | 1>(0);
  protected readonly layerSrc = signal<[string, string]>([
    TubusHeroComponent.FALLBACK_IMAGE,
    TubusHeroComponent.FALLBACK_IMAGE,
  ]);

  private currentIdx = 0;

  protected readonly floatingStats = computed(() => {
    const stats = this.settingsService.heroImagesConfig().floatingStats || [];
    return stats.map((s) => this.resolveStat(s));
  });

  protected readonly leftStat = computed(() => {
    return this.floatingStats().find((s) => s.position === 'left' && s.isVisible) || null;
  });

  protected readonly rightStat = computed(() => {
    return this.floatingStats().find((s) => s.position === 'right' && s.isVisible) || null;
  });

  /**
   * Resolves the display value for a stat. If the stat is sourced from reviews
   * and a live average is available, it overrides the manual value with the
   * numeric average (the template renders a golden star alongside).
   */
  private resolveStat(stat: FloatingStat): FloatingStat {
    if (stat.source === 'reviews_average') {
      const avg = this.reviewsAverage();
      if (avg !== null) {
        return { ...stat, value: avg.toFixed(1) };
      }
    }
    return stat;
  }

  /** Append "+" suffix only when the value doesn't already end with one,
   *  preventing "150++" when admins type "150+" in settings. */
  protected withPlus(value: string): string {
    const v = (value || '').trim();
    return v.endsWith('+') ? v : `${v}+`;
  }

  protected readonly heroImages = computed(() => {
    const config = this.settingsService.heroImagesConfig();
    const images = config.images || [];
    return [...images].sort((a, b) => a.order - b.order);
  });

  protected readonly carouselEnabled = computed(() => {
    return this.settingsService.heroImagesConfig().carousel.isEnabled;
  });

  protected readonly carouselInterval = computed(() => {
    return this.settingsService.heroImagesConfig().carousel.interval;
  });

  protected readonly hasMultipleImages = computed(() => {
    return this.heroImages().length > 1;
  });

  constructor() {
    // Initialize layer 0 with the first image
    effect(() => {
      const images = this.heroImages();
      const src = images.length > 0
        ? (images[0]?.url || TubusHeroComponent.FALLBACK_IMAGE)
        : TubusHeroComponent.FALLBACK_IMAGE;
      this.currentIdx = 0;
      this.activeLayer.set(0);
      this.layerSrc.set([src, src]);
    });

    // Auto-play control
    effect(() => {
      const enabled = this.carouselEnabled();
      const multiple = this.hasMultipleImages();
      const interval = this.carouselInterval();

      this.stopAutoPlay();

      if (enabled && multiple) {
        this.startAutoPlay(interval);
      }
    });

    this.destroyRef.onDestroy(() => {
      this.stopAutoPlay();
    });

    this.loadReviewsAverage();
  }

  private loadReviewsAverage(): void {
    const needsAverage = (this.settingsService.heroImagesConfig().floatingStats || [])
      .some((s) => s.source === 'reviews_average' && s.isVisible);
    if (!needsAverage) return;

    this.reviewService.getStats().subscribe({
      next: (stats) => {
        if (stats.count > 0 && stats.average !== null) {
          this.reviewsAverage.set(stats.average);
        }
      },
      error: () => {
        // Silent fallback — the manual value in settings remains visible.
      },
    });
  }

  private startAutoPlay(interval: number): void {
    this.intervalId = setInterval(() => {
      this.advanceSlide();
    }, interval);
  }

  private stopAutoPlay(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private advanceSlide(): void {
    const images = this.heroImages();
    if (images.length <= 1) return;

    const nextIdx = (this.currentIdx + 1) % images.length;
    const nextSrc = images[nextIdx]?.url || TubusHeroComponent.FALLBACK_IMAGE;
    const current = this.activeLayer();
    const inactiveLayer: 0 | 1 = current === 0 ? 1 : 0;

    // 1. Paint the next image on the HIDDEN (inactive) layer
    this.layerSrc.update((layers) => {
      const copy: [string, string] = [...layers];
      copy[inactiveLayer] = nextSrc;
      return copy;
    });

    // 2. Flip active layer → CSS opacity transition does the crossfade
    this.activeLayer.set(inactiveLayer);
    this.currentIdx = nextIdx;
  }

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
