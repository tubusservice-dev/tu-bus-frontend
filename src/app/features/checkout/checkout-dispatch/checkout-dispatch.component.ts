import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CheckoutService, DispatchOption } from '../services/checkout.service';
import { CartService } from '@core/services/cart.service';
import { CheckoutHeaderComponent } from '../components/checkout-header/checkout-header.component';
import { ANALYTICS, AnalyticsEvent } from '@platform';

@Component({
  selector: 'app-checkout-dispatch',
  standalone: true,
  imports: [CheckoutHeaderComponent],
  templateUrl: './checkout-dispatch.component.html',
  styleUrl: './checkout-dispatch.component.scss',
})
export class CheckoutDispatchComponent implements OnInit {
  protected readonly checkoutService = inject(CheckoutService);
  protected readonly cartService = inject(CartService);
  private readonly router = inject(Router);
  private readonly analytics = inject(ANALYTICS);

  /** Dispatch options (reactive — computed from LocationService + CartService) */
  protected readonly dispatchOptions = this.checkoutService.dispatchOptions;

  /** Currently selected type */
  protected readonly selectedType = this.checkoutService.dispatchType;

  ngOnInit(): void {
    // Auto-select oil change service if applicable and no prior selection
    if (!this.selectedType() && this.cartService.hasOilChangeService()) {
      this.checkoutService.selectDispatchType('oil_change_service');
    }

    // Funnel entry: reaching the dispatch step is the start of checkout.
    void this.analytics.logEvent(AnalyticsEvent.BeginCheckout, {
      currency: 'USD',
      value: this.cartService.subtotal(),
      items: this.cartService.getAnalyticsItems(),
    });
  }

  selectOption(option: DispatchOption): void {
    if (!option.isAvailable) return;
    this.checkoutService.selectDispatchType(option.id);
  }

  isSelected(option: DispatchOption): boolean {
    return this.selectedType() === option.id;
  }

  isFree(option: DispatchOption): boolean {
    if (!option.isAvailable) return false;
    return (
      option.id === 'store_pickup' ||
      option.id === 'oil_change_service' ||
      option.id === 'in_store_oil_change' ||
      (option.id === 'local_delivery' && option.price === null)
    );
  }

  onContinue(): void {
    const dispatchType = this.selectedType();

    // Funnel: dispatch method chosen. `shipping_tier` lets GA4 break the
    // funnel down by dispatch type (pickup vs delivery vs agency, etc.).
    if (dispatchType) {
      void this.analytics.logEvent(AnalyticsEvent.AddShippingInfo, {
        currency: 'USD',
        value: this.cartService.subtotal(),
        shipping_tier: dispatchType,
        items: this.cartService.getAnalyticsItems(),
      });
    }

    switch (dispatchType) {
      case 'store_pickup':
        // Direct to summary (no form needed)
        this.router.navigate(['/checkout/resumen']);
        break;
      case 'in_store_oil_change':
        // Needs a dedicated vehicle-only step before the summary
        this.router.navigate(['/checkout/cambio-aceite-tienda']);
        break;
      case 'seller_agreement':
        this.router.navigate(['/checkout/vendedor']);
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
      default:
        // Defensive: button is already gated, but guards against future changes
        console.warn('[CheckoutDispatch] No dispatch type selected');
        return;
    }
  }

  goBack(): void {
    this.router.navigate(['/carrito']);
  }
}
