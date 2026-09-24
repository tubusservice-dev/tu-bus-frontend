import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { ANALYTICS } from '@platform';
import { GeoPlace, MunicipalityCoverage } from '@models/geo.model';
import { GeoService } from './geo.service';
import { CoverageService } from './coverage.service';
import { BranchService } from './branch.service';

/**
 * - `undecided`: nothing chosen yet (the selector should ask).
 * - `browsing`: the customer chose to look around without a location.
 * - `selected`: a state and municipality are set.
 */
export type LocationStatus = 'undecided' | 'browsing' | 'selected';

/** The customer's place: a municipality of a state (ubicaciones v2). */
export interface SelectedLocation {
  state: Pick<GeoPlace, 'id' | 'name'>;
  municipality: Pick<GeoPlace, 'id' | 'name'>;
}

interface StoredLocation {
  status: LocationStatus;
  stateId?: string;
  stateName?: string;
  municipalityId?: string;
  municipalityName?: string;
}

const STORAGE_KEY = 'user_location_v2';
/** `{ citySlug, municipalitySlug, … }` saved by the previous version, moved to v2 once. */
const LEGACY_STORAGE_KEY = 'user_location';

/**
 * The customer's location and what it gives access to: the branches serving
 * it and the delivery terms there. Every zone-aware screen reads it.
 *
 * Persisted in localStorage and read synchronously, so the first render
 * already knows whether there is a location. A location saved by the
 * previous version is translated once through the server and saved again.
 */
@Injectable({ providedIn: 'root' })
export class LocationStore {
  private readonly geo = inject(GeoService);
  private readonly coverageApi = inject(CoverageService);
  private readonly analytics = inject(ANALYTICS);
  private readonly branchService = inject(BranchService);

  private readonly _status = signal<LocationStatus>('undecided');
  private readonly _location = signal<SelectedLocation | null>(null);
  private readonly _coverage = signal<MunicipalityCoverage | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _isResolved = signal(false);
  /** Every active branch, fetched once for customers without a location. */
  private readonly _activeBranchIds = signal<string[] | null>(null);
  /** Drops answers to requests a newer choice has made stale. */
  private requestSeq = 0;

  readonly status = this._status.asReadonly();
  readonly location = this._location.asReadonly();
  readonly coverage = this._coverage.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  /** False while a location is being restored or its coverage fetched. */
  readonly isResolved = this._isResolved.asReadonly();

  readonly hasLocation = computed(() => this._status() === 'selected');
  readonly branches = computed(() => this._coverage()?.branches ?? []);
  readonly branchIds = computed(() => this.branches().map((b) => b.id));
  readonly hasCoverage = computed(() => this.branches().length > 0);
  readonly hasInStoreOilChange = computed(() => this.branches().some((b) => b.hasInStoreOilChange));
  readonly branchesWithOilChange = computed(() => this.branches().filter((b) => b.hasInStoreOilChange));
  readonly deliveryStatus = computed(() => this._coverage()?.deliveryStatus ?? 'none');
  readonly minDeliveryCharge = computed(() => this._coverage()?.minDeliveryCharge ?? null);
  readonly allFree = computed(() => this._coverage()?.allFree ?? false);

  /**
   * The branches whose stock the store shows: the zone's once a location is
   * set, every active branch while the customer explores without one (what
   * any branch has can still be picked up or shipped by agency).
   */
  readonly stockBranchIds = computed(() => (this.hasLocation() ? this.branchIds() : this._activeBranchIds() ?? []));

  /** "Chacao, Miranda". */
  readonly locationLabel = computed(() => {
    const location = this._location();
    return location ? `${location.municipality.name}, ${location.state.name}` : '';
  });

  constructor() {
    this.restore();

    // Tag every analytics event with the user's zone + primary branch so all
    // reports can be segmented by location. Requires the `zone` / `branch`
    // custom dimensions registered in GA4.
    effect(() => {
      void this.analytics.setUserProperty('zone', this.locationLabel() || null);
      void this.analytics.setUserProperty('branch', this.branchIds()[0] ?? null);
    });
  }

