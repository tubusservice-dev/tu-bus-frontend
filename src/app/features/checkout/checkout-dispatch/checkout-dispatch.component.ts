import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CheckoutService, DispatchOption } from '../services/checkout.service';
import { CartService } from '../../../core/services/cart.service';

@Component({
  selector: 'app-checkout-dispatch',
  standalone: true,
  imports: [],
  templateUrl: './checkout-dispatch.component.html',
  styleUrl: './checkout-dispatch.component.scss',
})
export class CheckoutDispatchComponent implements OnInit {
  protected readonly checkoutService = inject(CheckoutService);
  protected readonly cartService = inject(CartService);
  private readonly router = inject(Router);

  /** Dispatch options (reactive — computed from LocationService + CartService) */
  protected readonly dispatchOptions = this.checkoutService.dispatchOptions;

  /** Currently selected type */
  protected readonly selectedType = this.checkoutService.dispatchType;

  ngOnInit(): void {
    // Auto-select oil change service if applicable and no prior selection
    if (!this.selectedType() && this.cartService.hasOilChangeService()) {
      this.checkoutService.selectDispatchType('oil_change_service');
    }
  }

  selectOption(option: DispatchOption): void {
    if (!option.isAvailable) return;
    this.checkoutService.selectDispatchType(option.id);
  }

  isSelected(option: DispatchOption): boolean {
    return this.selectedType() === option.id;
  }

  onContinue(): void {
    const dispatchType = this.selectedType();

    switch (dispatchType) {
      case 'store_pickup':
      case 'seller_agreement':
      case 'in_store_oil_change':
        // Direct to summary (no form needed)
        this.router.navigate(['/checkout/resumen']);
        break;
      case 'shipping_agency':
        this.router.navigate(['/checkout/agencia']);
        break;
      case 'local_delivery':
        this.router.navigate(['/checkout/delivery']);
        break;
      case 'oil_change_service':
        this.router.navigate(['/checkout/cambio-aceite']);
        break;
    }
  }

  goBack(): void {
    this.router.navigate(['/carrito']);
  }
}
