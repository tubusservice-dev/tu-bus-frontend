import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ShippingAgencyService } from '../../../../core/services/shipping-agency.service';
import { ShippingAgency } from '../../../../models/product.model';

@Component({
  selector: 'app-shipping-agency-list',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './shipping-agency-list.component.html',
  styleUrl: './shipping-agency-list.component.scss',
})
export class ShippingAgencyListComponent implements OnInit {
  private readonly shippingAgencyService = inject(ShippingAgencyService);

  protected readonly isLoading = signal(true);
  protected readonly agencies = signal<ShippingAgency[]>([]);
  protected readonly searchTerm = signal('');

  // Modal de detalles
  protected readonly detailModalOpen = signal(false);
  protected readonly selectedAgency = signal<ShippingAgency | null>(null);

  // Modal de eliminación
  protected readonly deleteModalOpen = signal(false);
  protected readonly agencyToDelete = signal<ShippingAgency | null>(null);
  protected readonly isDeleting = signal(false);

  ngOnInit(): void {
    this.loadAgencies();
  }

  loadAgencies(): void {
    this.isLoading.set(true);
    this.shippingAgencyService.getAllAdmin().subscribe({
      next: (response) => {
        this.agencies.set(response.data);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  get filteredAgencies(): ShippingAgency[] {
    const term = this.searchTerm().toLowerCase();
    if (!term) return this.agencies();
    return this.agencies().filter(
      (a) =>
        a.name.toLowerCase().includes(term) ||
        a.slug.toLowerCase().includes(term)
    );
  }

  getConfigLabel(agency: ShippingAgency): string {
    if (agency.config.freeShipping) return 'Envío Gratis';
    if (agency.config.collectOnDelivery) return 'Cobro a Destino';
    if (agency.config.additionalCharge) return `+$${agency.config.additionalChargeAmount}`;
    return 'Sin configurar';
  }

  getConfigClass(agency: ShippingAgency): string {
    if (agency.config.freeShipping) return 'config-free';
    if (agency.config.collectOnDelivery) return 'config-collect';
    if (agency.config.additionalCharge) return 'config-additional';
    return 'config-none';
  }

  openDetailModal(agency: ShippingAgency): void {
    this.selectedAgency.set(agency);
    this.detailModalOpen.set(true);
  }

  closeDetailModal(): void {
    this.detailModalOpen.set(false);
    this.selectedAgency.set(null);
  }

  openDeleteModal(agency: ShippingAgency): void {
    this.agencyToDelete.set(agency);
    this.deleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.deleteModalOpen.set(false);
    this.agencyToDelete.set(null);
  }

  confirmDelete(): void {
    const agency = this.agencyToDelete();
    if (!agency) return;

    this.isDeleting.set(true);
    this.shippingAgencyService.delete(agency.id).subscribe({
      next: () => {
        this.agencies.update((items) => items.filter((a) => a.id !== agency.id));
        this.closeDeleteModal();
        this.isDeleting.set(false);
      },
      error: () => {
        this.isDeleting.set(false);
      },
    });
  }
}
