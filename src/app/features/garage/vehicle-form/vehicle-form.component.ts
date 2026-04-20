import { Component, computed, inject, input, output, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import {
  Vehicle,
  VehicleCategory,
  MARCAS_VEHICULOS_VE,
  CILINDRADAS,
  TIPOS_COMBUSTIBLE,
  TIPOS_ACEITE,
  VEHICLE_CATEGORY_OPTIONS,
} from '../../../models/vehicle.model';
import { VehicleService } from '../../../core/services/vehicle.service';
import {
  SearchableSelectComponent,
  SearchableOption,
} from '../../../shared/components/searchable-select/searchable-select.component';

// Formato placas Venezuela: 1-3 letras, guión opcional, 1-4 alfanuméricos (ej: DFY-H37, ABC123, AB123CD)
const PLACA_VE_REGEX = /^[A-Za-z]{1,3}-?[A-Za-z0-9]{1,5}$/;

@Component({
  selector: 'app-vehicle-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SearchableSelectComponent],
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
  protected readonly cilindradas = CILINDRADAS;
  protected readonly combustibles = TIPOS_COMBUSTIBLE;
  protected readonly tiposAceite = TIPOS_ACEITE;

  protected readonly currentYear = new Date().getFullYear();

  // ===== Searchable selectors =====
  protected readonly marcaOptions: SearchableOption[] = MARCAS_VEHICULOS_VE.map((m) => ({
    id: m,
    label: m,
  }));

  protected readonly vehicleTypeOptions: SearchableOption[] = VEHICLE_CATEGORY_OPTIONS.map(
    (v) => ({ id: v.value, label: v.label })
  );

  protected readonly selectedMarca = signal<SearchableOption | null>(null);
  protected readonly selectedVehicleType = signal<SearchableOption | null>(null);

  // Triggered on submit attempt so required-errors only appear after user tries
  protected readonly submitted = signal(false);

  protected readonly marcaInvalid = computed(
    () => this.submitted() && !this.selectedMarca()
  );
  protected readonly vehicleTypeInvalid = computed(
    () => this.submitted() && !this.selectedVehicleType()
  );

  ngOnInit(): void {
    const v = this.vehicle();

    // Pre-fill searchable selectors if editing
    if (v?.marca) {
      const found = this.marcaOptions.find((o) => o.id === v.marca);
      this.selectedMarca.set(found ?? { id: v.marca, label: v.marca });
    }
    if (v?.vehicleType) {
      const found = this.vehicleTypeOptions.find((o) => o.id === v.vehicleType);
      if (found) this.selectedVehicleType.set(found);
    }

    // Only `modelo` stays required in the reactive form (marca and vehicleType
    // live outside via searchable selectors). Everything else is optional but
    // still validated when the user provides a value (pattern, min/max).
    this.form = this.fb.group({
      modelo: [v?.modelo || '', [Validators.required, Validators.maxLength(50)]],
      placa: [
        v?.placa || '',
        [Validators.pattern(PLACA_VE_REGEX), this.duplicatePlacaValidator.bind(this)],
      ],
      year: [
        v?.year ?? '',
        [Validators.min(1960), Validators.max(this.currentYear + 1)],
      ],
      kilometraje: [v?.kilometraje ?? 0, [Validators.min(0), Validators.max(9999999)]],
      fuelType: [v?.engineType?.fuelType || ''],
      displacement: [v?.engineType?.displacement || ''],
      cylinders: [v?.engineType?.cylinders ?? '', [Validators.min(1), Validators.max(16)]],
      oilCapacityLiters: [v?.engineType?.oilCapacityLiters ?? '', [Validators.min(0.5)]],
      oilType: [v?.engineType?.oilType || ''],
    });
  }

  onMarcaChange(option: SearchableOption | null): void {
    this.selectedMarca.set(option);
  }

  onVehicleTypeChange(option: SearchableOption | null): void {
    this.selectedVehicleType.set(option);
  }

  private duplicatePlacaValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;
    const placa = control.value.toUpperCase().replace(/-/g, '');
    const editing = this.vehicle();
    const exists = this.vehicleService.vehicles().some((v) => {
      if (editing && v.id === editing.id) return false;
      if (!v.placa) return false;
      return v.placa.toUpperCase().replace(/-/g, '') === placa;
    });
    return exists ? { duplicatePlaca: true } : null;
  }

  onSubmit(): void {
    this.submitted.set(true);

    const marca = this.selectedMarca();
    const vehicleType = this.selectedVehicleType();

    // Required trio lives outside the reactive form — short-circuit first
    if (!marca || !vehicleType || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const val = this.form.value;

    // Build engineType only when the user provided at least one engine field —
    // keeps the payload tight and the backend engineType sub-doc truly optional.
    const engineFields = {
      fuelType: val.fuelType || undefined,
      displacement: val.displacement || undefined,
      cylinders: val.cylinders ? Number(val.cylinders) : undefined,
      oilCapacityLiters: val.oilCapacityLiters ? Number(val.oilCapacityLiters) : undefined,
      oilType: val.oilType || undefined,
    };
    const hasEngineData = Object.values(engineFields).some((v) => v !== undefined);

    const payload: any = {
      marca: marca.id,
      modelo: val.modelo,
      vehicleType: vehicleType.id as VehicleCategory,
    };

    if (val.placa) payload.placa = val.placa.toUpperCase();
    if (val.year) payload.year = Number(val.year);
    if (val.kilometraje !== null && val.kilometraje !== '') {
      payload.kilometraje = Number(val.kilometraje) || 0;
    }
    if (hasEngineData) payload.engineType = engineFields;

    this.save.emit(payload);
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
        modelo: 'El modelo',
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
