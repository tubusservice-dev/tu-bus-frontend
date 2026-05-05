import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { HeaderShellComponent } from '@shared/components/header-shell/header-shell.component';

/**
 * Standardised header for every checkout step — back arrow on the left,
 * title in the same flex row. Wraps `HeaderShellComponent` so chrome
 * (height, colors, padding) lives in exactly one place.
 *
 * Usage:
 *   <app-checkout-header title="Tipo de Despacho" (back)="goBack()" />
 */
@Component({
  selector: 'app-checkout-header',
  standalone: true,
  imports: [HeaderShellComponent],
  templateUrl: './checkout-header.component.html',
  styleUrl: './checkout-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CheckoutHeaderComponent {
  readonly title = input.required<string>();
  readonly back = output<void>();
}
