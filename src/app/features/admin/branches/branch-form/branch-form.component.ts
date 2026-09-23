import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { forkJoin, Observable } from 'rxjs';
import { BranchService } from '@core/services/branch.service';
import { ZoneService } from '@core/services/zone.service';
import { BranchZoneService } from '@core/services/branch-zone.service';
import { ToastService } from '@shared/services/toast.service';
import { CreateBranchRequest } from '@models/branch.model';
import { Zone } from '@models/zone.model';
import { BranchZone } from '@models/branch-zone.model';
import { CityDeliveryConfig, GeoAdminTree } from '@models/geo.model';
import { GeoAdminService } from '@core/services/geo-admin.service';
import { BranchZoneDeliveryComponent } from '../branch-zone-delivery/branch-zone-delivery.component';
import { alignCityConfig } from '../branch-zone-delivery/city-config.util';
import {
  PHONE_VE_PATTERN, LANDLINE_VE_PATTERN, COORDINATES_PATTERN,
  MAX_BRANCH_NAME_LENGTH, MAX_DESCRIPTION_LENGTH, MAX_ADDRESS_LENGTH,
} from '@shared/validators/form-validators';

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** A zone of the branch being edited: already saved (`bzId`) or added in this session. */
interface AssignmentDraft {
  key: string;
  bzId: string | null;
  zone: Zone;
  cityConfig: CityDeliveryConfig[];
  dirty: boolean;
}

