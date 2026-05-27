# Client Module Implementation Plan — Part 2: Checkout Flow & Vehicle Integration

> **Date:** 2026-03-30
> **Prerequisite:** Part 1 (`docs/plans/client-module-part-1-architecture.md`)
> **Scope:** Checkout forms, vehicle selection, billing address, branch selection, order creation

---

## 1. Dispatch Type Routing Map

### 1.1 Navigation Flow per Dispatch Type

```
[Dispatch Selection Page]
  │
  ├─ store_pickup ──────────────────────────────── → [Summary]
  │                                                   (select branch)
  │
  ├─ seller_agreement ──────────────────────────── → [Summary]
  │                                                   (auto-fill contact from profile)
  │
  ├─ in_store_oil_change ──────────────────────── → [Summary]
  │                                                   (select branch + vehicle)
  │
  ├─ shipping_agency → [Agency Selection]
  │                      → [Shipping Form] ──────── → [Summary]
  │
  ├─ local_delivery → [Delivery Form] ──────────── → [Summary]
  │
  └─ oil_change_service → [Oil Change Form] ────── → [Summary]
                            (+ vehicle selection)
```

### 1.2 New Route Required
```typescript
// app.routes.ts — no new routes needed
// in_store_oil_change goes directly to /checkout/resumen
// The branch + vehicle selection happens INSIDE the summary component
```

---

## 2. Vehicle Selection in Checkout

### 2.1 When Vehicle Is Required
- `oil_change_service` — mandatory (home service needs vehicle data)
- `in_store_oil_change` — mandatory (in-store service needs vehicle data)
- All other dispatch types — optional (no vehicle needed)

### 2.2 Vehicle Selection UI (Embedded in Forms)
When a dispatch type requires a vehicle, the form shows a **vehicle selector section**:

```
[Selecciona tu vehículo]
  ┌─────────────────────────────────────┐
  │ ▼ Seleccionar vehículo              │
  ├─────────────────────────────────────┤
  │ 🚗 Toyota Corolla 2020 - ABC-123   │
  │ 🚗 Chevrolet Aveo 2018 - DEF-456   │
  │ ─────────────────────────────────── │
  │ + Agregar nuevo vehículo            │
  └─────────────────────────────────────┘

  [Vehicle Details Card]  (read-only preview of selected vehicle)
  ┌─────────────────────────────────────┐
  │ Marca: Toyota  │  Modelo: Corolla   │
  │ Año: 2020      │  Placa: ABC-123    │
  │ Motor: 1.8L Gasolina 4 cil.        │
  │ Aceite: Semi-Sintético 4.2L        │
  │ Kilometraje: 45,000 km             │
  └─────────────────────────────────────┘
```

### 2.3 Add New Vehicle Flow
- "Agregar nuevo vehículo" opens an **inline vehicle form** (reuse VehicleFormComponent)
- On save → vehicle created via VehicleService → auto-selected
- No navigation away from checkout

### 2.4 Data Flow
```typescript
// CheckoutState additions:
interface CheckoutState {
  // ... existing fields ...
  selectedVehicle: Vehicle | null;
}

// CheckoutService additions:
selectVehicle(vehicle: Vehicle): void;
clearVehicle(): void;
readonly selectedVehicle: Signal<Vehicle | null>;
readonly hasVehicle: Signal<boolean>;
```

---

## 3. Billing Address Toggle

### 3.1 Purpose
User can choose where the invoice/receipt should be sent.
This is a **toggle with 3 options** shown in the checkout summary.

### 3.2 Options
```
[Dirección de facturación]
  ○ Usar dirección de envío        (default if dispatch has address)
  ○ Usar dirección de mi perfil    (auto-fill from user profile)
  ○ Ingresar nueva dirección       (show inline form)
```

### 3.3 When It Appears
- Shows in checkout summary, BEFORE payment section
- Only visible if dispatch type has a delivery address (local_delivery, oil_change_service, shipping_agency)
- For store_pickup, seller_agreement, in_store_oil_change → billing = profile address (no toggle)

### 3.4 Data Structure
```typescript
interface BillingAddress {
  source: 'shipping' | 'profile' | 'custom';
  fullName?: string;
  documentType?: string;
  documentNumber?: string;
  address: string;
  city: string;
  municipality?: string;
  state?: string;
  referencePoint?: string;
}

// Added to CheckoutState:
billingAddress: BillingAddress | null;
```

### 3.5 New Address Form
When user selects "Ingresar nueva dirección":
- fullName, documentType, documentNumber
- stateCode → cityCode → municipalityCode cascade (all Venezuelan locations)
- address, referencePoint
- Reuses same form pattern as shipping form

---

## 4. Checkout Forms — Reconnection Plan

### 4.1 Local Delivery Form (`checkout-local-delivery-form`)
**Current:** `loadBranchZones()` stubbed. No municipality filter.
**Fix:**
1. Inject `LocationService` instead of reading from branch.serviceZones
2. On init → get `locationService.branches` and their BranchZones
3. Build city+municipality dropdown from BranchZone.deliveryConfig WHERE `hasDelivery = true`
4. Only municipalities within coverage zone are selectable
5. Pre-fill from user profile IF profile address is within coverage

