# Zones, Branches & Products — Architecture Redesign

> **Status:** Approved Design — Ready for Implementation
> **Scope:** Admin Module only (client-side checkout will be addressed separately)
> **Date:** 2026-03-27
> **Implementation Phases:** See `docs/plans/phase-*.md` for step-by-step guides

---

## 0. Engineering Principles

### SOLID Applied

| Principle | Application |
|-----------|-------------|
| **Single Responsibility** | Each module (City, Zone, BranchZone, BranchProduct) owns ONE domain. Pivots are independent entities with their own lifecycle, not embedded subdocuments. |
| **Open/Closed** | Adding fields to BranchZone (e.g. `estimatedDeliveryTime`) or BranchProduct (e.g. `localPrice`) requires NO changes to Branch or Product models. |
| **Liskov Substitution** | All Document interfaces extend Mongoose `Document` consistently. DTOs are proper subtypes. |
| **Interface Segregation** | Separate DTOs for Create, Update, and Query. No monolithic interfaces with unnecessary optional fields. |
| **Dependency Inversion** | Services depend on model interfaces, not concrete implementations. Controllers delegate to services. Dynamic imports (`await import()`) prevent circular dependencies between modules. |

### Performance & Scalability

| Strategy | Detail |
|----------|--------|
| **Compound Indexes** | `{branch, zone}` UNIQUE and `{branch, product}` UNIQUE — O(log n) lookups and duplicate prevention at DB level. |
| **Individual FK Indexes** | `{branch: 1}`, `{zone: 1}`, `{product: 1}` — fast reverse lookups ("all zones for branch X"). |
| **Batch Operations** | `insertMany()` for BranchZone and BranchProduct creation — single round-trip instead of N. |
| **Selective Populate** | Only requested fields: `.populate('branch', 'name address isActive')` — reduces data transfer. |
| **Separate Collections** | Pivots as collections (not embedded arrays) — enables independent pagination, prevents unbounded document growth. |

### Referential Integrity

| Rule | Implementation |
|------|---------------|
| **Cascade Delete** | Branch deletion → delete all BranchZones + BranchProducts. Product deletion → delete all BranchProducts. |
| **Block Delete** | Zone deletion blocked if any BranchZone references it (protects delivery configuration). |
| **Cross Validation** | Zone creation validates `municipalities[]` slugs exist in referenced `city.municipalities`. |
| **DB-Level Constraints** | Compound unique indexes prevent duplicates even if application validation fails (defense in depth). |

### Security

| Measure | Detail |
|---------|--------|
| **Auth on writes** | All POST/PUT/DELETE routes use `authenticate` middleware (JWT Bearer token). |
| **Input sanitization** | `trim: true` on all string fields in Mongoose schemas. |
| **No raw query injection** | Parameters are typed and validated before reaching MongoDB queries. |
| **Selective response** | `toJSON` transform removes `_id` and `__v`, exposes clean `id` field. |

### Error Handling Strategy

Uses existing project pattern:
- **`AppError`** class (`backend/src/shared/errors/app-error.ts`) — custom errors with `statusCode` and `isOperational`.
- **Centralized middleware** (`backend/src/shared/middlewares/error.middleware.ts`) — catches AppError, Mongoose CastError, ValidationError, duplicate key (11000).
- **HTTP codes**: 201 (Created), 204 (No Content), 400 (Bad Request), 404 (Not Found), 409 (Conflict).
- **Frontend interceptor** (`auth.interceptor.ts`) — handles 401 redirects.

---

## 1. Purpose & Business Context

The system manages an e-commerce platform for automotive products (oils, parts, combos, oil-change services). Products are sold through **branches** (physical stores), each branch operates in one or more **zones** (geographic coverage areas defined by city + municipalities).

### Core Business Rules

| Rule | Description |
|------|-------------|
| **Zone freedom** | Zones are freely created. Multiple zones can share the same municipalities. |
| **Zone name uniqueness** | Zone names must be globally unique (UNIQUE index). |
| **Branch-Zone agnosticism** | A branch can have multiple zones assigned, even if those zones share municipalities. Each assignment has independent delivery config. |
| **No duplicate zone per branch** | The same zone cannot be assigned twice to the same branch (UNIQUE compound `{branch, zone}`). |
| **Stock per branch** | Product stock is tracked per branch, not globally. If a product is in 3 branches, it has 3 independent stock values. |
| **No duplicate product per branch** | The same product cannot be assigned twice to the same branch (UNIQUE compound `{branch, product}`). |

---

## 2. Data Models

### 2.1 City (Seed / Static Reference)

