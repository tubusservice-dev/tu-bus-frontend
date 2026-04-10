import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ProductDetailOverlayService {
  private readonly productIdSignal = signal<string | null>(null);

  readonly productId = this.productIdSignal.asReadonly();
  readonly isOpen = computed(() => this.productIdSignal() !== null);

  open(productId: string): void {
    this.productIdSignal.set(productId);
    document.body.style.overflow = 'hidden';
  }

  close(): void {
    this.productIdSignal.set(null);
    document.body.style.overflow = '';
  }
}
