import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { BranchService } from '../../../../core/services/branch.service';
import { ZoneService, City, Municipality } from '../../../../core/services/zone.service';
import { State, Branch, CreateBranchRequest } from '../../../../models/branch.model';

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

@Component({
  selector: 'app-branch-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './branch-form.component.html',
  styleUrl: './branch-form.component.scss',
})
export class BranchFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly branchService = inject(BranchService);
  private readonly zoneService = inject(ZoneService);

  protected readonly branchId = signal<string | null>(null);
  protected readonly isEditMode = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly states = signal<State[]>([]);
  protected readonly cities = signal<City[]>([]);
  protected readonly allZoneCities = signal<City[]>([]);
  protected readonly existingBranches = signal<Branch[]>([]);
  protected readonly municipalities = signal<Municipality[]>([]);
  protected readonly isLoadingStates = signal(false);
  protected readonly isLoadingCities = signal(false);
  protected readonly municipalitySearchTerm = signal('');
  protected readonly showMunicipalityDropdown = signal(false);
  protected readonly stateSearchTerm = signal('');
  protected readonly showStateDropdown = signal(false);
  protected readonly citySearchTerm = signal('');
  protected readonly showCityDropdown = signal(false);
  protected readonly selectedStateName = signal('');
  protected readonly selectedCityName = signal('');

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    address: ['', [Validators.required]],
    whatsappPhone: ['', [Validators.required]],
    landlinePhone: [''],
    coordinatesRaw: [''],
    stateCode: ['', [Validators.required]],
    stateName: [''],
    cityCode: ['', [Validators.required]],
    cityName: [''],
    isActive: [true],
    schedule: this.fb.array([]),
    serviceMunicipalities: this.fb.array([]),
  });

  get scheduleArray(): FormArray {
    return this.form.get('schedule') as FormArray;
  }

  get municipalitiesArray(): FormArray {
    return this.form.get('serviceMunicipalities') as FormArray;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.branchId.set(id);
      this.isEditMode.set(true);
    }
    this.initSchedule();
    this.loadStates();
  }

  private initSchedule(): void {
    DAY_NAMES.forEach((name, i) => {
      this.scheduleArray.push(this.fb.group({
        day: [i],
        dayName: [name],
        openTime: ['08:00'],
        closeTime: ['18:00'],
        isClosed: [i >= 5],
      }));
    });
  }

  private loadStates(): void {
    this.isLoadingStates.set(true);

    // Load existing branches to know which municipalities are taken
    this.branchService.getAll().subscribe({
      next: (res) => this.existingBranches.set(res.data || []),
      error: () => this.existingBranches.set([]),
    });

    // Get states from registered zones only
    this.zoneService.getAllAdmin().subscribe({
      next: (cities) => {
        this.allZoneCities.set(cities);
        const stateMap = new Map<string, State>();
        for (const city of cities) {
          if (city.stateCode && city.stateName) {
            stateMap.set(city.stateCode, { id: city.stateCode, code: city.stateCode, name: city.stateName, isActive: true });
          }
        }
        this.states.set(Array.from(stateMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
        this.isLoadingStates.set(false);
        if (this.isEditMode()) {
          this.loadBranch();
        }
      },
      error: () => {
        this.isLoadingStates.set(false);
        if (this.isEditMode()) {
          this.loadBranch();
        }
      },
    });
  }

  private loadBranch(): void {
    const id = this.branchId();
    if (!id) return;

    this.isLoading.set(true);
    this.branchService.getById(id).subscribe({
      next: (response) => {
        const branch = response.data;

        // Patch basic fields
        this.form.patchValue({
          name: branch.name,
          description: branch.description || '',
          address: branch.address,
          whatsappPhone: branch.whatsappPhone,
          landlinePhone: branch.landlinePhone || '',
          coordinatesRaw: branch.coordinates ? `${branch.coordinates.latitude}, ${branch.coordinates.longitude}` : '',
          stateCode: branch.stateCode,
          stateName: branch.stateName,
          cityCode: branch.cityCode,
          cityName: branch.cityName,
          isActive: branch.isActive,
        });

        // Load schedule
        if (branch.schedule && branch.schedule.length > 0) {
          this.scheduleArray.clear();
          branch.schedule.forEach(day => {
            this.scheduleArray.push(this.fb.group({
              day: [day.day],
              dayName: [day.dayName],
              openTime: [day.openTime],
              closeTime: [day.closeTime],
              isClosed: [day.isClosed],
            }));
          });
        }

        this.selectedStateName.set(branch.stateName || '');
        this.selectedCityName.set(branch.cityName || '');

        // Load cities for selected state, then restore municipalities
        if (branch.stateCode) {
          this.zoneService.getCitiesByState(branch.stateCode).subscribe({
            next: (citiesResponse) => {
              this.cities.set(citiesResponse.data);
              const selectedCity = citiesResponse.data.find(c => c.code === branch.cityCode);
              if (selectedCity) {
                this.municipalities.set(selectedCity.municipalities);
              }

              // Restore service municipalities
              if (branch.serviceMunicipalities) {
                this.municipalitiesArray.clear();
                branch.serviceMunicipalities.forEach(sm => {
                  this.municipalitiesArray.push(this.fb.group({
                    municipalityCode: [sm.municipalityCode],
                    municipalityName: [sm.municipalityName],
                    hasDelivery: [sm.hasDelivery],
                    freeDelivery: [sm.freeDelivery],
                    deliveryCharge: [sm.deliveryCharge],
                    hasOilChangeService: [sm.hasOilChangeService],
                  }));
                });
              }
              this.isLoading.set(false);
            },
            error: () => {
              this.isLoading.set(false);
            },
          });
        } else {
          this.isLoading.set(false);
        }
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al cargar sucursal');
        this.isLoading.set(false);
      },
    });
  }

  filteredStates(): State[] {
    const term = this.stateSearchTerm().toLowerCase();
    return this.states().filter(s => !term || s.name.toLowerCase().includes(term));
  }

  filteredCities(): City[] {
    const term = this.citySearchTerm().toLowerCase();
    return this.cities().filter(c => !term || c.name.toLowerCase().includes(term));
  }

  onStateSearch(event: Event): void {
    this.stateSearchTerm.set((event.target as HTMLInputElement).value);
    this.showStateDropdown.set(true);
  }

  onCitySearch(event: Event): void {
    this.citySearchTerm.set((event.target as HTMLInputElement).value);
    this.showCityDropdown.set(true);
  }

  /**
   * Get municipality codes already taken by other branches (excluding current branch in edit mode)
   */
  private getTakenMunicipalityCodes(cityCode: string): Set<string> {
    const currentBranchId = this.branchId();
    const taken = new Set<string>();
    for (const branch of this.existingBranches()) {
      if (currentBranchId && branch.id === currentBranchId) continue;
      if (branch.cityCode === cityCode) {
        for (const sm of branch.serviceMunicipalities) {
          taken.add(sm.municipalityCode);
        }
      }
    }
    return taken;
  }

  /**
   * Check if a city has available municipalities (not all taken by other branches)
   */
  private cityHasAvailableMunicipalities(city: City): boolean {
    const taken = this.getTakenMunicipalityCodes(city.code);
    return city.municipalities.some(m => m.isActive && !taken.has(m.code));
  }

  selectState(state: State): void {
    this.form.patchValue({ stateCode: state.code, stateName: state.name, cityCode: '', cityName: '' });
    this.selectedStateName.set(state.name);
    this.selectedCityName.set('');
    this.stateSearchTerm.set('');
    this.showStateDropdown.set(false);
    this.cities.set([]);
    this.municipalities.set([]);
    this.municipalitiesArray.clear();

    // Filter cities from allZoneCities that belong to this state and have available municipalities
    const stateCities = this.allZoneCities()
      .filter(c => c.stateCode === state.code && this.cityHasAvailableMunicipalities(c));
    this.cities.set(stateCities);
    this.isLoadingCities.set(false);
  }



  clearState(): void {
    this.form.patchValue({ stateCode: '', stateName: '', cityCode: '', cityName: '' });
    this.selectedStateName.set('');
    this.selectedCityName.set('');
    this.cities.set([]);
    this.municipalities.set([]);
    this.municipalitiesArray.clear();
  }

  selectCity(city: City): void {
    this.form.patchValue({ cityCode: city.code, cityName: city.name });
    this.selectedCityName.set(city.name);
    this.citySearchTerm.set('');
    this.showCityDropdown.set(false);
    // Only show municipalities that are active and not taken by other branches
    const taken = this.getTakenMunicipalityCodes(city.code);
    const available = (city.municipalities || []).filter(m => m.isActive && !taken.has(m.code));
    this.municipalities.set(available);
    this.municipalitiesArray.clear();
  }

  clearCity(): void {
    this.form.patchValue({ cityCode: '', cityName: '' });
    this.selectedCityName.set('');
    this.municipalities.set([]);
    this.municipalitiesArray.clear();
  }

  closeStateDropdown(): void {
    setTimeout(() => this.showStateDropdown.set(false), 150);
  }

  closeCityDropdown(): void {
    setTimeout(() => this.showCityDropdown.set(false), 150);
  }

  closeMunicipalityDropdown(): void {
    setTimeout(() => this.showMunicipalityDropdown.set(false), 150);
  }

  isMunicipalitySelected(code: string): boolean {
    return this.municipalitiesArray.controls.some(c => c.get('municipalityCode')?.value === code);
  }

  availableMunicipalities(): Municipality[] {
    const term = this.municipalitySearchTerm().toLowerCase();
    return this.municipalities().filter(m =>
      !this.isMunicipalitySelected(m.code) &&
      (!term || m.name.toLowerCase().includes(term))
    );
  }

  onMunicipalitySearch(event: Event): void {
    this.municipalitySearchTerm.set((event.target as HTMLInputElement).value);
    this.showMunicipalityDropdown.set(true);
  }

  addMunicipality(municipality: Municipality): void {
    if (this.isMunicipalitySelected(municipality.code)) return;
    this.municipalitiesArray.push(this.fb.group({
      municipalityCode: [municipality.code],
      municipalityName: [municipality.name],
      hasDelivery: [false],
      freeDelivery: [true],
      deliveryCharge: [0],
      hasOilChangeService: [false],
    }));
    this.municipalitySearchTerm.set('');
    this.showMunicipalityDropdown.set(false);
  }

  removeMunicipalityByCode(code: string): void {
    const index = this.municipalitiesArray.controls.findIndex(
      c => c.get('municipalityCode')?.value === code
    );
    if (index >= 0) this.municipalitiesArray.removeAt(index);
  }

  getMunicipalityFormGroup(code: string): FormGroup | null {
    return this.municipalitiesArray.controls.find(
      c => c.get('municipalityCode')?.value === code
    ) as FormGroup || null;
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const formValue = this.form.getRawValue();
    const data: CreateBranchRequest = {
      name: formValue.name,
      description: formValue.description || undefined,
      address: formValue.address,
      whatsappPhone: formValue.whatsappPhone,
      landlinePhone: formValue.landlinePhone || undefined,
      schedule: formValue.schedule,
      stateCode: formValue.stateCode,
      stateName: formValue.stateName,
      cityCode: formValue.cityCode,
      cityName: formValue.cityName,
      coordinates: this.parseCoordinates(formValue.coordinatesRaw),
      serviceMunicipalities: formValue.serviceMunicipalities,
      isActive: formValue.isActive,
    };

    const request$ = this.isEditMode()
      ? this.branchService.update(this.branchId()!, data)
      : this.branchService.create(data);

    request$.subscribe({
      next: () => {
        this.router.navigate(['/admin/branches']);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al guardar sucursal');
        this.isSubmitting.set(false);
      },
    });
  }

  private parseCoordinates(raw: string): { latitude: number; longitude: number } | undefined {
    if (!raw || !raw.trim()) return undefined;
    const parts = raw.split(',').map(p => p.trim());
    if (parts.length !== 2) return undefined;
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (isNaN(lat) || isNaN(lng)) return undefined;
    return { latitude: lat, longitude: lng };
  }

  hasError(field: string, error: string): boolean {
    const control = this.form.get(field);
    return !!(control?.hasError(error) && control?.touched);
  }

  isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!(control?.invalid && control?.touched);
  }
}
