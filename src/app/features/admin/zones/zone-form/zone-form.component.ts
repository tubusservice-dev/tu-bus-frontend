import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { City, Municipality } from '../../../../models/city.model';
import { Zone, CreateZoneRequest, UpdateZoneRequest } from '../../../../models/zone.model';
import { CityService } from '../../../../core/services/city.service';
import { ZoneService } from '../../../../core/services/zone.service';
import { ToastService } from '../../../../shared/services/toast.service';

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
  private readonly cityService = inject(CityService);
  private readonly zoneService = inject(ZoneService);
  private readonly toastService = inject(ToastService);

  // Core state
  protected readonly zoneId = signal<string | null>(null);
  protected readonly isEditMode = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  // Cities loaded from CityService
  protected readonly cities = signal<City[]>([]);
  protected readonly isLoadingCities = signal(false);

  // Selected city and municipalities
  protected readonly selectedCity = signal<City | null>(null);
  protected readonly selectedMunicipalities = signal<string[]>([]);

  // Name uniqueness check
  protected readonly nameExists = signal(false);
  private readonly nameCheck$ = new Subject<string>();

  // City searchable dropdown state
  protected readonly citySearchTerm = signal('');
  protected readonly showCityDropdown = signal(false);

  // Main form — only name and isActive
  protected readonly form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    isActive: [true],
  });

  ngOnInit(): void {
    this.loadCities();
    this.setupNameCheck();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.zoneId.set(id);
      this.isEditMode.set(true);
      this.loadZone(id);
    }
  }

  // ==================== DATA LOADING ====================

  private loadCities(): void {
    this.isLoadingCities.set(true);
    this.cityService.getAll().subscribe({
      next: (response) => {
        this.cities.set(response.data || []);
        this.isLoadingCities.set(false);
      },
      error: () => {
        this.isLoadingCities.set(false);
      },
    });
  }

  private loadZone(id: string): void {
    this.isLoading.set(true);
    this.zoneService.getById(id).subscribe({
      next: (response) => {
        const zone = response.data;
        this.form.patchValue({
          name: zone.name || '',
          isActive: zone.isActive,
        });

        // If city is populated as object, set selectedCity
        if (zone.city && typeof zone.city === 'object') {
          this.selectedCity.set(zone.city as City);
        }

        this.selectedMunicipalities.set(zone.municipalities || []);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al cargar zona');
        this.isLoading.set(false);
      },
    });
  }

  // ==================== NAME UNIQUENESS ====================

  private setupNameCheck(): void {
    this.nameCheck$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((name) => this.zoneService.checkName(name))
      )
      .subscribe({
        next: (response) => {
          this.nameExists.set(response.data.exists);
        },
        error: () => {
          this.nameExists.set(false);
        },
      });
  }

  onNameBlur(): void {
    const name = this.form.get('name')?.value?.trim();
    if (name && name.length >= 2) {
      this.nameCheck$.next(name);
    }
  }

  // ==================== CITY SELECT ====================

  filteredCities(): City[] {
    const term = this.citySearchTerm().toLowerCase();
    return this.cities().filter((c) => !term || c.name.toLowerCase().includes(term));
  }

  onCitySearch(event: Event): void {
    this.citySearchTerm.set((event.target as HTMLInputElement).value);
    this.showCityDropdown.set(true);
  }

  selectCity(city: City): void {
    this.selectedCity.set(city);
    this.citySearchTerm.set('');
    this.showCityDropdown.set(false);
    this.selectedMunicipalities.set([]);
  }

  clearCity(): void {
    this.selectedCity.set(null);
    this.selectedMunicipalities.set([]);
  }

  closeCityDropdown(): void {
    setTimeout(() => {
      this.showCityDropdown.set(false);
      this.citySearchTerm.set('');
    }, 200);
  }

  // ==================== MUNICIPALITY CHECKBOXES ====================

  isMunicipalitySelected(slug: string): boolean {
    return this.selectedMunicipalities().includes(slug);
  }

  toggleMunicipality(slug: string): void {
    if (this.isMunicipalitySelected(slug)) {
      this.selectedMunicipalities.update((list) => list.filter((s) => s !== slug));
    } else {
      this.selectedMunicipalities.update((list) => [...list, slug]);
    }
  }

  toggleAll(): void {
    const city = this.selectedCity();
    if (!city) return;

    const allSlugs = city.municipalities.map((m) => m.slug);
    const allSelected = allSlugs.length === this.selectedMunicipalities().length;

    if (allSelected) {
      this.selectedMunicipalities.set([]);
    } else {
      this.selectedMunicipalities.set([...allSlugs]);
    }
  }

  get allMunicipalitiesSelected(): boolean {
    const city = this.selectedCity();
    if (!city || city.municipalities.length === 0) return false;
    return city.municipalities.length === this.selectedMunicipalities().length;
  }

  // ==================== SUBMIT ====================

  onSubmit(): void {
    if (this.form.invalid || !this.selectedCity()) {
      this.form.markAllAsTouched();
      if (!this.selectedCity()) {
        this.errorMessage.set('Debes seleccionar una ciudad');
      }
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const formValue = this.form.getRawValue();
    const city = this.selectedCity()!;

    if (this.isEditMode()) {
      const updateData: UpdateZoneRequest = {
        name: formValue.name,
        city: city.id,
        municipalities: this.selectedMunicipalities(),
        isActive: formValue.isActive,
      };

      this.zoneService.update(this.zoneId()!, updateData).subscribe({
        next: () => {
          this.toastService.success('Zona actualizada exitosamente');
          this.router.navigate(['/admin/zones']);
        },
        error: (error) => {
          const msg = error.error?.message || 'Error al guardar zona';
          this.errorMessage.set(msg);
          this.toastService.error(msg);
          this.isSubmitting.set(false);
        },
      });
    } else {
      const createData: CreateZoneRequest = {
        name: formValue.name,
        city: city.id,
        municipalities: this.selectedMunicipalities(),
        isActive: formValue.isActive,
      };

      this.zoneService.create(createData).subscribe({
        next: () => {
          this.toastService.success('Zona creada exitosamente');
          this.router.navigate(['/admin/zones']);
        },
        error: (error) => {
          const msg = error.error?.message || 'Error al guardar zona';
          this.errorMessage.set(msg);
          this.toastService.error(msg);
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
