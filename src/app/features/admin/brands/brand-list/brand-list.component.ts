import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BrandService } from '../../../../core/services/brand.service';
import { Brand } from '../../../../models/product.model';

@Component({
  selector: 'app-brand-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './brand-list.component.html',
  styleUrl: './brand-list.component.scss',
})
export class BrandListComponent implements OnInit {
  private readonly brandService = inject(BrandService);

  protected readonly isLoading = signal(true);
  protected readonly brands = signal<Brand[]>([]);
  protected readonly searchTerm = signal('');
  protected readonly errorMessage = signal<string | null>(null);

  // Modal de detalles
  protected readonly detailModalOpen = signal(false);
  protected readonly selectedBrand = signal<Brand | null>(null);

  // Modal de eliminación
  protected readonly deleteModalOpen = signal(false);
  protected readonly brandToDelete = signal<Brand | null>(null);
  protected readonly isDeleting = signal(false);

  ngOnInit(): void {
    this.loadBrands();
  }

  loadBrands(): void {
    this.isLoading.set(true);
    this.brandService.getAllAdmin().subscribe({
      next: (response) => {
        this.brands.set(response.data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  get filteredBrands(): Brand[] {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.brands();
    return this.brands().filter(
      (b) =>
        b.name.toLowerCase().includes(term) ||
        b.slug.toLowerCase().includes(term)
    );
  }

  openDetailModal(brand: Brand): void {
    this.selectedBrand.set(brand);
    this.detailModalOpen.set(true);
  }

  closeDetailModal(): void {
    this.detailModalOpen.set(false);
    this.selectedBrand.set(null);
  }

  openDeleteModal(brand: Brand): void {
    this.brandToDelete.set(brand);
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.deleteModalOpen.set(false);
    this.brandToDelete.set(null);
  }

  confirmDelete(): void {
    const brand = this.brandToDelete();
    if (!brand) return;

    this.isDeleting.set(true);
    this.errorMessage.set(null);
    this.brandService.delete(brand.id).subscribe({
      next: () => {
        this.brands.update((items) => items.filter((b) => b.id !== brand.id));
        this.closeDeleteModal();
        this.isDeleting.set(false);
      },
      error: (error) => {
        this.isDeleting.set(false);
        this.closeDeleteModal();
        this.errorMessage.set(error.error?.message || 'Error al eliminar la marca');
      },
    });
  }
}
