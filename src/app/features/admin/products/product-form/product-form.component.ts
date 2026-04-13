import { Component, inject, signal, OnInit, computed, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ProductService } from '../../../../core/services/product.service';
import { LineService } from '../../../../core/services/line.service';
import { CategoryService } from '../../../../core/services/category.service';
import { BrandService } from '../../../../core/services/brand.service';
import { UploadService } from '../../../../core/services/upload.service';
import { BranchProductService } from '../../../../core/services/branch-product.service';
import { BranchService } from '../../../../core/services/branch.service';
import { BranchProduct } from '../../../../models/branch-product.model';
import { Branch } from '../../../../models/branch.model';
import {
  Line,
  Category,
  Brand,
} from '../../../../models';
import { ImageCarouselComponent } from '../../../../shared/components/image-carousel/image-carousel.component';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ImageCarouselComponent],
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
  private readonly branchProductService = inject(BranchProductService);
  private readonly branchService = inject(BranchService);

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

  // Branch-Product assignment
  protected readonly availableBranches = signal<Branch[]>([]);
  protected readonly existingBranchProducts = signal<BranchProduct[]>([]);
  protected readonly newBranchProducts = signal<Array<{ branch: Branch; stock: number }>>([]);
  protected readonly deletedBranchProductIds = signal<string[]>([]);
  protected readonly branchSearchTerm = signal('');
  protected readonly showBranchDropdown = signal(false);

  protected readonly filteredBranches = computed(() => {
    const search = this.branchSearchTerm().toLowerCase().trim();
    const assignedIds = new Set([
      ...this.existingBranchProducts()
        .filter(bp => !this.deletedBranchProductIds().includes(bp.id))
        .map(bp => typeof bp.branch === 'string' ? bp.branch : (bp.branch as Branch).id),
      ...this.newBranchProducts().map(nbp => nbp.branch.id),
    ]);
    let filtered = this.availableBranches().filter(b => b.isActive && !assignedIds.has(b.id));
    if (search) {
      filtered = filtered.filter(b => b.name.toLowerCase().includes(search));
    }
    return filtered;
  });

  protected readonly totalStock = computed(() => {
    const existingStock = this.existingBranchProducts()
      .filter(bp => !this.deletedBranchProductIds().includes(bp.id))
      .reduce((sum, bp) => sum + bp.stock, 0);
    const newStock = this.newBranchProducts().reduce((sum, nbp) => sum + nbp.stock, 0);
    return existingStock + newStock;
  });

  protected readonly outOfStockCount = computed(() => {
    const existingOos = this.existingBranchProducts()
      .filter(bp => !this.deletedBranchProductIds().includes(bp.id) && bp.stock === 0).length;
    const newOos = this.newBranchProducts().filter(nbp => nbp.stock === 0).length;
    return existingOos + newOos;
  });

  protected readonly activeBranchCount = computed(() => {
    return this.existingBranchProducts()
      .filter(bp => !this.deletedBranchProductIds().includes(bp.id)).length
      + this.newBranchProducts().length;
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

        // Load BranchProducts for this product
        this.branchProductService.getByProduct(id).subscribe({
          next: (response) => this.existingBranchProducts.set(response.data),
          error: () => {},
        });
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
        const productId = response.data.id || this.productId()!;
        this.saveBranchProducts(productId);
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
    const branchSelector = this.elementRef.nativeElement.querySelector('.branch-selector');
    if (branchSelector && !branchSelector.contains(target)) {
      this.showBranchDropdown.set(false);
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

  // ==================== SUCURSALES / BRANCH-PRODUCT ====================

  /**
   * Filter branch search input
   */
  onBranchSearch(event: Event): void {
    this.branchSearchTerm.set((event.target as HTMLInputElement).value);
    this.showBranchDropdown.set(true);
  }

  /**
   * Open branch dropdown
   */
  openBranchDropdown(): void {
    this.showBranchDropdown.set(true);
  }

  /**
   * Close branch dropdown with delay for click registration
   */
  closeBranchDropdown(): void {
    setTimeout(() => this.showBranchDropdown.set(false), 200);
  }

  /**
   * Add a branch with stock 0
   */
  addBranch(branch: Branch): void {
    this.newBranchProducts.update(list => [...list, { branch, stock: 0 }]);
    this.branchSearchTerm.set('');
    // Keep dropdown open so the user can select multiple branches consecutively
  }

  /**
   * Mark an existing BranchProduct for deletion
   */
  removeExistingBranchProduct(bpId: string): void {
    this.deletedBranchProductIds.update(ids => [...ids, bpId]);
  }

  /**
   * Remove a newly added branch product
   */
  removeNewBranchProduct(index: number): void {
    this.newBranchProducts.update(list => list.filter((_, i) => i !== index));
  }

  /**
   * Update stock on an existing BranchProduct (local state)
   */
  updateExistingStock(bpId: string, event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value) || 0;
    this.existingBranchProducts.update(list =>
      list.map(bp => bp.id === bpId ? { ...bp, stock: Math.max(0, value) } : bp)
    );
  }

  /**
   * Update stock on a new branch product (local state)
   */
  updateNewStock(index: number, event: Event): void {
    const value = parseInt((event.target as HTMLInputElement).value) || 0;
    this.newBranchProducts.update(list =>
      list.map((item, i) => i === index ? { ...item, stock: Math.max(0, value) } : item)
    );
  }

  /**
   * Get branch name from a BranchProduct (populated or string ID)
   */
  getBranchName(bp: BranchProduct): string {
    if (typeof bp.branch === 'string') return bp.branch;
    return (bp.branch as Branch)?.name || '';
  }

  /**
   * Persist BranchProduct changes (deletions, updates, new assignments)
   */
  private saveBranchProducts(productId: string): void {
    const deletions = this.deletedBranchProductIds().map(id =>
      this.branchProductService.delete(id)
    );

    const updates = this.existingBranchProducts()
      .filter(bp => !this.deletedBranchProductIds().includes(bp.id))
      .map(bp => this.branchProductService.update(bp.id, { stock: bp.stock }));

    const newAssignments = this.newBranchProducts();

    const operations = [...deletions, ...updates];

    if (operations.length > 0) {
      forkJoin(operations).subscribe({
        next: () => {
          if (newAssignments.length > 0) {
            this.createNewBranchProducts(productId);
          } else {
            this.location.back();
          }
        },
        error: () => {
          if (newAssignments.length > 0) {
            this.createNewBranchProducts(productId);
          } else {
            this.location.back();
          }
        },
      });
    } else if (newAssignments.length > 0) {
      this.createNewBranchProducts(productId);
    } else {
      this.location.back();
    }
  }

  /**
   * Batch-create new BranchProduct assignments
   */
  private createNewBranchProducts(productId: string): void {
    const data = {
      productId,
      assignments: this.newBranchProducts().map(nbp => ({
        branchId: nbp.branch.id,
        stock: nbp.stock,
      })),
    };
    this.branchProductService.createBatch(data).subscribe({
      next: () => this.location.back(),
      error: () => this.location.back(),
    });
  }

}