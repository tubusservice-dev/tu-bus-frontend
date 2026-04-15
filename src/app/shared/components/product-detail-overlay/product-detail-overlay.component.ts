import { Component, inject, signal, computed, effect, DestroyRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProductDetailOverlayService } from '../../../core/services/product-detail-overlay.service';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { AuthService } from '../../../core/services/auth.service';
import { LocationService } from '../../../core/services/location.service';
import { BranchProductService } from '../../../core/services/branch-product.service';
import { ExchangeRateService } from '../../../core/services/exchange-rate.service';
import { Product, Category, Brand, Line } from '../../../models/product.model';
import { ProductCardComponent, ProductCardData } from '../product-card/product-card.component';

const PLACEHOLDER = 'https://placehold.co/400x400/e5e7eb/9ca3af?text=Sin+imagen';

@Component({
  selector: 'app-product-detail-overlay',
  standalone: true,
  imports: [CommonModule, ProductCardComponent],
  templateUrl: './product-detail-overlay.component.html',
  styleUrls: [
    '../../../features/product-detail/product-detail.component.scss',
    './product-detail-overlay.component.scss',
  ],
})
export class ProductDetailOverlayComponent {
  protected readonly overlayService = inject(ProductDetailOverlayService);
  private readonly productService = inject(ProductService);
  private readonly cartService = inject(CartService);
  private readonly authService = inject(AuthService);
  private readonly locationService = inject(LocationService);
  private readonly branchProductService = inject(BranchProductService);
  protected readonly exchangeRateService = inject(ExchangeRateService);
  private readonly destroyRef = inject(DestroyRef);

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

  // Stock
  protected readonly productStock = signal<number | null>(null);
  protected readonly bestBranchName = signal<string | null>(null);
  protected readonly isLoadingStock = signal(false);

  // Cart feedback
  protected readonly showStockError = signal(false);
  protected readonly stockErrorMessage = signal('');
  protected readonly isAddingToCart = signal(false);
  protected readonly justAddedToCart = signal(false);

  // Computed
  protected readonly images = computed(() => {
    const prod = this.product();
    if (!prod?.images?.length) return [PLACEHOLDER];
    return prod.images;
  });

  protected readonly selectedImage = computed(() => this.images()[this.selectedImageIndex()]);

  protected readonly hasDiscount = computed(() => {
    const prod = this.product();
    return prod?.comparePrice != null && prod.comparePrice > prod.price;
  });

  protected readonly discountPercentage = computed(() => {
    const prod = this.product();
    if (!prod?.comparePrice || prod.comparePrice <= prod.price) return 0;
    return Math.round(((prod.comparePrice - prod.price) / prod.comparePrice) * 100);
  });

  protected readonly isOutOfStock = computed(() => {
    const stock = this.productStock();
    if (stock === null) return false;
    return stock <= 0;
  });

  protected readonly quantityInCart = computed(() => {
    this.cartService.items();
    const prod = this.product();
    return prod ? this.cartService.getItemQuantity(prod.id) : 0;
  });

  protected readonly availableStock = computed(() => {
    this.cartService.items();
    const stock = this.productStock();
    if (stock === null) return 0;
    return Math.max(0, stock - this.quantityInCart());
  });

  protected readonly canAddMore = computed(() => this.quantity() < this.availableStock());
  protected readonly canRemove = computed(() => this.quantity() > 1);
  protected readonly canAddToCart = computed(() => {
    this.cartService.items();
    const prod = this.product();
    const stock = this.productStock();
    if (!prod || stock === null || stock <= 0) return false;
    return this.quantity() <= this.availableStock();
  });

