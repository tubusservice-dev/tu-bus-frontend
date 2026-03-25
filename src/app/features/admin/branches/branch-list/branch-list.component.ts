import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BranchService } from '../../../../core/services/branch.service';
import { Branch, ScheduleDay, ServiceMunicipality } from '../../../../models/branch.model';

@Component({
  selector: 'app-branch-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './branch-list.component.html',
  styleUrl: './branch-list.component.scss',
})
export class BranchListComponent implements OnInit {
  private readonly branchService = inject(BranchService);

  protected readonly isLoading = signal(true);
  protected readonly branches = signal<Branch[]>([]);
  protected readonly searchTerm = signal('');
  protected readonly isToggling = signal<string | null>(null);
  protected readonly isDeleting = signal<string | null>(null);
  protected readonly branchToDelete = signal<Branch | null>(null);
  protected readonly selectedBranch = signal<Branch | null>(null);

  ngOnInit(): void {
    this.loadBranches();
  }

  loadBranches(): void {
    this.isLoading.set(true);
    this.branchService.getAll().subscribe({
      next: (response) => {
        this.branches.set(response.data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  get filteredBranches(): Branch[] {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.branches();
    return this.branches().filter(
      (b) =>
        b.name.toLowerCase().includes(term) ||
        b.cityName.toLowerCase().includes(term) ||
        b.stateName.toLowerCase().includes(term) ||
        b.address.toLowerCase().includes(term)
    );
  }

  getScheduleSummary(branch: Branch): string {
    if (!branch.schedule || branch.schedule.length === 0) return 'Sin horario';
    const openDays = branch.schedule.filter(d => !d.isClosed);
    if (openDays.length === 0) return 'Cerrado';
    if (openDays.length === 7) return `Todos los días ${openDays[0].openTime}-${openDays[0].closeTime}`;
    if (openDays.length >= 5) {
      const firstOpen = openDays[0];
      return `${firstOpen.dayName.substring(0, 3)}-${openDays[openDays.length - 1].dayName.substring(0, 3)} ${firstOpen.openTime}-${firstOpen.closeTime}`;
    }
    return `${openDays.length} días`;
  }

  getMunicipalityCount(branch: Branch): number {
    return branch.serviceMunicipalities?.length || 0;
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
  }

  closeDetailModal(): void {
    this.selectedBranch.set(null);
  }

  getOpenDays(branch: Branch): ScheduleDay[] {
    return branch.schedule?.filter(d => !d.isClosed) || [];
  }

  getClosedDays(branch: Branch): ScheduleDay[] {
    return branch.schedule?.filter(d => d.isClosed) || [];
  }

  getDeliveryMunicipalities(branch: Branch): ServiceMunicipality[] {
    return branch.serviceMunicipalities?.filter(m => m.hasDelivery) || [];
  }

  getOilChangeMunicipalities(branch: Branch): ServiceMunicipality[] {
    return branch.serviceMunicipalities?.filter(m => m.hasOilChangeService) || [];
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
