import { Component, OnInit, OnChanges, SimpleChanges, Input, inject, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ProductService,
  DetailProduct,
  DetailRelatedProduct,
} from '../../core/services/product.service';
import { ProductDetailOverlayService } from '../../core/services/product-detail-overlay.service';
import { CartService } from '../../core/services/cart.service';
import { AuthService } from '../../core/services/auth.service';
import { LocationService } from '../../core/services/location.service';
import { ExchangeRateService } from '../../core/services/exchange-rate.service';
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
export class ProductDetailComponent implements OnInit, OnChanges {
  @Input() overlayProductId: string | null = null;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly productService = inject(ProductService);
  private readonly cartService = inject(CartService);
  private readonly authService = inject(AuthService);
  private readonly locationService = inject(LocationService);
  protected readonly exchangeRateService = inject(ExchangeRateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly overlayService = inject(ProductDetailOverlayService);

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
    if (stock === null) return false;
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
    const stock = this.productStock();
    if (stock === null) return 0;
    return Math.max(0, stock - this.quantityInCart());
  });

  protected readonly canAddMore = computed(() => {
    return this.quantity() < this.availableStock();
  });

  protected readonly canAddToCart = computed(() => {
    const stock = this.productStock();
    if (stock === null || stock <= 0) return false;
    return this.quantity() <= this.availableStock();
  });

  protected readonly canRemove = computed(() => {
    return this.quantity() > 1;
  });

  ngOnInit(): void {
    if (this.overlayProductId) {
      this.loadProductDetail(this.overlayProductId);
      return;
    }

    this.route.params
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const id = params['id'];
        if (id) {
          this.loadProductDetail(id);
        } else {
          this.error.set('Producto no encontrado');
          this.isLoading.set(false);
        }
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['overlayProductId'] && !changes['overlayProductId'].firstChange && this.overlayProductId) {
      this.loadProductDetail(this.overlayProductId);
    }
  }

  private loadProductDetail(id: string): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.productStock.set(null);

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
          this.selectedImageIndex.set(0);
          this.quantity.set(1);
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
        vehicleTypes: (prod as any).vehicleTypes,
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
    if (this.overlayProductId) {
      this.overlayService.close();
    } else {
      this.location.back();
    }
  }

  onRelatedProductClick(productId: string, event: Event): void {
    if (this.overlayProductId) {
      event.preventDefault();
      event.stopPropagation();
      this.overlayService.open(productId);
    }
  }

  // Template helpers
  getCategoryName(category: any): string {
    if (typeof category === 'string') return category;
    return category?.name || '';
  }

  getBrandName(brand: any): string {
    if (!brand) return '';
    if (typeof brand === 'string') return brand;
    return brand?.name || '';
  }

  getLineName(line: any): string {
    if (!line) return '';
    if (typeof line === 'string') return line;
    return line?.name || '';
  }
}
