import { Component, inject, computed, HostListener } from '@angular/core';
import { OverlayStackService } from '@core/services/overlay-stack.service';
import { CartService } from '@core/services/cart.service';
import { CartComponent } from '../cart.component';
import { HeaderShellComponent } from '@shared/components/header-shell/header-shell.component';
import { ANALYTICS, AnalyticsEvent } from '@platform';

/**
 * Full-screen overlay wrapper around `CartComponent`. Shares the exact chrome
 * (top-bar + back button + right-side title) with `ProductDetailPageComponent`
 * so navigating between overlays feels seamless.
 *
 * The inner `<app-cart>` hides its own `.page-header` while an overlay is on
 * screen so there's only one header visible at a time.
 */
@Component({
  selector: 'app-cart-overlay',
  standalone: true,
  imports: [CartComponent, HeaderShellComponent],
  templateUrl: './cart-overlay.component.html',
  styleUrl: './cart-overlay.component.scss',
})
export class CartOverlayComponent {
  protected readonly overlayService = inject(OverlayStackService);
  private readonly cartService = inject(CartService);
  private readonly analytics = inject(ANALYTICS);

  protected readonly totalItems = computed(() => this.cartService.totalItems());

  constructor() {
    // A fresh instance is mounted every time the cart overlay opens, so the
    // constructor is the natural place to log the cart view.
    void this.analytics.logEvent(AnalyticsEvent.ViewCart, {
      currency: 'USD',
      value: this.cartService.subtotal(),
      items: this.cartService.getAnalyticsItems(),
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.overlayService.goBack();
  }

  close(): void {
    this.overlayService.goBack();
  }
}
