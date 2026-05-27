# Phase 1: Backend — City Module (Seed Static)

> **Prerequisites:** None (first module, no dependencies)
> **Reference:** `docs/features/zones-branches-products-architecture.md` sections 0, 2.1, 5.1, 12

---

## Objective

Create a read-only `City` module with 18 Venezuelan cities seeded from a static JSON. This replaces the `ReferenceCity` and `State` collections with a simpler, unified model. Cities are never created/edited by admins — they are reference data.

---

## File Structure

```
backend/src/
├── shared/utils/generate-slug.ts              ← NEW (shared utility)
└── modules/cities/
    ├── interfaces/city.interface.ts            ← NEW
    ├── models/city.model.ts                    ← NEW
    ├── services/city.service.ts                ← NEW
    ├── controllers/city.controller.ts          ← NEW
    ├── routes/city.routes.ts                   ← NEW
    ├── seed/city-seed-data.ts                  ← NEW
    └── index.ts                                ← NEW
```

---

## Step 1: Create Shared Utility `generateSlug`

**File:** `backend/src/shared/utils/generate-slug.ts`

```typescript
/**
 * Generates a URL-safe slug from a given name.
 * Handles Spanish characters, parentheses, and special chars.
 *
 * Examples:
 *   "Miranda (Carabobo)" → "miranda-carabobo"
 *   "José Ángel Lamas"   → "jose-angel-lamas"
 *   "El Hatillo"         → "el-hatillo"
 */
export function generateSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
```

---

## Step 2: Create Interfaces

**File:** `backend/src/modules/cities/interfaces/city.interface.ts`

```typescript
import { Document } from 'mongoose';

export interface IMunicipality {
  name: string;
  slug: string;
}

export interface ICityDocument extends Document {
  name: string;
  slug: string;
  municipalities: IMunicipality[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

No Create/Update DTOs needed — this is a read-only collection.

---

## Step 3: Create Model

**File:** `backend/src/modules/cities/models/city.model.ts`

**Schema definition:**
- `municipalitySchema`: subdocument with `{ name: String (required, trim), slug: String (required, lowercase) }`, `_id: false`
- `citySchema`:
  - `name`: String, required, trim
  - `slug`: String, required, unique, lowercase
  - `municipalities`: [municipalitySchema], default []
  - `isActive`: Boolean, default true
- Options: `timestamps: true`, `toJSON` transform (standard `_id → id`, delete `__v`)
- Indexes: `{ slug: 1 }` unique, `{ name: 'text' }`
- Export: `mongoose.model<ICityDocument>('City', citySchema)`

---

## Step 4: Create Seed Data

**File:** `backend/src/modules/cities/seed/city-seed-data.ts`

- Import `generateSlug` from shared utility
- Export constant `CITY_SEED_DATA: Array<{ name, slug, municipalities[], isActive }>`
- 18 cities pre-computed:

```
Caracas (5 municipalities): Libertador, Chacao, Baruta, Sucre, El Hatillo
Valencia (5): Valencia, Naguanagua, San Diego, Los Guayos, Libertador
Maracay (6): Girardot, Mario Briceño Iragorry, Francisco Linares Alcántara, Santiago Mariño, Libertador, José Ángel Lamas
Barquisimeto (1): Iribarren
Cabudare (1): Palavecino
Bejuma (1): Bejuma
Montalbán (1): Montalbán
Miranda (Carabobo) (1): Miranda
Puerto Cabello (1): Puerto Cabello
Morón (1): Juan José Mora
Guacara (3): Guacara, San Joaquín, Diego Ibarra
Los Teques (3): Guaicaipuro, Los Salias, Carrizal
Guarenas-Guatire (2): Plaza, Zamora
Valles del Tuy (6): Cristóbal Rojas, Urdaneta, Independencia, Lander, Paz Castillo, Simón Bolívar
La Victoria (3): José Félix Ribas, José Rafael Revenga, Santos Michelena
Quíbor (1): Jiménez
El Tocuyo (1): Morán
Carora (1): Torres
```

Total: 18 cities, 43 municipalities.

---

## Step 5: Create Service

**File:** `backend/src/modules/cities/services/city.service.ts`

```
class CityService {
  async getAll(): Promise<ICityDocument[]>
    → City.find({ isActive: true }).sort({ name: 1 })

  async getBySlug(slug: string): Promise<ICityDocument>
    → City.findOne({ slug: slug.toLowerCase() })
    → if (!city) throw new AppError('Ciudad no encontrada', 404)
    → return city

  async seedCities(): Promise<void>
    → const count = await City.countDocuments()
    → if (count > 0) return  // idempotent
    → await City.insertMany(CITY_SEED_DATA)
    → console.log(`✅ ${CITY_SEED_DATA.length} ciudades sembradas correctamente`)
}

export const cityService = new CityService()
```

---

## Step 6: Create Controller

**File:** `backend/src/modules/cities/controllers/city.controller.ts`

```
class CityController {
  async getAll(req, res, next): Promise<void>
    → try { const cities = await cityService.getAll(); res.json({ success: true, data: cities }) }
    → catch (error) { next(error) }

  async getBySlug(req, res, next): Promise<void>
    → try { const city = await cityService.getBySlug(req.params.slug); res.json({ success: true, data: city }) }
    → catch (error) { next(error) }
}

export const cityController = new CityController()
```

---

## Step 7: Create Routes

**File:** `backend/src/modules/cities/routes/city.routes.ts`

```
GET /          → cityController.getAll       // Public, no auth
GET /:slug     → cityController.getBySlug    // Public, no auth
```

All routes are public — no `authenticate` middleware. Cities are reference data.

Export default router.

---

## Step 8: Create Module Index

**File:** `backend/src/modules/cities/index.ts`

```typescript
export * from './interfaces/city.interface';
export * from './models/city.model';
export * from './services/city.service';
export * from './controllers/city.controller';
export { default as cityRoutes } from './routes/city.routes';
```

---

## Verification

1. `npx tsc --noEmit` — zero errors
2. Start server → check MongoDB `cities` collection has 18 documents
3. `GET /api/cities` → returns 18 cities with municipalities
4. `GET /api/cities/caracas` → returns Caracas with 5 municipalities
5. `GET /api/cities/invalid` → returns 404
6. Restart server → no duplicate cities (idempotent seed)
