import { Component, inject, input, output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Vehicle, MARCAS_VEHICULOS_VE, CILINDRADAS, TIPOS_COMBUSTIBLE, TIPOS_ACEITE } from '../../../models/vehicle.model';

@Component({
  selector: 'app-vehicle-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './vehicle-form.component.html',
  styleUrl: './vehicle-form.component.scss',
})
export class VehicleFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  vehicle = input<Vehicle | null>(null);
  save = output<any>();
  cancel = output<void>();

  protected form!: FormGroup;
  protected readonly marcas = MARCAS_VEHICULOS_VE;
  protected readonly cilindradas = CILINDRADAS;
  protected readonly combustibles = TIPOS_COMBUSTIBLE;
  protected readonly tiposAceite = TIPOS_ACEITE;

  protected readonly currentYear = new Date().getFullYear();

  ngOnInit(): void {
    const v = this.vehicle();
    this.form = this.fb.group({
      placa: [v?.placa || '', [Validators.required, Validators.pattern(/^[A-Za-z0-9]{5,8}$/)]],
      marca: [v?.marca || '', [Validators.required]],
      modelo: [v?.modelo || '', [Validators.required]],
      year: [v?.year || '', [Validators.required, Validators.min(1960), Validators.max(this.currentYear + 1)]],
      kilometraje: [v?.kilometraje || 0, [Validators.min(0)]],
      fuelType: [v?.engineType?.fuelType || 'gasolina', [Validators.required]],
      displacement: [v?.engineType?.displacement || '', [Validators.required]],
      cylinders: [v?.engineType?.cylinders || 4, [Validators.required, Validators.min(1), Validators.max(16)]],
      oilCapacityLiters: [v?.engineType?.oilCapacityLiters || '', [Validators.required, Validators.min(0.5)]],
      oilType: [v?.engineType?.oilType || '', [Validators.required]],
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const val = this.form.value;
    this.save.emit({
      placa: val.placa.toUpperCase(),
      marca: val.marca,
      modelo: val.modelo,
      year: val.year,
      kilometraje: val.kilometraje || 0,
      engineType: {
        fuelType: val.fuelType,
        displacement: val.displacement,
        cylinders: val.cylinders,
        oilCapacityLiters: val.oilCapacityLiters,
        oilType: val.oilType,
      },
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }

  hasError(field: string): boolean {
    const control = this.form.get(field);
    return !!control && control.invalid && control.touched;
  }
}