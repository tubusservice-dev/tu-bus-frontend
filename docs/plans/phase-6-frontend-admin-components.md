# Phase 6: Frontend — Admin Components

> **Prerequisites:** Phase 5 (all models and services must exist)
> **Reference:** `docs/features/zones-branches-products-architecture.md` sections 4, 11

---

## Objective

Refactor all admin components (zones, branches, products) to use the new data model with pivot collections. This is the UI layer that ties everything together.

**Execution order:** Zones → Branches → Products (each depends on the previous).

---

## Part A: Zone Components

### Step A.1: Rewrite `zone-form.component.ts` (REWRITE)

**Current file:** `frontend/src/app/features/admin/zones/zone-form/zone-form.component.ts`

**DELETE all current logic** (state selection, reference cities, municipality CRUD).

**New component state (signals):**
```typescript
// Route & mode
zoneId = signal<string | null>(null);
isEditMode = signal(false);

// Loading states
isLoading = signal(false);
isSubmitting = signal(false);
errorMessage = signal<string | null>(null);
successMessage = signal<string | null>(null);

// Data
cities = signal<City[]>([]);               // from CityService.getAll()
selectedCity = signal<City | null>(null);   // picked from dropdown
selectedMunicipalities = signal<string[]>([]); // checked slugs

// Name validation
nameExists = signal(false);
isCheckingName = signal(false);

// Form (Reactive)
form = new FormGroup({
  name: new FormControl('', [Validators.required, Validators.minLength(2)]),
  isActive: new FormControl(true),
});
```

**Injected services:**
```typescript
private readonly cityService = inject(CityService);
private readonly zoneService = inject(ZoneService);
private readonly router = inject(Router);
private readonly route = inject(ActivatedRoute);
```

**Key methods:**

```
ngOnInit():
  → Load cities: cityService.getAll()
  → Check route param 'id': if present, enter edit mode → loadZone(id)

loadZone(id):
  → zoneService.getById(id)
  → Patch form with zone.name, zone.isActive
  → Set selectedCity (from zone.city populated object)
  → Set selectedMunicipalities (from zone.municipalities)

selectCity(city: City):
  → selectedCity.set(city)
  → selectedMunicipalities.set([])  // reset on city change

clearCity():
  → selectedCity.set(null)
  → selectedMunicipalities.set([])

toggleMunicipality(slug: string):
  → if already in array → filter out
  → if not in array → push
  → Update signal

toggleAllMunicipalities():
  → if all selected → deselect all
  → if not all → select all

onNameBlur():
  → const name = form.get('name')?.value?.trim()
  → if (!name || name.length < 2) return
  → if (isEditMode && name === originalName) return  // skip check if unchanged
  → isCheckingName.set(true)
  → zoneService.checkName(name).subscribe(res => {
      nameExists.set(res.data.exists)
      isCheckingName.set(false)
    })

onSubmit():
  → Validate: form valid + selectedCity not null + selectedMunicipalities.length >= 1 + !nameExists
  → Build payload: { name, city: selectedCity.id, municipalities: selectedMunicipalities, isActive }
  → if create: zoneService.create(payload)
  → if edit: zoneService.update(zoneId, payload)
  → On success: router.navigate(['/admin/zones'])
```

### Step A.2: Rewrite `zone-form.component.html` (REWRITE)

