# Client Phases 7, 8, 9 — Summary, Orders & Testing

> **Status:** Pending
> **Phase 7 Depends on:** Phase 5 (Dispatch), Phase 6 (Forms)
> **Phase 8 Depends on:** Phase 1 (Backend), Phase 7
> **Phase 9 Depends on:** All previous phases
> **Estimated files:** 6 total

---

## PHASE 7 — Checkout Summary (~3 archivos)

### File: `frontend/src/app/features/checkout/checkout-summary/checkout-summary.component.ts`

### 7.1 Branch Selector

**When shown:**
- `store_pickup` → show ALL branches from `locationService.branches()`
- `in_store_oil_change` → show ONLY branches where `hasInStoreOilChange === true` (from `locationService.branchesWithOilChange()`)

**Auto-select logic:**
- If only 1 branch matches → auto-select, show read-only card
- If multiple → show selectable cards

**Implementation:**
```typescript
protected readonly locationService = inject(LocationService);

protected readonly availableBranches = computed(() => {
  const dispatch = this.checkoutService.dispatchType();
  if (dispatch === 'store_pickup') {
    return this.locationService.branches();
  }
  if (dispatch === 'in_store_oil_change') {
    return this.locationService.branchesWithOilChange();
  }
  return [];
});

protected readonly needsBranchSelection = computed(() => {
  const dispatch = this.checkoutService.dispatchType();
  return dispatch === 'store_pickup' || dispatch === 'in_store_oil_change';
});

// Auto-select if only one branch
ngOnInit(): void {
  // ... existing init
  effect(() => {
    const branches = this.availableBranches();
    if (branches.length === 1 && !this.checkoutService.selectedBranch()) {
      this.checkoutService.selectBranch(branches[0]);
    }
  });
}

selectBranch(branch: BranchSummary): void {
  this.checkoutService.selectBranch(branch);
}
```

### 7.2 Vehicle Display

**When shown:**
- `oil_change_service` or `in_store_oil_change` → show selected vehicle card
- If no vehicle selected → show warning + link back to form or inline selector

```typescript
protected readonly needsVehicle = computed(() => {
  const dispatch = this.checkoutService.dispatchType();
  return dispatch === 'oil_change_service' || dispatch === 'in_store_oil_change';
});
```

### 7.3 Billing Address Toggle

**When shown:** Always (for all dispatch types)

**3 options:**
```typescript
protected readonly billingAddressSource = signal<'shipping' | 'profile' | 'custom'>('profile');
protected readonly showCustomBillingForm = computed(() =>
  this.billingAddressSource() === 'custom'
);
```

**Logic:**
- `shipping`: Copy address from dispatch details (only if dispatch has address)
- `profile`: Copy from user profile
- `custom`: Show inline form (reuse address fields pattern)

**When `shipping` not available** (store_pickup, seller_agreement, in_store_oil_change):
- Default to `profile`, hide `shipping` option

```typescript
protected readonly canUsShippingAddress = computed(() => {
  const dispatch = this.checkoutService.dispatchType();
  return ['local_delivery', 'oil_change_service', 'shipping_agency'].includes(dispatch || '');
});
```

### 7.4 Updated `executeOrder()`

