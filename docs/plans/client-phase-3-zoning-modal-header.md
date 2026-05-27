# Client Phase 3 — Zoning Modal Rewrite + Header Integration

> **Status:** Pending
> **Depends on:** Phase 2 (LocationService)
> **Blocks:** Phase 4 (Catalog), Phase 5 (Checkout)
> **Estimated files:** 6
> **Verification:** `cd frontend && npx ng build` → 0 errors + manual test

---

## 1. Zoning Modal — Complete Rewrite

### Files:
- `frontend/src/app/shared/components/zoning-modal/zoning-modal.component.ts`
- `frontend/src/app/shared/components/zoning-modal/zoning-modal.component.html`
- `frontend/src/app/shared/components/zoning-modal/zoning-modal.component.scss`

### 1.1 Component Architecture (TS)

**Dependencies:**
```typescript
inject: CityService, LocationService
```

**Inputs/Outputs:**
```typescript
@Input() isOpen = false;          // controlled from parent
@Input() mandatory = false;       // true = no close button
@Output() closed = new EventEmitter<void>();
```

**Signals:**
```typescript
step: 'city' | 'municipality' | 'no-coverage'
cities: City[]                    // from GET /api/cities
selectedCity: City | null
isLoading: boolean
isResolving: boolean              // while LocationService resolves
searchTerm: string                // city search filter
```

**Computed:**
```typescript
filteredCities: City[]            // filtered by searchTerm
municipalities: Municipality[]    // selectedCity.municipalities
```

**Methods:**
```typescript
ngOnInit():
  → cityService.getAll() → set cities signal

selectCity(city):
  → set selectedCity → step = 'municipality'

selectMunicipality(municipality):
  → isResolving = true
  → locationService.setLocation(city.slug, city.name, municipality.slug, municipality.name)
  → Wait for locationService.isResolved() === true (effect)
  → If locationService.hasCoverage() → close modal
  → If !hasCoverage → step = 'no-coverage'
  → isResolving = false

backToCity():
  → selectedCity = null → step = 'city'

continueWithoutCoverage():
  → close modal (location saved, hasCoverage = false)

closeModal():
  → if mandatory && !locationService.hasLocation() → prevent close
  → else → closed.emit()
```

### 1.2 Template Structure (HTML)

```
<div class="modal-overlay" *ngIf="isOpen">
  <div class="modal-container">

    <!-- Header -->
    <div class="modal-header">
      <h2>{{ step title }}</h2>
      @if (!mandatory || locationService.hasLocation()) {
        <button close />
      }
    </div>

    <!-- Step 1: City Selection -->
    @if (step() === 'city') {
      <input search placeholder="Buscar ciudad..." />
      <div class="city-grid">
        @for (city of filteredCities(); track city.slug) {
          <button class="city-card" (click)="selectCity(city)">
            {{ city.name }}
            <span class="muni-count">{{ city.municipalities.length }} municipios</span>
          </button>
        }
      </div>
    }

    <!-- Step 2: Municipality Selection -->
    @if (step() === 'municipality') {
      <button back (click)="backToCity()">← Cambiar ciudad</button>
      <h3>{{ selectedCity().name }} — Selecciona tu municipio</h3>
      <div class="municipality-grid">
        @for (muni of municipalities(); track muni.slug) {
          <button class="muni-card" (click)="selectMunicipality(muni)">
            {{ muni.name }}
          </button>
        }
      </div>
    }

    <!-- Step 3: No Coverage -->
    @if (step() === 'no-coverage') {
      <div class="no-coverage">
        <icon warning />
        <h3>Sin cobertura en tu zona</h3>
        <p>No tenemos sucursales que atiendan tu municipio directamente.</p>
        <p>Puedes continuar y usar envío por agencia o retiro en tienda.</p>
        <div class="actions">
          <button secondary (click)="backToCity()">Seleccionar otra ubicación</button>
          <button primary (click)="continueWithoutCoverage()">Continuar así</button>
        </div>
      </div>
    }

    <!-- Loading overlay -->
    @if (isResolving()) {
      <div class="resolving-overlay">
        <spinner />
        <span>Verificando cobertura...</span>
      </div>
    }

  </div>
</div>
```

### 1.3 Styles (SCSS)
- Modal overlay: fixed, z-50, bg-black/50, backdrop-blur
- Modal container: max-w-lg, rounded-xl, bg-white dark:bg-gray-800
- City grid: grid 2-3 cols, gap-3
- City card: p-4, rounded-lg, border, hover:border-red-500, transition
- Municipality grid: grid 2 cols, gap-2
- Municipality card: p-3, rounded-md, hover:bg-red-50
- No coverage: centered, illustration, max-w-sm
- Resolving overlay: absolute, centered spinner
- Design system: use existing Tailwind classes, match admin module style

