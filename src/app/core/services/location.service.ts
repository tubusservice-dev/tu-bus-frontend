import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { ANALYTICS } from '@platform';
import { forkJoin } from 'rxjs';
import { BranchZoneService } from './branch-zone.service';
import { ScheduleDay, Coordinates } from '../../models/branch.model';

// ============================================
// INTERFACES
// ============================================

export interface UserLocation {
  citySlug: string;
  cityName: string;
  municipalitySlug: string;
  municipalityName: string;
}

export interface BranchSummary {
  id: string;
  name: string;
  address: string;
  whatsappPhone: string;
  schedule: ScheduleDay[];
  coordinates?: Coordinates;
  hasInStoreOilChange: boolean;
}

export interface DeliveryConfigResolved {
  hasDelivery: boolean;
  freeDelivery: boolean;
  deliveryCharge: number;
}

// ============================================
// CONSTANTS
// ============================================

const STORAGE_KEY = 'user_location';

// ============================================
// SERVICE
// ============================================

/**
 * Central singleton that manages the user's selected geographic location.
 * Persists in localStorage. Resolves branches and delivery config from backend.
 * Every zone-aware component consumes this service.
 */
@Injectable({
  providedIn: 'root',
})
export class LocationService {
  private readonly branchZoneService = inject(BranchZoneService);
  private readonly analytics = inject(ANALYTICS);

  // ==================== PRIVATE STATE ====================

  private readonly _location = signal<UserLocation | null>(null);
  private readonly _branches = signal<BranchSummary[]>([]);
  private readonly _deliveryConfig = signal<DeliveryConfigResolved | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _isResolved = signal(false);

  // ==================== PUBLIC READONLY ====================

  readonly location = this._location.asReadonly();
  readonly branches = this._branches.asReadonly();
  readonly deliveryConfig = this._deliveryConfig.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isResolved = this._isResolved.asReadonly();

  // ==================== COMPUTED ====================

  /** Whether a location has been selected */
  readonly hasLocation = computed(() => this._location() !== null);

  /** Whether any branch serves the selected location */
  readonly hasCoverage = computed(() => this._branches().length > 0);

  /** Whether delivery is available for the selected municipality */
  readonly hasDelivery = computed(() => this._deliveryConfig()?.hasDelivery ?? false);

  /** Whether any branch in the zone offers in-store oil change */
  readonly hasInStoreOilChange = computed(() =>
    this._branches().some((b) => b.hasInStoreOilChange)
  );

  /** Branches that offer in-store oil change */
  readonly branchesWithOilChange = computed(() =>
    this._branches().filter((b) => b.hasInStoreOilChange)
  );

  /** Array of branch IDs for product filtering */
  readonly branchIds = computed(() => this._branches().map((b) => b.id));

  /** Display label: "Municipio, Ciudad" */
  readonly locationLabel = computed(() => {
    const loc = this._location();
    if (!loc) return '';
    return `${loc.municipalityName}, ${loc.cityName}`;
  });

  // ==================== CONSTRUCTOR ====================

  constructor() {
    const saved = this.loadFromStorage();
    if (saved) {
      this._location.set(saved);
      this.resolveLocation(saved.citySlug, saved.municipalitySlug);
    } else {
      // No saved location — mark as resolved immediately so consumers don't hang
      this._isResolved.set(true);
    }

    // Tag every analytics event with the user's zone + primary branch so all
    // reports can be segmented by location. Re-runs whenever the user changes
    // zone. Requires `zone` / `branch` custom dimensions registered in GA4.
    effect(() => {
      const zone = this.locationLabel();
      const branch = this.branchIds()[0] ?? null;
      void this.analytics.setUserProperty('zone', zone || null);
      void this.analytics.setUserProperty('branch', branch);
    });
  }

  // ==================== PUBLIC METHODS ====================

  /**
   * Set user location and resolve branches + delivery config from backend.
   * Does NOT clear cart — caller must handle that before calling this.
   */
  setLocation(
    citySlug: string,
    cityName: string,
    municipalitySlug: string,
    municipalityName: string
  ): void {
    const location: UserLocation = {
      citySlug,
      cityName,
      municipalitySlug,
      municipalityName,
    };
    this._location.set(location);
    this.saveToStorage(location);
    this.resolveLocation(citySlug, municipalitySlug);
  }

  /**
   * Clear location, branches, and delivery config.
   * Does NOT clear cart — caller must handle that.
   */
  clearLocation(): void {
    this._location.set(null);
    this._branches.set([]);
    this._deliveryConfig.set(null);
    this._isResolved.set(false);
    localStorage.removeItem(STORAGE_KEY);
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Resolve branches and delivery config from backend.
   * Called on setLocation() and on app init if localStorage has data.
   */
  private resolveLocation(citySlug: string, municipalitySlug: string): void {
    this._isLoading.set(true);
    this._isResolved.set(false);

    forkJoin({
      locationRes: this.branchZoneService.findByLocation(citySlug, municipalitySlug),
      deliveryRes: this.branchZoneService.getDeliveryConfig(citySlug, municipalitySlug),
    }).subscribe({
      next: ({ locationRes, deliveryRes }) => {
        // Map branches from API response
        const branches: BranchSummary[] = (locationRes.data || []).map((b: any) => ({
          id: b._id || b.id,
          name: b.name,
          address: b.address,
          whatsappPhone: b.whatsappPhone,
          schedule: b.schedule || [],
          coordinates: b.coordinates,
          hasInStoreOilChange: b.hasInStoreOilChange ?? false,
        }));

        this._branches.set(branches);

        // Map delivery config
        const dc = deliveryRes.data;
        if (dc) {
          this._deliveryConfig.set({
            hasDelivery: dc.hasDelivery,
            freeDelivery: dc.freeDelivery,
            deliveryCharge: dc.deliveryCharge,
          });
        } else {
          this._deliveryConfig.set(null);
        }

        this._isLoading.set(false);
        this._isResolved.set(true);
      },
      error: () => {
        this._branches.set([]);
        this._deliveryConfig.set(null);
        this._isLoading.set(false);
        this._isResolved.set(true);
      },
    });
  }

  // ==================== STORAGE ====================

  private saveToStorage(location: UserLocation): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
  }

  private loadFromStorage(): UserLocation | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