> **Collection:** `cities`
> **Nature:** Read-only. Populated once via seed script. Admin does NOT manage this.

```
City {
  _id:            ObjectId
  name:           String        (required, e.g. "Caracas")
  slug:           String        (required, unique, e.g. "caracas")
  municipalities: [{
    name:         String        (required, e.g. "Libertador")
    slug:         String        (required, e.g. "libertador")
  }]
  isActive:       Boolean       (default: true)
  timestamps
}

Indexes:
  { slug: 1 }        UNIQUE
  { name: 'text' }
```

**Seed data (18 cities):**

```json
{
  "Caracas": ["Libertador", "Chacao", "Baruta", "Sucre", "El Hatillo"],
  "Valencia": ["Valencia", "Naguanagua", "San Diego", "Los Guayos", "Libertador"],
  "Maracay": ["Girardot", "Mario Briceño Iragorry", "Francisco Linares Alcántara", "Santiago Mariño", "Libertador", "José Ángel Lamas"],
  "Barquisimeto": ["Iribarren"],
  "Cabudare": ["Palavecino"],
  "Bejuma": ["Bejuma"],
  "Montalbán": ["Montalbán"],
  "Miranda (Carabobo)": ["Miranda"],
  "Puerto Cabello": ["Puerto Cabello"],
  "Morón": ["Juan José Mora"],
  "Guacara": ["Guacara", "San Joaquín", "Diego Ibarra"],
  "Los Teques": ["Guaicaipuro", "Los Salias", "Carrizal"],
  "Guarenas-Guatire": ["Plaza", "Zamora"],
  "Valles del Tuy": ["Cristóbal Rojas", "Urdaneta", "Independencia", "Lander", "Paz Castillo", "Simón Bolívar"],
  "La Victoria": ["José Félix Ribas", "José Rafael Revenga", "Santos Michelena"],
  "Quíbor": ["Jiménez"],
  "El Tocuyo": ["Morán"],
  "Carora": ["Torres"]
}
```

**Replaces:** `ReferenceCity`, `State` collections (both will be removed).

---

### 2.2 Zone (Admin-Created)

> **Collection:** `zones`
> **Nature:** Created and managed by admin. Represents an operational coverage area.

```
Zone {
  _id:            ObjectId
  name:           String        (required, UNIQUE, min 2 chars, e.g. "Zona Caracas Centro")
  city:           ObjectId → City  (required, ref)
  municipalities: [String]      (array of municipality slugs from city, min 1)
  isActive:       Boolean       (default: true)
  timestamps
}

Indexes:
  { name: 1 }        UNIQUE
  { city: 1 }
  { isActive: 1 }
```

**Validation rules:**
- `name` must be globally unique (409 if duplicate).
- `city` must reference an existing City document.
- Each value in `municipalities[]` must exist in the referenced `city.municipalities[].slug`.
- At least 1 municipality required.
- No duplicate slugs within the array.
- Multiple zones CAN share the same city and/or municipalities (no constraint on this).

**Replaces:** Current `City` model used as "zone" (collection `cities` for operational data).

---

### 2.3 Branch (Simplified)

> **Collection:** `branches`
> **Nature:** Physical store location. Zone relationships moved to BranchZone pivot.

```
Branch {
  _id:            ObjectId
  name:           String        (required)
  description:    String        (optional)
  address:        String        (required)
  whatsappPhone:  String        (required)
  landlinePhone:  String        (optional)
  schedule: [{
    day:          Number        (0-6)
    dayName:      String        ("Lunes"..."Domingo")
    openTime:     String        (default: "08:00")
    closeTime:    String        (default: "18:00")
    isClosed:     Boolean       (default: false)
  }]
  coordinates: {
    latitude:     Number
    longitude:    Number
  }
  isActive:       Boolean       (default: true)
  timestamps
}

Indexes:
  { name: 'text' }
  { isActive: 1 }
```

**REMOVED fields (vs current model):**
- `stateCode`, `stateName`, `cityCode`, `cityName` (legacy flat)
- `serviceMunicipalities[]` (legacy flat)
- `serviceZones[]` (embedded zone data)

All zone and delivery configuration now lives in `BranchZone`.

---

### 2.4 BranchZone (Pivot — Branch ↔ Zone + Delivery Config)

> **Collection:** `branch_zones`
> **Nature:** Many-to-many relationship between Branch and Zone, with delivery configuration per municipality.

