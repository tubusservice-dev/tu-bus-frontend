# Client Module Implementation Plan — Part 1: Architecture & Data Flow

> **Date:** 2026-03-30
> **Scope:** Frontend client module — Location selection, product filtering, checkout flow
> **Prerequisite:** Admin module complete (zones, branches, products, branch-zones, branch-products)
> **Related:** `docs/features/zones-branches-products-architecture.md`, `docs/features/implementation-log-zones-branches-products.md`
> **Continuation:** `docs/plans/client-module-part-2-checkout-flow.md`

---

## 1. Current State Assessment

### 1.1 What Works
- Cart system (localStorage + signals, auth check, stock validation)
- Auth system (login, register, OAuth, JWT, session expiry)
- Payment method selection and submission
- Order creation (basic flow, stock validation stubbed)
- Vehicle garage (CRUD, selection for catalog filtering)
- User profile (edit, avatar upload)
- Checkout summary (payment form, disclaimer, order generation)
- Seller agreement form (simple contact)
- Shipping agency selection

### 1.2 What's Broken (19 TODOs)
- `zoning-modal` — completely disabled (`showModal = false`)
- `tubus-header` — zone button does nothing
- `checkout-dispatch` — delivery config not loaded from BranchZone
- `checkout-local-delivery-form` — municipalities not filtered by coverage
- `checkout-oil-change-form` — municipalities not filtered by coverage
- `checkout-shipping-form` — states/cities not loaded
- `catalog.component` — loads ALL products, no zone filter
- `product-detail` — stock hardcoded to 999
- `product-card` — no real stock validation
- `checkout.service` — `loadDeliveryConfigForZone()` stubbed

### 1.3 What Doesn't Exist Yet
- `LocationService` — central service for user location state
- `in_store_oil_change` dispatch type
- Billing address toggle in checkout
- Vehicle selection in checkout for oil change combos
- Stock aggregation from BranchProduct (public endpoint)
- Product filtering by zone (backend query restored)

---

## 2. Core Architecture: LocationService

### 2.1 Purpose
Central singleton service that manages the user's selected geographic location.
Every component that needs zone-aware data consumes this service.

### 2.2 State Shape
```typescript
interface UserLocation {
  citySlug: string;
  cityName: string;
  municipalitySlug: string;
  municipalityName: string;
}

interface LocationState {
  location: UserLocation | null;
  branches: BranchSummary[];       // branches serving this location
  branchIds: string[];             // derived from branches
  deliveryConfig: DeliveryConfigResolved | null;
  isLoading: boolean;
  isResolved: boolean;             // true after backend call completes
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

### 2.3 Persistence
- `localStorage` key: `user_location`
- On app init: read from storage → if exists, auto-resolve branches
- On location change: save to storage → clear cart (with confirmation) → resolve

### 2.4 Resolution Flow
```
User selects city+municipality
  → LocationService.setLocation(citySlug, municipalitySlug)
  → POST/GET /api/branch-zones/by-location?citySlug=X&municipality=Y
  → Response: branches[] (with hasInStoreOilChange)
  → If branches.length > 0:
      → Store branchIds
      → Find delivery config for this municipality across all BranchZones
      → isResolved = true
  → If branches.length === 0:
      → No coverage — user can still browse but only shipping_agency available
      → isResolved = true
```

### 2.5 Computed Properties
```typescript
readonly hasLocation: boolean           // location !== null
readonly hasDelivery: boolean           // deliveryConfig?.hasDelivery
readonly hasCoverage: boolean           // branches.length > 0
readonly hasInStoreOilChange: boolean   // any branch has it
readonly branchesWithOilChange: Branch[] // filtered subset
readonly locationLabel: string          // "Municipio, Ciudad"
```

### 2.6 Consumers
| Component | What it uses |
|-----------|-------------|
| `tubus-header` | `locationLabel`, `hasLocation`, triggers modal |
| `zoning-modal` | `setLocation()`, `clearLocation()` |
| `catalog` | `branchIds` for product filtering |
| `product-card` | Stock from aggregated BranchProduct |
| `product-detail` | Stock from aggregated BranchProduct |
| `checkout-dispatch` | `deliveryConfig`, `hasCoverage`, `hasInStoreOilChange` |
| `checkout-local-delivery` | Municipality list from BranchZone coverage |
| `checkout-oil-change-form` | Municipality list from BranchZone coverage |
| `checkout-summary` | Branch selection for pickup/oil-change |

---

## 3. Backend Changes Required

### 3.1 Restore `branchIds` Filter in Product Query
**File:** `backend/src/modules/products/dto/product.dto.ts`
```typescript
// Add to ProductQueryDto:
branchIds?: string;  // comma-separated branch IDs
```

**File:** `backend/src/modules/products/services/product.service.ts`
```typescript
// In findAll(), after existing filters:
if (branchIds) {
  const ids = branchIds.split(',').map(id => id.trim());
  const branchProducts = await BranchProduct.find({
    branch: { $in: ids },
    isActive: true,
    stock: { $gt: 0 }
  }).select('product');
  const productIds = [...new Set(branchProducts.map(bp => bp.product.toString()))];
  filter._id = { $in: productIds };
}
```

### 3.2 Add `hasInStoreOilChange` to `findBranchesByLocation`
**File:** `backend/src/modules/branch-zones/services/branch-zone.service.ts`
```typescript
// Line 186: Change select to include hasInStoreOilChange
select: 'name address whatsappPhone coordinates schedule hasInStoreOilChange',
```

### 3.3 Public Endpoint for Aggregated Stock
**File:** `backend/src/modules/branch-products/routes/branch-product.routes.ts`
```
GET /api/branch-products/stock?productId=X&branchIds=A,B,C
→ Returns: { totalStock: number, byBranch: [{ branchId, branchName, stock }] }
```

### 3.4 Public Endpoint for Delivery Config
**File:** `backend/src/modules/branch-zones/routes/branch-zone.routes.ts`
```
GET /api/branch-zones/delivery-config?citySlug=X&municipality=Y
→ Returns: { hasDelivery, freeDelivery, deliveryCharge, branches[] }
```
This aggregates delivery config across all branches serving this municipality.
Logic: if ANY branch offers delivery → hasDelivery = true.
Charge = minimum charge across branches (best price for user).

### 3.5 Add `in_store_oil_change` to Order Model
**File:** `backend/src/modules/orders/models/order.model.ts`
```typescript
dispatchType: {
  type: String,
  enum: ['store_pickup', 'shipping_agency', 'local_delivery',
         'seller_agreement', 'oil_change_service', 'in_store_oil_change'],
  required: true,
},
```

---

## 4. Zoning Modal — Complete Rewrite

### 4.1 Flow
```
[Step 1: Select City]
  → GET /api/cities → show 18 Venezuelan cities as cards/list
  → User clicks city

