# Client Phase 6 — Checkout Forms Reconnection + Vehicle Selector

> **Status:** Pending
> **Depends on:** Phase 2 (LocationService), Phase 5 (Dispatch types)
> **Blocks:** Phase 7 (Summary)
> **Estimated files:** 5
> **Verification:** `cd frontend && npx ng build` → 0 errors

---

## 1. Local Delivery Form

### File: `frontend/src/app/features/checkout/checkout-local-delivery-form/checkout-local-delivery-form.component.ts`

### 1.1 Replace Zone Loading
**Remove:** All TODO stubs referencing `branch.serviceZones`
**Add dependencies:**
```typescript
private readonly locationService = inject(LocationService);
private readonly branchZoneService = inject(BranchZoneService);
```

### 1.2 New `loadBranchZones()` Implementation
```typescript
private loadBranchZones(): void {
  const branches = this.locationService.branches();
  if (branches.length === 0) return;

  // For each branch, get its BranchZones and extract municipalities with delivery
  const requests = branches.map(b => this.branchZoneService.getByBranch(b.id));

  forkJoin(requests).subscribe({
    next: (responses) => {
      const cityMap = new Map<string, { name: string; slug: string }>();
      const muniMap = new Map<string, { name: string; slug: string; citySlug: string }>();

      for (const res of responses) {
        for (const bz of res.data || []) {
          const zone = bz.zone as any;
          const city = zone?.city as any;
          if (!city) continue;

          cityMap.set(city.slug, { name: city.name, slug: city.slug });

          for (const dc of bz.deliveryConfig) {
            if (!dc.hasDelivery) continue;
            const muni = city.municipalities?.find((m: any) => m.slug === dc.municipality);
            if (muni) {
              muniMap.set(dc.municipality, {
                name: muni.name,
                slug: muni.slug,
                citySlug: city.slug,
              });
            }
          }
        }
      }

      this.branchCities.set(Array.from(cityMap.values()));
      this.allMunicipalities.set(Array.from(muniMap.values()));
    },
  });
}
```

### 1.3 City/Municipality Cascade
```typescript
// Signal for all municipalities (with delivery)
protected readonly allMunicipalities = signal<{ name: string; slug: string; citySlug: string }[]>([]);

onCityChange(citySlug: string): void {
  const munis = this.allMunicipalities().filter(m => m.citySlug === citySlug);
  this.availableMunicipalities.set(munis.map(m => ({ code: m.slug, name: m.name })));
  const city = this.branchCities().find(c => c.slug === citySlug);
  this.selectedCityName.set(city?.name || '');
  this.form.patchValue({ municipalityCode: '' });
}
```

### 1.4 Profile Prefill Logic
- Load user profile
- If user's `municipalityCode` is in `allMunicipalities` → prefill address section
- If NOT in coverage → leave address section empty
- Personal info (name, document, phone) → always prefill if available

---

## 2. Oil Change Form + Vehicle Selection

### File: `frontend/src/app/features/checkout/checkout-oil-change-form/checkout-oil-change-form.component.ts`

### 2.1 Same Municipality Logic as Delivery
Apply same `loadBranchZones()` pattern from section 1. Oil change service is limited to coverage zone.

### 2.2 Add Vehicle Selection
```typescript
// New dependencies:
private readonly vehicleService = inject(VehicleService);
private readonly checkoutService = inject(CheckoutService);

// New signals:
protected readonly vehicles = signal<Vehicle[]>([]);
protected readonly selectedVehicle = signal<Vehicle | null>(null);
protected readonly showVehicleForm = signal(false);
protected readonly isLoadingVehicles = signal(false);
```

### 2.3 Load Vehicles
```typescript
private loadVehicles(): void {
  this.isLoadingVehicles.set(true);
  this.vehicleService.getMyVehicles(1, 50).subscribe({
    next: (res) => {
      this.vehicles.set(res.data || []);
      this.isLoadingVehicles.set(false);

      // Auto-select if only one vehicle
      if (this.vehicles().length === 1) {
        this.selectVehicle(this.vehicles()[0]);
      }
    },
    error: () => this.isLoadingVehicles.set(false),
  });
}
```

### 2.4 Vehicle Selection Methods
```typescript
selectVehicle(vehicle: Vehicle): void {
  this.selectedVehicle.set(vehicle);
  this.checkoutService.selectVehicle(vehicle);
  this.showVehicleForm.set(false);
}

openVehicleForm(): void {
  this.showVehicleForm.set(true);
}

onVehicleCreated(vehicle: Vehicle): void {
  this.vehicles.update(v => [...v, vehicle]);
  this.selectVehicle(vehicle);
}
```

