import { Component, inject, output } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { CartService, CartItem } from '../../../core/services/cart.service';

@Component({
  selector: 'app-cart-modal',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './cart-modal.component.html',
  styleUrl: './cart-modal.component.scss',
})
export class CartModalComponent {
  protected readonly cartService = inject(CartService);
  private readonly router = inject(Router);

  /** Evento para cerrar el modal */
  readonly closeModal = output<void>();

  onClose(): void {
    this.closeModal.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  onContinue(): void {
    this.onClose();
    this.router.navigate(['/checkout/despacho']);
  }

  /** Verificar si un item puede incrementarse */
  canIncrement(item: CartItem): boolean {
    // Validar que stock sea un número válido
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
