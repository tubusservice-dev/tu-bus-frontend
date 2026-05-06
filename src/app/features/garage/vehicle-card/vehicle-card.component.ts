import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Vehicle, VEHICLE_CATEGORY_OPTIONS } from '@models/vehicle.model';

@Component({
  selector: 'app-vehicle-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './vehicle-card.component.html',
  styleUrl: './vehicle-card.component.scss',
})
export class VehicleCardComponent {
  vehicle = input.required<Vehicle>();
  edit = output<Vehicle>();
  remove = output<Vehicle>();
  select = output<Vehicle>();

  onEdit(): void {
    this.edit.emit(this.vehicle());
  }

  onDelete(): void {
    this.remove.emit(this.vehicle());
  }

  onSelect(): void {
    this.select.emit(this.vehicle());
  }

  get fuelLabel(): string {
    const ft = this.vehicle().engineType?.fuelType;
    if (!ft) return '';
    const map: Record<string, string> = {
      gasolina: 'Gasolina',
      diesel: 'Diésel',
      gas: 'Gas (GNV)',
      hibrido: 'Híbrido',
    };
    return map[ft] || ft;
  }

  get vehicleTypeLabel(): string {
    const vt = this.vehicle().vehicleType;
    return VEHICLE_CATEGORY_OPTIONS.find((o) => o.value === vt)?.label || '';
  }

  get oilTypeLabel(): string {
    const ot = this.vehicle().engineType?.oilType;
    if (!ot) return '';
    const map: Record<string, string> = {
      mineral: 'Mineral',
      'semi-sintetico': 'Semi Sintético',
      sintetico: 'Sintético',
    };
    return map[ot] || '';
  }
}