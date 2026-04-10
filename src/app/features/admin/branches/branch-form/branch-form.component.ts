import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { forkJoin, Observable } from 'rxjs';
import { BranchService } from '../../../../core/services/branch.service';
import { ZoneService } from '../../../../core/services/zone.service';
import { BranchZoneService } from '../../../../core/services/branch-zone.service';
import { CreateBranchRequest } from '../../../../models/branch.model';
import { Zone } from '../../../../models/zone.model';
import { BranchZone, DeliveryConfigItem } from '../../../../models/branch-zone.model';
import { City } from '../../../../models/city.model';
import {
  PHONE_VE_PATTERN, LANDLINE_VE_PATTERN, COORDINATES_PATTERN,
  MAX_BRANCH_NAME_LENGTH, MAX_DESCRIPTION_LENGTH, MAX_ADDRESS_LENGTH,
} from '../../../../shared/validators/form-validators';

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
  private readonly branchZoneService = inject(BranchZoneService);

  protected readonly branchId = signal<string | null>(null);
  protected readonly isEditMode = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  // Zone state
  protected readonly availableZones = signal<Zone[]>([]);
  protected readonly existingBranchZones = signal<BranchZone[]>([]);
  protected readonly newBranchZones = signal<Array<{ zone: Zone; deliveryConfig: DeliveryConfigItem[] }>>([]);
  protected readonly deletedBranchZoneIds = signal<string[]>([]);
  protected readonly zoneSearchTerm = signal('');
  protected readonly showZoneDropdown = signal(false);
  protected readonly isLoadingZones = signal(false);

  // Collapsible state for existing branch zones
  protected readonly collapsedExisting = signal<Set<string>>(new Set());
  protected readonly collapsedNew = signal<Set<number>>(new Set());

  // Computed: all zones matching search term, with assigned flag
  protected readonly filteredZones = computed(() => {
    const all = this.availableZones();
    const existingZoneIds = new Set(
      this.existingBranchZones()
        .filter(bz => !this.deletedBranchZoneIds().includes(bz.id))
        .map(bz => typeof bz.zone === 'string' ? bz.zone : bz.zone.id)
    );
    const newZoneIds = new Set(this.newBranchZones().map(nbz => nbz.zone.id));
    const term = this.zoneSearchTerm().toLowerCase();

    return all
      .filter(z => !term || z.name.toLowerCase().includes(term) || this.getZoneCityName(z).toLowerCase().includes(term))
      .map(z => ({
        ...z,
        isAssigned: existingZoneIds.has(z.id) || newZoneIds.has(z.id),
      }));
  });

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(MAX_BRANCH_NAME_LENGTH)]],
    description: ['', [Validators.maxLength(MAX_DESCRIPTION_LENGTH)]],
    address: ['', [Validators.required, Validators.maxLength(MAX_ADDRESS_LENGTH)]],
    whatsappPhone: ['', [Validators.pattern(PHONE_VE_PATTERN)]],
    landlinePhone: ['', [Validators.pattern(LANDLINE_VE_PATTERN)]],
    coordinatesRaw: ['', [Validators.pattern(COORDINATES_PATTERN)]],
    hasInStoreOilChange: [false],
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
    this.loadZones();
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

  private loadZones(): void {
    this.isLoadingZones.set(true);
    this.zoneService.getActive().subscribe({
      next: (res) => {
        this.availableZones.set(res.data || []);
        this.isLoadingZones.set(false);
        if (this.isEditMode()) {
          this.loadBranch();
        }
      },
      error: () => {
        this.isLoadingZones.set(false);
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

    forkJoin({
      branch: this.branchService.getById(id),
      branchZones: this.branchZoneService.getByBranch(id),
    }).subscribe({
      next: ({ branch: branchRes, branchZones: bzRes }) => {
        const branch = branchRes.data;

        // Patch basic fields
        this.form.patchValue({
          name: branch.name,
          description: branch.description || '',
          address: branch.address,
          whatsappPhone: branch.whatsappPhone,
          landlinePhone: branch.landlinePhone || '',
          coordinatesRaw: branch.coordinates ? `${branch.coordinates.latitude}, ${branch.coordinates.longitude}` : '',
          hasInStoreOilChange: branch.hasInStoreOilChange ?? false,
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

        // Load existing branch zones
        this.existingBranchZones.set(bzRes.data || []);
        // Collapse all existing by default
        const collapsed = new Set<string>((bzRes.data || []).map(bz => bz.id));
        this.collapsedExisting.set(collapsed);

        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al cargar sucursal');
        this.isLoading.set(false);
      },
    });
  }

  // ==================== ZONE HELPERS ====================

  getZoneCityName(zone: Zone): string {
    if (typeof zone.city === 'string') return '';
    return (zone.city as City).name || '';
  }

  getZoneMunicipalityCount(zone: Zone): number {
    return zone.municipalities?.length || 0;
  }

  getExistingZone(bz: BranchZone): Zone | null {
    if (typeof bz.zone === 'string') return null;
    return bz.zone as Zone;
  }

  getExistingZoneName(bz: BranchZone): string {
    const zone = this.getExistingZone(bz);
    return zone?.name || 'Zona desconocida';
  }

  getExistingZoneCityName(bz: BranchZone): string {
    const zone = this.getExistingZone(bz);
    if (!zone) return '';
    return this.getZoneCityName(zone);
  }

  // ==================== ZONE DROPDOWN ====================

  onZoneSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.zoneSearchTerm.set(value);
    this.showZoneDropdown.set(value.trim().length > 0);
  }

  closeZoneDropdown(): void {
    this.showZoneDropdown.set(false);
  }

  // ==================== ZONE MANAGEMENT ====================

  addZone(zone: Zone & { isAssigned?: boolean }): void {
    if (zone.isAssigned) return;

    // Build default delivery config from zone municipalities
    const deliveryConfig: DeliveryConfigItem[] = (zone.municipalities || []).map(slug => ({
      municipality: slug,
      hasDelivery: false,
      freeDelivery: true,
      deliveryCharge: 0,
    }));

    this.newBranchZones.update(zones => [...zones, { zone, deliveryConfig }]);
    this.zoneSearchTerm.set('');
    this.showZoneDropdown.set(false);
  }

  removeExistingZone(bzId: string): void {
    this.deletedBranchZoneIds.update(ids => [...ids, bzId]);
  }

  removeNewZone(index: number): void {
    this.newBranchZones.update(zones => zones.filter((_, i) => i !== index));
  }

  // ==================== COLLAPSE TOGGLES ====================

  toggleExistingCollapse(bzId: string): void {
    this.collapsedExisting.update(set => {
      const next = new Set(set);
      if (next.has(bzId)) {
        next.delete(bzId);
      } else {
        next.add(bzId);
      }
      return next;
    });
  }

  isExistingCollapsed(bzId: string): boolean {
    return this.collapsedExisting().has(bzId);
  }

  toggleNewCollapse(index: number): void {
    this.collapsedNew.update(set => {
      const next = new Set(set);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  isNewCollapsed(index: number): boolean {
    return this.collapsedNew().has(index);
  }

  // ==================== DELIVERY CONFIG - EXISTING ====================

  toggleExistingDelivery(bzId: string, municipality: string): void {
    this.existingBranchZones.update(zones => zones.map(bz => {
      if (bz.id !== bzId) return bz;
      return {
        ...bz,
        deliveryConfig: bz.deliveryConfig.map(dc =>
          dc.municipality === municipality ? { ...dc, hasDelivery: !dc.hasDelivery } : dc
        ),
      };
    }));
  }

  toggleExistingFreeDelivery(bzId: string, municipality: string): void {
    this.existingBranchZones.update(zones => zones.map(bz => {
      if (bz.id !== bzId) return bz;
      return {
        ...bz,
        deliveryConfig: bz.deliveryConfig.map(dc =>
          dc.municipality === municipality ? { ...dc, freeDelivery: !dc.freeDelivery } : dc
        ),
      };
    }));
  }

  updateExistingDeliveryCharge(bzId: string, municipality: string, event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value) || 0;
    this.existingBranchZones.update(zones => zones.map(bz => {
      if (bz.id !== bzId) return bz;
      return {
        ...bz,
        deliveryConfig: bz.deliveryConfig.map(dc =>
          dc.municipality === municipality ? { ...dc, deliveryCharge: value } : dc
        ),
      };
    }));
  }

  // ==================== DELIVERY CONFIG - NEW ====================

  toggleNewDelivery(index: number, municipality: string): void {
    this.newBranchZones.update(zones => zones.map((nbz, i) => {
      if (i !== index) return nbz;
      return {
        ...nbz,
        deliveryConfig: nbz.deliveryConfig.map(dc =>
          dc.municipality === municipality ? { ...dc, hasDelivery: !dc.hasDelivery } : dc
        ),
      };
    }));
  }

  toggleNewFreeDelivery(index: number, municipality: string): void {
    this.newBranchZones.update(zones => zones.map((nbz, i) => {
      if (i !== index) return nbz;
      return {
        ...nbz,
        deliveryConfig: nbz.deliveryConfig.map(dc =>
          dc.municipality === municipality ? { ...dc, freeDelivery: !dc.freeDelivery } : dc
        ),
      };
    }));
  }

  updateNewDeliveryCharge(index: number, municipality: string, event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value) || 0;
    this.newBranchZones.update(zones => zones.map((nbz, i) => {
      if (i !== index) return nbz;
      return {
        ...nbz,
        deliveryConfig: nbz.deliveryConfig.map(dc =>
          dc.municipality === municipality ? { ...dc, deliveryCharge: value } : dc
        ),
      };
    }));
  }

  // ==================== MUNICIPALITY NAME RESOLVER ====================

  getMunicipalityDisplayName(slug: string, zone: Zone): string {
    if (typeof zone.city !== 'string') {
      const city = zone.city as City;
      const found = city.municipalities?.find(m => m.slug === slug);
      if (found) return found.name;
    }
    // Fallback: capitalize slug
    return slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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

    const data: CreateBranchRequest = {
      name: formValue.name,
      description: formValue.description || undefined,
      address: formValue.address,
      whatsappPhone: formValue.whatsappPhone,
      landlinePhone: formValue.landlinePhone || undefined,
      schedule: formValue.schedule,
      coordinates: this.parseCoordinates(formValue.coordinatesRaw),
      hasInStoreOilChange: formValue.hasInStoreOilChange,
      isActive: formValue.isActive,
    };

    const request$ = this.isEditMode()
      ? this.branchService.update(this.branchId()!, data)
      : this.branchService.create(data);

    request$.subscribe({
      next: (response) => {
        const branchId = response.data.id || this.branchId()!;
        this.saveBranchZones(branchId);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al guardar sucursal');
        this.isSubmitting.set(false);
      },
    });
  }

  private saveBranchZones(branchId: string): void {
    const deletions = this.deletedBranchZoneIds();
    const newZones = this.newBranchZones();
    const existingModified = this.existingBranchZones()
      .filter(bz => !deletions.includes(bz.id));

    const tasks: Observable<any>[] = [];

    // 1. Delete removed branch zones
    for (const id of deletions) {
      tasks.push(this.branchZoneService.delete(id));
    }

    // 2. Create new branch zones in batch
    if (newZones.length > 0) {
      tasks.push(this.branchZoneService.createBatch({
        branchId,
        zones: newZones.map(nbz => ({
          zoneId: nbz.zone.id,
          deliveryConfig: nbz.deliveryConfig,
        })),
      }));
    }

    // 3. Update modified existing branch zones
    for (const bz of existingModified) {
      tasks.push(this.branchZoneService.update(bz.id, {
        deliveryConfig: bz.deliveryConfig,
      }));
    }

    if (tasks.length === 0) {
      this.router.navigate(['/admin/branches']);
      return;
    }

    forkJoin(tasks).subscribe({
      next: () => {
        this.router.navigate(['/admin/branches']);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Sucursal guardada, pero hubo un error al guardar las zonas');
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

  // ==================== VISIBLE EXISTING ZONES (filtered) ====================

  get visibleExistingBranchZones(): BranchZone[] {
    const deleted = this.deletedBranchZoneIds();
    return this.existingBranchZones().filter(bz => !deleted.includes(bz.id));
  }
}
