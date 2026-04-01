import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CategoryService } from '../../../../../core/services/category.service';
import { ProductService } from '../../../../../core/services/product.service';
import { LocationService } from '../../../../../core/services/location.service';
import { Category, Product } from '../../../../../models/product.model';

@Component({
  selector: 'app-tubus-combos',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './tubus-combos.component.html',
  styleUrl: './tubus-combos.component.scss'
})
export class TubusCombosComponent implements OnInit {
  private readonly categoryService = inject(CategoryService);
  private readonly productService = inject(ProductService);
  private readonly locationService = inject(LocationService);

  // Signals
  protected readonly categories = signal<Category[]>([]);
  protected readonly allProducts = signal<Product[]>([]);
  protected readonly totalProducts = signal<number>(0);
  protected readonly selectedFilter = signal<string>('all');
  protected readonly isLoading = signal(true);

  // Computed: dynamic filters (All + categories)
  protected readonly filters = computed(() => {
    const baseFilter = [{ id: 'all', label: 'Todos' }];
    const categoryFilters = this.categories().map(cat => ({
      id: cat.id,
      label: cat.name
    }));
    return [...baseFilter, ...categoryFilters];
  });

  // Computed: filtered products by category (max 4)
  protected readonly filteredProducts = computed(() => {
    const filter = this.selectedFilter();
    const products = this.allProducts();

    if (filter === 'all') return products.slice(0, 4);

    return products.filter(product =>
      product.categories.some(cat => this.matchCategory(cat, filter))
    ).slice(0, 4);
  });

  // Computed: show "view all" button
  protected readonly showViewAllButton = computed(() => {
    const filter = this.selectedFilter();
    const products = this.allProducts();

    if (filter === 'all') return products.length > 4;

    return products.filter(product =>
      product.categories.some(cat => this.matchCategory(cat, filter))
    ).length > 4;
  });

  /** Match a category (string ID, or object with id/_id) against a filter ID */
  private matchCategory(cat: string | Category | any, filterId: string): boolean {
    if (typeof cat === 'string') return cat === filterId;
    return cat.id === filterId || cat._id === filterId || cat.slug === filterId;
  }

  private initialLoadDone = false;

  constructor() {
    // Wait for LocationService to resolve before loading products
    effect(() => {
      const resolved = this.locationService.isResolved();
      if (resolved && !this.initialLoadDone) {
        this.initialLoadDone = true;
        this.loadFeaturedProducts();
      }
    });
  }

  ngOnInit(): void {
    this.loadCategories();

    // If already resolved, load immediately
    if (this.locationService.isResolved() && !this.initialLoadDone) {
      this.initialLoadDone = true;
      this.loadFeaturedProducts();
    }
  }

  private loadCategories(): void {
    this.categoryService.getAll().subscribe({
      next: (response) => {
        if (response.success) {
          this.categories.set(response.data);
        }
      },
      error: (err) => console.error('Error cargando categorias:', err)
    });
  }

  private loadFeaturedProducts(): void {
    const branchIds = this.locationService.branchIds();

    this.productService.getAll({
      isFeatured: true,
      isActive: true,
      branchIds: branchIds.length > 0 ? branchIds.join(',') : undefined,
      limit: 50,
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.allProducts.set(response.data);
          this.totalProducts.set(response.pagination?.total || response.data.length);
        }
        this.isLoading.set(false);
      },
      error: () => {
        this.allProducts.set([]);
        this.isLoading.set(false);
      }
    });
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
