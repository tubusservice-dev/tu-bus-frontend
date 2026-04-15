import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LineService } from '../../../../core/services/line.service';
import { Line } from '../../../../models/product.model';
import { SearchInputComponent } from '../../../../shared/components/search-input/search-input.component';

@Component({
  selector: 'app-line-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, SearchInputComponent],
  templateUrl: './line-list.component.html',
  styleUrl: './line-list.component.scss',
})
export class LineListComponent implements OnInit {
  private readonly lineService = inject(LineService);

  protected readonly isLoading = signal(true);
  protected readonly lines = signal<Line[]>([]);
  protected readonly searchTerm = signal('');

  // Modal de detalles
  protected readonly detailModalOpen = signal(false);
  protected readonly selectedLine = signal<Line | null>(null);

  // Modal de eliminación
  protected readonly deleteModalOpen = signal(false);
  protected readonly lineToDelete = signal<Line | null>(null);
  protected readonly isDeleting = signal(false);

  ngOnInit(): void {
    this.loadLines();
  }

  loadLines(): void {
    this.isLoading.set(true);
    this.lineService.getAllAdmin().subscribe({
      next: (response) => {
        this.lines.set(response.data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  get filteredLines(): Line[] {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.lines();
    return this.lines().filter(
      (l) =>
        l.name.toLowerCase().includes(term) ||
        l.slug.toLowerCase().includes(term)
    );
  }

  openDetailModal(line: Line): void {
    this.selectedLine.set(line);
    this.detailModalOpen.set(true);
  }

  closeDetailModal(): void {
    this.detailModalOpen.set(false);
    this.selectedLine.set(null);
  }

  openDeleteModal(line: Line): void {
    this.lineToDelete.set(line);
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.deleteModalOpen.set(false);
    this.lineToDelete.set(null);
  }

  confirmDelete(): void {
    const line = this.lineToDelete();
    if (!line) return;

    this.isDeleting.set(true);
    this.lineService.delete(line.id).subscribe({
      next: () => {
        this.lines.update((items) => items.filter((l) => l.id !== line.id));
        this.closeDeleteModal();
        this.isDeleting.set(false);
      },
      error: () => {
        this.isDeleting.set(false);
      },
    });
  }
}
