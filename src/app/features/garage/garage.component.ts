import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { VehicleService } from '../../core/services/vehicle.service';
import { Vehicle } from '../../models/vehicle.model';
import { VehicleCardComponent } from './vehicle-card/vehicle-card.component';
import { VehicleFormComponent } from './vehicle-form/vehicle-form.component';

@Component({
  selector: 'app-garage',
  standalone: true,
  imports: [CommonModule, VehicleCardComponent, VehicleFormComponent],
  templateUrl: './garage.component.html',
  styleUrl: './garage.component.scss',
})
export class GarageComponent implements OnInit {
  protected readonly vehicleService = inject(VehicleService);
  private readonly router = inject(Router);

  protected readonly showForm = signal(false);
  protected readonly editingVehicle = signal<Vehicle | null>(null);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.vehicleService.getMyVehicles().subscribe();
  }

  openCreateForm(): void {
    this.editingVehicle.set(null);
    this.showForm.set(true);
    this.clearMessages();
  }

  openEditForm(vehicle: Vehicle): void {
    this.editingVehicle.set(vehicle);
    this.showForm.set(true);
    this.clearMessages();
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingVehicle.set(null);
  }

  onSave(data: any): void {
    this.isSubmitting.set(true);
    this.clearMessages();

    const editing = this.editingVehicle();

    if (editing) {
      this.vehicleService.update(editing.id, data).subscribe({
        next: () => {
          this.successMessage.set('Vehículo actualizado exitosamente');
          this.closeForm();
          this.isSubmitting.set(false);
        },
        error: (err) => {
          this.errorMessage.set(err.error?.message || 'Error al actualizar el vehículo');
          this.isSubmitting.set(false);
        },
      });
    } else {
      this.vehicleService.create(data).subscribe({
        next: () => {
          this.successMessage.set('Vehículo registrado exitosamente');
          this.closeForm();
          this.isSubmitting.set(false);
        },
        error: (err) => {
          this.errorMessage.set(err.error?.message || 'Error al registrar el vehículo');
          this.isSubmitting.set(false);
        },
      });
    }
  }

  onDelete(vehicle: Vehicle): void {
    const label = `${vehicle.marca} ${vehicle.modelo}${vehicle.placa ? ` (${vehicle.placa})` : ''}`;
    if (!confirm(`¿Eliminar el vehículo ${label}?`)) {
      return;
    }

    this.vehicleService.delete(vehicle.id).subscribe({
      next: () => this.successMessage.set('Vehículo eliminado exitosamente'),
      error: (err) => this.errorMessage.set(err.error?.message || 'Error al eliminar el vehículo'),
    });
  }

  onSelectVehicle(vehicle: Vehicle): void {
    this.vehicleService.selectVehicle(vehicle);
    this.router.navigate(['/catalogo'], {
      queryParams: {
        fromGarage: true,
        vehicleType: vehicle.vehicleType,
      },
    });
  }

  private clearMessages(): void {
    this.successMessage.set(null);
    this.errorMessage.set(null);
  }
}