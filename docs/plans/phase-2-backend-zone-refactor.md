# Phase 2: Backend — Zone Module Refactor

> **Prerequisites:** Phase 1 (City module must exist for Zone.city reference)
> **Reference:** `docs/features/zones-branches-products-architecture.md` sections 2.2, 5.2, 10

---

## Objective

Completely rewrite the Zone module. The current model (`City` used as zone with `stateCode`, `stateName`, and inline municipalities with `isActive`) is replaced by a clean `Zone` model that references `City` and stores municipality slugs. The `State` and `ReferenceCity` models are removed entirely.

---

## Files to DELETE

```
backend/src/modules/zones/models/reference-city.model.ts    ← DELETE
backend/src/modules/zones/models/state.model.ts             ← DELETE
backend/src/modules/zones/seed-venezuela.ts                  ← DELETE
backend/src/modules/zones/migrate-to-reference-cities.ts     ← DELETE
```

## Files to REWRITE (complete replacement)

```
backend/src/modules/zones/interfaces/zone.interface.ts       ← REWRITE
backend/src/modules/zones/models/zone.model.ts               ← REWRITE
backend/src/modules/zones/services/zone.service.ts           ← REWRITE
backend/src/modules/zones/controllers/zone.controller.ts     ← REWRITE
backend/src/modules/zones/routes/zone.routes.ts              ← REWRITE
backend/src/modules/zones/index.ts                           ← REWRITE
```

---

## Step 1: Delete Obsolete Files

Remove 4 files:
- `models/reference-city.model.ts` — replaced by City seed
- `models/state.model.ts` — state concept no longer exists
- `seed-venezuela.ts` — replaced by city-seed-data.ts in cities module
- `migrate-to-reference-cities.ts` — one-time migration script, obsolete

---

## Step 2: Rewrite Interfaces

**File:** `backend/src/modules/zones/interfaces/zone.interface.ts`

```typescript
import { Document, Types } from 'mongoose';

// Document interface
export interface IZoneDocument extends Document {
  _id: Types.ObjectId;
  name: string;
  city: Types.ObjectId;
  municipalities: string[];  // slugs from city.municipalities
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// DTO for creation
export interface CreateZoneDto {
  name: string;               // required, min 2 chars, must be unique
  city: string;               // ObjectId string, must reference existing City
  municipalities: string[];   // slugs, min 1, must exist in city.municipalities
  isActive?: boolean;         // default: true
}

// DTO for update (all optional)
export interface UpdateZoneDto {
  name?: string;
  city?: string;
  municipalities?: string[];
  isActive?: boolean;
}
```

---

## Step 3: Rewrite Model

**File:** `backend/src/modules/zones/models/zone.model.ts`

**Schema:**
```
zoneSchema {
  name:           String, required, trim, unique
  city:           ObjectId, ref 'City', required
  municipalities: [String], validate: array.length >= 1
  isActive:       Boolean, default true
}
```

**Key details:**
- `municipalities` has a custom validator: `validate: { validator: (v: string[]) => v.length > 0, message: 'Debe tener al menos un municipio' }`
- Explicit collection name: `{ collection: 'zones' }` to avoid collision with old `cities` collection
- `toJSON` transform: standard `_id → id`, delete `__v`
- Timestamps: true
- Indexes: `{ name: 1 }` UNIQUE, `{ city: 1 }`, `{ isActive: 1 }`
- Export: `mongoose.model<IZoneDocument>('Zone', zoneSchema)`

---

## Step 4: Rewrite Service

**File:** `backend/src/modules/zones/services/zone.service.ts`

### Methods:

**`getAll()`** — Admin, includes inactive
```
Zone.find().populate('city', 'name slug municipalities').sort({ isActive: -1, name: 1 })
```

**`getActive()`** — Public, only active
```
Zone.find({ isActive: true }).populate('city', 'name slug municipalities').sort({ name: 1 })
```

**`getById(id)`** — Single zone with populated city
```
Zone.findById(id).populate('city', 'name slug municipalities')
→ throw AppError(404, 'Zona no encontrada') if null
```