```
Layout: grid lg:3 cols (main span-2 + sidebar span-1)

MAIN SECTION:
  Card "Información de la Zona":
    ┌─────────────────────────────────────────────────────┐
    │ Nombre de la zona *                                 │
    │ [input text]                                        │
    │ ✅ "Nombre disponible" (green, if checked & !exists)│
    │ ❌ "Ya existe una zona con este nombre" (red)       │
    │ ⏳ spinner while checking                           │
    │                                                     │
    │ Ciudad *                                            │
    │ [searchable select dropdown — 18 cities]            │
    │ Shows selected as green badge with X to clear       │
    │                                                     │
    │ @if (selectedCity()) {                              │
    │   Municipios *           [☐ Seleccionar todos]      │
    │   ┌───────────────────────────────────────────┐     │
    │   │ ☑ Libertador  ☑ Chacao  ☐ Baruta         │     │
    │   │ ☐ Sucre       ☐ El Hatillo                │     │
    │   └───────────────────────────────────────────┘     │
    │   2 de 5 seleccionados                              │
    │   @if (submitted && selectedMunicipalities().length === 0) {
    │     ❌ "Debe seleccionar al menos un municipio"     │
    │   }                                                 │
    │ }                                                   │
    └─────────────────────────────────────────────────────┘

SIDEBAR:
  Card "Estado":
    Toggle "Zona activa" with helper text

FOOTER:
  [Cancelar] (routerLink /admin/zones) + [Crear Zona / Guardar Cambios]
```

### Step A.3: Modify `zone-list.component.ts` (MODIFY)

**DELETE:**
- `stateFilter` signal and `uniqueStates` computed
- References to `City` type from old zone service

**REPLACE:**
- `cities` signal → `zones` signal (`Zone[]`)
- Load method: `zoneService.getAllAdmin()` instead of old `getAllAdmin()`

**ADD:**
- `cityFilter` signal (dropdown of unique cities from loaded zones)
- In detail modal: load usage data → `branchZoneService.getByZone(zone.id)` to show which branches use this zone
- In delete flow: check if zone has BranchZones → if yes, show error modal instead of confirm

**Filtering logic:**
```typescript
get filteredZones(): Zone[] {
  return this.zones().filter(z => {
    const matchSearch = !search || z.name.toLowerCase().includes(search)
      || (z.city as City)?.name?.toLowerCase().includes(search);
    const matchCity = !cityFilter || (z.city as City)?.slug === cityFilter;
    return matchSearch && matchCity;
  });
}
```

### Step A.4: Modify `zone-list.component.html` (MODIFY)

**Columns:** Name | City (from populated zone.city.name) | Municipalities (join array) | Active badge | Actions

**Filters:** Search input + City dropdown (unique cities) + Active toggle

**Detail modal:** Add "Uso" section showing branches that use this zone

**Delete modal:** If zone has BranchZones → show "Cannot delete" error with branch list. If no refs → normal confirm.

---

## Part B: Branch Components

### Step B.1: Refactor `branch-form.component.ts` — Zone Section (PARTIAL REWRITE)

**KEEP UNCHANGED:** Basic info section (name, address, phones, coordinates, description, toggle) + Schedule section (7-day grid).

**DELETE all zone-related state and logic:**
- `ZoneFormState` type and all its fields
- `existingBranches` signal (for cross-branch municipality validation)
- Methods: `addZone()` (inline creation), `selectState()`, `selectCity()`, `addZoneMunicipality()`, `removeZoneMunicipality()`
- Methods: `toggleMuniDelivery()`, `toggleMuniFreeDelivery()`, `updateMuniDeliveryCharge()`, `toggleMuniOilChange()`
- `getTakenMunicipalityCodes()` — no longer needed (branches are agnostic)
- All state/city/municipality search terms and dropdown signals

**ADD new state:**
```typescript
// Zone management
availableZones = signal<Zone[]>([]);                // zoneService.getActive()
existingBranchZones = signal<BranchZone[]>([]);     // loaded in edit mode
newBranchZones = signal<Array<{
  zone: Zone;
  deliveryConfig: DeliveryConfigItem[];
}>>([]);
deletedBranchZoneIds = signal<string[]>([]);
zoneSearchTerm = signal('');
showZoneDropdown = signal(false);
```

**ADD new injections:**
```typescript
private readonly zoneService = inject(ZoneService);
private readonly branchZoneService = inject(BranchZoneService);
```

