import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
  ElementRef,
} from '@angular/core';
import { BodyScrollLockService } from '@shared/services/body-scroll-lock.service';

/** Visual weight of the confirming action. `danger` is the default: most
 *  confirmations in this app guard a destructive operation. */
export type ConfirmDialogVariant = 'danger' | 'primary';

let confirmDialogSeq = 0;

/**
 * The single confirmation dialog for the whole app.
 *
 * It replaces the hand-rolled overlay/title/message/two-buttons block that
 * was copied across the admin panel, and the native `confirm()` that was
 * left in the garage. Callers keep owning the decision — the dialog only
 * asks — so migrating a screen is swapping markup, not rewriting logic:
 *
 * ```html
 * <app-confirm-dialog
 *   [isOpen]="!!itemToDelete()"
 *   title="Eliminar sucursal"
 *   [message]="'¿Eliminar ' + itemToDelete()?.name + '?'"
 *   confirmLabel="Eliminar"
 *   busyLabel="Eliminando..."
 *   [busy]="isDeleting()"
 *   (confirmed)="confirmDelete()"
 *   (cancelled)="closeDeleteModal()"
 * />
 * ```
 *
 * Richer bodies (a highlighted name, a warning list) go through content
 * projection instead of `message`, so nothing has to be passed as raw HTML.
 *
 * What every caller gets for free, and what none of the copies had: a
 * `role="alertdialog"` wired to its own title and body, Escape to dismiss,
 * the body scroll lock, and initial focus on the non-destructive button.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
  template: `
    @if (isOpen()) {
      <div class="cd-overlay" (click)="onCancel()">
        <div
          class="cd-dialog"
          role="alertdialog"
          aria-modal="true"
          [attr.aria-labelledby]="titleId"
          [attr.aria-describedby]="bodyId"
          [class.centered]="icon() === 'warning'"
          (click)="$event.stopPropagation()"
        >
          @if (icon() === 'warning') {
            <div class="cd-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
          }

          <h3 class="cd-title" [id]="titleId">{{ title() }}</h3>

          <div class="cd-body" [id]="bodyId">
            @if (message()) {
              <p class="cd-message">{{ message() }}</p>
            }
            <ng-content />
          </div>

          <div class="cd-actions">
            <button
              #cancelButton
              type="button"
              class="cd-btn cd-btn-cancel"
              [disabled]="busy()"
              (click)="onCancel()"
            >
              {{ cancelLabel() }}
            </button>
            <button
              type="button"
              class="cd-btn cd-btn-confirm"
              [class.danger]="variant() === 'danger'"
              [disabled]="busy()"
              (click)="onConfirm()"
            >
              {{ busy() ? busyLabel() || confirmLabel() : confirmLabel() }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .cd-overlay {
      position: fixed;
      inset: 0;
      z-index: 60;
      display: flex;
      align-items: center;
      justify-content: center;
      /* Safe-area-aware so the dialog clears the OS status and gesture bars
         on edge-to-edge Android. */
      padding: max(1rem, var(--safe-area-top, 0px))
               max(1rem, var(--safe-area-right, 0px))
               max(1rem, var(--safe-area-bottom, 0px))
               max(1rem, var(--safe-area-left, 0px));
      background-color: rgba(0, 0, 0, 0.5);
      animation: cdFadeIn 0.15s ease-out;
    }

    .cd-dialog {
      width: 100%;
      max-width: 28rem;
      padding: 1.5rem;
      border-radius: 0.75rem;
      background-color: #ffffff;
      border: 1px solid #e5e7eb;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
      animation: cdScaleIn 0.18s ease-out;
    }

    /* Warning layout: icon on top, everything centred except the buttons,
       which stay right-aligned as in every other dialog. */
    .cd-dialog.centered .cd-title,
    .cd-dialog.centered .cd-body { text-align: center; }

    .cd-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 3rem;
      height: 3rem;
      margin: 0 auto 0.75rem;
      border-radius: 9999px;
      background-color: #fee2e2;
      color: #dc2626;
    }
    .cd-icon svg { width: 1.5rem; height: 1.5rem; }

    .cd-title {
      margin: 0 0 0.5rem 0;
      font-size: 1.125rem;
      font-weight: 600;
      color: #111827;
    }

    .cd-body {
      font-size: 0.875rem;
      line-height: 1.5;
      color: #4b5563;
    }

    .cd-message {
      margin: 0;
    }

    .cd-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 1rem;
    }

    .cd-btn {
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      border-radius: 0.5rem;
      cursor: pointer;
      transition: background-color 0.15s, color 0.15s;
    }
    .cd-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .cd-btn-cancel {
      border: 1px solid #e5e7eb;
      background-color: #ffffff;
      color: #374151;
    }
    .cd-btn-cancel:hover:not(:disabled) { background-color: #f9fafb; }

    .cd-btn-confirm {
      border: 0;
      font-weight: 500;
      color: #ffffff;
      background-color: var(--accent-primary);
    }
    .cd-btn-confirm:hover:not(:disabled) {
      background-color: var(--accent-hover, rgb(0, 20, 60));
    }
    .cd-btn-confirm.danger { background-color: #dc2626; }
    .cd-btn-confirm.danger:hover:not(:disabled) { background-color: #b91c1c; }

    :host-context(.dark) .cd-dialog {
      background-color: #1f2937;
      border-color: #374151;
    }
    :host-context(.dark) .cd-title { color: #ffffff; }
    :host-context(.dark) .cd-body { color: #d1d5db; }
    :host-context(.dark) .cd-btn-cancel {
      background-color: #1f2937;
      border-color: #374151;
      color: #e5e7eb;
    }
    :host-context(.dark) .cd-btn-cancel:hover:not(:disabled) {
      background-color: rgba(55, 65, 81, 0.6);
    }
    :host-context(.dark) .cd-icon {
      background-color: rgba(127, 29, 29, 0.35);
      color: #fca5a5;
    }

    @keyframes cdFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes cdScaleIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
  `],
})
export class ConfirmDialogComponent implements OnDestroy {
  readonly isOpen = input.required<boolean>();
  readonly title = input.required<string>();
  /** Plain-text body. Leave empty and project content for richer bodies. */
  readonly message = input<string>('');
  readonly confirmLabel = input<string>('Confirmar');
  readonly cancelLabel = input<string>('Cancelar');
  /** Shown on the confirm button while `busy` is true, e.g. "Eliminando...". */
  readonly busyLabel = input<string>('');
  /** Blocks both buttons while the caller's request is in flight. */
  readonly busy = input<boolean>(false);
  readonly variant = input<ConfirmDialogVariant>('danger');
  /** `warning` shows the alert glyph above a centred title, the layout the
   *  admin delete dialogs already used. */
  readonly icon = input<'none' | 'warning'>('none');

  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  /** Unique per instance so nested or sibling dialogs never share ARIA ids. */
  private readonly seq = ++confirmDialogSeq;
  protected readonly titleId = `confirm-dialog-title-${this.seq}`;
  protected readonly bodyId = `confirm-dialog-body-${this.seq}`;

  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelButton');
  private readonly scrollLock = inject(BodyScrollLockService);
  private readonly hasScrollLock = signal(false);

  constructor() {
    effect(() => {
      if (this.isOpen()) this.acquireScrollLock();
      else this.releaseScrollLock();
    });

    // Focus the non-destructive button, so a stray Enter dismisses rather
    // than confirms.
    effect(() => {
      if (this.isOpen()) this.cancelButton()?.nativeElement.focus();
    });
  }

  ngOnDestroy(): void {
    // Defensive — release the lock if the host is torn down while open.
    this.releaseScrollLock();
  }

  protected onConfirm(): void {
    if (this.busy()) return;
    this.confirmed.emit();
  }

  protected onCancel(): void {
    if (this.busy()) return;
    this.cancelled.emit();
  }

  protected onEscape(): void {
    if (this.isOpen()) this.onCancel();
  }

  private acquireScrollLock(): void {
    if (this.hasScrollLock()) return;
    this.scrollLock.lock();
    this.hasScrollLock.set(true);
  }

  private releaseScrollLock(): void {
    if (!this.hasScrollLock()) return;
    this.scrollLock.unlock();
    this.hasScrollLock.set(false);
  }
}
