import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CategoryService } from '../../../../../core/services/category.service';
import { ProductService } from '../../../../../core/services/product.service';
import { ZoneService } from '../../../../../core/services/zone.service';
import { BranchService } from '../../../../../core/services/branch.service';
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
  private readonly zoneService = inject(ZoneService);
  private readonly branchService = inject(BranchService);

  // Signals para datos
  protected readonly categories = signal<Category[]>([]);
  protected readonly allProducts = signal<Product[]>([]);
  protected readonly totalProducts = signal<number>(0);
  protected readonly selectedFilter = signal<string>('all');
  protected readonly isLoading = signal(true);
  private readonly branchIds = signal<string[]>([]);
  private hasLoadedProducts = false;

  // Computed para filtros dinámicos (Todos + categorías)
  protected readonly filters = computed(() => {
    const baseFilter = [{ id: 'all', label: 'Todos' }];
    const categoryFilters = this.categories().map(cat => ({
      id: cat.id,
      label: cat.name
    }));
    return [...baseFilter, ...categoryFilters];
  });

  // Computed para productos filtrados por categoría (máximo 4)
  protected readonly filteredProducts = computed(() => {
    const filter = this.selectedFilter();
    const products = this.allProducts();

    let filtered: Product[];
    if (filter === 'all') {
      filtered = products;
    } else {
      filtered = products.filter(product =>
        product.categories.some(cat => {
          if (typeof cat === 'string') return cat === filter;
          return cat.id === filter;
        })
      );
    }

    return filtered.slice(0, 4);
  });

  // Computed para mostrar botón "Ver todo"
  protected readonly showViewAllButton = computed(() => {
    const filter = this.selectedFilter();
    const products = this.allProducts();

    if (filter === 'all') return products.length > 4;

    const filtered = products.filter(product =>
      product.categories.some(cat => {
        if (typeof cat === 'string') return cat === filter;
        return cat.id === filter;
      })
    );
    return filtered.length > 4;
  });

  constructor() {
    // Recargar productos cuando cambia la zona seleccionada
    effect(() => {
      const zone = this.zoneService.selectedZone();
      if (zone) {
        this.loadBranchesByZone(zone.city.code, zone.municipality.code);
      }
    });
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  private loadCategories(): void {
    this.categoryService.getAll().subscribe({
      next: (response) => {
        if (response.success) {
          this.categories.set(response.data);
        }
      },
      error: (err) => console.error('Error cargando categorías:', err)
    });
  }

  private loadBranchesByZone(cityCode: string, municipalityCode: string): void {
    this.isLoading.set(true);
    this.branchService.getByZone(cityCode, municipalityCode).subscribe({
      next: (response) => {
        if (response.success && response.data.length > 0) {
          const ids = response.data.map(b => b.id);
          this.branchIds.set(ids);
          this.loadProducts(ids);
        } else {
          this.branchIds.set([]);
          this.allProducts.set([]);
          this.isLoading.set(false);
        }
      },
      error: () => {
        this.branchIds.set([]);
        this.allProducts.set([]);
        this.isLoading.set(false);
      }
    });
  }

  private loadProducts(branchIds: string[]): void {
    this.productService.getAll({
      isFeatured: true,
      isActive: true,
      branchIds: branchIds.join(','),
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
