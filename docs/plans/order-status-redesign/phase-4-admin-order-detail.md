# Phase 4: Admin — Order Detail Redesign

> **Status:** COMPLETED
> **Estimated files:** 4
> **Depends on:** Phase 3

---

## 1. Objective

Redesign the admin order detail page to implement:
1. Approve/Cancel buttons when order is `pending`
2. Options menu (3-dot button) after approval/cancellation
3. Dispatch status selector for shipping/delivery orders
4. New "Vehicle" section with full client vehicle data
5. New "Service Tracking" section for oil change orders
6. New "Dispatch Tracking" section for shipping/delivery orders
7. Confirmation modals for ALL actions

---

## 2. Header Actions — State Machine

### When `status === 'pending'`:
```
  [Aprobar (green)]  [Cancelar (red)]
```
- Approve → confirmation modal → POST /approve → order becomes `approved`
- Cancel → confirmation modal with reason → PUT /status {cancelled} → order becomes `cancelled`

### When `status === 'approved'`:
```
  [Selector Despacho*]  [Asignar Mecanico**]  [... (options)]
```
- *Selector Despacho: only if `shipping_agency` or `local_delivery`
- **Asignar Mecanico: only if `oil_change_service` or `in_store_oil_change`
- Options menu: [Pendiente, Aprobada, Completada, Cancelada] — each with modal

### When `status === 'cancellation_requested'`:
```
  [Aprobar Cancelacion]  [Rechazar Cancelacion]  [... (options)]
```
- Approve cancellation → modal → sets status to `cancelled`
- Reject cancellation → modal → sets status to `pending`

### When `status === 'completed'` or `status === 'cancelled'`:
```
  [... (options)]
```
- Options menu only, allowing admin to revert if needed

---

## 3. Options Menu (3-dot button)

A dropdown menu with 4 entries:
- Pendiente → modal → sets status
- Aprobada → modal → sets status
- Completada → modal → sets status
- Cancelada → modal → sets status

Each option:
- Shows the status label with its color indicator
- Opens a confirmation modal with optional note textarea
- Includes loading state on confirm button
- Disabled if it's the current status

---

## 4. Dispatch Status Selector

Visible only when:
- `dispatchType` is `shipping_agency` or `local_delivery`
- `status` is `approved`
- `status` is NOT `cancelled`

UI: A styled select/dropdown with 3 options:
- Despachado
- En Transito
- Entregado

On selection → confirmation modal → PUT /dispatch-status

---

## 5. New Section: Vehicle Information

Visible when order has vehicles (populated from backend).

```
Section: "Vehiculo del Cliente"
  - Marca / Modelo
  - Year
  - Placa
  - Tipo de combustible
  - Cilindrada
  - Cilindros
  - Tipo de aceite
  - Capacidad de aceite (litros)
  - Kilometraje
```

Shows for ALL dispatch types that have vehicles, but most useful for oil change.

---

## 6. New Section: Dispatch Tracking

Visible only for `shipping_agency` and `local_delivery` orders.

```
Section: "Seguimiento del Despacho"
  Timeline with entries from dispatchStatusHistory:
    - Each entry: status badge + date + note
  Current status highlighted
  Empty state: "Aun no se ha despachado esta orden"
```

---

## 7. New Section: Service Tracking (Oil Change)

Visible only for `oil_change_service` and `in_store_oil_change` orders.

```
Section: "Seguimiento del Servicio"
  - Mechanic info card (name, avatar, whatsapp, phone)
  - Progress stepper (same visual as client service-tracking)
    - asignado → en_camino* → en_proceso → completado
    - *en_camino hidden for in_store_oil_change
  - Scheduled date and time range
  - Progress link (copyable)
  - Status descriptions for each completed step
  Empty state: "Aun no se ha asignado un mecanico"
```

---

## 8. Files to Modify

### 8.1 `admin-order-detail.component.ts`

```
ADD:
  - approveOrder() method with modal
  - cancelOrder() method with modal + reason
  - showOptionsMenu signal
  - openOptionsMenu / closeOptionsMenu
  - changeStatusFromMenu(status) with modal
  - updateDispatchStatus(status) with modal
  - dispatchSelectorValue signal
  - isApproving / isCancelling signals
  - showApproveModal / showCancelModal signals
  - showDispatchModal signal
  - showOptionsStatusModal signal
  - selectedMenuStatus signal
  - serviceAssignment signal (loaded from API)
  - loadServiceTracking() method

REWRITE:
  - Remove old status change logic
  - Remove old cancel modal logic
  - availableStatuses() → options menu statuses (all 4 except current)

UPDATE:
  - isMechanicAssigned() → check if mechanicAssignment exists
  - isOilChange() → use new isOilChangeOrder() helper
  - isShippingOrder() → new helper
```

### 8.2 `admin-order-detail.component.html`

```
REWRITE header actions section:
  - Conditional rendering based on order.status
  - Approve/Cancel buttons for pending
  - Dispatch selector for shipping orders
  - Mechanic button for oil change orders
  - Options menu (3-dot) for all after initial action

ADD new sections in detail grid:
  - Vehicle section (right column)
  - Dispatch tracking section (right column, conditional)
  - Service tracking section (right column, conditional)

ADD modals:
  - Approve confirmation modal
  - Cancel confirmation modal (with reason)
  - Options status change modal
  - Dispatch status change modal
```

### 8.3 `admin-order-detail.component.scss`

```
ADD styles:
  - .btn-approve (green button)
  - .btn-cancel-order (red button)
  - .options-menu (dropdown with 4 items)
  - .dispatch-selector (styled select)
  - .vehicle-section card styles
  - .dispatch-timeline styles
  - .service-tracking-section styles
  - .progress-stepper (mini version for admin)
```

### 8.4 `admin/orders/order-dispatch-modal/order-dispatch-modal.component.ts`

```
UPDATE:
  - On mechanic assignment, do NOT expect order.status change
  - The order remains 'approved' after mechanic is assigned
  - Reload service tracking data after assignment
```

---

## 9. Validation Checklist

- [ ] Pending order shows Approve + Cancel buttons
- [ ] Approve button opens confirmation modal with loading
- [ ] Cancel button opens modal with reason textarea
- [ ] After approval, buttons change to selector/mechanic + options
- [ ] Options menu shows 4 statuses, current one disabled
- [ ] Each options menu item opens confirmation modal
- [ ] Dispatch selector only visible for shipping/delivery orders
- [ ] Dispatch selector opens confirmation modal on change
- [ ] Vehicle section shows all engine data when available
- [ ] Dispatch tracking shows timeline from dispatchStatusHistory
- [ ] Service tracking shows progress stepper + mechanic info
- [ ] All modals have loading states
- [ ] All status changes trigger correct API calls
- [ ] Dark mode works on all new sections
- [ ] Print styles unaffected

---

## 10. Execution Order

```
1. Update component TS (new signals, methods, helpers)
2. Rewrite header actions in template
3. Add vehicle section template
4. Add dispatch tracking section template
5. Add service tracking section template
6. Add all modals
7. Add SCSS styles for new elements
8. Update dispatch modal component
9. Visual verification
```
