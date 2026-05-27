# Phase 4: Backend — Product Simplification + Route Mounting

> **Prerequisites:** Phases 1-3 must be complete (BranchProduct module exists)
> **Reference:** `docs/features/zones-branches-products-architecture.md` sections 2.6, 7

---

## Objective

1. **Remove `stock` and `branches[]` from Product model** — these now live in BranchProduct.
2. **Add cascade delete** to Product service — when a product is deleted, remove its BranchProducts.
3. **Mount new routes** in `app.ts` for cities, branch-zones, and branch-products.
4. **Update seed** in `server.ts` — replace old zone seed with new city seed.

---

## Part A: Simplify Product Module

### Files to MODIFY

```
backend/src/modules/products/models/product.model.ts          ← MODIFY
backend/src/modules/products/interfaces/product.interface.ts  ← MODIFY
backend/src/modules/products/dto/product.dto.ts               ← MODIFY
backend/src/modules/products/services/product.service.ts      ← MODIFY
```

### Step A.1: Modify `models/product.model.ts`

**DELETE these lines:**
```typescript
// Line ~33 — Remove global stock field
stock: { type: Number, default: 1, min: 0 },

// Line ~63 — Remove branches array
branches: [{ type: Schema.Types.ObjectId, ref: 'Branch' }],

// Line ~88 — Remove branches index
productSchema.index({ branches: 1 });
```

**KEEP everything else** (name, slug, sku, price, images, categories, brand, compatibleEngines, etc.).

### Step A.2: Modify `interfaces/product.interface.ts`

**DELETE from `IProduct`:**
```typescript
stock: number;                    // ~line 31
branches?: Types.ObjectId[];      // ~line 55
```

**DELETE from `IProductResponse`:**
```typescript
stock: number;                    // ~line 76
branches?: any[];                 // ~line 90
```

### Step A.3: Modify `dto/product.dto.ts`

**DELETE from `CreateProductDto`:**
```typescript
stock?: number;                   // ~line 16
branches?: string[];              // ~line 30
```

**DELETE from `UpdateProductDto`:**
```typescript
stock?: number;                   // ~line 42
branches?: string[];              // ~line 55
```

**DELETE from `ProductQueryDto`:**
```typescript
branchId?: string;                // ~line 74
branchIds?: string | string[];    // ~line 75
```

### Step A.4: Modify `services/product.service.ts`

**DELETE in `findAll()` method:**
- Remove `.populate('branches', 'name cityName stateName isActive')` from the query chain
- Remove the `branchId` filter block:
  ```typescript
  if (query.branchId) {
    filter.branches = query.branchId;
  } else if (query.branchIds) { ... }
  ```

**DELETE in `findById()` and `findBySlug()` methods:**
- Remove `.populate('branches', ...)` from the query chain

**DELETE method entirely:**
- `updateStock()` — stock management is now in BranchProductService

**MODIFY `delete()` method** — add cascade:
```typescript
async delete(id: string): Promise<void> {
  const product = await Product.findById(id);
  if (!product) throw new AppError('Producto no encontrado', 404);

  // Cascade delete branch-product associations
  const { BranchProduct } = await import('../../branch-products/models/branch-product.model');
  await BranchProduct.deleteMany({ product: id });

  await Product.findByIdAndDelete(id);
}
```

**MODIFY `toResponse()` method** (if exists):
- Remove `stock` and `branches` from the response mapping

---

## Part B: Mount New Routes

### Step B.1: Modify `backend/src/app.ts`

**ADD imports** (after existing module imports, ~line 25):
```typescript
import { cityRoutes } from './modules/cities';
import { branchZoneRoutes } from './modules/branch-zones';
import { branchProductRoutes } from './modules/branch-products';
```

**ADD route mounting** (in the routes section, ~after line 118):
```typescript
app.use('/api/cities', cityRoutes);
app.use('/api/branch-zones', branchZoneRoutes);
app.use('/api/branch-products', branchProductRoutes);
```

**Final route order should be:**
```
/api/auth
/api/users
/api/products
/api/lines
/api/categories
/api/brands
/api/shipping-agencies
/api/zones
/api/branches
/api/cities              ← NEW
/api/branch-zones        ← NEW
/api/branch-products     ← NEW
/api/vehicles
/api/orders
/api/payments
/api/upload
/api/settings
/api/mechanic-order
/api/payment-methods
/api/admin
```

### Step B.2: Modify `backend/src/server.ts`

**REPLACE import** (~line 7):
```typescript
// BEFORE:
import { zoneService } from './modules/zones';

// AFTER:
import { cityService } from './modules/cities';
```

**REPLACE seed call** (~line 87):
```typescript
// BEFORE:
await zoneService.seedInitialData();

// AFTER:
await cityService.seedCities();
```

---

## Verification

1. `npx tsc --noEmit` — zero errors across entire backend
2. Start server → console shows "✅ 18 ciudades sembradas correctamente" (first run) or silently skips (subsequent runs)
3. `GET /api/products` — response has NO `stock` or `branches` fields
4. `GET /api/products/:id` — same, no stock/branches
5. `POST /api/admin/products` — accepts creation without `stock` or `branches` fields
6. `DELETE /api/admin/products/:id` — cascades to delete BranchProducts
7. `GET /api/cities` — returns 18 cities (confirms mounting)
8. `GET /api/admin/branch-zones?branchId=X` — works (confirms mounting)
9. `GET /api/admin/branch-products?productId=X` — works (confirms mounting)

---

## Summary of Changes

| File | Action | Detail |
|------|--------|--------|
| `products/models/product.model.ts` | Remove 3 items | `stock` field, `branches` field, `branches` index |
| `products/interfaces/product.interface.ts` | Remove 4 fields | `stock` and `branches` from IProduct + IProductResponse |
| `products/dto/product.dto.ts` | Remove 6 fields | `stock`+`branches` from Create/Update, `branchId`+`branchIds` from Query |
| `products/services/product.service.ts` | Remove + Modify | Remove populate, filters, updateStock. Add cascade delete. |
| `app.ts` | Add 6 lines | 3 imports + 3 route mounts |
| `server.ts` | Replace 2 lines | Import + seed call |
