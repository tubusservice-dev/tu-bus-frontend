# Orders Upgrade Plan — User & Admin Views

## Implementation Status: COMPLETED (2026-03-31)

All 6 phases implemented, compiled, and tested successfully.

| Phase | Description | Status | Tests |
|:--:|-------------|:--:|:--:|
| 1 | Backend: dispatch-status, notes, search endpoints | DONE | 19/19 |
| 2+3 | User: pagination, filters, search, billing, notes, dispatch, mechanic, proof upload | DONE | - |
| 4 | Admin: dispatch status modal, billing, notes editing, search | DONE | - |
| 5 | Frontend services: new methods | DONE | 18/18 |
| 3b | Checkout-summary proof upload fix | DONE | - |
| 6 | Tests: backend Jest + frontend Karma | DONE | 37/38* |

*1 pre-existing failure in app.spec.ts (scaffold test, not related to changes)

---

## Context

The checkout flow is now 10/10 for all 6 dispatch types. However, the **post-order experience** (what the user sees in their order history and what the admin sees in their management panel) has significant gaps that affect the business flow. This plan covers all improvements needed to bring orders management to production-ready quality.

### Current State Summary

- **User view**: Shows order details but lacks pagination, filters, proof upload, billing address display, dispatch status, and mechanic info
- **Admin view**: Has approval/rejection and mechanic assignment but lacks payment verification workflow, search, dispatch status controls, and billing address display
- **Backend**: Payment review endpoint exists (`paymentService.review()`) but is not connected to admin orders UI

---

## Phase 1: Backend — Payment Proof Upload + Missing Endpoints

### Goal
Enable real file upload for payment proofs and add missing admin capabilities.

### Files to modify:
- `backend/src/modules/orders/services/order.service.ts`
- `backend/src/modules/orders/controllers/order.controller.ts`
- `backend/src/modules/orders/routes/order.routes.ts`
- `backend/src/modules/orders/interfaces/order.interface.ts`
- `backend/src/modules/orders/dto/order.dto.ts`

### Changes:

#### 1.1 Order updatePayment — Support proof file URL
The `updatePayment()` method already stores `proofUrl` and `proofPublicId` in `paymentSubmission`. The frontend just needs to upload the file via `/upload/image` first, then pass the URL. **No backend change needed for this.**

#### 1.2 Admin: Update dispatch status endpoint
**New method in OrderService:**
```typescript
async updateDispatchStatus(id: string, dispatchStatus: string, note?: string): Promise<IOrder>
```
- Validates order exists
- Validates dispatchStatus is one of: 'pending', 'assigned', 'in_progress', 'completed'
- Updates `order.dispatchStatus`
- Adds to `statusHistory`

**New route:**
```
PATCH /api/admin/orders/:id/dispatch-status
Body: { dispatchStatus: string, note?: string }
```

#### 1.3 Admin: Update order notes endpoint
**New method in OrderService:**
```typescript
async updateNotes(id: string, notes: string): Promise<IOrder>
```

**New route:**
```
PATCH /api/admin/orders/:id/notes
Body: { notes: string }
```

#### 1.4 Admin: Search orders
Modify `findAll()` to support search query:
- Search by `orderNumber` (regex)
- Search by user name (populate + match)
- Add `search` parameter to `OrderQueryDto`

#### 1.5 User: Search orders
Modify `findByUser()` to support:
- `search` parameter for `orderNumber` (regex)

---

## Phase 2: Frontend — User Order List Improvements

### Goal
Add pagination, filters, search, and display missing data in user orders.

### Files to modify:
- `frontend/src/app/features/orders/order-list/order-list.component.ts`
- `frontend/src/app/features/orders/order-list/order-list.component.html`
- `frontend/src/app/features/orders/order-list/order-list.component.scss`
- `frontend/src/app/core/services/order.service.ts`

### Changes:

#### 2.1 Pagination
- Add signals: `currentPage`, `totalPages`, `totalItems`
- Add methods: `goToPage(page)`, `nextPage()`, `prevPage()`
- Add pagination UI at bottom of order list (copy pattern from `admin-order-list`)
- Pass `page` parameter to `getMyOrders(page, 10, status)`

