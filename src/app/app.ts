import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ProductDetailOverlayService } from './core/services/product-detail-overlay.service';
import { ProductDetailOverlayComponent } from './shared/components/product-detail-overlay/product-detail-overlay.component';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';
import { BlockedAccountModalComponent } from './shared/components/blocked-account-modal/blocked-account-modal.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ProductDetailOverlayComponent, ToastContainerComponent, BlockedAccountModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly overlayService = inject(ProductDetailOverlayService);
}