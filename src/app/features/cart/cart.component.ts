import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { CartService, CartItem } from '../../core/services/cart.service';
import { ExchangeRateService } from '../../core/services/exchange-rate.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss',
})
export class CartComponent {
  protected readonly cartService = inject(CartService);
  private readonly router = inject(Router);
  protected readonly exchangeRateService = inject(ExchangeRateService);

  /** Controla si el modal de confirmación está abierto */
  protected readonly showClearConfirm = signal(false);

  onContinue(): void {
    this.router.navigate(['/checkout/despacho']);
  }

  goToCatalog(): void {
    this.router.navigate(['/catalogo']);
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
