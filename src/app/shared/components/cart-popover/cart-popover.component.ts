import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { CartService, CartItem } from '../../../core/services/cart.service';

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

  /** Controla si el popover está abierto */
  protected readonly isOpen = signal(false);

  togglePopover(): void {
    this.isOpen.update((value) => !value);
  }

  closePopover(): void {
    this.isOpen.set(false);
  }

  /** Navegar a la página del carrito */
  goToCart(): void {
    this.closePopover();
    this.router.navigate(['/carrito']);
  }

  onContinue(): void {
    this.closePopover();
    this.router.navigate(['/carrito']);
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
