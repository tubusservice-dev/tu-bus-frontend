import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { BranchService } from '../../../../core/services/branch.service';
import { BranchZoneService } from '../../../../core/services/branch-zone.service';
import { Branch, ScheduleDay } from '../../../../models/branch.model';
import { BranchZone, DeliveryConfigItem } from '../../../../models/branch-zone.model';
import { Zone } from '../../../../models/zone.model';
import { City } from '../../../../models/city.model';

@Component({
  selector: 'app-branch-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './branch-list.component.html',
  styleUrl: './branch-list.component.scss',
})
export class BranchListComponent implements OnInit {
  private readonly branchService = inject(BranchService);
  private readonly branchZoneService = inject(BranchZoneService);

  protected readonly isLoading = signal(true);
  protected readonly branches = signal<Branch[]>([]);
  protected readonly searchTerm = signal('');
  protected readonly isToggling = signal<string | null>(null);
  protected readonly isDeleting = signal<string | null>(null);
  protected readonly branchToDelete = signal<Branch | null>(null);
  protected readonly selectedBranch = signal<Branch | null>(null);

  protected readonly branchZonesMap = signal<Map<string, BranchZone[]>>(new Map());
  protected readonly isLoadingZones = signal(false);
  protected readonly selectedBranchZones = signal<BranchZone[]>([]);

  ngOnInit(): void {
    this.loadBranches();
  }

  loadBranches(): void {
    this.isLoading.set(true);
    this.branchService.getAll().subscribe({
      next: (response) => {
        this.branches.set(response.data);
        this.isLoading.set(false);
        this.loadAllBranchZones(response.data);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  private loadAllBranchZones(branches: Branch[]): void {
    if (branches.length === 0) return;

    const requests: Record<string, ReturnType<BranchZoneService['getByBranch']>> = {};
    branches.forEach((b) => {
      requests[b.id] = this.branchZoneService.getByBranch(b.id);
    });

    forkJoin(requests).subscribe({
      next: (results) => {
        const map = new Map<string, BranchZone[]>();
        Object.entries(results).forEach(([branchId, response]) => {
          map.set(branchId, response.data);
        });
        this.branchZonesMap.set(map);
      },
    });
  }

  get filteredBranches(): Branch[] {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.branches();
    return this.branches().filter(
      (b) =>
        b.name.toLowerCase().includes(term) ||
        b.address.toLowerCase().includes(term)
    );
  }

  getScheduleSummary(branch: Branch): string {
    if (!branch.schedule || branch.schedule.length === 0) return 'Sin horario';
    const openDays = branch.schedule.filter(d => !d.isClosed);
    if (openDays.length === 0) return 'Cerrado';
    if (openDays.length === 7) return `Todos los dias ${openDays[0].openTime}-${openDays[0].closeTime}`;
    if (openDays.length >= 5) {
      const firstOpen = openDays[0];
      return `${firstOpen.dayName.substring(0, 3)}-${openDays[openDays.length - 1].dayName.substring(0, 3)} ${firstOpen.openTime}-${firstOpen.closeTime}`;
    }
    return `${openDays.length} dias`;
  }

  getZoneCountForBranch(branchId: string): number {
    return this.branchZonesMap().get(branchId)?.length || 0;
  }

  toggleStatus(branch: Branch): void {
    this.isToggling.set(branch.id);
    this.branchService.toggleStatus(branch.id).subscribe({
      next: (response) => {
        this.branches.update((items) =>
          items.map((b) => (b.id === branch.id ? response.data : b))
        );
        this.isToggling.set(null);
      },
      error: () => {
        this.isToggling.set(null);
      },
    });
  }

  openDetailModal(branch: Branch): void {
    this.selectedBranch.set(branch);
    this.loadBranchZones(branch.id);
  }

  closeDetailModal(): void {
    this.selectedBranch.set(null);
    this.selectedBranchZones.set([]);
  }

  loadBranchZones(branchId: string): void {
    this.isLoadingZones.set(true);
    this.selectedBranchZones.set([]);
    this.branchZoneService.getByBranch(branchId).subscribe({
      next: (response) => {
        this.selectedBranchZones.set(response.data);
        this.isLoadingZones.set(false);
      },
      error: () => {
        this.isLoadingZones.set(false);
      },
    });
  }

  getZoneName(bz: BranchZone): string {
    return (bz.zone as Zone)?.name || 'Sin nombre';
  }

  getCityName(bz: BranchZone): string {
    return ((bz.zone as Zone)?.city as City)?.name || '';
  }

  getMunicipalityCount(bz: BranchZone): number {
    return bz.deliveryConfig?.length || 0;
  }

  getDeliveryBadge(item: DeliveryConfigItem): string {
    if (!item.hasDelivery) return 'Sin delivery';
    if (item.freeDelivery) return 'Gratis';
    return `$${item.deliveryCharge.toFixed(2)}`;
  }

  getOpenDays(branch: Branch): ScheduleDay[] {
    return branch.schedule?.filter(d => !d.isClosed) || [];
  }

  getClosedDays(branch: Branch): ScheduleDay[] {
    return branch.schedule?.filter(d => d.isClosed) || [];
  }

  openDeleteModal(branch: Branch): void {
    this.branchToDelete.set(branch);
  }

  closeDeleteModal(): void {
    this.branchToDelete.set(null);
  }

  confirmDelete(): void {
    const branch = this.branchToDelete();
    if (!branch) return;

    this.isDeleting.set(branch.id);
    this.branchService.delete(branch.id).subscribe({
      next: () => {
        this.branches.update((items) => items.filter((b) => b.id !== branch.id));
        this.isDeleting.set(null);
        this.branchToDelete.set(null);
      },
      error: () => {
        this.isDeleting.set(null);
      },
    });
  }
}
