import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Zone } from '../../../../models/zone.model';
import { ZoneService } from '../../../../core/services/zone.service';
import { SearchInputComponent } from '../../../../shared/components/search-input/search-input.component';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog.component';
import { GeoAdminService } from '@core/services/geo-admin.service';

/** One municipality of a zone in the detail modal: how many of its parishes the zone covers. */
interface ZoneMunicipalitySummary {
  name: string;
  selected: number;
  total: number;
}

@Component({
  selector: 'app-zone-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, SearchInputComponent, ConfirmDialogComponent],
  templateUrl: './zone-list.component.html',
  styleUrl: './zone-list.component.scss',
})
export class ZoneListComponent implements OnInit {
  private readonly zoneService = inject(ZoneService);
  private readonly geoAdminService = inject(GeoAdminService);

  protected readonly isLoading = signal(true);
  protected readonly zones = signal<Zone[]>([]);
  protected readonly searchTerm = signal('');
  protected readonly stateFilter = signal('');
  private readonly stateNames = signal<Map<string, string>>(new Map());

  /** States that have at least one zone, for the filter. */
  protected readonly zoneStates = computed(() => {
    const names = this.stateNames();
    const ids = new Set(this.zones().flatMap((z) => z.states ?? []));
    return [...ids]
      .filter((id) => names.has(id))
      .map((id) => ({ id, name: names.get(id)! }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  });

  // Detail modal
  protected readonly detailModalOpen = signal(false);
  protected readonly selectedZone = signal<Zone | null>(null);
  protected readonly detailMunicipalities = signal<ZoneMunicipalitySummary[] | null>(null);

  // Delete modal
  protected readonly deleteModalOpen = signal(false);
  protected readonly zoneToDelete = signal<Zone | null>(null);
  protected readonly isDeleting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadZones();
    this.geoAdminService.listStates().subscribe({
      next: (states) => this.stateNames.set(new Map(states.map((s) => [s.id, s.name]))),
    });
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

  get filteredZones(): Zone[] {
    let result = this.zones();

    const stateId = this.stateFilter();
    if (stateId) {
      result = result.filter((z) => z.states?.includes(stateId));
    }

    const term = this.searchTerm().toLowerCase();
    if (term) {
      result = result.filter((z) => {
        return z.name.toLowerCase().includes(term) || this.getStateName(z).toLowerCase().includes(term);
      });
    }

    return result;
  }

  getStateName(zone: Zone): string {
    const stateId = zone.states?.[0];
    return (stateId && this.stateNames().get(stateId)) || 'Sin parroquias';
  }

  getParishCount(zone: Zone): number {
    return zone.parishes?.length || 0;
  }

  // ==================== DETAIL MODAL ====================

  openDetailModal(zone: Zone): void {
    this.selectedZone.set(zone);
    this.detailModalOpen.set(true);
    this.detailMunicipalities.set(null);

    const stateId = zone.states?.[0];
    if (!stateId) {
      this.detailMunicipalities.set([]);
      return;
    }
    const covered = new Set(zone.parishes ?? []);
    this.geoAdminService.getTree(stateId).subscribe({
      next: (tree) => {
        if (this.selectedZone()?.id !== zone.id) return;
        this.detailMunicipalities.set(
          tree.municipalities
            .map((m) => {
              const ids = m.cities.flatMap((c) => c.parishes.map((p) => p.id));
              return { name: m.name, selected: ids.filter((id) => covered.has(id)).length, total: ids.length };
            })
            .filter((m) => m.selected > 0),
        );
      },
      error: () => this.detailMunicipalities.set([]),
    });
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
