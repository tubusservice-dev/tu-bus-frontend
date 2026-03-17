import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ZoneService, City, Municipality } from '../../../../core/services/zone.service';

@Component({
  selector: 'app-zone-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './zone-form.component.html',
  styleUrl: './zone-form.component.scss',
})
export class ZoneFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly zoneService = inject(ZoneService);

  protected readonly cityId = signal<string | null>(null);
  protected readonly isEditMode = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  // Datos de la ciudad
  protected readonly currentCity = signal<City | null>(null);

  // Municipios
  protected readonly municipalities = signal<Municipality[]>([]);
  protected readonly showMunicipalityForm = signal(false);
  protected readonly editingMunicipality = signal<Municipality | null>(null);
  protected readonly isSavingMunicipality = signal(false);

  // Modal de eliminacion de municipio
  protected readonly deleteMunicipalityModalOpen = signal(false);
  protected readonly municipalityToDelete = signal<Municipality | null>(null);
  protected readonly isDeletingMunicipality = signal(false);

  // Formulario principal
  protected readonly form: FormGroup = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(5)]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    isActive: [true],
  });

  // Formulario de municipio
  protected readonly municipalityForm: FormGroup = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(5)]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    isActive: [true],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.cityId.set(id);
      this.isEditMode.set(true);
      this.loadCity(id);
    }
  }

  private loadCity(id: string): void {
    this.isLoading.set(true);
    this.zoneService.getById(id).subscribe({
      next: (city) => {
        this.currentCity.set(city);
        this.form.patchValue({
          code: city.code,
          name: city.name,
          isActive: city.isActive,
        });
        this.municipalities.set(city.municipalities || []);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al cargar zona');
        this.isLoading.set(false);
      },
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const data = {
      code: this.form.value.code.toUpperCase(),
      name: this.form.value.name,
      isActive: this.form.value.isActive,
    };

    const request$ = this.isEditMode()
      ? this.zoneService.update(this.cityId()!, data)
      : this.zoneService.create(data);

    request$.subscribe({
      next: (city) => {
        if (!this.isEditMode()) {
          // Si es creacion, redirigir a edicion para poder agregar municipios
          this.router.navigate(['/admin/zones/edit', city.id]);
        } else {
          this.successMessage.set('Zona actualizada correctamente');
          this.currentCity.set(city);
          setTimeout(() => this.successMessage.set(null), 3000);
        }
        this.isSubmitting.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al guardar zona');
        this.isSubmitting.set(false);
      },
    });
  }

  // ==================== MUNICIPIOS ====================

  openMunicipalityForm(): void {
    this.showMunicipalityForm.set(true);
    this.editingMunicipality.set(null);
    this.municipalityForm.reset({ isActive: true });
  }

  editMunicipality(municipality: Municipality): void {
    this.showMunicipalityForm.set(true);
    this.editingMunicipality.set(municipality);
    this.municipalityForm.patchValue({
      code: municipality.code,
      name: municipality.name,
      isActive: municipality.isActive,
    });
  }

  cancelMunicipalityForm(): void {
    this.showMunicipalityForm.set(false);
    this.editingMunicipality.set(null);
    this.municipalityForm.reset({ isActive: true });
  }

  saveMunicipality(): void {
    if (this.municipalityForm.invalid) {
      this.municipalityForm.markAllAsTouched();
      return;
    }

    const cityId = this.cityId();
    if (!cityId) return;

    this.isSavingMunicipality.set(true);
    this.errorMessage.set(null);

    const data = {
      code: this.municipalityForm.value.code.toUpperCase(),
      name: this.municipalityForm.value.name,
      isActive: this.municipalityForm.value.isActive,
    };

    const editing = this.editingMunicipality();
    const request$ = editing
      ? this.zoneService.updateMunicipality(cityId, editing.code, data)
      : this.zoneService.addMunicipality(cityId, data);

    request$.subscribe({
      next: (city) => {
        this.municipalities.set(city.municipalities || []);
        this.currentCity.set(city);
        this.cancelMunicipalityForm();
        this.isSavingMunicipality.set(false);
        this.successMessage.set(editing ? 'Municipio actualizado' : 'Municipio agregado');
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al guardar municipio');
        this.isSavingMunicipality.set(false);
      },
    });
  }

  toggleMunicipalityStatus(municipality: Municipality): void {
    const cityId = this.cityId();
    if (!cityId) return;

    this.zoneService.updateMunicipality(cityId, municipality.code, {
      isActive: !municipality.isActive,
    }).subscribe({
      next: (city) => {
        this.municipalities.set(city.municipalities || []);
        this.currentCity.set(city);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al actualizar estado');
      },
    });
  }

  openDeleteMunicipalityModal(municipality: Municipality): void {
    this.municipalityToDelete.set(municipality);
    this.deleteMunicipalityModalOpen.set(true);
  }

  closeDeleteMunicipalityModal(): void {
    this.deleteMunicipalityModalOpen.set(false);
    this.municipalityToDelete.set(null);
  }

  confirmDeleteMunicipality(): void {
    const cityId = this.cityId();
    const municipality = this.municipalityToDelete();
    if (!cityId || !municipality) return;

    this.isDeletingMunicipality.set(true);

    this.zoneService.removeMunicipality(cityId, municipality.code).subscribe({
      next: (city) => {
        this.municipalities.set(city.municipalities || []);
        this.currentCity.set(city);
        this.closeDeleteMunicipalityModal();
        this.isDeletingMunicipality.set(false);
        this.successMessage.set('Municipio eliminado');
        setTimeout(() => this.successMessage.set(null), 3000);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al eliminar municipio');
        this.isDeletingMunicipality.set(false);
      },
    });
  }

  // ==================== HELPERS ====================

  hasError(field: string, error: string): boolean {
    const control = this.form.get(field);
    return !!(control?.hasError(error) && control?.touched);
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!(control?.invalid && control?.touched);
  }

  hasMunicipalityError(field: string, error: string): boolean {
    const control = this.municipalityForm.get(field);
    return !!(control?.hasError(error) && control?.touched);
  }

  isMunicipalityInvalid(field: string): boolean {
    const control = this.municipalityForm.get(field);
    return !!(control?.invalid && control?.touched);
  }
}
