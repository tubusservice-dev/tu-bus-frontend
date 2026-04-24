import { Component, inject, signal, computed, Input, OnInit, DestroyRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OverlayStackService } from '../../../core/services/overlay-stack.service';
import { ProductService, DetailProduct, DetailRelatedProduct } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { AuthService } from '../../../core/services/auth.service';
import { LocationService } from '../../../core/services/location.service';
import { ExchangeRateService } from '../../../core/services/exchange-rate.service';
import { ProductCardComponent, ProductCardData } from '../../../shared/components/product-card/product-card.component';
import { CartPopoverComponent } from '../../../shared/components/cart-popover/cart-popover.component';
import { VEHICLE_TYPE_LABELS, VehicleType } from '../../../models/product.model';

const PLACEHOLDER = 'https://placehold.co/400x400/e5e7eb/9ca3af?text=Sin+imagen';

/**
 * Full-screen product detail view rendered as an overlay on top of any
 * route. The app shell mounts one instance per entry in the
 * `OverlayStackService` stack, so opening a related product pushes
 * a NEW instance on top — the previous one stays mounted underneath with
 * all its state (scroll position, selected image, quantity) intact.
 * Going back unmounts only the top instance; no API refetch happens.
 */
@Component({
  selector: 'app-product-detail-page',
  standalone: true,
  imports: [CommonModule, ProductCardComponent, CartPopoverComponent],
  templateUrl: './product-detail-page.component.html',
  styleUrl: './product-detail-page.component.scss',
})
export class ProductDetailPageComponent implements OnInit {
  /** The product id this instance is responsible for. Wired from the app
   *  shell's `@for` over the overlay stack — never mutates after init, so
   *  the instance loads its data once in `ngOnInit` and lives unchanged
   *  until the user pops back past it. */
  @Input({ required: true }) productId!: string;

  protected readonly overlayService = inject(OverlayStackService);
  private readonly productService = inject(ProductService);
  private readonly cartService = inject(CartService);
  private readonly authService = inject(AuthService);
  private readonly locationService = inject(LocationService);
  protected readonly exchangeRateService = inject(ExchangeRateService);
  private readonly destroyRef = inject(DestroyRef);

  // Core state
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly product = signal<DetailProduct | null>(null);

  // Image gallery
  protected readonly selectedImageIndex = signal(0);

  // Quantity
  protected readonly quantity = signal(1);

  // Related products
  protected readonly relatedProducts = signal<ProductCardData[]>([]);

  // Stock
  protected readonly productStock = signal<number | null>(null);
  protected readonly bestBranchName = signal<string | null>(null);

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

  /** Total items across all products in cart. Drives the "Ir al carrito" CTA
   *  so the user is never stranded inside the full-screen detail overlay
   *  after adding a product (critical on mobile where the header is covered). */
  protected readonly cartItemCount = computed(() => this.cartService.totalItems());

  protected readonly canAddMore = computed(() => this.quantity() < this.availableStock());
  protected readonly canRemove = computed(() => this.quantity() > 1);
  protected readonly canAddToCart = computed(() => {
    this.cartService.items();
    const stock = this.productStock();
    if (stock === null || stock <= 0) return false;
    return this.quantity() <= this.availableStock();
  });

  ngOnInit(): void {
    // Load once per instance. Subsequent opens mount new instances; this one
    // never needs to re-fetch.
    this.loadProductDetail(this.productId);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.close();
  }

  /** "Volver" action — pops only the top instance of the overlay stack.
   *  Routes through history.back() so OS/browser back gestures follow the
   *  same code path. */
  close(): void {
    this.overlayService.goBack();
  }

  goToCart(): void {
    // Cart is now an overlay of its own — push it on top of this detail.
    // Back will pop the cart and reveal this product with full state
    // preserved (scroll, selected image, quantity).
    this.overlayService.openCart();
  }

  // ==================== DATA LOADING (SINGLE REQUEST) ====================

  private loadProductDetail(id: string): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.productStock.set(null);
    this.selectedImageIndex.set(0);
    this.quantity.set(1);

    const branchIds = this.locationService.branchIds();
    const branchIdsParam = branchIds.length > 0 ? branchIds.join(',') : undefined;

    this.productService.getDetail(id, branchIdsParam)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const { product, stock, related } = response.data;

          this.product.set(product);
          this.productStock.set(stock.total);
          this.bestBranchName.set(stock.branchName);
          this.relatedProducts.set(related.map(r => this.mapToCardData(r)));

          this.isLoading.set(false);
        },
        error: () => {
          this.error.set('No se pudo cargar el producto');
          this.isLoading.set(false);
        },
      });
  }

  private mapToCardData(product: DetailRelatedProduct): ProductCardData {
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      comparePrice: product.comparePrice,
      images: product.images || [],
      stock: product.stock ?? 0,
      brand: product.brand as any,
      productModel: product.productModel,
      freeOilChangeService: (product as any).freeOilChangeService || false,
    };
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

  // ==================== RELATED PRODUCTS ====================

  /** Exposed to the template for the mobile mini-card fallback image. */
  protected readonly PLACEHOLDER = PLACEHOLDER;

  /** True when a related product has no stock. Drives the disabled state of
   *  the mobile mini-card so the user can't open an unpurchasable detail. */
  isRelatedOutOfStock(product: ProductCardData): boolean {
    return product.stock !== undefined && product.stock <= 0;
  }

  /** Pushes a new overlay on top with the related product. A fresh component
   *  instance is mounted above; this one stays alive behind with its scroll
   *  and UI state preserved, ready to be revealed when the user pops back. */
  openRelated(id: string): void {
    this.overlayService.openProduct(id);
  }

  // ==================== HELPERS ====================
  onImageError(event: Event): void { (event.target as HTMLImageElement).src = PLACEHOLDER; }
  getCategoryName(cat: any): string { return typeof cat === 'string' ? cat : cat?.name || ''; }
  getBrandName(brand: any): string { if (!brand) return ''; return typeof brand === 'string' ? brand : brand?.name || ''; }
  getLineName(line: any): string { if (!line) return ''; return typeof line === 'string' ? line : line?.name || ''; }

  /**
   * Human-readable list of vehicle types the product applies to. Collapses to
   * a single "Todos los vehículos" label when `all` is present.
   */
  getVehicleTypesLabel(types?: string[]): string {
    if (!types || !types.length) return '';
    if (types.includes(VehicleType.ALL)) return VEHICLE_TYPE_LABELS[VehicleType.ALL];
    return types.map(t => VEHICLE_TYPE_LABELS[t as VehicleType] || t).join(', ');
  }
}
