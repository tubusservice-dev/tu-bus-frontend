import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { ZoneService } from '@core/services/zone.service';
import { GeoAdminService } from '@core/services/geo-admin.service';
import { ToastService } from '@shared/services/toast.service';
import { GeoTreePickerComponent } from '@shared/components/geo-tree-picker/geo-tree-picker.component';
import { GeoStatePickerComponent } from '@shared/components/geo-state-picker/geo-state-picker.component';
import { GeoAdminTree, GeoState } from '@models/geo.model';

/** A state added to the zone, with its tree once loaded. */
interface ZoneStateBlock {
  id: string;
  name: string;
  tree: GeoAdminTree | null;
}

/**
 * Create / edit a zone as a set of parishes (ubicaciones v2). A zone may span
 * several states — metropolitan Caracas is Distrito Capital plus Miranda —
 * so the form holds one parish picker per state added.
 */
@Component({
  selector: 'app-zone-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, GeoTreePickerComponent, GeoStatePickerComponent],
  templateUrl: './zone-form.component.html',
  styleUrl: './zone-form.component.scss',
})
export class ZoneFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly zoneService = inject(ZoneService);
  private readonly geoAdminService = inject(GeoAdminService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly zoneId = signal<string | null>(null);
  protected readonly isEditMode = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly states = signal<GeoState[]>([]);
  protected readonly coveredStateIds = signal<ReadonlySet<string>>(new Set());
  protected readonly coveredMunicipalityCounts = signal<ReadonlyMap<string, number>>(new Map());
  protected readonly zoneStates = signal<ZoneStateBlock[]>([]);
  protected readonly parishes = signal<string[]>([]);
  /** States not in the zone yet: the ones the "add a state" picker offers. */
  protected readonly addableStates = computed(() => {
    const added = new Set(this.zoneStates().map((s) => s.id));
    return this.states().filter((s) => !added.has(s.id));
  });
  /** Bumped after each add so the "add a state" picker starts empty again. */
  protected readonly addPickerKey = signal(0);

  protected readonly nameExists = signal(false);
  private readonly nameCheck$ = new Subject<string>();

  protected readonly canSubmit = computed(() => !this.isSubmitting() && !this.nameExists() && this.parishes().length > 0);

  protected readonly form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
    isActive: [true],
  });

  ngOnInit(): void {
    this.setupNameCheck();
    this.geoAdminService
      .listStates()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (states) => this.states.set(states),
        error: () => this.errorMessage.set('No se pudieron cargar los estados'),
      });
    this.geoAdminService
      .getCoverage()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (coverage) => {
          this.coveredStateIds.set(new Set(coverage.map((c) => c.state.id)));
          this.coveredMunicipalityCounts.set(new Map(coverage.map((c) => [c.state.id, c.municipalities.length])));
        },
      });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.zoneId.set(id);
      this.isEditMode.set(true);
      this.loadZone(id);
    }
  }

  // ==================== data ====================

  private loadZone(id: string): void {
    this.isLoading.set(true);
    this.zoneService.getById(id).subscribe({
      next: ({ data: zone }) => {
        this.form.patchValue({ name: zone.name ?? '', isActive: zone.isActive });
        this.isLoading.set(false);

        if (!zone.states?.length || !zone.parishes?.length) {
          this.errorMessage.set('Esta zona todavía no tiene parroquias: hay que migrarla antes de editarla aquí.');
          return;
        }
        this.parishes.set(zone.parishes);
        zone.states.forEach((stateId) => this.addState(stateId));
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al cargar zona');
        this.isLoading.set(false);
      },
    });
  }

  // ==================== states of the zone ====================

  /** Adds a state to the zone and loads its parishes. */
  protected addState(stateId: string | null): void {
    if (!stateId || this.zoneStates().some((s) => s.id === stateId)) return;
    const name = this.states().find((s) => s.id === stateId)?.name ?? '';
    this.zoneStates.update((blocks) => [...blocks, { id: stateId, name, tree: null }]);
    this.addPickerKey.update((k) => k + 1);

    this.geoAdminService
      .getTree(stateId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tree) =>
          this.zoneStates.update((blocks) =>
            blocks.map((b) => (b.id === stateId ? { ...b, name: tree.state.name, tree } : b)),
          ),
        error: () => this.errorMessage.set('No se pudo cargar el estado'),
      });
  }

  /** Takes a state out of the zone, with every parish of it the zone had. Nothing is saved until "Guardar". */
  protected removeState(block: ZoneStateBlock): void {
    const ofState = new Set(
      (block.tree?.municipalities ?? []).flatMap((m) => m.cities.flatMap((c) => c.parishes.map((p) => p.id))),
    );
    this.parishes.update((ids) => ids.filter((id) => !ofState.has(id)));
    this.zoneStates.update((blocks) => blocks.filter((b) => b.id !== block.id));
  }

  // ==================== name uniqueness ====================

  private setupNameCheck(): void {
    this.nameCheck$
      .pipe(
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((name) => this.zoneService.checkName(name)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => this.nameExists.set(response.data.exists),
        error: () => this.nameExists.set(false),
      });
  }

  protected onNameBlur(): void {
    const name = this.form.get('name')?.value?.trim();
    if (name && name.length >= 2) this.nameCheck$.next(name);
  }

  // ==================== submit ====================

  protected onSubmit(): void {
    if (this.form.invalid || !this.canSubmit()) {
      this.form.markAllAsTouched();
      if (!this.parishes().length) this.errorMessage.set('Marca al menos una parroquia');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    const { name, isActive } = this.form.getRawValue();
    const request = { name: name.trim(), parishes: this.parishes(), isActive };

    const save$ = this.isEditMode()
      ? this.geoAdminService.updateZone(this.zoneId()!, request)
      : this.geoAdminService.createZone(request);

    save$.subscribe({
      next: () => {
        this.toastService.success(this.isEditMode() ? 'Zona actualizada exitosamente' : 'Zona creada exitosamente');
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

  // ==================== helpers ====================

  protected hasError(field: string, error: string): boolean {
    const control = this.form.get(field);
    return !!(control?.hasError(error) && control?.touched);
  }

  protected isInvalid(field: string): boolean {
    const control = this.form.get(field);
    return !!(control?.invalid && control?.touched);
  }
}
