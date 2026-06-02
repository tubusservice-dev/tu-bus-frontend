import { Component, Input, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ImageCarouselComponent } from '../image-carousel/image-carousel.component';
import { CartService } from '../../../core/services/cart.service';
import { OverlayStackService } from '../../../core/services/overlay-stack.service';
import { AuthService } from '../../../core/services/auth.service';
import { ExchangeRateService } from '../../../core/services/exchange-rate.service';
import { ANALYTICS, AnalyticsEvent } from '@platform';
import { Line, Category, Brand } from '../../../models';

/**
 * Minimal object shape the card needs from a brand/category/line — only the
 * name is rendered, the id is kept for future click-through. Accepting this
 * shape (in addition to the full domain types) lets the lightweight catalog
 * DTO feed the card directly without lossy casts.
 */
export interface CardBrandRef {
  id?: string;
  name: string;
}
export interface CardCategoryRef {
  id?: string;
  name: string;
}
export interface CardLineRef {
  id?: string;
  name: string;
}

export interface ProductCardData {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  price: number;
  comparePrice?: number | null;
  images: string[];
  brand?: string | Brand | CardBrandRef;
  productModel?: string;
  line?: string | Line | CardLineRef;
  categories?: (string | Category | CardCategoryRef)[];
  isActive?: boolean;
  isFeatured?: boolean;
  isCombo?: boolean;
  stock?: number;
  freeOilChangeService?: boolean;
  /** Union of vehicleTypes from categories — surfaced for vehicle-match warnings */
  vehicleTypes?: string[];
}

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, ImageCarouselComponent],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss',
  host: {
    class: 'block w-full h-full',
  },
})
export class ProductCardComponent {
  private readonly router = inject(Router);
  private readonly cartService = inject(CartService);
  private readonly authService = inject(AuthService);
  protected readonly exchangeRateService = inject(ExchangeRateService);

  @Input({ required: true }) product!: ProductCardData;
  @Input() showAddToCart = true;
  @Input() carouselHeight = '200px';
  @Input() linkToDetail = true;
  @Input() showFeaturedBadge = false;

  protected readonly isAdding = signal(false);
  protected readonly justAdded = signal(false);
  protected readonly showLoginMessage = signal(false);
  protected readonly showStockError = signal(false);
  protected readonly stockErrorMessage = signal('');

  // Computed reactivo que depende del signal items del carrito
  protected readonly quantityInCart = computed(() => {
    // Acceder al signal items para crear dependencia reactiva
    this.cartService.items();
    return this.cartService.getItemQuantity(this.product?.id || '');
  });

  // Computed reactivo para saber si se puede agregar más
  protected readonly canAddToCart = computed(() => {
    // Acceder al signal items para crear dependencia reactiva
    this.cartService.items();
    if (!this.product) return false;
    if (this.product.stock !== undefined && this.product.stock <= 0) return false;
    const stock = this.product.stock || 0;
    return this.cartService.canAddMore(this.product.id, stock);
  });

  get hasDiscount(): boolean {
    return !!(this.product.comparePrice && this.product.comparePrice > this.product.price);
  }

  get discountPercentage(): number {
    if (!this.hasDiscount) return 0;
    return Math.round((1 - this.product.price / this.product.comparePrice!) * 100);
  }

  get isOutOfStock(): boolean {
    return this.product.stock !== undefined && this.product.stock <= 0;
  }

  get lineName(): string {
    if (!this.product.line) return '';
    if (typeof this.product.line === 'string') return this.product.line;
    return this.product.line.name || '';
  }

  get brandName(): string {
    if (!this.product.brand) return '';
    if (typeof this.product.brand === 'string') return this.product.brand;
    return this.product.brand.name || '';
  }

  get firstCategoryName(): string {
    if (!this.product.categories || this.product.categories.length === 0) return '';
    const cat = this.product.categories[0];
    if (typeof cat === 'string') return cat;
    return cat.name || '';
  }

  addToCart(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    // Verificar autenticación primero
    if (!this.authService.isAuthenticated()) {
      this.authService.openAuthModal();
      return;
    }

    // Verificar stock antes de proceder
    if (this.isOutOfStock || this.isAdding() || !this.canAddToCart()) {
      // Si ya está en el máximo, mostrar mensaje
      if (!this.canAddToCart() && !this.isOutOfStock) {
        const currentQty = this.quantityInCart();
        this.stockErrorMessage.set(`Ya tienes ${currentQty} en el carrito (máximo disponible)`);
        this.showStockError.set(true);
        setTimeout(() => this.showStockError.set(false), 3000);
      }
      return;
    }

    this.isAdding.set(true);

    const result = this.cartService.addItem({
      id: this.product.id,
      name: this.product.name,
      price: this.product.price,
      image: this.product.images[0] || '',
      stock: this.product.stock || 0,
      freeOilChangeService: this.product.freeOilChangeService || false,
      vehicleTypes: this.product.vehicleTypes,
      isCombo: this.product.isCombo,
    });

    if (result.success) {
      // Feedback visual de éxito
      setTimeout(() => {
        this.isAdding.set(false);
        this.justAdded.set(true);
        setTimeout(() => this.justAdded.set(false), 1500);
      }, 300);
    } else {
      this.isAdding.set(false);

      if (result.error === 'not_authenticated') {
        this.authService.openAuthModal();
      } else if (result.error === 'stock_exceeded' || result.error === 'out_of_stock') {
        this.stockErrorMessage.set(result.message || 'Stock insuficiente');
        this.showStockError.set(true);
        setTimeout(() => this.showStockError.set(false), 3000);
      }
    }
  }

  private readonly overlayService = inject(OverlayStackService);
  private readonly analytics = inject(ANALYTICS);

  navigateToDetail(): void {
    if (this.linkToDetail) {
      void this.analytics.logEvent(AnalyticsEvent.SelectItem, {
        item_list_name: 'catalog',
        items: [
          {
            item_id: this.product.id,
            item_name: this.product.name,
            price: this.product.price,
          },
        ],
      });
      this.overlayService.openProduct(this.product.id);
    }
  }
}
