# Phase 3: Backend — Branch Simplification + Pivot Modules

> **Prerequisites:** Phase 1 (City) + Phase 2 (Zone) must be complete
> **Reference:** `docs/features/zones-branches-products-architecture.md` sections 2.3, 2.4, 2.5, 5.3, 5.4, 5.5, 7, 10

---

## Objective

1. **Simplify Branch model** — remove all embedded zone/delivery data (`serviceZones`, `serviceMunicipalities`, legacy flat fields). Branch becomes a clean entity with only its own properties.
2. **Create BranchZone pivot** — handles the many-to-many Branch↔Zone relationship with per-municipality delivery configuration.
3. **Create BranchProduct pivot** — handles the many-to-many Branch↔Product relationship with per-branch stock tracking.

---

## Part A: Simplify Branch Module

### Files to MODIFY

```
backend/src/modules/branches/interfaces/branch.interface.ts   ← MODIFY
backend/src/modules/branches/models/branch.model.ts           ← MODIFY
backend/src/modules/branches/services/branch.service.ts       ← MODIFY
backend/src/modules/branches/controllers/branch.controller.ts ← MODIFY
backend/src/modules/branches/routes/branch.routes.ts          ← MODIFY
```

### Step A.1: Modify `interfaces/branch.interface.ts`

**DELETE these interfaces entirely:**
- `IServiceMunicipality`
- `IServiceZone`

**DELETE these fields from `IBranch`:**
- `stateCode`, `stateName`, `cityCode`, `cityName`
- `serviceMunicipalities`
- `serviceZones`

**DELETE same fields from `CreateBranchDto` and `UpdateBranchDto`.**

**KEEP:** `name`, `description`, `address`, `whatsappPhone`, `landlinePhone`, `schedule` (IScheduleDay[]), `coordinates` (ICoordinates), `isActive`.

### Step A.2: Modify `models/branch.model.ts`

**DELETE these subdocument schemas:**
- `serviceMunicipalitySchema` (entire schema definition)
- `serviceZoneSchema` (entire schema definition)

**DELETE these fields from main schema:**
- `stateCode`, `stateName`, `cityCode`, `cityName`
- `serviceMunicipalities`, `serviceZones`

**DELETE these indexes:**
- `{ 'serviceZones.stateCode': 1 }`
- `{ 'serviceZones.cityCode': 1 }`
- `{ stateCode: 1 }`
- `{ cityCode: 1 }`

**KEEP:** `scheduleDaySchema`, `coordinatesSchema`, basic fields, indexes `{ name: 'text' }` and `{ isActive: 1 }`.

### Step A.3: Modify `services/branch.service.ts`

**DELETE:** `findByZone()` method entirely (replaced by BranchZoneService.findBranchesByLocation).

**MODIFY `delete()` method** — add cascade delete:
```typescript
async delete(id: string): Promise<void> {
  const branch = await Branch.findById(id);
  if (!branch) throw new AppError('Sucursal no encontrada', 404);

  // Cascade delete associations (dynamic import to avoid circular deps)
  const { BranchZone } = await import('../../branch-zones/models/branch-zone.model');
  const { BranchProduct } = await import('../../branch-products/models/branch-product.model');
  await BranchZone.deleteMany({ branch: id });
  await BranchProduct.deleteMany({ branch: id });

  await Branch.findByIdAndDelete(id);
}
```

**KEEP:** `getAll`, `getActive`, `getById`, `create`, `update`, `toggleActive`.

### Step A.4: Modify `controllers/branch.controller.ts`

**DELETE:** `getByZone` handler.
**KEEP:** all other handlers.

### Step A.5: Modify `routes/branch.routes.ts`

**DELETE:** `GET /by-zone` route.
**KEEP:** all other routes (public and admin).

---

## Part B: Create BranchZone Module

### File Structure

```
backend/src/modules/branch-zones/
├── interfaces/branch-zone.interface.ts    ← NEW
├── models/branch-zone.model.ts            ← NEW
├── services/branch-zone.service.ts        ← NEW
├── controllers/branch-zone.controller.ts  ← NEW
├── routes/branch-zone.routes.ts           ← NEW
└── index.ts                               ← NEW
```

