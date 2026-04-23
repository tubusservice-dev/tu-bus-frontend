import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /**
   * Internal auto-dismiss timer handle. Kept so `dismiss()` can clear it if
   * the user closes the toast manually before the timeout fires.
   */
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * App-wide ephemeral toast notifications. Lives as a singleton
 * (`providedIn: 'root'`) so toasts queued by a component that's about to be
 * destroyed (typical case: a form that then navigates away) survive until
 * the global `<app-toast-container>` renders them.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;

  /** Reactive list of live toasts. Consumed by `ToastContainerComponent`. */
  readonly toasts = signal<Toast[]>([]);

  /**
   * Enqueue a toast.
   * @param message Text shown to the user.
   * @param kind Visual intent. Default `'info'`.
   * @param durationMs Auto-dismiss delay. `0` → sticky (manual close only).
   */
  show(message: string, kind: ToastKind = 'info', durationMs = 4000): number {
    const id = this.nextId++;
    const timer =
      durationMs > 0 ? setTimeout(() => this.dismiss(id), durationMs) : undefined;
    this.toasts.update((list) => [...list, { id, kind, message, timer }]);
    return id;
  }

  success(message: string, durationMs?: number): number {
    return this.show(message, 'success', durationMs);
  }

  error(message: string, durationMs?: number): number {
    return this.show(message, 'error', durationMs ?? 6000);
  }

  info(message: string, durationMs?: number): number {
    return this.show(message, 'info', durationMs);
  }

  warning(message: string, durationMs?: number): number {
    return this.show(message, 'warning', durationMs);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => {
      const target = list.find((t) => t.id === id);
      if (target?.timer) clearTimeout(target.timer);
      return list.filter((t) => t.id !== id);
    });
  }

  clear(): void {
    this.toasts().forEach((t) => t.timer && clearTimeout(t.timer));
    this.toasts.set([]);
  }
}
