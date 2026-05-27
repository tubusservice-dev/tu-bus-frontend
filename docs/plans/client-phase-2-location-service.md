# Client Phase 2 — LocationService + Frontend Services

> **Status:** Pending
> **Depends on:** Phase 1 (backend endpoints)
> **Blocks:** Phase 3 (Zoning Modal), Phase 4 (Catalog), Phase 5 (Checkout Dispatch)
> **Estimated files:** 5
> **Verification:** `cd frontend && npx ng build` → 0 errors

---

## 1. Create LocationService (NEW FILE)

### File: `frontend/src/app/core/services/location.service.ts`

**Purpose:** Central singleton that manages the user's selected geographic location. Every component that needs zone-aware data consumes this service. Persists selection in localStorage so it survives page reloads.

### 1.1 State Shape
```typescript
interface UserLocation {
  citySlug: string;
  cityName: string;
  municipalitySlug: string;
  municipalityName: string;
}

interface BranchSummary {
  id: string;
  name: string;
  address: string;
  whatsappPhone: string;
  schedule: ScheduleDay[];
  coordinates?: Coordinates;
  hasInStoreOilChange: boolean;
}

interface DeliveryConfigResolved {
  hasDelivery: boolean;
  freeDelivery: boolean;
  deliveryCharge: number;
}
```

### 1.2 Signals
```typescript
// Private writable
private readonly _location = signal<UserLocation | null>(null);
private readonly _branches = signal<BranchSummary[]>([]);
private readonly _deliveryConfig = signal<DeliveryConfigResolved | null>(null);
private readonly _isLoading = signal(false);
private readonly _isResolved = signal(false);

// Public readonly
readonly location = this._location.asReadonly();
readonly branches = this._branches.asReadonly();
readonly deliveryConfig = this._deliveryConfig.asReadonly();
readonly isLoading = this._isLoading.asReadonly();
readonly isResolved = this._isResolved.asReadonly();
```

### 1.3 Computed Properties
```typescript
readonly hasLocation = computed(() => this._location() !== null);
readonly hasCoverage = computed(() => this._branches().length > 0);
readonly hasDelivery = computed(() => this._deliveryConfig()?.hasDelivery ?? false);
readonly hasInStoreOilChange = computed(() =>
  this._branches().some(b => b.hasInStoreOilChange)
);
readonly branchesWithOilChange = computed(() =>
  this._branches().filter(b => b.hasInStoreOilChange)
);
readonly branchIds = computed(() => this._branches().map(b => b.id));
readonly locationLabel = computed(() => {
  const loc = this._location();
  if (!loc) return '';
  return `${loc.municipalityName}, ${loc.cityName}`;
});
```

### 1.4 Methods
```typescript
/**
 * Set user location and resolve branches + delivery config.
 * Clears previous data before resolving.
 */
setLocation(citySlug: string, cityName: string, municipalitySlug: string, municipalityName: string): void {
  const location: UserLocation = { citySlug, cityName, municipalitySlug, municipalityName };
  this._location.set(location);
  this.saveToStorage(location);
  this.resolveLocation(citySlug, municipalitySlug);
}

/**
 * Clear location, branches, delivery config.
 * Does NOT clear cart — caller must handle that.
 */
clearLocation(): void {
  this._location.set(null);
  this._branches.set([]);
  this._deliveryConfig.set(null);
  this._isResolved.set(false);
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Resolve branches and delivery config from backend.
 * Called on setLocation() and on app init if localStorage has data.
 */
private resolveLocation(citySlug: string, municipalitySlug: string): void {
  this._isLoading.set(true);
  this._isResolved.set(false);

  forkJoin({
    branches: this.branchZoneService.findByLocation(citySlug, municipalitySlug),
    deliveryConfig: this.branchZoneService.getDeliveryConfig(citySlug, municipalitySlug),
  }).subscribe({
    next: ({ branches, deliveryConfig }) => {
      this._branches.set(branches.data || []);
      this._deliveryConfig.set(deliveryConfig.data
        ? { hasDelivery: deliveryConfig.data.hasDelivery, freeDelivery: deliveryConfig.data.freeDelivery, deliveryCharge: deliveryConfig.data.deliveryCharge }
        : null
      );
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
```

