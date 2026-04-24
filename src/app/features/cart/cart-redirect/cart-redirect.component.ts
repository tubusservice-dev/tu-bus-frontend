import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { OverlayStackService } from '../../../core/services/overlay-stack.service';

/**
 * Landing component for the legacy `/carrito` URL. The cart is no longer a
 * dedicated route — it's an overlay on top of the catalog. External links,
 * bookmarks or stored URLs that still point to `/carrito` land here, are
 * redirected to the catalog, and the cart overlay opens automatically.
 *
 * Navigation happens first (so `NavigationEnd` clears any pre-existing
 * overlay stack), then the overlay is pushed — otherwise the auto-close
 * listener would wipe our freshly-opened cart.
 */
@Component({
  selector: 'app-cart-redirect',
  standalone: true,
  template: '',
})
export class CartRedirectComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly overlayService = inject(OverlayStackService);

  async ngOnInit(): Promise<void> {
    // `replaceUrl` swaps out `/carrito` in the history so the user can't
    // back into this redirect shim and trigger an infinite loop. The user
    // never meant to land here — it's purely a compatibility hop.
    await this.router.navigate(['/catalogo'], { replaceUrl: true });
    this.overlayService.openCart();
  }
}
