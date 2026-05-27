# Client Phase 5 — Checkout Dispatch Options

> **Status:** Pending
> **Depends on:** Phase 2 (LocationService)
> **Blocks:** Phase 6 (Forms), Phase 7 (Summary)
> **Estimated files:** 4
> **Verification:** `cd frontend && npx ng build` → 0 errors

---

## 1. Update CheckoutService

### File: `frontend/src/app/features/checkout/services/checkout.service.ts`

### 1.1 Update DispatchType
```typescript
// Before:
export type DispatchType = 'store_pickup' | 'shipping_agency' | 'local_delivery'
  | 'seller_agreement' | 'oil_change_service' | null;

// After:
export type DispatchType = 'store_pickup' | 'shipping_agency' | 'local_delivery'
  | 'seller_agreement' | 'oil_change_service' | 'in_store_oil_change' | null;
```

### 1.2 Add New State Fields
```typescript
// Add to CheckoutState interface:
selectedVehicle: Vehicle | null;
billingAddress: BillingAddress | null;
selectedBranch: BranchSummary | null;

// Add to INITIAL_STATE:
selectedVehicle: null,
billingAddress: null,
selectedBranch: null,
```

### 1.3 Add BillingAddress Interface
```typescript
export interface BillingAddress {
  source: 'shipping' | 'profile' | 'custom';
  fullName?: string;
  documentType?: string;
  documentNumber?: string;
  address: string;
  city: string;
  municipality?: string;
  state?: string;
  referencePoint?: string;
}
```

### 1.4 Add New Dependency
```typescript
private readonly locationService = inject(LocationService);
```

### 1.5 Rewrite `dispatchOptions` Computed

```typescript
readonly dispatchOptions = computed<DispatchOption[]>(() => {
  const config = this.dispatchConfig();
  const modules = config.modules;
  const options: DispatchOption[] = [];
  const hasCoverage = this.locationService.hasCoverage();
  const hasOilChange = this.cartService.hasOilChangeService();

  // 1. Retiro en Tienda — ALWAYS available
  if (modules.storePickup) {
    options.push({
      id: 'store_pickup',
      name: 'Retiro en Tienda',
      description: 'Recoge tu pedido en nuestra tienda sin costo adicional',
      icon: 'store',
      price: null,
      isAvailable: true,
    });
  }

  // 2. Delivery Local — ONLY if has coverage AND delivery enabled
  if (hasCoverage && this.locationService.hasDelivery()) {
    const dc = this.locationService.deliveryConfig();
    const isFree = dc?.freeDelivery ?? false;
    const charge = dc?.deliveryCharge ?? 0;
    options.push({
      id: 'local_delivery',
      name: 'Delivery Local',
      description: isFree
        ? 'Entrega a domicilio gratis en tu zona'
        : `Entrega a domicilio en tu zona ($${charge.toFixed(2)})`,
      icon: 'bike',
      price: isFree ? null : charge,
      isAvailable: true,
    });
  }

  // 3. Envío por Agencia — ONLY if NO coverage
  if (!hasCoverage && modules.shippingAgency) {
    options.push({
      id: 'shipping_agency',
      name: 'Envío por Agencia',
      description: 'Envío a través de agencias a nivel nacional',
      icon: 'truck',
      price: null,
      isAvailable: true,
    });
  }

  // 4. Acordar con Vendedor — ALWAYS available
  if (modules.sellerAgreement) {
    options.push({
      id: 'seller_agreement',
      name: 'Acordar con Vendedor',
      description: 'Coordina directamente con nosotros el método de entrega',
      icon: 'chat',
      price: null,
      isAvailable: true,
    });
  }

  // 5. Cambio de Aceite a Domicilio — ONLY if cart has oil change AND coverage
  if (hasOilChange && hasCoverage) {
    options.push({
      id: 'oil_change_service',
      name: 'Cambio de Aceite a Domicilio',
      description: 'Servicio de cambio de aceite gratis incluido con tu compra',
      icon: 'oil',
      price: null,
      isAvailable: true,
    });
  }

  // 6. Cambio de Aceite en Tienda — ONLY if cart has oil change AND branch has service
  if (hasOilChange && this.locationService.hasInStoreOilChange()) {
    options.push({
      id: 'in_store_oil_change',
      name: 'Cambio de Aceite en Tienda',
      description: 'Lleva tu vehículo a la sucursal para el cambio de aceite',
      icon: 'wrench',
      price: null,
      isAvailable: true,
    });
  }

  return options;
});
```

### 1.6 Add New Methods
```typescript
selectVehicle(vehicle: Vehicle): void {
  this._state.update(s => ({ ...s, selectedVehicle: vehicle }));
}

clearVehicle(): void {
  this._state.update(s => ({ ...s, selectedVehicle: null }));
}

setBillingAddress(address: BillingAddress): void {
  this._state.update(s => ({ ...s, billingAddress: address }));
}

selectBranch(branch: BranchSummary): void {
  this._state.update(s => ({ ...s, selectedBranch: branch }));
}

clearBranch(): void {
  this._state.update(s => ({ ...s, selectedBranch: null }));
}

// Add computeds:
readonly selectedVehicle = computed(() => this._state().selectedVehicle);
readonly hasVehicle = computed(() => this._state().selectedVehicle !== null);
readonly billingAddress = computed(() => this._state().billingAddress);
readonly selectedBranch = computed(() => this._state().selectedBranch);
readonly hasBranch = computed(() => this._state().selectedBranch !== null);
```

