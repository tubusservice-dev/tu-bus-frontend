# Phase 5: Client — Order List & Detail

> **Status:** COMPLETED
> **Estimated files:** 6
> **Depends on:** Phase 2

---

## 1. Objective

Update the customer-facing order list and detail pages to:
1. Show only Order Status (5 values) in badges and filters
2. Add dispatch tracking section for shipping/delivery orders
3. Keep existing service tracking integration for oil change orders
4. Ensure cancel button only shows for `pending` orders

---

## 2. Order List Changes

### 2.1 `orders/order-list/order-list.component.ts`

```
UPDATE filterStatuses:
  Remove: DISPATCHED, MECHANIC_ASSIGNED
  New list:
    { value: '', label: 'Todas' }
    { value: 'pending', label: 'Pendientes' }
    { value: 'approved', label: 'Aprobadas' }
    { value: 'completed', label: 'Completadas' }
    { value: 'cancelled', label: 'Canceladas' }
```

### 2.2 `orders/order-list/order-list.component.html`

```
- Status badge already uses getStatusLabel() — will auto-update
- No major template changes needed
- Verify badge only renders Order Status values
```

---

## 3. Order Detail Changes

### 3.1 `orders/order-detail/order-detail.component.ts`

```
ADD imports:
  - DispatchStatus, DISPATCH_STATUS_LABELS, DISPATCH_STATUS_COLORS
  - DISPATCH_STATUS_DESCRIPTIONS
  - isShippingOrder, isOilChangeOrder helpers

ADD:
  - isShipping computed signal
  - hasDispatchTracking computed signal
  - dispatchTimelineEntries computed signal

UPDATE:
  - hasMechanic(): check mechanicAssignment exists (not order.status)
  - Remove references to old mechanic status values in order.status
  - getStatusLabel() now only maps 5 values
  - getStatusDescription() now only maps 5 values
```

### 3.2 `orders/order-detail/order-detail.component.html`

```
ADD new section after payment:
  "Seguimiento del Despacho" (only for shipping/delivery orders)
  - Shows when order.dispatchStatusHistory has entries
  - Timeline similar to status history but for dispatch
  - Current dispatch status badge highlighted
  - Each entry: badge + date + optional note
  - Empty state when no dispatch updates yet but order is approved

UPDATE "Estado de la Orden" section:
  - statusHistory only contains order-level statuses now
  - No change to template logic (already renders from array)

KEEP "Mecanico Asignado" section:
  - Already works correctly with mechanic data
  - No changes needed

KEEP "Cancel order" section:
  - Already checks status === 'pending' — correct
```

### 3.3 `orders/order-detail/order-detail.component.scss`

```
ADD styles:
  - .dispatch-tracking-section
  - .dispatch-timeline (entries, badges, dates)
  - .dispatch-status-badge colors
  - Dark mode variants
  - Print styles for dispatch section
```

---

## 4. Service Tracking (No changes expected)

### 4.1 `orders/service-tracking/service-tracking.component.ts`

```
- This component operates on MechanicAssignment data
- It does NOT read order.status for its stepper
- No changes needed unless mechanic-assignment model changed
```

---

## 5. Checkout Confirmation

### 5.1 `checkout/checkout-confirmation/checkout-confirmation.component.ts`

```
UPDATE getStatusLabel():
  - Now maps to 5 values only
  - 'pending' → 'Pendiente' (this is the only one shown at checkout)
```

---

## 6. Validation Checklist

- [ ] Order list filter shows exactly 5 options + "Todas"
- [ ] Order list badges only show 5 status values
- [ ] Order detail header badge shows only order status
- [ ] Dispatch tracking section appears for shipping/delivery orders
- [ ] Dispatch tracking section hidden for other order types
- [ ] Service tracking link still works for oil change orders
- [ ] Cancel button only visible when status is 'pending'
- [ ] Payment note section still works
- [ ] Print styles include dispatch tracking section
- [ ] Dark mode correct on new section
- [ ] No broken references to removed status values

---

## 7. Execution Order

```
1. Update order-list component (filters)
2. Update order-detail component (new section, helpers)
3. Add dispatch tracking template section
4. Add SCSS styles
5. Update checkout-confirmation labels
6. Visual verification
```