### 2.5 Template — Vehicle Section
```html
<!-- Vehicle Selection Section -->
<section class="form-section">
  <h3>Datos del Vehículo</h3>

  @if (isLoadingVehicles()) {
    <spinner />
  } @else if (selectedVehicle(); as vehicle) {
    <!-- Selected Vehicle Card (read-only) -->
    <div class="vehicle-selected-card">
      <div class="vehicle-info">
        <span class="vehicle-name">{{ vehicle.marca }} {{ vehicle.modelo }} {{ vehicle.year }}</span>
        <span class="vehicle-plate">{{ vehicle.placa }}</span>
        <span class="vehicle-engine">
          {{ vehicle.engineType.displacement }} {{ vehicle.engineType.fuelType }}
          {{ vehicle.engineType.cylinders }} cil.
        </span>
      </div>
      <button type="button" (click)="selectedVehicle.set(null)">Cambiar</button>
    </div>
  } @else {
    <!-- Vehicle Dropdown -->
    @if (vehicles().length > 0) {
      <div class="vehicle-list">
        @for (v of vehicles(); track v.id) {
          <button type="button" class="vehicle-option" (click)="selectVehicle(v)">
            {{ v.marca }} {{ v.modelo }} {{ v.year }} — {{ v.placa }}
          </button>
        }
      </div>
    }
    <button type="button" class="btn-add-vehicle" (click)="openVehicleForm()">
      + Agregar nuevo vehículo
    </button>
  }

  @if (showVehicleForm()) {
    <!-- Inline Vehicle Form (reuse VehicleFormComponent) -->
    <app-vehicle-form
      [inline]="true"
      (saved)="onVehicleCreated($event)"
      (cancelled)="showVehicleForm.set(false)"
    />
  }
</section>
```

### 2.6 Submit Validation
```typescript
onSubmit(): void {
  if (this.oilChangeForm.invalid) { /* ... */ }

  // Validate vehicle is selected
  if (!this.selectedVehicle()) {
    this.errorMessage.set('Debes seleccionar un vehículo');
    return;
  }

  // ... build OilChangeServiceInfo and save
}
```

### 2.7 VehicleFormComponent — Add `inline` Mode
May need to add `@Input() inline = false` to the existing VehicleFormComponent in garage to:
- Hide navigation elements when inline
- Emit `saved` event with created vehicle
- Show cancel button

---

## 3. Shipping Form

### File: `frontend/src/app/features/checkout/checkout-shipping-form/checkout-shipping-form.component.ts`

### 3.1 Replace State/City Loading
**Remove:** All TODO stubs referencing `loadReferenceStates()`
**Add dependency:**
```typescript
private readonly cityService = inject(CityService);
```

### 3.2 New Loading Logic
```typescript
private loadCities(): void {
  this.cityService.getAll().subscribe({
    next: (res) => {
      // Cities from backend have { name, slug, municipalities[] }
      // Map to dropdown format: { code: slug, name: name }
      const cities = (res.data || []).map(c => ({
        code: c.slug,
        name: c.name,
        municipalities: c.municipalities.map(m => ({
          code: m.slug,
          name: m.name,
        })),
      }));
      this.referenceCities.set(cities);
    },
  });
}
```

### 3.3 No Zone Restriction
- Shipping form shows ALL 18 cities (national coverage)
- All municipalities available (no delivery filter)
- This is for shipping agency, which reaches anywhere

### 3.4 City → Municipality Cascade
```typescript
onStateChange(cityCode: string): void {
  const city = this.referenceCities().find(c => c.code === cityCode);
  if (city) {
    this.availableMunicipalities.set(city.municipalities);
    this.selectedCityName.set(city.name);
  } else {
    this.availableMunicipalities.set([]);
  }
  this.form.patchValue({ municipalityCode: '' });
}
```

### 3.5 Profile Prefill
- Always prefill from user profile (no zone restriction)
- Personal info always prefillable
- Address info always prefillable (national reach)

---

## 4. Verification Checklist

| Check | Expected |
|-------|----------|
| `ng build` | 0 errors |
| Local delivery form → municipalities | Only municipalities with delivery in coverage zone |
| Oil change form → municipalities | Same coverage zone filter |
| Oil change form → vehicle selection | Shows user's vehicles from garage |
| Oil change form → add vehicle | Inline form, creates vehicle, auto-selects |
| Oil change form → submit without vehicle | Error message shown |
| Shipping form → cities | All 18 Venezuelan cities shown |
| Shipping form → municipalities | All municipalities of selected city |
| Shipping form → prefill from profile | Always works (no zone restriction) |
| Delivery form → prefill from profile | Only if address in coverage zone |

---

## 5. Data Flow Summary

```
Local Delivery:
  LocationService.branches → BranchZoneService.getByBranch() → filter hasDelivery
  → build city/municipality dropdown → user fills form → CheckoutService.setLocalDeliveryRecipientInfo()

Oil Change:
  Same as delivery + VehicleService.getMyVehicles() → vehicle selector
  → user fills form + selects vehicle → CheckoutService.setOilChangeServiceInfo() + selectVehicle()

Shipping:
  CityService.getAll() → all 18 cities → all municipalities
  → user fills form → CheckoutService.setShippingRecipientInfo()
```
