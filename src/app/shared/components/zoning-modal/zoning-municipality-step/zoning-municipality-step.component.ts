import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DeliveryStatus, GeoCoverageState } from '@models/geo.model';

type CoveredMunicipality = GeoCoverageState['municipalities'][number];

/** How each municipality is labelled: only what the customer really gets there. */
const DELIVERY_LABELS: Record<DeliveryStatus, string> = {
  full: 'Delivery disponible',
  partial: 'Delivery en parte del municipio',
  none: 'Solo retiro en tienda',
};

/**
 * Second step of the zoning modal: the municipalities with service in the
 * chosen state, each with what it gets. Presentational.
 */
@Component({
  selector: 'app-zoning-municipality-step',
  standalone: true,
  templateUrl: './zoning-municipality-step.component.html',
  styleUrl: './zoning-municipality-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZoningMunicipalityStepComponent {
  readonly entry = input.required<GeoCoverageState>();

  readonly municipalitySelected = output<CoveredMunicipality>();
  readonly back = output<void>();

  protected readonly labels = DELIVERY_LABELS;
}
