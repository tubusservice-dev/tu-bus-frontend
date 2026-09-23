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

/**
 * Create / edit a zone as a set of parishes of one state (ubicaciones v2).
 * The server derives what the previous app version reads from the parishes.
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
  protected readonly selectedStateId = signal<string | null>(null);
  protected readonly tree = signal<GeoAdminTree | null>(null);
  protected readonly isLoadingTree = signal(false);
  protected readonly parishes = signal<string[]>([]);

  protected readonly nameExists = signal(false);
  private readonly nameCheck$ = new Subject<string>();

  protected readonly canSubmit = computed(
    () => !this.isSubmitting() && !this.nameExists() && Boolean(this.selectedStateId()) && this.parishes().length > 0,
  );

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

        const stateId = zone.states?.[0];
        if (!stateId || !zone.parishes?.length) {
          this.errorMessage.set('Esta zona todavía no tiene parroquias: hay que migrarla antes de editarla aquí.');
          return;
        }
        this.parishes.set(zone.parishes);
        this.loadTree(stateId);
      },
      error: (error) => {
        this.errorMessage.set(error.error?.message || 'Error al cargar zona');
        this.isLoading.set(false);
      },
    });
  }

  private loadTree(stateId: string): void {
    this.selectedStateId.set(stateId);
    this.tree.set(null);
    this.isLoadingTree.set(true);
    this.geoAdminService
      .getTree(stateId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tree) => {
          this.tree.set(tree);
          this.isLoadingTree.set(false);
        },
        error: () => {
          this.errorMessage.set('No se pudo cargar el estado');
          this.isLoadingTree.set(false);
        },
      });
  }

  /** A zone lives in one state: changing it starts the selection over. */
  protected onStateChange(stateId: string | null): void {
    if (stateId === this.selectedStateId()) return;
    this.parishes.set([]);
    if (stateId) this.loadTree(stateId);
    else {
      this.selectedStateId.set(null);
      this.tree.set(null);
    }
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
