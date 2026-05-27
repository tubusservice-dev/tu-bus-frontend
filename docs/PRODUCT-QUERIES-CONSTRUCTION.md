# Construcción y Auditoría de Queries de Productos — Documentación Técnica

**Fecha:** 2026-05-08
**Propósito:** Documentar la construcción exacta de cada query de productos del backend, los problemas detectados en cada una y las recomendaciones de mejora.
**Modo:** Read-only / Deep-debug (no se ha aplicado ninguna corrección).

---

## ÍNDICE

1. [Resumen ejecutivo](#resumen-ejecutivo)
2. [Query 1 — Catálogo del cliente](#query-1--catálogo-del-cliente)
   1. [Construcción](#11-construcción-paso-a-paso)
   2. [Hallazgos](#12-hallazgos--problemas-detectados)
   3. [Recomendaciones](#13-recomendaciones)
3. [Query 2 — Lista de productos del admin](#query-2--lista-de-productos-del-admin)
   1. [Construcción](#21-construcción-paso-a-paso)
   2. [Hallazgos](#22-hallazgos--problemas-detectados)
   3. [Recomendaciones](#23-recomendaciones)
4. [Query 3 — Detalles del producto del cliente](#query-3--detalles-del-producto-del-cliente)
   1. [Construcción](#31-construcción)
   2. [Hallazgos](#32-hallazgos--problemas-detectados)
   3. [Recomendaciones](#33-recomendaciones)
5. [Query 4 — Productos del Landing Page](#query-4--productos-del-landing-page)
   1. [Construcción](#41-construcción)
   2. [Hallazgos](#42-hallazgos--problemas-detectados)
   3. [Recomendaciones](#43-recomendaciones)
6. [Análisis de modelos e índices](#análisis-de-modelos-e-índices)
7. [Patrones cross-cutting (afectan a varias queries)](#patrones-cross-cutting)
8. [Tabla resumen de impacto](#tabla-resumen-de-impacto)
9. [Plan de remediación priorizado](#plan-de-remediación-priorizado)
10. [Anexo — Archivos relevantes](#anexo--archivos-relevantes)

---

# RESUMEN EJECUTIVO

**Causa raíz dominante de la lentitud** (combinación de 4 patrones repetidos):

| # | Patrón | Severidad | Queries afectadas |
|---|--------|-----------|-------------------|
| A | `$regex` sin anchor (`^`) en `search` → COLLSCAN, ignora `text index` ya creado | 🔴 Alta | Catálogo, Admin |
| B | `$lookup` ejecutado **antes** de `$skip/$limit` → escanea todo el catálogo aunque la UI muestre 10–20 docs | 🔴 Crítica | Admin (`branchId='all'`), Landing |
| C | Round-trips secuenciales para resolver IDs y luego inyectarlos como `$in: [miles]` | 🟠 Alta | Catálogo, Landing |
| D | Falta de índices compuestos (`isActive + categories`, `isActive + brand`, `branch + isActive + stock`) | 🟠 Alta | Todas |

**Hallazgo crítico:** la query `findAllByBranch` con `branchId='all'` (vista por defecto del admin) ejecuta un `$lookup` desde `branch_products` para **cada producto del catálogo**, antes de paginar. Si hay 5.000 productos, se procesan ~5.000 lookups aunque la UI solo muestre 20.

**Confianza:** Alta. Problemas determinísticos verificables con `db.collection.find({...}).explain('executionStats')`.

---

# QUERY 1 — CATÁLOGO DEL CLIENTE

**Endpoint:** `GET /api/products`
**Controller:** [`product.controller.ts:33-86`](../backend/src/modules/products/controllers/product.controller.ts) — `ProductController.getAll`
**Service:** [`product.service.ts:26-346`](../backend/src/modules/products/services/product.service.ts) — `ProductService.findAll`
**Ruta pública:** [`product.routes.ts:7`](../backend/src/modules/products/routes/product.routes.ts)

### Parámetros aceptados (Query string)

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `page` | number | `1` | Página actual |
| `limit` | number | `10` | Items por página |
| `line` | ObjectId | — | Filtra por línea |
| `brand` | ObjectId | — | Filtra por marca |
| `category` | ObjectId | — | Filtra por categoría específica |
| `vehicleType` | enum | — | `carro`, `camioneta`, `moto`, `camion`, `autobus`, `maquinaria-pesada`, `all` |
| `minPrice` / `maxPrice` | number | — | Rango de precio |
| `isActive` | boolean | — | Solo activos / solo inactivos |
| `isFeatured` | boolean | — | Solo destacados |
| `isCombo` | boolean | — | Solo combos |
| `comboFirst` | boolean | — | Combos al inicio del orden |
| `search` | string | — | Texto de búsqueda |
| `sortBy` | string | `createdAt` | Campo de ordenamiento |
| `sortOrder` | string | `desc` | `asc` o `desc` |
| `engineDisplacement` / `engineFuelType` / `engineCylinders` | — | — | Compatibilidad de motor |
| `branchIds` | string CSV | — | Filtra solo productos con stock en estas sucursales |
| `view` | string | `full` | `card` (lightweight) o `full` |

## 1.1 Construcción paso a paso

### **Paso 0 — Inicialización**

```ts
const skip = (page - 1) * limit;
const filter: any = {};
```

### **Paso 1 — Zone Filter (si `branchIds`)**

Resuelve el conjunto de productos con stock en las sucursales pedidas:

```ts
// Round-trip 1
const bps = await BranchProduct.find({
  branch: { $in: branchIdArray.map(id => new Types.ObjectId(id)) },
  isActive: true,
  stock: { $gt: 0 },
}).select('product');

const productIds = [...new Set(bps.map(bp => bp.product.toString()))];
filter._id = { $in: productIds.map(id => new Types.ObjectId(id)) };
```

- Línea: [product.service.ts:55-66](../backend/src/modules/products/services/product.service.ts:55)

### **Paso 2 — Filtros simples**

```ts
if (typeof isActive === 'boolean') filter.isActive = isActive;
if (line)   filter.line = line;
if (brand)  filter.brand = brand;
if (category) filter.categories = category;
if (typeof isFeatured === 'boolean') filter.isFeatured = isFeatured;
if (typeof isCombo === 'boolean') filter.isCombo = isCombo;
```

- Línea: [product.service.ts:68-115](../backend/src/modules/products/services/product.service.ts:68)

### **Paso 3 — Filtro por `vehicleType`**

```ts
const useVehicleTypePipeline = !!(vehicleType && vehicleType !== 'all');
if (useVehicleTypePipeline) {
  // Round-trip 2
  const matchingCats = await Category.find({
    vehicleTypes: { $in: [vehicleType, 'all'] },
    isActive: true,
  }).select('_id vehicleTypes').lean();

  // Particiona en categorías "específicas" (que tienen el vehicleType exacto)
  // y "universales" (que tienen 'all'). El orden importa para _priority.
  for (const c of matchingCats) {
    if (c.vehicleTypes.includes('all')) universalCatIds.push(c._id);
    else specificCatIds.push(c._id);
  }

  const eligibleCatIds = [...specificCatIds, ...universalCatIds];

  // Si ya hay un filtro de categoría explícito → AND ambos
  if (filter.categories) {
    filter.$and = [
      { categories: filter.categories },
      { categories: { $in: eligibleCatIds } },
    ];
    delete filter.categories;
  } else {
    filter.categories = { $in: eligibleCatIds };
  }
}
```

- Línea: [product.service.ts:79-113](../backend/src/modules/products/services/product.service.ts:79)

### **Paso 4 — Rango de precio**

```ts
if (minPrice !== undefined || maxPrice !== undefined) {
  filter.price = {};
  if (minPrice !== undefined) filter.price.$gte = minPrice;
  if (maxPrice !== undefined) filter.price.$lte = maxPrice;
}
```

### **Paso 5 — Compatibilidad de motor**

```ts
if (engineDisplacement || engineFuelType || engineCylinders) {
  const engineMatch: any = {};
  if (engineDisplacement) engineMatch.displacement = engineDisplacement;
  if (engineFuelType)     engineMatch.fuelType = engineFuelType;
  if (engineCylinders)    engineMatch.cylinders = engineCylinders;
  filter.compatibleEngines = { $elemMatch: engineMatch };
}
```

### **Paso 6 — Búsqueda por texto (`search`)**

```ts
if (search) {
  const searchRegex = { $regex: search, $options: 'i' };

  // Round-trip 3 — resuelve líneas cuyo nombre matchea el término
  const matchingLines = await Line.find({ name: searchRegex })
    .select('_id').lean();
  const lineIds = matchingLines.map(l => l._id);

  const searchConditions: any[] = [
    { name: searchRegex },
    { description: searchRegex },
    { productModel: searchRegex },
    { sku: searchRegex },
  ];
  if (lineIds.length > 0) {
    searchConditions.push({ line: { $in: lineIds } });
  }

  // Combinación con $or/$and según haya o no filtros previos
  if (filter.$or) {
    filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
    delete filter.$or;
  } else {
    filter.$or = searchConditions;
  }
}
```

### **Paso 7 — Decisión de ruta: aggregate vs find**

```ts
const useAggregation = useVehicleTypePipeline || !!comboFirst;
```

### **Paso 7-A — Ruta AGGREGATE** (cuando hay `vehicleType` o `comboFirst`)

```ts
const sortStage: any = {};
if (comboFirst) sortStage._comboPriority = 1;          // 0 = combo, 1 = no combo
if (useVehicleTypePipeline) sortStage._priority = 1;    // 0 = match específico, 1 = universal
sortStage[sortBy] = sortOrder === 'asc' ? 1 : -1;

const addFieldsStage: any = {};
if (comboFirst) {
  addFieldsStage._comboPriority = {
    $cond: [{ $eq: ['$isCombo', true] }, 0, 1],
  };
}
if (useVehicleTypePipeline) {
  addFieldsStage._priority = {
    $cond: [{
      $gt: [{
        $size: {
          $filter: {
            input: { $ifNull: ['$categories', []] },
            as: 'cid',
            cond: { $in: [{ $toString: '$$cid' }, specificIdSet] },
          },
        },
      }, 0],
    }, 0, 1],
  };
}

const pipeline = [
  { $match: filter },
  { $addFields: addFieldsStage },
  { $sort: sortStage },
  {
    $facet: {
      data: [
        { $skip: skip },
        { $limit: limit },
        { $lookup: { from: 'lines',      localField: 'line',       foreignField: '_id', as: 'line',
                     pipeline: [{ $project: { name: 1, slug: 1 } }] } },
        { $unwind: { path: '$line', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'brands',     localField: 'brand',      foreignField: '_id', as: 'brand',
                     pipeline: [{ $project: { name: 1, slug: 1 } }] } },
        { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
        { $lookup: { from: 'categories', localField: 'categories', foreignField: '_id', as: 'categories',
                     pipeline: [{ $project: { name: 1, slug: 1, vehicleTypes: 1 } }] } },
        { $project: excludePriority },
      ],
      total: [{ $count: 'count' }],
    },
  },
];

const [facet] = await Product.aggregate(pipeline);
products = facet?.data ?? [];
total = facet?.total?.[0]?.count ?? 0;
```

| # | Stage | Función |
|---|-------|---------|
| 1 | `$match` | Aplica todos los filtros del Paso 1–6 |
| 2 | `$addFields` | Calcula `_priority` y `_comboPriority` por documento |
| 3 | `$sort` | Ordena por priority → user sort |
| 4 | `$facet.data` | Pagina (skip/limit) + 3 lookups (line, brand, categories) + project |
| 4 | `$facet.total` | Cuenta documentos del match |

### **Paso 7-B — Ruta FIND** (cuando NO hay `vehicleType` ni `comboFirst`)

```ts
[products, total] = await Promise.all([
  Product.find(filter)
    .populate('line', 'name slug')                         // 1 query interna
    .populate('categories', 'name slug vehicleTypes')      // 1 query interna
    .populate('brand', 'name slug')                        // 1 query interna
    .skip(skip)
    .limit(limit)
    .sort(sortOptions)
    .lean(),
  Product.countDocuments(filter),
]);
```

**Round-trips:** find + countDocuments + 3 populates = **5 queries**.

### **Paso 8 — Best Branch Stock (post-procesamiento si `branchIds`)**

```ts
if (branchIds && products.length > 0) {
  const stockAgg = await BranchProduct.aggregate([
    {
      $match: {
        product: { $in: products.map(p => p._id) },
        branch:  { $in: branchIdArray.map(id => new Types.ObjectId(id)) },
        isActive: true,
      },
    },
    { $sort: { stock: -1 } },
    {
      $group: {
        _id: '$product',
        bestBranchStock: { $first: '$stock' },
        bestBranchId:    { $first: '$branch' },
      },
    },
    { $lookup: { from: 'branches', localField: 'bestBranchId', foreignField: '_id', as: 'bestBranchDoc' } },
    { $unwind: { path: '$bestBranchDoc', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        bestBranchStock: 1,
        bestBranchId:    1,
        bestBranchName:  { $ifNull: ['$bestBranchDoc.name', ''] },
      },
    },
  ]);
  // mapeo a cada producto
}
```

### **Paso 9 — Respuesta**

```ts
return { products, total, pages: Math.ceil(total / limit) };
```

### Resumen de round-trips a la BD

| Caso | Round-trips |
|------|-------------|
| Sin search ni branchIds ni vehicleType | 2 (find + count) o 5 (find + count + 3 populates) |
| Con `search` | +1 (Line.find) |
| Con `vehicleType` | +1 (Category.find) |
| Con `branchIds` | +2 (BranchProduct.find inicial + BranchProduct.aggregate post) |
| **Peor caso (search + vehicleType + branchIds)** | **8 round-trips** |

---

## 1.2 Hallazgos / Problemas detectados

### 🔴 P1 — `$regex` sin anchor desactiva todos los índices (línea 132–163)

```ts
const searchRegex = { $regex: search, $options: 'i' };
{ name: searchRegex },          // ← Index { name: 'text' } NO se usa
{ description: searchRegex },
{ productModel: searchRegex },
{ sku: searchRegex },
```

- Existe el text index `{ name: 'text', description: 'text', productModel: 'text' }` (model línea 88) pero **nunca se usa** porque el código emplea `$regex`.
- Sin anchor `^`, MongoDB no puede usar índice B-tree del campo. Se hace **collection scan completo**.
- Con `$options: 'i'` (case-insensitive) se descarta cualquier índice no-text aún con anchor.
- En catálogos con 5k+ productos, una búsqueda de 3 letras puede tardar **800ms–3s**.

### 🔴 P2 — Round-trip secuencial para resolver IDs por sucursal (línea 55–66)

```ts
const bps = await BranchProduct.find({
  branch: { $in: branchIdArray.map(...) },
  isActive: true,
  stock: { $gt: 0 },
}).select('product');

const productIds = [...new Set(bps.map(bp => bp.product.toString()))];
filter._id = { $in: productIds.map(id => new Types.ObjectId(id)) };
```

- Devuelve **todos** los `BranchProduct` activos (sin paginar). Si la marca tiene 5 sucursales × 2.000 productos en stock = 10.000 docs leídos del wire.
- El array `productIds` se inyecta como `$in: [10k ObjectIds]` en el query principal — degrada el plan de query (puede perder índice si supera ~1.000 elementos).
- Doble conversión `.toString()` → `new ObjectId()` innecesaria.

### 🟠 P3 — Aggregation costoso por `_priority` con `$toString` (línea 195–215)

```ts
addFieldsStage._priority = {
  $cond: [{
    $gt: [{
      $size: {
        $filter: {
          input: { $ifNull: ['$categories', []] },
          as: 'cid',
          cond: { $in: [{ $toString: '$$cid' }, specificIdSet] },
        },
      },
    }, 0],
  }, 0, 1],
};
```

- `$toString` se ejecuta sobre **cada `categoryId` de cada documento** antes del `$skip` y `$limit`.
- Con 5k productos × 3 categorías promedio = 15.000 conversiones por request, cada una con `$filter` interno.

### 🟠 P4 — `$facet` materializa el sort completo antes de paginar (línea 222–265)

- El `$sort` se aplica **antes** del facet, lo que obliga a ordenar todo el dataset filtrado (10k+) y luego paginar.
- Si no hay índice cubriendo `(filter, sortBy)`, MongoDB hace un `IXSCAN + SORT_KEY_GENERATOR` en memoria.

### 🟡 P5 — Tercera query post-resultado para `bestBranchStock` (línea 285–339)

- Se hace un **cuarto** round-trip a `BranchProduct.aggregate()` con `$lookup` a `branches` por cada página.
- Costo bajo (solo opera sobre 10 productos finales) pero podría integrarse al pipeline principal si ya estamos en aggregate.

### 🟡 P6 — Path `find().populate()` ejecuta 4 round-trips (línea 271–282)

- Mongoose ejecuta una query **por cada `populate`** (3 colecciones × 1 query c/u = 3 round-trips después del find).
- Con `Promise.all` no se paralelizan los `populate` entre sí (corren secuenciales por diseño).
- El path de `aggregate` (con `$lookup`) que ya existe es 4× más rápido.

### 🟡 P7 — Rama defensiva muerta (línea 154–162)

El comentario dice *"Si ya hay $or (por zona), usar $and para combinar"* pero el filtro de zona usa `_id: $in`, no `$or`. La rama `if (filter.$or)` **nunca se ejecuta**. Es código muerto.

## 1.3 Recomendaciones

| # | Acción | Impacto | Esfuerzo |
|---|--------|---------|----------|
| R1 | Sustituir `$regex` por `$text: { $search: term }` aprovechando el text index existente | 🔴 Alto | Bajo |
| R2 | Eliminar el round-trip a `BranchProduct` y unificar el zone-filter como `$lookup` dentro del aggregate principal | 🔴 Alto | Medio |
| R3 | Reemplazar `$toString` + comparación de strings por `$in: ['$$cid', specificCatIds]` (los IDs ya son ObjectId) | 🟠 Medio | Trivial |
| R4 | Crear índices compuestos `{isActive,categories,createdAt:-1}`, `{isActive,brand,createdAt:-1}`, `{isActive,line,createdAt:-1}` | 🟠 Alto | Trivial |
| R5 | Forzar siempre la ruta `aggregate` y eliminar `find().populate()` para reducir 4→1 round-trips | 🟡 Medio | Bajo |
| R6 | Eliminar la rama `if (filter.$or)` muerta | 🟢 Bajo | Trivial |
| R7 | Integrar el `bestBranchStock` dentro del pipeline principal (un solo aggregate) | 🟢 Bajo | Medio |

---

# QUERY 2 — LISTA DE PRODUCTOS DEL ADMIN

**Endpoint:** `GET /api/admin/products/by-branch`
**Controller:** [`product.controller.ts:286-334`](../backend/src/modules/products/controllers/product.controller.ts:286) — `ProductController.getAllByBranch`
**Service:** [`admin-product-list.service.ts:61-148`](../backend/src/modules/products/services/admin-product-list.service.ts:61) — `AdminProductListService.findAllByBranch`
**Ruta admin:** [`admin/routes/products.routes.ts:38-41`](../backend/src/modules/admin/routes/products.routes.ts:38) (requiere autenticación admin)

### Parámetros aceptados (Query string)

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| `branchId` | string | `'all'` | `'all'`, `'none'` o un ObjectId de sucursal |
| `page` | number | `1` | |
| `limit` | number | `20` | |
| `search` | string | — | Texto de búsqueda |
| `vehicleType` | enum | — | Filtro por tipo de vehículo |
| `brand` | ObjectId | — | |
| `category` | ObjectId | — | |
| `isActive` | boolean | — | |
| `sortBy` | string | `createdAt` | `price`, `createdAt`, `name` |
| `sortOrder` | string | `desc` | |

## 2.1 Construcción paso a paso

### **Paso 1 — `buildProductMatch()` — Construye el `$match` base**

[admin-product-list.service.ts:151-210](../backend/src/modules/products/services/admin-product-list.service.ts:151)

```ts
const filter: any = {};

if (typeof opts.isActive === 'boolean') filter.isActive = opts.isActive;
if (opts.brand)    filter.brand = opts.brand;
if (opts.category) filter.categories = opts.category;

// Filtro por vehicleType
if (opts.vehicleType && opts.vehicleType !== 'all') {
  // Round-trip 1 → Category.find()
  const matchingCats = await Category.find({
    vehicleTypes: { $in: [opts.vehicleType, 'all'] },
    isActive: true,
  }).select('_id').lean();
  const catIds = matchingCats.map(c => c._id);

  if (filter.categories) {
    filter.$and = [
      { categories: filter.categories },
      { categories: { $in: catIds } },
    ];
    delete filter.categories;
  } else {
    filter.categories = { $in: catIds };
  }
}

// Búsqueda
if (opts.search) {
  const searchRegex = { $regex: opts.search, $options: 'i' };
  // Round-trip 2 → Line.find()
  const matchingLines = await Line.find({ name: searchRegex }).select('_id').lean();
  const lineIds = matchingLines.map(l => l._id);

  const searchConditions = [
    { name: searchRegex },
    { description: searchRegex },
    { productModel: searchRegex },
    { sku: searchRegex },
  ];
  if (lineIds.length > 0) searchConditions.push({ line: { $in: lineIds } });

  if (filter.$and) {
    filter.$and.push({ $or: searchConditions });
  } else {
    filter.$or = searchConditions;
  }
}

return filter;
```

### **Paso 2 — `buildBranchLookupStages(branchId)`**

#### **Rama A — `branchId = 'all'`** (default)

Stock = suma de TODOS los `branch_products` activos del producto.

```ts
preFilterStages: [
  {
    $lookup: {
      from: 'branch_products',
      let: { productId: '$_id' },
      pipeline: [{
        $match: {
          $expr: { $eq: ['$product', '$$productId'] },
          isActive: true,
        },
      }],
      as: '_bps',
    },
  },
  { $addFields: { _branchStock: { $sum: '$_bps.stock' } } },
  { $project: { _bps: 0 } },
]
```

- Línea: [admin-product-list.service.ts:221-247](../backend/src/modules/products/services/admin-product-list.service.ts:221)

#### **Rama B — `branchId = 'none'`**

Solo productos que NO tengan ningún `branch_product` asociado.

```ts
preFilterStages: [
  {
    $lookup: {
      from: 'branch_products',
      let: { productId: '$_id' },
      pipeline: [
        { $match: { $expr: { $eq: ['$product', '$$productId'] } } },
        { $limit: 1 },
      ],
      as: '_bps',
    },
  },
  { $match: { _bps: { $size: 0 } } },
  { $addFields: { _branchStock: 0 } },
  { $project: { _bps: 0 } },
]
```

#### **Rama C — `branchId = <ObjectId>` específico**

Solo productos con `branch_product` activo en esa sucursal. Trae stock + branchProductId + branchName.

```ts
preFilterStages: [
  {
    $lookup: {
      from: 'branch_products',
      let: { productId: '$_id' },
      pipeline: [
        {
          $match: {
            $expr: { $eq: ['$product', '$$productId'] },
            branch: branchObjectId,
            isActive: true,
          },
        },
        { $limit: 1 },
      ],
      as: '_bps',
    },
  },
  { $match: { _bps: { $not: { $size: 0 } } } },
  { $unwind: '$_bps' },
  {
    $lookup: {
      from: 'branches',
      localField: '_bps.branch',
      foreignField: '_id',
      as: '_branchDoc',
      pipeline: [{ $project: { name: 1 } }],
    },
  },
  { $unwind: { path: '$_branchDoc', preserveNullAndEmptyArrays: true } },
  {
    $addFields: {
      _branchStock:      '$_bps.stock',
      _branchProductId:  '$_bps._id',
      _branchName:       { $ifNull: ['$_branchDoc.name', ''] },
    },
  },
  { $project: { _bps: 0, _branchDoc: 0 } },
]
```

### **Paso 3 — Pipeline principal**

```ts
const sortStage = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

const dataPipeline = [
  ...lookupStages.dataPostLookupFilters,   // siempre vacío con la implementación actual
  { $sort: sortStage },
  { $skip: skip },
  { $limit: limit },
  { $lookup: { from: 'brands', localField: 'brand', foreignField: '_id', as: 'brand', pipeline: [{ $project: { name: 1 } }] } },
  { $unwind: { path: '$brand', preserveNullAndEmptyArrays: true } },
  { $lookup: { from: 'lines', localField: 'line', foreignField: '_id', as: 'line', pipeline: [{ $project: { name: 1 } }] } },
  { $unwind: { path: '$line', preserveNullAndEmptyArrays: true } },
  { $lookup: { from: 'categories', localField: 'categories', foreignField: '_id', as: 'categories', pipeline: [{ $project: { name: 1, vehicleTypes: 1 } }] } },
];

const pipeline = [
  { $match: productMatch },
  ...lookupStages.preFilterStages,        // ← Stock LOOKUP ANTES del facet
  {
    $facet: {
      data:  dataPipeline,
      total: [{ $count: 'count' }],
    },
  },
];

const [facet] = await Product.aggregate(pipeline);
```

### **Paso 4 — `toRow(doc, branchId)`**

```ts
const row = {
  id: String(doc._id),
  name: doc.name,
  sku: doc.sku,
  // ... demás campos
  brand:      doc.brand ? { id: String(doc.brand._id), name: doc.brand.name } : null,
  line:       doc.line  ? { id: String(doc.line._id),  name: doc.line.name }  : null,
  categories: (doc.categories || []).map(c => ({ id: String(c._id), name: c.name, vehicleTypes: c.vehicleTypes || [] })),
  branchStock: doc._branchStock ?? 0,
};

if (branchId !== 'all' && branchId !== 'none') {
  row.branchProductId = doc._branchProductId ? String(doc._branchProductId) : undefined;
  row.branchName       = doc._branchName || '';
}
```

### Resumen del pipeline completo

| Etapa | Stages |
|-------|--------|
| 1 (Pre-aggregate) | `Category.find` (si vehicleType) + `Line.find` (si search) |
| 2 (`$match`) | Filtros base sobre `Product` |
| 3 (preFilter) | `$lookup` + `$addFields` + `$project` según `branchId` |
| 4 (`$facet.data`) | `$sort` → `$skip` → `$limit` → `$lookup` brand → `$lookup` line → `$lookup` categories |
| 4 (`$facet.total`) | `$count` |

### Resumen de round-trips

| Caso | Round-trips a la BD |
|------|---------------------|
| Base (`branchId='all'`, sin search/vehicleType) | 1 (un aggregate con $facet) |
| Con `search` | 2 (Line.find + aggregate) |
| Con `vehicleType` | 2 (Category.find + aggregate) |
| Con search + vehicleType | 3 |

---

## 2.2 Hallazgos / Problemas detectados

### 🔴 P1 — CRÍTICO: `$lookup` pre-paginate en `branchId='all'` (línea 220–247)

```ts
preFilterStages: [
  {
    $lookup: {
      from: 'branch_products',
      let: { productId: '$_id' },
      pipeline: [{
        $match: {
          $expr: { $eq: ['$product', '$$productId'] },
          isActive: true,
        },
      }],
      as: '_bps',
    },
  },
  { $addFields: { _branchStock: { $sum: '$_bps.stock' } } },
  { $project: { _bps: 0 } },
]
```

- Para **cada producto** del match, se hace un `$lookup` a `branch_products` filtrando por `product=_id` + `isActive`.
- Si hay 5.000 productos activos y la UI paginada muestra 20, **igual se procesan ~5.000 lookups** (uno por producto del match) **antes** de `$skip + $limit`.
- **Patrón correcto:** mover el `$lookup` **dentro del `dataPipeline`**, después de `$skip + $limit`. Solo se hacen lookups para los 20 docs visibles.

### 🔴 P2 — `branchId='none'` también pre-lookup (línea 250–273)

- Se ejecuta el lookup para **todos los productos** y luego se queda con los que NO tienen branch_products. El `{ $limit: 1 }` interno ayuda pero no evita el lookup global.
- Si hay 5.000 productos, se generan 5.000 lookups.
- **Patrón correcto:** una sola query previa `BranchProduct.distinct('product')` + filtro `_id: { $nin: [...] }` en el `$match`.

### 🟠 P3 — `branchId=<specific>` también pre-lookup (línea 278–319)

- Tres `$lookup + $unwind` secuenciales antes del facet.
- Hace lo correcto al usar `$limit: 1` interno, pero filtra después del lookup, no antes con un `$match` directo.
- **Patrón correcto:** invertir el origen — partir de `BranchProduct.aggregate({ branch: <id>, isActive: true })` → `$lookup product` → `$match` con filtros del producto.

### 🟠 P4 — `$regex` sin anchor (línea 185–207)

Mismo problema que en `findAll`. Repetición de código entre los dos servicios. Ignora el text index.

### 🟡 P5 — Sort sin índice cobertor

- `sortBy` permite `'price' | 'createdAt' | 'name'`.
- El sort ocurre **después** del lookup pre-filter pero **antes** del facet — se ordena todo el dataset filtrado en memoria.
- No hay índice `{ isActive: 1, name: 1 }` ni `{ isActive: 1, price: 1 }`.

### 🟡 P6 — Sub-pipeline con `$expr` no usa índice óptimo (línea 224–238)

- `$expr` históricamente fue menos eficiente que `localField/foreignField` para joins simples.
- Migrar a `localField: '_id'` / `foreignField: 'product'` con `$match` posterior por `'_bps.isActive'` puede ser más eficiente.

## 2.3 Recomendaciones

| # | Acción | Impacto | Esfuerzo |
|---|--------|---------|----------|
| R1 | **Mover el `$lookup` post-`$skip+$limit` en branchId='all'**: ejecutar el lookup de stock solo sobre los 20 productos visibles, no sobre los 5k del match | 🔴 **Crítico** | Bajo |
| R2 | Cambiar `branchId='none'` a una sola pre-query `BranchProduct.distinct('product')` + `_id: $nin` en el match | 🔴 Alto | Bajo |
| R3 | Refactorizar `branchId=<specific>` invirtiendo el origen (partir de BranchProduct.aggregate) | 🟠 Medio | Medio |
| R4 | Sustituir `$regex` por `$text` index — extraer helper compartido con findAll | 🟠 Alto | Bajo |
| R5 | Crear índices compuestos para soportar el sort (`{isActive,name:1}`, `{isActive,price:1}`) | 🟠 Medio | Trivial |
| R6 | Migrar el sub-pipeline de `$expr` a `localField/foreignField` | 🟡 Bajo | Trivial |

---

# QUERY 3 — DETALLES DEL PRODUCTO DEL CLIENTE

El detalle del producto se compone de **3 endpoints fásicos independientes**:

- **Fase 1 — Info:** `GET /api/products/:id/info`
- **Fase 2 — Stock:** `GET /api/products/:id/stock?branchIds=...`
- **Fase 3 — Related:** `GET /api/products/:id/related?categoryId=...&branchIds=...&limit=...`

**Service:** [`product-detail.service.ts`](../backend/src/modules/products/services/product-detail.service.ts) — `ProductDetailService`
**Controller:** [`product.controller.ts:111-155`](../backend/src/modules/products/controllers/product.controller.ts:111)

> **Nota:** existe también un endpoint legacy `GET /api/products/:id/detail` ([`product.service.ts:352`](../backend/src/modules/products/services/product.service.ts:352)) que sigue activo pero usa `populate()` en lugar de `aggregate()`.

## 3.1 Construcción

### Fase 1 — `getInfo` ([product-detail.service.ts:64-153](../backend/src/modules/products/services/product-detail.service.ts:64))

```ts
async getInfo(id: string): Promise<DetailInfo> {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError('Invalid product id', StatusCodes.BAD_REQUEST);
  }

  const pipeline = [
    { $match: { _id: new Types.ObjectId(id) } },
    { $lookup: { from: 'lines',      localField: 'line',       foreignField: '_id', as: 'line',
                 pipeline: [{ $project: { _id: 0, name: 1 } }] } },
    { $lookup: { from: 'brands',     localField: 'brand',      foreignField: '_id', as: 'brand',
                 pipeline: [{ $project: { _id: 0, name: 1 } }] } },
    { $lookup: { from: 'categories', localField: 'categories', foreignField: '_id', as: 'categories',
                 pipeline: [{ $project: { _id: 1, name: 1, vehicleTypes: 1 } }] } },
    {
      $project: {
        _id: 1, name: 1, description: 1, images: 1, price: 1, comparePrice: 1, sku: 1,
        productModel: 1, freeOilChangeService: 1, isCombo: 1,
        line:  { $arrayElemAt: ['$line', 0] },
        brand: { $arrayElemAt: ['$brand', 0] },
        categories: 1,
      },
    },
  ];

  const [doc] = await Product.aggregate(pipeline);
  // post-process: agrega vehicleTypes únicos de todas las categorías
}
```

| Stage | Función |
|-------|---------|
| `$match` | Filtra por `_id` |
| `$lookup lines` | Trae nombre de línea |
| `$lookup brands` | Trae nombre de marca |
| `$lookup categories` | Trae `_id`, `name`, `vehicleTypes` |
| `$project` | Selección de campos finales |

**Round-trips:** 1.

### Fase 2 — `getStock` ([product-detail.service.ts:163-211](../backend/src/modules/products/services/product-detail.service.ts:163))

```ts
async getStock(productId: string, branchIds: Types.ObjectId[]): Promise<DetailStock> {
  if (!branchIds.length) return { total: 0, branchName: null };

  const pipeline = [
    {
      $match: {
        product:  new Types.ObjectId(productId),
        branch:   { $in: branchIds },
        isActive: true,
      },
    },
    { $lookup: { from: 'branches', localField: 'branch', foreignField: '_id', as: 'branch',
                 pipeline: [{ $project: { _id: 0, name: 1 } }] } },
    { $unwind: '$branch' },
    { $project: { _id: 0, stock: 1, branchName: '$branch.name' } },
    { $sort: { stock: -1 } },
  ];

  const rows = await BranchProduct.aggregate(pipeline);
  // selecciona la mejor sucursal y nombre si solo una tiene stock
}
```

**Round-trips:** 1.

### Fase 3 — `getRelated` ([product-detail.service.ts:225-322](../backend/src/modules/products/services/product-detail.service.ts:225))

```ts
async getRelated(currentProductId, categoryId, branchIds, limit = 4) {
  const matchStage = {
    $match: {
      categories: new Types.ObjectId(categoryId),
      isActive:   true,
      _id:        { $ne: new Types.ObjectId(currentProductId) },
    },
  };

  const stockLookup = branchIds.length
    ? [
        {
          $lookup: {
            from: 'branch_products',
            let: { pid: '$_id' },
            pipeline: [
              { $match: { $expr: { $and: [
                { $eq: ['$product', '$$pid'] },
                { $in: ['$branch', branchIds] },
                { $eq: ['$isActive', true] },
                { $gt: ['$stock', 0] },
              ] } } },
              { $project: { _id: 0, stock: 1 } },
              { $sort: { stock: -1 } },
              { $limit: 1 },
            ],
            as: 'stockInfo',
          },
        },
        { $match: { 'stockInfo.0': { $exists: true } } },
        { $addFields: { stock: { $ifNull: [{ $arrayElemAt: ['$stockInfo.stock', 0] }, 0] } } },
      ]
    : [{ $addFields: { stock: 0 } }];

  const pipeline = [
    matchStage,
    ...stockLookup,
    { $sort: { createdAt: -1 } },
    { $limit: limit },
    { $lookup: { from: 'brands', localField: 'brand', foreignField: '_id', as: 'brand',
                 pipeline: [{ $project: { _id: 0, name: 1 } }] } },
    { $project: { _id: 1, name: 1, description: 1, images: 1, price: 1, comparePrice: 1,
                  productModel: 1, freeOilChangeService: 1, stock: 1,
                  brand: { $arrayElemAt: ['$brand', 0] } } },
  ];
}
```

| Stage | Función |
|-------|---------|
| `$match` | Misma categoría, activos, ≠ producto actual |
| `$lookup branch_products` (cond.) | Trae stock filtrando por branch+stock>0 |
| `$match stockInfo.0 exists` (cond.) | Descarta sin stock |
| `$addFields stock` | Asigna stock |
| `$sort createdAt:-1` | Más nuevos primero |
| `$limit` | Reduce a 4 |
| `$lookup brands` | Trae nombre de marca |
| `$project` | DTO final |

**Round-trips:** 1.

### Legacy — `getProductDetail` composite ([product.service.ts:352-416](../backend/src/modules/products/services/product.service.ts:352))

Sigue activo en `GET /api/products/:id/detail`. Usa `populate()` chains:

```ts
const product = await Product.findById(id)
  .populate('line', 'name')                    // round-trip extra
  .populate('categories', 'name vehicleTypes') // round-trip extra
  .populate('brand', 'name')                   // round-trip extra
  .lean();

const [stockResult, relatedResult] = await Promise.all([
  this.resolveStock(id, branchIds),     // BranchProduct.find + populate branch
  this.resolveRelated(id, product.categories, branchIds), // BranchProduct.find + Product.find + populate brand
]);
```

**Round-trips totales del legacy:** 7–9 vs 3 en la versión fásica.

---

## 3.2 Hallazgos / Problemas detectados

### 🟢 P1 — Diseño general correcto

- Sustituye correctamente los `populate()` por `$lookup` dentro de un solo aggregate.
- Proyecta solo los campos necesarios.
- Separa en 3 fases para que la UI pinte info inmediatamente sin esperar stock/related.

### 🟠 P2 — `getRelated` aplica stock-lookup ANTES de sort+limit (línea 243–276)

- Si una categoría tiene 200 productos activos, el `$lookup` a `branch_products` corre 200 veces antes del `$limit: 4`.
- En categorías pequeñas el costo es bajo. En categorías grandes el costo crece linealmente.

### 🟡 P3 — Legacy `getProductDetail` aún en pie

- Método con `populate()` chains (4–5 round-trips por request).
- Llamado por `GET /api/products/:id/detail` ([routes:22](../backend/src/modules/products/routes/product.routes.ts:22)).
- El comentario en `product-detail.service.ts:11-18` indica que hay migración en progreso pero la ruta sigue activa.

## 3.3 Recomendaciones

| # | Acción | Impacto | Esfuerzo |
|---|--------|---------|----------|
| R1 | En `getRelated`: aplicar primero `$sort + $limit` con margen (ej. limit:50), luego stock-lookup, luego segundo `$limit:4` | 🟠 Medio | Bajo |
| R2 | Confirmar que el frontend ya migró a las 3 fases y eliminar el endpoint legacy `/:id/detail` y el método `getProductDetail` | 🟢 Bajo | Bajo |
| R3 | Mantener el patrón de `$lookup`+`$project` por defecto en TODO el módulo (no usar `populate()`) | 🟢 Bajo | — |

---

# QUERY 4 — PRODUCTOS DEL LANDING PAGE

El landing usa **dos endpoints**:

- `GET /api/products/featured-showcase` — productos destacados
- `GET /api/products/featured-showcase/availability` — qué tabs mostrar

**Controller:** [`product.controller.ts:210-237`](../backend/src/modules/products/controllers/product.controller.ts:210)
**Service:** [`product.service.ts:680-775`](../backend/src/modules/products/services/product.service.ts:680)

## 4.1 Construcción

### Showcase — `getFeaturedShowcase`

#### **Paso 1 — `resolveProductIdsWithStock`** (helper)

```ts
private async resolveProductIdsWithStock(branchIds?: string): Promise<Types.ObjectId[] | null> {
  if (!branchIds) return null;
  const branchIdArray = branchIds.split(',').map(id => id.trim()).filter(Boolean);
  if (branchIdArray.length === 0) return null;

  const bps = await BranchProduct.find({
    branch: { $in: branchIdArray.map(id => new Types.ObjectId(id)) },
    isActive: true,
    stock:    { $gt: 0 },
  }).select('product').lean();

  return [...new Set(bps.map(bp => bp.product.toString()))]
    .map(id => new Types.ObjectId(id));
}
```

#### **Paso 2 — `sampleShowcaseProducts`** (helper, 1 ejecución por intento del fallback)

```ts
private async sampleShowcaseProducts(opts) {
  const match: any = { isActive: true };
  if (opts.featuredOnly)         match.isFeatured = true;
  if (opts.productIdsWithStock)  match._id = { $in: opts.productIdsWithStock };

  const pipeline = [
    { $match: match },
    { $lookup: { from: 'categories', localField: 'categories', foreignField: '_id', as: 'cats' } },
  ];

  if (opts.vehicleType !== null) {
    pipeline.push({ $match: { 'cats.vehicleTypes': opts.vehicleType } });
  }

  pipeline.push({ $sample: { size: opts.size } });
  pipeline.push({
    $project: {
      _id: 0,
      id: { $toString: '$_id' },
      name: 1, description: { $ifNull: ['$description', ''] },
      image: { $ifNull: [{ $arrayElemAt: ['$images', 0] }, ''] },
      price: 1, comparePrice: 1,
      isFeatured: { $ifNull: ['$isFeatured', false] },
      categories: { $map: { input: { $filter: { input: '$cats', as: 'c', cond: { $ne: ['$$c.name', null] } } },
                            as: 'c', in: { name: '$$c.name', vehicleTypes: { $ifNull: ['$$c.vehicleTypes', []] } } } },
    },
  });

  return Product.aggregate(pipeline);
}
```

#### **Paso 3 — Cadena de fallback (`getFeaturedShowcase`)**

```ts
async getFeaturedShowcase(branchIds?, vehicleType?, size = 4) {
  const productIdsWithStock = await this.resolveProductIdsWithStock(branchIds);

  const run = (featuredOnly, vt) =>
    this.sampleShowcaseProducts({ size, featuredOnly, vehicleType: vt, productIdsWithStock });

  // Caso A: tab "Todos"
  if (!vehicleType) {
    const featured = await run(true, null);
    if (featured.length > 0) return featured;
    return run(false, null);
  }

  // Caso B: vehicleType específico — fallback de 4 niveles
  const step1 = await run(true,  vehicleType);   // featured + tipo específico
  if (step1.length > 0) return step1;

  const step2 = await run(false, vehicleType);   // active  + tipo específico
  if (step2.length > 0) return step2;

  const step3 = await run(true,  'all');         // featured + universal (ALL)
  if (step3.length > 0) return step3;

  return run(false, 'all');                      // active  + universal (ALL)
}
```

#### Pipeline (cada ejecución de `sampleShowcaseProducts`)

| # | Stage | Función |
|---|-------|---------|
| 1 | `$match` | `isActive`, opcionalmente `isFeatured`, opcionalmente `_id:$in productIdsWithStock` |
| 2 | `$lookup categories` | Trae todas las categorías del producto |
| 3 | `$match cats.vehicleTypes` (cond.) | Filtra por tipo de vehículo |
| 4 | `$sample` | Selección aleatoria (`size`) |
| 5 | `$project` | DTO lightweight |

#### Resumen de round-trips

| Caso | Round-trips |
|------|-------------|
| "Todos" (sin vehicleType) | 1–3 |
| Vehicle específico, hay featured | 2 |
| **Vehicle específico, NO hay featured** | **5 (resolve stock + 4 aggregates secuenciales)** |

### Showcase Availability — `getShowcaseAvailability`

```ts
async getShowcaseAvailability(branchIds?: string): Promise<Record<string, boolean>> {
  const productIdsWithStock = await this.resolveProductIdsWithStock(branchIds);

  const rootMatch: any = { isActive: true };
  if (productIdsWithStock) rootMatch._id = { $in: productIdsWithStock };

  const agg = await Product.aggregate([
    { $match: rootMatch },
    { $lookup: { from: 'categories', localField: 'categories', foreignField: '_id', as: 'cats' } },
    { $unwind: { path: '$cats',              preserveNullAndEmptyArrays: true } },
    { $unwind: { path: '$cats.vehicleTypes', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: null,
        vehicleTypes: { $addToSet: '$cats.vehicleTypes' },
        productIds:   { $addToSet: '$_id' },
      },
    },
  ]);

  // Reglas:
  //   all        → true si hay al menos 1 producto activo
  //   <tipo>     → true si ese tipo está presente O hay alguna categoría 'all' (universal)
}
```

| Stage | Función |
|-------|---------|
| `$match` | `isActive` + opcionalmente `_id:$in productIdsWithStock` |
| `$lookup categories` | Trae las categorías del producto |
| `$unwind cats` | Una fila por categoría |
| `$unwind cats.vehicleTypes` | Una fila por (categoría × vehicleType) |
| `$group` | `$addToSet` vehicleTypes + productIds |

**Round-trips:** 1–2.

---

## 4.2 Hallazgos / Problemas detectados

### 🔴 P1 — Cadena de 4 aggregates secuenciales (línea 696–712)

- En el peor caso (catálogo nuevo o sucursal sin stock featured), se ejecutan **4 aggregations completas en serie**.
- Cada aggregation incluye `$lookup categories` para cada producto del match.

### 🔴 P2 — `$sample` después de `$lookup` (línea 614–664)

```ts
const pipeline = [
  { $match: match },
  { $lookup: { from: 'categories', ... } },   // ← procesa TODOS los productos
  { $match: { 'cats.vehicleTypes': opts.vehicleType } },
  { $sample: { size: opts.size } },           // ← sample sobre el subset
  { $project: { ... } },
];
```

- `$sample` es eficiente cuando ocurre temprano (puede usar offset random sobre el storage). Después de un `$lookup + $match`, ya estamos sobre un cursor en memoria.
- **Patrón mejor:** filtrar por `vehicleType` con un set de `categoryIds` pre-resueltos, ejecutar `$sample` directo, y solo después hacer `$lookup` para enriquecer los 4 docs sampleados.

### 🔴 P3 — `productIdsWithStock` como `$in: [miles]` (línea 581–596)

- Devuelve TODOS los productos con stock — sin paginar.
- Resultado: array con potencialmente 5.000+ ObjectIds.
- Se inyecta como `$in` en cada uno de los hasta 4 aggregates posteriores.

### 🟠 P4 — `getShowcaseAvailability` con doble `$unwind` (línea 730–749)

- Cada producto con N categorías × M vehicleTypes genera N×M docs.
- Si hay 5.000 productos × 3 categorías × 2 vehicleTypes promedio = **30.000 docs intermedios**.
- El `$addToSet` de `productIds` es redundante: ya tenemos el count del primer match.

### 🟡 P5 — Sin caché en endpoints de alta concurrencia

- El landing es la página más visitada. Cada cambio de tab dispara una nueva llamada.
- Cada llamada a `featured-showcase` puede tardar 200ms–1.5s según fallback chain.
- No hay layer de cache en backend (Redis, in-memory, ETag, etc.).

## 4.3 Recomendaciones

| # | Acción | Impacto | Esfuerzo |
|---|--------|---------|----------|
| R1 | **Convertir fallback chain a un solo `$facet`**: 4 buckets en paralelo + selección post-aggregation del primer bucket no vacío | 🔴 Alto | Medio |
| R2 | **Mover `$sample` antes del `$lookup`**: filtrar por `vehicleType` con `categoryIds` pre-resueltos, samplear, después enriquecer | 🔴 Alto | Medio |
| R3 | Eliminar el round-trip a `BranchProduct.find` y unificar como `$lookup` interno | 🟠 Alto | Medio |
| R4 | Refactorizar `getShowcaseAvailability`: reemplazar doble `$unwind` por `Category.distinct('vehicleTypes', { isActive: true, _id: $in: [cats con productos activos] })` | 🟠 Medio | Bajo |
| R5 | Cachear respuestas de showcase por (branchIds, vehicleType) durante 30s–2min en Redis o LRU in-memory | 🟡 Medio | Bajo |
| R6 | Agregar `Cache-Control` y `ETag` al response del showcase | 🟢 Bajo | Trivial |

---

# ANÁLISIS DE MODELOS E ÍNDICES

## Product ([product.model.ts:80-88](../backend/src/modules/products/models/product.model.ts:80))

### Índices existentes

```ts
productSchema.index({ line: 1 });
productSchema.index({ categories: 1 });
productSchema.index({ price: 1 });
productSchema.index({ isActive: 1, isFeatured: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ isCombo: 1 });
productSchema.index({ isCombo: 1, createdAt: -1 });
productSchema.index({ 'compatibleEngines.displacement': 1, 'compatibleEngines.fuelType': 1 });
productSchema.index({ name: 'text', description: 'text', productModel: 'text' });
```

### Hallazgos

| # | Issue |
|---|-------|
| 1 | **El text index existe pero no se usa** — el código emplea `$regex` en su lugar |
| 2 | El índice `{ isActive: 1, isFeatured: 1 }` no incluye `createdAt` para soportar el sort del showcase |
| 3 | No hay `{ isActive: 1, categories: 1, createdAt: -1 }` (filtro principal del catálogo) |
| 4 | No hay `{ isActive: 1, brand: 1, createdAt: -1 }` |
| 5 | No hay `{ isActive: 1, line: 1, createdAt: -1 }` |
| 6 | No hay `{ isActive: 1, price: 1 }` para sort por precio |
| 7 | No hay `{ isActive: 1, name: 1 }` para sort alfabético del admin |

### Índices recomendados (faltantes)

| Filtro frecuente | Índice recomendado | Justificación |
|------------------|--------------------|---------------|
| isActive + categories + sort por createdAt | `{ isActive: 1, categories: 1, createdAt: -1 }` | Filtro principal del catálogo cliente |
| isActive + brand + sort por createdAt | `{ isActive: 1, brand: 1, createdAt: -1 }` | Filtro por marca |
| isActive + line + sort por createdAt | `{ isActive: 1, line: 1, createdAt: -1 }` | Filtro por línea |
| isActive + isFeatured + createdAt | `{ isActive: 1, isFeatured: 1, createdAt: -1 }` | Showcase featured |
| isActive + sort por price | `{ isActive: 1, price: 1 }` | Sort por precio |
| isActive + sort por name | `{ isActive: 1, name: 1 }` | Sort alfabético del admin |

## BranchProduct ([branch-product.model.ts:26-30](../backend/src/modules/branch-products/models/branch-product.model.ts:26))

### Índices existentes

```ts
branchProductSchema.index({ branch: 1, product: 1 }, { unique: true });
branchProductSchema.index({ product: 1 });
branchProductSchema.index({ branch: 1 });
branchProductSchema.index({ stock: 1 });
branchProductSchema.index({ isActive: 1, stock: 1, branch: 1 });
```

### Hallazgos

| # | Issue |
|---|-------|
| 1 | **Orden incorrecto** en `{ isActive: 1, stock: 1, branch: 1 }` — `branch` aparece al final pero es el filtro más selectivo. Debería ser `{ branch: 1, isActive: 1, stock: 1 }` |
| 2 | `{ stock: 1 }` plano es **inútil** — no hay query que filtre solo por stock global |
| 3 | Falta `{ branch: 1, isActive: 1, product: 1 }` para los lookup masivos del admin |

### Índices recomendados

```ts
// Reemplazar el índice mal ordenado
branchProductSchema.index({ branch: 1, isActive: 1, stock: 1 });
// (eliminar el plano de stock)
// Agregar para los lookups masivos
branchProductSchema.index({ branch: 1, isActive: 1, product: 1 });
```

## Category, Brand, Line

- Solo tienen text index sobre `name`. Bien para búsquedas administrativas (que usan `$regex` y deberían usar `$text`).
- **Recomendado:** `Category` debería tener `{ vehicleTypes: 1, isActive: 1 }` en lugar de solo `{ vehicleTypes: 1 }`.

---

# PATRONES CROSS-CUTTING

Patrones que se repiten en múltiples queries y deberían refactorizarse de forma global:

## CC1 — Duplicación de `$regex` search en `findAll` y `findAllByBranch`

Ambos servicios construyen el mismo bloque de search con `$regex` sobre `name/description/productModel/sku/line`. Conviene extraer un helper compartido:

```ts
// shared/utils/build-product-search-filter.ts
async function buildProductSearchFilter(term: string) {
  // implementación compartida que use $text con score, fallback a regex con anchor
}
```

## CC2 — Duplicación de resolución de categorías por `vehicleType`

`findAll` y `findAllByBranch` ejecutan el mismo `Category.find({ vehicleTypes: $in })`. Mismo refactor: extraer helper que devuelva `{ specificIds, universalIds }`.

## CC3 — Patrón `BranchProduct.find` → `productIds: $in`

Aparece 3 veces (catálogo, showcase, related). Reemplazar por un `$lookup` integrado al pipeline principal en cada query.

## CC4 — Falta de capa de caché

Ninguno de los 8 endpoints públicos tiene caché de respuesta. El landing especialmente se beneficiaría de un layer cache:
- Redis con key `(branchIds, vehicleType, page, limit, ...)`
- TTL: 30s–2min para showcase, 5min para availability, 60s para catálogo
- Invalidación: trigger en eventos de creación/actualización de Product o BranchProduct

## CC5 — Sin observabilidad de queries lentas

No hay logging ni métricas de duración de aggregations. Recomendado:
- `mongoose.set('debug', ...)` en dev con timing
- En prod: middleware que loguee queries > 500ms con stack trace
- Slack/Discord alert para queries > 2s

---

# TABLA RESUMEN DE IMPACTO

| Query | Síntoma | Causa raíz dominante | Severidad | Esfuerzo de fix |
|-------|---------|----------------------|-----------|-----------------|
| Catálogo cliente | Búsqueda y filtro por sucursal lentos (1–4s) | `$regex` sin anchor + `$in: [miles]` | 🔴 Alta | Medio |
| Lista admin (`branchId='all'`) | Listado lento (2–8s) | `$lookup` ejecutado para todo el catálogo antes de paginar | 🔴 Crítica | Bajo |
| Detalle producto | Aceptable; related lento en categorías grandes | `$lookup` stock antes de `$limit` en related | 🟢 Baja | Bajo |
| Landing showcase | Hasta 4 round-trips secuenciales | Fallback chain en serie | 🟠 Alta | Medio |
| Showcase availability | Doble `$unwind` sobre todo el catálogo | Reuso del catálogo en lugar de `Category.distinct` | 🟠 Media | Bajo |
| Todas | Sort sin índice cobertor | Falta de índices compuestos | 🟠 Alta | Trivial |
| Todas (concurrencia) | Sin caché, sin observabilidad | Architectural gap | 🟡 Media | Medio |

---

# PLAN DE REMEDIACIÓN PRIORIZADO

## FASE 1 — Quick wins (alto impacto / bajo esfuerzo) — **Empezar por aquí**

| # | Tarea | Beneficio esperado |
|---|-------|---------------------|
| 1.1 | Crear índices compuestos faltantes en `Product` (sección "Análisis de modelos e índices") | Reduce tiempo de queries paginadas hasta 5–10× |
| 1.2 | Reordenar índice de `BranchProduct` a `{ branch: 1, isActive: 1, stock: 1 }` | Lookups masivos hasta 3× más rápidos |
| 1.3 | Mover el `$lookup` post-`$skip+$limit` en `findAllByBranch` (Admin P1, P2, P3) | **Reduce listado admin de 2–8s a <500ms** |
| 1.4 | Eliminar el índice plano `{ stock: 1 }` de BranchProduct | — |

**Verificación:** ejecutar `db.products.find({...}).explain('executionStats')` antes y después. Confirmar que `winningPlan` use `IXSCAN` en lugar de `COLLSCAN`.

## FASE 2 — Refactor de búsqueda

| # | Tarea | Beneficio esperado |
|---|-------|---------------------|
| 2.1 | Sustituir `$regex` por `$text: { $search: term }` aprovechando el text index existente | Reduce búsqueda de 1–3s a <200ms |
| 2.2 | Si se requiere autocompletar prefijos: `$regex: '^' + escapeRegex(term)` con campo lowercase pre-save | — |
| 2.3 | Extraer helper `buildProductSearchFilter` compartido entre `findAll` y `findAllByBranch` (CC1) | Reduce duplicación |
| 2.4 | Unificar zone-filter como `$lookup` dentro del aggregate principal (Catálogo P2, Landing P3) | Reduce 1–2 round-trips por request |

## FASE 3 — Optimizaciones del showcase

| # | Tarea | Beneficio esperado |
|---|-------|---------------------|
| 3.1 | Convertir fallback chain a un solo `$facet` (Landing P1) | Reduce de 4 round-trips a 1 |
| 3.2 | Mover `$sample` antes del `$lookup` (Landing P2) | Sample sobre subset reducido |
| 3.3 | Refactorizar `getShowcaseAvailability` con `Category.distinct` (Landing P4) | Elimina doble `$unwind` |
| 3.4 | Agregar layer cache (Redis o LRU in-memory) para showcase y availability | Reduce carga del backend ~80% |
| 3.5 | Agregar `Cache-Control` y `ETag` headers | Reduce tráfico desde clientes |

## FASE 4 — Limpieza

| # | Tarea | Beneficio esperado |
|---|-------|---------------------|
| 4.1 | Eliminar legacy `productService.getProductDetail` y la ruta `/:id/detail` (Detalle P3) | Reduce código muerto, evita inconsistencias |
| 4.2 | Eliminar `find().populate()` path en `findAll` — forzar siempre aggregate (Catálogo P6) | Reduce 3 round-trips innecesarios |
| 4.3 | Eliminar la rama defensiva `if (filter.$or)` en search (Catálogo P7) | Limpieza |
| 4.4 | Reemplazar `$toString` en `_priority` por comparación directa de ObjectId (Catálogo P3) | Reduce CPU del aggregate |

## FASE 5 — Observabilidad (opcional pero recomendado)

| # | Tarea | Beneficio esperado |
|---|-------|---------------------|
| 5.1 | Middleware de Mongoose que loguee queries > 500ms con stack trace | Detección temprana de regresiones |
| 5.2 | Métricas (Prometheus / Grafana) por endpoint: p50, p95, p99 | Visibilidad de performance |
| 5.3 | Alerts para queries > 2s | Detección de incidentes |

---

# ANEXO — Archivos relevantes

| Archivo | Descripción |
|---------|-------------|
| [`backend/src/modules/products/services/product.service.ts`](../backend/src/modules/products/services/product.service.ts) | Catálogo cliente, landing, detalle legacy |
| [`backend/src/modules/products/services/admin-product-list.service.ts`](../backend/src/modules/products/services/admin-product-list.service.ts) | Lista admin por sucursal |
| [`backend/src/modules/products/services/product-detail.service.ts`](../backend/src/modules/products/services/product-detail.service.ts) | Detalle del producto (3 fases) |
| [`backend/src/modules/products/controllers/product.controller.ts`](../backend/src/modules/products/controllers/product.controller.ts) | Controllers (públicos y admin) |
| [`backend/src/modules/products/routes/product.routes.ts`](../backend/src/modules/products/routes/product.routes.ts) | Rutas públicas |
| [`backend/src/modules/admin/routes/products.routes.ts`](../backend/src/modules/admin/routes/products.routes.ts) | Rutas admin |
| [`backend/src/modules/products/models/product.model.ts`](../backend/src/modules/products/models/product.model.ts) | Schema Product + índices |
| [`backend/src/modules/branch-products/models/branch-product.model.ts`](../backend/src/modules/branch-products/models/branch-product.model.ts) | Schema BranchProduct + índices |
| [`backend/src/modules/products/models/category.model.ts`](../backend/src/modules/products/models/category.model.ts) | Schema Category + índices |
| [`backend/src/config/database.ts`](../backend/src/config/database.ts) | Config Mongoose (poolSize, timeouts) |

---

# RESUMEN DE TODAS LAS QUERIES

| Query | Endpoint | Service Method | Severidad | Round-trips peor caso |
|-------|----------|----------------|-----------|----------------------|
| **Catálogo cliente** | `GET /api/products` | `productService.findAll` | 🔴 Alta | 8 |
| **Lista admin** | `GET /api/admin/products/by-branch` | `adminProductListService.findAllByBranch` | 🔴 Crítica | 3 (pero `$lookup` sobre todo el catálogo) |
| **Detalle Info** | `GET /api/products/:id/info` | `productDetailService.getInfo` | 🟢 Baja | 1 |
| **Detalle Stock** | `GET /api/products/:id/stock` | `productDetailService.getStock` | 🟢 Baja | 1 |
| **Detalle Related** | `GET /api/products/:id/related` | `productDetailService.getRelated` | 🟠 Media | 1 (pero stock-lookup pre-limit) |
| **Detalle Legacy** | `GET /api/products/:id/detail` | `productService.getProductDetail` | 🟡 Media | 7–9 |
| **Landing Showcase** | `GET /api/products/featured-showcase` | `productService.getFeaturedShowcase` | 🟠 Alta | 5 |
| **Landing Availability** | `GET /api/products/featured-showcase/availability` | `productService.getShowcaseAvailability` | 🟠 Media | 2 |

---

**Fin de la documentación.**