[Step 2: Select Municipality]
  → Show municipalities of selected city
  → User clicks municipality
  → LocationService.setLocation(citySlug, municipalitySlug)
  → Modal closes
  → If no coverage → Step 3

[Step 3: Out of Coverage]
  → Message: "No tenemos cobertura en tu zona"
  → Options: "Continuar con envío por agencia" or "Seleccionar otra ubicación"
  → If continue → location saved but hasCoverage = false
```

### 4.2 Mandatory Selection
- Location selection is **required** before browsing products
- If `!locationService.hasLocation()` → zoning-modal opens automatically
- Cannot dismiss without selecting (no X button, no backdrop click close)
- After selection, modal never auto-opens again (localStorage persists)

### 4.3 Change Location
- Header button "Cambiar zona" → if cart has items → confirmation modal first
- Confirmation: "Cambiar de zona vaciará tu carrito. ¿Continuar?"
- On confirm → clear cart → open zoning modal

---

## 5. Dispatch Options Logic (Updated Rules)

### 5.1 Decision Matrix

| Condition | Options Available |
|-----------|------------------|
| `hasCoverage = false` | store_pickup, shipping_agency, seller_agreement |
| `hasCoverage = true, hasDelivery = false` | store_pickup, seller_agreement |
| `hasCoverage = true, hasDelivery = true` | store_pickup, local_delivery, seller_agreement |
| Cart has `freeOilChangeService` + `hasCoverage` | Above + oil_change_service |
| Cart has `freeOilChangeService` + any branch `hasInStoreOilChange` | Above + in_store_oil_change |

### 5.2 Key Rules
- **shipping_agency**: ONLY if `!hasCoverage` (user outside coverage zone)
- **local_delivery**: ONLY if `hasCoverage && hasDelivery`
- **store_pickup**: ALWAYS available
- **seller_agreement**: ALWAYS available
- **oil_change_service**: ONLY if cart has `freeOilChangeService` product
- **in_store_oil_change**: ONLY if cart has `freeOilChangeService` AND at least one branch in the zone has `hasInStoreOilChange = true`

### 5.3 Direct-to-Summary Options (No Form)
- `store_pickup` → Summary (user selects branch at summary)
- `seller_agreement` → Summary (contact info auto-filled from profile)
- `in_store_oil_change` → Summary (user selects branch + vehicle)

### 5.4 Form-Required Options
- `shipping_agency` → Agency selection → Shipping form → Summary
- `local_delivery` → Local delivery form → Summary
- `oil_change_service` → Oil change form (+ vehicle) → Summary

---

## 6. Stock Architecture

### 6.1 Stock Source
- Stock lives in `BranchProduct` pivot (per branch, per product)
- User sees **aggregated stock** across all branches in their zone
- Backend endpoint aggregates: `SUM(stock) WHERE branch IN (userBranchIds)`

### 6.2 Stock in Cart
- `CartItem.stock` = aggregated total from all zone branches
- When adding to cart, validate against this aggregated total
- Cart does NOT track per-branch stock (simplified for user)

### 6.3 Stock at Order Time
- When user selects `store_pickup` or `in_store_oil_change`:
  → Must select specific branch
  → Backend validates stock at THAT branch
- When user selects `local_delivery` or `oil_change_service`:
  → Backend finds branch with sufficient stock in coverage zone
  → Decrements from that branch's BranchProduct

---

## 7. Implementation Phases (Execution Order)

| Phase | Scope | Files | Depends On |
|-------|-------|-------|-----------|
| **P1** | Backend endpoints (product filter, stock, delivery config, dispatchType enum) | ~6 files | Nothing |
| **P2** | LocationService + BranchZoneService public methods | ~3 files | P1 |
| **P3** | Zoning Modal rewrite | ~3 files | P2 |
| **P4** | Header integration (zone label, change button) | ~3 files | P2, P3 |
| **P5** | Catalog + ProductCard + ProductDetail (zone filter, real stock) | ~4 files | P2 |
| **P6** | Checkout dispatch options (new logic, in_store_oil_change) | ~2 files | P2 |
| **P7** | Checkout forms (delivery, oil change, shipping — reconnect) | ~4 files | P2, P6 |
| **P8** | Vehicle selection in checkout + billing address toggle | ~3 files | P7 |
| **P9** | Branch selection at summary (for pickup/oil-change) | ~2 files | P6 |
| **P10** | Order backend (stock validation, new dispatchType) | ~2 files | P1 |

**Estimated total:** ~32 files across 10 phases.

> **Continue to Part 2:** `docs/plans/client-module-part-2-checkout-flow.md`