### Step B.1: Create Interfaces

**File:** `backend/src/modules/branch-zones/interfaces/branch-zone.interface.ts`

```typescript
import { Document, Types } from 'mongoose';

export interface IDeliveryConfigItem {
  municipality: string;       // slug from zone.municipalities
  hasDelivery: boolean;
  freeDelivery: boolean;
  deliveryCharge: number;
  hasOilChangeService: boolean;
}

export interface IBranchZoneDocument extends Document {
  _id: Types.ObjectId;
  branch: Types.ObjectId;
  zone: Types.ObjectId;
  deliveryConfig: IDeliveryConfigItem[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBranchZoneBatchDto {
  branchId: string;
  zones: Array<{
    zoneId: string;
    deliveryConfig?: IDeliveryConfigItem[];
  }>;
}

export interface UpdateBranchZoneDto {
  deliveryConfig?: IDeliveryConfigItem[];
  isActive?: boolean;
}
```

### Step B.2: Create Model

**File:** `backend/src/modules/branch-zones/models/branch-zone.model.ts`

**Subdocument `deliveryConfigSchema`:**
```
municipality:       String, required
hasDelivery:        Boolean, default false
freeDelivery:       Boolean, default true
deliveryCharge:     Number, default 0, min 0
hasOilChangeService: Boolean, default false
{ _id: false }
```

**Main schema `branchZoneSchema`:**
```
branch:         ObjectId, ref 'Branch', required
zone:           ObjectId, ref 'Zone', required
deliveryConfig: [deliveryConfigSchema], default []
isActive:       Boolean, default true
```

**Options:** `timestamps: true`, `toJSON` transform, explicit collection `'branch_zones'`

**Indexes:**
```
{ branch: 1, zone: 1 }              UNIQUE
{ branch: 1 }
{ zone: 1 }
{ 'deliveryConfig.municipality': 1 }
```

### Step B.3: Create Service

**File:** `backend/src/modules/branch-zones/services/branch-zone.service.ts`

```
class BranchZoneService {

  async getByBranch(branchId: string): Promise<IBranchZoneDocument[]>
    → BranchZone.find({ branch: branchId })
        .populate({ path: 'zone', populate: { path: 'city', select: 'name slug' } })
        .sort({ createdAt: 1 })

  async getByZone(zoneId: string): Promise<IBranchZoneDocument[]>
    → BranchZone.find({ zone: zoneId })
        .populate('branch', 'name address isActive')
        .sort({ createdAt: 1 })

  async createBatch(dto: CreateBranchZoneBatchDto): Promise<IBranchZoneDocument[]>
    VALIDATIONS:
    1. const branch = await Branch.findById(dto.branchId)
       → if (!branch) throw AppError(400, 'La sucursal no existe')
    2. const documents = []
       for (const item of dto.zones):
         a. const zone = await Zone.findById(item.zoneId).populate('city')
            → if (!zone) throw AppError(400, 'La zona no existe')
         b. const existing = await BranchZone.findOne({ branch: dto.branchId, zone: item.zoneId })
            → if (existing) throw AppError(409, `La zona "${zone.name}" ya está asignada a esta sucursal`)
         c. let deliveryConfig = item.deliveryConfig
            if (!deliveryConfig || deliveryConfig.length === 0):
              // AUTO-POPULATE from zone municipalities
              deliveryConfig = zone.municipalities.map(slug => ({
                municipality: slug,
                hasDelivery: false,
                freeDelivery: true,
                deliveryCharge: 0,
                hasOilChangeService: false,
              }))
         d. documents.push({ branch: dto.branchId, zone: item.zoneId, deliveryConfig })
    3. const created = await BranchZone.insertMany(documents)
    4. Re-query with populate and return

  async update(id: string, dto: UpdateBranchZoneDto): Promise<IBranchZoneDocument>
    → const bz = await BranchZone.findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true })
        .populate({ path: 'zone', populate: { path: 'city', select: 'name slug' } })
    → if (!bz) throw AppError(404, 'Asociación no encontrada')
    → return bz

  async delete(id: string): Promise<void>
    → const bz = await BranchZone.findByIdAndDelete(id)
    → if (!bz) throw AppError(404, 'Asociación no encontrada')

  async deleteByBranch(branchId: string): Promise<{ deletedCount: number }>
    → return BranchZone.deleteMany({ branch: branchId })

  async deleteByZone(zoneId: string): Promise<{ deletedCount: number }>
    → return BranchZone.deleteMany({ zone: zoneId })

  async countByZone(zoneId: string): Promise<number>
    → return BranchZone.countDocuments({ zone: zoneId })

  async findBranchesByLocation(citySlug: string, municipalitySlug?: string): Promise<any[]>
    1. const city = await City.findOne({ slug: citySlug })
       → if (!city) throw AppError(404, 'Ciudad no encontrada')
    2. const zoneFilter: any = { city: city._id, isActive: true }
       if (municipalitySlug) zoneFilter.municipalities = municipalitySlug
    3. const zones = await Zone.find(zoneFilter).select('_id')
    4. const branchZones = await BranchZone.find({
         zone: { $in: zones.map(z => z._id) },
         isActive: true,
       }).populate({
         path: 'branch',
         match: { isActive: true },
         select: 'name address whatsappPhone coordinates schedule',
       })
    5. // Deduplicate branches and filter nulls
       const seen = new Set<string>()
       const branches = branchZones
         .filter(bz => bz.branch !== null)
         .map(bz => bz.branch)
         .filter(b => { const id = b._id.toString(); if (seen.has(id)) return false; seen.add(id); return true; })
    6. return branches
}

export const branchZoneService = new BranchZoneService()
```

