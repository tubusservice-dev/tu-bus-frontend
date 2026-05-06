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

      /* Matches the .cart-btn style so header utility buttons share the
         same visual language. CTA emphasis is kept via the install icon
         + tooltip rather than a contrasting background. */
      .pwa-install-btn {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem;
        border-radius: 0.5rem;
        background-color: var(--bg-tertiary);
        color: var(--text-primary);
        font-size: 0.875rem;
        font-weight: 600;
        line-height: 1;
        border: none;
        cursor: pointer;
        transition: background-color 200ms, color 200ms, transform 200ms;
        white-space: nowrap;
      }

      .pwa-install-btn:hover {
        background-color: var(--border-color-hover);
        color: var(--accent-primary);
      }

      .pwa-install-btn:active { transform: scale(0.97); }

      .pwa-install-icon {
        width: 1.25rem;
        height: 1.25rem;
        flex-shrink: 0;
      }

      /* On wider screens expand horizontally to show the label. */
      @media (min-width: 481px) {
        .pwa-install-btn { padding: 0.5rem 0.875rem; }
      }

      /* Hide the label on small screens so it stays a square icon chip. */
      @media (max-width: 480px) {
        .pwa-install-text { display: none; }
      }

      /* Dark-mode chrome — mirrors .cart-btn dark overrides. */
      :host-context(.dark) .pwa-install-btn {
        background-color: #374151;
        color: #f3f4f6;
      }
      :host-context(.dark) .pwa-install-btn:hover {
        background-color: #4b5563;
        color: var(--tubus-text-accent, #4d94ff);
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