@Component({
  selector: 'app-branch-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, BranchZoneDeliveryComponent],
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
  private readonly geoAdminService = inject(GeoAdminService);
  private readonly toastService = inject(ToastService);

  protected readonly branchId = signal<string | null>(null);
  protected readonly isEditMode = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  // Zone state (ubicaciones v2: delivery per city, with parish exceptions)
  protected readonly availableZones = signal<Zone[]>([]);
  protected readonly assignments = signal<AssignmentDraft[]>([]);
  protected readonly deletedBranchZoneIds = signal<string[]>([]);
  protected readonly zoneSearchTerm = signal('');
  protected readonly showZoneDropdown = signal(false);
  protected readonly isLoadingZones = signal(false);
  protected readonly collapsed = signal<Set<string>>(new Set());

  /** State trees by state id; zones of one branch usually share a state. */
  private readonly trees = signal<Map<string, GeoAdminTree>>(new Map());
  private readonly stateNames = signal<Map<string, string>>(new Map());
  private newKeySeq = 0;

  // Computed: all zones matching search term, with assigned flag
  protected readonly filteredZones = computed(() => {
    const assigned = new Set(this.assignments().map((a) => a.zone.id));
    const term = this.zoneSearchTerm().toLowerCase();
    return this.availableZones()
      .filter((z) => !term || z.name.toLowerCase().includes(term) || this.zoneMeta(z).toLowerCase().includes(term))
      .map((z) => ({ ...z, isAssigned: assigned.has(z.id) }));
  });

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(MAX_BRANCH_NAME_LENGTH)]],
    description: ['', [Validators.maxLength(MAX_DESCRIPTION_LENGTH)]],
    address: ['', [Validators.required, Validators.maxLength(MAX_ADDRESS_LENGTH)]],
    whatsappPhone: ['', [Validators.required, Validators.pattern(PHONE_VE_PATTERN)]],
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
    this.geoAdminService.listStates().subscribe({
      next: (states) => this.stateNames.set(new Map(states.map((st) => [st.id, st.name]))),
    });
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

        // Existing assignments, collapsed by default; their trees load in the background.
        const drafts = (bzRes.data || [])
          .filter((bz) => typeof bz.zone === 'object' && bz.zone !== null)
          .map((bz) => ({ key: bz.id, bzId: bz.id, zone: bz.zone as Zone, cityConfig: bz.cityConfig ?? [], dirty: false }));
        this.assignments.set(drafts);
        this.collapsed.set(new Set(drafts.map((d) => d.key)));
        drafts.forEach((d) => this.ensureTree(d.zone));

        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al cargar sucursal');
        this.isLoading.set(false);
      },
    });
  }

  // ==================== ZONE HELPERS ====================

  /** "Carabobo · 17 parroquias" */
  zoneMeta(zone: Zone): string {
    const count = zone.parishes?.length ?? 0;
    const state = (zone.states?.[0] && this.stateNames().get(zone.states[0])) || 'Sin parroquias';
    return `${state} · ${count} ${count === 1 ? 'parroquia' : 'parroquias'}`;
  }

  treeFor(zone: Zone): GeoAdminTree | undefined {
    const stateId = zone.states?.[0];
    return stateId ? this.trees().get(stateId) : undefined;
  }

  /** Loads the zone's state tree once, then aligns every draft of that state with it. */
  private ensureTree(zone: Zone): void {
    const stateId = zone.states?.[0];
    if (!stateId || this.trees().has(stateId)) {
      if (stateId) this.alignDrafts(stateId);
      return;
    }
    this.geoAdminService.getTree(stateId).subscribe({
      next: (tree) => {
        this.trees.update((map) => new Map(map).set(stateId, tree));
        this.alignDrafts(stateId);
      },
      error: () => this.toastService.error('No se pudieron cargar las parroquias de la zona'),
    });
  }

  /** New cities of a zone get default terms; a draft whose config had to change is saved. */
  private alignDrafts(stateId: string): void {
    const tree = this.trees().get(stateId);
    if (!tree) return;
    this.assignments.update((drafts) =>
      drafts.map((d) => {
        if (d.zone.states?.[0] !== stateId) return d;
        const aligned = alignCityConfig(tree, d.cityConfig, d.zone.parishes ?? []);
        const changed = JSON.stringify(aligned) !== JSON.stringify(d.cityConfig);
        return changed ? { ...d, cityConfig: aligned, dirty: true } : d;
      }),
    );
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
    if (!zone.parishes?.length) {
      this.toastService.error(`La zona «${zone.name}» todavía no tiene parroquias`);
      return;
    }
    const key = `new-${++this.newKeySeq}`;
    this.assignments.update((drafts) => [...drafts, { key, bzId: null, zone, cityConfig: [], dirty: true }]);
    this.ensureTree(zone);
    this.zoneSearchTerm.set('');
    this.showZoneDropdown.set(false);
  }

  removeAssignment(draft: AssignmentDraft): void {
    if (draft.bzId) this.deletedBranchZoneIds.update((ids) => [...ids, draft.bzId!]);
    this.assignments.update((drafts) => drafts.filter((d) => d.key !== draft.key));
  }

  onConfigChange(key: string, cityConfig: CityDeliveryConfig[]): void {
    this.assignments.update((drafts) => drafts.map((d) => (d.key === key ? { ...d, cityConfig, dirty: true } : d)));
  }

  // ==================== COLLAPSE ====================

  toggleCollapse(key: string): void {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  isCollapsed(key: string): boolean {
    return this.collapsed().has(key);
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
        const msg = error.error?.message || 'Error al guardar sucursal';
        this.errorMessage.set(msg);
        this.toastService.error(msg);
        this.isSubmitting.set(false);
      },
    });
  }

  private saveBranchZones(branchId: string): void {
    const drafts = this.assignments();
    const created = drafts.filter((d) => !d.bzId);
    const changed = drafts.filter((d) => d.bzId && d.dirty);
    const tasks: Observable<unknown>[] = [];

    for (const id of this.deletedBranchZoneIds()) {
      tasks.push(this.branchZoneService.delete(id));
    }
    if (created.length > 0) {
      tasks.push(
        this.geoAdminService.createAssignments({
          branchId,
          zones: created.map((d) => ({ zoneId: d.zone.id, cityConfig: d.cityConfig })),
        }),
      );
    }
    for (const d of changed) {
      tasks.push(this.geoAdminService.updateAssignment(d.bzId!, { cityConfig: d.cityConfig }));
    }

    const successMessage = this.isEditMode()
      ? 'Sucursal actualizada exitosamente'
      : 'Sucursal creada exitosamente';

    if (tasks.length === 0) {
      this.toastService.success(successMessage);
      this.router.navigate(['/admin/branches']);
      return;
    }

    forkJoin(tasks).subscribe({
      next: () => {
        this.toastService.success(successMessage);
        this.router.navigate(['/admin/branches']);
      },
      error: (error) => {
        const msg = error.error?.message || 'Sucursal guardada, pero hubo un error al guardar las zonas';
        this.errorMessage.set(msg);
        this.toastService.error(msg);
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