  /**
   * Sets the customer's municipality. `coverage`, when the caller already
   * fetched it (to review the cart first), is used as is; otherwise it is
   * fetched. Does not touch the cart.
   */
  setLocation(state: Pick<GeoPlace, 'id' | 'name'>, municipality: Pick<GeoPlace, 'id' | 'name'>, coverage?: MunicipalityCoverage): void {
    const location: SelectedLocation = { state: { id: state.id, name: state.name }, municipality: { id: municipality.id, name: municipality.name } };
    this._status.set('selected');
    this._location.set(location);
    this.write({ status: 'selected', stateId: state.id, stateName: state.name, municipalityId: municipality.id, municipalityName: municipality.name });
    if (coverage) {
      this.requestSeq++;
      this.finish(coverage);
    } else {
      this.fetchCoverage(municipality.id);
    }
  }

  /** The customer looks around without a location. */
  browseWithoutLocation(): void {
    this.requestSeq++;
    this._status.set('browsing');
    this._location.set(null);
    this.write({ status: 'browsing' });
    this.resolveWithoutLocation();
  }

  // ==================== internals ====================

  private restore(): void {
    const saved = this.read<StoredLocation>(STORAGE_KEY);
    if (saved?.status === 'selected' && saved.stateId && saved.municipalityId) {
      this._status.set('selected');
      this._location.set({
        state: { id: saved.stateId, name: saved.stateName ?? '' },
        municipality: { id: saved.municipalityId, name: saved.municipalityName ?? '' },
      });
      this.fetchCoverage(saved.municipalityId);
      return;
    }
    if (saved?.status === 'browsing') {
      this._status.set('browsing');
      this.resolveWithoutLocation();
      return;
    }

    const legacy = this.read<{ citySlug?: string; municipalitySlug?: string }>(LEGACY_STORAGE_KEY);
    if (legacy?.citySlug && legacy.municipalitySlug) {
      this.migrateLegacy(legacy.citySlug, legacy.municipalitySlug);
      return;
    }
    this.resolveWithoutLocation();
  }

  /** Moves a location saved by the previous version. Kept for a later try if the server cannot be reached. */
  private migrateLegacy(citySlug: string, municipalitySlug: string): void {
    const seq = this.startRequest();
    this.geo.legacyResolve(citySlug, municipalitySlug).subscribe({
      next: (hit) => {
        if (seq !== this.requestSeq) return;
        this.remove(LEGACY_STORAGE_KEY);
        if (hit) this.setLocation(hit.state, hit.municipality);
        else this.resolveWithoutLocation();
      },
      error: () => seq === this.requestSeq && this.resolveWithoutLocation(),
    });
  }

  /** No location: resolved once the active branches are known (fetched a single time). */
  private resolveWithoutLocation(): void {
    this._coverage.set(null);
    if (this._activeBranchIds() !== null) {
      this.requestSeq++;
      this.finish(null);
      return;
    }
    const seq = this.startRequest();
    this.branchService.getActive().subscribe({
      next: (res) => {
        this._activeBranchIds.set((res.data ?? []).map((b) => b.id));
        if (seq === this.requestSeq) this.finish(null);
      },
      error: () => seq === this.requestSeq && this.finish(null),
    });
  }

  private fetchCoverage(municipalityId: string): void {
    const seq = this.startRequest();
    this.coverageApi.municipality(municipalityId).subscribe({
      next: (coverage) => seq === this.requestSeq && this.finish(coverage),
      error: () => seq === this.requestSeq && this.finish(null),
    });
  }

  private startRequest(): number {
    this._isLoading.set(true);
    this._isResolved.set(false);
    return ++this.requestSeq;
  }

  private finish(coverage: MunicipalityCoverage | null): void {
    this._coverage.set(coverage);
    this._isLoading.set(false);
    this._isResolved.set(true);
  }

  // Storage can throw (private mode, blocked site data): the location then
  // lives for the session only, which is still better than failing.
  private write(value: StoredLocation | null): void {
    try {
      if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* session-only */
    }
  }

  private read<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* nothing to clean */
    }
  }
}
