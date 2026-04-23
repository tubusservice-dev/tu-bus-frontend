import { Component, inject, signal, Input } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { CartService, CartItem } from '../../../core/services/cart.service';
import { ExchangeRateService } from '../../../core/services/exchange-rate.service';

@Component({
  selector: 'app-cart-popover',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './cart-popover.component.html',
  styleUrl: './cart-popover.component.scss',
})
export class CartPopoverComponent {
  protected readonly cartService = inject(CartService);
  private readonly router = inject(Router);
  protected readonly exchangeRateService = inject(ExchangeRateService);

  /** Controla si el popover está abierto */
  protected readonly isOpen = signal(false);

  /**
   * When true (default), tapping the cart button on mobile (≤639px) navigates
   * directly to /carrito instead of opening the full-screen popover. Desktop
   * behavior stays unchanged — the anchored popover still opens. Set to
   * `false` explicitly only if a consumer needs the legacy full-screen popover
   * on mobile (no current consumer does).
   */
  @Input() mobileNavigatesToCart = true;

  togglePopover(): void {
    if (this.mobileNavigatesToCart && this.isMobileViewport()) {
      this.goToCart();
      return;
    }
    this.isOpen.update((value) => !value);
  }

  private isMobileViewport(): boolean {
    return typeof window !== 'undefined'
      && window.matchMedia('(max-width: 639px)').matches;
  }

  closePopover(): void {
    this.isOpen.set(false);
  }

  /** Navegar a la página del carrito */
  goToCart(): void {
    this.router.navigate(['/carrito']);
    this.closePopover();
  }

  goToCatalog(): void {
    this.router.navigate(['/catalogo']);
    this.closePopover();
  }

  onContinue(): void {
    this.router.navigate(['/carrito']);
    this.closePopover();
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