### Step B.4: Create Controller

**File:** `backend/src/modules/branch-zones/controllers/branch-zone.controller.ts`

```
class BranchZoneController {
  async query(req, res, next)
    → if (req.query.branchId) return res.json({ success: true, data: await svc.getByBranch(query.branchId) })
    → if (req.query.zoneId) return res.json({ success: true, data: await svc.getByZone(query.zoneId) })
    → throw AppError(400, 'Debe especificar branchId o zoneId')

  async createBatch(req, res, next)
    → res.status(201).json({ success: true, data, message: 'Zonas asignadas exitosamente' })

  async update(req, res, next)
    → res.json({ success: true, data })

  async delete(req, res, next)
    → res.status(204).send()

  async findByLocation(req, res, next)
    → if (!req.query.citySlug) throw AppError(400, 'citySlug es requerido')
    → res.json({ success: true, data: await svc.findBranchesByLocation(query.citySlug, query.municipality) })
}

export const branchZoneController = new BranchZoneController()
```

### Step B.5: Create Routes

**File:** `backend/src/modules/branch-zones/routes/branch-zone.routes.ts`

```
PUBLIC (no auth):
  GET /by-location     → findByLocation   (?citySlug=X&municipality=Y)

ADMIN (authenticate):
  GET /admin           → query            (?branchId=X or ?zoneId=X)
  POST /admin/batch    → createBatch
  PUT /admin/:id       → update
  DELETE /admin/:id    → delete
```

### Step B.6: Create Module Index

```typescript
export * from './interfaces/branch-zone.interface';
export * from './models/branch-zone.model';
export * from './services/branch-zone.service';
export * from './controllers/branch-zone.controller';
export { default as branchZoneRoutes } from './routes/branch-zone.routes';
```

---

## Part C: Create BranchProduct Module

### File Structure

```
backend/src/modules/branch-products/
├── interfaces/branch-product.interface.ts    ← NEW
├── models/branch-product.model.ts            ← NEW
├── services/branch-product.service.ts        ← NEW
├── controllers/branch-product.controller.ts  ← NEW
├── routes/branch-product.routes.ts           ← NEW
└── index.ts                                  ← NEW
```

### Step C.1: Create Interfaces

```typescript
import { Document, Types } from 'mongoose';

export interface IBranchProductDocument extends Document {
  _id: Types.ObjectId;
  branch: Types.ObjectId;
  product: Types.ObjectId;
  stock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBranchProductBatchDto {
  productId: string;
  assignments: Array<{
    branchId: string;
    stock: number;
  }>;
}

export interface UpdateBranchProductDto {
  stock?: number;
  isActive?: boolean;
}
```

