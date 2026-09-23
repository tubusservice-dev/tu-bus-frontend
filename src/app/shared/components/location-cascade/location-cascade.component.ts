import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, forwardRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Observable, map, shareReplay } from 'rxjs';
import { GeoService } from '@core/services/geo.service';
import { CoverageService } from '@core/services/coverage.service';
import { LocationRef, MunicipalityCoverage, ParishDelivery } from '@models/geo.model';

export type CascadeLevel = 'state' | 'municipality' | 'city' | 'parish';
type Option = { id: string; name: string };
type Selection = Partial<Record<CascadeLevel, Option>>;

const ORDER: CascadeLevel[] = ['state', 'municipality', 'city', 'parish'];
const LABELS: Record<CascadeLevel, string> = { state: 'Estado', municipality: 'Municipio', city: 'Ciudad', parish: 'Parroquia' };
const EMPTY_OPTIONS: Record<CascadeLevel, Option[]> = { state: [], municipality: [], city: [], parish: [] };
let cascadeSeq = 0;

/**
 * State › Municipality › City › Parish as native selects, for reactive forms
 * (value: `LocationRef | null`, complete once every level asked for is set).
 *
 * - `source: 'national'` lists the whole catalogue; `'coverage'` only places
 *   with service, and with `deliverableOnly` only those that get delivery.
 * - `levels` are the selects shown; the levels above them come from `fixed`
 *   (shown as text with a "cambiar" link that emits `changeRequested`).
 * - A level with a single option is picked automatically.
 * - With `source: 'coverage'`, picking a parish emits its delivery terms.
 */
