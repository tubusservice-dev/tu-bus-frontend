# Client Phase 1 — Backend Foundation

> **Status:** Pending
> **Depends on:** Admin module complete ✅
> **Blocks:** Phase 2 (LocationService), Phase 8 (Order backend)
> **Estimated files:** 8
> **Verification:** `cd backend && npx tsc --noEmit` → 0 errors

---

## 1. Restore `branchIds` Filter in Product Query

### 1.1 File: `backend/src/modules/products/dto/product.dto.ts`
**Action:** Add `branchIds` to `ProductQueryDto`
```typescript
// Add to ProductQueryDto interface:
branchIds?: string;  // comma-separated branch IDs for zone filtering
```

### 1.2 File: `backend/src/modules/products/services/product.service.ts`
**Action:** In `findAll()`, add branchIds filtering logic after existing filters

**Logic:**
1. If `branchIds` is provided, split by comma
2. Query `BranchProduct.find({ branch: { $in: ids }, isActive: true, stock: { $gt: 0 } })`
3. Extract unique productIds from results
4. Add `filter._id = { $in: productIds }` to the query
5. Import `BranchProduct` model at top of file

**Import required:**
```typescript
import { BranchProduct } from '../../branch-products/models/branch-product.model';
```

**Where in code:** After line ~68 (after engine filter, before search filter)

---

## 2. Include `hasInStoreOilChange` in Public Endpoint

### 2.1 File: `backend/src/modules/branch-zones/services/branch-zone.service.ts`
**Action:** Line 186 — update `select` in `findBranchesByLocation()`

**Before:**
```typescript
select: 'name address whatsappPhone coordinates schedule',
```

**After:**
```typescript
select: 'name address whatsappPhone coordinates schedule hasInStoreOilChange',
```

---

## 3. Public Stock Aggregation Endpoint

### 3.1 File: `backend/src/modules/branch-products/services/branch-product.service.ts`
**Action:** Add new method `getStockByBranches()`

```typescript
/**
 * Get aggregated stock for a product across specific branches.
 * Used by client to show stock in user's zone.
 */
async getStockByBranches(
  productId: string,
  branchIds: string[]
): Promise<{ totalStock: number; byBranch: { branchId: string; branchName: string; stock: number }[] }> {
  const bps = await BranchProduct.find({
    product: new Types.ObjectId(productId),
    branch: { $in: branchIds.map(id => new Types.ObjectId(id)) },
    isActive: true,
  }).populate('branch', 'name');

  const byBranch = bps.map(bp => ({
    branchId: (bp.branch as any)._id.toString(),
    branchName: (bp.branch as any).name,
    stock: bp.stock,
  }));

  const totalStock = byBranch.reduce((sum, b) => sum + b.stock, 0);

  return { totalStock, byBranch };
}
```

### 3.2 File: `backend/src/modules/branch-products/controllers/branch-product.controller.ts`
**Action:** Add new method `getAggregatedStock()`

```typescript
async getAggregatedStock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { productId, branchIds } = req.query;
    if (!productId || !branchIds) {
      throw new AppError('productId and branchIds are required', 400);
    }
    const ids = (branchIds as string).split(',').map(id => id.trim()).filter(Boolean);
    const result = await branchProductService.getStockByBranches(productId as string, ids);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
```

### 3.3 File: `backend/src/modules/branch-products/routes/branch-product.routes.ts`
**Action:** Add public route BEFORE admin routes

```typescript
// PUBLIC ROUTES
/**
 * GET /api/branch-products/stock?productId=X&branchIds=A,B,C
 * Get aggregated stock for a product across branches
 */
router.get('/stock', (req, res, next) =>
  branchProductController.getAggregatedStock(req, res, next)
);
```

---

## 4. Public Delivery Config Endpoint

### 4.1 File: `backend/src/modules/branch-zones/services/branch-zone.service.ts`
**Action:** Add new method `getDeliveryConfigForLocation()`

