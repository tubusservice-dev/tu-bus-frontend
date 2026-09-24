import { Injectable, signal } from '@angular/core';

/**
 * Opens the zone selector: from the header (the only place a customer changes
 * their location) and from a checkout option that needs one, for a customer
 * who never picked any. The selector is hosted once at the application root
 * (ZoneSelectorHostComponent), so it shows even on screens that hide the
 * header, like checkout. Address forms never open it: their state and
 * municipality are the customer's location, fixed.
 */
@Injectable({ providedIn: 'root' })
export class ZoneSelectorService {
  private readonly _isOpen = signal(false);
  readonly isOpen = this._isOpen.asReadonly();

  open(): void {
    this._isOpen.set(true);
  }

  close(): void {
    this._isOpen.set(false);
  }
}
