import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CategoryService } from '../../../../../core/services/category.service';
import { ProductService } from '../../../../../core/services/product.service';
import { ZoneService } from '../../../../../core/services/zone.service';
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

  // Signals para datos
  protected readonly categories = signal<Category[]>([]);
  private readonly allProducts = signal<Product[]>([]);
  protected readonly products = computed(() => this.filterByZone(this.allProducts()));
  protected readonly totalCombos = signal<number>(0);
  protected readonly selectedFilter = signal<string>('all');
  protected readonly isLoading = signal(true);

  // Computed para mostrar botón "Ver todo"
  protected readonly showViewAllButton = computed(() => this.totalCombos() > 4);

  // Computed para filtros dinámicos (Todos + categorías del backend)
  protected readonly filters = computed(() => {
    const baseFilter = [{ id: 'all', label: 'Todos' }];
    const categoryFilters = this.categories().map(cat => ({
      id: cat.id,
      label: cat.name
    }));
    return [...baseFilter, ...categoryFilters];
  });

  // Computed para productos filtrados
  protected readonly filteredProducts = computed(() => {
    const filter = this.selectedFilter();
    const allProducts = this.products();

    if (filter === 'all') {
      return allProducts;
    }

    // Filtrar por categoría seleccionada
    return allProducts.filter(product =>
      product.categories.some(cat => {
        if (typeof cat === 'string') {
          return cat === filter;
        }
        return cat.id === filter;
      })
    );
  });

  ngOnInit(): void {
    this.loadData();
  }

  private loadData(): void {
    this.isLoading.set(true);

    // Cargar categorías
    this.categoryService.getAll().subscribe({
      next: (response) => {
        if (response.success) {
          this.categories.set(response.data);
        }
      },
      error: (err) => console.error('Error cargando categorías:', err)
    });

    // Cargar productos (combos destacados, límite 4)
    this.productService.getAll({
      isCombo: true,
      isFeatured: true,
      isActive: true,
      limit: 4,
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.allProducts.set(response.data);
          this.totalCombos.set(response.pagination?.total || response.data.length);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('Error cargando productos:', err);
        this.isLoading.set(false);
      }
    });
  }

  private filterByZone(products: Product[]): Product[] {
    const zone = this.zoneService.selectedZone();
    if (!zone) return products;

    return products.filter(product => {
      if (product.allRegions) return true;
      if (!product.regions || product.regions.length === 0) return true;

      return product.regions.some(r => {
        const cityId = typeof r.city === 'string' ? r.city : r.city?.id;
        return cityId === zone.city.id && r.municipalityCode === zone.municipality.code;
      });
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
