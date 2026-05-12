import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { OrderComment, Order, orderCommentKey } from '../../../models/order.model';
import { OrderService } from '../../../core/services/order.service';

/**
 * Business rule mirrored from the backend (see
 * `backend/src/modules/orders/interfaces/order.interface.ts`).
 * Duplicated here because frontend and backend are separate packages with no
 * shared type source; keep both values in sync.
 */
const MAX_CLIENT_COMMENTS_PER_ORDER = 5;

/**
 * Chat-like comment thread between client and admin for a single order.
 *
 * Shared between the admin order-detail and the client order-detail. The
 * `mode` input decides which endpoint to call when posting and which side
 * gets a special styling on the message bubble.
 *
 * Emits `commentsUpdated` with the updated order so the parent can sync its
 * own state (signal or reload).
 */
@Component({
  selector: 'app-order-comments',
  standalone: true,
  imports: [CommonModule, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="comments-card">
      <header class="comments-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="comments-icon" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
        </svg>
        <h3>Comentarios</h3>
      </header>

      @if (comments().length === 0) {
        <p class="comments-empty">Aún no hay comentarios en esta orden. Sé el primero en escribir.</p>
      } @else {
        <ul class="comments-list">
          @for (c of comments(); track commentKey(c)) {
            <li
              class="comment-item"
              [class.is-admin]="c.authorType === 'admin'"
              [class.is-highlighted]="commentKey(c) === highlightId()"
            >
              <div class="comment-head">
                <span class="comment-author">{{ c.authorName }}</span>
                <span class="comment-date">{{ c.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
              </div>
              <p class="comment-body">{{ c.message }}</p>
            </li>
          }
        </ul>
      }

      <div class="comments-form">
        @if (mode() === 'client' && hasReachedClientLimit()) {
          <div class="comments-limit-notice comments-limit-reached" role="status">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008Zm-9-4.5a9 9 0 1 1 18 0 9 9 0 0 1-18 0Z" />
            </svg>
            <span>
              Has alcanzado el límite de {{ maxClientComments }} comentarios para esta orden.
              Espera la respuesta de un agente para continuar la conversación.
            </span>
          </div>
        }
        <textarea
          class="comments-textarea"
          rows="3"
          maxlength="1000"
          [placeholder]="hasReachedClientLimit() ? 'Has alcanzado el límite de comentarios.' : 'Escribe un comentario…'"
          [value]="draftMessage()"
          [disabled]="hasReachedClientLimit()"
          (input)="draftMessage.set($any($event.target).value); sendError.set(null)"
        ></textarea>
        <div class="comments-form-footer">
          @if (sendError()) {
            <span class="comments-error">{{ sendError() }}</span>
          } @else {
            <span class="comments-count">{{ draftMessage().length }}/1000</span>
          }
          <button
            type="button"
            class="comments-send-btn"
            [disabled]="!canSend() || isSending()"
            (click)="send()"
          >
            @if (isSending()) { Enviando… } @else { Enviar comentario }
          </button>
        </div>
      </div>
    </section>
  `,
  styles: [`
    .comments-card {
      @apply rounded-xl border bg-white dark:bg-gray-800 dark:border-gray-700;
      border-color: #e5e7eb;
    }
    .comments-header {
      @apply flex items-center gap-2 px-5 sm:px-6 py-3 text-sm font-semibold border-b rounded-t-xl;
      @apply text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700;
      h3 { @apply m-0 text-sm font-semibold; }
    }
    .comments-icon { @apply w-5 h-5 text-blue-600 dark:text-blue-400; }

    .comments-empty {
      @apply px-5 sm:px-6 py-6 text-sm italic text-gray-500 dark:text-gray-400 m-0 text-center;
    }

    .comments-list {
      @apply flex flex-col gap-3 px-4 sm:px-5 py-4 m-0 list-none;
      max-height: 360px;
      overflow-y: auto;
    }

    .comment-item {
      @apply flex flex-col gap-1 p-3 rounded-lg border;
      @apply bg-gray-50 border-gray-200 dark:bg-gray-900/40 dark:border-gray-700;
      border-left-width: 3px;
      border-left-color: #9ca3af;
      transition: background-color 0.4s ease, border-color 0.4s ease;

      &.is-admin {
        @apply bg-blue-50/60 dark:bg-blue-900/15;
        border-left-color: #2563eb;
      }

      &.is-highlighted {
        // Three short pulses so the new comment grabs attention without
        // hijacking the screen. Picks up the chat accent so admin and
        // client comments both feel "lit up" while staying readable.
        animation: comment-pulse 2.4s ease-out 1;
      }
    }
    :host-context(.dark) .comment-item.is-admin { border-left-color: #60a5fa; }

    @keyframes comment-pulse {
      0%   { background-color: rgba(59, 130, 246, 0.30); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.40); }
      30%  { background-color: rgba(59, 130, 246, 0.18); box-shadow: 0 0 0 6px rgba(59, 130, 246, 0); }
      60%  { background-color: rgba(59, 130, 246, 0.22); box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.30); }
      100% { background-color: inherit; box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
    }

    .comment-head {
      @apply flex items-center justify-between gap-2 flex-wrap;
    }
    .comment-author {
      @apply text-xs font-semibold text-gray-900 dark:text-white;
    }
    .comment-date {
      @apply text-[11px] text-gray-500 dark:text-gray-400;
    }
    .comment-body {
      @apply text-sm text-gray-700 dark:text-gray-200 m-0 leading-relaxed;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
    }

    .comments-form {
      @apply flex flex-col gap-2 px-4 sm:px-5 py-4 border-t border-gray-100 dark:border-gray-700/50;
    }
    .comments-textarea {
      @apply w-full px-3 py-2 text-sm rounded-lg resize-y;
      @apply bg-white border border-gray-300 text-gray-900 placeholder-gray-400;
      @apply dark:bg-gray-900 dark:border-gray-600 dark:text-white dark:placeholder-gray-500;
      @apply focus:outline-none focus:ring-2 focus:border-transparent;
      @apply disabled:opacity-60 disabled:cursor-not-allowed;
      min-height: 70px;
      &:focus { --tw-ring-color: var(--accent-primary, #2563eb); }
    }

    .comments-limit-notice {
      @apply flex items-start gap-2 px-3 py-2 rounded-md text-xs font-medium;
      svg { @apply w-4 h-4 flex-shrink-0 mt-0.5; }
    }
    .comments-limit-info {
      @apply bg-blue-50 text-blue-700 border border-blue-200;
      @apply dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/50;
    }
    .comments-limit-reached {
      @apply bg-amber-50 text-amber-800 border border-amber-200;
      @apply dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/50;
    }
    .comments-form-footer {
      @apply flex items-center justify-between gap-3;
    }
    .comments-count {
      @apply text-[11px] text-gray-400 dark:text-gray-500;
    }
    .comments-error {
      @apply text-xs text-red-600 dark:text-red-400 font-medium;
    }
    .comments-send-btn {
      @apply px-4 py-2 text-xs font-semibold rounded-md text-white;
      @apply bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors;
    }
  `],
})
export class OrderCommentsComponent {
  private readonly orderService = inject(OrderService);

  readonly orderId = input.required<string>();
  readonly comments = input.required<OrderComment[]>();
  readonly mode = input.required<'client' | 'admin'>();
  /**
   * Stable key of the comment that should pulse once after being added.
   * Parent components compute the key with `orderCommentKey()` and clear
   * the value after a few seconds so the animation does not loop.
   */
  readonly highlightId = input<string | null>(null);

  readonly commentsUpdated = output<Order>();

  /** Bridge to the model helper so the template can call it for track-by + class binding. */
  protected readonly commentKey = orderCommentKey;

  protected readonly draftMessage = signal('');
  protected readonly isSending = signal(false);
  protected readonly sendError = signal<string | null>(null);

  protected readonly maxClientComments = MAX_CLIENT_COMMENTS_PER_ORDER;

  /** Count of existing client-authored comments in this order's thread. */
  protected readonly clientCommentsCount = computed(
    () => this.comments().filter((c) => c.authorType === 'client').length,
  );

  /** Remaining comments the client may still post (floored at 0). */
  protected readonly clientCommentsRemaining = computed(
    () => Math.max(0, MAX_CLIENT_COMMENTS_PER_ORDER - this.clientCommentsCount()),
  );

  /** True only for client mode when the cap has been reached. */
  protected readonly hasReachedClientLimit = computed(
    () => this.mode() === 'client' && this.clientCommentsRemaining() === 0,
  );

  protected canSend(): boolean {
    if (this.hasReachedClientLimit()) return false;
    return this.draftMessage().trim().length > 0 && this.draftMessage().length <= 1000;
  }

  protected send(): void {
    if (!this.canSend() || this.isSending()) return;

    const id = this.orderId();
    const msg = this.draftMessage().trim();
    const isAdmin = this.mode() === 'admin';

    this.isSending.set(true);
    this.sendError.set(null);

    const req$ = isAdmin
      ? this.orderService.addCommentAsAdmin(id, msg)
      : this.orderService.addCommentAsClient(id, msg);

    req$.subscribe({
      next: (res) => {
        this.isSending.set(false);
        this.draftMessage.set('');
        this.commentsUpdated.emit(res.data as Order);
      },
      error: (err) => {
        this.isSending.set(false);
        const body = err?.error;
        const baseMsg = body?.message || 'No se pudo enviar el comentario. Intenta de nuevo.';
        const detail = Array.isArray(body?.errors) && body.errors.length
          ? ` (${body.errors[0].field}: ${body.errors[0].message})`
          : '';
        this.sendError.set(`${baseMsg}${detail}`);
      },
    });
  }
}
