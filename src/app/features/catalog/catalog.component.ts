import { Component, inject, signal, OnInit, computed, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { BrandService } from '../../core/services/brand.service';
import { CategoryService } from '../../core/services/category.service';
import { SettingsService } from '../../core/services/settings.service';
import { ZoneService } from '../../core/services/zone.service';
import { VehicleService } from '../../core/services/vehicle.service';
import { BranchService } from '../../core/services/branch.service';
import { ProductCardComponent, ProductCardData } from '../../shared/components/product-card/product-card.component';
import {
  Product,
  Brand,
  Category,
} from '../../models';
import { PAGINATION_OPTIONS } from '../../models/settings.model';

interface FilterState {
  search: string;
  brand: string;
  category: string;
  minPrice: number | null;
  maxPrice: number | null;
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

  protected readonly zoneService = inject(ZoneService);
  protected readonly vehicleService = inject(VehicleService);
  private readonly branchService = inject(BranchService);
  private readonly route = inject(ActivatedRoute);

  // Filtro de vehículo (activo cuando se navega desde el garaje)
  protected readonly vehicleFilterActive = signal(false);

  // Branch IDs para filtrar por zona
  private readonly branchIds = signal<string[]>([]);
  private zoneInitialized = false;

  // Estado
  protected readonly isLoading = signal(true);
  private readonly allProducts = signal<ProductCardData[]>([]);
  protected readonly products = computed(() => {
    let filtered = this.filterByZone(this.allProducts());
    if (this.vehicleFilterActive()) {
      filtered = this.filterByVehicle(filtered);
    }
    return filtered;
  });
  protected readonly showFilters = signal(false);

  // Datos
  protected readonly brands = signal<Brand[]>([]);
  protected readonly categories = signal<Category[]>([]);

  // Configuración de paginación
  protected readonly paginationConfig = this.settingsService.paginationConfig;
  protected readonly paginationOptions = PAGINATION_OPTIONS;
  // Inicializar con el valor de settings (ya cargados en APP_INITIALIZER)
  protected readonly currentLimit = signal(this.settingsService.paginationConfig().catalogLimit || 20);

  // Filtros
  protected readonly filters = signal<FilterState>({
    search: '',
    brand: '',
    category: '',
    minPrice: null,
    maxPrice: null,
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
    if (f.brand) count++;
    if (f.category) count++;
    if (f.minPrice !== null) count++;
    if (f.maxPrice !== null) count++;
    return count;
  });

  constructor() {
    // Recargar productos cuando cambia la zona seleccionada
    effect(() => {
      const zone = this.zoneService.selectedZone();
      if (zone) {
        this.loadBranchesByZone(zone.city.code, zone.municipality.code);
      } else if (this.zoneInitialized) {
        // Si se limpia la zona, cargar sin filtro de sucursal
        this.branchIds.set([]);
        this.currentPage.set(1);
        this.loadProducts();
      }
    });
  }

  ngOnInit(): void {
    // Activar filtro de vehículo si se navega desde el garaje
    const fromGarage = this.route.snapshot.queryParamMap.get('fromGarage');
    if (fromGarage === 'true' && this.vehicleService.selectedVehicle()) {
      this.vehicleFilterActive.set(true);
    }

    this.loadBrands();
    this.loadCategories();

    // Si ya hay zona seleccionada, el effect la cargará. Si no, cargar todos.
    if (!this.zoneService.selectedZone()) {
      this.loadProducts();
    }
    this.zoneInitialized = true;
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

  private loadBranchesByZone(cityCode: string, municipalityCode: string): void {
    this.branchService.getByZone(cityCode, municipalityCode).subscribe({
      next: (response) => {
        if (response.success && response.data.length > 0) {
          const ids = response.data.map(b => b.id);
          this.branchIds.set(ids);
        } else {
          this.branchIds.set([]);
        }
        this.currentPage.set(1);
        this.loadProducts();
      },
      error: () => {
        this.branchIds.set([]);
        this.currentPage.set(1);
        this.loadProducts();
      }
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

    // Incluir branchIds si hay zona seleccionada
    const ids = this.branchIds();
    const branchIds = ids.length > 0 ? ids.join(',') : undefined;

    this.productService.getAll({
      page: this.currentPage(),
      limit: this.currentLimit(),
      search: f.search || undefined,
      brand: f.brand || undefined,
      category: f.category || undefined,
      minPrice: f.minPrice ?? undefined,
      maxPrice: f.maxPrice ?? undefined,
      sortBy,
      sortOrder,
      isActive: true,
      branchIds,
    }).subscribe({
      next: (response) => {
        this.allProducts.set(response.data);
        this.totalPages.set(response.pagination?.pages || 1);
        this.totalProducts.set(response.pagination?.total || 0);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.loadProducts();
  }

  updateFilter<K extends keyof FilterState>(key: K, value: FilterState[K]): void {
    this.filters.update((f) => ({ ...f, [key]: value }));
    this.currentPage.set(1);
    this.loadProducts();
  }

  clearFilters(): void {
    this.filters.set({
      search: '',
      brand: '',
      category: '',
      minPrice: null,
      maxPrice: null,
      sortBy: 'createdAt',
    });
    this.currentPage.set(1);
    this.loadProducts();
  }

  toggleFilters(): void {
    this.showFilters.update((v) => !v);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadProducts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
   * Compara: compatibleEngines (fuelType + displacement + cylinders) y oilType.
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

  /**
   * Filtra productos por la zona seleccionada.
   * Si no hay zona o la zona es "all", muestra todos.
   */
  private filterByZone(products: ProductCardData[]): ProductCardData[] {
    // Filtrado por zona se hace ahora a través de sucursales en el backend
    return products;
  }

  getPageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];

    if (total <= 5) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      if (current <= 3) {
        pages.push(1, 2, 3, 4, 5);
      } else if (current >= total - 2) {
        pages.push(total - 4, total - 3, total - 2, total - 1, total);
      } else {
        pages.push(current - 2, current - 1, current, current + 1, current + 2);
      }
    }

    return pages;
  }
}