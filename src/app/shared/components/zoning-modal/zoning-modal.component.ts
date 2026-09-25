import { Component, DestroyRef, HostListener, OnDestroy, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, of, switchMap } from 'rxjs';
import { ANALYTICS } from '@platform';
import { GeoService } from '@core/services/geo.service';
import { GeoCoverageState, GeoPlace, GeoSearchHit } from '@models/geo.model';
import { BodyScrollLockService } from '../../services/body-scroll-lock.service';
import { ZoningStateStepComponent } from './zoning-state-step/zoning-state-step.component';
import { ZoningMunicipalityStepComponent } from './zoning-municipality-step/zoning-municipality-step.component';
import { dismissOnBack } from '@core/services/back-dismiss.service';

type ModalStep = 'state' | 'municipality';

/** A municipality picked in the modal, with its state. */
export interface ZonePick {
  state: Pick<GeoPlace, 'id' | 'name'>;
  municipality: Pick<GeoPlace, 'id' | 'name'>;
}

/**
 * Where the customer is: a state, then a municipality, among the places with
 * service today (or straight to a municipality through the search box).
 *
 * Never mandatory: ✕, a click outside or Escape close it, and "Ahora no" lets
 * the customer explore without a location. It only reports what happened;
 * the parent decides (it checks the cart before applying a new place).
 */
@Component({
  selector: 'app-zoning-modal',
  standalone: true,
  imports: [ZoningStateStepComponent, ZoningMunicipalityStepComponent],
  templateUrl: './zoning-modal.component.html',
  styleUrl: './zoning-modal.component.scss',
})
export class ZoningModalComponent implements OnDestroy {
  private readonly geo = inject(GeoService);
  private readonly scrollLock = inject(BodyScrollLockService);
  private readonly analytics = inject(ANALYTICS);
  private readonly destroyRef = inject(DestroyRef);
  private hasScrollLock = false;

  readonly isOpen = input(false);
  /** The parent is checking the picked place: the modal waits, frozen. */
  readonly busy = input(false);
  /**
   * Whether the customer already has a location. The way out then reads
   * "Quitar mi ubicación" instead of "Ahora no, solo quiero explorar"; both
   * leave the customer browsing the whole store.
   */
  readonly hasLocation = input(false);
  /** The customer's current state and municipality, highlighted in the lists. */
  readonly currentStateId = input<string | null>(null);
  readonly currentMunicipalityId = input<string | null>(null);

  readonly picked = output<ZonePick>();
  readonly explore = output<void>();
  readonly closed = output<void>();

  protected readonly step = signal<ModalStep>('state');
  protected readonly tree = signal<GeoCoverageState[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly selectedState = signal<GeoCoverageState | null>(null);
  protected readonly query = signal('');
  protected readonly hits = signal<GeoSearchHit[] | null>(null);
  protected readonly searching = signal(false);

  private readonly search$ = new Subject<string>();

  constructor() {
    // The Android back button closes this modal like its ✕ does.
    dismissOnBack(() => this.isOpen(), () => this.close());

    effect(() => {
      const open = this.isOpen();
      if (open && !this.hasScrollLock) {
        this.scrollLock.lock();
        this.hasScrollLock = true;
      } else if (!open && this.hasScrollLock) {
        this.scrollLock.unlock();
        this.hasScrollLock = false;
      }
      if (open) untracked(() => this.start());
    });

    // Each step as its own screen, so analytics shows where customers drop off.
    effect(() => {
      if (this.isOpen()) void this.analytics.setScreen(`zoning_${this.step()}`);
    });

    this.search$
      .pipe(
        switchMap((q) => (q.length < 2 ? of(null) : this.geo.search(q, true).pipe(catchError(() => of([]))))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((hits) => {
        this.hits.set(hits);
        this.searching.set(false);
      });
  }

  ngOnDestroy(): void {
    if (this.hasScrollLock) this.scrollLock.unlock();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.isOpen()) this.close();
  }

  // ==================== steps ====================

  protected onQuery(q: string): void {
    const term = q.trim();
    this.query.set(term);
    this.searching.set(term.length >= 2);
    this.search$.next(term);
  }

  protected chooseState(entry: GeoCoverageState): void {
    this.selectedState.set(entry);
    this.step.set('municipality');
  }

  protected chooseMunicipality(municipality: GeoPlace): void {
    const entry = this.selectedState();
    if (entry) this.picked.emit({ state: entry.state, municipality });
  }

  protected chooseHit(hit: GeoSearchHit): void {
    this.picked.emit({ state: hit.state, municipality: hit.municipality });
  }

  protected backToStates(): void {
    this.selectedState.set(null);
    this.step.set('state');
  }

  protected close(): void {
    if (!this.busy()) this.closed.emit();
  }

  protected loadTree(): void {
    this.isLoading.set(true);
    this.loadFailed.set(false);
    this.geo
      .coverageTree()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tree) => {
          this.tree.set(tree);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          this.loadFailed.set(true);
        },
      });
  }

  /** Every opening starts at the first step, with fresh coverage. */
  private start(): void {
    this.step.set('state');
    this.selectedState.set(null);
    this.query.set('');
    this.hits.set(null);
    this.searching.set(false);
    this.loadTree();
  }
}
