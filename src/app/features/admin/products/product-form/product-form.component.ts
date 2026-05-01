import { Component, inject, signal, OnInit, computed, ElementRef, HostListener, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProductService } from '../../../../core/services/product.service';
import { LineService } from '../../../../core/services/line.service';
import { CategoryService } from '../../../../core/services/category.service';
import { BrandService } from '../../../../core/services/brand.service';
import { UploadService } from '../../../../core/services/upload.service';
import { BranchService } from '../../../../core/services/branch.service';
import { Branch } from '../../../../models/branch.model';
import {
  Line,
  Category,
  Brand,
} from '../../../../models';
import { ImageCarouselComponent } from '../../../../shared/components/image-carousel/image-carousel.component';
import {
  SearchableSelectComponent,
  SearchableOption,
} from '../../../../shared/components/searchable-select/searchable-select.component';
import { ToastService } from '../../../../shared/services/toast.service';
import { BranchStockManagerComponent } from '../branch-stock-manager/branch-stock-manager.component';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ImageCarouselComponent, SearchableSelectComponent, BranchStockManagerComponent],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.scss',
})
export class ProductFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  protected readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);
  private readonly productService = inject(ProductService);
  private readonly lineService = inject(LineService);
  private readonly categoryService = inject(CategoryService);
  private readonly brandService = inject(BrandService);
  private readonly uploadService = inject(UploadService);
  private readonly elementRef = inject(ElementRef);
  private readonly branchService = inject(BranchService);
  private readonly toastService = inject(ToastService);

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

  // Marcas — filtering/search now lives inside <app-searchable-select>
  protected readonly brands = signal<Brand[]>([]);
  protected readonly selectedBrand = signal<Brand | null>(null);

  // ===== SearchableSelect adapters (migrated from inline UI) =====
  /** All active brands mapped as SearchableOption for the shared component */
  protected readonly brandOptionList = computed<SearchableOption[]>(() =>
    this.brands()
      .filter(b => b.isActive)
      .map(b => ({ id: b.id, label: b.name }))
  );

  /** Currently selected brand shaped as SearchableOption */
  protected readonly selectedBrandOption = computed<SearchableOption | null>(() => {
    const b = this.selectedBrand();
    return b ? { id: b.id, label: b.name } : null;
  });

  onBrandSelectedChange(option: SearchableOption | null): void {
    if (!option) {
      this.selectedBrand.set(null);
      return;
    }
    const brand = this.brands().find(b => b.id === option.id);
    if (brand) this.selectedBrand.set(brand);
  }

  // Available branches — handed to the embedded BranchStockManager.
  protected readonly availableBranches = signal<Branch[]>([]);

  // Reference to the embedded manager so we can trigger save() after the
  // product is created/updated and the productId is known.
  @ViewChild('branchManager') branchManager?: BranchStockManagerComponent;

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

    // Precio
    price: [0, [Validators.required, Validators.min(0)]],
    comparePrice: [null],
    // TODO: stock is now managed per-branch via BranchProduct

    // Estado
    isActive: [true],
    isFeatured: [false],

    // Combo y Delivery
    isCombo: [false],
    freeOilChangeService: [false],
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
        branches: this.branchService.getActive(),
      }).subscribe({
        next: (responses) => {
          this.lines.set(responses.lines.data);
          this.categories.set(responses.categories.data);
          this.brands.set(responses.brands.data);
          this.availableBranches.set(responses.branches.data);
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
      this.loadAvailableBranches();
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
   * Load available branches for assignment
   */
  private loadAvailableBranches(): void {
    this.branchService.getActive().subscribe({
      next: (response) => this.availableBranches.set(response.data),
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
          isActive: product.isActive,
          isFeatured: product.isFeatured,
          isCombo: product.isCombo || false,
          freeOilChangeService: product.freeOilChangeService || false,
        });
        this.images.set(product.images || []);

        // Cargar categorías seleccionadas
        if (product.categories && Array.isArray(product.categories)) {
          const cats = product.categories.map((c: any) => {
            if (typeof c === 'string') {
              // Si es solo un ID, buscar en las categorías cargadas
              const found = this.categories().find(cat => cat.id === c);
              return found || { id: c, name: c, slug: '', vehicleTypes: [], isActive: true };
            }
            // Normalizar el objeto (puede venir con _id o id)
            return {
              id: c.id || c._id,
              name: c.name || '',
              slug: c.slug || '',
              vehicleTypes: c.vehicleTypes || [],
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
        // BranchProducts are loaded by the embedded <app-branch-stock-manager>
        // via its `productId` input — no need to fetch them here.
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
      // Ir a la sección con errores (solo nombre y precio son requeridos)
      if (this.hasErrors(['name', 'price'])) {
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
      freeOilChangeService: formValue.freeOilChangeService || false,
      // TODO: branches assigned via BranchProduct
    };

    const request$ = this.isEditMode()
      ? this.productService.update(this.productId()!, data)
      : this.productService.create(data);

    request$.subscribe({
      next: (response) => {
        const newProductId = response.data.id || this.productId()!;
        // Sync productId so the manager can persist new assignments under
        // the freshly-created backend id.
        if (!this.isEditMode()) {
          this.productId.set(newProductId);
        }
        // Delegate branch persistence to the embedded manager. If the
        // ViewChild isn't ready (defensive), still finish so the user
        // doesn't get stuck on an infinite spinner.
        const manager = this.branchManager;
        if (!manager) {
          this.finishProductSave();
          return;
        }
        manager.save(newProductId).subscribe({
          next: () => this.finishProductSave(),
          error: (err: any) => {
            this.isSubmitting.set(false);
            this.errorMessage.set(err?.error?.message || 'Error al guardar sucursales');
            this.toastService.error('Error al guardar sucursales');
          },
        });
      },
      error: (error) => {
        const msg = error.error?.message || 'Error al guardar producto';
        this.errorMessage.set(msg);
        this.toastService.error(msg);
        this.isSubmitting.set(false);
      },
    });
  }

  /**
   * Fire a success toast + navigate back. Called from every terminal branch
   * of the product save flow so the user always gets feedback, no matter
   * which combination of branch-product operations ran.
   */
  private finishProductSave(): void {
    this.toastService.success(
      this.isEditMode()
        ? 'Producto actualizado exitosamente'
        : 'Producto creado exitosamente',
    );
    this.location.back();
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
   * Cerrar dropdown al hacer clic fuera. Branch dropdown is now self-contained
   * inside <app-branch-stock-manager>; only categories handled here.
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const categorySelector = this.elementRef.nativeElement.querySelector('.category-selector');
    if (categorySelector && !categorySelector.contains(target)) {
      this.showCategoryDropdown.set(false);
    }
    // Brand dropdown is encapsulated inside <app-searchable-select>.
    // Branch dropdown lives inside <app-branch-stock-manager>.
  }
}