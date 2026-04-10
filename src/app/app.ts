import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ProductDetailOverlayService } from './core/services/product-detail-overlay.service';
import { ProductDetailOverlayComponent } from './shared/components/product-detail-overlay/product-detail-overlay.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ProductDetailOverlayComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly overlayService = inject(ProductDetailOverlayService);
}