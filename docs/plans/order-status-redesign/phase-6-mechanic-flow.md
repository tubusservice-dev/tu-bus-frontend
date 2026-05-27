# Phase 6: Mechanic — Flow Optimization

> **Status:** COMPLETED
> **Estimated files:** 4
> **Depends on:** Phase 1

---

## 1. Objective

Optimize the mechanic-facing progress page:
1. Add confirmation modals before each state advance
2. Remove "En Camino" step for in-store oil change orders
3. Ensure mechanic progress only sets order.status to COMPLETED on final step
4. Admin service tracking section fed by assignment data (not order.status)

---

## 2. Confirmation Modals

### Current behavior:
Mechanic clicks "Confirmar" → opens a single generic confirmation modal → advances.

### Required behavior:
Each step advance should open a **contextual confirmation modal** with:
- Step-specific title (e.g. "Confirmar que estas en camino?")
- Step-specific description explaining the action
- "Confirmar" button with loading state
- "Cancelar" button to dismiss

### Step-specific modal content:

| Step | Title | Description |
|------|-------|-------------|
| `en_camino` | "Confirmar en camino" | "Al confirmar, el cliente sera notificado de que te encuentras en camino." |
| `en_proceso` | "Iniciar servicio" | "Al confirmar, el cliente sera notificado de que el servicio ha comenzado." |
| `completado` | "Completar servicio" | "Al confirmar, el servicio se marcara como completado. Esta accion no se puede deshacer." |

---

## 3. In-Store Oil Change — Remove "En Camino"

### Backend change (Phase 1):
When creating a mechanic assignment for `in_store_oil_change`:
- `progressSteps` should be 3 steps instead of 4
- Remove `en_camino` from the steps array
- Steps: `asignado` → `en_proceso` → `completado`

### Frontend change:
- Mechanic progress page already renders from `assignment.progressSteps` array
- If `en_camino` is not in the array, it simply won't render
- No template change needed — it's data-driven

### Backend `mechanic-assignment.service.ts` change:
In `create()`:
```
const isInStore = order.dispatchType === 'in_store_oil_change';
const progressSteps = isInStore
  ? DEFAULT_PROGRESS_STEPS.filter(s => s.step !== 'en_camino')
  : DEFAULT_PROGRESS_STEPS.map(s => ({ ...s }));
```

---

## 4. Files to Modify

### 4.1 `frontend/src/app/features/mechanic-progress/mechanic-progress.component.ts`

```
UPDATE confirmAdvance():
  - Before opening modal, determine step-specific content
  - Set modal title and description based on next step

ADD:
  - confirmModalTitle signal
  - confirmModalDescription signal
  - Method to set modal content based on step name

UPDATE openConfirmModal():
  - Populate step-specific title and description before showing
```

### 4.2 `frontend/src/app/features/mechanic-progress/mechanic-progress.component.html`

```
UPDATE confirmation modal:
  - Use dynamic title (confirmModalTitle signal)
  - Use dynamic description (confirmModalDescription signal)
  - Keep existing button layout with loading state
```

### 4.3 `backend/src/modules/mechanic-assignments/services/mechanic-assignment.service.ts`

```
UPDATE create():
  - Check order.dispatchType for in_store_oil_change
  - Filter out 'en_camino' step if in-store
  - Adjust step count accordingly

UPDATE advanceProgress():
  - Only mutate order.status when step === 'completado':
    order.status = OrderStatus.COMPLETED
    order.statusHistory.push(...)
  - For all other steps: do NOT touch order.status
  - Still send notifications for each step change
```

### 4.4 `backend/src/modules/mechanic-assignments/interfaces/mechanic-assignment.interface.ts`

```
ADD:
  IN_STORE_PROGRESS_STEPS constant (3 steps, no en_camino)

KEEP:
  DEFAULT_PROGRESS_STEPS (4 steps, with en_camino)
```

---

## 5. Validation Checklist

- [ ] Mechanic page shows contextual confirmation modal for each step
- [ ] Modal title and description match the step being advanced
- [ ] In-store oil change shows 3 steps (no "En Camino")
- [ ] Home oil change shows 4 steps (with "En Camino")
- [ ] Advancing intermediate steps does NOT change order.status
- [ ] Completing final step changes order.status to COMPLETED
- [ ] User notifications still fire for each step
- [ ] Admin notifications still fire for each step
- [ ] Reject flow still works correctly
- [ ] Token expiration still works

---

## 6. Execution Order

```
1. Backend: Update interface (new constant)
2. Backend: Update create() in assignment service
3. Backend: Update advanceProgress() to decouple order.status
4. Frontend: Add step-specific modal content
5. Frontend: Update template modal
6. Test both flows (home + in-store)
```
