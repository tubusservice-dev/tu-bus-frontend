import { Component, inject, signal, OnInit, computed, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ProductService } from '../../../../core/services/product.service';
import { LineService } from '../../../../core/services/line.service';
import { CategoryService } from '../../../../core/services/category.service';
import { BrandService } from '../../../../core/services/brand.service';
import { UploadService } from '../../../../core/services/upload.service';
import { ZoneService, City, Municipality } from '../../../../core/services/zone.service';
import {
  Line,
  Category,
  Brand,
} from '../../../../models';
import { ImageCarouselComponent } from '../../../../shared/components/image-carousel/image-carousel.component';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ImageCarouselComponent],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.scss',
})
export class ProductFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly productService = inject(ProductService);
  private readonly lineService = inject(LineService);
  private readonly categoryService = inject(CategoryService);
  private readonly brandService = inject(BrandService);
  private readonly uploadService = inject(UploadService);
  private readonly zoneService = inject(ZoneService);
  private readonly elementRef = inject(ElementRef);

  // Estado
  protected readonly productId = signal<string | null>(null);
  protected readonly isEditMode = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  // Datos
  protected readonly lines = signal<Line[]>([]);
  protected readonly images = signal<string[]>([]);
  protected readonly isUploading = signal(false);

  // Categorías
  protected readonly categories = signal<Category[]>([]);
  protected readonly selectedCategories = signal<Category[]>([]);
  protected readonly categorySearchTerm = signal('');
  protected readonly showCategoryDropdown = signal(false);

  // Categorías filtradas (computed)
  protected readonly filteredCategories = computed(() => {
    const search = this.categorySearchTerm().toLowerCase().trim();
    const selected = this.selectedCategories();
    const selectedIds = selected.map(c => c.id);

    let filtered = this.categories().filter(c => !selectedIds.includes(c.id) && c.isActive);

    if (search) {
      filtered = filtered.filter(c => c.name.toLowerCase().includes(search));
    }

    return filtered;
  });

  // Marcas
  protected readonly brands = signal<Brand[]>([]);
  protected readonly selectedBrand = signal<Brand | null>(null);
  protected readonly brandSearchTerm = signal('');
  protected readonly showBrandDropdown = signal(false);

  // Marcas filtradas (computed)
  protected readonly filteredBrands = computed(() => {
    const search = this.brandSearchTerm().toLowerCase().trim();
    const selected = this.selectedBrand();

    let filtered = this.brands().filter(b => b.isActive);

    // Si ya hay una marca seleccionada, excluirla de la lista
    if (selected) {
      filtered = filtered.filter(b => b.id !== selected.id);
    }

    if (search) {
      filtered = filtered.filter(b => b.name.toLowerCase().includes(search));
    }

    return filtered;
  });

  // Zonas/Regiones - Selector de dos pasos (Ciudad -> Municipio)
  protected readonly zones = signal<City[]>([]);
  protected readonly selectedRegions = signal<Array<{ city: City; municipality: Municipality }>>([]);
  protected readonly showZoneDropdown = signal(false);
  protected readonly zoneSelectorStep = signal<'city' | 'municipality'>('city');
  protected readonly selectedCityForMunicipality = signal<City | null>(null);

  // Ciudades disponibles para seleccionar
  protected readonly availableCities = computed(() => {
    return this.zones().filter(z => z.isActive);
  });

  // Municipios disponibles de la ciudad seleccionada
  protected readonly availableMunicipalities = computed(() => {
    const city = this.selectedCityForMunicipality();
    if (!city) return [];
    const selectedMuniCodes = this.selectedRegions()
      .filter(r => r.city.id === city.id)
      .map(r => r.municipality.code);
    return city.municipalities.filter(m => m.isActive && !selectedMuniCodes.includes(m.code));
  });

  // Sección activa (simplificado a 3 secciones)
  protected readonly activeSection = signal<'basic' | 'vehicle' | 'images'>('basic');

  // Formulario (simplificado)
  protected readonly form: FormGroup = this.fb.group({
    // Básico (solo nombre requerido)
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    sku: [''],
    tags: [''],

    // Línea del producto
    line: [''],

    // Detalles adicionales (opcionales)
    brand: [''],
    productModel: [''],

    // Inventario (precio y stock requeridos)
    price: [0, [Validators.required, Validators.min(0)]],
    comparePrice: [null],
    stock: [1, [Validators.required, Validators.min(0)]],
    lowStockThreshold: [5],

    // Estado
    isActive: [true],
    isFeatured: [false],

    // Combo y Regiones
    isCombo: [false],
    allRegions: [false],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (id) {
      // Modo edición: cargar datos base primero, luego el producto
      this.productId.set(id);
      this.isEditMode.set(true);
      this.isLoading.set(true);

      forkJoin({
        lines: this.lineService.getAllAdmin(),
        categories: this.categoryService.getAllAdmin(),
        brands: this.brandService.getAllAdmin(),
        zones: this.zoneService.getAllAdmin()
      }).subscribe({
        next: (responses) => {
          this.lines.set(responses.lines.data);
          this.categories.set(responses.categories.data);
          this.brands.set(responses.brands.data);
          this.zones.set(responses.zones);
          // Ahora cargar el producto con las categorías y marcas ya disponibles
          this.loadProduct(id);
        },
        error: () => {
          this.isLoading.set(false);
          this.errorMessage.set('Error al cargar datos iniciales');
        }
      });
    } else {
      // Modo creación: cargar datos en paralelo
      this.loadLines();
      this.loadCategories();
      this.loadBrands();
      this.loadZones();
    }
  }

  /**
   * Cargar líneas
   */
  private loadLines(): void {
    this.lineService.getAllAdmin().subscribe({
      next: (response) => {
        this.lines.set(response.data);
      },
      error: () => {},
    });
  }

  /**
   * Cargar categorías
   */
  private loadCategories(): void {
    this.categoryService.getAllAdmin().subscribe({
      next: (response) => {
        this.categories.set(response.data);
      },
      error: () => {},
    });
  }

  /**
   * Cargar marcas
   */
  private loadBrands(): void {
    this.brandService.getAllAdmin().subscribe({
      next: (response) => {
        this.brands.set(response.data);
      },
      error: () => {},
    });
  }

  /**
   * Cargar zonas/regiones
   */
  private loadZones(): void {
    this.zoneService.getAllAdmin().subscribe({
      next: (zones) => {
        this.zones.set(zones);
      },
      error: () => {},
    });
  }

  /**
   * Cargar producto para edición (usa ruta admin)
   * Nota: isLoading ya está en true cuando se llama desde ngOnInit
   */
  private loadProduct(id: string): void {
    this.productService.getByIdAdmin(id).subscribe({
      next: (response) => {
        const product = response.data;

        // Obtener el ID de la línea (puede venir como objeto o string)
        let lineId = '';
        if (product.line) {
          lineId = typeof product.line === 'string' ? product.line : (product.line as any).id || (product.line as any)._id || '';
        }

        this.form.patchValue({
          name: product.name,
          description: product.description,
          sku: product.sku,
          tags: product.tags?.join(', ') || '',
          line: lineId,
          brand: product.brand,
          productModel: product.productModel,
          price: product.price,
          comparePrice: product.comparePrice,
          stock: product.stock,
          isActive: product.isActive,
          isFeatured: product.isFeatured,
          isCombo: product.isCombo || false,
          allRegions: product.allRegions || false,
        });
        this.images.set(product.images || []);

        // Cargar regiones seleccionadas (ciudad + municipio)
        if (product.regions && Array.isArray(product.regions)) {
          const regs: Array<{ city: City; municipality: Municipality }> = [];
          for (const r of product.regions) {
            // r tiene { city: {...}, municipalityCode: string }
            const cityData: any = r.city;
            const muniCode = r.municipalityCode;

            if (cityData && muniCode) {
              // Buscar la ciudad en las zonas cargadas o usar la del producto
              let city: City;
              if (typeof cityData === 'string') {
                const found = this.zones().find(z => z.id === cityData);
                if (found) city = found;
                else continue;
              } else {
                city = {
                  id: cityData.id || cityData._id,
                  code: cityData.code || '',
                  name: cityData.name || '',
                  isActive: cityData.isActive !== false,
                  municipalities: cityData.municipalities || []
                };
              }

              // Buscar el municipio en la ciudad
              const municipality = city.municipalities.find(m => m.code === muniCode);
              if (municipality) {
                regs.push({ city, municipality });
              }
            }
          }
          this.selectedRegions.set(regs);
        }

        // Cargar categorías seleccionadas
        if (product.categories && Array.isArray(product.categories)) {
          const cats = product.categories.map((c: any) => {
            if (typeof c === 'string') {
              // Si es solo un ID, buscar en las categorías cargadas
              const found = this.categories().find(cat => cat.id === c);
              return found || { id: c, name: c, slug: '', isActive: true };
            }
            // Normalizar el objeto (puede venir con _id o id)
            return {
              id: c.id || c._id,
              name: c.name || '',
              slug: c.slug || '',
              isActive: c.isActive !== false
            };
          });
          this.selectedCategories.set(cats);
        }

        // Cargar marca seleccionada
        if (product.brand) {
          if (typeof product.brand === 'string') {
            // Si es un ID, buscar en las marcas cargadas
            const found = this.brands().find(b => b.id === product.brand);
            if (found) {
              this.selectedBrand.set(found);
            }
          } else if (typeof product.brand === 'object') {
            // Si es un objeto, normalizar
            const brandObj = product.brand as any;
            this.selectedBrand.set({
              id: brandObj.id || brandObj._id,
              name: brandObj.name || '',
              slug: brandObj.slug || '',
              isActive: brandObj.isActive !== false
            });
          }
        }

        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al cargar producto');
        this.isLoading.set(false);
      },
    });
  }

  /**
   * Cambiar sección activa
   */
  setSection(section: 'basic' | 'vehicle' | 'images'): void {
    this.activeSection.set(section);
  }

  /**
   * Subir imágenes
   */
  async onFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    this.isUploading.set(true);
    this.errorMessage.set(null);

    const files = Array.from(input.files);

    for (const file of files) {
      try {
        const response = await this.uploadService.uploadImage(file, 'products').toPromise();
        if (response?.data?.url) {
          this.images.update((imgs) => [...imgs, response.data.url]);
        }
      } catch (error: any) {
        this.errorMessage.set(error.error?.message || 'Error al subir imagen');
      }
    }

    this.isUploading.set(false);
    input.value = '';
  }

  /**
   * Eliminar imagen
   */
  removeImage(index: number): void {
    this.images.update((imgs) => imgs.filter((_, i) => i !== index));
  }

  /**
   * Mover imagen
   */
  moveImage(from: number, to: number): void {
    if (to < 0 || to >= this.images().length) return;
    const imgs = [...this.images()];
    const [removed] = imgs.splice(from, 1);
    imgs.splice(to, 0, removed);
    this.images.set(imgs);
  }

  /**
   * Enviar formulario
   */
  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      // Ir a la sección con errores (solo nombre, precio y stock son requeridos)
      if (this.hasErrors(['name', 'price', 'stock'])) {
        this.activeSection.set('basic');
      }
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const formValue = this.form.value;
    const data = {
      ...formValue,
      images: this.images(),
      tags: formValue.tags ? formValue.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      categories: this.selectedCategories().map(c => c.id),
      line: formValue.line || undefined,
      brand: this.selectedBrand()?.id || undefined,
      isCombo: formValue.isCombo || false,
      allRegions: formValue.allRegions || false,
      regions: formValue.allRegions ? [] : this.selectedRegions().map(r => ({
        city: r.city.id,
        municipalityCode: r.municipality.code
      })),
    };

    const request$ = this.isEditMode()
      ? this.productService.update(this.productId()!, data)
      : this.productService.create(data);

    request$.subscribe({
      next: () => {
        this.router.navigate(['/admin/products']);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al guardar producto');
        this.isSubmitting.set(false);
      },
    });
  }

  /**
   * Verificar si hay errores en campos específicos
   */
  private hasErrors(fields: string[]): boolean {
    return fields.some((field) => {
      const control = this.form.get(field);
      return control?.invalid && control?.touched;
    });
  }

  /**
   * Verificar error de campo
   */
  hasError(field: string, error: string): boolean {
    const control = this.form.get(field);
    return !!(control?.hasError(error) && control?.touched);
  }

  /**
   * Verificar si el campo es inválido
   */
  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!(control?.invalid && control?.touched);
  }

  // ==================== CATEGORÍAS ====================

  /**
   * Actualizar término de búsqueda de categorías
   */
  onCategorySearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.categorySearchTerm.set(input.value);
    this.showCategoryDropdown.set(true);
  }

  /**
   * Mostrar dropdown de categorías
   */
  openCategoryDropdown(): void {
    this.showCategoryDropdown.set(true);
  }

  /**
   * Seleccionar una categoría
   */
  selectCategory(category: Category): void {
    this.selectedCategories.update(cats => [...cats, category]);
    this.categorySearchTerm.set('');
    this.showCategoryDropdown.set(false);
  }

  /**
   * Eliminar una categoría seleccionada
   */
  removeCategory(category: Category): void {
    this.selectedCategories.update(cats => cats.filter(c => c.id !== category.id));
  }

  /**
   * Cerrar dropdown al hacer clic fuera
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const categorySelector = this.elementRef.nativeElement.querySelector('.category-selector');
    if (categorySelector && !categorySelector.contains(target)) {
      this.showCategoryDropdown.set(false);
    }
    const brandSelector = this.elementRef.nativeElement.querySelector('.brand-selector');
    if (brandSelector && !brandSelector.contains(target)) {
      this.showBrandDropdown.set(false);
    }
    const zoneSelector = this.elementRef.nativeElement.querySelector('.zone-selector');
    if (zoneSelector && !zoneSelector.contains(target)) {
      this.showZoneDropdown.set(false);
    }
  }

  // ==================== MARCAS ====================

  /**
   * Actualizar término de búsqueda de marcas
   */
  onBrandSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.brandSearchTerm.set(input.value);
    this.showBrandDropdown.set(true);
  }

  /**
   * Mostrar dropdown de marcas
   */
  openBrandDropdown(): void {
    this.showBrandDropdown.set(true);
  }

  /**
   * Seleccionar una marca (selección única)
   */
  selectBrand(brand: Brand): void {
    this.selectedBrand.set(brand);
    this.brandSearchTerm.set('');
    this.showBrandDropdown.set(false);
  }

  /**
   * Eliminar la marca seleccionada
   */
  removeBrand(): void {
    this.selectedBrand.set(null);
  }

  // ==================== ZONAS/REGIONES ====================

  /**
   * Abrir/cerrar dropdown de zonas
   */
  toggleZoneDropdown(): void {
    if (this.showZoneDropdown()) {
      this.closeZoneDropdown();
    } else {
      this.zoneSelectorStep.set('city');
      this.selectedCityForMunicipality.set(null);
      this.showZoneDropdown.set(true);
    }
  }

  /**
   * Cerrar dropdown de zonas
   */
  closeZoneDropdown(): void {
    this.showZoneDropdown.set(false);
    this.zoneSelectorStep.set('city');
    this.selectedCityForMunicipality.set(null);
  }

  /**
   * Seleccionar una ciudad (paso 1)
   */
  selectCityForRegion(city: City): void {
    this.selectedCityForMunicipality.set(city);
    this.zoneSelectorStep.set('municipality');
  }

  /**
   * Volver a selección de ciudad
   */
  backToCity(): void {
    this.zoneSelectorStep.set('city');
    this.selectedCityForMunicipality.set(null);
  }

  /**
   * Seleccionar un municipio (paso 2) - agrega la región
   */
  selectMunicipalityForRegion(municipality: Municipality): void {
    const city = this.selectedCityForMunicipality();
    if (!city) return;

    this.selectedRegions.update(regions => [...regions, { city, municipality }]);
    this.closeZoneDropdown();
  }

  /**
   * Eliminar una región seleccionada
   */
  removeRegion(region: { city: City; municipality: Municipality }): void {
    this.selectedRegions.update(regions =>
      regions.filter(r => !(r.city.id === region.city.id && r.municipality.code === region.municipality.code))
    );
  }
}