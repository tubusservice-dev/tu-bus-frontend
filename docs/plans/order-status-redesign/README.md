# Order Status System Redesign — 3 Independent Subsystems

> **Status:** ALL PHASES COMPLETED
> **Date:** 2026-04-20
> **Builds:** Backend 0 errors | Frontend 0 errors, 0 warnings

---

## Overview

Complete refactor of TuBus Express order management from a single monolithic
9-value status enum into three independent subsystems:

1. **Order Status** — universal lifecycle (5 values)
2. **Dispatch Status** — shipping/delivery only (3 values)
3. **Service Status** — oil change service (managed via MechanicAssignment.progressSteps)

---

## The 3 Systems

### System 1: Order Status (universal)

```
PENDING → APPROVED → COMPLETED
   │         │
   └─► CANCELLED ◄─┘
       ▲
PENDING ──► CANCELLATION_REQUESTED ──► CANCELLED
                                   ──► PENDING (admin rejects)
```

**Values:** `pending`, `approved`, `completed`, `cancellation_requested`, `cancelled`
**Scope:** All dispatch types
**Visibility:** Badge in order list + order detail header

### System 2: Dispatch Status (shipping/delivery only)

```
(none) → DISPATCHED → IN_TRANSIT → DELIVERED
```

**Values:** `dispatched`, `in_transit`, `delivered`
**Scope:** Only `shipping_agency` and `local_delivery` dispatch types
**Visibility:** New "Seguimiento del Despacho" section in admin + client detail

### System 3: Service Status (oil change only)

**Driven by:** `MechanicAssignment.progressSteps` (no order mutation during progress)

- **At-home (`oil_change_service`):** 4 steps → asignado, en_camino, en_proceso, completado
- **In-store (`in_store_oil_change`):** 3 steps → asignado, en_proceso, completado (no "en_camino")

**Final step (`completado`)** is the only one that mutates `order.status = COMPLETED`.
**Visibility:** New "Seguimiento del Servicio" section in admin + existing tracking page for client

---

## Phases Summary

| # | Phase | Files | Notes |
|---|-------|-------|-------|
| 1 | Backend Data Model & API | 13 | Enums, schema, service logic, routes, notifications |
| 2 | Frontend Models & Services | 8 | Enums, labels, colors, helpers, HTTP methods |
| 3 | Admin Order List Redesign | 3 | Richer table with dispatch chips + secondary indicator |
| 4 | Admin Order Detail Redesign | 3 | State-machine header, options menu, 3 new sections, 6 modals |
| 5 | Client Order Detail | 3 | Dispatch tracking section, updated status labels |
| 6 | Mechanic Flow Optimization | 3 | Contextual confirmation modals per step |
| 7 | Migration & Testing | 1 | Migration script v2, full verification |

**Total files modified/created:** 34

---

## Breaking Changes

### Backend

- `OrderStatus` enum reduced from 9 to 5 values (removed: `dispatched`, `mechanic_assigned`, `en_route`, `in_service`)
- Legacy `dispatchStatus` field (values: pending, assigned, in_progress, completed) **REPLACED** with new `DispatchStatus` enum (values: dispatched, in_transit, delivered)
- New field `dispatchStatusHistory: IDispatchStatusEntry[]` added to Order schema
- `STEP_TO_ORDER_STATUS` mapping removed from mechanic-assignment service
- `mechanic-assignment.service.ts`:
  - `create()` no longer sets `order.status = MECHANIC_ASSIGNED`
  - `advanceProgress()` only sets `order.status = COMPLETED` at final step
  - `cancel()` / `expireOverdueAssignments()` reset order to `APPROVED` (was `PENDING`)

### Frontend

- `OrderStatus` enum reduced to 5 values
- `DISPATCH_STATUS_LABELS` / `DISPATCH_STATUS_COLORS` repurposed for new `DispatchStatus` enum
- `isOilChangeService()` helper renamed to `isOilChangeOrder()`
- `getAvailableStatuses(dispatchType, currentStatus)` signature simplified to `getAvailableStatuses(currentStatus)`
- New helpers: `isShippingOrder`, `isInStoreOilChange`, `getOptionsMenuStatuses`, `getAvailableDispatchStatuses`

---

## New API Endpoints

```
PUT  /api/admin/orders/:id/force-status      — Force-set any of 5 OrderStatus values
PUT  /api/admin/orders/:id/dispatch-status   — Update DispatchStatus (shipping/delivery only)
```

---

## New UI Features

### Admin Order List
- Dispatch type chip under order number
- Client email below client name
- Product count column with quantity
- Secondary indicator badge (dispatch status or service progress)

### Admin Order Detail
- **Header state machine:**
  - `pending` → Aprobar + Cancelar buttons
  - `approved` → Dispatch selector (shipping) or Mechanic button (oil change) + Options menu
  - `cancellation_requested` → Approve/Reject cancellation buttons
  - `completed`/`cancelled` → Options menu only
- **New sections:** Vehicle info, Dispatch tracking, Service tracking
- **6 confirmation modals** for all actions

### Client Order Detail
- New "Seguimiento del Despacho" section with timeline (shipping/delivery only)
- Badges only show Order Status (5 values)

### Mechanic Progress Page
- Contextual confirmation modals per step (different title, description, button for each step)
- Final step has distinct green/emerald style
- In-store orders automatically show 3 steps (no "En Camino")

---

## Migration

### Script: `backend/src/scripts/migrate-order-statuses-v2.ts`

```bash
cd backend
npx ts-node src/scripts/migrate-order-statuses-v2.ts
```

### Data transformations:
- Legacy statuses (`confirmed`, `processing`, `ready`, `dispatched`, `shipped`, `mechanic_assigned`, `en_route`, `in_service`) → `approved`
- Legacy `delivered` → `completed`
- For shipping/delivery orders: extract `dispatchStatus` and `dispatchStatusHistory` from old statusHistory
- Clean statusHistory entries (remove invalid values)
- Remove legacy `dispatchStatus` field values (pending/assigned/in_progress/completed)

---

## Verification Results

| Check | Result |
|-------|--------|
| Backend `npx tsc --noEmit` | 0 errors |
| Frontend `npx ng build` | 0 errors, 0 warnings |

---

## Related Documentation

- [Phase 1: Backend Data Model](./phase-1-backend-data-model.md)
- [Phase 2: Frontend Models](./phase-2-frontend-models.md)
- [Phase 3: Admin Order List](./phase-3-admin-order-list.md)
- [Phase 4: Admin Order Detail](./phase-4-admin-order-detail.md)
- [Phase 5: Client Orders](./phase-5-client-orders.md)
- [Phase 6: Mechanic Flow](./phase-6-mechanic-flow.md)
- [Phase 7: Migration & Testing](./phase-7-migration-testing.md)
