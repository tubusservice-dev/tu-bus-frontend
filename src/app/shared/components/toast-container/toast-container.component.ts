import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';

/**
 * Global host for transient toast notifications. Mount once at the root of
 * the app (`app.html`) — the underlying `ToastService` is a singleton so any
 * component can call `toastService.success(...)` and the message surfaces
 * here, even if the caller is already unmounting.
 */
@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-stack" role="status" aria-live="polite" aria-atomic="false">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast toast--{{ toast.kind }}" role="alert">
          <span class="toast-icon" aria-hidden="true">
            @switch (toast.kind) {
              @case ('success') {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              }
              @case ('error') {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008Zm-9-4.5a9 9 0 1 1 18 0 9 9 0 0 1-18 0Z" />
                </svg>
              }
              @case ('warning') {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              }
              @default {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                </svg>
              }
            }
          </span>
          <span class="toast-message">{{ toast.message }}</span>
          <button
            type="button"
            class="toast-close"
            aria-label="Cerrar notificación"
            (click)="toastService.dismiss(toast.id)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      position: fixed;
      // Anchored top-right, just below the fixed app header. The header now
      // covers the OS status-bar inset (see header-shell SCSS), so the toast
      // must add it too — otherwise on edge-to-edge Android the toast paints
      // partially under the header. The --safe-area-top var falls back to
      // 0px on platforms that don't expose insets so web/desktop is OK.
      top: calc(var(--app-header-height, 56px) + var(--safe-area-top, 0px) + 1rem);
      right: 1rem;
      z-index: 9999;
      pointer-events: none;
    }

    .toast-stack {
      display: flex;
      // Newest toast sits closest to the top anchor; older ones stack
      // downward so the focal point stays on the most recent message.
      flex-direction: column-reverse;
      gap: 0.625rem;
      max-width: min(22rem, calc(100vw - 2rem));
    }

    .toast {
      pointer-events: auto;
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      padding: 0.75rem 0.85rem;
      border-radius: 10px;
      border: 1px solid var(--border-color, #e5e7eb);
      background: var(--bg-primary, #ffffff);
      color: var(--text-primary, #111827);
      box-shadow:
        0 10px 15px -3px rgba(0, 0, 0, 0.12),
        0 4px 6px -4px rgba(0, 0, 0, 0.08);
      font-size: 0.875rem;
      line-height: 1.35;
      animation: toast-in 220ms cubic-bezier(0.4, 0, 0.2, 1);
    }

    .toast-icon {
      flex-shrink: 0;
      width: 1.1rem;
      height: 1.1rem;
      margin-top: 0.1rem;

      svg { width: 100%; height: 100%; }
    }

    .toast-message {
      flex: 1 1 auto;
      min-width: 0;
      word-break: break-word;
    }

    .toast-close {
      flex-shrink: 0;
      width: 1.1rem;
      height: 1.1rem;
      padding: 0;
      margin-top: 0.1rem;
      background: transparent;
      border: 0;
      cursor: pointer;
      opacity: 0.55;
      color: inherit;
      transition: opacity 150ms ease;

      svg { width: 100%; height: 100%; }
      &:hover { opacity: 1; }
    }

    /* Kind-specific accents — left border strip + icon color. */
    .toast--success {
      border-left: 4px solid #16a34a;
      .toast-icon { color: #16a34a; }
    }
    .toast--error {
      border-left: 4px solid #dc2626;
      .toast-icon { color: #dc2626; }
    }
    .toast--warning {
      border-left: 4px solid #d97706;
      .toast-icon { color: #d97706; }
    }
    .toast--info {
      border-left: 4px solid #2563eb;
      .toast-icon { color: #2563eb; }
    }

    /* Dark mode — override the default white card. */
    :host-context(.dark) .toast {
      background: #1e293b;
      border-color: #334155;
      color: #e5e7eb;
      box-shadow:
        0 10px 15px -3px rgba(0, 0, 0, 0.4),
        0 4px 6px -4px rgba(0, 0, 0, 0.3);
    }
    :host-context(.dark) .toast--success { .toast-icon { color: #4ade80; } border-left-color: #22c55e; }
    :host-context(.dark) .toast--error   { .toast-icon { color: #f87171; } border-left-color: #ef4444; }
    :host-context(.dark) .toast--warning { .toast-icon { color: #fbbf24; } border-left-color: #f59e0b; }
    :host-context(.dark) .toast--info    { .toast-icon { color: #60a5fa; } border-left-color: #3b82f6; }

    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateX(12px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
  `],
})
export class ToastContainerComponent {
  protected readonly toastService = inject(ToastService);
}