  constructor() {
    // Load product when overlay opens or productId changes
    effect(() => {
      const id = this.overlayService.productId();
      if (id) {
        this.loadProduct(id);
      }
    });

    // Reload stock when location resolves
    effect(() => {
      const resolved = this.locationService.isResolved();
      const branchIds = this.locationService.branchIds();
      const prod = this.product();
      if (resolved && prod && branchIds.length > 0) {
        this.loadStock(prod.id);
      }
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  close(): void {
    this.overlayService.close();
  }

  // ==================== DATA LOADING ====================

  private loadProduct(id: string): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.productStock.set(null);
    this.selectedImageIndex.set(0);
    this.quantity.set(1);

    this.productService.getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.product.set(response.data);
          this.isLoading.set(false);
          if (this.locationService.isResolved()) {
            this.loadStock(response.data.id);
          }
          if (response.data.categories?.length) {
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
    if (!branchIds.length) { this.productStock.set(0); return; }

    this.isLoadingStock.set(true);
    this.branchProductService.getAggregatedStock(productId, branchIds)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          const best = res.data.bestBranch;
          this.productStock.set(best?.stock ?? 0);
          const zoneBranchCount = this.locationService.branches().length;
          const branchesWithStock = res.data.byBranch.filter((b: any) => b.stock > 0);
          this.bestBranchName.set(zoneBranchCount > 1 && branchesWithStock.length === 1 ? best?.branchName ?? null : null);
          this.isLoadingStock.set(false);
        },
        error: () => { this.productStock.set(0); this.isLoadingStock.set(false); },
      });
  }

  private loadRelatedProducts(currentProduct: Product): void {
    const firstCat = currentProduct.categories?.[0];
    const catId = typeof firstCat === 'string' ? firstCat : (firstCat?.id || (firstCat as any)?._id);
    if (!catId) return;

    const branchIds = this.locationService.branchIds();
    this.productService.getAll({
      category: catId, limit: 4, isActive: true,
      branchIds: branchIds.length > 0 ? branchIds.join(',') : undefined,
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.relatedProducts.set(
            response.data
              .filter(p => p.id !== currentProduct.id)
              .slice(0, 4)
              .map(p => ({
                id: p.id, name: p.name, slug: p.slug, description: p.description,
                price: p.price, comparePrice: p.comparePrice,
                images: p.images || [], stock: (p as any).totalStock ?? 0,
                brand: p.brand, productModel: p.productModel,
              }))
          );
        },
      });
  }

  // ==================== IMAGE GALLERY ====================
  selectImage(index: number): void { this.selectedImageIndex.set(index); }
  nextImage(): void { this.selectedImageIndex.set((this.selectedImageIndex() + 1) % this.images().length); }
  prevImage(): void { this.selectedImageIndex.set((this.selectedImageIndex() - 1 + this.images().length) % this.images().length); }

  // ==================== QUANTITY ====================
  incrementQuantity(): void { if (this.canAddMore()) this.quantity.update(q => q + 1); }
  decrementQuantity(): void { if (this.canRemove()) this.quantity.update(q => q - 1); }

  // ==================== CART ====================
  addToCart(): void {
    if (!this.authService.isAuthenticated()) { this.authService.openAuthModal(); return; }
    const prod = this.product();
    if (!prod || this.isOutOfStock() || !this.canAddToCart()) return;

    this.isAddingToCart.set(true);
    const result = this.cartService.addItem({
      id: prod.id, name: prod.name, price: prod.price,
      image: prod.images?.[0] || '', stock: this.productStock() ?? 0,
      freeOilChangeService: prod.freeOilChangeService || false,
      vehicleTypes: prod.vehicleTypes,
    }, this.quantity());

    if (result.success) {
      setTimeout(() => {
        this.isAddingToCart.set(false);
        this.justAddedToCart.set(true);
        this.quantity.set(this.availableStock() > 0 ? 1 : 0);
        setTimeout(() => this.justAddedToCart.set(false), 2000);
      }, 300);
    } else {
      this.isAddingToCart.set(false);
      if (result.error === 'not_authenticated') { this.authService.openAuthModal(); }
      else if (result.error === 'stock_exceeded' || result.error === 'out_of_stock') {
        this.stockErrorMessage.set(result.message || 'Stock insuficiente');
        this.showStockError.set(true);
        setTimeout(() => this.showStockError.set(false), 3000);
      }
    }
  }

  // ==================== HELPERS ====================
  onImageError(event: Event): void { (event.target as HTMLImageElement).src = PLACEHOLDER; }
  getCategoryName(cat: string | Category): string { return typeof cat === 'string' ? cat : cat?.name || ''; }
  getBrandName(brand: string | Brand | undefined): string { if (!brand) return ''; return typeof brand === 'string' ? brand : brand?.name || ''; }
  getLineName(line: string | Line | undefined): string { if (!line) return ''; return typeof line === 'string' ? line : line?.name || ''; }
}
