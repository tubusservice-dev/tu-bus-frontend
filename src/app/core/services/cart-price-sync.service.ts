import { Injectable, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { filter, firstValueFrom, fromEvent, merge, timer } from 'rxjs';
import { CartService } from './cart.service';
import { ProductService } from './product.service';

/** How often a visible page refreshes the prices of a non-empty cart. */
export const CART_PRICE_SYNC_INTERVAL_MS = 60_000;

/** The server answers at most this many products per request. */
const MAX_IDS_PER_REQUEST = 50;

/**
 * Keeps the prices of the saved cart in step with the catalogue, silently:
 * the customer never gets a "price changed" notice, the cart, the checkout
 * and the final summary simply show the current price.
 *
 * Prices freeze while the customer is paying or confirming (`setLocked`):
 * what they saw when they paid is what the order records, even if the
 * catalogue changes in the meantime. A refresh that was in flight when the
 * lock started is discarded.
 *
 * Refreshes at start-up, every minute while the page is visible and whenever
 * the page becomes visible again; a failed refresh keeps the current prices.
 */
@Injectable({ providedIn: 'root' })
export class CartPriceSyncService {
  private readonly cart = inject(CartService);
  private readonly products = inject(ProductService);
  private readonly document = inject(DOCUMENT);

  private readonly _locked = signal(false);
  readonly locked = this._locked.asReadonly();

  /** Bumped by every refresh and every lock, so stale answers are dropped. */
  private generation = 0;
  private started = false;

  /** Starts the automatic refreshes. Called once at bootstrap; later calls are no-ops. */
  start(): void {
    if (this.started) return;
    this.started = true;
    merge(timer(0, CART_PRICE_SYNC_INTERVAL_MS), fromEvent(this.document, 'visibilitychange'))
      .pipe(filter(() => this.document.visibilityState !== 'hidden'))
      .subscribe(() => void this.sync());
  }

  setLocked(locked: boolean): void {
    if (locked === this._locked()) return;
    this.generation++;
    this._locked.set(locked);
  }

  /** Fetches the current prices of the cart and applies them, unless locked. */
  async sync(): Promise<void> {
    if (this._locked()) return;
    const ids = [...new Set(this.cart.items().map((item) => item.id))].slice(0, MAX_IDS_PER_REQUEST);
    if (ids.length === 0) return;

    const generation = ++this.generation;
    try {
      const prices = await firstValueFrom(this.products.getPrices(ids));
      if (generation !== this.generation || this._locked()) return;
      this.cart.applyCurrentPrices(new Map(prices.map((p) => [p.id, p.price])));
    } catch {
      // Offline or server hiccup: keep the prices the cart has; the next tick retries.
    }
  }
}