```
BranchZone {
  _id:            ObjectId
  branch:         ObjectId → Branch   (required)
  zone:           ObjectId → Zone     (required)
  deliveryConfig: [{
    municipality:       String        (slug, required)
    hasDelivery:        Boolean       (default: false)
    freeDelivery:       Boolean       (default: true)
    deliveryCharge:     Number        (default: 0, min: 0)
  }]
  isActive:       Boolean       (default: true)
  timestamps
}

Indexes:
  { branch: 1, zone: 1 }              UNIQUE (prevents same zone assigned twice to same branch)
  { branch: 1 }
  { zone: 1 }
  { 'deliveryConfig.municipality': 1 }
```

**Auto-population:** When a zone is assigned to a branch, `deliveryConfig` is automatically populated with one entry per municipality in the zone (all toggles OFF by default). The admin then configures each municipality.

**Key behaviors:**
- A branch can have zones that share municipalities (branch is agnostic).
- Each BranchZone has its own independent delivery config.
- Deleting a zone is blocked if any BranchZone references it.

---

### 2.5 BranchProduct (Pivot — Branch ↔ Product + Stock)

> **Collection:** `branch_products`
> **Nature:** Many-to-many relationship between Branch and Product, with individual stock tracking.

```
BranchProduct {
  _id:            ObjectId
  branch:         ObjectId → Branch   (required)
  product:        ObjectId → Product  (required)
  stock:          Number              (required, min: 0, default: 0)
  isActive:       Boolean             (default: true)
  timestamps
}

Indexes:
  { branch: 1, product: 1 }   UNIQUE (prevents same product assigned twice to same branch)
  { product: 1 }
  { branch: 1 }
  { stock: 1 }
```

---

### 2.6 Product (Simplified)

> **Collection:** `products`
> **Changes:** Remove `branches[]` and `stock` fields. All other fields remain unchanged.

```
REMOVED fields:
  - branches: ObjectId[]    → relationship now in BranchProduct
  - stock: Number           → stock now per-branch in BranchProduct
```

Everything else (name, slug, sku, price, categories, brand, line, images, compatibleEngines, oilViscosity, etc.) stays exactly as-is.

---

## 3. Relational Diagram

```
City (seed, static, 18 records)
  │
  │ Zone.city (ObjectId ref)
  ▼
Zone (admin-created, named, unique name)
  │
  │ BranchZone.zone (ObjectId ref)
  ▼
BranchZone (pivot: branch + zone + deliveryConfig[])
  │           UNIQUE { branch, zone }
  │
  │ BranchZone.branch (ObjectId ref)
  ▼
Branch (physical store, simplified, no embedded zones)
  │
  │ BranchProduct.branch (ObjectId ref)
  ▼
BranchProduct (pivot: branch + product + stock)
  │              UNIQUE { branch, product }
  │
  │ BranchProduct.product (ObjectId ref)
  ▼
Product (catalog item, no embedded branches, no global stock)
```

---

## 4. Admin UI Flows

### 4.1 Zone Management

#### Create Zone

```
Form fields:
  ┌─────────────────────────────────────────┐
  │  Name *              (text, unique)     │
  │  City *              (searchable select │
  │                       from City seed)   │
  │  Municipalities *    (checkboxes,       │
  │                       shown after city  │
  │                       selection,        │
  │                       min 1 required)   │
  │  Active              (toggle, sidebar)  │
  └─────────────────────────────────────────┘
```

**Flow:**
1. Admin types a unique zone name.
2. Admin selects a city from the searchable dropdown (18 cities from seed).
3. Municipalities for that city appear as checkboxes (max 6 items).
4. Admin checks desired municipalities (min 1).
5. Submit → `POST /api/admin/zones` → redirect to zone list.

**Frontend validation on name:** Debounced check on blur → `GET /api/admin/zones/check-name?name=X` to warn if name already exists before submit.

**No state selection step.** The old 3-level flow (State → City → Municipalities) is replaced by a 2-level flow (City → Municipalities).

#### Edit Zone

- Same form, pre-filled.
- If city is changed and BranchZones reference this zone → show warning modal listing affected branches. If confirmed, associated BranchZones are deleted (cascade).
- If a municipality is unchecked and it exists in a BranchZone's deliveryConfig → show warning modal listing affected branches. If confirmed, that municipality is removed from those BranchZones' deliveryConfig.

#### Delete Zone

- If any BranchZone references this zone → **BLOCK deletion**. Show modal listing affected branches.
- If no references → confirm and delete.

#### Zone List

```
Columns: Name | City | Municipalities | Active | Actions
Filters: Search (name, municipality), City dropdown, Active toggle
```

**Detail modal** includes a "Usage" section showing which branches use this zone (via BranchZone lookup).

---

### 4.2 Branch Management