**ADD computed:**
```typescript
filteredZones = computed(() => {
  const search = this.zoneSearchTerm().toLowerCase().trim();
  const assignedZoneIds = new Set([
    ...this.existingBranchZones().map(bz => (bz.zone as Zone).id || bz.zone),
    ...this.newBranchZones().map(nbz => nbz.zone.id),
  ]);
  const removedIds = new Set(this.deletedBranchZoneIds());

  return this.availableZones()
    .filter(z => !assignedZoneIds.has(z.id) || removedIds.has(/* find bz id for this zone */))
    .filter(z => !search
      || z.name.toLowerCase().includes(search)
      || (z.city as City)?.name?.toLowerCase().includes(search));
});

allAssignedZones = computed(() => {
  const existing = this.existingBranchZones()
    .filter(bz => !this.deletedBranchZoneIds().includes(bz.id));
  return { existing, new: this.newBranchZones() };
});
```

**ADD methods:**
```typescript
addZone(zone: Zone):
  → const city = zone.city as City
  → const deliveryConfig = zone.municipalities.map(slug => {
      const muni = city.municipalities.find(m => m.slug === slug);
      return {
        municipality: slug,
        municipalityName: muni?.name || slug,  // for display only
        hasDelivery: false,
        freeDelivery: true,
        deliveryCharge: 0,
        hasOilChangeService: false,
      };
    });
  → newBranchZones.update(prev => [...prev, { zone, deliveryConfig }]);
  → showZoneDropdown.set(false); zoneSearchTerm.set('');

removeExistingZone(branchZoneId: string):
  → deletedBranchZoneIds.update(prev => [...prev, branchZoneId]);

removeNewZone(index: number):
  → newBranchZones.update(prev => prev.filter((_, i) => i !== index));

// Delivery config toggles (same logic as current, but on new data structure)
toggleDelivery(type: 'existing'|'new', index: number, municipalitySlug: string): ...
toggleFreeDelivery(type, index, slug): ...
updateDeliveryCharge(type, index, slug, value): ...
toggleOilChange(type, index, slug): ...
```

**MODIFY onSubmit:**
```typescript
async onSubmit():
  1. Validate form (basic fields)
  2. const totalZones = existingBranchZones.filter(not deleted).length + newBranchZones.length
     if (totalZones === 0) → show error "Debe agregar al menos una zona"
  3. Build branch payload (only basic data, no zones)
  4. if create: POST /admin/branches → get branchId
     if edit: PUT /admin/branches/:id
  5. if deletedBranchZoneIds.length > 0:
     → for each id: branchZoneService.delete(id) (in parallel with forkJoin)
  6. if newBranchZones.length > 0:
     → branchZoneService.createBatch({ branchId, zones: newBranchZones.map(...) })
  7. for each modified existingBranchZone:
     → branchZoneService.update(bz.id, { deliveryConfig: bz.deliveryConfig })
  8. router.navigate(['/admin/branches'])
```

### Step B.2: Refactor `branch-form.component.html` — Zone Section (PARTIAL REWRITE)

**KEEP:** Sections for basic info + schedule (unchanged).

