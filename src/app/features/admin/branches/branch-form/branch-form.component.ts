import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { BranchService } from '../../../../core/services/branch.service';
import { ZoneService, City, Municipality } from '../../../../core/services/zone.service';
import { State, Branch, CreateBranchRequest, ServiceZone, ServiceMunicipality } from '../../../../models/branch.model';

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/**
 * Internal UI state for a single service zone in the form.
 */
interface ZoneFormState {
  stateCode: string;
  stateName: string;
  cityCode: string;
  cityName: string;
  selectedMunicipalities: ServiceMunicipality[];
  // UI state
  collapsed: boolean;
  showStateDropdown: boolean;
  showCityDropdown: boolean;
  showMunicipalityDropdown: boolean;
  stateSearchTerm: string;
  citySearchTerm: string;
  municipalitySearchTerm: string;
  availableCities: City[];
  availableMunicipalities: Municipality[];
}

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
  protected readonly allZoneCities = signal<City[]>([]);
  protected readonly existingBranches = signal<Branch[]>([]);
  protected readonly isLoadingStates = signal(false);

  // Service zones array
  protected readonly serviceZones = signal<ZoneFormState[]>([]);

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    address: ['', [Validators.required]],
    whatsappPhone: ['', [Validators.required]],
    landlinePhone: [''],
    coordinatesRaw: [''],
    isActive: [true],
    schedule: this.fb.array([]),
  });

  get scheduleArray(): FormArray {
    return this.form.get('schedule') as FormArray;
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

        // Load service zones - handle both new format and legacy flat format
        if (branch.serviceZones && branch.serviceZones.length > 0) {
          // New format: multiple service zones
          const zones: ZoneFormState[] = branch.serviceZones.map(sz => {
            const stateCities = this.allZoneCities().filter(c => c.stateCode === sz.stateCode);
            const selectedCity = stateCities.find(c => c.code === sz.cityCode);
            const availableMunis = selectedCity ? selectedCity.municipalities.filter(m => m.isActive) : [];

            return {
              stateCode: sz.stateCode,
              stateName: sz.stateName,
              cityCode: sz.cityCode,
              cityName: sz.cityName,
              selectedMunicipalities: sz.municipalities || [],
              collapsed: true,
              showStateDropdown: false,
              showCityDropdown: false,
              showMunicipalityDropdown: false,
              stateSearchTerm: '',
              citySearchTerm: '',
              municipalitySearchTerm: '',
              availableCities: stateCities,
              availableMunicipalities: availableMunis,
            };
          });
          this.serviceZones.set(zones);
        } else if (branch.stateCode && branch.cityCode) {
          // Legacy flat format: single zone
          const stateCities = this.allZoneCities().filter(c => c.stateCode === branch.stateCode);
          const selectedCity = stateCities.find(c => c.code === branch.cityCode);
          const availableMunis = selectedCity ? selectedCity.municipalities.filter(m => m.isActive) : [];

          const legacyZone: ZoneFormState = {
            stateCode: branch.stateCode,
            stateName: branch.stateName || '',
            cityCode: branch.cityCode,
            cityName: branch.cityName || '',
            selectedMunicipalities: branch.serviceMunicipalities || [],
            collapsed: false,
            showStateDropdown: false,
            showCityDropdown: false,
            showMunicipalityDropdown: false,
            stateSearchTerm: '',
            citySearchTerm: '',
            municipalitySearchTerm: '',
            availableCities: stateCities,
            availableMunicipalities: availableMunis,
          };
          this.serviceZones.set([legacyZone]);
        }

        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al cargar sucursal');
        this.isLoading.set(false);
      },
    });
  }

  // ==================== ZONE MANAGEMENT ====================

  addZone(): void {
    const newZone: ZoneFormState = {
      stateCode: '',
      stateName: '',
      cityCode: '',
      cityName: '',
      selectedMunicipalities: [],
      collapsed: false,
      showStateDropdown: false,
      showCityDropdown: false,
      showMunicipalityDropdown: false,
      stateSearchTerm: '',
      citySearchTerm: '',
      municipalitySearchTerm: '',
      availableCities: [],
      availableMunicipalities: [],
    };
    this.serviceZones.update(zones => [...zones, newZone]);
  }

  removeZone(index: number): void {
    this.serviceZones.update(zones => zones.filter((_, i) => i !== index));
  }

  toggleZoneCollapse(index: number): void {
    this.serviceZones.update(zones => zones.map((z, i) =>
      i === index ? { ...z, collapsed: !z.collapsed } : z
    ));
  }

  getZoneTitle(zone: ZoneFormState, index: number): string {
    if (zone.stateName && zone.cityName) {
      return `Zona ${index + 1}: ${zone.stateName} - ${zone.cityName}`;
    }
    return `Zona ${index + 1}: Sin configurar`;
  }

  // ==================== STATE SELECTION PER ZONE ====================

  filteredStatesForZone(zone: ZoneFormState): State[] {
    const term = zone.stateSearchTerm.toLowerCase();
    return this.states().filter(s => !term || s.name.toLowerCase().includes(term));
  }

  onZoneStateSearch(event: Event, index: number): void {
    const value = (event.target as HTMLInputElement).value;
    this.serviceZones.update(zones => zones.map((z, i) =>
      i === index ? { ...z, stateSearchTerm: value, showStateDropdown: true } : z
    ));
  }

  openZoneStateDropdown(index: number): void {
    this.serviceZones.update(zones => zones.map((z, i) =>
      i === index ? { ...z, showStateDropdown: true } : z
    ));
  }

  closeZoneStateDropdown(index: number): void {
    this.serviceZones.update(zones => zones.map((z, i) =>
      i === index ? { ...z, showStateDropdown: false } : z
    ));
  }

  selectZoneState(state: State, index: number): void {
    const stateCities = this.allZoneCities()
      .filter(c => c.stateCode === state.code);
    this.serviceZones.update(zones => zones.map((z, i) =>
      i === index ? {
        ...z,
        stateCode: state.code,
        stateName: state.name,
        cityCode: '',
        cityName: '',
        selectedMunicipalities: [],
        stateSearchTerm: '',
        showStateDropdown: false,
        availableCities: stateCities,
        availableMunicipalities: [],
      } : z
    ));
  }

  clearZoneState(index: number): void {
    this.serviceZones.update(zones => zones.map((z, i) =>
      i === index ? {
        ...z,
        stateCode: '',
        stateName: '',
        cityCode: '',
        cityName: '',
        selectedMunicipalities: [],
        availableCities: [],
        availableMunicipalities: [],
      } : z
    ));
  }

  // ==================== CITY SELECTION PER ZONE ====================

  filteredCitiesForZone(zone: ZoneFormState): City[] {
    const term = zone.citySearchTerm.toLowerCase();
    return zone.availableCities.filter(c => !term || c.name.toLowerCase().includes(term));
  }

  onZoneCitySearch(event: Event, index: number): void {
    const value = (event.target as HTMLInputElement).value;
    this.serviceZones.update(zones => zones.map((z, i) =>
      i === index ? { ...z, citySearchTerm: value, showCityDropdown: true } : z
    ));
  }

  openZoneCityDropdown(index: number): void {
    this.serviceZones.update(zones => zones.map((z, i) =>
      i === index ? { ...z, showCityDropdown: true } : z
    ));
  }

  closeZoneCityDropdown(index: number): void {
    this.serviceZones.update(zones => zones.map((z, i) =>
      i === index ? { ...z, showCityDropdown: false } : z
    ));
  }

  selectZoneCity(city: City, index: number): void {
    const taken = this.getTakenMunicipalityCodes(city.code);
    const available = (city.municipalities || []).filter(m => m.isActive && !taken.has(m.code));
    this.serviceZones.update(zones => zones.map((z, i) =>
      i === index ? {
        ...z,
        cityCode: city.code,
        cityName: city.name,
        citySearchTerm: '',
        showCityDropdown: false,
        selectedMunicipalities: [],
        availableMunicipalities: available,
      } : z
    ));
  }

  clearZoneCity(index: number): void {
    this.serviceZones.update(zones => zones.map((z, i) =>
      i === index ? {
        ...z,
        cityCode: '',
        cityName: '',
        selectedMunicipalities: [],
        availableMunicipalities: [],
      } : z
    ));
  }

  // ==================== MUNICIPALITY SELECTION PER ZONE ====================

  availableMunicipalitiesForZone(zone: ZoneFormState): Municipality[] {
    const term = zone.municipalitySearchTerm.toLowerCase();
    const selectedCodes = new Set(zone.selectedMunicipalities.map(m => m.municipalityCode));
    return zone.availableMunicipalities.filter(m =>
      !selectedCodes.has(m.code) &&
      (!term || m.name.toLowerCase().includes(term))
    );
  }

  onZoneMunicipalitySearch(event: Event, index: number): void {
    const value = (event.target as HTMLInputElement).value;
    this.serviceZones.update(zones => zones.map((z, i) =>
      i === index ? { ...z, municipalitySearchTerm: value, showMunicipalityDropdown: true } : z
    ));
  }

  openZoneMunicipalityDropdown(index: number): void {
    this.serviceZones.update(zones => zones.map((z, i) =>
      i === index ? { ...z, showMunicipalityDropdown: true } : z
    ));
  }

  closeZoneMunicipalityDropdown(index: number): void {
    this.serviceZones.update(zones => zones.map((z, i) =>
      i === index ? { ...z, showMunicipalityDropdown: false } : z
    ));
  }

  addZoneMunicipality(municipality: Municipality, index: number): void {
    this.serviceZones.update(zones => zones.map((z, i) => {
      if (i !== index) return z;
      if (z.selectedMunicipalities.some(m => m.municipalityCode === municipality.code)) return z;
      const newMuni: ServiceMunicipality = {
        municipalityCode: municipality.code,
        municipalityName: municipality.name,
        hasDelivery: false,
        freeDelivery: true,
        deliveryCharge: 0,
        hasOilChangeService: false,
      };
      return {
        ...z,
        selectedMunicipalities: [...z.selectedMunicipalities, newMuni],
        municipalitySearchTerm: '',
        // Keep dropdown open for quick multi-select
      };
    }));
  }

  removeZoneMunicipality(muniCode: string, zoneIndex: number): void {
    this.serviceZones.update(zones => zones.map((z, i) => {
      if (i !== zoneIndex) return z;
      return {
        ...z,
        selectedMunicipalities: z.selectedMunicipalities.filter(m => m.municipalityCode !== muniCode),
      };
    }));
  }

  // ==================== MUNICIPALITY CONFIG ====================

  toggleMuniDelivery(zoneIndex: number, muniCode: string): void {
    this.serviceZones.update(zones => zones.map((z, i) => {
      if (i !== zoneIndex) return z;
      return {
        ...z,
        selectedMunicipalities: z.selectedMunicipalities.map(m =>
          m.municipalityCode === muniCode ? { ...m, hasDelivery: !m.hasDelivery } : m
        ),
      };
    }));
  }

  toggleMuniFreeDelivery(zoneIndex: number, muniCode: string): void {
    this.serviceZones.update(zones => zones.map((z, i) => {
      if (i !== zoneIndex) return z;
      return {
        ...z,
        selectedMunicipalities: z.selectedMunicipalities.map(m =>
          m.municipalityCode === muniCode ? { ...m, freeDelivery: !m.freeDelivery } : m
        ),
      };
    }));
  }

  toggleMuniOilChange(zoneIndex: number, muniCode: string): void {
    this.serviceZones.update(zones => zones.map((z, i) => {
      if (i !== zoneIndex) return z;
      return {
        ...z,
        selectedMunicipalities: z.selectedMunicipalities.map(m =>
          m.municipalityCode === muniCode ? { ...m, hasOilChangeService: !m.hasOilChangeService } : m
        ),
      };
    }));
  }

  updateMuniDeliveryCharge(zoneIndex: number, muniCode: string, event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value) || 0;
    this.serviceZones.update(zones => zones.map((z, i) => {
      if (i !== zoneIndex) return z;
      return {
        ...z,
        selectedMunicipalities: z.selectedMunicipalities.map(m =>
          m.municipalityCode === muniCode ? { ...m, deliveryCharge: value } : m
        ),
      };
    }));
  }

  // ==================== HELPER: Taken municipalities ====================

  private getTakenMunicipalityCodes(cityCode: string): Set<string> {
    const currentBranchId = this.branchId();
    const taken = new Set<string>();
    for (const branch of this.existingBranches()) {
      if (currentBranchId && branch.id === currentBranchId) continue;
      // Check new serviceZones
      if (branch.serviceZones) {
        for (const sz of branch.serviceZones) {
          if (sz.cityCode === cityCode) {
            for (const m of sz.municipalities) {
              taken.add(m.municipalityCode);
            }
          }
        }
      }
      // Check legacy flat fields
      if (branch.cityCode === cityCode && branch.serviceMunicipalities) {
        for (const sm of branch.serviceMunicipalities) {
          taken.add(sm.municipalityCode);
        }
      }
    }
    return taken;
  }

  // ==================== SUBMIT ====================

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    // Validate at least one zone with state + city
    const zones = this.serviceZones();
    if (zones.length === 0) {
      this.errorMessage.set('Debe agregar al menos una zona de servicio');
      return;
    }
    for (const zone of zones) {
      if (!zone.stateCode || !zone.cityCode) {
        this.errorMessage.set('Todas las zonas deben tener estado y ciudad seleccionados');
        return;
      }
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const formValue = this.form.getRawValue();

    const serviceZones: ServiceZone[] = zones.map(z => ({
      stateCode: z.stateCode,
      stateName: z.stateName,
      cityCode: z.cityCode,
      cityName: z.cityName,
      municipalities: z.selectedMunicipalities,
    }));

    const data: CreateBranchRequest = {
      name: formValue.name,
      description: formValue.description || undefined,
      address: formValue.address,
      whatsappPhone: formValue.whatsappPhone,
      landlinePhone: formValue.landlinePhone || undefined,
      schedule: formValue.schedule,
      serviceZones,
      coordinates: this.parseCoordinates(formValue.coordinatesRaw),
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
