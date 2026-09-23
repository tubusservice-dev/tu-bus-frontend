import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { GeoCoverageState, GeoSearchHit } from '@models/geo.model';
import { SearchInputComponent } from '../../search-input/search-input.component';

/**
 * First step of the zoning modal: the states with service, by name only (a
 * state can have many municipalities), and a search box that jumps straight
 * to a municipality. Presentational: the modal owns the data and the search.
 */
@Component({
  selector: 'app-zoning-state-step',
  standalone: true,
  imports: [SearchInputComponent],
  templateUrl: './zoning-state-step.component.html',
  styleUrl: './zoning-state-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZoningStateStepComponent {
  readonly states = input.required<GeoCoverageState[]>();
  /** Search results; null while the box has fewer than two characters. */
  readonly hits = input<GeoSearchHit[] | null>(null);
  readonly searching = input(false);
  readonly query = input('');

  readonly queryChange = output<string>();
  readonly stateSelected = output<GeoCoverageState>();
  readonly hitSelected = output<GeoSearchHit>();
}