**REWRITE zone section:**
```html
<!-- Zone Section Header -->
<h3>Zonas de Servicio</h3>
<button (click)="showZoneDropdown.set(true)">+ Agregar Zona</button>

<!-- Zone Dropdown (searchable) -->
@if (showZoneDropdown()) {
  <input [(ngModel)]="zoneSearchTerm" placeholder="Buscar zona...">
  <dropdown>
    @for (zone of filteredZones(); track zone.id) {
      <option (click)="addZone(zone)">
        🟢 {{ zone.name }}
        <small>{{ zone.city.name }} — {{ zone.municipalities.join(', ') }}</small>
      </option>
    }
  </dropdown>
}

<!-- Empty State -->
@if (allAssignedZones().existing.length === 0 && allAssignedZones().new.length === 0) {
  <empty-state>📍 No hay zonas asignadas</empty-state>
}

<!-- Existing BranchZones -->
@for (bz of allAssignedZones().existing; track bz.id) {
  <zone-card [collapsible]="true">
    <header>Zona: {{ bz.zone.name }} ({{ bz.zone.city.name }}) <button 🗑️ removeExistingZone(bz.id)></button></header>
    <body>
      <delivery-config-table [config]="bz.deliveryConfig" (toggle)="..."></delivery-config-table>
    </body>
  </zone-card>
}

<!-- New BranchZones -->
@for (nbz of allAssignedZones().new; track $index) {
  <zone-card>
    <header>Zona: {{ nbz.zone.name }} ({{ nbz.zone.city.name }}) <button 🗑️ removeNewZone($index)></button></header>
    <body>
      <delivery-config-table [config]="nbz.deliveryConfig" (toggle)="..."></delivery-config-table>
    </body>
  </zone-card>
}

<!-- Delivery Config Table (per zone card) -->
<table>
  <tr><th>Municipio</th><th>Delivery</th><th>Gratis</th><th>Cargo</th><th>Aceite</th></tr>
  @for (item of config; track item.municipality) {
    <tr>
      <td>{{ item.municipality }}</td>
      <td><toggle [checked]="item.hasDelivery" (change)="toggleDelivery(...)"></toggle></td>
      @if (item.hasDelivery) {
        <td><toggle [checked]="item.freeDelivery" (change)="toggleFreeDelivery(...)"></toggle></td>
        @if (!item.freeDelivery) {
          <td><input type="number" [value]="item.deliveryCharge" (input)="updateCharge(...)"></td>
        }
      }
      <td><toggle [checked]="item.hasOilChangeService" (change)="toggleOilChange(...)"></toggle></td>
    </tr>
  }
</table>
```

### Step B.3: Modify `branch-list.component.ts` (MODIFY)

**DELETE:**
- `getServiceZones()` helper (no more embedded serviceZones)

**MODIFY:**
- `getLocationText(branch)` → now needs to fetch BranchZones or use pre-loaded data
- `getMunicipalityCount(branch)` → sum from BranchZones
- Detail modal: load BranchZones on open → `branchZoneService.getByBranch(branch.id)`

**Strategy for zone data in list:** Either:
- Option A: Load BranchZones for each branch when list loads (N+1 problem, use with caution)
- Option B: Backend returns zone count with branch (add virtual or aggregate)
- **Recommended:** Option A with `forkJoin` for visible branches, cached in a Map

### Step B.4: Modify `branch-list.component.html` (MODIFY)

- Column "Ubicación" → "Zonas" showing zone names
- Detail modal updated with BranchZone data

---

## Part C: Product Components

### Step C.1: Refactor `product-form.component.ts` — Branch Section (PARTIAL REWRITE)

**KEEP UNCHANGED:** Sections for basic info (name, price, line, description), vehicle details (categories, brand, model, SKU, engines, oil), images, toggles.

**DELETE:**
- `branches` signal, `selectedBranches` signal
- `branchSearchTerm`, `showBranchDropdown`, `filteredBranches`
- Methods: `selectBranch()`, `removeBranchSelection()`, `toggleBranchDropdown()`, `onBranchSearch()`

**ADD new state:**
```typescript
availableBranches = signal<Branch[]>([]);               // branchService.getActive()
existingBranchProducts = signal<BranchProduct[]>([]);   // edit mode
newBranchProducts = signal<Array<{ branch: Branch; stock: number }>>([]);
deletedBranchProductIds = signal<string[]>([]);
branchSearchTerm = signal('');
showBranchDropdown = signal(false);

totalStock = computed(() => {
  const existing = this.existingBranchProducts()
    .filter(bp => !this.deletedBranchProductIds().includes(bp.id))
    .reduce((sum, bp) => sum + bp.stock, 0);
  const newStock = this.newBranchProducts().reduce((sum, nbp) => sum + nbp.stock, 0);
  return existing + newStock;
});
```

