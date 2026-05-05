import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CheckoutService } from '../services/checkout.service';
import { VehicleService } from '../../../core/services/vehicle.service';
import { Vehicle } from '../../../models/vehicle.model';
import { VehicleFormComponent } from '../../garage/vehicle-form/vehicle-form.component';
import { scrollToFirstFormError } from '../../../shared/validators/form-validators';
import { CheckoutHeaderComponent } from '../components/checkout-header/checkout-header.component';

/**
 * Vehicle-only picker for the `in_store_oil_change` dispatch type. Mirrors the
 * vehicle section of `checkout-oil-change-form` without the address and
 * personal-data form — those are unnecessary when the service happens at the
 * branch.
 *
 * Route: /checkout/cambio-aceite-tienda
 */
@Component({
  selector: 'app-checkout-in-store-oil-change-form',
  standalone: true,
  imports: [CommonModule, VehicleFormComponent, CheckoutHeaderComponent],
  templateUrl: './checkout-in-store-oil-change-form.component.html',
  styleUrl: './checkout-in-store-oil-change-form.component.scss',
})
export class CheckoutInStoreOilChangeFormComponent implements OnInit {
  protected readonly checkoutService = inject(CheckoutService);
  protected readonly vehicleService = inject(VehicleService);
  private readonly router = inject(Router);

  protected readonly vehicles = signal<Vehicle[]>([]);
  protected readonly showVehicleForm = signal(false);
  protected readonly isLoadingVehicles = signal(false);

  /** Flips to `true` once the user tries to continue at least once, so the
   *  "at least one vehicle required" error can be rendered in red. */
  protected readonly submitAttempted = signal(false);

  protected readonly selectedVehiclesLabel = computed(() => {
    const selected = this.checkoutService.selectedVehicles();
    if (selected.length === 0) return '';
    const label = selected.length === 1 ? 'seleccionado' : 'seleccionados';
    return `${selected.length} ${label}: ${selected.map((v) => v.marca).join(', ')}`;
  });

  ngOnInit(): void {
    if (this.checkoutService.dispatchType() !== 'in_store_oil_change') {
      this.router.navigate(['/checkout/despacho']);
      return;
    }

    if (!this.checkoutService.hasBranch()) {
      // Branch is selected in the summary AFTER this step, so we don't require
      // it here. Intentional no-op kept for clarity.
    }

    this.loadVehicles();
  }

  private loadVehicles(): void {
    this.isLoadingVehicles.set(true);
    this.vehicleService.getMyVehicles(1, 50).subscribe({
      next: (res: any) => {
        const list: Vehicle[] = res.data || [];
        this.vehicles.set(list);
        this.isLoadingVehicles.set(false);

        // Auto-select when there's exactly one vehicle and nothing picked yet
        if (list.length === 1 && this.checkoutService.selectedVehicles().length === 0) {
          this.checkoutService.addVehicle(list[0]);
        }
      },
      error: () => this.isLoadingVehicles.set(false),
    });
  }

  protected isVehicleSelected(vehicleId: string): boolean {
    return this.checkoutService.selectedVehicles().some((v) => v.id === vehicleId);
  }

  protected toggleVehicle(vehicle: Vehicle): void {
    this.checkoutService.toggleVehicle(vehicle);
  }

  protected openInlineVehicleForm(): void {
    this.showVehicleForm.set(true);
  }

  protected cancelInlineVehicle(): void {
    this.showVehicleForm.set(false);
  }

  protected onInlineVehicleSave(data: any): void {
    this.vehicleService.create(data).subscribe({
      next: (res: any) => {
        const newVehicle = res.data;
        this.vehicles.update((list) => [newVehicle, ...list]);
        this.checkoutService.addVehicle(newVehicle);
        this.showVehicleForm.set(false);
      },
    });
  }

  protected onContinue(): void {
    this.submitAttempted.set(true);
    if (this.checkoutService.selectedVehicles().length === 0) {
      scrollToFirstFormError();
      return;
    }
    this.router.navigate(['/checkout/resumen']);
  }

  protected goBack(): void {
    this.router.navigate(['/checkout/despacho']);
  }
}
