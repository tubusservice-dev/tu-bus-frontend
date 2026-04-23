import { Injectable, signal, computed, inject } from '@angular/core';
import { Router, NavigationEnd, NavigationCancel, NavigationError } from '@angular/router';
import { filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ProductDetailOverlayService {
  private readonly router = inject(Router);
  private readonly productIdSignal = signal<string | null>(null);

  readonly productId = this.productIdSignal.asReadonly();
  readonly isOpen = computed(() => this.productIdSignal() !== null);

  constructor() {
    // The overlay lives outside <router-outlet>, so route changes don't
    // unmount it. Auto-close on NavigationEnd (not Start) keeps the overlay
    // visible while the target route's lazy chunk loads — prevents a flash
    // of the previous view between Start and End. Cancel/Error are covered
    // too so a rejected guard or navigation error doesn't leave it stuck.
    this.router.events
      .pipe(
        filter(
          (e): e is NavigationEnd | NavigationCancel | NavigationError =>
            e instanceof NavigationEnd ||
            e instanceof NavigationCancel ||
            e instanceof NavigationError,
        ),
      )
      .subscribe(() => {
        if (this.productIdSignal() !== null) {
          this.close();
        }
      });
  }

  open(productId: string): void {
    this.productIdSignal.set(productId);
    document.body.style.overflow = 'hidden';
  }

  close(): void {
    this.productIdSignal.set(null);
    document.body.style.overflow = '';
  }
}
