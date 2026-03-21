import { Component, inject, input, output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { Vehicle, MARCAS_VEHICULOS_VE, CILINDRADAS, TIPOS_COMBUSTIBLE, TIPOS_ACEITE } from '../../../models/vehicle.model';
import { VehicleService } from '../../../core/services/vehicle.service';

// Formato placas Venezuela: 1-3 letras, guión opcional, 1-4 alfanuméricos (ej: DFY-H37, ABC123, AB123CD)
const PLACA_VE_REGEX = /^[A-Za-z]{1,3}-?[A-Za-z0-9]{1,5}$/;

@Component({
  selector: 'app-vehicle-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './vehicle-form.component.html',
  styleUrl: './vehicle-form.component.scss',
})
export class VehicleFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly vehicleService = inject(VehicleService);

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
      placa: [v?.placa || '', [Validators.required, Validators.pattern(PLACA_VE_REGEX), this.duplicatePlacaValidator.bind(this)]],
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

  private duplicatePlacaValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    const placa = control.value.toUpperCase().replace(/-/g, '');
    const editing = this.vehicle();
    const exists = this.vehicleService.vehicles().some(v => {
      if (editing && v.id === editing.id) return false;
      return v.placa.toUpperCase().replace(/-/g, '') === placa;
    });
    return exists ? { duplicatePlaca: true } : null;
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

  getErrorMessage(field: string): string {
    const control = this.form.get(field);
    if (!control || !control.errors || !control.touched) return '';

    if (control.errors['required']) {
      const labels: Record<string, string> = {
        placa: 'La placa', marca: 'La marca', modelo: 'El modelo',
        year: 'El año', displacement: 'La cilindrada', oilType: 'El tipo de aceite',
        oilCapacityLiters: 'La capacidad de aceite',
      };
      return `${labels[field] || 'Este campo'} es requerido`;
    }
    if (control.errors['pattern'] && field === 'placa') {
      return 'Formato inválido. Ej: DFY-H37, ABC-123';
    }
    if (control.errors['duplicatePlaca']) {
      return 'Ya tienes un vehículo con esta placa';
    }
    if (control.errors['min']) {
      if (field === 'year') return `El año mínimo es 1960`;
      if (field === 'oilCapacityLiters') return 'Mínimo 0.5 litros';
      if (field === 'cylinders') return 'Mínimo 1 cilindro';
      return `Valor mínimo: ${control.errors['min'].min}`;
    }
    if (control.errors['max']) {
      if (field === 'year') return `El año máximo es ${this.currentYear + 1}`;
      if (field === 'cylinders') return 'Máximo 16 cilindros';
      return `Valor máximo: ${control.errors['max'].max}`;
    }
    return 'Campo inválido';
  }
}