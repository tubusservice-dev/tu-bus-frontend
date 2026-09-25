import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Friendly "could not load" block with a retry button, for screens whose data
 * failed to arrive (usually no connection). Replaces misleading empty states
 * such as "no products found" when nothing was actually searched.
 *
 * No card around it, like the catalog's own empty state; styled with the
 * storefront's vocabulary (the vehicle-filter banner's blue accent and the
 * bordered "Filtros" button) so it reads as part of the page.
 *
 * ```html
 * <app-load-error-state [retrying]="isLoading()" (retry)="retryLoad()" />
 * ```
 */
@Component({
  selector: 'app-load-error-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="load-error" role="alert" aria-live="polite">
      <div class="icon-wrap" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z" />
          <path stroke-linecap="round" d="M4 4l16 16" />
        </svg>
      </div>

      <h3 class="title">{{ title() }}</h3>
      <p class="message">{{ message() }}</p>

      <button type="button" class="retry-btn" [disabled]="retrying()" (click)="retry.emit()">
        <svg class="retry-icon" [class.spinning]="retrying()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
        {{ retrying() ? 'Reintentando…' : 'Reintentar' }}
      </button>
    </section>
  `,
  styles: `
    :host { display: block; }

    .load-error {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      max-width: 28rem;
      margin: 0 auto;
      padding: 4rem 1rem;
      animation: fade-in 250ms ease-out both;
    }

    .icon-wrap {
      display: grid;
      place-items: center;
      width: 3.5rem;
      height: 3.5rem;
      margin-bottom: 1.25rem;
      border-radius: 9999px;
      border: 1px solid #bfdbfe;
      background-color: #eff6ff;
      color: #2563eb;

      svg { width: 1.75rem; height: 1.75rem; }
    }

    .title {
      margin: 0 0 0.5rem;
      font-size: 1.125rem;
      font-weight: 600;
      color: #111827;
    }

    .message {
      margin: 0 0 1.5rem;
      font-size: 0.9375rem;
      line-height: 1.5;
      color: #6b7280;
    }

    .retry-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.625rem 1.25rem;
      border-radius: 0.5rem;
      border: 1px solid #e5e7eb;
      background-color: #ffffff;
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
      cursor: pointer;
      transition: background-color 150ms ease, border-color 150ms ease;

      &:hover:not(:disabled) { background-color: #f9fafb; border-color: #d1d5db; }
      &:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
      &:disabled { opacity: 0.7; cursor: progress; }
    }

    .retry-icon { width: 1.125rem; height: 1.125rem; color: #2563eb; }
    .retry-icon.spinning { animation: spin 0.9s linear infinite; }

    /* Same dark tones as the catalog: gray-800 panels, gray-700 borders, blue accents. */
    :host-context(.dark) {
      .icon-wrap { background-color: rgba(59, 130, 246, 0.1); border-color: #1e3a5f; color: #93c5fd; }
      .title { color: #ffffff; }
      .message { color: #9ca3af; }
      .retry-btn {
        background-color: #1f2937;
        border-color: #374151;
        color: #d1d5db;
        &:hover:not(:disabled) { background-color: #374151; border-color: #374151; }
      }
      .retry-icon { color: #93c5fd; }
    }

    @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 480px) {
      .load-error { padding: 3rem 0.5rem; }
    }

    @media (prefers-reduced-motion: reduce) {
      .load-error, .retry-icon.spinning { animation: none; }
    }
  `,
})
export class LoadErrorStateComponent {
  readonly title = input('No pudimos cargar los productos');
  readonly message = input('Revisa tu conexión a internet e inténtalo de nuevo.');
  /** Shows the spinner and blocks the button while a retry is in flight. */
  readonly retrying = input(false);
  readonly retry = output<void>();
}