#### Create Branch

**Section 1 — Basic Info + Schedule** (unchanged from current):
- Name, Address, Description, WhatsApp, Landline, GPS Coordinates, Active toggle.
- Schedule: 7-day grid with open/close times and closed toggle.

**Section 2 — Service Zones** (redesigned):

The old embedded zone creation (State → City → Municipality selection inline) is replaced by:

1. Click **[+ Add Zone]** → searchable dropdown of existing active zones.
2. Dropdown shows per zone: name (bold), city name, municipality list.
3. Zones already assigned to this branch are hidden from dropdown.
4. On selection → zone card appears with auto-populated `deliveryConfig` table (all toggles OFF).
5. Admin configures per municipality: Delivery (on/off) → Free (on/off) → Charge amount → Oil change (on/off).
6. Multiple zones can be added. Previously added zones auto-collapse.
7. Zones can be removed via trash icon on each card (confirmation modal).

**Save flow (2 sequential API calls):**
1. `POST /api/admin/branches` → creates branch, returns `branchId`.
2. `POST /api/admin/branch-zones/batch` → creates all BranchZone documents atomically.

#### Edit Branch

**Load flow (3 parallel API calls):**
1. `GET /api/admin/branches/:id` → branch data.
2. `GET /api/admin/branch-zones?branchId=:id` → existing zone assignments (populated with zone + city).
3. `GET /api/admin/zones?isActive=true` → all zones for the add-zone dropdown.

**Save flow (4 potential API calls):**
1. `PUT /api/admin/branches/:id` → update branch data.
2. `DELETE /api/admin/branch-zones/:id` → for each removed zone.
3. `POST /api/admin/branch-zones/batch` → for newly added zones.
4. `PUT /api/admin/branch-zones/:id` → for existing zones with modified deliveryConfig.

**Frontend tracks internally:**
- `existingBranchZones[]` — loaded from API, may have modified deliveryConfig.
- `newBranchZones[]` — added during edit session, no `_id` yet.
- `deletedBranchZoneIds[]` — IDs of BranchZones to delete on save.

#### Delete Branch

- Backend checks for BranchZone and BranchProduct dependencies.
- Shows confirmation modal listing counts: "2 zones assigned, 12 products associated".
- On confirm → cascade delete: BranchZones → BranchProducts → Branch.

#### Branch List

```
Columns: Name + Address | Zones (names) | Municipality count | Schedule | Active | Actions
Filters: Search, Active toggle
```

**Detail modal** now shows:
- Basic info (address, phones, coordinates, description).
- Schedule (7-day grid).
- Zones section: per zone card with city name and municipality delivery badges.
- Products section: count of BranchProducts + link to filtered product list.

---

### 4.3 Product Management

#### Create/Edit Product

**Section "Branches & Stock"** replaces the old multi-select branch picker:

```
┌───────────────────────────────────────────────────────────┐
│  Assign to branches *                     [+ Add]         │
│                                                           │
│  ┌─────────────────────────┬───────┬──────────┬────────┐  │
│  │ Branch                  │ Stock │ Status   │ Action │  │
│  ├─────────────────────────┼───────┼──────────┼────────┤  │
│  │ Sucursal Caracas Centro │ [10]  │ 🟢 Act   │  🗑️   │  │
│  │ Sucursal Valencia       │ [25]  │ 🟢 Act   │  🗑️   │  │
│  │ Sucursal Maracay        │ [ 0]  │ 🔴 Out   │  🗑️   │  │
│  └─────────────────────────┴───────┴──────────┴────────┘  │
│                                                           │
│  Total stock: 35 units across 3 branches                  │
│  ⚠️ 1 branch out of stock                                │
└───────────────────────────────────────────────────────────┘
```

- [+ Add] opens searchable dropdown of active branches (already assigned ones hidden).
- New branch added with stock = 0 by default.
- Stock is editable inline per branch.
- Status column: green if stock > 0, red if stock = 0.

**Save flow (similar to branches):**
1. `POST /api/admin/products` or `PUT /api/admin/products/:id` → product data (no branches, no stock).
2. `POST /api/admin/branch-products/batch` → new assignments.
3. `PUT /api/admin/branch-products/:id` → updated stock values.
4. `DELETE /api/admin/branch-products/:id` → removed assignments.

---

## 5. API Endpoints

### 5.1 Cities (Seed — Read Only)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/cities` | Get all cities with municipalities |
| `GET` | `/api/cities/:slug` | Get city by slug |

