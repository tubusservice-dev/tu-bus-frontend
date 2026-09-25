import { Component, effect, inject, signal, untracked, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CheckoutService, DispatchOption } from '../services/checkout.service';
import { CartService } from '@core/services/cart.service';
import { LocationStore } from '@core/services/location-store.service';
import { ZoneSelectorService } from '@core/services/zone-selector.service';
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
  private readonly locationStore = inject(LocationStore);
  private readonly zoneSelector = inject(ZoneSelectorService);

  /** An option picked without a location: chosen for real once the customer sets one. */
  private readonly pendingType = signal<DispatchOption['id']>(null);

  /** Dispatch options (reactive — computed from LocationStore + CartService) */
  protected readonly dispatchOptions = this.checkoutService.dispatchOptions;

  /** Currently selected type */
  protected readonly selectedType = this.checkoutService.dispatchType;

  constructor() {
    // Once a location is set (and its coverage known), the pending option is
    // selected if that zone offers it. Closing the selector without one drops it.
    effect(() => {
      const pending = this.pendingType();
      if (!pending) return;
      if (this.locationStore.hasLocation() && this.locationStore.isResolved()) {
        untracked(() => {
          const option = this.dispatchOptions().find((o) => o.id === pending);
          if (option && !option.requiresLocation) this.checkoutService.selectDispatchType(pending);
          this.pendingType.set(null);
        });
      } else if (!this.zoneSelector.isOpen() && !this.locationStore.hasLocation()) {
        untracked(() => this.pendingType.set(null));
      }
    });
  }

  ngOnInit(): void {
    // Auto-select home oil change when the cart has an oil combo and the zone offers it
    const oilChange = this.dispatchOptions().find((o) => o.id === 'oil_change_service');
    if (!this.selectedType() && oilChange && !oilChange.requiresLocation) {
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
    if (option.requiresLocation) {
      this.pendingType.set(option.id);
      this.zoneSelector.open();
      return;
    }
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
      // Delivery is priced per parish: "Gratis" only when it is free in the whole zone.
      (option.id === 'local_delivery' && !option.requiresLocation && this.locationStore.allFree())
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