```typescript
/**
 * Get merged delivery config for a specific municipality across all branches.
 * Returns the best delivery option available (cheapest charge).
 */
async getDeliveryConfigForLocation(
  citySlug: string,
  municipalitySlug: string
): Promise<{
  hasDelivery: boolean;
  freeDelivery: boolean;
  deliveryCharge: number;
  branches: any[];
}> {
  // Find city
  const city = await City.findOne({ slug: citySlug.toLowerCase() });
  if (!city) return { hasDelivery: false, freeDelivery: false, deliveryCharge: 0, branches: [] };

  // Find zones covering this municipality
  const zones = await Zone.find({
    city: city._id,
    municipalities: municipalitySlug.toLowerCase(),
    isActive: true,
  }).select('_id');

  if (zones.length === 0) {
    return { hasDelivery: false, freeDelivery: false, deliveryCharge: 0, branches: [] };
  }

  // Find BranchZones
  const branchZones = await BranchZone.find({
    zone: { $in: zones.map(z => z._id) },
    isActive: true,
  }).populate({
    path: 'branch',
    match: { isActive: true },
    select: 'name address whatsappPhone schedule hasInStoreOilChange',
  });

  // Filter valid and extract delivery config for this municipality
  let hasDelivery = false;
  let freeDelivery = false;
  let minCharge = Infinity;
  const seenBranches = new Set<string>();
  const branches: any[] = [];

  for (const bz of branchZones) {
    if (!bz.branch) continue;
    const branchId = (bz.branch as any)._id.toString();

    // Delivery config for requested municipality
    const dc = bz.deliveryConfig.find(
      (d: any) => d.municipality === municipalitySlug.toLowerCase()
    );
    if (dc && dc.hasDelivery) {
      hasDelivery = true;
      if (dc.freeDelivery) freeDelivery = true;
      if (dc.deliveryCharge < minCharge) minCharge = dc.deliveryCharge;
    }

    // Deduplicate branches
    if (!seenBranches.has(branchId)) {
      seenBranches.add(branchId);
      branches.push(bz.branch);
    }
  }

  return {
    hasDelivery,
    freeDelivery: freeDelivery || minCharge === 0,
    deliveryCharge: freeDelivery ? 0 : (minCharge === Infinity ? 0 : minCharge),
    branches,
  };
}
```

### 4.2 File: `backend/src/modules/branch-zones/controllers/branch-zone.controller.ts`
**Action:** Add new method `getDeliveryConfig()`

```typescript
async getDeliveryConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { citySlug, municipality } = req.query;
    if (!citySlug || !municipality) {
      throw new AppError('citySlug and municipality are required', 400);
    }
    const result = await branchZoneService.getDeliveryConfigForLocation(
      citySlug as string,
      municipality as string
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}
```

### 4.3 File: `backend/src/modules/branch-zones/routes/branch-zone.routes.ts`
**Action:** Add public route after `by-location`

```typescript
/**
 * GET /api/branch-zones/delivery-config?citySlug=X&municipality=Y
 * Get delivery configuration for a location
 */
router.get('/delivery-config', (req, res, next) =>
  branchZoneController.getDeliveryConfig(req, res, next)
);
```

---

## 5. Update Order Model

### 5.1 File: `backend/src/modules/orders/models/order.model.ts`
**Action 1:** Add `in_store_oil_change` to dispatchType enum

**Before:**
```typescript
enum: ['store_pickup', 'shipping_agency', 'local_delivery', 'seller_agreement', 'oil_change_service'],
```

**After:**
```typescript
enum: ['store_pickup', 'shipping_agency', 'local_delivery', 'seller_agreement', 'oil_change_service', 'in_store_oil_change'],
```

**Action 2:** Add fields to `dispatchDetailsSchema`
```typescript
selectedBranchId: { type: String },
selectedBranchName: { type: String },
selectedBranchAddress: { type: String },
```

**Action 3:** Add `billingAddress` embedded schema to `orderSchema`
```typescript
billingAddress: {
  source: { type: String, enum: ['shipping', 'profile', 'custom'] },
  fullName: { type: String },
  documentType: { type: String },
  documentNumber: { type: String },
  address: { type: String },
  city: { type: String },
  municipality: { type: String },
  state: { type: String },
  referencePoint: { type: String },
},
```

### 5.2 File: `backend/src/modules/orders/interfaces/order.interface.ts`
**Action:** Add corresponding TypeScript types to `IOrder`

```typescript
// Add to IOrder:
billingAddress?: {
  source: 'shipping' | 'profile' | 'custom';
  fullName?: string;
  documentType?: string;
  documentNumber?: string;
  address?: string;
  city?: string;
  municipality?: string;
  state?: string;
  referencePoint?: string;
};
```

```typescript
// Add to IDispatchDetails or equivalent:
selectedBranchId?: string;
selectedBranchName?: string;
selectedBranchAddress?: string;
```

---

## 6. Verification Checklist

| Check | Command | Expected |
|-------|---------|----------|
| TypeScript compilation | `cd backend && npx tsc --noEmit` | 0 errors |
| Product query accepts branchIds | Manual: `GET /api/products?branchIds=id1,id2&isActive=true` | Filtered products |
| Stock endpoint works | Manual: `GET /api/branch-products/stock?productId=X&branchIds=Y` | `{ totalStock, byBranch[] }` |
| Delivery config endpoint works | Manual: `GET /api/branch-zones/delivery-config?citySlug=valencia&municipality=valencia` | `{ hasDelivery, branches[] }` |
| Location endpoint includes oil change | Manual: `GET /api/branch-zones/by-location?citySlug=valencia` | Branches include `hasInStoreOilChange` |
| Order accepts new dispatch type | Check enum in schema | Includes `in_store_oil_change` |
