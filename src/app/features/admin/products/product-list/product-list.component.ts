import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductService, ProductQueryParams } from '../../../../core/services/product.service';
import { BrandService } from '../../../../core/services/brand.service';
import { CategoryService } from '../../../../core/services/category.service';
import { SettingsService } from '../../../../core/services/settings.service';
import { BranchProductService } from '../../../../core/services/branch-product.service';
import { BranchService } from '../../../../core/services/branch.service';
import { BranchProduct } from '../../../../models/branch-product.model';
import { Branch } from '../../../../models/branch.model';
import { AdminProductByBranchRow } from '../../../../models/admin-product-by-branch.model';
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
import { BodyScrollLockService } from '../../../../shared/services/body-scroll-lock.service';
import { StockModalComponent } from '../stock-modal/stock-modal.component';
import { BranchStockModalComponent } from '../branch-stock-modal/branch-stock-modal.component';
import {
  IMAGE_PLACEHOLDER_DATA_URL,
  onImageError,
} from '../../../../shared/utils/image-placeholder.util';

type BranchScope = 'all' | 'none' | string;

interface StockModalState {
  productName: string;
  branchName: string | null;
  currentStock: number;
  branchProductId: string | null;
  rowId: string;
}

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    ImageCarouselComponent,
    SearchInputComponent,
    StockModalComponent,
    BranchStockModalComponent,
  ],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.scss',
})
export class ProductListComponent implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly brandService = inject(BrandService);
  private readonly categoryService = inject(CategoryService);
  private readonly settingsService = inject(SettingsService);
  private readonly branchProductService = inject(BranchProductService);
  private readonly branchService = inject(BranchService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly scrollLock = inject(BodyScrollLockService);

  /** True while a search is being processed */
  protected readonly isSearching = signal(false);

  // Datos compartidos
  protected readonly products = signal<Product[]>([]);
  protected readonly brands = signal<Brand[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly branches = signal<Branch[]>([]);

  // Imagen placeholder (para vista tabla)
  protected readonly imagePlaceholder = IMAGE_PLACEHOLDER_DATA_URL;
  protected readonly handleImageError = onImageError;

  // Vista de tabla — productos contextualizados al filtro de sucursal
  protected readonly tableRows = signal<AdminProductByBranchRow[]>([]);

  // Filtro de sucursal (vista tabla). 'all' | 'none' | <branchId>.
  protected readonly branchFilter = signal<BranchScope>('all');

  // Estado del modal de stock (vista tabla).
  protected readonly stockModalState = signal<StockModalState | null>(null);

  // Cascading filter: only categories compatible with the selected vehicleType
  // (or universal categories tagged with VehicleType.ALL) appear in the dropdown.
  protected readonly filteredCategories = computed(() => {
    const selectedVehicleType = this.filters().vehicleType;
    const allCats = this.categories();
    if (!selectedVehicleType) return allCats;
    return allCats.filter(cat =>
      cat.vehicleTypes?.includes(selectedVehicleType as VehicleType) ||
      cat.vehicleTypes?.includes(VehicleType.ALL)
    );
  });

  // Stock cache per product (vista cards, legacy)
  protected readonly productStockMap = signal<Map<string, number>>(new Map());

  // Estados
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  // Paginación
  protected readonly paginationConfig = this.settingsService.paginationConfig;
  private readonly adminLimit = this.paginationConfig().adminLimit || 20;
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

  // Modal de detalles (vista cards) — viewer-only
  protected readonly selectedProduct = signal<Product | null>(null);
  protected readonly selectedImageIndex = signal(0);

  // ─── Standalone Branch+Stock modal trigger state ─────────────────
  // When set, the <app-branch-stock-modal> at the end of the template
  // renders for that product. Setter is `openBranchStockModal(product)`,
  // wired to whatever entry point the admin chooses (TBD).
  protected readonly branchStockModalProduct = signal<{ id: string; name: string } | null>(null);

  // Vista (cards o table)
  protected readonly viewMode = signal<'cards' | 'table'>('cards');

  /** Header dinámico de la columna stock (vista tabla). */
  protected readonly stockColumnLabel = computed(() => {
    const scope = this.branchFilter();
    if (scope === 'all') return 'Stock total';
    if (scope === 'none') return 'Stock';
    const branch = this.branches().find(b => b.id === scope);
    return branch ? `Stock ${branch.name}` : 'Stock';
  });

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
    this.loadBranches();
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
    this.loadActiveView();
  }

  loadBrands(): void {
    this.brandService.getAllAdmin().subscribe({
      next: (response) => this.brands.set(response.data),
      error: () => {},
    });
  }

  loadCategories(): void {
    this.categoryService.getAllAdmin().subscribe({
      next: (response) => this.categories.set(response.data),
      error: () => {},
    });
  }

  loadBranches(): void {
    this.branchService.getAll().subscribe({
      next: (response) => this.branches.set(response.data),
      error: () => {},
    });
  }

  /** Cards view (legacy). Uses the existing /admin/products endpoint. */
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

  /** Table view. Uses the new /admin/products/by-branch endpoint. */
  loadTableProducts(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const f = this.filters();
    this.productService
      .getAllByBranch({
        branchId: this.branchFilter(),
        page: f.page,
        limit: f.limit,
        search: f.search,
        vehicleType: f.vehicleType,
        brand: f.brand,
        category: f.category,
        sortBy: f.sortBy,
        sortOrder: f.sortOrder,
      })
      .subscribe({
        next: (response) => {
          this.tableRows.set(response.data);
          this.totalProducts.set(response.pagination.total);
          this.totalPages.set(response.pagination.pages);
          this.currentPage.set(response.pagination.page);
          this.isLoading.set(false);
          this.isSearching.set(false);
        },
        error: (error) => {
          this.errorMessage.set(
            error.error?.message || 'Error al cargar productos'
          );
          this.isLoading.set(false);
          this.isSearching.set(false);
        },
      });
  }

  /** Single entry point that dispatches to the active view loader. */
  protected loadActiveView(): void {
    if (this.viewMode() === 'table') {
      this.loadTableProducts();
    } else {
      this.loadProducts();
    }
  }

  setViewMode(mode: 'cards' | 'table'): void {
    if (this.viewMode() === mode) return;
    this.viewMode.set(mode);
    this.filters.update((f) => ({ ...f, page: 1 }));
    this.currentPage.set(1);
    this.loadActiveView();
  }

  applyFilters(): void {
    this.filters.update((f) => ({ ...f, page: 1 }));
    this.loadActiveView();
  }

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
    this.branchFilter.set('all');
    this.loadActiveView();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.filters.update((f) => ({ ...f, page }));
    this.syncPageToUrl(page);
    this.loadActiveView();
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

  updateFilter(key: keyof ProductQueryParams, value: any): void {
    this.filters.update((f) => ({ ...f, [key]: value || undefined }));
  }

  onFilterChange(key: keyof ProductQueryParams, value: any): void {
    this.filters.update((f) => {
      const updated: ProductQueryParams = { ...f, [key]: value || undefined, page: 1 };

      if (key === 'vehicleType') {
        const selectedCat = this.categories().find(c => c.id === f.category);
        if (selectedCat && value) {
          const catMatches =
            selectedCat.vehicleTypes?.includes(value as VehicleType) ||
            selectedCat.vehicleTypes?.includes(VehicleType.ALL);
          if (!catMatches) updated.category = '';
        }
      }

      return updated;
    });
    this.currentPage.set(1);
    this.loadActiveView();
  }

  /** Branch filter (table view only). */
  onBranchFilterChange(value: string): void {
    this.branchFilter.set((value || 'all') as BranchScope);
    this.filters.update((f) => ({ ...f, page: 1 }));
    this.currentPage.set(1);
    this.loadTableProducts();
  }

  // ==================== Eliminar ====================

  confirmDelete(product: Product | AdminProductByBranchRow): void {
    this.productToDelete.set(product as Product);
  }

  cancelDelete(): void {
    this.productToDelete.set(null);
  }

  deleteProduct(): void {
    const product = this.productToDelete();
    if (!product) return;

    this.isDeleting.set(true);

    this.productService.delete(product.id).subscribe({
      next: () => {
        this.products.update((list) => list.filter((p) => p.id !== product.id));
        this.tableRows.update((list) => list.filter((r) => r.id !== product.id));
        this.productToDelete.set(null);
        this.isDeleting.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al eliminar producto');
        this.isDeleting.set(false);
      },
    });
  }

  // ==================== Helpers de presentación ====================

  getLineName(line: string | Line): string {
    if (typeof line === 'string') return line;
    return line?.name || 'Sin línea';
  }

  /** Total stock from BranchProducts (vista cards). */
  getTotalStock(product: Product): number {
    return this.productStockMap().get(product.id) || 0;
  }

  isLowStock(product: Product): boolean {
    const total = this.getTotalStock(product);
    return total > 0 && total <= 5;
  }

  isLowStockRow(row: AdminProductByBranchRow): boolean {
    return row.branchStock > 0 && row.branchStock <= 5;
  }

  /** Vista cards: legacy N+1 stock loader. */
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

  getVehicleTypeLabel(product: Product | AdminProductByBranchRow): string | null {
    if (!product.categories?.length) return null;
    const types = new Set<string>();
    for (const cat of product.categories as any[]) {
      if (typeof cat !== 'string' && cat?.vehicleTypes) {
        for (const vt of cat.vehicleTypes) {
          if (vt !== VehicleType.ALL) {
            types.add(VEHICLE_TYPE_LABELS[vt as VehicleType] || vt);
          }
        }
      }
    }
    if (types.size === 0) return null;
    return Array.from(types).slice(0, 2).join(', ');
  }

  getCategoryName(category: string | Category | { name: string }): string {
    if (typeof category === 'string') return category;
    return (category as { name: string })?.name || '';
  }

  getBrandName(brand: string | Brand | { name: string } | null | undefined): string {
    if (!brand) return '';
    if (typeof brand === 'string') return brand;
    return (brand as { name: string })?.name || '';
  }

  // ==================== Modal de detalles (vista cards) ====================

  openDetails(product: Product): void {
    this.selectedProduct.set(product);
    this.selectedImageIndex.set(0);
    this.scrollLock.lock();
  }

  closeDetails(): void {
    this.selectedProduct.set(null);
    this.selectedImageIndex.set(0);
    this.scrollLock.unlock();
  }

  // ==================== Standalone branch-stock modal ====================

  /**
   * Open the standalone branch-stock modal for a product. The trigger
   * (button, link, etc.) is pluggable — invoke from wherever the admin
   * needs quick access to a product's per-branch inventory.
   */
  openBranchStockModal(product: Product): void {
    this.branchStockModalProduct.set({ id: product.id, name: product.name });
  }

  closeBranchStockModal(): void {
    this.branchStockModalProduct.set(null);
  }

  /**
   * Triggered when the standalone modal reports a successful save.
   * Refresh the cached stock for that product so the cards grid shows
   * the new total without a full reload.
   */
  onBranchStockSaved(): void {
    const ctx = this.branchStockModalProduct();
    if (!ctx) return;
    this.refreshStockForProduct(ctx.id);
  }

  /** Re-fetch BranchProducts for a single product and update the cache map. */
  private refreshStockForProduct(productId: string): void {
    this.branchProductService.getByProduct(productId).subscribe({
      next: (response) => {
        const total = response.data
          .filter((bp) => bp.isActive)
          .reduce((sum, bp) => sum + bp.stock, 0);
        this.productStockMap.update((map) => {
          const next = new Map(map);
          next.set(productId, total);
          return next;
        });
      },
      error: () => {},
    });
  }

  selectImage(index: number): void {
    this.selectedImageIndex.set(index);
  }

  prevImage(): void {
    const product = this.selectedProduct();
    if (!product) return;
    const total = product.images.length;
    const current = this.selectedImageIndex();
    this.selectedImageIndex.set(current === 0 ? total - 1 : current - 1);
  }

  nextImage(): void {
    const product = this.selectedProduct();
    if (!product) return;
    const total = product.images.length;
    const current = this.selectedImageIndex();
    this.selectedImageIndex.set(current === total - 1 ? 0 : current + 1);
  }

  getSelectedImage(): string {
    const product = this.selectedProduct();
    if (!product || product.images.length === 0) return '';
    return product.images[this.selectedImageIndex()];
  }

  hasDiscount(product: Product): boolean {
    return !!(product.comparePrice && product.comparePrice > product.price);
  }

  getDiscountPercentage(product: Product): number {
    if (!product.comparePrice || product.comparePrice <= product.price) return 0;
    return Math.round(((product.comparePrice - product.price) / product.comparePrice) * 100);
  }

  // ==================== Vista tabla — modal de stock ====================

  /** Click on a table row decides between modal, navigation, or no-op. */
  onTableRowClick(row: AdminProductByBranchRow): void {
    const scope = this.branchFilter();

    if (scope === 'none') {
      this.router.navigate(['/admin/products/edit', row.id]);
      return;
    }

    const branchName =
      scope === 'all'
        ? null
        : this.branches().find(b => b.id === scope)?.name || row.branchName || null;

    this.stockModalState.set({
      productName: row.name,
      branchName,
      currentStock: row.branchStock,
      branchProductId: row.branchProductId || null,
      rowId: row.id,
    });
    this.scrollLock.lock();
  }

  closeStockModal(): void {
    this.stockModalState.set(null);
    this.scrollLock.unlock();
  }

  onStockUpdated(newStock: number): void {
    const state = this.stockModalState();
    if (state) {
      this.tableRows.update(rows =>
        rows.map(r =>
          r.id === state.rowId ? { ...r, branchStock: newStock } : r
        )
      );
    }
    this.closeStockModal();
  }
}
