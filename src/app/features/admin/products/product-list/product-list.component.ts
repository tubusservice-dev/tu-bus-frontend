import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductService, ProductQueryParams } from '../../../../core/services/product.service';
import { LineService } from '../../../../core/services/line.service';
import { CategoryService } from '../../../../core/services/category.service';
import { SettingsService } from '../../../../core/services/settings.service';
import {
  Product,
  Line,
  Category,
  Brand,
} from '../../../../models';
import { ImageCarouselComponent } from '../../../../shared/components/image-carousel/image-carousel.component';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ImageCarouselComponent],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.scss',
})
export class ProductListComponent implements OnInit {
  private readonly productService = inject(ProductService);
  private readonly lineService = inject(LineService);
  private readonly categoryService = inject(CategoryService);
  private readonly settingsService = inject(SettingsService);

  // Datos
  protected readonly products = signal<Product[]>([]);
  protected readonly lines = signal<Line[]>([]);
  protected readonly categories = signal<Category[]>([]);

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
  protected readonly filters = signal<ProductQueryParams>({
    page: 1,
    limit: this.adminLimit,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    line: '',
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
    this.loadLines();
    this.loadCategories();
    this.loadProducts();
  }

  /**
   * Cargar líneas
   */
  loadLines(): void {
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
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al cargar productos');
        this.isLoading.set(false);
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
      line: '',
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
    this.loadProducts();
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
   * Calcular stock total
   */
  getTotalStock(product: Product): number {
    return product.stock;
  }

  /**
   * Verificar si tiene bajo stock
   */
  isLowStock(product: Product): boolean {
    const totalStock = this.getTotalStock(product);
    return totalStock > 0 && totalStock <= 5;
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
