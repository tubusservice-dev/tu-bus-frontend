# Checkout & Orders Upgrade — Implementation Log

**Date:** 2026-03-31
**Status:** Completed
**Scope:** Checkout flow improvements, orders management upgrade, product detail fixes, UX enhancements

---

## 1. Purpose & Functionality

This implementation session covered a comprehensive upgrade of the checkout flow (all 6 dispatch types) and the post-order experience for both users and administrators. The goal was to bring all purchase flows to production-ready quality and fix critical bugs.

### Business Impact
- Users can now select multiple vehicles per order (oil change services)
- Users can set a billing address with 3 source options
- Administrators can manage dispatch status, edit notes, and search orders
- Stock reservation system ensures inventory accuracy across order lifecycle
- Payment proof upload is now fully functional end-to-end

---

## 2. Changes Implemented

### 2.1 Checkout Flow Upgrade (6 Phases)

#### Phase 1+2: Backend — Stock Reservations + Multi-Vehicle

**Files Modified:**
- `backend/src/modules/orders/interfaces/order.interface.ts`
- `backend/src/modules/orders/models/order.model.ts`
- `backend/src/modules/orders/services/order.service.ts`
- `backend/src/modules/orders/dto/order.dto.ts`

**Changes:**
- Added `IStockReservation` interface and `stockReservationSchema` sub-schema to track which BranchProduct was decremented for each order item
- `Order.create()` now builds `stockReservations[]` during stock decrement
- **BUG FIX (Critical):** `cancel()` was restoring stock to `Product` (global model) instead of `BranchProduct`. Fixed to use `restoreStock()` that reads `stockReservations` and increments the correct `BranchProduct` via `$inc`
- `updateStatus()` now also restores stock when admin sets status to `CANCELLED`
- Legacy fallback: orders without `stockReservations` fall back to `BranchProduct.findOne()` by product ID
- Changed `vehicle: ObjectId` (singular) to `vehicles: [ObjectId]` (array) for multi-vehicle support
- Added `vehicles?: string[]` to `CreateOrderDto`, with backwards compatibility for `vehicle?: string`
- All `.populate('vehicle', ...)` calls updated to `.populate('vehicles', ...)`
- `toResponse()` includes `vehicles[]`, `vehicle` (deprecated compat), `stockReservations`, `billingAddress`

#### Phase 3: Frontend — Models & CheckoutService

**Files Modified:**
- `frontend/src/app/models/order.model.ts`
- `frontend/src/app/features/checkout/services/checkout.service.ts`

**Changes:**
- `CreateOrderRequest.vehicle` → `CreateOrderRequest.vehicles?: string[]`
- `Order` interface now includes `vehicles[]` array
- `CheckoutState.selectedVehicle` → `CheckoutState.selectedVehicles: Vehicle[]`
- New methods: `addVehicle()`, `removeVehicle()`, `toggleVehicle()`, `clearVehicles()`
- Deprecated compat: `selectedVehicle` and `hasVehicle` computed signals read from `selectedVehicles[0]`
- Branch selection now preserved for ALL dispatch types (not just pickup/in-store)

#### Phase 4: Seller Agreement Auto-fill

**Files Modified:**
- `frontend/src/app/features/checkout/checkout-seller-agreement-form/checkout-seller-agreement-form.component.ts`
- `frontend/src/app/features/checkout/checkout-seller-agreement-form/checkout-seller-agreement-form.component.html`
- `frontend/src/app/features/checkout/checkout-seller-agreement-form/checkout-seller-agreement-form.component.scss`

**Changes:**
- Added `AuthService` injection and `lockedFields` signal
- Implemented `loadSavedData()`, `prefillFromUserProfile()`, `hasLockedFields()`, `unlockPersonalFields()`, `clearPersonalFields()` — same pattern as local-delivery-form and oil-change-form
- Upgraded validators: phone → Venezuelan regex (`/^(0414|0424|0412|0416|0426)\d{7}$/`), documentNumber → `/^\d{6,10}$/`
- Added "Editar datos" / "Limpiar campos" buttons with edit/refresh SVG icons
- Dark mode support for `.clear-section-btn`

#### Phase 5: Checkout Summary (Branch Universal, Multi-Vehicle, Billing)

**Files Modified:**
- `frontend/src/app/features/checkout/checkout-summary/checkout-summary.component.ts`
- `frontend/src/app/features/checkout/checkout-summary/checkout-summary.component.html`
- `frontend/src/app/features/checkout/checkout-summary/checkout-summary.component.scss`
- `frontend/src/app/features/checkout/checkout-dispatch/checkout-dispatch.component.ts`

