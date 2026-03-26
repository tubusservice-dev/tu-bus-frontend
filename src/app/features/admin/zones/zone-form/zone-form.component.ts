import { Component, inject, signal, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ZoneService, Municipality, ReferenceCity, ReferenceMunicipality } from '../../../../core/services/zone.service';

interface StateItem {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

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

  // States
  protected readonly states = signal<StateItem[]>([]);
  protected readonly isLoadingStates = signal(false);

  // Reference cities from reference_cities collection (for selected state)
  protected readonly referenceCities = signal<ReferenceCity[]>([]);
  protected readonly isLoadingCities = signal(false);

  // Available municipalities from selected reference city
  protected readonly availableMunicipalities = signal<ReferenceMunicipality[]>([]);

  // Selected municipalities (chips)
  protected readonly selectedMunicipalities = signal<Municipality[]>([]);

  // Custom searchable select state
  protected readonly stateSearchTerm = signal('');
  protected readonly showStateDropdown = signal(false);
  protected readonly selectedStateName = signal('');

  protected readonly citySearchTerm = signal('');
  protected readonly showCityDropdown = signal(false);
  protected readonly selectedCityName = signal('');

  protected readonly municipalitySearchTerm = signal('');
  protected readonly showMunicipalityDropdown = signal(false);

  @ViewChild('municipalityInput') municipalityInput?: ElementRef<HTMLInputElement>;

  // Main form
  protected readonly form: FormGroup = this.fb.group({
    zoneName: ['', [Validators.required, Validators.minLength(2)]],
    stateCode: ['', [Validators.required]],
    cityCode: ['', [Validators.required]],
    isActive: [true],
  });

