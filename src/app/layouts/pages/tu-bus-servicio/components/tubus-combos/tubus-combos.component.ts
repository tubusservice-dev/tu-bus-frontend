import { Component, DestroyRef, inject, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import {
  ProductService,
  ShowcaseProduct,
  ShowcaseAvailability,
} from '../../../../../core/services/product.service';
import { LocationService } from '../../../../../core/services/location.service';
import { OverlayStackService } from '../../../../../core/services/overlay-stack.service';
import { VehicleType, VEHICLE_TYPE_LABELS } from '../../../../../models/product.model';

interface FilterTab {
  id: string;
  label: string;
}

@Component({
  selector: 'app-tubus-combos',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './tubus-combos.component.html',
  styleUrl: './tubus-combos.component.scss',
})
export class TubusCombosComponent {
  private readonly productService = inject(ProductService);
  private readonly locationService = inject(LocationService);
  private readonly overlayService = inject(OverlayStackService);
  private readonly destroyRef = inject(DestroyRef);

  // Request queue for tab content — switchMap cancels in-flight requests
  // when the user clicks tabs quickly, so late responses can't clobber the UI.
  private readonly tabRequest$ = new Subject<string | null>();

  // Signals driving the view.
  protected readonly products = signal<ShowcaseProduct[]>([]);
  protected readonly selectedFilter = signal<string>('all');
  protected readonly isLoading = signal(true);
  protected readonly availability = signal<ShowcaseAvailability | null>(null);
  protected readonly skeletonItems = [1, 2, 3, 4];

  // All potential tabs, derived from the VehicleType enum (excluding ALL).
  private readonly allTabs: FilterTab[] = [
    { id: 'all', label: 'Todos' },
    ...Object.entries(VEHICLE_TYPE_LABELS)
      .filter(([key]) => key !== VehicleType.ALL)
      .map(([id, label]) => ({ id, label })),
  ];

  // Tabs actually shown — filtered by availability. While availability is
  // loading we expose only "Todos" to avoid flicker of empty tabs.
  protected readonly filters = computed<FilterTab[]>(() => {
    const map = this.availability();
    if (!map) return [this.allTabs[0]];
    return this.allTabs.filter(t => map[t.id]);
  });

  // "Ver todos" button is always visible per product requirement.
  protected readonly showViewAllButton = computed(() => true);

  constructor() {
    // Wire tab requests through switchMap so only the latest response wins.
    this.tabRequest$
      .pipe(
        switchMap(vt => {
          const branchIds = this.locationService.branchIds();
          const branchParam = branchIds.length > 0 ? branchIds.join(',') : undefined;
          return this.productService.getFeaturedShowcase(
            branchParam,
            vt || undefined
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.products.set(response.success ? response.data : []);
          this.isLoading.set(false);
        },
        error: () => {
          this.products.set([]);
          this.isLoading.set(false);
        },
      });

    // Re-evaluate availability + reload current tab whenever branches resolve
    // or change (e.g. user picks a different city).
    effect(() => {
      const resolved = this.locationService.isResolved();
      if (!resolved) return;
      // Depend on branchIds so location changes re-fire.
      this.locationService.branchIds();
      untracked(() => this.refresh());
    });
  }

  private refresh(): void {
    const branchIds = this.locationService.branchIds();
    const branchParam = branchIds.length > 0 ? branchIds.join(',') : undefined;

    this.isLoading.set(true);

    this.productService.getShowcaseAvailability(branchParam).subscribe({
      next: (response) => {
        const map = response.success ? response.data : { all: false };
        this.availability.set(map);

        // Keep the current selection if it's still available; otherwise
        // fall back to "Todos". If "Todos" itself is unavailable, leave
        // the component empty — the template will show its empty state.
        const current = this.selectedFilter();
        const nextFilter = map[current] ? current : 'all';
        if (nextFilter !== current) this.selectedFilter.set(nextFilter);

        if (map[nextFilter]) {
          this.fetchTab(nextFilter);
        } else {
          this.products.set([]);
          this.isLoading.set(false);
        }
      },
      error: () => {
        this.availability.set({ all: true });
        this.fetchTab(this.selectedFilter());
      },
    });
  }

  private fetchTab(filterId: string): void {
    this.isLoading.set(true);
    this.tabRequest$.next(filterId === 'all' ? null : filterId);
  }

  setFilter(filterId: string): void {
    if (filterId === this.selectedFilter()) return;
    this.selectedFilter.set(filterId);
    this.fetchTab(filterId);
  }

  openProductDetail(productId: string): void {
    this.overlayService.openProduct(productId);
  }

  formatPrice(price: number): string {
    return `$${price.toFixed(2)}`;
  }

  getVehicleTypes(product: ShowcaseProduct): string[] {
    const types = new Set<string>();
    for (const cat of product.categories) {
      for (const vt of cat.vehicleTypes) {
        if (vt === VehicleType.ALL) {
          return [VEHICLE_TYPE_LABELS[VehicleType.ALL]];
        }
        types.add(VEHICLE_TYPE_LABELS[vt] || vt);
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
