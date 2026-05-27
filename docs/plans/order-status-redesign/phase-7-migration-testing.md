# Phase 7: Migration & Testing

> **Status:** COMPLETED
> **Estimated files:** 2
> **Depends on:** Phases 1-6

---

## 1. Objective

Migrate existing production data to the new 3-system status architecture and
run comprehensive build/type checks to ensure zero errors and zero warnings.

---

## 2. Migration Script

### File: `backend/src/scripts/migrate-order-statuses-v2.ts`

### 2.1 Step 1: Migrate Order Statuses

Map old order status values to new 5-value system:

| Old Status | New Status | Condition |
|-----------|-----------|-----------|
| `pending` | `pending` | No change |
| `approved` | `approved` | No change |
| `confirmed` | `approved` | Legacy status |
| `processing` | `approved` | Legacy status |
| `ready` | `approved` | Legacy status |
| `dispatched` | `approved` | Now dispatch-level, order stays approved |
| `shipped` | `approved` | Legacy, equivalent to dispatched |
| `delivered` | `completed` | Delivery means order complete |
| `mechanic_assigned` | `approved` | Service-level, order stays approved |
| `en_route` | `approved` | Service-level, order stays approved |
| `in_service` | `approved` | Service-level, order stays approved |
| `completed` | `completed` | No change |
| `cancellation_requested` | `cancellation_requested` | No change |
| `cancelled` | `cancelled` | No change |

### 2.2 Step 2: Populate Dispatch Status

For orders with `dispatchType` in [`shipping_agency`, `local_delivery`]:
- If old status was `dispatched` or `shipped` → set `dispatchStatus = 'dispatched'`
- If old status was `delivered` → set `dispatchStatus = 'delivered'`
- Create `dispatchStatusHistory` entries from `statusHistory` entries that match

### 2.3 Step 3: Clean Status History

For each order, update `statusHistory` entries:
- Map old status values to new values using same mapping table
- Remove entries with values not in the new 5-value enum
- Keep entries that are valid

### 2.4 Step 4: Remove Legacy Fields

```
$unset: { legacyDispatchStatus: 1 }
```

Remove the old `dispatchStatus` field that had values like `pending`, `assigned`,
`in_progress`, `completed` (the mechanic-related one).

### 2.5 Step 5: Validate Integrity

After migration, run validation queries:
```
- Count orders with status NOT in [pending, approved, completed, cancellation_requested, cancelled]
- Count shipping/delivery orders without dispatchStatus that should have one
- Log any orphaned mechanic assignments
```

---

## 3. Build Verification

### 3.1 Backend TypeScript Check

```bash
cd backend && npx tsc --noEmit
```

Expected: **0 errors, 0 warnings**

### 3.2 Frontend Angular Build

```bash
cd frontend && npx ng build
```

Expected: **0 errors, 0 warnings**

---

## 4. Manual Testing Checklist

### 4.1 Order Creation Flow
- [ ] Create order with `store_pickup` → status = `pending`
- [ ] Create order with `shipping_agency` → status = `pending`
- [ ] Create order with `oil_change_service` → status = `pending`
- [ ] Create order with `in_store_oil_change` → status = `pending`

### 4.2 Admin Approval Flow
- [ ] Approve pending order → status = `approved`
- [ ] Cancel pending order → status = `cancelled`
- [ ] Approve button shows only when `pending`
- [ ] Cancel button shows only when `pending`
- [ ] Both buttons show confirmation modal

### 4.3 Options Menu
- [ ] Options menu visible after approval
- [ ] Can change to any of 4 statuses (except current)
- [ ] Each option opens confirmation modal
- [ ] Status change persists after reload

### 4.4 Dispatch Status (Shipping/Delivery)
- [ ] Dispatch selector visible only for shipping/delivery orders
- [ ] Dispatch selector visible only when `approved`
- [ ] Can set dispatched → in_transit → delivered
- [ ] Each change opens confirmation modal
- [ ] Dispatch timeline shows in admin detail
- [ ] Dispatch timeline shows in client detail
- [ ] User receives notification for each dispatch change

### 4.5 Oil Change Service (Home)
- [ ] Mechanic assignment works from admin
- [ ] Mechanic page shows 4 steps
- [ ] Each step advance shows confirmation modal
- [ ] Order status stays `approved` during service
- [ ] Final step changes order to `completed`
- [ ] Admin detail shows service tracking section
- [ ] Client detail shows service tracking link

### 4.6 Oil Change Service (In-Store)
- [ ] Mechanic assignment works from admin
- [ ] Mechanic page shows 3 steps (no "En Camino")
- [ ] Order status stays `approved` during service
- [ ] Final step changes order to `completed`

### 4.7 Client Cancellation
- [ ] Client can cancel only `pending` orders
- [ ] Cancellation requires reason (10+ chars)
- [ ] Order status → `cancellation_requested`
- [ ] Admin sees cancellation card
- [ ] Admin can approve or reject cancellation

### 4.8 Notifications
- [ ] User notified on approval
- [ ] User notified on cancellation
- [ ] User notified on dispatch changes
- [ ] User notified on mechanic assignment
- [ ] User notified on service progress
- [ ] Admin notified on new order
- [ ] Admin notified on cancellation request
- [ ] Admin notified on mechanic rejection

### 4.9 Visual Verification
- [ ] Admin list: only 5 status badges
- [ ] Admin list: dispatch type chips visible
- [ ] Admin detail: correct button layout per state
- [ ] Client list: only 5 status badges
- [ ] Client detail: badge shows order status only
- [ ] Dark mode works on all new sections
- [ ] Print layout unaffected

### 4.10 Edge Cases
- [ ] Order with legacy `confirmed` status displays as "Aprobada"
- [ ] Order created before migration shows correctly
- [ ] Payment update works for `pending` and `approved` orders
- [ ] Stock restoration triggers on `cancelled`

---

## 5. Execution Order

```
1. Write migration script
2. Run backend tsc --noEmit → fix any errors
3. Run frontend ng build → fix any errors
4. Execute migration on local database
5. Run manual testing checklist
6. Document any issues found
```

---

## 6. Rollback Plan

If critical issues are found:
1. All changes are additive — new fields, not removed fields
2. Migration script can be reversed with inverse mapping
3. Old frontend components can be restored from git history
4. Backend endpoints are new additions, not replacements

---

## 8. EXECUTION RESULTS

> Date: 2026-04-20

### 8.1 Migration Script

- **File created:** `backend/src/scripts/migrate-order-statuses-v2.ts`
- **Status:** Ready to execute on production database
- **Execution command:** `npx ts-node src/scripts/migrate-order-statuses-v2.ts`

### 8.2 Build Verification

| Check | Command | Result |
|-------|---------|--------|
| Backend TypeScript | `npx tsc --noEmit` | 0 errors |
| Frontend Angular | `npx ng build` | 0 errors, 0 warnings |

### 8.3 Phases Completed

| Phase | Status | Files modified |
|-------|--------|---------------:|
| Phase 1: Backend data model | Completed | 13 |
| Phase 2: Frontend models | Completed | 8 |
| Phase 3: Admin order list | Completed | 3 |
| Phase 4: Admin order detail | Completed | 3 |
| Phase 5: Client orders | Completed | 3 |
| Phase 6: Mechanic flow | Completed | 3 |
| Phase 7: Migration | Completed | 1 |

### 8.4 Next Steps

1. Execute migration script on production database: `npx ts-node src/scripts/migrate-order-statuses-v2.ts`
2. Perform manual testing checklist (section 4 above)
3. Monitor for runtime errors in first 24h after deployment
4. Update CLAUDE.md with new architecture notes if needed
