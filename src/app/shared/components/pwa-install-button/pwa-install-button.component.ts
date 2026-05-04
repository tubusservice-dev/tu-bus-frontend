import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PwaService } from '@core/services/pwa.service';

/**
 * PwaInstallButtonComponent
 *
 * Self-hiding install button. Renders nothing unless the browser has
 * fired `beforeinstallprompt` AND the app isn't already installed.
 * Designed to be dropped into any header without conditional wrappers
 * — the component owns its own visibility logic.
 *
 * Visual: matches the existing `login-btn` style in both headers so it
 * blends in with surrounding actions.
 */
@Component({
  selector: 'app-pwa-install-button',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (pwa.showInstallButton()) {
      <button
        type="button"
        class="pwa-install-btn"
        title="Instalar TuBus Express en tu dispositivo"
        (click)="onInstallClick()"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
             stroke-width="1.8" stroke="currentColor" class="pwa-install-icon">
          <path stroke-linecap="round" stroke-linejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        <span class="pwa-install-text">Instalar app</span>
      </button>
    }
  `,
  styles: [
    `
      :host { display: contents; }

      .pwa-install-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.875rem;
        border-radius: 0.625rem;
        background-color: var(--accent-primary);
        color: #fff;
        font-size: 0.875rem;
        font-weight: 600;
        line-height: 1;
        border: none;
        cursor: pointer;
        transition: background-color var(--transition-fast),
                    transform var(--transition-fast);
        white-space: nowrap;
      }

      .pwa-install-btn:hover  { background-color: var(--accent-hover); }
      .pwa-install-btn:active { transform: scale(0.97); }

      .pwa-install-icon {
        width: 1.125rem;
        height: 1.125rem;
        flex-shrink: 0;
      }

      /* Hide the label on very small screens to keep the icon-only chip */
      @media (max-width: 480px) {
        .pwa-install-text { display: none; }
        .pwa-install-btn  { padding: 0.5rem; }
      }
    `,
  ],
})
export class PwaInstallButtonComponent {
  protected readonly pwa = inject(PwaService);

  protected async onInstallClick(): Promise<void> {
    await this.pwa.promptInstall();
  }
}