```typescript
private executeOrder(): void {
  const state = this.checkoutService.state();
  const items = this.cartService.items();

  // Validate branch selection if needed
  if (this.needsBranchSelection() && !state.selectedBranch) {
    this.errorMessage.set('Debes seleccionar una sucursal');
    return;
  }

  // Validate vehicle if needed
  if (this.needsVehicle() && !state.selectedVehicle) {
    this.errorMessage.set('Debes seleccionar un vehículo');
    return;
  }

  const orderData: CreateOrderRequest = {
    items: items.map(item => ({
      product: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      image: item.image,
    })),
    subtotal: this.cartService.subtotal(),
    shippingCost: this.shippingCost(),
    total: this.total(),
    dispatchType: state.dispatchType!,
    dispatchDetails: this.buildDispatchDetails(state),
    paymentMethod: state.paymentMethod!,
    paymentSubmission: this.paymentSubmission()!,
    disclaimerAccepted: state.disclaimerAccepted,
    vehicle: state.selectedVehicle?.id,
    selectedBranch: state.selectedBranch?.id,
    billingAddress: this.buildBillingAddress(state),
  };

  // ... submit order
}

private buildDispatchDetails(state: CheckoutState): DispatchDetails {
  const details: DispatchDetails = {};

  // Branch info (for pickup and in-store types)
  if (state.selectedBranch) {
    details.selectedBranchId = state.selectedBranch.id;
    details.selectedBranchName = state.selectedBranch.name;
    details.selectedBranchAddress = state.selectedBranch.address;
  }

  // Store pickup info
  if (state.dispatchType === 'store_pickup' || state.dispatchType === 'in_store_oil_change') {
    details.storeAddress = state.selectedBranch?.address || '';
    details.storeSchedule = ''; // build from schedule
  }

  // Shipping agency + recipient
  if (state.dispatchType === 'shipping_agency' && state.shippingRecipientInfo) {
    details.agencyName = state.selectedShippingAgency?.name || '';
    details.agencyId = state.selectedShippingAgency?.id || '';
    details.recipientName = state.shippingRecipientInfo.fullName;
    // ... rest of recipient fields
  }

  // Local delivery
  if (state.dispatchType === 'local_delivery' && state.localDeliveryRecipientInfo) {
    details.recipientName = state.localDeliveryRecipientInfo.fullName;
    details.recipientCity = state.localDeliveryRecipientInfo.cityName;
    details.recipientMunicipality = state.localDeliveryRecipientInfo.municipalityName;
    details.recipientAddress = state.localDeliveryRecipientInfo.address;
    // ... rest
  }

  // Oil change service
  if (state.dispatchType === 'oil_change_service' && state.oilChangeServiceInfo) {
    details.recipientName = state.oilChangeServiceInfo.fullName;
    details.recipientCity = state.oilChangeServiceInfo.cityName;
    details.recipientMunicipality = state.oilChangeServiceInfo.municipalityName;
    details.recipientAddress = state.oilChangeServiceInfo.address;
    // ... rest
  }

  return details;
}
```

### File: `frontend/src/app/features/checkout/checkout-summary/checkout-summary.component.html`

**New sections to add (before payment section):**

1. **Branch selector section** (conditional)
2. **Vehicle info card** (conditional)
3. **Billing address toggle** (always)

---

## PHASE 8 — Order Backend (~2 archivos)

### File: `backend/src/modules/orders/services/order.service.ts`

### 8.1 Stock Validation with BranchProduct

```typescript
// In create() method, after product validation:

// Import at top:
import { branchProductService } from '../../branch-products/services/branch-product.service';

// Stock validation:
if (data.selectedBranch) {
  // Validate stock at specific branch
  for (const item of data.items) {
    const bp = await BranchProduct.findOne({
      branch: data.selectedBranch,
      product: item.product,
      isActive: true,
    });
    if (!bp || bp.stock < item.quantity) {
      throw new AppError(
        `Stock insuficiente de "${item.name}" en la sucursal seleccionada`,
        400
      );
    }
  }

  // Decrement stock
  for (const item of data.items) {
    await branchProductService.updateStock(
      // Find BP id first
      (await BranchProduct.findOne({ branch: data.selectedBranch, product: item.product }))!._id.toString(),
      -item.quantity
    );
  }
} else {
  // For delivery/shipping: find any branch with stock and decrement
  // This is a simplified version — first available branch
  for (const item of data.items) {
    const bp = await BranchProduct.findOne({
      product: item.product,
      isActive: true,
      stock: { $gte: item.quantity },
    });
    if (!bp) {
      throw new AppError(`Stock insuficiente de "${item.name}"`, 400);
    }
    bp.stock -= item.quantity;
    await bp.save();
  }
}
```

### 8.2 Vehicle Validation
```typescript
// If vehicle provided, validate ownership
if (data.vehicle) {
  const Vehicle = (await import('../../vehicles/models/vehicle.model')).Vehicle;
  const vehicle = await Vehicle.findOne({ _id: data.vehicle, user: userId });
  if (!vehicle) {
    throw new AppError('Vehículo no encontrado o no pertenece al usuario', 400);
  }
}
```

