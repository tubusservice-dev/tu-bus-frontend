import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * App-wide header chrome — single source of truth for height, background,
 * border, max-width container and padding across the global header,
 * overlay headers (cart / product detail) and every checkout step.
 *
 * Consumers project their variable content (logo, back button, title,
 * actions) via `<ng-content />`. The shell only owns the chrome.
 *
 * The `variant` input switches the z-index so overlay headers (cart,
 * product-detail) sit above the global header without each consumer
 * hard-coding a stacking value.
 */
@Component({
  selector: 'app-header-shell',
  standalone: true,
  template: `
    <div class="shell-bar">
      <div class="shell-content">
        <ng-content />
      </div>
    </div>
  `,
  styleUrl: './header-shell.component.scss',
  host: {
    '[attr.data-variant]': 'variant()'
  },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderShellComponent {
  readonly variant = input<'main' | 'overlay'>('main');
}
