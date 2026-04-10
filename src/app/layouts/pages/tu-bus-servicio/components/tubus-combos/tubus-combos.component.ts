import { Component, DestroyRef, inject, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, switchMap } from 'rxjs';
import { ProductService, ProductQueryParams } from '../../../../../core/services/product.service';
import { LocationService } from '../../../../../core/services/location.service';
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
  private readonly destroyRef = inject(DestroyRef);

  private readonly fetchTrigger$ = new Subject<ProductQueryParams>();

  // Signals
  protected readonly products = signal<Product[]>([]);
  protected readonly totalProducts = signal<number>(0);
  protected readonly selectedFilter = signal<string>('all');
  protected readonly isLoading = signal(true);

  // Whether we're in fallback mode (no featured products exist)
  private readonly useFallback = signal(false);
  private hasFeaturedChecked = false;

  // Computed: static filters from VehicleType enum
  protected readonly filters = computed(() => {
    const vehicleTypeFilters = Object.entries(VEHICLE_TYPE_LABELS)
      .filter(([key]) => key !== VehicleType.ALL)
      .map(([id, label]) => ({ id, label }));
    return [{ id: 'all', label: 'Todos' }, ...vehicleTypeFilters];
  });

  // Computed: show "view all" button based on backend total
  protected readonly showViewAllButton = computed(() => this.totalProducts() > 4);

  constructor() {
    // Single subscription with switchMap to cancel in-flight requests
    this.fetchTrigger$
      .pipe(
        switchMap(params => this.productService.getAll(params)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          if (response.success) {
            let data = response.data;
            const total = response.pagination?.total || data.length;

            // First load with "all" filter: check if featured products exist
            if (!this.hasFeaturedChecked && this.selectedFilter() === 'all') {
              this.hasFeaturedChecked = true;
              if (total === 0) {
                this.useFallback.set(true);
                this.loadProducts();
                return;
              }
            }

            // When a specific vehicleType filter is active, prioritize products
            // that actually match that type over generic "all" products
            const filter = this.selectedFilter();
            if (filter !== 'all') {
              const specific = data.filter(p => p.vehicleType === filter);
              if (specific.length >= 4) {
                data = specific.slice(0, 4);
              } else if (specific.length > 0) {
                // Fill remaining with generic products
                const generic = data.filter(p => p.vehicleType === 'all' || p.vehicleType !== filter);
                data = [...specific, ...generic].slice(0, 4);
              }
            }

            this.products.set(data);
            this.totalProducts.set(total);
          }
          this.isLoading.set(false);
        },
        error: () => {
          this.products.set([]);
          this.totalProducts.set(0);
          this.isLoading.set(false);
        },
      });

    // Reactive effect: triggers on location resolved OR filter change
    effect(() => {
      const resolved = this.locationService.isResolved();
      const filter = this.selectedFilter();

      if (!resolved) return;

      untracked(() => {
        this.isLoading.set(true);
        this.loadProducts();
      });
    });
  }

  private loadProducts(): void {
    const branchIds = this.locationService.branchIds();
    const filter = this.selectedFilter();

    const params: ProductQueryParams = {
      isActive: true,
      limit: filter !== 'all' ? 12 : 4,
      branchIds: branchIds.length > 0 ? branchIds.join(',') : undefined,
    };

    if (!this.useFallback()) {
      params.isFeatured = true;
    }

    if (filter !== 'all') {
      params.vehicleType = filter as VehicleType;
    }

    this.fetchTrigger$.next(params);
  }

  setFilter(filterId: string): void {
    this.selectedFilter.set(filterId);
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
