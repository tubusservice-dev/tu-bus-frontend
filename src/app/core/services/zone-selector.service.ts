import { Injectable, signal } from '@angular/core';

/**
 * Opens the zone selector from anywhere: the header, a checkout option that
 * needs a location, the "cambiar" link of an address form. The selector is
 * hosted once at the application root (ZoneSelectorHostComponent), so it
 * shows even on screens that hide the header, like checkout.
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
