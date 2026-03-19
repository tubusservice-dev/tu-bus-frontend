import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { CheckoutService, DispatchOption } from '../services/checkout.service';
import { CartService } from '../../../core/services/cart.service';

@Component({
  selector: 'app-checkout-dispatch',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './checkout-dispatch.component.html',
  styleUrl: './checkout-dispatch.component.scss',
})
export class CheckoutDispatchComponent {
  protected readonly checkoutService = inject(CheckoutService);
  protected readonly cartService = inject(CartService);
  private readonly router = inject(Router);

  /** Opciones de despacho */
  protected readonly dispatchOptions = this.checkoutService.dispatchOptions;

  /** Tipo seleccionado */
  protected readonly selectedType = this.checkoutService.dispatchType;

  /**
   * Seleccionar una opción de despacho
   */
  selectOption(option: DispatchOption): void {
    if (!option.isAvailable) return;
    this.checkoutService.selectDispatchType(option.id);
  }

  /**
   * Verificar si una opción está seleccionada
   */
  isSelected(option: DispatchOption): boolean {
    return this.selectedType() === option.id;
  }

  /**
   * Continuar al siguiente paso
   */
  onContinue(): void {
    const dispatchType = this.selectedType();

    switch (dispatchType) {
      case 'store_pickup':
        this.router.navigate(['/checkout/resumen']);
        break;
      case 'shipping_agency':
        this.router.navigate(['/checkout/agencia']);
        break;
      case 'local_delivery':
        this.router.navigate(['/checkout/delivery']);
        break;
    }
  }

  /**
   * Volver al carrito
   */
  goBack(): void {
    this.router.navigate(['/carrito']);
  }
}
