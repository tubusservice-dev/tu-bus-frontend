import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ZoneService, City, Municipality } from '../../../../core/services/zone.service';

@Component({
  selector: 'app-zone-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './zone-list.component.html',
  styleUrl: './zone-list.component.scss',
})
export class ZoneListComponent implements OnInit {
  private readonly zoneService = inject(ZoneService);

  protected readonly isLoading = signal(true);
  protected readonly cities = signal<City[]>([]);
  protected readonly searchTerm = signal('');
  protected readonly stateFilter = signal('');

  // Modal de detalles
  protected readonly detailModalOpen = signal(false);
  protected readonly selectedCity = signal<City | null>(null);

  // Modal de eliminación
  protected readonly deleteModalOpen = signal(false);
  protected readonly cityToDelete = signal<City | null>(null);
  protected readonly isDeleting = signal(false);

  ngOnInit(): void {
    this.loadCities();
  }

  loadCities(): void {
    this.isLoading.set(true);
    this.zoneService.getAllAdmin().subscribe({
      next: (cities) => {
        this.cities.set(cities);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  get uniqueStates(): { code: string; name: string }[] {
    const stateMap = new Map<string, string>();
    for (const city of this.cities()) {
      if (city.stateCode && city.stateName) {
        stateMap.set(city.stateCode, city.stateName);
      }
    }
    return Array.from(stateMap.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  get filteredCities(): City[] {
    let result = this.cities();

    const state = this.stateFilter();
    if (state) {
      result = result.filter(c => c.stateCode === state);
    }

    const term = this.searchTerm().toLowerCase();
    if (term) {
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.code.toLowerCase().includes(term) ||
          (c.stateName || '').toLowerCase().includes(term)
      );
    }

    return result;
  }

  getMunicipalityCount(city: City): number {
    return city.municipalities.length || 0;
  }

  getActiveMunicipalityCount(city: City): number {
    return city.municipalities.filter(m => m.isActive).length || 0;
  }

  openDetailModal(city: City): void {
    this.selectedCity.set(city);
    this.detailModalOpen.set(true);
  }

  closeDetailModal(): void {
    this.detailModalOpen.set(false);
    this.selectedCity.set(null);
  }

  openDeleteModal(city: City): void {
    this.cityToDelete.set(city);
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.deleteModalOpen.set(false);
    this.cityToDelete.set(null);
  }

  confirmDelete(): void {
    const city = this.cityToDelete();
    if (!city) return;

    this.isDeleting.set(true);
    this.zoneService.delete(city.id).subscribe({
      next: () => {
        this.cities.update((items) => items.filter((c) => c.id !== city.id));
        this.closeDeleteModal();
        this.isDeleting.set(false);
      },
      error: () => {
        this.isDeleting.set(false);
      },
    });
  }
}
