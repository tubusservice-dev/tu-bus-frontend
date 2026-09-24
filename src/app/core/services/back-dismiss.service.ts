import { DestroyRef, Injectable, effect, inject, untracked } from '@angular/core';

/**
 * Open modals and dialogs, most recent last, so the Android back button can
 * close the one on top instead of navigating behind it or leaving the app.
 * Overlays that own a history entry (product detail, cart) keep using
 * OverlayStackService; this covers everything else.
 */
@Injectable({ providedIn: 'root' })
export class BackDismissService {
  private readonly stack: Array<() => void> = [];

  /** Adds a close handler; returns the function that removes it. */
  register(close: () => void): () => void {
    this.stack.push(close);
    return () => {
      const i = this.stack.lastIndexOf(close);
      if (i >= 0) this.stack.splice(i, 1);
    };
  }

  /** Closes the modal on top, if any. Returns whether one was there. */
  dismissTop(): boolean {
    const close = this.stack.at(-1);
    if (!close) return false;
    close();
    return true;
  }
}

/**
 * Lets the Android back button close this modal while `isOpen()` is true,
 * calling the same `close` its ✕ button uses (guards such as "busy" included).
 * Call from a constructor (injection context). For modals the parent only
 * renders while open, pass `() => true`.
 */
export function dismissOnBack(isOpen: () => boolean, close: () => void): void {
  const backDismiss = inject(BackDismissService);
  let unregister: (() => void) | null = null;
  const handler = () => close();

  effect(() => {
    const open = isOpen();
    untracked(() => {
      if (open && !unregister) {
        unregister = backDismiss.register(handler);
      } else if (!open && unregister) {
        unregister();
        unregister = null;
      }
    });
  });
  inject(DestroyRef).onDestroy(() => unregister?.());
}