### 8.3 Store Billing Address
```typescript
// In order creation object:
const orderData = {
  // ... existing fields
  billingAddress: data.billingAddress || undefined,
};
```

### File: `backend/src/modules/orders/interfaces/order.interface.ts`
- Ensure `IOrder` and `IOrderResponse` include `billingAddress` and updated `dispatchDetails`

---

## PHASE 9 — Testing & Verification

### 9.1 Compilation
```bash
cd backend && npx tsc --noEmit    # Expected: 0 errors
cd frontend && npx ng build       # Expected: 0 errors
```

### 9.2 Complete Flow Tests (6 paths)

| # | Flow | Steps | Expected |
|---|------|-------|----------|
| 1 | Store Pickup | Select zone → catalog → add product → checkout → store_pickup → select branch → pay → order | Order created with selectedBranch, stock decremented at that branch |
| 2 | Local Delivery | Select zone with delivery → add product → local_delivery → fill form → pay → order | Order with recipient info, stock decremented from zone branch |
| 3 | Shipping Agency | Select zone without coverage → add product → shipping_agency → select agency → fill form → pay → order | Order with agency + recipient, stock decremented from any branch |
| 4 | Oil Change Home | Select zone → add oil combo → oil_change_service → fill form + select vehicle → pay → order | Order with vehicle ref + recipient + municipality in zone |
| 5 | Oil Change Store | Select zone + branch has service → add oil combo → in_store_oil_change → select branch + vehicle → pay → order | Order with selectedBranch (hasInStoreOilChange) + vehicle |
| 6 | Zone Change | Select zone → add to cart → change zone → confirm → cart emptied → new zone | Cart cleared, new products loaded |

### 9.3 Edge Case Tests

| Case | Test | Expected |
|------|------|----------|
| No coverage | Select municipality with no zones | "Sin cobertura" step, only pickup/agency/seller |
| Single branch | Zone has 1 branch | Auto-selected, read-only card |
| No stock | Product with stock=0 in zone | "Agotado" badge, add disabled |
| No vehicles | Oil change without registered vehicles | Inline form to add vehicle |
| Stock race condition | Two users buy last item | Second order fails gracefully |
| Billing = shipping | Select "usar dirección de envío" | Copies delivery address |
| Billing = profile | Select "usar dirección de perfil" | Copies from user profile |
| Billing = custom | Select "nueva dirección" | Form appears, user fills |

### 9.4 Regression Checks

| Area | Check |
|------|-------|
| Admin zones | CRUD still works |
| Admin branches | CRUD + hasInStoreOilChange toggle works |
| Admin products | CRUD + BranchProduct stock works |
| Cart | Add/remove/quantity still works |
| Auth | Login/register/OAuth still works |
| Profile | Edit profile still works |
| Garage | Vehicle CRUD still works |

---

## Files Summary (Phases 7-8-9)

| Phase | File | Action |
|-------|------|--------|
| 7 | `checkout-summary.component.ts` | Branch selector, vehicle, billing address, updated payload |
| 7 | `checkout-summary.component.html` | New UI sections |
| 7 | `models/order.model.ts` | Already updated in Phase 5 |
| 8 | `backend/orders/services/order.service.ts` | Stock validation, vehicle check, billing storage |
| 8 | `backend/orders/interfaces/order.interface.ts` | Type updates |
| 9 | — | Compilation + manual testing |

---

## Grand Total — All 9 Phases

| Phase | Files | Description |
|-------|-------|-------------|
| 1 | 8 | Backend endpoints |
| 2 | 5 | LocationService + frontend services |
| 3 | 6 | Zoning modal + header |
| 4 | 3 | Catalog + products |
| 5 | 4 | Checkout dispatch |
| 6 | 5 | Checkout forms |
| 7 | 2 | Checkout summary |
| 8 | 2 | Order backend |
| 9 | 0 | Testing |
| **Total** | **~35** | **9 phases** |
