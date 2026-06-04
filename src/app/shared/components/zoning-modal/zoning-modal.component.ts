import { Component, inject, signal, computed, input, output, effect, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CityService } from '../../../core/services/city.service';
import { LocationService } from '../../../core/services/location.service';
import { City, Municipality } from '../../../models/city.model';
import { SearchInputComponent } from '../search-input/search-input.component';
import { BodyScrollLockService } from '../../services/body-scroll-lock.service';
import { ANALYTICS } from '@platform';

type ModalStep = 'city' | 'municipality' | 'no-coverage';

@Component({
  selector: 'app-zoning-modal',
  standalone: true,
  imports: [CommonModule, SearchInputComponent],
  templateUrl: './zoning-modal.component.html',
  styleUrl: './zoning-modal.component.scss',
})
export class ZoningModalComponent implements OnInit, OnDestroy {
  private readonly cityService = inject(CityService);
  protected readonly locationService = inject(LocationService);
  private readonly scrollLock = inject(BodyScrollLockService);
  private readonly analytics = inject(ANALYTICS);
  private hasScrollLock = false;

  // ==================== INPUTS / OUTPUTS ====================

  /** Whether the modal is open (controlled from parent) */
  readonly isOpen = input(false);

  /** If true, user cannot dismiss without selecting a location */
  readonly mandatory = input(false);

  /** Emitted when the modal closes */
  readonly closed = output<void>();

  // ==================== STATE ====================

  protected readonly step = signal<ModalStep>('city');
  protected readonly cities = signal<City[]>([]);
  protected readonly selectedCity = signal<City | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly isResolving = signal(false);
  protected readonly searchTerm = signal('');

  // ==================== COMPUTED ====================

  /** Cities filtered by search term */
  protected readonly filteredCities = computed(() => {
    const all = this.cities();
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return all;
    return all.filter((c) => c.name.toLowerCase().includes(term));
  });

  /** Municipalities of the selected city */
  protected readonly municipalities = computed<Municipality[]>(() => {
    const city = this.selectedCity();
    return city?.municipalities || [];
  });

  constructor() {
    // Lock/unlock body scroll when modal opens/closes
    effect(() => {
      if (this.isOpen() && !this.hasScrollLock) {
        this.scrollLock.lock();
        this.hasScrollLock = true;
      } else if (!this.isOpen() && this.hasScrollLock) {
        this.scrollLock.unlock();
        this.hasScrollLock = false;
      }
    });

    // Track each step of the mandatory zone selection as its own screen so
    // GA4 reveals where users drop off (city pick vs municipality vs the
    // no-coverage dead-end). Re-runs whenever the modal opens or the step
    // advances.
    effect(() => {
      if (!this.isOpen()) return;
      void this.analytics.setScreen(`zoning_${this.step().replace('-', '_')}`);
    });

    // Watch for location resolution to close modal or show no-coverage
    effect(() => {
      if (!this.isResolving()) return;
      if (!this.locationService.isResolved()) return;

      this.isResolving.set(false);

      if (this.locationService.hasCoverage()) {
        this.closed.emit();
      } else {
        this.step.set('no-coverage');
      }
    });
  }

  // ==================== LIFECYCLE ====================

  ngOnInit(): void {
    this.loadCities();
  }

  ngOnDestroy(): void {
    if (this.hasScrollLock) {
      this.scrollLock.unlock();
      this.hasScrollLock = false;
    }
  }

  // ==================== METHODS ====================

  private loadCities(): void {
    this.isLoading.set(true);
    this.cityService.getWithCoverage().subscribe({
      next: (res) => {
        this.cities.set(res.data || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.cities.set([]);
        this.isLoading.set(false);
      },
    });
  }

  protected selectCity(city: City): void {
    this.selectedCity.set(city);
    this.searchTerm.set('');
    this.step.set('municipality');
  }

  protected selectMunicipality(municipality: Municipality): void {
    const city = this.selectedCity();
    if (!city) return;

    this.isResolving.set(true);
    this.locationService.setLocation(
      city.slug,
      city.name,
      municipality.slug,
      municipality.name
    );
  }

  protected backToCity(): void {
    this.selectedCity.set(null);
    this.searchTerm.set('');
    this.step.set('city');
  }

  protected continueWithoutCoverage(): void {
    // Location is already saved in LocationService (hasCoverage = false)
    this.closed.emit();
  }

  protected closeModal(): void {
    // Prevent closing if mandatory and no location selected
    if (this.mandatory() && !this.locationService.hasLocation()) {
      return;
    }
    this.closed.emit();
  }

  protected onSearchInput(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }
}
