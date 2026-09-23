import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { BranchProductService } from './branch-product.service';
import { CartItem, CartService } from './cart.service';

/**
 * What a change of location does to the cart: which items the branches of
 * the new place do not carry. The caller shows that list before confirming
 * and removes only those items, never the whole cart.
 */
@Injectable({ providedIn: 'root' })
export class CartReviewService {
  private readonly cart = inject(CartService);
  private readonly branchProducts = inject(BranchProductService);

  /**
   * Items with no stock at any of `branchIds`. With no branches at all (no
   * coverage there), nothing can be served, so every item is listed. An item
   * whose stock cannot be checked is kept: a network error must not empty
   * the customer's cart.
   */
  review(branchIds: readonly string[]): Observable<{ unavailable: CartItem[] }> {
    const items = this.cart.items();
    if (!items.length) return of({ unavailable: [] });
    if (!branchIds.length) return of({ unavailable: [...items] });

    return forkJoin(
      items.map((item) =>
        this.branchProducts.getAggregatedStock(item.id, [...branchIds]).pipe(
          map((r) => r.data.totalStock > 0),
          catchError(() => of(true)),
        ),
      ),
    ).pipe(map((available) => ({ unavailable: items.filter((_, i) => !available[i]) })));
  }

  /** Removes the listed items, leaving the rest of the cart as it is. */
  removeUnavailable(unavailable: readonly CartItem[]): void {
    for (const item of unavailable) this.cart.removeItem(item.id);
  }
}