### 1.7 Update `selectDispatchType()`
Add cleanup for new fields:
```typescript
selectDispatchType(type: DispatchType): void {
  this._state.update((state) => ({
    ...state,
    dispatchType: type,
    storePickupInfo: type === 'store_pickup' ? this.storeInfo() : null,
    selectedShippingAgency: type === 'shipping_agency' ? state.selectedShippingAgency : null,
    shippingRecipientInfo: type === 'shipping_agency' ? state.shippingRecipientInfo : null,
    localDeliveryRecipientInfo: type === 'local_delivery' ? state.localDeliveryRecipientInfo : null,
    sellerAgreementInfo: type === 'seller_agreement' ? state.sellerAgreementInfo : null,
    oilChangeServiceInfo: type === 'oil_change_service' ? state.oilChangeServiceInfo : null,
    // Clear vehicle unless oil change types
    selectedVehicle: (type === 'oil_change_service' || type === 'in_store_oil_change')
      ? state.selectedVehicle : null,
    // Clear branch unless pickup/in-store types
    selectedBranch: (type === 'store_pickup' || type === 'in_store_oil_change')
      ? state.selectedBranch : null,
  }));
}
```

### 1.8 Remove Stubbed Method
Delete `loadDeliveryConfigForZone()` — replaced by LocationService.

---

## 2. Update Dispatch Component

### File: `frontend/src/app/features/checkout/checkout-dispatch/checkout-dispatch.component.ts`

**Changes:**
- Remove TODO comments about zone refactoring
- Remove `zoneService` injection (replaced by LocationService via CheckoutService)
- Add routing for `in_store_oil_change`:

```typescript
onContinue(): void {
  const dispatchType = this.selectedType();
  switch (dispatchType) {
    case 'store_pickup':
    case 'seller_agreement':
    case 'in_store_oil_change':       // ← NEW: direct to summary
      this.router.navigate(['/checkout/resumen']);
      break;
    case 'shipping_agency':
      this.router.navigate(['/checkout/agencia']);
      break;
    case 'local_delivery':
      this.router.navigate(['/checkout/delivery']);
      break;
    case 'oil_change_service':
      this.router.navigate(['/checkout/cambio-aceite']);
      break;
  }
}
```

### File: `frontend/src/app/features/checkout/checkout-dispatch/checkout-dispatch.component.html`
- Update icons for each option (add wrench icon for in_store_oil_change)
- No structural changes needed — template already renders from `dispatchOptions` computed

---

## 3. Update Order Model

### File: `frontend/src/app/models/order.model.ts`

**Add to DispatchDetails interface:**
```typescript
selectedBranchId?: string;
selectedBranchName?: string;
selectedBranchAddress?: string;
```

**Add BillingAddress interface:**
```typescript
export interface BillingAddress {
  source: 'shipping' | 'profile' | 'custom';
  fullName?: string;
  documentType?: string;
  documentNumber?: string;
  address?: string;
  city?: string;
  municipality?: string;
  state?: string;
  referencePoint?: string;
}
```

**Add to Order interface:**
```typescript
billingAddress?: BillingAddress;
```

**Add to CreateOrderRequest:**
```typescript
selectedBranch?: string;        // Branch ID
billingAddress?: BillingAddress;
```

**Update dispatchType in CreateOrderRequest type (if typed):**
- Include `'in_store_oil_change'`

---

## 4. Verification Checklist

| Check | Expected |
|-------|----------|
| `ng build` | 0 errors |
| No coverage → dispatch options | store_pickup, shipping_agency, seller_agreement |
| Coverage, no delivery | store_pickup, seller_agreement |
| Coverage + delivery | store_pickup, local_delivery, seller_agreement |
| Coverage + oil change combo | Above + oil_change_service |
| Coverage + oil change + branch has service | Above + in_store_oil_change |
| Select in_store_oil_change → Continue | Navigates to /checkout/resumen |
| Select oil_change_service → Continue | Navigates to /checkout/cambio-aceite |
| Change dispatch type | Previous data cleared appropriately |
| Vehicle preserved between oil change types | Yes (both keep selectedVehicle) |

---

## 5. Dispatch Rules Quick Reference

| Option | Condition | Form? | Branch select? | Vehicle? |
|--------|-----------|-------|---------------|----------|
| store_pickup | ALWAYS | No | Yes (summary) | No |
| local_delivery | coverage + delivery | Yes | No | No |
| shipping_agency | NO coverage | Yes | No | No |
| seller_agreement | ALWAYS | No | No | No |
| oil_change_service | oil combo + coverage | Yes | No | Yes |
| in_store_oil_change | oil combo + branch has it | No | Yes (summary) | Yes |