**Changes:**
- **Branch Selection Universal:** `needsBranchSelection` now returns true for ALL dispatch types when `branches().length > 1`. New `isBranchMandatory` computed for pickup/in-store validation only
- **Multi-Vehicle UI in oil-change-form:** Vehicle cards with toggle selection, "Agregar nuevo vehículo" button with inline `VehicleFormComponent` reuse. Summary shows read-only vehicle list
- **Billing Address Toggle:** 3 radio buttons (shipping address / profile / custom), inline form for custom, auto-populate from dispatch info or user profile
- **Dispatch routing:** `seller_agreement` now routes to `/checkout/vendedor` (form) instead of directly to summary
- `executeOrder()` sends `vehicles: string[]` instead of `vehicle: string`
- Payment proof upload: replaced TODO with actual `UploadService.uploadImage()` call before payment submission

#### Phase 6: Global — Required Field Asterisks

**File Modified:**
- `frontend/src/styles.scss`

**Change:**
- Added `.required { color: inherit !important; }` global rule so asterisks match label text color instead of red

### 2.2 Dispatch Options Reordering

**File Modified:**
- `frontend/src/app/features/checkout/services/checkout.service.ts`

**Change:**
- Oil change options (Cambio de Aceite a Domicilio, Cambio de Aceite en Tienda) moved to TOP of dispatch options list, before Retiro en Tienda

### 2.3 Oil Change Form — Multi-Vehicle Selection

**Files Modified:**
- `frontend/src/app/features/checkout/checkout-oil-change-form/checkout-oil-change-form.component.ts`
- `frontend/src/app/features/checkout/checkout-oil-change-form/checkout-oil-change-form.component.html`
- `frontend/src/app/features/checkout/checkout-oil-change-form/checkout-oil-change-form.component.scss`

**Changes:**
- Replaced single vehicle selector with multi-vehicle toggle cards
- Added inline `VehicleFormComponent` for creating vehicles during checkout
- Added vehicle empty state with warning styling
- Dark mode for vehicle add button and empty state

### 2.4 Orders Management Upgrade (6 Phases)

#### Backend Endpoints

**Files Modified:**
- `backend/src/modules/orders/dto/order.dto.ts` — `UpdateDispatchStatusDto`, `UpdateNotesDto`, `search` in `OrderQueryDto`
- `backend/src/modules/orders/services/order.service.ts` — `updateDispatchStatus()`, `updateNotes()`, search regex in `findByUser()` and `findAll()`
- `backend/src/modules/orders/controllers/order.controller.ts` — New handlers, search param
- `backend/src/modules/admin/routes/orders.routes.ts` — `PATCH /:id/dispatch-status`, `PATCH /:id/notes`

#### Frontend — User Order List

**Files Modified:**
- `frontend/src/app/features/orders/order-list/order-list.component.ts`
- `frontend/src/app/features/orders/order-list/order-list.component.html`
- `frontend/src/app/features/orders/order-list/order-list.component.scss`
- `frontend/src/app/core/services/order.service.ts`

**Changes:**
- **Pagination:** `currentPage`, `totalPages`, `totalItems` signals with prev/next/numbered page buttons
- **Status Filters:** Dropdown with "Todas", "Pendientes", "Confirmadas", "En Proceso", "Enviadas", "Completadas", "Canceladas"
- **Search:** Input with 300ms debounce, searches by order number
- **Billing Address Display:** New section showing source, name, address, location
- **Dispatch Status Badge:** Shows assigned/in_progress/completed in detail modal
- **Mechanic Info:** Shows mechanic name and phone for oil change orders
- **Order Notes:** Displays user notes when present
- **Payment Proof Upload:** Functional upload via `UploadService.uploadImage()` before saving payment
- **Cancel Order Modal:** Custom modal with warning icon, descriptive text about admin notification and refund process (replaced native `confirm()`)
- **Cancel Link Redesign:** Inline text with embedded link instead of standalone button

#### Frontend — Admin Order Detail

**Files Modified:**
- `frontend/src/app/features/admin/orders/order-detail/admin-order-detail.component.ts`
- `frontend/src/app/features/admin/orders/order-detail/admin-order-detail.component.html`
- `frontend/src/app/features/admin/orders/order-detail/admin-order-detail.component.scss`
- `frontend/src/app/features/admin/orders/order-list/admin-order-list.component.ts`
- `frontend/src/app/features/admin/orders/order-list/admin-order-list.component.html`
- `frontend/src/app/features/admin/orders/order-list/admin-order-list.component.scss`