### 5.2 Zones (Admin CRUD)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/zones` | Get all zones (public, active only) |
| `GET` | `/api/zones/:id` | Get zone by ID with populated city |
| `GET` | `/api/admin/zones` | Get all zones (admin, includes inactive) |
| `GET` | `/api/admin/zones/check-name` | Check if zone name exists (`?name=X`) |
| `POST` | `/api/admin/zones` | Create zone |
| `PUT` | `/api/admin/zones/:id` | Update zone |
| `DELETE` | `/api/admin/zones/:id` | Delete zone (blocked if BranchZones exist) |

### 5.3 Branches (Admin CRUD — Simplified)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/branches` | Get all branches (public) |
| `GET` | `/api/branches/active` | Get active branches |
| `GET` | `/api/branches/:id` | Get branch by ID |
| `POST` | `/api/admin/branches` | Create branch (data only, no zones) |
| `PUT` | `/api/admin/branches/:id` | Update branch (data only) |
| `DELETE` | `/api/admin/branches/:id` | Delete branch (cascade BranchZones + BranchProducts) |
| `PATCH` | `/api/admin/branches/:id/status` | Toggle active status |

### 5.4 BranchZones (New — Pivot Management)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/admin/branch-zones` | Query by `?branchId=X` or `?zoneId=X` (populated) |
| `POST` | `/api/admin/branch-zones/batch` | Create multiple BranchZones atomically |
| `PUT` | `/api/admin/branch-zones/:id` | Update deliveryConfig |
| `DELETE` | `/api/admin/branch-zones/:id` | Delete single association |

### 5.5 BranchProducts (New — Pivot Management)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/admin/branch-products` | Query by `?branchId=X` or `?productId=X` (populated) |
| `POST` | `/api/admin/branch-products/batch` | Create multiple BranchProducts atomically |
| `PUT` | `/api/admin/branch-products/:id` | Update stock |
| `DELETE` | `/api/admin/branch-products/:id` | Delete single association |