### Step C.2: Create Model

**Schema:**
```
branch:   ObjectId, ref 'Branch', required
product:  ObjectId, ref 'Product', required
stock:    Number, required, min 0, default 0
isActive: Boolean, default true
```

**Indexes:**
```
{ branch: 1, product: 1 }   UNIQUE
{ product: 1 }
{ branch: 1 }
{ stock: 1 }
```

Collection: `'branch_products'`

### Step C.3: Create Service

```
class BranchProductService {
  async getByBranch(branchId): Promise<IBranchProductDocument[]>
    → populate('product', 'name slug price images isActive isFeatured')

  async getByProduct(productId): Promise<IBranchProductDocument[]>
    → populate('branch', 'name address isActive')

  async createBatch(dto: CreateBranchProductBatchDto): Promise<IBranchProductDocument[]>
    1. const product = await Product.findById(dto.productId)
       → if (!product) throw AppError(400, 'El producto no existe')
    2. const documents = []
       for (const a of dto.assignments):
         a. const branch = await Branch.findById(a.branchId)
            → if (!branch) throw AppError(400, `La sucursal no existe`)
         b. const existing = await BranchProduct.findOne({ branch: a.branchId, product: dto.productId })
            → if (existing) throw AppError(409, `El producto ya está asignado a "${branch.name}"`)
         c. if (a.stock < 0) throw AppError(400, 'El stock no puede ser negativo')
         d. documents.push({ branch: a.branchId, product: dto.productId, stock: a.stock })
    3. await BranchProduct.insertMany(documents)
    4. Re-query with populate and return

  async update(id, dto: UpdateBranchProductDto): Promise<IBranchProductDocument>
    → findByIdAndUpdate, populate, throw 404

  async updateStock(id: string, quantity: number): Promise<IBranchProductDocument>
    → const bp = await BranchProduct.findById(id) → throw 404
    → const newStock = bp.stock + quantity
    → if (newStock < 0) throw AppError(400, 'Stock insuficiente')
    → bp.stock = newStock; await bp.save()
    → return bp

  async delete(id): Promise<void>
    → findByIdAndDelete, throw 404

  async deleteByBranch(branchId): Promise<void>
    → deleteMany({ branch })

  async deleteByProduct(productId): Promise<void>
    → deleteMany({ product })

  async getTotalStock(productId: string): Promise<number>
    → aggregate([
        { $match: { product: new Types.ObjectId(productId), isActive: true } },
        { $group: { _id: null, total: { $sum: '$stock' } } }
      ])
    → return result[0]?.total || 0

  async countByBranch(branchId: string): Promise<number>
    → countDocuments({ branch })
}

export const branchProductService = new BranchProductService()
```

### Step C.4: Create Controller & Routes

```
ADMIN (authenticate):
  GET /admin              → query (?branchId=X or ?productId=X)
  POST /admin/batch       → createBatch
  PUT /admin/:id          → update
  PATCH /admin/:id/stock  → updateStock (body: { quantity: number })
  DELETE /admin/:id       → delete
```

---

## Verification

**Part A — Branch Simplification:**
1. `npx tsc --noEmit` — zero errors
2. `GET /api/branches/:id` — no `serviceZones` in response
3. `POST /api/admin/branches` — works without zone data
4. `DELETE /api/admin/branches/:id` — cascades BranchZones + BranchProducts

**Part B — BranchZone:**
5. `POST /api/admin/branch-zones/batch` — creates BranchZones with auto-populated deliveryConfig
6. `POST /api/admin/branch-zones/batch` with duplicate zone → 409
7. `GET /api/admin/branch-zones?branchId=X` — returns zones with populated zone + city
8. `GET /api/branch-zones/by-location?citySlug=caracas&municipality=chacao` — returns branches

**Part C — BranchProduct:**
9. `POST /api/admin/branch-products/batch` — creates with stock per branch
10. `POST /api/admin/branch-products/batch` with duplicate → 409
11. `PATCH /api/admin/branch-products/:id/stock` with `{ quantity: -5 }` — decrements
12. `PATCH /api/admin/branch-products/:id/stock` with stock going negative → 400