---

## 2. Header Integration

### Files:
- `frontend/src/app/layouts/pages/tu-bus-servicio/components/tubus-header/tubus-header.component.ts`
- `frontend/src/app/layouts/pages/tu-bus-servicio/components/tubus-header/tubus-header.component.html`
- `frontend/src/app/layouts/pages/tu-bus-servicio/tu-bus-servicio.component.ts` (if import needed)

### 2.1 Header Component (TS)

**Changes:**
```typescript
// Add imports:
import { LocationService } from '../../../../../core/services/location.service';
import { ZoningModalComponent } from '../../../../../shared/components/zoning-modal/zoning-modal.component';

// Add to imports array:
ZoningModalComponent,

// Inject:
protected readonly locationService = inject(LocationService);

// New signals:
protected readonly showZoneModal = signal(false);

// Replace openZoneModal():
openZoneModal(): void {
  if (this.cartService.totalItems() > 0) {
    this.showZoneConfirm.set(true);
  } else {
    this.showZoneModal.set(true);
  }
}

// Update confirmZoneChange():
confirmZoneChange(): void {
  this.cartService.clearCart();
  this.showZoneConfirm.set(false);
  this.showZoneModal.set(true);
}

// New:
onZoneModalClosed(): void {
  this.showZoneModal.set(false);
}

// Update ngOnInit:
ngOnInit(): void {
  // Remove old: zoneService.loadCities()
  // Auto-open zone modal if no location selected
  if (!this.locationService.hasLocation()) {
    this.showZoneModal.set(true);
  }
  // ... existing route listener
}
```

**Remove:**
- All references to `zoneService.loadCities()`, `zoneService.clearSelection()`

### 2.2 Header Template (HTML)

**Zone button changes:**
```html
<!-- Replace existing zone button with: -->
<button class="zone-button" (click)="openZoneModal()">
  <svg><!-- location pin icon --></svg>
  @if (locationService.hasLocation()) {
    <span class="zone-label">{{ locationService.locationLabel() }}</span>
    <span class="zone-change-hint">Cambiar</span>
  } @else {
    <span class="zone-label">Seleccionar ubicación</span>
  }
</button>
```

**Add zoning modal at bottom:**
```html
<!-- Zoning Modal -->
<app-zoning-modal
  [isOpen]="showZoneModal()"
  [mandatory]="!locationService.hasLocation()"
  (closed)="onZoneModalClosed()"
/>
```

**Zone change confirmation modal:**
```html
@if (showZoneConfirm()) {
  <div class="confirm-overlay">
    <div class="confirm-modal">
      <h3>Cambiar ubicación</h3>
      <p>Al cambiar de zona se vaciará tu carrito de compras.</p>
      <div class="confirm-actions">
        <button (click)="cancelZoneChange()">Cancelar</button>
        <button (click)="confirmZoneChange()">Cambiar zona</button>
      </div>
    </div>
  </div>
}
```

---

## 3. Mandatory Selection Enforcement

### Rules:
1. If `!locationService.hasLocation()` → modal opens on page load
2. Modal has `mandatory = true` → no X button, no backdrop close
3. User MUST select city + municipality to proceed
4. After selection, modal never auto-opens again (localStorage persists)
5. User can change zone later via header button (with cart warning)

### Where enforced:
- `tubus-header.ngOnInit()` — auto-open if no location
- `zoning-modal.closeModal()` — prevent if mandatory && no location
- `catalog.component` (Phase 4) — redirect if no location

---

## 4. Verification Checklist

| Check | Expected |
|-------|----------|
| `ng build` | 0 errors |
| First visit, no localStorage | Modal opens automatically, no X button |
| Select city | Municipalities shown, back button works |
| Select municipality with coverage | Modal closes, header shows label |
| Select municipality without coverage | "Sin cobertura" step shown |
| Continue without coverage | Modal closes, label shows, hasCoverage = false |
| Reload page | Modal does NOT reopen (localStorage) |
| Click "Cambiar" in header with empty cart | Modal opens directly |
| Click "Cambiar" with items in cart | Confirmation dialog first |
| Confirm change | Cart cleared, modal opens |
| Cancel change | Nothing happens |

---

## 5. Design Notes

- City cards: same visual style as zone cards in admin (border, rounded, hover)
- Municipality list: compact, 2-column grid
- No coverage screen: warning icon (amber), clear message, 2 action buttons
- Loading spinner: same as admin (border-t-red-600 spin animation)
- Modal width: max-w-lg on desktop, full-width on mobile
- Backdrop: blur effect consistent with admin modals
