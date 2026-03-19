import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ZoneService, City, Municipality } from '../../../core/services/zone.service';

type ModalStep = 'city' | 'municipality' | 'out-of-coverage';

@Component({
  selector: 'app-zoning-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './zoning-modal.component.html',
  styleUrl: './zoning-modal.component.scss',
})
export class ZoningModalComponent implements OnInit {
  protected readonly zoneService = inject(ZoneService);

  protected readonly step = signal<ModalStep>('city');
  protected readonly selectedCity = signal<City | null>(null);

  protected readonly activeCities = this.zoneService.activeCities;
  protected readonly inactiveCities = this.zoneService.inactiveCities;
  protected readonly isLoading = this.zoneService.isLoading;

  protected readonly availableMunicipalities = computed(() => {
    const city = this.selectedCity();
    if (!city) return [];
    return city.municipalities.filter(m => m.isActive);
  });

  protected readonly showModal = computed(() => !this.zoneService.hasSelection());

  constructor() {
    // Resetear el step cada vez que el modal se abre
    effect(() => {
      if (this.showModal()) {
        this.step.set('city');
        this.selectedCity.set(null);
      }
    });
  }

  ngOnInit(): void {
    if (this.zoneService.cities().length === 0) {
      this.zoneService.loadCities().subscribe();
    }
  }

  selectCity(city: City): void {
    if (!city.isActive) {
      this.selectedCity.set(city);
      this.step.set('out-of-coverage');
      return;
    }

    const activeMunicipalities = city.municipalities.filter(m => m.isActive);

    if (activeMunicipalities.length === 1) {
      // Si solo hay un municipio activo, seleccionar automáticamente
      this.zoneService.selectCity(city);
      this.zoneService.selectMunicipality(activeMunicipalities[0]);
      return;
    }

    this.selectedCity.set(city);
    this.zoneService.selectCity(city);
    this.step.set('municipality');
  }

  selectMunicipality(municipality: Municipality): void {
    this.zoneService.selectMunicipality(municipality);
  }

  backToCity(): void {
    this.selectedCity.set(null);
    this.zoneService.clearSelection();
    this.step.set('city');
  }
}