  ngOnInit(): void {
    this.loadStates();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.cityId.set(id);
      this.isEditMode.set(true);
      this.loadZone(id);
    }
  }

  private loadStates(): void {
    this.isLoadingStates.set(true);
    this.zoneService.getAllStates().subscribe({
      next: (response) => {
        this.states.set(response.data || []);
        this.isLoadingStates.set(false);
      },
      error: () => {
        this.isLoadingStates.set(false);
      },
    });
  }

  private loadZone(id: string): void {
    this.isLoading.set(true);
    this.zoneService.getById(id).subscribe({
      next: (city) => {
        this.form.patchValue({
          zoneName: city.zoneName || '',
          stateCode: city.stateCode || '',
          cityCode: city.code || '',
          isActive: city.isActive,
        });

        this.selectedStateName.set(city.stateName || '');
        this.selectedCityName.set(city.name || '');
        this.selectedMunicipalities.set(city.municipalities || []);

        // Load reference cities for this state so the city dropdown works
        if (city.stateCode) {
          this.loadCitiesForState(city.stateCode);
        }

        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al cargar zona');
        this.isLoading.set(false);
      },
    });
  }

  private loadCitiesForState(stateCode: string): void {
    this.isLoadingCities.set(true);
    this.zoneService.getReferenceCities(stateCode).subscribe({
      next: (response) => {
        this.referenceCities.set(response.data || []);
        this.isLoadingCities.set(false);

        // If city is already selected (edit mode), load its municipalities
        const cityCode = this.form.get('cityCode')?.value;
        if (cityCode) {
          const refCity = (response.data || []).find((c: ReferenceCity) => c.code === cityCode);
          if (refCity) {
            this.availableMunicipalities.set(refCity.municipalities || []);
          }
        }
      },
      error: () => {
        this.isLoadingCities.set(false);
      },
    });
  }

  // ==================== STATE SELECT ====================

  filteredStates(): StateItem[] {
    const term = this.stateSearchTerm().toLowerCase();
    return this.states().filter(s => !term || s.name.toLowerCase().includes(term));
  }

  onStateSearch(event: Event): void {
    this.stateSearchTerm.set((event.target as HTMLInputElement).value);
    this.showStateDropdown.set(true);
  }

  selectState(state: StateItem): void {
    this.form.patchValue({ stateCode: state.code, cityCode: '' });
    this.selectedStateName.set(state.name);
    this.selectedCityName.set('');
    this.stateSearchTerm.set('');
    this.showStateDropdown.set(false);
    this.referenceCities.set([]);
    this.availableMunicipalities.set([]);
    this.selectedMunicipalities.set([]);

    this.loadCitiesForState(state.code);
  }

  clearState(): void {
    this.form.patchValue({ stateCode: '', cityCode: '' });
    this.selectedStateName.set('');
    this.selectedCityName.set('');
    this.referenceCities.set([]);
    this.availableMunicipalities.set([]);
    this.selectedMunicipalities.set([]);
  }

  closeStateDropdown(): void {
    setTimeout(() => {
      this.showStateDropdown.set(false);
      this.stateSearchTerm.set('');
    }, 200);
  }

  // ==================== CITY SELECT ====================

  filteredCities(): ReferenceCity[] {
    const term = this.citySearchTerm().toLowerCase();
    return this.referenceCities().filter(c => !term || c.name.toLowerCase().includes(term));
  }

  onCitySearch(event: Event): void {
    this.citySearchTerm.set((event.target as HTMLInputElement).value);
    this.showCityDropdown.set(true);
  }

  selectCity(city: ReferenceCity): void {
    this.form.patchValue({ cityCode: city.code });
    this.selectedCityName.set(city.name);
    this.citySearchTerm.set('');
    this.showCityDropdown.set(false);
    this.availableMunicipalities.set(city.municipalities ?? []);
    this.selectedMunicipalities.set([]);
  }

  clearCity(): void {
    this.form.patchValue({ cityCode: '' });
    this.selectedCityName.set('');
    this.availableMunicipalities.set([]);
    this.selectedMunicipalities.set([]);
  }

  closeCityDropdown(): void {
    setTimeout(() => {
      this.showCityDropdown.set(false);
      this.citySearchTerm.set('');
    }, 200);
  }

  // ==================== MUNICIPALITY MULTI-SELECT ====================

  onMunicipalitySearch(event: Event): void {
    this.municipalitySearchTerm.set((event.target as HTMLInputElement).value);
    this.showMunicipalityDropdown.set(true);
  }

  closeMunicipalityDropdown(): void {
    setTimeout(() => {
      this.showMunicipalityDropdown.set(false);
      this.municipalitySearchTerm.set('');
      if (this.municipalityInput) {
        this.municipalityInput.nativeElement.value = '';
      }
    }, 200);
  }

  isMunicipalitySelected(code: string): boolean {
    return this.selectedMunicipalities().some(m => m.code === code);
  }

  filteredAvailableMunicipalities(): ReferenceMunicipality[] {
    const term = this.municipalitySearchTerm().toLowerCase();
    return this.availableMunicipalities().filter(
      m => !this.isMunicipalitySelected(m.code) && (!term || m.name.toLowerCase().includes(term))
    );
  }

  addMunicipality(municipality: ReferenceMunicipality): void {
    if (this.isMunicipalitySelected(municipality.code)) return;
    const zoneMunicipality: Municipality = {
      code: municipality.code,
      name: municipality.name,
      isActive: true,
    };
    this.selectedMunicipalities.update(list => [...list, zoneMunicipality]);
    this.municipalitySearchTerm.set('');
    // Clear native input value
    if (this.municipalityInput) {
      this.municipalityInput.nativeElement.value = '';
    }
    // Keep dropdown open for quick multi-select
  }

  removeMunicipality(code: string): void {
    this.selectedMunicipalities.update(list => list.filter(m => m.code !== code));
  }

  // ==================== SUBMIT ====================

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const formValue = this.form.getRawValue();
    const stateName = this.selectedStateName();
    const cityName = this.selectedCityName();

    const municipalities = this.selectedMunicipalities().map(m => ({
      code: m.code,
      name: m.name,
      isActive: m.isActive ?? true,
    }));

    if (this.isEditMode()) {
      const updateData = {
        zoneName: formValue.zoneName,
        name: cityName,
        stateCode: formValue.stateCode,
        stateName: stateName,
        isActive: formValue.isActive,
        municipalities,
      };

      this.zoneService.update(this.cityId()!, updateData).subscribe({
        next: () => {
          this.router.navigate(['/admin/zones']);
        },
        error: (error) => {
          this.errorMessage.set(error.error?.message || 'Error al guardar zona');
          this.isSubmitting.set(false);
        },
      });
    } else {
      const createData = {
        zoneName: formValue.zoneName,
        name: cityName,
        stateCode: formValue.stateCode,
        stateName: stateName,
        isActive: formValue.isActive,
        municipalities,
      };

      this.zoneService.create(createData).subscribe({
        next: () => {
          this.router.navigate(['/admin/zones']);
        },
        error: (error) => {
          this.errorMessage.set(error.error?.message || 'Error al guardar zona');
          this.isSubmitting.set(false);
        },
      });
    }
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
}