**Data source:**
```
LocationService.branches → for each branch:
  GET /api/branch-zones/admin?branchId=X → BranchZone[] → deliveryConfig[]
  Filter: dc.hasDelivery === true
  Deduplicate municipalities across branches
  Build dropdown: { citySlug, cityName, municipalitySlug, municipalityName }
```

### 4.2 Oil Change Form (`checkout-oil-change-form`)
**Current:** `loadBranchZones()` stubbed. No municipality filter.
**Fix:** Same as local delivery BUT:
1. Additionally requires vehicle selection (section 2)
2. Municipality filter: same coverage rules as delivery
3. Vehicle data card shown below form

### 4.3 Shipping Form (`checkout-shipping-form`)
**Current:** `loadReferenceStates()` stubbed. No state/city data.
**Fix:**
1. Load ALL cities from `GET /api/cities` (18 Venezuelan cities)
2. State dropdown → filter cities → municipality dropdown
3. NOT limited to coverage zone (shipping goes anywhere)
4. Agency office code field (for selected agency)
5. Pre-fill from user profile (always, not coverage-dependent)

### 4.4 Seller Agreement Form (`checkout-seller-agreement-form`)
**Status:** ✅ Working. No changes needed.
- Simple contact form (name, document, phone, email, notes)
- Auto-fills from user profile

---

## 5. Branch Selection at Summary

### 5.1 When Branch Selection Is Needed
| Dispatch Type | Branch Selection |
|--------------|-----------------|
| `store_pickup` | Required — user chooses pickup branch |
| `in_store_oil_change` | Required — user chooses service branch (filtered by `hasInStoreOilChange`) |
| `local_delivery` | Not shown — backend assigns branch |
| `oil_change_service` | Not shown — backend assigns branch |
| `shipping_agency` | Not shown — ships from any branch |
| `seller_agreement` | Not shown — coordinated separately |

### 5.2 Branch Selector UI (In Summary)
```
[Selecciona sucursal]
  ┌───────────────────────────────────────────┐
  │ 📍 Sucursal Chacao                        │
  │    Av. Principal, C.C. Chacao, Local 12   │
  │    Lun-Vie: 08:00-18:00                   │
  │    📞 0414-1234567                         │
  │    [Seleccionar]                           │
  ├───────────────────────────────────────────┤
  │ 📍 Sucursal Valencia Norte                │
  │    Av. Bolívar Norte, C.C. Metrópolis     │
  │    Lun-Sáb: 09:00-19:00                   │
  │    📞 0414-7654321                         │
  │    🔧 Cambio de aceite disponible          │  ← only if hasInStoreOilChange
  │    [Seleccionar]                           │
  └───────────────────────────────────────────┘
```

### 5.3 Filtering Rules
- `store_pickup`: Show ALL branches from `LocationService.branches`
- `in_store_oil_change`: Show ONLY branches where `hasInStoreOilChange === true`
- If only ONE branch matches → auto-select, show read-only card

### 5.4 Stock Validation at Branch Level
When user selects a branch for pickup:
- Backend validates that branch has sufficient stock for ALL cart items
- If insufficient → show error: "Esta sucursal no tiene stock suficiente para tu pedido"
- User must select another branch

---

## 6. Order Creation — Updated Payload

### 6.1 CreateOrderRequest (Updated)
```typescript
interface CreateOrderRequest {
  items: OrderItemRequest[];
  subtotal: number;
  shippingCost: number;
  total: number;
  dispatchType: string;  // includes 'in_store_oil_change'
  dispatchDetails: DispatchDetails;
  paymentMethod: string;
  paymentSubmission: PaymentSubmission;
  disclaimerAccepted: boolean;
  vehicle?: string;          // Vehicle ID (for oil change types)
  selectedBranch?: string;   // Branch ID (for pickup/in-store types)
  billingAddress?: BillingAddress;
  notes?: string;
}
```

### 6.2 Backend Order Handling Updates
```
On order creation:
  1. Validate all products exist and are active
  2. If selectedBranch:
     → Validate branch has stock for ALL items (BranchProduct)
     → Decrement stock from THAT branch
  3. If no selectedBranch (delivery/shipping):
     → Find branches in user's zone with stock
     → Decrement from first available branch
  4. If vehicle:
     → Validate vehicle belongs to user
     → Store vehicle reference in order
  5. Store billingAddress in order (new field)
  6. Generate orderNumber, set PENDING status
```

---

## 7. DispatchDetails Schema — Updated

### 7.1 Backend Schema Addition
```typescript
// Add to dispatchDetailsSchema:
selectedBranchId: { type: String },
selectedBranchName: { type: String },
selectedBranchAddress: { type: String },

// Add to orderSchema:
billingAddress: {
  source: { type: String, enum: ['shipping', 'profile', 'custom'] },
  fullName: { type: String },
  documentType: { type: String },
  documentNumber: { type: String },
  address: { type: String },
  city: { type: String },
  municipality: { type: String },
  state: { type: String },
  referencePoint: { type: String },
}
```

---

