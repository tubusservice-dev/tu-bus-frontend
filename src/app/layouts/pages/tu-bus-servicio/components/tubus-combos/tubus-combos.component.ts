import { Component, DestroyRef, inject, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProductService, ShowcaseProduct } from '../../../../../core/services/product.service';
import { LocationService } from '../../../../../core/services/location.service';
import { ProductDetailOverlayService } from '../../../../../core/services/product-detail-overlay.service';
import { VehicleType, VEHICLE_TYPE_LABELS } from '../../../../../models/product.model';

@Component({
  selector: 'app-tubus-combos',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './tubus-combos.component.html',
  styleUrl: './tubus-combos.component.scss'
})
export class TubusCombosComponent {
  private readonly productService = inject(ProductService);
  private readonly locationService = inject(LocationService);
  private readonly overlayService = inject(ProductDetailOverlayService);
  private readonly destroyRef = inject(DestroyRef);

  // All products fetched once (lightweight format)
  private allProducts: ShowcaseProduct[] = [];

  // Signals
  protected readonly products = signal<ShowcaseProduct[]>([]);
  protected readonly selectedFilter = signal<string>('all');
  protected readonly isLoading = signal(true);

  protected readonly filters = computed(() => {
    const vehicleTypeFilters = Object.entries(VEHICLE_TYPE_LABELS)
      .filter(([key]) => key !== VehicleType.ALL)
      .map(([id, label]) => ({ id, label }));
    return [{ id: 'all', label: 'Todos' }, ...vehicleTypeFilters];
  });

  protected readonly showViewAllButton = computed(() => this.allProducts.length > 4);

  constructor() {
    // Load once when location resolves
    effect(() => {
      const resolved = this.locationService.isResolved();
      if (!resolved) return;

      untracked(() => this.fetchProducts());
    });

    // Re-filter locally when filter changes (no new API call)
    effect(() => {
      const filter = this.selectedFilter();
      if (this.allProducts.length > 0) {
        untracked(() => this.applyFilter(filter));
      }
    });
  }

  private fetchProducts(): void {
    this.isLoading.set(true);
    const branchIds = this.locationService.branchIds();

    this.productService.getFeaturedShowcase(
      branchIds.length > 0 ? branchIds.join(',') : undefined
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (response.success) {
          this.allProducts = response.data;
        }
        this.applyFilter(this.selectedFilter());
        this.isLoading.set(false);
      },
      error: () => {
        this.allProducts = [];
        this.products.set([]);
        this.isLoading.set(false);
      },
    });
  }

  private applyFilter(filter: string): void {
    let filtered: ShowcaseProduct[];

    if (filter === 'all') {
      filtered = [...this.allProducts];
    } else {
      // Products whose categories include this vehicle type
      const specific = this.allProducts.filter(p => this.matchesVehicleType(p, filter));
      // Products without categories are universal (valid for all)
      const universal = this.allProducts.filter(p => p.categories.length === 0);
      // Prioritize specific, fill with universal, no duplicates
      const seen = new Set<string>();
      filtered = [];
      for (const p of [...specific, ...universal]) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          filtered.push(p);
        }
      }
    }

    // Shuffle before slicing so each filter shows different products
    this.shuffle(filtered);
    this.products.set(filtered.slice(0, 4));
  }

  private shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  private matchesVehicleType(product: ShowcaseProduct, vehicleType: string): boolean {
    return product.categories.some(cat =>
      cat.vehicleTypes?.includes(vehicleType as VehicleType)
    );
  }

  setFilter(filterId: string): void {
    this.selectedFilter.set(filterId);
  }

  openProductDetail(productId: string): void {
    this.overlayService.open(productId);
  }

  formatPrice(price: number): string {
    return `$${price.toFixed(2)}`;
  }

  getVehicleTypes(product: ShowcaseProduct): string[] {
    const types = new Set<string>();
    for (const cat of product.categories) {
      for (const vt of cat.vehicleTypes) {
        if (vt !== VehicleType.ALL) {
          types.add(VEHICLE_TYPE_LABELS[vt] || vt);
        }
      }
    }
    return Array.from(types).slice(0, 3);
  }

  getDiscount(product: ShowcaseProduct): number {
    if (product.comparePrice && product.comparePrice > product.price) {
      return Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100);
    }
    return 0;
  }
}
