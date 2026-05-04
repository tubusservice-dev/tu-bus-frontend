import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { PwaService } from '../../../core/services/pwa.service';

/**
 * PwaUpdateBannerComponent
 *
 * Sticky bottom banner that appears when a new Service Worker version
 * has activated and the user is still on the old in-memory bundle.
 * Provides an "Actualizar" action that reloads to pick up the new
 * assets, plus a dismiss option for users who want to defer.
 *
 * Mounted at the application root (app.html) so it's always reachable
 * regardless of the current route or open overlay.
 */
@Component({
  selector: 'app-pwa-update-banner',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (pwa.updateReady() && !dismissed()) {
      <div class="pwa-update-banner" role="status" aria-live="polite">
        <div class="pwa-update-content">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
               stroke-width="1.8" stroke="currentColor" class="pwa-update-icon">
            <path stroke-linecap="round" stroke-linejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
          <span class="pwa-update-text">Hay una nueva versión disponible.</span>
        </div>
        <div class="pwa-update-actions">
          <button type="button" class="pwa-update-btn primary" (click)="onUpdate()">
            Actualizar
          </button>
          <button type="button" class="pwa-update-btn ghost" (click)="dismiss()" aria-label="Cerrar">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                 stroke-width="2" stroke="currentColor" class="close-icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host { display: contents; }

      .pwa-update-banner {
        position: fixed;
        left: 50%;
        bottom: 1rem;
        transform: translateX(-50%);
        z-index: 2000;
        display: flex;
        align-items: center;
        gap: 1rem;
        max-width: calc(100vw - 2rem);
        padding: 0.75rem 1rem;
        border-radius: 0.875rem;
        background-color: var(--accent-primary);
        color: #fff;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.35);
        animation: pwa-banner-in 240ms ease-out;
      }

      @keyframes pwa-banner-in {
        from { transform: translate(-50%, 1.5rem); opacity: 0; }
        to   { transform: translate(-50%, 0);      opacity: 1; }
      }

      .pwa-update-content {
        display: flex;
        align-items: center;
        gap: 0.625rem;
        font-size: 0.875rem;
        font-weight: 500;
      }

      .pwa-update-icon {
        width: 1.25rem;
        height: 1.25rem;
        flex-shrink: 0;
      }

      .pwa-update-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .pwa-update-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 0.5rem;
        border: none;
        font-weight: 600;
        font-size: 0.875rem;
        cursor: pointer;
        transition: background-color var(--transition-fast);
      }

      .pwa-update-btn.primary {
        padding: 0.5rem 0.875rem;
        background-color: #fff;
        color: var(--accent-primary);
      }
      .pwa-update-btn.primary:hover { background-color: rgba(255, 255, 255, 0.85); }

      .pwa-update-btn.ghost {
        width: 2rem;
        height: 2rem;
        padding: 0;
        background-color: transparent;
        color: #fff;
      }
      .pwa-update-btn.ghost:hover { background-color: rgba(255, 255, 255, 0.15); }

      .close-icon {
        width: 1rem;
        height: 1rem;
      }

      @media (max-width: 480px) {
        .pwa-update-banner {
          left: 0.75rem;
          right: 0.75rem;
          transform: none;
          max-width: none;
        }
        @keyframes pwa-banner-in {
          from { transform: translateY(1.5rem); opacity: 0; }
          to   { transform: translateY(0);      opacity: 1; }
        }
      }
    `,
  ],
})
export class PwaUpdateBannerComponent {
  protected readonly pwa = inject(PwaService);

  /**
   * Local dismissal flag — survives only for this page session. After a
   * reload the banner reappears if the SW reports another update.
   */
  protected readonly dismissed = signal(false);

  protected onUpdate(): void {
    this.pwa.applyUpdate();
  }

  protected dismiss(): void {
    this.dismissed.set(true);
  }
}