**ADD methods:**
```
addBranch(branch): push to newBranchProducts with stock = 0
removeBranch(type, index/id): push to deletedBranchProductIds or splice newBranchProducts
updateStock(type, index, value): update stock number

onSubmit():
  1. POST/PUT product (no branches, no stock)
  2. DELETE each deletedBranchProductIds
  3. POST batch newBranchProducts
  4. PUT each modified existingBranchProduct
```

### Step C.2: Refactor `product-form.component.html` — Branch Section (PARTIAL REWRITE)

**REPLACE** the current multi-select branch dropdown with:

```html
<section "Sucursales y Stock">
  <header>Asignar a sucursales <button [+ Agregar]></button></header>

  <table>
    <tr><th>Sucursal</th><th>Stock</th><th>Estado</th><th></th></tr>

    @for (bp of existingBranchProducts(); track bp.id) {
      @if (!deletedBranchProductIds().includes(bp.id)) {
        <tr>
          <td>📍 {{ bp.branch.name }}</td>
          <td><input type="number" [(ngModel)]="bp.stock" min="0"></td>
          <td>{{ bp.stock > 0 ? '🟢' : '🔴' }}</td>
          <td><button 🗑️ removeBranch('existing', bp.id)></button></td>
        </tr>
      }
    }

    @for (nbp of newBranchProducts(); track $index) {
      <tr>
        <td>📍 {{ nbp.branch.name }}</td>
        <td><input type="number" [(ngModel)]="nbp.stock" min="0"></td>
        <td>{{ nbp.stock > 0 ? '🟢' : '🔴' }}</td>
        <td><button 🗑️ removeBranch('new', $index)></button></td>
      </tr>
    }
  </table>

  <footer>
    Stock total: {{ totalStock() }} unidades en {{ branchCount }} sucursales
    @if (outOfStockCount > 0) { ⚠️ {{ outOfStockCount }} sucursal(es) sin stock }
  </footer>
</section>
```

### Step C.3: Modify `product-list.component.ts` (MODIFY)

**DELETE:** Filter logic for `branchId`
**KEEP:** Everything else

---

## Verification

1. `ng build --configuration=production` — zero errors
2. **Zone flow:** Create zone → select city → check municipalities → save → appears in list → edit → delete
3. **Branch flow:** Create branch → add zones from dropdown → configure delivery → save → appears in list with zone names → edit → remove zone → add new zone → save
4. **Product flow:** Create product → add branches with stock → save → appears in list → edit → change stock → remove branch → add new branch → save
5. **Cross-flow:** Create zone → assign to branch → try delete zone → should show error "Zone in use"
6. **Cascade:** Delete branch → BranchZones and BranchProducts removed → zone list no longer shows that branch in "Usage"

---

## Summary

| Component | Action | Scope |
|-----------|--------|-------|
| `zone-form.component.ts` | REWRITE | Full rewrite — new state, city select, checkboxes |
| `zone-form.component.html` | REWRITE | Full rewrite — new layout |
| `zone-list.component.ts` | MODIFY | Replace data source, add usage lookup |
| `zone-list.component.html` | MODIFY | Update columns, filters, modals |
| `branch-form.component.ts` | PARTIAL REWRITE | Keep basic info, rewrite zone section |
| `branch-form.component.html` | PARTIAL REWRITE | Keep basic info, rewrite zone section |
| `branch-list.component.ts` | MODIFY | Remove getServiceZones, load BranchZones |
| `branch-list.component.html` | MODIFY | Update zone display |
| `product-form.component.ts` | PARTIAL REWRITE | Keep all except branch section |
| `product-form.component.html` | PARTIAL REWRITE | Replace branch multi-select with stock table |
| `product-list.component.ts` | MODIFY | Remove branch filters |
| **Total** | **11 files** | |