**Changes:**
- **Dispatch Status Modal:** New modal with dropdown (pending/assigned/in_progress/completed) and optional note
- **Billing Address Section:** New card showing source, name, document, address, location
- **Notes Editing:** Inline editable textarea in "Información General" with save/cancel buttons
- **Search:** Input with 300ms debounce in admin order list
- **Dispatch labels updated:** Added oil_change_service and in_store_oil_change labels
- **"Estado Despacho" button** in header actions

### 2.5 Product Catalog — Filter Fix

**File Modified:**
- `frontend/src/app/layouts/pages/tu-bus-servicio/components/tubus-combos/tubus-combos.component.ts`

**Change:**
- Category filter matching now checks `cat.id`, `cat._id`, and `cat.slug` to handle all serialization variants from Mongoose populated subdocuments

### 2.6 Product Seed

**Files Created/Modified:**
- `backend/src/seeds/product.seed.ts` (NEW)
- `backend/src/server.ts`
- `backend/jest.config.ts` (NEW)

**Changes:**
- Created idempotent seed with 4 categories, 6 brands, 25 products (5 car oils, 5 moto oils, 5 oil filters, 5 car combos, 5 moto combos)
- Categories and brands use `findOneAndUpdate` with `$setOnInsert` + `upsert: true`
- Products use `findOne` by SKU — skip if exists, create if not
- Auto-runs on server startup after `cityService.seedCities()`

### 2.7 Product Detail — Critical Fixes

**Files Modified:**
- `frontend/src/app/features/product-detail/product-detail.component.ts`
- `frontend/src/app/features/product-detail/product-detail.component.html`

**Fixes:**
1. **Memory leak (Critical):** All subscriptions now use `takeUntilDestroyed(this.destroyRef)` — prevents race conditions after OAuth redirect
2. **Broken image fallback:** Added `(error)="onImageError($event)"` to all 3 `<img>` tags with placeholder fallback
3. **Route validation:** Handles missing/undefined ID param gracefully
4. **Stock flash fix:** `productStock` signal starts as `null` (loading) instead of `0`, so "Agotado" doesn't flash during async load
5. **SVG icon bug:** Changed `class="out-of-stock-label"` to `class="out-of-stock-text"` to match existing SCSS (was causing the prohibition icon to render at full size)
6. **Stock after OAuth:** Added `effect()` that reactively reloads stock AND related products when `LocationService.branchIds` resolve post-login
7. **Related products stock:** `loadRelatedProducts()` now passes `branchIds` to the API so `totalStock` is calculated correctly

### 2.8 UX Enhancements

#### Logout Confirmation Modal
**Files Modified:**
- `frontend/src/app/shared/components/user-menu/user-menu.component.ts`
- `frontend/src/app/shared/components/user-menu/user-menu.component.html`
- `frontend/src/app/shared/components/user-menu/user-menu.component.scss`

**Change:** "Cerrar Sesión" button now opens a confirmation modal with icon, title, message, and "Cancelar" / "Cerrar Sesión" buttons. Dark mode supported.

#### Google Login Loading State
**Files Modified:**
- `frontend/src/app/shared/components/auth-modal/auth-modal.component.ts`
- `frontend/src/app/shared/components/auth-modal/auth-modal.component.html`

**Change:** Google OAuth button shows spinner + "Conectando..." and disables on click to prevent double-click.

#### Branch WhatsApp Optional
**Files Modified:**
- `backend/src/modules/branches/models/branch.model.ts`
- `backend/src/modules/branches/interfaces/branch.interface.ts`
- `frontend/src/app/features/admin/branches/branch-form/branch-form.component.ts`

**Change:** `whatsappPhone` field changed from required to optional in model, interface, and form validation.

#### Multi-Vehicle Display in Orders
**Files Modified:**
- `frontend/src/app/features/orders/order-list/order-list.component.html`
- `frontend/src/app/features/admin/orders/order-detail/admin-order-detail.component.ts`

**Change:** Order views now iterate `order.vehicles[]` array and display multiple vehicles with fallback to deprecated `order.vehicle`.

---

## 3. Technical Flow & Components