@Component({
  selector: 'app-location-cascade',
  standalone: true,
  templateUrl: './location-cascade.component.html',
  styleUrl: './location-cascade.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => LocationCascadeComponent), multi: true }],
})
export class LocationCascadeComponent implements ControlValueAccessor, OnInit {
  private readonly geo = inject(GeoService);
  private readonly coverageApi = inject(CoverageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly source = input<'coverage' | 'national'>('national');
  readonly levels = input<CascadeLevel[]>(['state', 'municipality']);
  readonly fixed = input<Partial<LocationRef> | null>(null);
  readonly deliverableOnly = input(false);

  readonly deliveryChange = output<ParishDelivery | null>();
  readonly changeRequested = output<void>();

  protected readonly labels = LABELS;
  /** Keeps label/select ids unique when a page shows more than one cascade. */
  protected readonly uid = `cascade-${++cascadeSeq}`;
  protected readonly selection = signal<Selection>({});
  protected readonly options = signal<Record<CascadeLevel, Option[]>>(EMPTY_OPTIONS);
  protected readonly disabled = signal(false);

  private readonly coverageByMunicipality = new Map<string, Observable<MunicipalityCoverage>>();
  private onChange: (value: LocationRef | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  ngOnInit(): void {
    this.reset(null);
  }

  /** "Chacao, Miranda": the fixed levels as text. */
  protected fixedLabel(): string {
    const fixed = this.fixedSelection();
    return ORDER.filter((l) => fixed[l] && !this.levels().includes(l))
      .reverse()
      .map((l) => fixed[l]!.name)
      .join(', ');
  }

  protected isEnabled(level: CascadeLevel): boolean {
    const parent = this.parentOf(level);
    return !this.disabled() && (!parent || Boolean(this.selection()[parent]));
  }

  protected onSelect(level: CascadeLevel, id: string): void {
    const option = this.options()[level].find((o) => o.id === id) ?? null;
    this.pick(level, option, true);
    this.onTouched();
  }

  // ==================== ControlValueAccessor ====================

  writeValue(value: LocationRef | null): void {
    this.reset(value);
  }

  registerOnChange(fn: (value: LocationRef | null) => void): void {
    this.onChange = fn;
    // Forms register after writing the first value; anything picked on its
    // own in between (a lone option) would otherwise never reach them.
    const current = this.value();
    if (current) fn(current);
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  // ==================== internals ====================

  /**
   * Starts over from `fixed` plus `value`: loads the lists of the levels
   * already set (so their selects show them) and of the first one missing,
   * which picks itself when it has a single option.
   */
  private reset(value: LocationRef | null): void {
    const written: Selection = value ? { ...value } : {};
    this.selection.set({ ...this.fixedSelection(), ...written });
    this.options.set(EMPTY_OPTIONS);

    for (const level of this.levels()) {
      if (!this.isEnabled(level)) break;
      const missing = !this.selection()[level];
      this.load(level, missing);
      if (missing) break;
    }
    // A saved address brings its delivery cost with it.
    if (written.parish) this.emitDelivery();
  }

  /** Sets one level, clears the ones below it and loads the next list. */
  private pick(level: CascadeLevel, option: Option | null, notify: boolean): void {
    const below = ORDER.slice(ORDER.indexOf(level) + 1);
    this.selection.update((s) => {
      const next: Selection = { ...s, [level]: option ?? undefined };
      for (const l of below) delete next[l];
      return next;
    });
    this.options.update((o) => ({ ...o, ...Object.fromEntries(below.map((l) => [l, []])) }));

    const child = below.find((l) => this.levels().includes(l));
    if (option && child) this.load(child, true);
    if (level === 'parish' || below.includes('parish')) this.emitDelivery();
    if (notify) this.onChange(this.value());
  }

  /** Fetches a level's options; picks the only one when `autoPick` and nothing is chosen there. */
  private load(level: CascadeLevel, autoPick: boolean): void {
    this.fetch(level)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((list) => {
        this.options.update((o) => ({ ...o, [level]: list }));
        if (autoPick && list.length === 1 && !this.selection()[level]) this.pick(level, list[0], true);
      });
  }

  private fetch(level: CascadeLevel): Observable<Option[]> {
    const s = this.selection();
    const names = (list: Option[]) => list.map(({ id, name }) => ({ id, name }));

    if (this.source() === 'national') {
      if (level === 'state') return this.geo.states().pipe(map(names));
      if (level === 'municipality') return this.geo.municipalities(s.state!.id).pipe(map(names));
      if (level === 'city') return this.geo.cities(s.municipality!.id).pipe(map(names));
      return this.geo.parishes(s.city!.id).pipe(map(names));
    }

    if (level === 'state') return this.geo.coverageTree().pipe(map((tree) => tree.map((t) => t.state)), map(names));
    if (level === 'municipality') {
      return this.geo.coverageTree().pipe(map((tree) => names(tree.find((t) => t.state.id === s.state!.id)?.municipalities ?? [])));
    }
    const deliverable = this.deliverableOnly();
    return this.municipalityCoverage(s.municipality!.id).pipe(
      map((coverage) => {
        const cities = coverage.cities
          .map((c) => ({ ...c, parishes: c.parishes.filter((p) => !deliverable || p.hasDelivery) }))
          .filter((c) => c.parishes.length > 0);
        return names(level === 'city' ? cities : cities.find((c) => c.id === s.city?.id)?.parishes ?? []);
      }),
    );
  }

  /** One request per municipality, shared by its city and parish lists. */
  private municipalityCoverage(municipalityId: string): Observable<MunicipalityCoverage> {
    let request = this.coverageByMunicipality.get(municipalityId);
    if (!request) {
      request = this.coverageApi.municipality(municipalityId).pipe(shareReplay({ bufferSize: 1, refCount: false }));
      this.coverageByMunicipality.set(municipalityId, request);
    }
    return request;
  }

  private emitDelivery(): void {
    if (this.source() !== 'coverage') return;
    const parish = this.selection().parish;
    if (!parish) {
      this.deliveryChange.emit(null);
      return;
    }
    this.coverageApi
      .parish(parish.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (delivery) => this.selection().parish?.id === parish.id && this.deliveryChange.emit(delivery),
        error: () => this.deliveryChange.emit(null),
      });
  }

  /** The place picked so far, or null until every level shown and above is set. */
  private value(): LocationRef | null {
    const s = this.selection();
    const deepest = this.levels().at(-1) ?? 'municipality';
    const required = ORDER.slice(0, ORDER.indexOf(deepest) + 1);
    if (required.some((l) => !s[l])) return null;
    return {
      state: s.state!,
      municipality: s.municipality!,
      ...(s.city ? { city: s.city } : {}),
      ...(s.parish ? { parish: s.parish } : {}),
    };
  }

  private fixedSelection(): Selection {
    const fixed = this.fixed();
    return fixed ? (Object.fromEntries(ORDER.filter((l) => fixed[l]).map((l) => [l, { id: fixed[l]!.id, name: fixed[l]!.name }])) as Selection) : {};
  }

  private parentOf(level: CascadeLevel): CascadeLevel | null {
    const i = ORDER.indexOf(level);
    return i > 0 ? ORDER[i - 1] : null;
  }

  protected optionsOf(level: CascadeLevel): Option[] {
    return this.options()[level];
  }

  protected selectedId(level: CascadeLevel): string {
    return this.selection()[level]?.id ?? '';
  }

  protected requestChange(): void {
    this.changeRequested.emit();
  }
}