### 5.6 Public Query (Refactored)

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/branches/by-zone` | `?citySlug=X&municipality=Y` → find branches serving a location |

---

## 6. Migration Plan

### Phase 1 — Data Models (Backend)

| # | Task | Detail |
|---|------|--------|
| 1.1 | Create `City` model + seed script | 18 cities from JSON. Drop `ReferenceCity` and `State`. |
| 1.2 | Refactor `Zone` model | New schema: `name` (unique), `city` (ref), `municipalities` (slugs). Drop old fields. |
| 1.3 | Create `BranchZone` model | Pivot with deliveryConfig. Unique compound index. |
| 1.4 | Simplify `Branch` model | Remove all zone-related fields (serviceZones, legacy flat fields). |
| 1.5 | Create `BranchProduct` model | Pivot with stock. Unique compound index. |
| 1.6 | Simplify `Product` model | Remove `branches[]` and `stock` fields. |

### Phase 2 — Services & Controllers (Backend)

| # | Task | Detail |
|---|------|--------|
| 2.1 | `CityService` | Read-only: `getAll()`, `getBySlug()`. Seed script. |
| 2.2 | Refactor `ZoneService` | New CRUD. Validate municipalities against city. Check name uniqueness. |
| 2.3 | Create `BranchZoneService` | CRUD + batch create. Auto-populate deliveryConfig. Validate uniqueness. |
| 2.4 | Refactor `BranchService` | Remove zone logic. `findByZone()` now queries BranchZone. |
| 2.5 | Create `BranchProductService` | CRUD + batch create. Stock per association. Validate uniqueness. |
| 2.6 | Refactor `ProductService` | Remove `branches[]` and `stock` from queries. Add aggregated stock via BranchProduct. |
| 2.7 | New routes | Routes for BranchZone and BranchProduct. Refactor existing. |

### Phase 3 — Frontend Admin

| # | Task | Detail |
|---|------|--------|
| 3.1 | Refactor Zone form | New flow: City select (seed) → municipality checkboxes. Remove state selection. |
| 3.2 | Refactor Branch form | Remove embedded zone creation. Add zone picker from existing zones + deliveryConfig table. |
| 3.3 | Refactor Product form | Remove branch multi-select. Add branch assignment table with per-branch stock. |
| 3.4 | Update interfaces | New: `City`, `Zone`, `BranchZone`, `BranchProduct`. Update: `Branch`, `Product`. |
| 3.5 | New HTTP services | `CityService`, `BranchZoneService`, `BranchProductService`. Refactor existing. |
| 3.6 | Update list components | Branch list shows zone names. Product list shows stock summary. |

### Phase 4 — Data Migration

| # | Task | Detail |
|---|------|--------|
| 4.1 | Seed cities | Run seed script for 18 cities. |
| 4.2 | Migrate zones | Transform existing City documents into Zone documents. |
| 4.3 | Migrate branches | Extract `serviceZones` into BranchZone documents. Clean branch documents. |
| 4.4 | Migrate products | Extract `branches[]` into BranchProduct documents (initial stock = current global stock / branch count or manual). |
| 4.5 | Cleanup | Drop `reference_cities`, `states` collections. Remove deprecated fields. |

---

## 7. Integrity & Cascade Rules

| Action | Cascade Behavior |
|--------|-----------------|
| Delete Zone | **BLOCKED** if any BranchZone references it. Admin must remove associations first. |
| Delete Branch | **CASCADE** delete all BranchZones and BranchProducts for that branch. |
| Delete Product | **CASCADE** delete all BranchProducts for that product. |
| Deactivate Zone | BranchZones remain. Zone hidden from "add zone" dropdown. Public queries may exclude. |
| Deactivate Branch | BranchZones and BranchProducts remain. Public queries filter by `branch.isActive`. |
| Edit Zone (change city) | If BranchZones exist → warn admin → on confirm, delete affected BranchZones. |
| Edit Zone (remove municipality) | If municipality in any BranchZone's deliveryConfig → warn admin → on confirm, remove from deliveryConfig. |

---

## 8. Edge Cases

| Scenario | Behavior |
|----------|----------|
| Two zones with same municipalities, different names | ✅ Allowed. Zones are freely created. |
| Two zones with same name | ❌ Blocked. UNIQUE index on `name`. |
| Branch with two zones sharing municipalities | ✅ Allowed. Branch is agnostic. Each BranchZone has independent deliveryConfig. |
| Same zone assigned twice to same branch | ❌ Blocked. UNIQUE compound `{branch, zone}`. |
| Same product assigned twice to same branch | ❌ Blocked. UNIQUE compound `{branch, product}`. |
| Product in branch with no zones | ✅ Allowed. Product association is independent of zone assignment. |
| Branch with no zones | ✅ Allowed. Warning shown in UI ("No coverage areas"). |
| Zone with all municipalities unchecked | ❌ Blocked. Min 1 municipality required. |
| City from seed with no zones created | Normal. City just isn't used yet. |

---

## 9. Modules Impacted Outside Admin

> **Note:** These will be addressed in a future phase.

| Module | Impact | Required Change |
|--------|--------|----------------|
| Checkout Shipping Form | Uses `getAllStates()` + `getReferenceCities()` | Replace with `CityService.getAll()` |
| Checkout Local Delivery | Reads `branch.serviceZones` | Read from BranchZone via API |
| Checkout Oil Change | Reads `branch.serviceZones` | Read from BranchZone via API |
| Mechanic Form | References `zone: ObjectId → City` | Update to reference new Zone model |
| Orders | Stores `recipientCity/Municipality` as strings | No change (snapshots are fine) |
| Order Items | No branch reference | Future: add `branch` field to OrderItem for traceability |

---

## 10. Detailed Validations Per Entity

### Zone Validations

**Create (`POST /api/admin/zones`):**

| # | Validation | HTTP Code | Error Message |
|---|-----------|-----------|---------------|
| 1 | `name` required, min 2 chars | 400 | "El nombre es obligatorio (mínimo 2 caracteres)" |
| 2 | `name` globally unique | 409 | "Ya existe una zona con el nombre '{name}'" |
| 3 | `city` must reference existing City | 400 | "La ciudad no existe" |
| 4 | `municipalities` min 1 item | 400 | "Debe seleccionar al menos un municipio" |
| 5 | No duplicate slugs in array | 400 | "Municipios duplicados en la selección" |
| 6 | Each slug must exist in `city.municipalities[].slug` | 400 | "El municipio '{slug}' no pertenece a la ciudad {city.name}" |

**Update (`PUT /api/admin/zones/:id`):**
- Same validations as create.
- Name uniqueness check excludes self: `{ name, _id: { $ne: id } }`.
- If `city` changes and BranchZones exist → return `warnings[]` (frontend shows confirmation modal).

**Delete (`DELETE /api/admin/zones/:id`):**
- If `BranchZone.countDocuments({ zone: id }) > 0` → 409: "Zona asignada a N sucursal(es). Desasóciala primero."

**Check Name (`GET /api/admin/zones/check-name?name=X`):**
- Returns `{ success: true, data: { exists: boolean } }`.
- Frontend calls on blur with 500ms debounce.

### BranchZone Validations

**Create Batch (`POST /api/admin/branch-zones/batch`):**

| # | Validation | HTTP Code | Error Message |
|---|-----------|-----------|---------------|
| 1 | `branchId` must reference existing Branch | 400 | "La sucursal no existe" |
| 2 | Each `zoneId` must reference existing Zone | 400 | "La zona '{name}' no existe" |
| 3 | No existing BranchZone with same `{branch, zone}` | 409 | "La zona '{name}' ya está asignada a esta sucursal" |
| 4 | If `deliveryConfig` not provided → auto-populate from `zone.municipalities` | — | (no error, auto-generate) |

### BranchProduct Validations

**Create Batch (`POST /api/admin/branch-products/batch`):**

| # | Validation | HTTP Code | Error Message |
|---|-----------|-----------|---------------|
| 1 | `productId` must reference existing Product | 400 | "El producto no existe" |
| 2 | Each `branchId` must reference existing Branch | 400 | "La sucursal '{name}' no existe" |
| 3 | No existing BranchProduct with same `{branch, product}` | 409 | "El producto ya está asignado a la sucursal '{name}'" |
| 4 | `stock` must be >= 0 | 400 | "El stock no puede ser negativo" |

**Update Stock (`PATCH /api/admin/branch-products/:id/stock`):**
- `body.quantity` can be positive (add) or negative (subtract).
- `newStock = current + quantity`. If `newStock < 0` → 400: "Stock insuficiente".

---

## 11. Detailed UI Mockups

### Zone Form (Create)

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Volver a Zonas                       NUEVA ZONA                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─── INFORMACIÓN DE LA ZONA ─────────────┐ ┌─── ESTADO ────────┐ │
│  │                                         │ │                    │ │
│  │  Nombre de la zona *                    │ │  Zona activa       │ │
│  │  ┌─────────────────────────────────┐    │ │  ┌────┐            │ │
│  │  │ Zona Caracas Centro             │    │ │  │ ON │ ●          │ │
│  │  └─────────────────────────────────┘    │ │  └────┘            │ │
│  │  ✅ Nombre disponible                   │ │                    │ │
│  │  ❌ Ya existe una zona con este nombre  │ └────────────────────┘ │
│  │  (validated on blur, 500ms debounce)    │                        │
│  │                                         │                        │
│  │  Ciudad *                               │                        │
│  │  ┌─────────────────────────────┬───┐    │                        │
│  │  │ 🔍 Buscar ciudad...        │ ▼ │    │                        │
│  │  └─────────────────────────────┴───┘    │                        │
│  │  (18 cities from seed, searchable)      │                        │
│  │                                         │                        │
│  │  @if (selectedCity) {                   │                        │
│  │    Municipios *        Todos ☐          │                        │
│  │    ┌───────────────────────────────┐    │                        │
│  │    │ ☑ Libertador   ☑ Chacao      │    │                        │
│  │    │ ☐ Baruta       ☐ Sucre       │    │                        │
│  │    │ ☐ El Hatillo                  │    │                        │
│  │    └───────────────────────────────┘    │                        │
│  │    2 de 5 seleccionados                 │                        │
│  │  }                                      │                        │
│  └─────────────────────────────────────────┘                        │
│                                                                     │
│  ┌──────────┐  ┌──────────────┐                                     │
│  │ Cancelar │  │  Crear Zona  │                                     │
│  └──────────┘  └──────────────┘                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Branch Form — Service Zones Section

```
┌─────────────────────────────────────────────────────────────────────┐
│  ZONAS DE SERVICIO                              [+ Agregar Zona]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─ ZONA: Zona Caracas Centro ──────────────────────── ▾ ──[🗑️]─┐  │
│  │  📍 Caracas — 2 municipios                                    │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─ ZONA: Zona Valencia Metro ─────────────────────────────[🗑️]─┐  │
│  │  📍 Valencia                                                  │  │
│  │                                                               │  │
│  │  ┌────────────────┬──────────┬─────────┬────────┬───────────┐ │  │
│  │  │ Municipio      │ Delivery │ Gratis  │ Cargo  │ Aceite    │ │  │
│  │  ├────────────────┼──────────┼─────────┼────────┼───────────┤ │  │
│  │  │ Valencia       │  [ON]    │  [ON]   │   —    │   [ON]    │ │  │
│  │  │ Naguanagua     │  [OFF]   │   —     │   —    │   [OFF]   │ │  │
│  │  │ San Diego      │  [ON]    │  [OFF]  │ $5.00  │   [OFF]   │ │  │
│  │  │ Los Guayos     │  [OFF]   │   —     │   —    │   [OFF]   │ │  │
│  │  │ Libertador     │  [OFF]   │   —     │   —    │   [OFF]   │ │  │
│  │  └────────────────┴──────────┴─────────┴────────┴───────────┘ │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Add Zone Dropdown (on click [+ Agregar Zona]):                     │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │ 🔍 Buscar zona...                                      │        │
│  ├─────────────────────────────────────────────────────────┤        │
│  │ 🟢 Zona CCS Este                                       │        │
│  │    Caracas — Baruta, Sucre, El Hatillo                  │        │
│  │ 🟢 Zona Maracay Piloto                                  │        │
│  │    Maracay — Girardot                                   │        │
│  │ (zones already assigned are hidden from this list)      │        │
│  └─────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

