import { Component, inject, signal, computed, effect, DestroyRef } from '@angular/core';
import { SettingsService } from '../../../../../core/services/settings.service';

@Component({
  selector: 'app-tubus-hero-mobile-banner',
  standalone: true,
  imports: [],
  templateUrl: './tubus-hero-mobile-banner.component.html',
  styleUrl: './tubus-hero-mobile-banner.component.scss',
})
export class TubusHeroMobileBannerComponent {
  private readonly settingsService = inject(SettingsService);
  private readonly destroyRef = inject(DestroyRef);

  // First slide is the existing static mobile banner. Backend hero images follow.
  private static readonly FIRST_SLIDE = 'assets/img/banner-movil.jpg';

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private currentIdx = 0;

  protected readonly activeLayer = signal<0 | 1>(0);
  protected readonly layerSrc = signal<[string, string]>([
    TubusHeroMobileBannerComponent.FIRST_SLIDE,
    TubusHeroMobileBannerComponent.FIRST_SLIDE,
  ]);

  protected readonly bannerImages = computed<string[]>(() => {
    const remoteImages = [...(this.settingsService.heroImagesConfig().images || [])]
      .sort((a, b) => a.order - b.order)
      .map((img) => img.url);
    return [TubusHeroMobileBannerComponent.FIRST_SLIDE, ...remoteImages];
  });

  protected readonly carouselEnabled = computed(
    () => this.settingsService.heroImagesConfig().carousel.isEnabled,
  );

  protected readonly carouselInterval = computed(
    () => this.settingsService.heroImagesConfig().carousel.interval,
  );

  protected readonly hasMultipleImages = computed(() => this.bannerImages().length > 1);

  constructor() {
    // Reset to first slide whenever the image set changes (e.g. settings reload)
    effect(() => {
      const images = this.bannerImages();
      const src = images[0] ?? TubusHeroMobileBannerComponent.FIRST_SLIDE;
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

    this.destroyRef.onDestroy(() => this.stopAutoPlay());
  }

  private startAutoPlay(interval: number): void {
    this.intervalId = setInterval(() => this.advanceSlide(), interval);
  }

  private stopAutoPlay(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private advanceSlide(): void {
    const images = this.bannerImages();
    if (images.length <= 1) return;

    const nextIdx = (this.currentIdx + 1) % images.length;
    const nextSrc = images[nextIdx] ?? TubusHeroMobileBannerComponent.FIRST_SLIDE;
    const current = this.activeLayer();
    const inactiveLayer: 0 | 1 = current === 0 ? 1 : 0;

    this.layerSrc.update((layers) => {
      const copy: [string, string] = [...layers];
      copy[inactiveLayer] = nextSrc;
      return copy;
    });

    this.activeLayer.set(inactiveLayer);
    this.currentIdx = nextIdx;
  }
}
