import { Component, DestroyRef, inject, signal, OnInit, computed, HostListener, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProductService } from '../../core/services/product.service';
import { BrandService } from '../../core/services/brand.service';
import { CategoryService } from '../../core/services/category.service';
import { SettingsService } from '../../core/services/settings.service';
import { VehicleService } from '../../core/services/vehicle.service';
import { LocationService } from '../../core/services/location.service';
import { ProductCardComponent, ProductCardData } from '../../shared/components/product-card/product-card.component';
import {
  Product,
  Brand,
  Category,
  VehicleType,
  VEHICLE_TYPE_LABELS,
} from '../../models';
import { PAGINATION_OPTIONS } from '../../models/settings.model';

interface FilterState {
  search: string;
  vehicleType: string;
  brand: string;
  category: string;
  sortBy: string;
}

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductCardComponent],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.scss',
})
export class CatalogComponent implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly brandService = inject(BrandService);
  private readonly categoryService = inject(CategoryService);
  private readonly settingsService = inject(SettingsService);

  protected readonly vehicleService = inject(VehicleService);
  protected readonly locationService = inject(LocationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly searchSubject$ = new Subject<string>();

  // Vehicle type filter options (exclude 'all' from dropdown)
  protected readonly vehicleTypeOptions = Object.entries(VEHICLE_TYPE_LABELS)
    .filter(([key]) => key !== VehicleType.ALL)
    .map(([value, label]) => ({ value, label }));

  // Vehicle filter from garage
  protected readonly vehicleFilterActive = signal(false);

  // Tracks whether initial product load has been triggered
  private initialLoadDone = false;

  // Estado
  protected readonly isLoading = signal(true);
  private readonly allProducts = signal<ProductCardData[]>([]);
  protected readonly products = computed(() => {
    let filtered = this.allProducts();
    if (this.vehicleFilterActive()) {
      filtered = this.filterByVehicle(filtered);
    }
    return filtered;
  });
  protected readonly showFilters = signal(false);

  // Datos cargados del backend
  protected readonly brands = signal<Brand[]>([]);
  protected readonly categories = signal<Category[]>([]);

  // Categorías filtradas por vehicleType seleccionado (cascading filter).
  // Las categorías universales (vehicleTypes incluye VehicleType.ALL) se
  // muestran siempre porque aplican a cualquier tipo de vehículo.
  protected readonly filteredCategories = computed(() => {
    const selectedVehicleType = this.filters().vehicleType;
    const allCats = this.categories();

    if (!selectedVehicleType) {
      return allCats;
    }

    return allCats.filter(cat =>
      cat.vehicleTypes?.includes(selectedVehicleType as VehicleType) ||
      cat.vehicleTypes?.includes(VehicleType.ALL)
    );
  });

  // Configuración de paginación
  protected readonly paginationConfig = this.settingsService.paginationConfig;
  protected readonly paginationOptions = PAGINATION_OPTIONS;
  protected readonly currentLimit = signal(this.settingsService.paginationConfig().catalogLimit || 20);

  // Filtros
  protected readonly filters = signal<FilterState>({
    search: '',
    vehicleType: '',
    brand: '',
    category: '',
    sortBy: 'createdAt',
  });

  // Paginación
  protected readonly currentPage = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly totalProducts = signal(0);
  protected readonly showScrollTop = signal(false);

  @HostListener('window:scroll')
  onScroll(): void {
    this.showScrollTop.set(window.scrollY > 400);
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  protected readonly sortOptions = [
    { value: 'createdAt', label: 'Más recientes' },
    { value: 'price', label: 'Precio: Menor a mayor' },
    { value: 'price_desc', label: 'Precio: Mayor a menor' },
    { value: 'name', label: 'Nombre: A-Z' },
  ];

  // Filtros activos
  protected readonly activeFiltersCount = computed(() => {
    const f = this.filters();
    let count = 0;
    if (f.vehicleType) count++;
    if (f.brand) count++;
    if (f.category) count++;
    return count;
  });

  constructor() {
    // Wait for LocationService to resolve before loading products.
    effect(() => {
      const resolved = this.locationService.isResolved();
      if (resolved && !this.initialLoadDone) {
        this.initialLoadDone = true;
        this.loadProducts();
      }
    });
  }

  ngOnInit(): void {
    this.searchSubject$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((value) => {
        this.filters.update((f) => ({ ...f, search: value }));
        this.currentPage.set(1);
        this.loadProducts();
      });

    // Restore page from URL query params (browser back button support)
    const pageParam = this.route.snapshot.queryParamMap.get('page');
    if (pageParam) {
      const page = parseInt(pageParam, 10);
      if (page > 0) this.currentPage.set(page);
    }

    // Pre-select vehicleType from query params (e.g. from landing page "Ver todos")
    const vtParam = this.route.snapshot.queryParamMap.get('vehicleType');
    if (vtParam) {
      this.filters.update(f => ({ ...f, vehicleType: vtParam }));
      this.showFilters.set(true);
    }

    // Activate vehicle filter if navigating from garage
    const fromGarage = this.route.snapshot.queryParamMap.get('fromGarage');
    if (fromGarage === 'true' && this.vehicleService.selectedVehicle()) {
      this.vehicleFilterActive.set(true);
    }

    this.loadBrands();
    this.loadCategories();

    // If location is already resolved, load immediately
    if (this.locationService.isResolved() && !this.initialLoadDone) {
      this.initialLoadDone = true;
      this.loadProducts();
    }
  }

  loadBrands(): void {
    this.brandService.getAll().subscribe({
      next: (response) => {
        this.brands.set(response.data);
      },
      error: () => {},
    });
  }

  loadCategories(): void {
    this.categoryService.getAll().subscribe({
      next: (response) => {
        this.categories.set(response.data);
      },
      error: () => {},
    });
  }

  loadProducts(): void {
    this.isLoading.set(true);
    const f = this.filters();

    // Determinar sortBy y sortOrder
    let sortBy: 'price' | 'createdAt' | 'name' | undefined;
    let sortOrder: 'asc' | 'desc' | undefined;

    if (f.sortBy === 'price_desc') {
      sortBy = 'price';
      sortOrder = 'desc';
    } else if (f.sortBy === 'price') {
      sortBy = 'price';
      sortOrder = 'asc';
    } else if (f.sortBy === 'name') {
      sortBy = 'name';
      sortOrder = 'asc';
    } else {
      sortBy = 'createdAt';
      sortOrder = 'desc';
    }

    // Include branchIds from user's selected location
    const ids = this.locationService.branchIds();
    const branchIds = ids.length > 0 ? ids.join(',') : undefined;

    this.productService.getAll({
      page: this.currentPage(),
      limit: this.currentLimit(),
      search: f.search || undefined,
      vehicleType: (f.vehicleType as VehicleType) || undefined,
      brand: f.brand || undefined,
      category: f.category || undefined,
      sortBy,
      sortOrder,
      isActive: true,
      branchIds,
    }).subscribe({
      next: (response) => {
        // Map totalStock from backend to stock field for ProductCardData
        const mapped = response.data.map((p: any) => ({
          ...p,
          stock: p.totalStock ?? p.stock ?? 0,
        }));
        this.allProducts.set(mapped);
        this.totalPages.set(response.pagination?.pages || 1);
        this.totalProducts.set(response.pagination?.total || 0);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  onSearchInput(value: string): void {
    this.filters.update((f) => ({ ...f, search: value }));
    this.searchSubject$.next(value);
  }

  updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]): void {
    this.filters.update((f) => {
      const updated = { ...f, [key]: value };

      // Cascading: when vehicleType changes, reset category if it no longer
      // matches. Universal categories (contain VehicleType.ALL) apply to any
      // vehicleType so they are never reset.
      if (key === 'vehicleType') {
        const selectedCat = this.categories().find(c => c.id === f.category);
        if (selectedCat && value) {
          const catMatches =
            selectedCat.vehicleTypes?.includes(value as VehicleType) ||
            selectedCat.vehicleTypes?.includes(VehicleType.ALL);
          if (!catMatches) {
            updated.category = '';
          }
        }
      }

      return updated;
    });
    this.currentPage.set(1);
    this.syncPageToUrl();
    this.loadProducts();
  }

  clearFilters(): void {
    this.filters.set({
      search: '',
      vehicleType: '',
      brand: '',
      category: '',
      sortBy: 'createdAt',
    });
    this.currentPage.set(1);
    this.syncPageToUrl();
    this.loadProducts();
  }

  toggleFilters(): void {
    this.showFilters.update((v) => !v);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.syncPageToUrl();
    this.loadProducts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Sync current page to URL query params for browser back button support */
  private syncPageToUrl(): void {
    const page = this.currentPage();
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: page > 1 ? { page } : {},
      queryParamsHandling: page > 1 ? 'merge' : '',
      replaceUrl: false,
    });
  }

  onLimitChange(newLimit: number | string): void {
    this.currentLimit.set(Number(newLimit));
    this.currentPage.set(1);
    this.loadProducts();
  }

  /**
   * Desactiva el filtro de vehículo y limpia la selección.
   */
  clearVehicleFilter(): void {
    this.vehicleFilterActive.set(false);
    this.vehicleService.selectVehicle(null);
  }

  /**
   * Filtra productos compatibles con el vehículo seleccionado.
   */
  private filterByVehicle(products: ProductCardData[]): ProductCardData[] {
    const vehicle = this.vehicleService.selectedVehicle();
    if (!vehicle) return products;

    const { fuelType, displacement, cylinders, oilType } = vehicle.engineType;

    return products.filter(p => {
      const product = p as unknown as Product;

      // Si el producto no tiene compatibleEngines ni oilType, no se puede filtrar → mostrarlo
      if (!product.compatibleEngines?.length && !product.oilType) return true;

      // Verificar compatibilidad de motor
      let engineMatch = true;
      if (product.compatibleEngines && product.compatibleEngines.length > 0) {
        engineMatch = product.compatibleEngines.some(
          e => e.fuelType === fuelType && e.displacement === displacement && e.cylinders === cylinders
        );
      }

      // Verificar tipo de aceite
      let oilMatch = true;
      if (product.oilType && oilType) {
        oilMatch = product.oilType === oilType;
      }

      return engineMatch && oilMatch;
    });
  }

  /** Visible pages with ellipsis: 1, 2, ..., 10 */
  getVisiblePages(): (number | '...')[] {
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
}