### 1.5 Constructor (Auto-restore)
```typescript
constructor() {
  const saved = this.loadFromStorage();
  if (saved) {
    this._location.set(saved);
    this.resolveLocation(saved.citySlug, saved.municipalitySlug);
  }
}
```

### 1.6 localStorage Helpers
```typescript
private readonly STORAGE_KEY = 'user_location';

private saveToStorage(location: UserLocation): void {
  localStorage.setItem(this.STORAGE_KEY, JSON.stringify(location));
}

private loadFromStorage(): UserLocation | null {
  try {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
```

### 1.7 Dependencies
```typescript
private readonly branchZoneService = inject(BranchZoneService);
```

---

## 2. Add Public Methods to BranchZoneService

### File: `frontend/src/app/core/services/branch-zone.service.ts`

**Action:** Add 2 new methods that call the public endpoints (no auth required)

```typescript
private readonly publicUrl = `${environment.apiUrl}/branch-zones`;

/**
 * Find branches serving a geographic location (public, no auth).
 */
findByLocation(citySlug: string, municipality?: string): Observable<any> {
  let params = new HttpParams().set('citySlug', citySlug);
  if (municipality) {
    params = params.set('municipality', municipality);
  }
  return this.http.get<any>(`${this.publicUrl}/by-location`, { params });
}

/**
 * Get delivery configuration for a location (public, no auth).
 */
getDeliveryConfig(citySlug: string, municipality: string): Observable<any> {
  const params = new HttpParams()
    .set('citySlug', citySlug)
    .set('municipality', municipality);
  return this.http.get<any>(`${this.publicUrl}/delivery-config`, { params });
}
```

---

## 3. Add `branchIds` to ProductService

### File: `frontend/src/app/core/services/product.service.ts`

**Action:** Add `branchIds` to the query params builder

Find where `HttpParams` is built for `getAll()` and add:
```typescript
if (params.branchIds) {
  httpParams = httpParams.set('branchIds', params.branchIds);
}
```

Also add to the `ProductQueryParams` interface (if defined here or in model):
```typescript
branchIds?: string;  // comma-separated
```

---

## 4. Add Public Stock Method to BranchProductService

### File: `frontend/src/app/core/services/branch-product.service.ts`

**Action:** Add public method for aggregated stock

```typescript
private readonly publicUrl = `${environment.apiUrl}/branch-products`;

/**
 * Get aggregated stock for a product across specific branches (public).
 */
getAggregatedStock(productId: string, branchIds: string[]): Observable<any> {
  const params = new HttpParams()
    .set('productId', productId)
    .set('branchIds', branchIds.join(','));
  return this.http.get<any>(`${this.publicUrl}/stock`, { params });
}
```

---

## 5. Export LocationService

### File: `frontend/src/app/core/services/index.ts`

**Action:** Add export
```typescript
export { LocationService } from './location.service';
```

---

## 6. Verification Checklist

| Check | Expected |
|-------|----------|
| `ng build` | 0 errors |
| LocationService injectable | `providedIn: 'root'` |
| LocationService auto-restores on init | Reads localStorage, calls backend |
| `branchIds` computed updates after resolve | Array of branch ID strings |
| `hasCoverage` false when no branches | Boolean |
| `hasDelivery` reads from deliveryConfig | Boolean |
| `hasInStoreOilChange` checks any branch | Boolean |
| `locationLabel` format | "Municipio, Ciudad" |
| `clearLocation()` removes localStorage | Key removed |

---

## 7. Consumers (Who Uses LocationService)

| Phase | Component | Property Used |
|-------|-----------|---------------|
| 3 | `tubus-header` | `hasLocation`, `locationLabel`, `clearLocation()` |
| 3 | `zoning-modal` | `setLocation()` |
| 4 | `catalog` | `branchIds`, `hasLocation` |
| 4 | `product-card` | (indirectly via catalog) |
| 4 | `product-detail` | `branchIds` |
| 5 | `checkout.service` | `hasCoverage`, `hasDelivery`, `hasInStoreOilChange`, `branches`, `deliveryConfig` |
| 6 | `checkout-local-delivery-form` | `branches` |
| 6 | `checkout-oil-change-form` | `branches` |
| 7 | `checkout-summary` | `branches`, `branchesWithOilChange` |
