# Phase 3: Admin — Order List Redesign

> **Status:** COMPLETED
> **Estimated files:** 3
> **Depends on:** Phase 2

---

## 1. Objective

Redesign the admin order list to show richer information per row and restrict
badges/filters to the 5 Order Status values only.

---

## 2. Current Problems (from screenshot)

1. Table is very basic: only Order#, Client, Total, Status, Date
2. Status badges show mixed states (mechanic, dispatch, and order combined)
3. Missing: dispatch type, product count, payment status
4. No visual distinction between order types
5. Row has no secondary info (dispatch type icon, item count)

---

## 3. New Design Specification

### 3.1 Table Columns

| Column | Content | Width |
|--------|---------|-------|
| **Orden** | Order number + dispatch type icon/label below | 25% |
| **Cliente** | Name + email below | 20% |
| **Productos** | Item count badge (e.g. "3 items") | 10% |
| **Total** | Dollar amount | 10% |
| **Estado** | Order status badge (5 values ONLY) | 15% |
| **Fecha** | Formatted date | 20% |

### 3.2 Dispatch Type Visual Indicators

Small colored chip below order number:
- `store_pickup` → "Retiro en Tienda" (gray chip)
- `shipping_agency` → "Agencia de Envio" (blue chip)
- `local_delivery` → "Delivery Local" (purple chip)
- `seller_agreement` → "Acordar con Vendedor" (amber chip)
- `oil_change_service` → "Cambio Aceite" (green chip)
- `in_store_oil_change` → "Cambio en Tienda" (teal chip)

### 3.3 Status Filter

Only 5 options + "Todos":
- Todos
- Pendiente
- Aprobada
- Completada
- Cancelacion Solicitada
- Cancelada

### 3.4 Row Hover

Clickable row with subtle hover effect (already exists, keep).

---

## 4. Files to Modify

### 4.1 `admin-order-list.component.ts`

```
UPDATE adminFilterStatuses:
  Remove: DISPATCHED, MECHANIC_ASSIGNED, IN_SERVICE, EN_ROUTE
  Keep: PENDING, APPROVED, COMPLETED, CANCELLATION_REQUESTED, CANCELLED

ADD getDispatchLabel(type: string): string
ADD getDispatchChipClass(type: string): string
ADD getItemCount(order: Order): number
```

### 4.2 `admin-order-list.component.html`

```
REDESIGN table:
  - Order column: number + dispatch type chip
  - Client column: name + email
  - Products column: item count
  - Total column: price
  - Status column: badge (5 values only)
  - Date column: formatted date
```

### 4.3 `admin-order-list.component.scss`

```
ADD styles:
  - dispatch-chip classes (per type)
  - product count badge
  - enhanced table row spacing
  - responsive improvements
```

---

## 5. Validation Checklist

- [ ] Status filter shows exactly 6 options (Todos + 5 statuses)
- [ ] Badge only shows Order Status values
- [ ] Dispatch type chip displays correctly for all 6 types
- [ ] Table is readable and aligned
- [ ] Dark mode works correctly
- [ ] Click to detail still navigates properly
- [ ] Pagination still works
- [ ] Search still works

---

## 6. Execution Order

```
1. Update component TS (filters, helpers)
2. Rewrite template HTML (new table structure)
3. Update SCSS (new styles)
4. Visual verification in browser
```