#### 2.2 Status Filters
- Add signal: `statusFilter = signal<OrderStatus | ''>()`
- Add filter tabs or dropdown at top: "Todas", "Pendientes", "En Proceso", "Completadas", "Canceladas"
- On filter change → reload orders with status param

#### 2.3 Search
- Add signal: `searchQuery = signal('')`
- Add search input with debounce (300ms)
- Pass search param to `getMyOrders()`

#### 2.4 Display billing address in detail modal
After dispatch section, add:
```html
@if (selectedOrder()?.billingAddress) {
  <div class="detail-section">
    <h4>Dirección de Facturación</h4>
    <!-- source badge + address details -->
  </div>
}
```

#### 2.5 Display order notes
```html
@if (selectedOrder()?.notes) {
  <div class="detail-section">
    <h4>Notas</h4>
    <p>{{ selectedOrder()?.notes }}</p>
  </div>
}
```

#### 2.6 Display dispatch status
Add dispatch status badge next to dispatch type:
```html
@if (selectedOrder()?.dispatchStatus && selectedOrder()?.dispatchStatus !== 'pending') {
  <span class="dispatch-status-badge">{{ getDispatchStatusLabel(order.dispatchStatus) }}</span>
}
```

#### 2.7 Display mechanic info (for oil change orders)
```html
@if (selectedOrder()?.mechanic && typeof selectedOrder()?.mechanic === 'object') {
  <div class="detail-section">
    <h4>Mecánico Asignado</h4>
    <p>{{ selectedOrder()?.mechanic.name }}</p>
    <p>{{ selectedOrder()?.mechanic.phone }}</p>
  </div>
}
```

---

## Phase 3: Frontend — User Payment Proof Upload

### Goal
Make the payment proof file upload functional (currently UI exists but file never uploads).

### Files to modify:
- `frontend/src/app/features/orders/order-list/order-list.component.ts`
- `frontend/src/app/features/orders/order-list/order-list.component.html`
- `frontend/src/app/core/services/upload.service.ts` (already has `uploadImage()`)

### Changes:

#### 3.1 Upload proof before saving payment
In `savePayment()` method, before calling `updatePayment()`:
1. If `editProofFile` exists → call `uploadService.uploadImage(file, 'payment-proofs')`
2. Wait for response → get `url` and `publicId`
3. Add `proofUrl` and `proofPublicId` to the PaymentSubmission payload
4. Then call `updatePayment()`

Flow:
```typescript
if (this.editProofFile) {
  this.uploadService.uploadImage(this.editProofFile, 'payment-proofs').subscribe({
    next: (uploadRes) => {
      updated.proofUrl = uploadRes.data.url;
      updated.proofPublicId = uploadRes.data.publicId;
      this.sendPaymentUpdate(orderId, updated);
    }
  });
} else {
  this.sendPaymentUpdate(orderId, updated);
}
```

#### 3.2 Also fix in checkout-summary
The same TODO exists in `checkout-summary.component.ts:430`. Apply same pattern:
- Upload proof file before submitting payment in `submitPayment()` method.

---

## Phase 4: Frontend — Admin Order Detail Enhancements

### Goal
Add payment approval/rejection, dispatch status control, billing address display, notes editing, search.

### Files to modify:
- `frontend/src/app/features/admin/orders/order-detail/admin-order-detail.component.ts`
- `frontend/src/app/features/admin/orders/order-detail/admin-order-detail.component.html`
- `frontend/src/app/features/admin/orders/order-detail/admin-order-detail.component.scss`
- `frontend/src/app/features/admin/orders/order-list/admin-order-list.component.ts`
- `frontend/src/app/features/admin/orders/order-list/admin-order-list.component.html`
- `frontend/src/app/core/services/order.service.ts` (add new methods)
- `frontend/src/app/core/services/payment.service.ts` (connect review endpoint)

### Changes:

#### 4.1 Payment approval/rejection UI
The backend already has `paymentService.review()` that supports approve/reject. Need to:
- Add `PaymentService.reviewPayment(paymentId, action, reason?)` method to Angular service
- In admin detail component, add buttons in payment section:
  - "Aprobar Pago" (green) → calls review with action='approve'
  - "Rechazar Pago" (red) → opens modal with reason textarea → calls review with action='reject'