## 8. Files Impact Summary

### 8.1 New Files
| File | Purpose |
|------|---------|
| `frontend/core/services/location.service.ts` | Central location state management |
| `backend/branch-products/routes` (public endpoint) | Aggregated stock query |
| `backend/branch-zones/routes` (delivery-config) | Delivery config resolution |

### 8.2 Rewrite Files
| File | Scope |
|------|-------|
| `frontend/shared/components/zoning-modal/*` | Complete rewrite (3 files) |
| `frontend/checkout/checkout-dispatch/*` | New dispatch logic (2 files) |

### 8.3 Major Modifications
| File | Changes |
|------|---------|
| `frontend/tubus-header/*` | Zone label, change button |
| `frontend/catalog/catalog.component.ts` | branchIds filter |
| `frontend/product-card/product-card.component.ts` | Real stock |
| `frontend/product-detail/product-detail.component.ts` | Real stock |
| `frontend/checkout/services/checkout.service.ts` | New dispatch types, vehicle, billing |
| `frontend/checkout/checkout-summary/*` | Branch selector, vehicle, billing |
| `frontend/checkout/checkout-local-delivery-form/*` | Reconnect municipalities |
| `frontend/checkout/checkout-oil-change-form/*` | Reconnect + vehicle selector |
| `frontend/checkout/checkout-shipping-form/*` | Reconnect cities |
| `frontend/core/services/branch-zone.service.ts` | Add public methods |
| `frontend/models/order.model.ts` | New fields |
| `backend/products/services/product.service.ts` | branchIds filter |
| `backend/products/dto/product.dto.ts` | branchIds param |
| `backend/branch-zones/services/branch-zone.service.ts` | hasInStoreOilChange select |
| `backend/orders/models/order.model.ts` | New dispatchType + billingAddress |
| `backend/orders/services/order.service.ts` | Stock validation with BranchProduct |

### 8.4 Minor Modifications
| File | Changes |
|------|---------|
| `frontend/models/branch.model.ts` | Already has hasInStoreOilChange ✅ |
| `frontend/core/services/product.service.ts` | Add branchIds to query params |
| `frontend/app.routes.ts` | No new routes needed |
| `backend/app.ts` | No new route mounts needed |

---

## 9. Implementation Priority Order

```
PHASE 1 — Backend Foundation (Day 1)
  ├─ Add branchIds to ProductQueryDto + service
  ├─ Add hasInStoreOilChange to findBranchesByLocation select
  ├─ Create public stock aggregation endpoint
  ├─ Create public delivery-config endpoint
  ├─ Add in_store_oil_change to order.model.ts enum
  └─ Add billingAddress + selectedBranch to order schema

PHASE 2 — LocationService (Day 1-2)
  ├─ Create LocationService with signals + localStorage
  ├─ Add public methods to BranchZoneService frontend
  └─ Wire up resolution flow

PHASE 3 — Zoning Modal + Header (Day 2)
  ├─ Rewrite zoning-modal (city → municipality → coverage check)
  ├─ Wire tubus-header zone button + label
  └─ Mandatory selection enforcement

PHASE 4 — Catalog + Products (Day 2-3)
  ├─ Catalog filters by branchIds
  ├─ ProductCard shows real stock
  └─ ProductDetail shows real stock

PHASE 5 — Checkout Dispatch (Day 3)
  ├─ New dispatch options logic
  ├─ in_store_oil_change option
  └─ Conditional routing

PHASE 6 — Checkout Forms (Day 3-4)
  ├─ Reconnect local delivery form
  ├─ Reconnect oil change form + vehicle selector
  ├─ Reconnect shipping form
  └─ Vehicle selection component (reusable)

PHASE 7 — Checkout Summary (Day 4-5)
  ├─ Branch selector (for pickup/in-store)
  ├─ Vehicle display card
  ├─ Billing address toggle
  └─ Updated order payload

PHASE 8 — Order Backend (Day 5)
  ├─ Stock validation with BranchProduct
  ├─ Branch-level stock decrement
  └─ Vehicle + billing storage

PHASE 9 — Testing & Polish (Day 5-6)
  ├─ Compilation verification
  ├─ Flow testing (all 6 dispatch paths)
  └─ Edge cases (no coverage, single branch, no stock)
```

---

## 10. Edge Cases to Handle

| Scenario | Behavior |
|----------|----------|
| No coverage for selected municipality | Show "out of coverage" → only shipping_agency + store_pickup + seller_agreement |
| Only 1 branch in zone | Auto-select branch, show read-only card |
| Branch has no stock for some items | Error at order creation, suggest another branch |
| User changes zone mid-checkout | Clear cart + reset checkout state |
| Cart has mix of oil-change and normal products | Oil change dispatch options still available (applies to combo items) |
| All branches out of stock | Product appears but "Agotado" badge, cannot add to cart |
| User has no vehicles registered | "Agregar vehículo" inline form in checkout |
| User selects in_store_oil_change but no branch has it | Option not shown in dispatch |
| Multiple vehicles registered | Dropdown selector with vehicle cards |
| Billing address = shipping but no shipping address | Falls back to profile address |
