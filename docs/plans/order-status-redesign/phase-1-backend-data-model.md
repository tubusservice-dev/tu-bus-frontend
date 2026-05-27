# Phase 1: Backend — Data Model & API Restructure

> **Status:** COMPLETED
> **Estimated files:** 14
> **Priority:** CRITICAL — all other phases depend on this

---

## 1. Objective

Restructure the backend order status system from a single monolithic enum into
three independent subsystems:

| System | Scope | Values |
|--------|-------|--------|
| **Order Status** | All orders | `pending`, `approved`, `completed`, `cancellation_requested`, `cancelled` |
| **Dispatch Status** | `shipping_agency` + `local_delivery` only | `dispatched`, `in_transit`, `delivered` |
| **Service Status** | `oil_change_service` + `in_store_oil_change` | Managed via existing `MechanicAssignment.progressSteps` |

---

## 2. Files to Modify

### 2.1 `backend/src/modules/orders/interfaces/order.interface.ts`

**Action:** Restructure enums and interfaces.

```
BEFORE (9 values):
  OrderStatus = pending | approved | dispatched | mechanic_assigned |
                en_route | in_service | completed |
                cancellation_requested | cancelled

AFTER (5 values):
  OrderStatus = pending | approved | completed |
                cancellation_requested | cancelled

NEW:
  DispatchStatus = dispatched | in_transit | delivered

NEW interface:
  IDispatchStatusEntry {
    status: DispatchStatus;
    timestamp: Date;
    note?: string;
  }

UPDATE IOrder:
  - Remove: dispatchStatus (legacy field)
  - Add: dispatchStatus?: DispatchStatus
  - Add: dispatchStatusHistory: IDispatchStatusEntry[]

UPDATE IOrderResponse:
  - Mirror changes from IOrder
  - Remove deprecated dispatchStatus field
```

### 2.2 `backend/src/modules/orders/models/order.model.ts`

**Action:** Update Mongoose schema.

```
Changes:
  1. Update status enum: Object.values(OrderStatus) — now 5 values
  2. Remove old dispatchStatus schema (legacy: pending/assigned/in_progress/completed)
  3. Add new dispatchStatus field:
     - type: String
     - enum: ['dispatched', 'in_transit', 'delivered']
     - required: false (only set for shipping/delivery orders)
  4. Add dispatchStatusHistory array schema:
     - status: String (enum DispatchStatus values)
     - timestamp: Date (default Date.now)
     - note?: String
  5. Add index: { dispatchStatus: 1 }
```

### 2.3 `backend/src/modules/orders/dto/order.dto.ts`

**Action:** Add new DTOs.

```
NEW:
  UpdateDispatchStatusDto {
    dispatchStatus: DispatchStatus;
    note?: string;
  }

UPDATE OrderQueryDto:
  - status filter uses new OrderStatus (5 values)
  - Add optional dispatchStatus filter
```

### 2.4 `backend/src/modules/orders/services/order.service.ts`

**Action:** Rewrite status transition logic.

```
REWRITE getAllowedTransitions():
  - No longer differentiates by isOilChange
  - PENDING → [APPROVED, CANCELLED]
  - APPROVED → [COMPLETED, CANCELLED]
  - CANCELLATION_REQUESTED → [CANCELLED, PENDING]
  - COMPLETED → [] (terminal, options menu can revert)
  - CANCELLED → [] (terminal, options menu can revert)

NEW METHOD updateDispatchStatus(id, dto):
  - Validate order exists
  - Validate order.dispatchType is 'shipping_agency' or 'local_delivery'
  - Validate order.status is 'approved' (dispatch only after approval)
  - Validate dispatch transition:
    - (none) → dispatched
    - dispatched → in_transit
    - in_transit → delivered
  - Update order.dispatchStatus
  - Push to order.dispatchStatusHistory
  - Save and return
  - Send user notification for dispatch update

UPDATE cancel():
  - Still only from PENDING → CANCELLATION_REQUESTED
  - No changes needed (already correct)

UPDATE updatePayment():
  - editableStatuses: [PENDING, APPROVED] — already correct

UPDATE create():
  - Still sets status = PENDING — no change

UPDATE toResponse():
  - Include new dispatchStatus and dispatchStatusHistory
  - Remove legacy dispatchStatus mapping

NEW METHOD approveOrder(id, note?):
  - Shortcut for updateStatus(id, { status: 'approved', note })
  - Validates current status is PENDING
  - Sends notification to user

NEW METHOD forceStatus(id, dto):
  - For the options menu: allows admin to set any of the 5 statuses
  - With confirmation modal data (note required for reversions)
  - Still validates basic sanity (can't approve a completed order without note)
```

### 2.5 `backend/src/modules/orders/controllers/order.controller.ts`

**Action:** Add new endpoints.

```
NEW METHODS:
  approveOrder(req, res, next)  — POST /admin/orders/:id/approve
  updateDispatchStatus(req, res, next) — PUT /admin/orders/:id/dispatch-status

UPDATE updateStatus():
  - Now handles the options menu (any of 5 statuses)
  - Validates transition via forceStatus() or getAllowedTransitions()
```

### 2.6 `backend/src/modules/admin/routes/orders.routes.ts`

**Action:** Add new routes.

```
EXISTING:
  GET    /           → getAllAdmin
  GET    /:id        → getById
  PUT    /:id/status → updateStatus
  PATCH  /:id/notes  → updateNotes

NEW:
  POST   /:id/approve         → approveOrder
  PUT    /:id/dispatch-status  → updateDispatchStatus
```