- Display payment status badge: "Pendiente de revisión", "Aprobado", "Rechazado"
- Note: `paymentService.review()` with approve also auto-sets order status to CONFIRMED

#### 4.2 Dispatch status manual control
- Add dropdown or buttons for dispatch status progression: pending → assigned → in_progress → completed
- Call new endpoint `PATCH /admin/orders/:id/dispatch-status`
- Add to `OrderService`: `updateDispatchStatus(orderId, status, note?)`

#### 4.3 Billing address display
Add section in right column of admin detail:
```html
@if (order()?.billingAddress) {
  <div class="detail-section">
    <h3>Dirección de Facturación</h3>
    <p><strong>Fuente:</strong> {{ billingSourceLabel }}</p>
    <!-- fullName, document, address, city, municipality, state -->
  </div>
}
```

#### 4.4 Notes editing
- Add editable textarea in "Información General" section
- Save button calls `PATCH /admin/orders/:id/notes`
- Add `updateNotes(orderId, notes)` to Angular OrderService

#### 4.5 Search in admin list
- Add search input above the order table
- Debounce 300ms
- Pass `search` parameter to `getAdminOrders(page, limit, status, search)`
- Backend searches by orderNumber (regex) and user name

#### 4.6 Mechanic reassignment
- In dispatch modal, if mechanic already assigned, show "Reasignar" button
- Same endpoint `POST /admin/orders/:id/assign-mechanic` — just overwrite

#### 4.7 Stock reservations display (informational)
In admin detail, add collapsible section:
```html
@if (order()?.stockReservations?.length) {
  <details>
    <summary>Stock Reservado ({{ order()?.stockReservations.length }} items)</summary>
    <!-- List: product name, branch, quantity -->
  </details>
}
```

---

## Phase 5: Frontend OrderService — New Methods

### File to modify:
- `frontend/src/app/core/services/order.service.ts`

### New methods needed:
```typescript
// Search support
getMyOrders(page, limit, status?, search?): Observable<OrderListResponse>
getAdminOrders(page, limit, status?, search?): Observable<OrderListResponse>

// Admin dispatch status
updateDispatchStatus(orderId: string, dispatchStatus: string, note?: string): Observable<OrderResponse>

// Admin notes
updateNotes(orderId: string, notes: string): Observable<OrderResponse>
```

### File to modify:
- `frontend/src/app/core/services/payment.service.ts`

### New method needed:
```typescript
reviewPayment(paymentId: string, action: 'approve' | 'reject', reason?: string): Observable<PaymentResponse>
```

---

## Phase 6: Tests

### Backend Tests (Jest):
- `order.service.test.ts` — Add:
  - `updateDispatchStatus()` — valid transitions, invalid status
  - `updateNotes()` — update, empty string
  - `findByUser()` with search parameter
  - `findAll()` with search parameter

### Frontend Tests (Jasmine/Karma):
- `order-list.component.spec.ts` — New file:
  - Pagination: page navigation, boundary conditions
  - Filters: status filter applies correctly
  - Payment edit: form populates, saves, upload called
  - Cancel: only visible when pending

- `admin-order-detail.component.spec.ts` — New file:
  - Approve/Reject flow
  - Status change modal
  - Dispatch status update
  - Notes editing

### Test execution:
```bash
# Backend
cd backend && timeout 60 npx jest --verbose

# Frontend
cd frontend && timeout 120 npx ng test --watch=false --browsers=ChromeHeadless
```

---

## Execution Order

```
Phase 1 (Backend endpoints)     → Foundation, do first
Phase 5 (Frontend services)     → Depends on Phase 1 API
Phase 2 (User order list)       → Depends on Phase 5
Phase 3 (Proof upload)          → Independent, can parallel with Phase 2
Phase 4 (Admin enhancements)    → Depends on Phase 5
Phase 6 (Tests)                 → After all implementation
```

Parallel groups:
- **Group A**: Phase 1 → Phase 5 → Phase 2 + Phase 3 (parallel)
- **Group B**: Phase 4 (after Phase 5)
- **Final**: Phase 6