### Stock Reservation Lifecycle
```
Order Created → BranchProduct.stock decremented → stockReservations[] saved in Order
    ↓
Admin Approves (CONFIRMED) → stock stays decremented (no action)
    ↓
Admin Rejects (CANCELLED) → restoreStock() reads stockReservations → BranchProduct.$inc
User Cancels (PENDING only) → same restoreStock() flow
```

### Multi-Vehicle Checkout Flow
```
Oil Change Form → user toggles vehicle cards (multi-select)
    → can add new vehicle inline (VehicleFormComponent)
    → vehicles stored in CheckoutService.selectedVehicles[]
    ↓
Checkout Summary → read-only vehicle display
    ↓
executeOrder() → sends vehicles: selectedVehicles.map(v => v.id)
    ↓
Backend → validates ownership of ALL vehicles → stores in Order.vehicles[]
```

### Billing Address Flow
```
Checkout Summary → 3 radio buttons:
    "Dirección de envío" → buildBillingFromShipping() (conditional)
    "Dirección de perfil" → buildBillingFromProfile()
    "Nueva dirección" → inline reactive form
    ↓
setBillingAddress({ source, fullName, docType, docNumber, address, city, ... })
    ↓
Included in CreateOrderRequest.billingAddress
    ↓
Stored in Order.billingAddress subdocument
    ↓
Displayed in user order detail + admin order detail
```

---

## 4. Limitations & Edge Cases

- **Stock reservation without MongoDB transactions:** Race conditions possible under high concurrency (two simultaneous orders for last item). Future improvement: use MongoDB transactions.
- **Legacy orders:** Orders created before stockReservations implementation use fallback restore logic that may not target the exact BranchProduct.
- **OAuth redirect:** Full page reload during Google OAuth means all component state is lost. The `effect()` pattern handles re-initialization but adds a brief loading state.
- **Product seed idempotency caveat:** If admin deletes a seeded category/brand, it will be recreated on next server restart due to upsert pattern.
- **Payment proof upload:** If Cloudinary upload fails, payment submission proceeds without proof (graceful degradation).

---

## 5. Integration Guide & Future Improvements

### For Frontend Developers
- All vehicle selection uses `CheckoutService.addVehicle()` / `removeVehicle()` / `toggleVehicle()`. The deprecated `selectVehicle()` still works but sets a single-element array.
- Branch selection is now universal. Use `isBranchMandatory()` to determine if validation should block order creation.
- Product detail stock loading is reactive via `effect()`. No manual reload needed after auth state changes.

### For Backend Developers
- New admin endpoints: `PATCH /admin/orders/:id/dispatch-status`, `PATCH /admin/orders/:id/notes`
- Search support: `?search=TBS-2026` in both user and admin order endpoints
- `stockReservations` array in Order schema tracks exact BranchProduct decrements for accurate restoration

### Recommended Next Steps
1. Add MongoDB transactions to order creation for atomic stock operations
2. Implement email notifications for order status changes
3. Add payment approval/rejection workflow in admin (backend endpoint exists: `POST /admin/payments/:id/review`)
4. Remove dead mock data in `tubus-combos` component (`COMBOS`, `BRANDS` constants)
5. Add rate limiting to order creation endpoint

---

## 6. Test Coverage

| Suite | Framework | Tests | Status |
|-------|-----------|:-----:|:------:|
| OrderService (backend) | Jest 29.7 | 19 | PASS |
| CheckoutService (frontend) | Jasmine/Karma | 18 | PASS |
| App component (frontend) | Jasmine/Karma | 2 | PASS |
| **Total** | | **39** | **ALL PASS** |

### Backend Tests Cover:
- Stock decrement with/without selected branch
- Stock insufficient error
- Disclaimer validation
- Multi-vehicle ownership validation
- Legacy vehicle field normalization
- Cancel with stockReservations restore
- Cancel legacy fallback restore
- Authorization checks (user ownership, pending-only)
- Admin status change → stock restore on CANCELLED
- Admin status change → no restore on CONFIRMED
- Dispatch status update (valid, invalid, not found)
- Notes update
- toResponse with vehicles array and deprecated compat

### Frontend Tests Cover:
- Multi-vehicle: add, remove, toggle, clear, duplicates, deprecated compat
- Dispatch: branch preserved for all types, vehicles cleared on non-oil-change
- Billing address: 3 sources (shipping, profile, custom)
- Reset: full state clear on resetCheckout and clearDispatchType

### Compilation:
- Backend `tsc --noEmit` → 0 errors
- Frontend `ng build` → 0 errors, 0 warnings