### 2.7 `backend/src/modules/mechanic-assignments/services/mechanic-assignment.service.ts`

**Action:** Decouple from OrderStatus.

```
CHANGES:
  1. Remove STEP_TO_ORDER_STATUS mapping
  2. Remove STEP_TO_DISPATCH_STATUS mapping (deprecated)
  3. In advanceProgress():
     - Remove: order.status = newOrderStatus
     - Remove: order.dispatchStatus = ... (deprecated)
     - Remove: order.statusHistory.push(...)
     - Add: ONLY when step === 'completado':
       order.status = OrderStatus.COMPLETED
       order.statusHistory.push({ status: 'completed', timestamp, note })
     - Intermediate steps (en_camino, en_proceso) NO LONGER mutate order.status
  4. In create():
     - Remove: order.status = MECHANIC_ASSIGNED
     - Remove: order.dispatchStatus = 'assigned'
     - Keep: order.mechanic, order.mechanicAssignment, order.mechanicToken
     - Keep: statusHistory push for "Mecanico asignado" (as note only, status stays approved)
     - WAIT: order.status stays as 'approved' (mechanic assignment doesn't change order status)
  5. In cancel():
     - Change: Reset order.status to APPROVED (not PENDING)
     - Because mechanic was assigned after approval
  6. In expireOverdueAssignments() and expireById():
     - Change: Reset order.status to APPROVED (not PENDING)
  7. Remove all order.dispatchStatus writes
```

### 2.8 `backend/src/modules/notifications/interfaces/notification.interface.ts`

**Action:** Add new notification type.

```
ADD to NotificationType:
  'order_approved'
  'dispatch_update'
```

### 2.9 `backend/src/modules/notifications/models/notification.model.ts`

**Action:** Update enum array.

```
ADD to enum: 'order_approved', 'dispatch_update'
```

### 2.10 `backend/src/modules/user-notifications/interfaces/user-notification.interface.ts`

**Action:** Add new notification types.

```
ADD to UserNotificationType:
  'order_approved'
  'dispatch_dispatched'
  'dispatch_in_transit'
  'dispatch_delivered'
```

### 2.11 `backend/src/modules/user-notifications/models/user-notification.model.ts`

**Action:** Update NOTIFICATION_TYPES array.

```
ADD: 'order_approved', 'dispatch_dispatched', 'dispatch_in_transit', 'dispatch_delivered'
KEEP: All existing types for backwards compatibility
```

### 2.12 `backend/src/modules/payments/services/payment.service.ts`

**Action:** Minor — verify status check.

```
Line 22: order.status !== OrderStatus.PENDING
  → Already correct. Payments only created for PENDING orders.
  No change needed.
```

### 2.13 `backend/src/modules/orders/services/order.service.ts` (notifications section)

**Action:** Update notification messages for new statuses.

```
UPDATE statusMessages in updateStatus():
  Remove: DISPATCHED, MECHANIC_ASSIGNED, EN_ROUTE, IN_SERVICE
  Keep: APPROVED, COMPLETED, CANCELLED
  Add: notification for approval with user-friendly message

NEW in updateDispatchStatus():
  Add dispatch-specific user notifications:
    dispatched  → "Tu orden ha sido despachada"
    in_transit  → "Tu orden esta en transito"
    delivered   → "Tu orden ha sido entregada"
```

### 2.14 `backend/src/scripts/migrate-order-statuses-v2.ts` (NEW)

**Action:** Create migration script.

```
Migration logic:
  1. Orders with status 'dispatched' → status='approved', dispatchStatus='dispatched'
  2. Orders with status 'mechanic_assigned' → status='approved'
  3. Orders with status 'en_route' → status='approved'
  4. Orders with status 'in_service' → status='approved'
  5. Orders with status 'confirmed' → status='approved' (legacy)
  6. Populate dispatchStatusHistory from statusHistory entries
  7. Clean statusHistory: remove entries with old status values
  8. Remove legacyDispatchStatus field from all documents
```

---

## 3. Validation Checklist

- [ ] `tsc --noEmit` passes with 0 errors
- [ ] All 5 OrderStatus values are consistent across enum, schema, and DTO
- [ ] All 3 DispatchStatus values are consistent
- [ ] `getAllowedTransitions()` returns correct sets for each state
- [ ] Dispatch status only settable on shipping_agency/local_delivery orders
- [ ] Dispatch status only settable when order is approved
- [ ] Mechanic assignment no longer mutates order.status (except completion)
- [ ] Stock restoration still triggers on CANCELLED
- [ ] User notifications fire for all status changes
- [ ] Admin notifications fire for cancellation requests
- [ ] Migration script handles all legacy statuses

---

## 4. Execution Order

```
1. Update interfaces (enums, types)        → order.interface.ts
2. Update DTOs                             → order.dto.ts
3. Update Mongoose schema                  → order.model.ts
4. Rewrite service logic                   → order.service.ts
5. Add controller methods                  → order.controller.ts
6. Add routes                              → orders.routes.ts
7. Decouple mechanic assignment            → mechanic-assignment.service.ts
8. Update notification types               → notification interfaces + models
9. Create migration script                 → migrate-order-statuses-v2.ts
10. Run tsc --noEmit                       → verify 0 errors
```
