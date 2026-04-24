import { Injectable, signal, computed, inject } from '@angular/core';
import {
  Router,
  NavigationEnd,
  NavigationCancel,
  NavigationError,
  NavigationStart,
} from '@angular/router';
import { filter } from 'rxjs';

/** One entry in the overlay stack. */
export type OverlayEntry =
  | { readonly type: 'product'; readonly uid: string; readonly productId: string }
  | { readonly type: 'cart'; readonly uid: string };

/**
 * Mount-stack for full-screen overlays, wired to the browser's History API
 * so the hardware back button / navigator back arrow closes the top overlay
 * instead of navigating the route.
 *
 * Works because app.config.ts sets `scrollPositionRestoration: 'disabled'`,
 * which means Angular never races with us to reset the scroll. Forward
 * route navigations are handled here — we scroll to top only when the
 * navigation is `imperative` (triggered by a routerLink click or
 * `router.navigate`), never on `popstate` (browser back/forward) or
 * `hashchange`. This preserves the underlying route's scroll across
 * overlay open/close cycles without the original `'enabled'` bug.
 */
@Injectable({ providedIn: 'root' })
export class OverlayStackService {
  private readonly router = inject(Router);

  private readonly stackSignal = signal<OverlayEntry[]>([]);
  readonly stack = this.stackSignal.asReadonly();
  readonly isOpen = computed(() => this.stackSignal().length > 0);

  private readonly STATE_MARKER = '__overlayStack';

  /** The trigger of the in-flight router navigation — captured on
   *  NavigationStart and consumed on NavigationEnd to decide whether to
   *  scroll to top. */
  private currentNavTrigger: 'imperative' | 'popstate' | 'hashchange' = 'imperative';

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.currentNavTrigger = event.navigationTrigger ?? 'imperative';
      } else if (event instanceof NavigationEnd) {
        // Real route change: scroll top, but only on imperative navs.
        // popstate is the user pressing back/forward — respect wherever
        // they land. hashchange handles its own anchor scroll.
        if (this.currentNavTrigger === 'imperative' && typeof window !== 'undefined') {
          window.scrollTo(0, 0);
        }
      }
    });

    // Clear the stack when the user navigates to a different route.
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
        if (this.stackSignal().length > 0) {
          this.stackSignal.set([]);
        }
      });

    // Popstate listener — handles the browser/OS back button. When the
    // user backs out of an overlay entry, the stack is popped to match.
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', (event) => {
        const state = (event.state ?? {}) as Record<string, unknown>;
        const isOverlayState = !!state[this.STATE_MARKER];
        const snapshot = state['snapshot'];

        if (isOverlayState && Array.isArray(snapshot)) {
          this.stackSignal.set(snapshot as OverlayEntry[]);
        } else if (this.stackSignal().length > 0) {
          // Backed out past all overlay entries.
          this.stackSignal.set([]);
        }
      });
    }
  }

  /** Push a product detail overlay on top of the stack. */
  openProduct(productId: string): void {
    this.push({ type: 'product', uid: this.generateUid(), productId });
  }

  /** Push the cart overlay. Idempotent when the cart is already on top. */
  openCart(): void {
    const top = this.stackSignal().at(-1);
    if (top?.type === 'cart') return;
    this.push({ type: 'cart', uid: this.generateUid() });
  }

  /** In-app back arrow: closes the top overlay. Delegates to
   *  `history.back()` so the history stays in sync with the stack — the
   *  `popstate` listener is the single source of truth for the pop.
   *  With `scrollPositionRestoration: 'disabled'` the scroll is untouched
   *  by Angular, so the underlying catalog stays exactly where it was. */
  goBack(): void {
    if (this.stackSignal().length === 0) return;
    if (typeof history !== 'undefined') {
      history.back();
    } else {
      this.stackSignal.update((s) => s.slice(0, -1));
    }
  }

  /** Close all overlays programmatically. */
  close(): void {
    if (this.stackSignal().length === 0) return;
    this.stackSignal.set([]);
  }

  private push(entry: OverlayEntry): void {
    const newStack = [...this.stackSignal(), entry];
    this.stackSignal.set(newStack);

    if (typeof history !== 'undefined' && typeof window !== 'undefined') {
      // Same URL + our marker. Angular's `onSameUrlNavigation: 'ignore'`
      // (default) means this never triggers an Angular navigation, so the
      // underlying route component is never re-activated. The entry only
      // exists so the browser back button has something to consume.
      history.pushState(
        { [this.STATE_MARKER]: true, snapshot: newStack },
        '',
        window.location.href,
      );
    }
  }

  private generateUid(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}
