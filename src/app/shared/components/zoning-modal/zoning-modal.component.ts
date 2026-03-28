import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

// TODO: Refactor zoning-modal for new zone architecture.
// Previously used ZoneService signals (cities, activeCities, inactiveCities,
// selectedCity, selectCity, selectMunicipality, clearSelection, hasSelection, loadCities).
// These were removed in the zone service rewrite.
// For now, the modal is disabled (showModal = false) until the new client-side
// zone selection flow is implemented.

type ModalStep = 'city' | 'municipality' | 'out-of-coverage';

@Component({
  selector: 'app-zoning-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './zoning-modal.component.html',
  styleUrl: './zoning-modal.component.scss',
})
export class ZoningModalComponent {
  protected readonly step = signal<ModalStep>('city');
  protected readonly selectedCity = signal<any>(null);

  // TODO: These need to come from a new client-side zone selection service
  protected readonly activeCities = signal<any[]>([]);
  protected readonly inactiveCities = signal<any[]>([]);
  protected readonly isLoading = signal(false);

  protected readonly availableMunicipalities = signal<any[]>([]);

  // TODO: Always hidden until new zone selection flow is implemented
  protected readonly showModal = signal(false);

  selectCity(city: any): void {
    // TODO: Implement with new zone architecture
  }

  selectMunicipality(municipality: any): void {
    // TODO: Implement with new zone architecture
  }

  backToCity(): void {
    this.selectedCity.set(null);
    this.step.set('city');
  }
}