### Product Form — Branches & Stock Section

```
┌─────────────────────────────────────────────────────────────────────┐
│  SUCURSALES Y STOCK                                   [+ Agregar]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────┬───────┬──────────┬──────────────┐  │
│  │ Sucursal                    │ Stock │ Estado   │ Acción       │  │
│  ├─────────────────────────────┼───────┼──────────┼──────────────┤  │
│  │ 📍 Sucursal Caracas Centro  │ [10]  │  🟢 Ok   │     🗑️      │  │
│  │ 📍 Sucursal Valencia        │ [25]  │  🟢 Ok   │     🗑️      │  │
│  │ 📍 Sucursal Maracay         │ [ 0]  │  🔴 Ago  │     🗑️      │  │
│  └─────────────────────────────┴───────┴──────────┴──────────────┘  │
│                                                                     │
│  Stock total: 35 unidades en 3 sucursales                           │
│  ⚠️ 1 sucursal sin stock                                           │
│                                                                     │
│  Add Branch Dropdown (on click [+ Agregar]):                        │
│  ┌─────────────────────────────────────────────────────────┐        │
│  │ 🔍 Buscar sucursal...                                   │        │
│  ├─────────────────────────────────────────────────────────┤        │
│  │ 🟢 Sucursal Barquisimeto — Barquisimeto                 │        │
│  │ 🟢 Sucursal Los Teques — Los Teques                     │        │
│  │ (already assigned branches are hidden)                   │        │
│  └─────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 12. Shared Utilities

### `generateSlug(name: string): string`
**Location:** `backend/src/shared/utils/generate-slug.ts`

```
Input:  "Miranda (Carabobo)"  → Output: "miranda-carabobo"
Input:  "José Ángel Lamas"    → Output: "jose-angel-lamas"
Input:  "El Hatillo"          → Output: "el-hatillo"
Input:  "Guarenas-Guatire"    → Output: "guarenas-guatire"

