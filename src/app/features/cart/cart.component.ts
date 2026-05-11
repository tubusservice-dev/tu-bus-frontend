import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { CartService, CartItem } from '../../core/services/cart.service';
import { ExchangeRateService } from '../../core/services/exchange-rate.service';
import { OverlayStackService } from '../../core/services/overlay-stack.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss',
})
export class CartComponent {
  protected readonly cartService = inject(CartService);
  private readonly router = inject(Router);
  protected readonly exchangeRateService = inject(ExchangeRateService);
  private readonly overlayService = inject(OverlayStackService);

  /** True when this cart is mounted inside the overlay stack. The page
   *  header is suppressed in that case because `CartOverlayComponent`
   *  supplies the chrome instead — prevents the double-header we had
   *  before. */
  protected readonly isInOverlay = this.overlayService.isOpen;

  /** Controla si el modal de confirmación está abierto */
  protected readonly showClearConfirm = signal(false);

  onContinue(): void {
    this.router.navigate(['/checkout/despacho']);
  }

  goToCatalog(): void {
    const currentUrl = this.router.url.split('?')[0].split('#')[0];

    // Already on /catalogo: router.navigate would be a no-op
    // (onSameUrlNavigation: 'ignore'), so just pop the overlay.
    if (currentUrl === '/catalogo') {
      if (this.overlayService.isOpen()) {
        this.overlayService.goBack();
      }
      return;
    }

    // Any other route: navigate. The NavigationEnd subscription in
    // OverlayStackService clears the stack automatically.
    this.router.navigate(['/catalogo']);
  }

  /** Header back button. When this cart is mounted inside an overlay,
   *  popping the overlay is the right action (reveals whatever was behind,
   *  typically a product detail or the catalog). Outside of an overlay
   *  (edge cases / direct route), fall back to navigating to the catalog. */
  handleHeaderBack(): void {
    if (this.overlayService.isOpen()) {
      this.overlayService.goBack();
    } else {
      this.router.navigate(['/catalogo']);
    }
  }

  /** Abrir modal de confirmación */
  openClearConfirm(): void {
    this.showClearConfirm.set(true);
  }

  /** Cerrar modal de confirmación */
  closeClearConfirm(): void {
    this.showClearConfirm.set(false);
  }

  /** Confirmar y vaciar el carrito */
  confirmClearCart(): void {
    this.cartService.clearCart();
    this.showClearConfirm.set(false);
  }

  /** Verificar si un item puede incrementarse */
  canIncrement(item: CartItem): boolean {
    const stock = typeof item.stock === 'number' && !isNaN(item.stock) ? item.stock : 0;
    return item.quantity < stock;
  }

  /** Incrementar cantidad con validación */
  incrementItem(itemId: string): void {
    this.cartService.incrementQuantity(itemId);
  }

  /** Decrementar cantidad */
  decrementItem(itemId: string): void {
    this.cartService.decrementQuantity(itemId);
  }
}
