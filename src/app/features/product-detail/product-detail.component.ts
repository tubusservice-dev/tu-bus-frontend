import { Component, OnInit, inject, signal, computed, DestroyRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { AuthService } from '../../core/services/auth.service';
import { LocationService } from '../../core/services/location.service';
import { BranchProductService } from '../../core/services/branch-product.service';
import { Product, Category, Brand, Line } from '../../models/product.model';
import {
  ProductCardComponent,
  ProductCardData,
} from '../../shared/components/product-card/product-card.component';

const PLACEHOLDER_IMAGE = 'https://placehold.co/400x400/e5e7eb/9ca3af?text=Sin+imagen';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCardComponent],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss',
})
export class ProductDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productService = inject(ProductService);
  private readonly cartService = inject(CartService);
  private readonly authService = inject(AuthService);
  private readonly locationService = inject(LocationService);
  private readonly branchProductService = inject(BranchProductService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Re-load stock and related products when location resolves after OAuth redirect
    effect(() => {
      const resolved = this.locationService.isResolved();
      const branchIds = this.locationService.branchIds();
      const prod = this.product();

      if (resolved && prod && branchIds.length > 0) {
        this.loadStock(prod.id);
        // Reload related products with branchIds so they show correct stock
        if (prod.categories?.length) {
          this.loadRelatedProducts(prod);
        }
      }
    });
  }

  // Core state
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly product = signal<Product | null>(null);

  // Image gallery
  protected readonly selectedImageIndex = signal(0);

  // Quantity
  protected readonly quantity = signal(1);

  // Related products
  protected readonly relatedProducts = signal<ProductCardData[]>([]);
  protected readonly loadingRelated = signal(false);

  // Stock from BranchProduct aggregation
  protected readonly productStock = signal<number | null>(null); // null = loading
  protected readonly isLoadingStock = signal(false);

  // Cart feedback
  protected readonly showLoginMessage = signal(false);
  protected readonly showStockError = signal(false);
  protected readonly stockErrorMessage = signal('');
  protected readonly isAddingToCart = signal(false);
  protected readonly justAddedToCart = signal(false);

  // Computed
  protected readonly images = computed(() => {
    const prod = this.product();
    if (!prod || !prod.images || prod.images.length === 0) {
      return [PLACEHOLDER_IMAGE];
    }
    return prod.images;
  });

  protected readonly selectedImage = computed(() => {
    return this.images()[this.selectedImageIndex()];
  });

  protected readonly hasDiscount = computed(() => {
    const prod = this.product();
    return prod?.comparePrice && prod.comparePrice > prod.price;
  });

  protected readonly discountPercentage = computed(() => {
    const prod = this.product();
    if (!prod?.comparePrice || prod.comparePrice <= prod.price) return 0;
    return Math.round(((prod.comparePrice - prod.price) / prod.comparePrice) * 100);
  });

  protected readonly isOutOfStock = computed(() => {
    const stock = this.productStock();
    if (stock === null) return false; // Still loading — don't show "Agotado" yet
    return stock <= 0;
  });

  protected readonly quantityInCart = computed(() => {
    this.cartService.items();
    const prod = this.product();
    if (!prod) return 0;
    return this.cartService.getItemQuantity(prod.id);
  });

  protected readonly availableStock = computed(() => {
    this.cartService.items();
    const prod = this.product();
    if (!prod) return 0;
    const stock = this.productStock();
    if (stock === null) return 0;
    return Math.max(0, stock - this.quantityInCart());
  });

  protected readonly canAddMore = computed(() => {
    this.cartService.items();
    const prod = this.product();
    if (!prod) return false;
    return this.quantity() < this.availableStock();
  });

  protected readonly canAddToCart = computed(() => {
    this.cartService.items();
    const prod = this.product();
    const stock = this.productStock();
    if (!prod || stock === null || stock <= 0) return false;
    return this.quantity() <= this.availableStock();
  });

  protected readonly canRemove = computed(() => {
    return this.quantity() > 1;
  });

  ngOnInit(): void {
    this.route.params
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const id = params['id'];
        if (id) {
          this.loadProduct(id);
        } else {
          this.error.set('Producto no encontrado');
          this.isLoading.set(false);
        }
      });
  }

  private loadProduct(id: string): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.productStock.set(null); // Reset to "loading" state

    this.productService.getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.product.set(response.data);
          this.isLoading.set(false);
          this.selectedImageIndex.set(0);
          this.quantity.set(1);

          // Stock is loaded reactively via the effect when branchIds are available
          // Fallback: load immediately if location already resolved
          if (this.locationService.isResolved()) {
            this.loadStock(response.data.id);
          }

          if (response.data.categories && response.data.categories.length > 0) {
            this.loadRelatedProducts(response.data);
          }
        },
        error: () => {
          this.error.set('No se pudo cargar el producto');
          this.isLoading.set(false);
        },
      });
  }

  private loadStock(productId: string): void {
    const branchIds = this.locationService.branchIds();
    if (branchIds.length === 0) {
      this.productStock.set(0);
      return;
    }

    this.isLoadingStock.set(true);
    this.branchProductService.getAggregatedStock(productId, branchIds)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.productStock.set(res.data.totalStock);
          this.isLoadingStock.set(false);
        },
        error: () => {
          this.productStock.set(0);
          this.isLoadingStock.set(false);
        },
      });
  }

  private loadRelatedProducts(currentProduct: Product): void {
    this.loadingRelated.set(true);

    const firstCategory = currentProduct.categories?.[0];
    const categoryId =
      typeof firstCategory === 'string'
        ? firstCategory
        : firstCategory?.id;

    if (!categoryId) {
      this.loadingRelated.set(false);
      return;
    }

    const branchIds = this.locationService.branchIds();
    this.productService
      .getAll({
        category: categoryId,
        limit: 4,
        isActive: true,
        branchIds: branchIds.length > 0 ? branchIds.join(',') : undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const related = response.data
            .filter((p) => p.id !== currentProduct.id)
            .slice(0, 4)
            .map((p) => this.mapToCardData(p));
          this.relatedProducts.set(related);
          this.loadingRelated.set(false);
        },
        error: () => {
          this.loadingRelated.set(false);
        },
      });
  }

  private mapToCardData(product: Product): ProductCardData {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      comparePrice: product.comparePrice,
      images: product.images || [],
      stock: (product as any).totalStock ?? 0,
      brand: product.brand,
      productModel: product.productModel,
    };
  }

  // Image gallery
  selectImage(index: number): void {
    this.selectedImageIndex.set(index);
  }

  nextImage(): void {
    const current = this.selectedImageIndex();
    const total = this.images().length;
    this.selectedImageIndex.set((current + 1) % total);
  }

  prevImage(): void {
    const current = this.selectedImageIndex();
    const total = this.images().length;
    this.selectedImageIndex.set((current - 1 + total) % total);
  }

  // Quantity
  incrementQuantity(): void {
    if (this.canAddMore()) {
      this.quantity.update((q) => q + 1);
    }
  }

  decrementQuantity(): void {
    if (this.canRemove()) {
      this.quantity.update((q) => q - 1);
    }
  }

  // Cart
  addToCart(): void {
    if (!this.authService.isAuthenticated()) {
      this.authService.openAuthModal();
      return;
    }

    const prod = this.product();
    if (!prod || this.isOutOfStock() || !this.canAddToCart()) return;

    this.isAddingToCart.set(true);

    const result = this.cartService.addItem(
      {
        id: prod.id,
        name: prod.name,
        price: prod.price,
        image: prod.images?.[0] || '',
        stock: this.productStock() ?? 0,
        freeOilChangeService: prod.freeOilChangeService || false,
      },
      this.quantity()
    );

    if (result.success) {
      setTimeout(() => {
        this.isAddingToCart.set(false);
        this.justAddedToCart.set(true);
        const newAvailable = this.availableStock();
        this.quantity.set(newAvailable > 0 ? 1 : 0);
        setTimeout(() => this.justAddedToCart.set(false), 2000);
      }, 300);
    } else {
      this.isAddingToCart.set(false);

      if (result.error === 'not_authenticated') {
        this.authService.openAuthModal();
      } else if (result.error === 'stock_exceeded' || result.error === 'out_of_stock') {
        this.stockErrorMessage.set(result.message || 'Stock insuficiente');
        this.showStockError.set(true);
        setTimeout(() => this.showStockError.set(false), 3000);
      }
    }
  }

  // Image error fallback
  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
  }

  // Navigation
  goBack(): void {
    this.router.navigate(['/catalogo']);
  }

  // Template helpers
  getCategoryName(category: string | Category): string {
    if (typeof category === 'string') return category;
    return category?.name || '';
  }

  getBrandName(brand: string | Brand | undefined): string {
    if (!brand) return '';
    if (typeof brand === 'string') return brand;
    return brand?.name || '';
  }

  getLineName(line: string | Line | undefined): string {
    if (!line) return '';
    if (typeof line === 'string') return line;
    return line?.name || '';
  }
}
