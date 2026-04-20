import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductService, ProductQueryParams } from '../../../../core/services/product.service';
import { BrandService } from '../../../../core/services/brand.service';
import { CategoryService } from '../../../../core/services/category.service';
import { SettingsService } from '../../../../core/services/settings.service';
import { BranchProductService } from '../../../../core/services/branch-product.service';
import { BranchProduct } from '../../../../models/branch-product.model';
import {
  Product,
  Line,
  Category,
  Brand,
  VehicleType,
  VEHICLE_TYPE_LABELS,
} from '../../../../models';
import { ImageCarouselComponent } from '../../../../shared/components/image-carousel/image-carousel.component';
import { SearchInputComponent } from '../../../../shared/components/search-input/search-input.component';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ImageCarouselComponent, SearchInputComponent],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.scss',
})
export class ProductListComponent implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly brandService = inject(BrandService);
  private readonly categoryService = inject(CategoryService);
  private readonly settingsService = inject(SettingsService);
  private readonly branchProductService = inject(BranchProductService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** True while a search is being processed */
  protected readonly isSearching = signal(false);

  // Datos
  protected readonly products = signal<Product[]>([]);
  protected readonly brands = signal<Brand[]>([]);
  protected readonly categories = signal<Category[]>([]);

  // Stock cache per product
  protected readonly productStockMap = signal<Map<string, number>>(new Map());

  // Estados
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  // Configuración de paginación
  protected readonly paginationConfig = this.settingsService.paginationConfig;
  private readonly adminLimit = this.paginationConfig().adminLimit || 20;

  // Paginación
  protected readonly currentPage = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly totalProducts = signal(0);
  protected readonly pageSize = signal(this.adminLimit);

  // Filtros
  protected readonly vehicleTypeOptions = Object.entries(VEHICLE_TYPE_LABELS)
    .filter(([key]) => key !== VehicleType.ALL)
    .map(([value, label]) => ({ value, label }));

  protected readonly filters = signal<ProductQueryParams>({
    page: 1,
    limit: this.adminLimit,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    vehicleType: undefined,
    brand: '',
    category: '',
  });


  // Producto a eliminar
  protected readonly productToDelete = signal<Product | null>(null);
  protected readonly isDeleting = signal(false);

  // Modal de detalles
  protected readonly selectedProduct = signal<Product | null>(null);
  protected readonly selectedImageIndex = signal(0);

  // Vista (cards o table)
  protected readonly viewMode = signal<'cards' | 'table'>('cards');

  ngOnInit(): void {
    // Restore page from URL
    const pageParam = this.route.snapshot.queryParamMap.get('page');
    if (pageParam) {
      const page = parseInt(pageParam, 10);
      if (page > 0) {
        this.currentPage.set(page);
        this.filters.update((f) => ({ ...f, page }));
      }
    }

    this.loadBrands();
    this.loadCategories();
    this.loadProducts();
  }

  /** Fired on every keystroke (pre-debounce) — lights the spinner */
  onSearchTyping(value: string): void {
    if (value !== this.filters().search) {
      this.isSearching.set(true);
    }
  }

  /** Fired after debounce — triggers the HTTP request */
  onSearchCommit(value: string): void {
    this.filters.update((f) => ({ ...f, search: value || undefined, page: 1 }));
    this.currentPage.set(1);
    this.loadProducts();
  }

  /**
   * Cargar marcas
   */
  loadBrands(): void {
    this.brandService.getAllAdmin().subscribe({
      next: (response) => {
        this.brands.set(response.data);
      },
      error: () => {},
    });
  }

  /**
   * Cargar categorías
   */
  loadCategories(): void {
    this.categoryService.getAllAdmin().subscribe({
      next: (response) => {
        this.categories.set(response.data);
      },
      error: () => {},
    });
  }

  /**
   * Cargar productos (usa ruta admin para incluir inactivos)
   */
  loadProducts(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.productService.getAllAdmin(this.filters()).subscribe({
      next: (response) => {
        this.products.set(response.data);
        this.totalProducts.set(response.pagination.total);
        this.totalPages.set(response.pagination.pages);
        this.currentPage.set(response.pagination.page);
        this.isLoading.set(false);
        this.isSearching.set(false);
        this.loadProductStocks(response.data);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al cargar productos');
        this.isLoading.set(false);
        this.isSearching.set(false);
      },
    });
  }

  /**
   * Aplicar filtros
   */
  applyFilters(): void {
    this.filters.update((f) => ({ ...f, page: 1 }));
    this.loadProducts();
  }

  /**
   * Limpiar filtros
   */
  clearFilters(): void {
    this.filters.set({
      page: 1,
      limit: this.adminLimit,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      vehicleType: undefined,
      brand: '',
      category: '',
    });
    this.loadProducts();
  }

  /**
   * Cambiar página
   */
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.filters.update((f) => ({ ...f, page }));
    this.syncPageToUrl(page);
    this.loadProducts();
  }

  private syncPageToUrl(page: number): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: page > 1 ? { page } : {},
      queryParamsHandling: page > 1 ? 'merge' : '',
      replaceUrl: false,
    });
  }

  /** Visible pages with ellipsis support: 1, 2, ..., 10 */
  get visiblePages(): (number | '...')[] {
    const total = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: (number | '...')[] = [1];
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  }

  /**
   * Actualizar filtro
   */
  updateFilter(key: keyof ProductQueryParams, value: any): void {
    this.filters.update((f) => ({ ...f, [key]: value || undefined }));
  }

  /**
   * Cambiar filtro y aplicar automáticamente
   */
  onFilterChange(key: keyof ProductQueryParams, value: any): void {
    this.filters.update((f) => ({ ...f, [key]: value || undefined, page: 1 }));
    this.loadProducts();
  }

  /**
   * Confirmar eliminación
   */
  confirmDelete(product: Product): void {
    this.productToDelete.set(product);
  }

  /**
   * Cancelar eliminación
   */
  cancelDelete(): void {
    this.productToDelete.set(null);
  }

  /**
   * Eliminar producto
   */
  deleteProduct(): void {
    const product = this.productToDelete();
    if (!product) return;

    this.isDeleting.set(true);

    this.productService.delete(product.id).subscribe({
      next: () => {
        this.products.update((list) => list.filter((p) => p.id !== product.id));
        this.productToDelete.set(null);
        this.isDeleting.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al eliminar producto');
        this.isDeleting.set(false);
      },
    });
  }

  /**
   * Obtener nombre de línea
   */
  getLineName(line: string | Line): string {
    if (typeof line === 'string') return line;
    return line?.name || 'Sin línea';
  }

  /**
   * Get total stock aggregated from BranchProducts
   */
  getTotalStock(product: Product): number {
    return this.productStockMap().get(product.id) || 0;
  }

  /**
   * Check if product has low stock (> 0 and <= 5)
   */
  isLowStock(product: Product): boolean {
    const total = this.getTotalStock(product);
    return total > 0 && total <= 5;
  }

  /**
   * Load stock totals for all products via BranchProduct aggregation
   */
  private loadProductStocks(products: Product[]): void {
    for (const product of products) {
      this.branchProductService.getByProduct(product.id).subscribe({
        next: (response) => {
          const total = response.data.reduce((sum: number, bp: BranchProduct) => sum + bp.stock, 0);
          this.productStockMap.update(map => {
            const newMap = new Map(map);
            newMap.set(product.id, total);
            return newMap;
          });
        },
        error: () => {},
      });
    }
  }

  /**
   * Get vehicle type labels from product's categories
   * Returns unique vehicle type labels (excludes 'all'), or null if none
   */
  getVehicleTypeLabel(product: Product): string | null {
    if (!product.categories?.length) return null;
    const types = new Set<string>();
    for (const cat of product.categories) {
      if (typeof cat !== 'string' && (cat as Category).vehicleTypes) {
        for (const vt of (cat as Category).vehicleTypes) {
          if (vt !== VehicleType.ALL) {
            types.add(VEHICLE_TYPE_LABELS[vt] || vt);
          }
        }
      }
    }
    if (types.size === 0) return null;
    return Array.from(types).slice(0, 2).join(', ');
  }

  /**
   * Obtener nombre de categoría
   */
  getCategoryName(category: string | Category): string {
    if (typeof category === 'string') {
      return category;
    }
    return category?.name || '';
  }

  /**
   * Obtener nombre de marca
   */
  getBrandName(brand: string | Brand | undefined): string {
    if (!brand) return '';
    if (typeof brand === 'string') {
      return brand;
    }
    return brand?.name || '';
  }

  /**
   * Abrir modal de detalles
   */
  openDetails(product: Product): void {
    this.selectedProduct.set(product);
    this.selectedImageIndex.set(0);
    document.body.style.overflow = 'hidden';
  }

  /**
   * Cerrar modal de detalles
   */
  closeDetails(): void {
    this.selectedProduct.set(null);
    this.selectedImageIndex.set(0);
    document.body.style.overflow = '';
  }

  /**
   * Seleccionar imagen del producto
   */
  selectImage(index: number): void {
    this.selectedImageIndex.set(index);
  }

  /**
   * Imagen anterior
   */
  prevImage(): void {
    const product = this.selectedProduct();
    if (!product) return;
    const total = product.images.length;
    const current = this.selectedImageIndex();
    this.selectedImageIndex.set(current === 0 ? total - 1 : current - 1);
  }

  /**
   * Imagen siguiente
   */
  nextImage(): void {
    const product = this.selectedProduct();
    if (!product) return;
    const total = product.images.length;
    const current = this.selectedImageIndex();
    this.selectedImageIndex.set(current === total - 1 ? 0 : current + 1);
  }

  /**
   * Obtener imagen seleccionada
   */
  getSelectedImage(): string {
    const product = this.selectedProduct();
    if (!product || product.images.length === 0) return '';
    return product.images[this.selectedImageIndex()];
  }

  /**
   * Verificar si el producto tiene descuento
   */
  hasDiscount(product: Product): boolean {
    return !!(product.comparePrice && product.comparePrice > product.price);
  }

  /**
   * Calcular porcentaje de descuento
   */
  getDiscountPercentage(product: Product): number {
    if (!product.comparePrice || product.comparePrice <= product.price) return 0;
    return Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100);
  }

}
