import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { AuthService } from '../../core/services/auth.service';
import { Product, Category, Brand, Line } from '../../models/product.model';
import {
  ProductCardComponent,
  ProductCardData,
} from '../../shared/components/product-card/product-card.component';

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

  // Estado principal
  protected readonly isLoading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly product = signal<Product | null>(null);

  // Galería de imágenes
  protected readonly selectedImageIndex = signal(0);

  // Cantidad a agregar
  protected readonly quantity = signal(1);

  // Productos relacionados
  protected readonly relatedProducts = signal<ProductCardData[]>([]);
  protected readonly loadingRelated = signal(false);

  // Estado de login para carrito
  protected readonly showLoginMessage = signal(false);
  protected readonly showStockError = signal(false);
  protected readonly stockErrorMessage = signal('');
  protected readonly isAddingToCart = signal(false);
  protected readonly justAddedToCart = signal(false);

  // Computed
  protected readonly images = computed(() => {
    const prod = this.product();
    if (!prod || !prod.images || prod.images.length === 0) {
      return ['https://placehold.co/400x400/e5e7eb/9ca3af?text=Sin+imagen'];
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
    const prod = this.product();
    return !prod || prod.stock <= 0;
  });

  // Cantidad ya en el carrito (reactivo - depende del signal items del carrito)
  protected readonly quantityInCart = computed(() => {
    // Acceder al signal items para crear dependencia reactiva
    this.cartService.items();
    const prod = this.product();
    if (!prod) return 0;
    return this.cartService.getItemQuantity(prod.id);
  });

  // Stock disponible para agregar (stock total - cantidad en carrito)
  protected readonly availableStock = computed(() => {
    // Acceder al signal items para crear dependencia reactiva
    this.cartService.items();
    const prod = this.product();
    if (!prod) return 0;
    return Math.max(0, prod.stock - this.quantityInCart());
  });

  protected readonly canAddMore = computed(() => {
    // Acceder al signal items para crear dependencia reactiva
    this.cartService.items();
    const prod = this.product();
    if (!prod) return false;
    // Puede incrementar si la cantidad seleccionada + lo que ya tiene en carrito < stock
    return this.quantity() < this.availableStock();
  });

  // Puede agregar al carrito si la cantidad seleccionada <= stock disponible
  protected readonly canAddToCart = computed(() => {
    // Acceder al signal items para crear dependencia reactiva
    this.cartService.items();
    const prod = this.product();
    if (!prod || prod.stock <= 0) return false;
    return this.quantity() <= this.availableStock();
  });

  protected readonly canRemove = computed(() => {
    return this.quantity() > 1;
  });

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      const id = params['id'];
      if (id) {
        this.loadProduct(id);
      }
    });
  }

  private loadProduct(id: string): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.productService.getById(id).subscribe({
      next: (response) => {
        this.product.set(response.data);
        this.isLoading.set(false);
        this.selectedImageIndex.set(0);
        this.quantity.set(1);

        // Cargar productos relacionados
        if (response.data.categories && response.data.categories.length > 0) {
          this.loadRelatedProducts(response.data);
        }
      },
      error: (err) => {
        console.error('Error loading product:', err);
        this.error.set('No se pudo cargar el producto');
        this.isLoading.set(false);
      },
    });
  }

  private loadRelatedProducts(currentProduct: Product): void {
    this.loadingRelated.set(true);

    // Usar la primera categoría para buscar productos relacionados
    const firstCategory = currentProduct.categories?.[0];
    const categoryId =
      typeof firstCategory === 'string'
        ? firstCategory
        : firstCategory?.id;

    if (!categoryId) {
      this.loadingRelated.set(false);
      return;
    }

    this.productService
      .getAll({
        category: categoryId,
        limit: 4,
        isActive: true,
      })
      .subscribe({
        next: (response) => {
          // Filtrar el producto actual
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
      stock: product.stock,
      brand: product.brand,
      productModel: product.productModel,
    };
  }

  // Acciones de galería
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

  // Acciones de cantidad
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

  // Agregar al carrito
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
        stock: prod.stock || 0,
        freeOilChangeService: prod.freeOilChangeService || false,
      },
      this.quantity()
    );

    if (result.success) {
      // Feedback visual de éxito
      setTimeout(() => {
        this.isAddingToCart.set(false);
        this.justAddedToCart.set(true);
        // Reset quantity al máximo disponible o 1
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

  // Navegación
  goBack(): void {
    this.router.navigate(['/catalogo']);
  }

  // Helpers para template
  getCategoryName(category: string | Category): string {
    if (typeof category === 'string') {
      return category;
    }
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
