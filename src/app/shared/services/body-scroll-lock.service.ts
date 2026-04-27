import { Injectable } from '@angular/core';

/**
 * Coordinates locking the viewport scroll while modals/overlays are open.
 *
 * Locks both `<body>` and `<html>` because the global stylesheet applies
 * `overflow-x: clip` to `<html>` (see `styles.scss`). Per the CSS spec,
 * once `<html>`'s overflow is non-visible the propagation of `<body>`'s
 * overflow to the viewport is broken — so locking only `<body>` leaves
 * the viewport scrollable behind fullscreen modals.
 *
 * Uses a reference counter so nested modals do not unlock the page until
 * the outermost one closes.
 */
@Injectable({ providedIn: 'root' })
export class BodyScrollLockService {
  private lockCount = 0;

  /** Acquire a scroll lock. Must be paired with `unlock()`. */
  lock(): void {
    this.lockCount++;
    if (this.lockCount === 1) this.apply(true);
  }

  /** Release a scroll lock. Safe to call when no lock is active (no-op). */
  unlock(): void {
    if (this.lockCount === 0) return;
    this.lockCount--;
    if (this.lockCount === 0) this.apply(false);
  }

  private apply(locked: boolean): void {
    const value = locked ? 'hidden' : '';
    document.body.style.overflow = value;
    document.documentElement.style.overflow = value;
  }
}
