import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { OverlayStackService } from './core/services/overlay-stack.service';
import { ProductDetailPageComponent } from './features/product-detail/product-detail-page/product-detail-page.component';
import { CartOverlayComponent } from './features/cart/cart-overlay/cart-overlay.component';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';
import { BlockedAccountModalComponent } from './shared/components/blocked-account-modal/blocked-account-modal.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    ProductDetailPageComponent,
    CartOverlayComponent,
    ToastContainerComponent,
    BlockedAccountModalComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly overlayService = inject(OverlayStackService);
}
