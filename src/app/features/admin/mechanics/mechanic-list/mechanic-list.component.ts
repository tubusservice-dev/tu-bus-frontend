import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MechanicService } from '../../../../core/services/mechanic.service';
import { Mechanic } from '../../../../models/mechanic.model';
import { SearchInputComponent } from '../../../../shared/components/search-input/search-input.component';
import { MechanicAvatarComponent } from '../../../../shared/components/mechanic-avatar/mechanic-avatar.component';

@Component({
  selector: 'app-mechanic-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, SearchInputComponent, MechanicAvatarComponent],
  templateUrl: './mechanic-list.component.html',
  styleUrl: './mechanic-list.component.scss',
})
export class MechanicListComponent implements OnInit {
  private readonly mechanicService = inject(MechanicService);

  protected readonly isLoading = signal(true);
  protected readonly mechanics = signal<Mechanic[]>([]);
  protected readonly searchTerm = signal('');
  protected readonly currentPage = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly totalItems = signal(0);
  protected readonly isToggling = signal<string | null>(null);
  protected readonly isDeleting = signal<string | null>(null);
  protected readonly mechanicToDelete = signal<Mechanic | null>(null);

  ngOnInit(): void {
    this.loadMechanics();
  }

  loadMechanics(page = 1): void {
    this.isLoading.set(true);
    this.mechanicService.getAll(page, 10).subscribe({
      next: (response) => {
        this.mechanics.set(response.data);
        this.currentPage.set(response.pagination.page);
        this.totalPages.set(response.pagination.pages);
        this.totalItems.set(response.pagination.total);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  get filteredMechanics(): Mechanic[] {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.mechanics();
    return this.mechanics().filter(
      (m) =>
        m.name.toLowerCase().includes(term) ||
        m.whatsapp.includes(term)
    );
  }

  getBranchNames(mechanic: Mechanic): string {
    if (!mechanic.branches || mechanic.branches.length === 0) return '-';
    return mechanic.branches
      .map(b => typeof b === 'object' && b ? b.name : String(b))
      .join(', ');
  }

  toggleStatus(mechanic: Mechanic): void {
    this.isToggling.set(mechanic.id);
    this.mechanicService.toggleStatus(mechanic.id).subscribe({
      next: (response) => {
        this.mechanics.update((items) =>
          items.map((m) => (m.id === mechanic.id ? response.data : m))
        );
        this.isToggling.set(null);
      },
      error: () => {
        this.isToggling.set(null);
      },
    });
  }

  openDeleteModal(mechanic: Mechanic): void {
    this.mechanicToDelete.set(mechanic);
  }

  closeDeleteModal(): void {
    this.mechanicToDelete.set(null);
  }

  confirmDelete(): void {
    const mechanic = this.mechanicToDelete();
    if (!mechanic) return;

    this.isDeleting.set(mechanic.id);
    this.mechanicService.delete(mechanic.id).subscribe({
      next: () => {
        this.mechanics.update((items) => items.filter((m) => m.id !== mechanic.id));
        this.totalItems.update((t) => t - 1);
        this.isDeleting.set(null);
        this.mechanicToDelete.set(null);
      },
      error: () => {
        this.isDeleting.set(null);
      },
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.loadMechanics(page);
  }

  get pages(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }
}
