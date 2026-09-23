import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { forkJoin, Observable, switchMap, tap } from 'rxjs';
import { BranchService } from '@core/services/branch.service';
import { ZoneService } from '@core/services/zone.service';
import { BranchZoneService } from '@core/services/branch-zone.service';
import { ToastService } from '@shared/services/toast.service';
import { CreateBranchRequest } from '@models/branch.model';
import { Zone } from '@models/zone.model';
import { BranchZone } from '@models/branch-zone.model';
import { BranchAssignmentSave, CityDeliveryConfig, GeoAdminTree } from '@models/geo.model';
import { zoneStateLabel } from '@shared/utils/zone-states.util';
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
  private readonly location = inject(Location);

  protected readonly branchId = signal<string | null>(null);
  protected readonly isEditMode = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  // Zone state (ubicaciones v2: delivery per city, with parish exceptions)
  protected readonly availableZones = signal<Zone[]>([]);
  protected readonly assignments = signal<AssignmentDraft[]>([]);
  protected readonly zoneSearchTerm = signal('');
  protected readonly showZoneDropdown = signal(false);
  protected readonly isLoadingZones = signal(false);
  protected readonly collapsed = signal<Set<string>>(new Set());

  /** State trees by state id; a zone may need several, a branch's zones often share them. */
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
        drafts.forEach((d) => this.ensureTrees(d.zone));

        this.isLoading.set(false);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al cargar sucursal');
        this.isLoading.set(false);
      },
    });
  }

  // ==================== ZONE HELPERS ====================

  /** "Distrito Capital + Miranda · 32 parroquias" */
  zoneMeta(zone: Zone): string {
    const count = zone.parishes?.length ?? 0;
    return `${zoneStateLabel(zone.states, this.stateNames())} · ${count} ${count === 1 ? 'parroquia' : 'parroquias'}`;
  }

  /** The trees of every state of the zone, or undefined while any is still loading. */
  treesFor(zone: Zone): GeoAdminTree[] | undefined {
    const stateIds = zone.states ?? [];
    const loaded = this.trees();
    if (!stateIds.length || !stateIds.every((id) => loaded.has(id))) return undefined;
    return stateIds.map((id) => loaded.get(id)!);
  }

  /** Loads the trees the zone still lacks, then aligns every draft whose trees are all in. */
  private ensureTrees(zone: Zone): void {
    const missing = (zone.states ?? []).filter((id) => !this.trees().has(id));
    if (!missing.length) {
      this.alignDrafts();
      return;
    }
    this.geoAdminService.getTrees(missing).subscribe({
      next: (trees) => {
        this.trees.update((map) => {
          const next = new Map(map);
          trees.forEach((tree, i) => next.set(missing[i], tree));
          return next;
        });
        this.alignDrafts();
      },
      error: () => this.toastService.error('No se pudieron cargar las parroquias de la zona'),
    });
  }

  /** New cities of a zone get default terms; a draft whose config had to change is saved. */
  private alignDrafts(): void {
    this.assignments.update((drafts) =>
      drafts.map((d) => {
        const trees = this.treesFor(d.zone);
        if (!trees) return d;
        const aligned = alignCityConfig(trees, d.cityConfig, d.zone.parishes ?? []);
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
    this.ensureTrees(zone);
    this.zoneSearchTerm.set('');
    this.showZoneDropdown.set(false);
  }

  /** Zones left out of the list are removed when the branch is saved. */
  removeAssignment(draft: AssignmentDraft): void {
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

    if (this.isEditMode()) {
      // Zones first: their rules are what can refuse a save, while the branch
      // fields were already checked by the form. A refusal then changes nothing.
      const branchId = this.branchId()!;
      this.saveZones$(branchId)
        .pipe(
          tap((saved) => this.markZonesSaved(saved)),
          switchMap(() => this.branchService.update(branchId, data)),
        )
        .subscribe({
          next: () => this.finishSave('Sucursal actualizada exitosamente'),
          error: (error) => this.failSave(error?.error?.message || 'Error al guardar sucursal'),
        });
      return;
    }

    this.branchService.create(data).subscribe({
      next: (response) => {
        const branchId = response.data.id;
        this.saveZones$(branchId).subscribe({
          next: () => this.finishSave('Sucursal creada exitosamente'),
          error: (error) => {
            // The branch exists now: keep editing it, so saving again fixes its
            // zones instead of creating a second branch.
            this.branchId.set(branchId);
            this.isEditMode.set(true);
            this.location.replaceState(`/admin/branches/edit/${branchId}`);
            const reason = error?.error?.message || 'error desconocido';
            this.failSave(`La sucursal se creó, pero sus zonas no se guardaron: ${reason}. Corrígelo y guarda de nuevo.`);
          },
        });
      },
      error: (error) => this.failSave(error?.error?.message || 'Error al guardar sucursal'),
    });
  }

  /**
   * Every zone of the branch in one request, stored all together or not at
   * all. A draft travels with its terms once its trees are loaded; a new one
   * still loading goes without them and the server gives it free delivery,
   * the same default the table would show.
   */
  private saveZones$(branchId: string): Observable<BranchZone[]> {
    const assignments: BranchAssignmentSave[] = this.assignments().map((d) => ({
      id: d.bzId,
      zoneId: d.zone.id,
      ...(d.dirty && this.treesFor(d.zone) ? { cityConfig: d.cityConfig } : {}),
    }));
    return this.geoAdminService.saveBranchAssignments(branchId, assignments);
  }

  /** After the zones are stored, drafts point at their saved assignments: a retry then only updates them. */
  private markZonesSaved(saved: BranchZone[]): void {
    const idByZone = new Map(saved.map((bz) => [typeof bz.zone === 'string' ? bz.zone : bz.zone.id, bz.id]));
    this.assignments.update((drafts) =>
      drafts.map((d) => (idByZone.has(d.zone.id) ? { ...d, bzId: idByZone.get(d.zone.id)!, dirty: false } : d)),
    );
  }

  private finishSave(message: string): void {
    this.toastService.success(message);
    this.router.navigate(['/admin/branches']);
  }

  private failSave(message: string): void {
    this.errorMessage.set(message);
    this.toastService.error(message);
    this.isSubmitting.set(false);
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
