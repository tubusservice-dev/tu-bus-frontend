import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  effect,
  inject,
  signal,
} from '@angular/core';
import { PwaService } from '../../../core/services/pwa.service';

/** Delay before the modal animates in — avoids being aggressive on first load. */
const SHOW_DELAY_MS = 2500;

/**
 * PwaInstallModalComponent
 *
 * Proactive install prompt. Appears automatically a few seconds after
 * the browser flags the app as installable. Replaces the legacy mini-
 * infobar Chrome removed in v76 (2019).
 *
 * Two dismissal paths:
 *   - "Más tarde"   → hides for 7 days (PwaService persistent flag)
 *   - X / backdrop  → hides only for this session
 *
 * After dismissal the header's PwaInstallButtonComponent becomes
 * visible as a fallback affordance.
 *
 * Designed to be mounted at the application root (app.html) so its
 * stacking context sits above all feature overlays and modals.
 */
@Component({
  selector: 'app-pwa-install-modal',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div
        class="pwa-modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-modal-title"
        (click)="onBackdropClick($event)"
      >
        <div class="pwa-modal-card">
          <button
            type="button"
            class="pwa-modal-close"
            aria-label="Cerrar"
            (click)="onDismissSession()"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 stroke-width="2" stroke="currentColor" class="close-icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>

          <div class="pwa-modal-icon-wrap">
            <img src="/icons/icon-192.png" alt="TuBus Express" class="pwa-modal-icon" />
          </div>

          <h2 id="pwa-modal-title" class="pwa-modal-title">
            Instala TuBus Express
          </h2>

          <p class="pwa-modal-text">
            Accede más rápido desde tu pantalla de inicio, sin abrir el navegador.
            Es gratis y ocupa muy poco espacio.
          </p>

          <ul class="pwa-modal-benefits">
            <li>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                   stroke-width="2" stroke="currentColor" class="check-icon">
                <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              Acceso directo desde el inicio
            </li>
            <li>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                   stroke-width="2" stroke="currentColor" class="check-icon">
                <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              Se abre como una app, sin barras del navegador
            </li>
            <li>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                   stroke-width="2" stroke="currentColor" class="check-icon">
                <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
              Carga más rápido
            </li>
          </ul>

          <div class="pwa-modal-actions">
            <button
              type="button"
              class="pwa-modal-btn primary"
              [disabled]="installing()"
              (click)="onInstall()"
            >
              @if (installing()) {
                <span class="pwa-modal-spinner" aria-hidden="true"></span>
                Instalando...
              } @else {
                Instalar ahora
              }
            </button>
            <button
              type="button"
              class="pwa-modal-btn ghost"
              (click)="onDismissPersistent()"
            >
              Más tarde
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host { display: contents; }

      .pwa-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 2100;
        background-color: rgba(15, 23, 42, 0.55);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        display: flex;
        align-items: flex-end;
        justify-content: center;
        padding: 1rem;
        animation: pwa-backdrop-in 220ms ease-out;
      }

      @media (min-width: 640px) {
        .pwa-modal-backdrop { align-items: center; }
      }

      @keyframes pwa-backdrop-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }

      .pwa-modal-card {
        position: relative;
        width: 100%;
        max-width: 440px;
        background-color: var(--bg-primary);
        color: var(--text-primary);
        border-radius: 1.25rem 1.25rem 0 0;
        padding: 1.75rem 1.5rem 1.5rem;
        box-shadow: 0 -10px 40px -10px rgba(0, 0, 0, 0.35);
        animation: pwa-card-in 320ms cubic-bezier(0.22, 1, 0.36, 1);
      }

      @media (min-width: 640px) {
        .pwa-modal-card {
          border-radius: 1.25rem;
          box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.45);
        }
      }

      @keyframes pwa-card-in {
        from { transform: translateY(2rem); opacity: 0; }
        to   { transform: translateY(0);    opacity: 1; }
      }

      .pwa-modal-close {
        position: absolute;
        top: 0.75rem;
        right: 0.75rem;
        width: 2rem;
        height: 2rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: 50%;
        background-color: transparent;
        color: var(--text-secondary);
        cursor: pointer;
        transition: background-color var(--transition-fast),
                    color var(--transition-fast);
      }
      .pwa-modal-close:hover {
        background-color: var(--bg-tertiary);
        color: var(--text-primary);
      }
      .close-icon { width: 1.125rem; height: 1.125rem; }

      .pwa-modal-icon-wrap {
        display: flex;
        justify-content: center;
        margin-bottom: 1rem;
      }
      .pwa-modal-icon {
        width: 72px;
        height: 72px;
        border-radius: 1rem;
        box-shadow: 0 8px 20px -8px rgba(0, 29, 86, 0.45);
      }

      .pwa-modal-title {
        margin: 0 0 0.5rem;
        font-size: 1.25rem;
        font-weight: 700;
        text-align: center;
        font-family: var(--font-heading), 'Poppins', system-ui, sans-serif;
      }

      .pwa-modal-text {
        margin: 0 0 1.25rem;
        text-align: center;
        font-size: 0.9375rem;
        color: var(--text-secondary);
        line-height: 1.5;
      }

      .pwa-modal-benefits {
        list-style: none;
        margin: 0 0 1.5rem;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.625rem;
      }
      .pwa-modal-benefits li {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        font-size: 0.875rem;
        color: var(--text-primary);
      }
      .check-icon {
        width: 1.125rem;
        height: 1.125rem;
        color: var(--accent-primary);
        flex-shrink: 0;
      }

      .pwa-modal-actions {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .pwa-modal-btn {
        width: 100%;
        padding: 0.75rem 1rem;
        border-radius: 0.75rem;
        border: none;
        font-size: 0.9375rem;
        font-weight: 600;
        cursor: pointer;
        transition: background-color var(--transition-fast),
                    color var(--transition-fast),
                    transform var(--transition-fast);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
      }

      .pwa-modal-btn.primary {
        background-color: var(--accent-primary);
        color: #fff;
      }
      .pwa-modal-btn.primary:hover:not(:disabled) {
        background-color: var(--accent-hover);
      }
      .pwa-modal-btn.primary:active:not(:disabled) {
        transform: scale(0.98);
      }
      .pwa-modal-btn.primary:disabled {
        opacity: 0.7;
        cursor: progress;
      }

      .pwa-modal-btn.ghost {
        background-color: transparent;
        color: var(--text-secondary);
      }
      .pwa-modal-btn.ghost:hover {
        background-color: var(--bg-tertiary);
        color: var(--text-primary);
      }

      .pwa-modal-spinner {
        width: 1rem;
        height: 1rem;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.4);
        border-top-color: #fff;
        animation: pwa-spin 0.7s linear infinite;
      }
      @keyframes pwa-spin {
        to { transform: rotate(360deg); }
      }
    `,
  ],
})
export class PwaInstallModalComponent {
  protected readonly pwa = inject(PwaService);

  /**
   * Local visibility — gated by the `SHOW_DELAY_MS` timer. Even if the
   * service flags the app as installable immediately on load, we wait a
   * couple of seconds so the modal does not interrupt the initial paint.
   */
  protected readonly visible = signal(false);

  /** True while the native install prompt is open awaiting user choice. */
  protected readonly installing = signal(false);

  /** Pending show-timer handle so we can cancel if the user installs early. */
  private pendingShowTimer: ReturnType<typeof setTimeout> | null = null;

  /** Have we already armed the show-timer once this session? */
  private timerArmed = false;

  constructor() {
    // Reactive bridge between the service's eligibility signal and our
    // delayed local visibility. When eligibility flips off (installed,
    // dismissed) we hide and cancel any pending show.
    effect(() => {
      const eligible = this.pwa.showInstallModal();

      if (eligible && !this.timerArmed) {
        this.timerArmed = true;
        this.pendingShowTimer = setTimeout(() => {
          this.pendingShowTimer = null;
          // Re-check at fire time: state may have changed during the wait
          // (e.g. user installed via header button in another tab).
          if (this.pwa.showInstallModal()) {
            this.visible.set(true);
          }
        }, SHOW_DELAY_MS);
      } else if (!eligible) {
        this.cancelPendingShow();
        this.visible.set(false);
      }
    });
  }

  protected async onInstall(): Promise<void> {
    this.installing.set(true);
    try {
      const outcome = await this.pwa.promptInstall();
      this.visible.set(false);
      if (outcome === 'dismissed') {
        // Treat a native cancel as session-only dismissal so the user
        // can still find the install option via the header button.
        this.pwa.dismissInstallModalSession();
      }
    } finally {
      this.installing.set(false);
    }
  }

  /** "Más tarde" — hide for 7 days. */
  protected onDismissPersistent(): void {
    this.pwa.dismissInstallModalPersistent();
    this.visible.set(false);
  }

  /** X / backdrop / ESC — hide only for this session. */
  protected onDismissSession(): void {
    this.pwa.dismissInstallModalSession();
    this.visible.set(false);
  }

  protected onBackdropClick(event: MouseEvent): void {
    // Close only when the click started on the backdrop itself, not
    // when a click bubbles up from inside the card.
    if (event.target === event.currentTarget) {
      this.onDismissSession();
    }
  }

  /** Close on ESC, matching the rest of the app's modal conventions. */
  @HostListener('document:keydown.escape')
  protected onEscapeKey(): void {
    if (this.visible()) this.onDismissSession();
  }

  private cancelPendingShow(): void {
    if (this.pendingShowTimer !== null) {
      clearTimeout(this.pendingShowTimer);
      this.pendingShowTimer = null;
    }
  }
}
