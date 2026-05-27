# Phase 2: Frontend — Models & Services

> **Status:** COMPLETED
> **Estimated files:** 5
> **Depends on:** Phase 1

---

## 1. Objective

Update Angular models, enums, labels, colors, and HTTP services to match the
new backend 3-system architecture.

---

## 2. Files to Modify

### 2.1 `frontend/src/app/models/order.model.ts`

**Action:** Restructure enums, add DispatchStatus, update helpers.

```
REWRITE OrderStatus enum (5 values):
  PENDING = 'pending'
  APPROVED = 'approved'
  COMPLETED = 'completed'
  CANCELLATION_REQUESTED = 'cancellation_requested'
  CANCELLED = 'cancelled'

NEW DispatchStatus enum:
  DISPATCHED = 'dispatched'
  IN_TRANSIT = 'in_transit'
  DELIVERED = 'delivered'

NEW DispatchStatusEntry interface:
  status: DispatchStatus
  timestamp: string
  note?: string

UPDATE ORDER_STATUS_LABELS (5 entries):
  pending → 'Pendiente'
  approved → 'Aprobada'
  completed → 'Completada'
  cancellation_requested → 'Cancelacion Solicitada'
  cancelled → 'Cancelada'

NEW DISPATCH_STATUS_LABELS:
  dispatched → 'Despachado'
  in_transit → 'En Transito'
  delivered → 'Entregado'

UPDATE ORDER_STATUS_COLORS (5 entries):
  pending → yellow
  approved → blue
  completed → emerald
  cancellation_requested → orange
  cancelled → red

NEW DISPATCH_STATUS_COLORS:
  dispatched → purple
  in_transit → indigo
  delivered → emerald

UPDATE ORDER_STATUS_DESCRIPTIONS (5 entries):
  Rewrite descriptions for new status meanings

NEW DISPATCH_STATUS_DESCRIPTIONS:
  dispatched → 'Tu orden ha sido despachada.'
  in_transit → 'Tu orden esta en transito hacia su destino.'
  delivered → 'Tu orden ha sido entregada exitosamente.'

UPDATE Order interface:
  - status: OrderStatus (5 values only)
  - Add: dispatchStatus?: DispatchStatus
  - Add: dispatchStatusHistory?: DispatchStatusEntry[]
  - Remove: deprecated dispatchStatus (old type)

UPDATE getAvailableStatuses():
  - Remove Flow A / Flow B differentiation
  - Universal transitions:
    pending → [approved, cancelled]
    approved → [completed, cancelled]
    cancellation_requested → [cancelled, pending]

NEW getAvailableDispatchStatuses(current?):
  - null → [dispatched]
  - dispatched → [in_transit]
  - in_transit → [delivered]

NEW helpers:
  isShippingOrder(order): order.dispatchType in ['shipping_agency','local_delivery']
  isOilChangeOrder(order): order.dispatchType in ['oil_change_service','in_store_oil_change']
  isInStoreOilChange(order): order.dispatchType === 'in_store_oil_change'
  needsDispatchTracking(order): isShippingOrder && status === 'approved'

REMOVE:
  - DISPATCH_STATUS_LABELS (old deprecated)
  - DISPATCH_STATUS_COLORS (old deprecated)
  - isOilChangeService() (replaced by isOilChangeOrder)
```

### 2.2 `frontend/src/app/core/services/order.service.ts`

**Action:** Add new HTTP methods.

```
NEW METHODS:
  approveOrder(orderId: string, note?: string): Observable<OrderResponse>
    → POST /admin/orders/:id/approve { note }

  updateDispatchStatus(orderId: string, status: DispatchStatus, note?: string): Observable<OrderResponse>
    → PUT /admin/orders/:id/dispatch-status { dispatchStatus, note }

KEEP existing:
  updateOrderStatus() — for options menu
  cancelOrder() — client cancellation
  All other methods unchanged
```

### 2.3 `frontend/src/app/models/user-notification.model.ts`

**Action:** Add new notification types.

```
ADD to UserNotificationType:
  'order_approved'
  'dispatch_dispatched'
  'dispatch_in_transit'
  'dispatch_delivered'
```

### 2.4 `frontend/src/app/models/mechanic-assignment.model.ts`

**Action:** Minor type adjustments.

```
- Verify ProgressStep types still align with backend
- No major changes expected (service status lives in assignment, not order)
```

### 2.5 `frontend/src/app/core/services/mechanic-assignment.service.ts`

**Action:** No changes needed.

```
- Service already operates independently via accessToken
- Progress advancement doesn't interact with OrderStatus on frontend
```

---

## 3. Validation Checklist

- [ ] `ng build` passes with 0 errors, 0 warnings
- [ ] OrderStatus enum has exactly 5 values
- [ ] DispatchStatus enum has exactly 3 values
- [ ] All labels, colors, and descriptions are complete
- [ ] Order interface includes new fields
- [ ] New HTTP methods are typed correctly
- [ ] No broken imports across the app

---

## 4. Execution Order

```
1. Update order.model.ts (enums, interfaces, labels, helpers)
2. Update order.service.ts (new HTTP methods)
3. Update user-notification.model.ts
4. Verify mechanic-assignment.model.ts
5. Run ng build → verify 0 errors
```
