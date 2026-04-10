import { Component, DestroyRef, inject, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProductService } from '../../../../../core/services/product.service';
import { LocationService } from '../../../../../core/services/location.service';
import { ProductDetailOverlayService } from '../../../../../core/services/product-detail-overlay.service';
import { Product, VehicleType, VEHICLE_TYPE_LABELS } from '../../../../../models/product.model';

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

  // All products fetched once
  private allProducts: Product[] = [];

  // Signals
  protected readonly products = signal<Product[]>([]);
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

      untracked(() => this.fetchAllProducts());
    });

    // Re-filter locally when filter changes (no new API call)
    effect(() => {
      const filter = this.selectedFilter();
      // Only apply if products already loaded
      if (this.allProducts.length > 0) {
        untracked(() => this.applyFilter(filter));
      }
    });
  }

  private fetchAllProducts(): void {
    this.isLoading.set(true);
    const branchIds = this.locationService.branchIds();

    // First try featured products
    this.productService.getAll({
      isActive: true,
      isFeatured: true,
      limit: 50,
      branchIds: branchIds.length > 0 ? branchIds.join(',') : undefined,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (response.success && response.data.length > 0) {
          this.allProducts = this.deduplicate(response.data);
          this.applyFilter(this.selectedFilter());
          this.isLoading.set(false);
        } else {
          // No featured — fallback: fetch all active products
          this.fetchFallbackProducts(branchIds);
        }
      },
      error: () => {
        this.fetchFallbackProducts(branchIds);
      },
    });
  }

  private fetchFallbackProducts(branchIds: string[]): void {
    this.productService.getAll({
      isActive: true,
      limit: 50,
      branchIds: branchIds.length > 0 ? branchIds.join(',') : undefined,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        if (response.success) {
          this.allProducts = this.shuffle(this.deduplicate(response.data));
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
    let filtered: Product[];

    if (filter === 'all') {
      filtered = this.allProducts;
    } else {
      // Products specifically for this vehicle type
      const specific = this.allProducts.filter(p => p.vehicleType === filter);
      // Products for all vehicle types
      const generic = this.allProducts.filter(p => p.vehicleType === 'all');
      // Prioritize specific, fill with generic, no duplicates
      const seen = new Set<string>();
      filtered = [];
      for (const p of [...specific, ...generic]) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          filtered.push(p);
        }
      }
    }

    this.products.set(filtered.slice(0, 4));
  }

  private deduplicate(products: Product[]): Product[] {
    const seen = new Set<string>();
    return products.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }

  /** Fisher-Yates shuffle */
  private shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
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

  getDiscount(product: Product): number {
    if (product.comparePrice && product.comparePrice > product.price) {
      return Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100);
    }
    return 0;
  }

  getProductImage(product: Product): string {
    return product.images?.[0] || '';
  }
}