**`create(dto: CreateZoneDto)`** — With full validation chain:
```
1. const trimmedName = dto.name.trim()
2. const existing = await Zone.findOne({ name: trimmedName })
   → if (existing) throw AppError(409, `Ya existe una zona con el nombre '${trimmedName}'`)
3. const city = await City.findById(dto.city)
   → if (!city) throw AppError(400, 'La ciudad no existe')
4. if (!dto.municipalities || dto.municipalities.length === 0)
   → throw AppError(400, 'Debe seleccionar al menos un municipio')
5. if (new Set(dto.municipalities).size !== dto.municipalities.length)
   → throw AppError(400, 'Municipios duplicados en la selección')
6. for (const slug of dto.municipalities):
   if (!city.municipalities.find(m => m.slug === slug))
     → throw AppError(400, `El municipio "${slug}" no pertenece a ${city.name}`)
7. const zone = new Zone({ ...dto, name: trimmedName })
   await zone.save()
   return zone.populate('city', 'name slug municipalities')
```

**`update(id, dto: UpdateZoneDto)`** — With conditional validations:
```
1. const zone = await Zone.findById(id) → throw 404
2. If dto.name && dto.name.trim() !== zone.name:
   const dup = await Zone.findOne({ name: dto.name.trim(), _id: { $ne: id } })
   → if (dup) throw AppError(409, 'Ya existe una zona con este nombre')
3. const cityId = dto.city || zone.city
   const city = await City.findById(cityId) → throw 400
4. const munis = dto.municipalities || zone.municipalities
   → validate each slug against city.municipalities (same as create steps 4-6)
5. Zone.findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true })
   .populate('city', 'name slug municipalities')
```

**`delete(id)`** — With referential integrity check:
```
1. const zone = await Zone.findById(id) → throw 404
2. // Dynamic import to avoid circular dependency
   const { BranchZone } = await import('../../branch-zones/models/branch-zone.model')
   const count = await BranchZone.countDocuments({ zone: id })
3. if (count > 0)
   → throw AppError(409, `Zona asignada a ${count} sucursal(es). Desasóciala primero.`)
4. await Zone.findByIdAndDelete(id)
```

**`checkName(name: string)`** — For frontend debounce:
```
const zone = await Zone.findOne({ name: name.trim() })
return !!zone
```

**Export:** `export const zoneService = new ZoneService()`

---

## Step 5: Rewrite Controller

**File:** `backend/src/modules/zones/controllers/zone.controller.ts`

| Method | Response |
|--------|----------|
| `getAll` | `res.json({ success: true, data })` |
| `getActive` | `res.json({ success: true, data })` |
| `getById` | `res.json({ success: true, data })` |
| `create` | `res.status(201).json({ success: true, data, message: 'Zona creada exitosamente' })` |
| `update` | `res.json({ success: true, data, message: 'Zona actualizada exitosamente' })` |
| `delete` | `res.status(204).send()` |
| `checkName` | `res.json({ success: true, data: { exists: boolean } })` |

All methods follow: `async method(req, res, next)` with `try/catch { next(error) }`.

---

## Step 6: Rewrite Routes

**File:** `backend/src/modules/zones/routes/zone.routes.ts`

```
PUBLIC (no auth):
  GET /          → getActive     // Only active zones (for dropdowns)
  GET /:id       → getById       // Single zone with populated city

ADMIN (authenticate middleware):
  GET /admin              → getAll        // All zones including inactive
  GET /admin/check-name   → checkName     // Query: ?name=X
  POST /admin             → create
  PUT /admin/:id          → update
  DELETE /admin/:id       → delete
```

**Important:** Place `/admin` routes BEFORE `/:id` to avoid route collision.

---

## Step 7: Rewrite Module Index

**File:** `backend/src/modules/zones/index.ts`

```typescript
export * from './interfaces/zone.interface';
export * from './models/zone.model';
export * from './services/zone.service';
export * from './controllers/zone.controller';
export { default as zoneRoutes } from './routes/zone.routes';
```

Removed: exports of State, ReferenceCity.

---

## Verification

1. `npx tsc --noEmit` — zero errors
2. `POST /api/zones/admin` with valid data → 201, zone created with populated city
3. `POST /api/zones/admin` with duplicate name → 409
4. `POST /api/zones/admin` with invalid city ID → 400
5. `POST /api/zones/admin` with invalid municipality slug → 400
6. `POST /api/zones/admin` with empty municipalities → 400
7. `GET /api/zones` → only active zones
8. `GET /api/zones/admin` → all zones
9. `GET /api/zones/admin/check-name?name=Zona+Test` → `{ exists: true/false }`
10. `DELETE /api/zones/admin/:id` (no refs) → 204
11. `DELETE /api/zones/admin/:id` (with BranchZone refs) → 409 blocked
