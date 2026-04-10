import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { City } from '../../../../models/city.model';
import { Zone } from '../../../../models/zone.model';
import { ZoneService } from '../../../../core/services/zone.service';

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
  protected readonly zones = signal<Zone[]>([]);
  protected readonly searchTerm = signal('');
  protected readonly cityFilter = signal('');

  // Detail modal
  protected readonly detailModalOpen = signal(false);
  protected readonly selectedZone = signal<Zone | null>(null);

  // Delete modal
  protected readonly deleteModalOpen = signal(false);
  protected readonly zoneToDelete = signal<Zone | null>(null);
  protected readonly isDeleting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadZones();
  }

  loadZones(): void {
    this.isLoading.set(true);
    this.zoneService.getAllAdmin().subscribe({
      next: (response) => {
        this.zones.set(response.data || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  get uniqueCities(): { id: string; name: string }[] {
    const cityMap = new Map<string, string>();
    for (const zone of this.zones()) {
      if (zone.city && typeof zone.city === 'object') {
        const city = zone.city as City;
        cityMap.set(city.id || city.slug, city.name);
      }
    }
    return Array.from(cityMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  get filteredZones(): Zone[] {
    let result = this.zones();

    const cityId = this.cityFilter();
    if (cityId) {
      result = result.filter((z) => {
        if (typeof z.city === 'object') {
          const city = z.city as City;
          return (city.id || city.slug) === cityId;
        }
        return z.city === cityId;
      });
    }

    const term = this.searchTerm().toLowerCase();
    if (term) {
      result = result.filter((z) => {
        const cityName = typeof z.city === 'object' ? (z.city as City).name : '';
        return (
          z.name.toLowerCase().includes(term) ||
          cityName.toLowerCase().includes(term)
        );
      });
    }

    return result;
  }

  getCityName(zone: Zone): string {
    if (zone.city && typeof zone.city === 'object') {
      return (zone.city as City).name;
    }
    return '';
  }

  getMunicipalityCount(zone: Zone): number {
    return zone.municipalities?.length || 0;
  }

  // ==================== DETAIL MODAL ====================

  openDetailModal(zone: Zone): void {
    this.selectedZone.set(zone);
    this.detailModalOpen.set(true);
  }

  closeDetailModal(): void {
    this.detailModalOpen.set(false);
    this.selectedZone.set(null);
  }

  // ==================== DELETE MODAL ====================

  openDeleteModal(zone: Zone): void {
    this.zoneToDelete.set(zone);
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.deleteModalOpen.set(false);
    this.zoneToDelete.set(null);
  }

  confirmDelete(): void {
    const zone = this.zoneToDelete();
    if (!zone) return;

    this.isDeleting.set(true);
    this.zoneService.delete(zone.id).subscribe({
      next: () => {
        this.zones.update((items) => items.filter((z) => z.id !== zone.id));
        this.closeDeleteModal();
        this.isDeleting.set(false);
      },
      error: (err) => {
        this.isDeleting.set(false);
        this.closeDeleteModal();
        const msg = err.error?.message || 'No se pudo eliminar la zona';
        this.errorMessage.set(msg);
        setTimeout(() => this.errorMessage.set(null), 5000);
      },
    });
  }
}