Algorithm:
  1. normalize('NFD') → decompose accented chars
  2. replace /[\u0300-\u036f]/g → remove diacritics
  3. toLowerCase()
  4. replace /[^a-z0-9]+/g with '-' → replace non-alphanumeric
  5. replace /^-|-$/g → trim leading/trailing hyphens
```

Used by: City seed script (pre-computed slugs for determinism).

---

## 13. Known TODOs — Client Module (Future Phase)

> These components were stubbed with TODO comments during the admin redesign to maintain compilation.
> They require a dedicated implementation phase for the client-side checkout flow.

| Component | Stubbed Method | What Needs To Be Done |
|-----------|---------------|----------------------|
| `checkout-shipping-form` | `loadReferenceStates()` | Replace with `CityService.getAll()` to populate city/municipality selects |
| `checkout-local-delivery-form` | `loadBranchZones()` | Load BranchZones for selected branch via `BranchZoneService` |
| `checkout-oil-change-form` | `loadBranchZones()` | Same as local delivery |
| `checkout-dispatch` | Zone-based effects | Refactor to use new BranchZone-based location lookup |
| `checkout.service` | `loadDeliveryConfigForZone()` | Load delivery config from BranchZone pivot instead of embedded branch data |
| `checkout-summary` | `getLocalDeliveryConfig()` | Read delivery charges from BranchZone |
| `zoning-modal` | All methods | Complete rewrite to use City + Zone + BranchZone for location selection |
| `product-detail` | `availableStock` | Query `BranchProductService` for real per-branch stock |
| `product-list` (admin) | `getTotalStock()` | Aggregate stock via `BranchProductService.getByProduct()` |
| `catalog` | Zone-based filtering | Filter products by location via BranchZone → BranchProduct chain |
| `tubus-header` | Zone selection | Refactor to use new City-based location picker |
| `order.service` (backend) | Stock validation | Validate and decrement stock via `BranchProduct` instead of `Product.stock` |
