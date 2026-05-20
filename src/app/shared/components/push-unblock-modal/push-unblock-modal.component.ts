import {
  Component,
  ChangeDetectionStrategy,
  OnDestroy,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { BodyScrollLockService } from '@shared/services/body-scroll-lock.service';

/**
 * Reusable modal that explains how to re-enable push notifications when
 * the browser permission is `'denied'` and the API forbids re-prompting
 * programmatically. The host controls visibility via the `isOpen` input
 * and listens to the `close` event.
 *
 * The component owns the body scroll lock so any caller that just toggles
 * `isOpen` gets the locking behaviour for free.
 */
@Component({
  selector: 'app-push-unblock-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isOpen()) {
      <div class="pum-overlay" (click)="onClose()">
        <div
          class="pum-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pum-title"
          (click)="$event.stopPropagation()"
        >
          <button
            type="button"
            class="pum-close"
            (click)="onClose()"
            aria-label="Cerrar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
          <h4 id="pum-title" class="pum-title">Cómo desbloquear las notificaciones</h4>
          <ol class="pum-steps">
            <li>Abre la configuración del navegador en este sitio (candado <strong>🔒</strong> a la izquierda de la URL).</li>
            <li>Busca <strong>Notificaciones</strong> y cambia a <strong>Permitir</strong>.</li>
            <li>Recarga esta página y vuelve a activar el toggle.</li>
          </ol>
        </div>
      </div>
    }
  `,
  styles: [`
    .pum-overlay {
      position: fixed;
      inset: 0;
      z-index: 60;
      display: flex;
      align-items: center;
      justify-content: center;
      /* Safe-area-aware padding so the dialog stays clear of the OS
         status bar and gesture/nav bar on edge-to-edge Android. */
      padding: max(1rem, env(safe-area-inset-top, 0px))
               max(1rem, env(safe-area-inset-right, 0px))
               max(1rem, env(safe-area-inset-bottom, 0px))
               max(1rem, env(safe-area-inset-left, 0px));
      background-color: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      animation: pumFadeIn 0.15s ease-out;
    }

    .pum-modal {
      position: relative;
      width: 100%;
      max-width: 24rem;
      padding: 1.5rem;
      border-radius: 1rem;
      background-color: #fef2f2;
      border: 1px solid #fecaca;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
      animation: pumScaleIn 0.18s ease-out;
    }

    .pum-close {
      position: absolute;
      top: 0.75rem;
      right: 0.75rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border-radius: 9999px;
      background: transparent;
      border: 0;
      cursor: pointer;
      color: #b91c1c;
      transition: background-color 0.15s, color 0.15s;
    }
    .pum-close:hover { background-color: #fee2e2; color: #7f1d1d; }
    .pum-close svg { width: 1rem; height: 1rem; }

    .pum-title {
      font-size: 1rem;
      font-weight: 600;
      margin: 0 0 0.75rem 0;
      padding-right: 1.5rem;
      color: #7f1d1d;
    }

    .pum-steps {
      list-style: decimal;
      padding-left: 1.25rem;
      margin: 0;
      font-size: 0.875rem;
      line-height: 1.6;
      color: #7f1d1d;
    }
    .pum-steps li + li { margin-top: 0.5rem; }
    .pum-steps strong { font-weight: 600; }

    :host-context(.dark) .pum-modal {
      background-color: #4a1c25;
      border-color: #6b2530;
    }
    :host-context(.dark) .pum-close { color: #fda4af; }
    :host-context(.dark) .pum-close:hover { background-color: rgba(127, 29, 29, 0.4); color: #fecdd3; }
    :host-context(.dark) .pum-title,
    :host-context(.dark) .pum-steps { color: #fecaca; }

    @keyframes pumFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes pumScaleIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
  `],
})
export class PushUnblockModalComponent implements OnDestroy {
  readonly isOpen = input.required<boolean>();
  readonly close = output<void>();

  private readonly scrollLock = inject(BodyScrollLockService);
  private hasScrollLock = false;

  constructor() {
    effect(() => {
      if (this.isOpen()) this.acquireScrollLock();
      else this.releaseScrollLock();
    });
  }

  ngOnDestroy(): void {
    // Defensive — release the lock if the modal host is torn down while open.
    this.releaseScrollLock();
  }

  protected onClose(): void {
    this.close.emit();
  }

  private acquireScrollLock(): void {
    if (this.hasScrollLock) return;
    this.scrollLock.lock();
    this.hasScrollLock = true;
  }

  private releaseScrollLock(): void {
    if (!this.hasScrollLock) return;
    this.scrollLock.unlock();
    this.hasScrollLock = false;
  }
}
