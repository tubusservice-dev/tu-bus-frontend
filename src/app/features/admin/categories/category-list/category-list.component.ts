import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CategoryService } from '../../../../core/services/category.service';
import { Category, VEHICLE_TYPE_LABELS, VehicleType } from '../../../../models/product.model';
import { SearchInputComponent } from '../../../../shared/components/search-input/search-input.component';

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, SearchInputComponent],
  templateUrl: './category-list.component.html',
  styleUrl: './category-list.component.scss',
})
export class CategoryListComponent implements OnInit {
  private readonly categoryService = inject(CategoryService);

  protected readonly isLoading = signal(true);
  protected readonly categories = signal<Category[]>([]);
  protected readonly searchTerm = signal('');

  // Modal de detalles
  protected readonly detailModalOpen = signal(false);
  protected readonly selectedCategory = signal<Category | null>(null);

  // Modal de eliminación
  protected readonly deleteModalOpen = signal(false);
  protected readonly categoryToDelete = signal<Category | null>(null);
  protected readonly isDeleting = signal(false);

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.isLoading.set(true);
    this.categoryService.getAllAdmin().subscribe({
      next: (response) => {
        this.categories.set(response.data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  get filteredCategories(): Category[] {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.categories();
    return this.categories().filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.slug.toLowerCase().includes(term)
    );
  }

  openDetailModal(category: Category): void {
    this.selectedCategory.set(category);
    this.detailModalOpen.set(true);
  }

  closeDetailModal(): void {
    this.detailModalOpen.set(false);
    this.selectedCategory.set(null);
  }

  openDeleteModal(category: Category): void {
    this.categoryToDelete.set(category);
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.deleteModalOpen.set(false);
    this.categoryToDelete.set(null);
  }

  getVehicleTypeLabels(category: Category): string {
    if (!category.vehicleTypes?.length) return '';
    if (this.isUniversalCategory(category)) return 'Todos los vehículos';
    return category.vehicleTypes
      .filter(vt => vt !== VehicleType.ALL)
      .map(vt => VEHICLE_TYPE_LABELS[vt] || vt)
      .join(', ');
  }

  /** A category is universal when its vehicleTypes list contains VehicleType.ALL. */
  isUniversalCategory(category: Category): boolean {
    return !!category.vehicleTypes?.includes(VehicleType.ALL);
  }

  confirmDelete(): void {
    const category = this.categoryToDelete();
    if (!category) return;

    this.isDeleting.set(true);
    this.categoryService.delete(category.id).subscribe({
      next: () => {
        this.categories.update((items) => items.filter((c) => c.id !== category.id));
        this.closeDeleteModal();
        this.isDeleting.set(false);
      },
      error: () => {
        this.isDeleting.set(false);
      },
    });
  }
}