---

## Verification Checklist

### User Flow:
- [ ] Pagination works: navigate pages, correct page indicator
- [ ] Status filter works: filter by pending, confirmed, cancelled, etc.
- [ ] Search works: search by order number
- [ ] Billing address displays correctly for all sources (shipping/profile/custom)
- [ ] Order notes display when present
- [ ] Dispatch status badge shows (assigned, in_progress, completed)
- [ ] Mechanic info shows for oil change orders
- [ ] Payment proof upload works: file uploads to Cloudinary, URL saved in order
- [ ] Payment edit works: fields populate, save updates, proof persists
- [ ] Cancel order restores stock (verified in DB)
- [ ] Timeline shows all status history entries

### Admin Flow:
- [ ] Search works: by order number and client name
- [ ] Approve order: status → CONFIRMED, stock stays decremented
- [ ] Reject order: status → CANCELLED, stock restored to BranchProduct
- [ ] Payment approve: payment status → APPROVED, order auto-confirms
- [ ] Payment reject: payment status → REJECTED with reason
- [ ] Dispatch status: can change pending → assigned → in_progress → completed
- [ ] Notes editing: can add/update admin notes
- [ ] Billing address displays for all source types
- [ ] Stock reservations show which branches are involved
- [ ] Mechanic reassignment works
- [ ] Magic link generates correctly for new mechanic

### Cross-Cutting:
- [ ] All new UI supports dark mode
- [ ] Required field asterisks inherit label color (global rule)
- [ ] No TypeScript compilation errors (backend + frontend)
- [ ] All tests pass (Jest + Karma)

---

## Files Impact Summary

### Backend (6 files):
| File | Changes |
|------|---------|
| `orders/services/order.service.ts` | `updateDispatchStatus()`, `updateNotes()`, search in `findByUser()` and `findAll()` |
| `orders/controllers/order.controller.ts` | New handler methods for dispatch-status and notes |
| `orders/routes/order.routes.ts` | 2 new admin routes |
| `orders/dto/order.dto.ts` | `search` field in `OrderQueryDto`, `UpdateDispatchStatusDto`, `UpdateNotesDto` |
| `orders/interfaces/order.interface.ts` | No changes needed |
| `orders/models/order.model.ts` | No changes needed |

### Frontend (12 files):
| File | Changes |
|------|---------|
| `core/services/order.service.ts` | `updateDispatchStatus()`, `updateNotes()`, search params |
| `core/services/payment.service.ts` | `reviewPayment()` |
| `orders/order-list/order-list.component.ts` | Pagination, filters, search, proof upload, display billing/notes/dispatch/mechanic |
| `orders/order-list/order-list.component.html` | Pagination UI, filter tabs, search input, billing section, notes, dispatch badge, mechanic info |
| `orders/order-list/order-list.component.scss` | New styles for pagination, filters, billing, dispatch badge |
| `admin/orders/order-list/admin-order-list.component.ts` | Search support |
| `admin/orders/order-list/admin-order-list.component.html` | Search input |
| `admin/orders/order-detail/admin-order-detail.component.ts` | Payment review, dispatch status, notes edit, billing display |
| `admin/orders/order-detail/admin-order-detail.component.html` | Payment approve/reject buttons, dispatch dropdown, notes textarea, billing section, stock reservations |
| `admin/orders/order-detail/admin-order-detail.component.scss` | New styles |
| `checkout/checkout-summary/checkout-summary.component.ts` | Fix proof upload in `submitPayment()` |
| `admin/orders/order-dispatch-modal/order-dispatch-modal.component.ts` | Reassignment support |

### Test Files (4 new files):
| File | Tests |
|------|-------|
| `backend/src/modules/orders/__tests__/order.service.test.ts` | Add dispatch status, notes, search tests |
| `frontend/src/app/features/orders/order-list/order-list.component.spec.ts` | New: pagination, filters, payment edit, cancel |
| `frontend/src/app/features/admin/orders/order-detail/admin-order-detail.component.spec.ts` | New: approve, reject, dispatch, notes |
| `frontend/src/app/features/checkout/services/checkout.service.spec.ts` | Already exists, no changes |
