import { Component, inject, signal, OnInit, computed, HostListener, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService, ProductCardDTO } from '../../core/services/product.service';
import { BrandService } from '../../core/services/brand.service';
import { CategoryService } from '../../core/services/category.service';
import { SettingsService } from '../../core/services/settings.service';
import { VehicleService } from '../../core/services/vehicle.service';
import { LocationService } from '../../core/services/location.service';
import { ProductCardComponent, ProductCardData } from '../../shared/components/product-card/product-card.component';
import { SearchInputComponent } from '../../shared/components/search-input/search-input.component';
import {
  Brand,
  Category,
  FuelType,
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
  /** When true, combos are pushed to the top of the result set */
  onlyCombos: boolean;
}

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductCardComponent, SearchInputComponent],
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

  /** True while a search is in-flight (typed but results not yet rendered) */
  protected readonly isSearching = signal(false);

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
  // Products already arrive filtered + sorted from the backend. No client-side
  // post-processing needed — avoids the pagination/count desync bug that the
  // previous filterByVehicle() implementation caused.
  protected readonly products = signal<ProductCardData[]>([]);
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

  // Filtros. `onlyCombos` arranca en true: combos-first es el orden por
  // defecto del catálogo para empujar las promociones al inicio del grid.
  // El usuario puede desactivarlo desde el toggle; no cuenta como filtro
  // activo porque representa el estado normal, no una selección explícita.
  protected readonly filters = signal<FilterState>({
    search: '',
    vehicleType: '',
    brand: '',
    category: '',
    sortBy: 'createdAt',
    onlyCombos: true,
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

  // Filtros activos. `onlyCombos` queda fuera a propósito: al ser el
  // estado por defecto, contarlo inflaría el badge sin reflejar una
  // selección real del usuario.
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

    // Server-side garage filter — replaces the previous client-side post-filter
    // that caused pagination/count desync. When the user activates the garage
    // filter, we ask the backend to restrict products to those whose
    // compatibleEngines matches the vehicle's engine.
    let engineDisplacement: string | undefined;
    let engineFuelType: FuelType | undefined;
    let engineCylinders: number | undefined;
    if (this.vehicleFilterActive()) {
      const vehicle = this.vehicleService.selectedVehicle();
      if (vehicle?.engineType) {
        engineDisplacement = vehicle.engineType.displacement || undefined;
        engineFuelType = (vehicle.engineType.fuelType as FuelType | undefined) || undefined;
        engineCylinders = vehicle.engineType.cylinders || undefined;
      }
    }

    this.productService.getCatalog({
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
      comboFirst: f.onlyCombos || undefined,
      engineDisplacement,
      engineFuelType,
      engineCylinders,
    }).subscribe({
      next: (response) => {
        // Map ProductCardDTO → ProductCardData (card expects `stock` field)
        const mapped: ProductCardData[] = response.data.map((p: ProductCardDTO) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          price: p.price,
          comparePrice: p.comparePrice ?? null,
          images: p.images,
          brand: p.brand ?? undefined,
          line: p.line ?? undefined,
          productModel: p.productModel,
          categories: p.category ? [p.category] : [],
          isFeatured: p.isFeatured,
          isCombo: p.isCombo,
          stock: p.totalStock ?? 0,
          freeOilChangeService: p.freeOilChangeService,
          vehicleTypes: p.vehicleTypes,
        }));
        this.products.set(mapped);
        this.totalPages.set(response.pagination?.pages || 1);
        this.totalProducts.set(response.pagination?.total || 0);
        this.isLoading.set(false);
        this.isSearching.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.isSearching.set(false);
      },
    });
  }

  /** Fired on every keystroke (pre-debounce) — lights the spinner */
  onSearchTyping(value: string): void {
    if (value !== this.filters().search) {
      this.isSearching.set(true);
    }
  }

  /** Fired after debounce — triggers the HTTP request */
  onSearchCommit(value: string): void {
    this.filters.update((f) => ({ ...f, search: value }));
    this.currentPage.set(1);
    this.loadProducts();
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
    // Reset mantiene onlyCombos en true para empatar con el default del
    // signal — "limpiar filtros" devuelve al estado inicial de la vista,
    // no a un estado sin ordenamiento.
    this.filters.set({
      search: '',
      vehicleType: '',
      brand: '',
      category: '',
      sortBy: 'createdAt',
      onlyCombos: true,
    });
    this.currentPage.set(1);
    this.syncPageToUrl();
    this.loadProducts();
  }

  toggleFilters(): void {
    this.showFilters.update((v) => !v);
  }

  /**
   * Toggles the "combos first" ordering. Kept separate from updateFilter so
   * the template can call it without generic typing noise and so we can evolve
   * combo behavior independently (e.g., future strict-combo mode).
   */
  toggleOnlyCombos(): void {
    this.filters.update((f) => ({ ...f, onlyCombos: !f.onlyCombos }));
    this.currentPage.set(1);
    this.syncPageToUrl();
    this.loadProducts();
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
   * Desactiva el filtro de vehículo y limpia la selección. Triggers a reload
   * because engine filter is now server-side.
   */
  clearVehicleFilter(): void {
    this.vehicleFilterActive.set(false);
    this.vehicleService.selectVehicle(null);
    this.currentPage.set(1);
    this.syncPageToUrl();
    this.loadProducts();
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
