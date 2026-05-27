# AUDITORÍA DE QUERIES DE PRODUCTOS — Backend

**Fecha:** 2026-05-08
**Modo:** Read-only / Deep-debug
**Alcance:** Catálogo cliente, Lista admin, Detalle cliente, Landing page

---

## ÍNDICE

1. [Diagnóstico ejecutivo](#1-diagnóstico-ejecutivo)
2. [Query 1 — Catálogo del cliente](#2-query-1--catálogo-del-cliente-productservicefindall)
3. [Query 2 — Lista de productos del admin](#3-query-2--lista-de-productos-del-admin-adminproductlistservicefindallbybranch)
4. [Query 3 — Detalles del producto](#4-query-3--detalles-del-producto-productdetailservice)
5. [Query 4 — Landing page (showcase)](#5-query-4--landing-page-getfeaturedshowcase--getshowcaseavailability)
6. [Análisis de modelos e índices](#6-análisis-de-modelos-e-índices)
7. [Tabla resumen de impacto](#7-tabla-resumen-de-impacto)
8. [Plan de remediación priorizado](#8-plan-de-remediación-priorizado)

---

## 1. DIAGNÓSTICO EJECUTIVO

**Causa raíz principal de la lentitud:** una combinación de cuatro patrones repetidos a lo largo de las 4 queries auditadas:

| # | Patrón | Severidad | Queries afectadas |
|---|--------|-----------|-------------------|
| A | `$regex` sin anchor (`^`) en `search` → COLLSCAN forzado, ignora `text index` ya creado | 🔴 Alta | Catálogo, Admin |
| B | `$lookup` ejecutado **antes** de `$skip/$limit` → escanea todo el catálogo aunque solo se devuelvan 10–20 docs | 🔴 Crítica | Admin (`branchId='all'`), Landing |
| C | Round-trips secuenciales para resolver IDs (categorías por `vehicleType`, `BranchProduct` para zone-filter), inyectados como `$in: [miles]` | 🟠 Alta | Catálogo, Landing |
| D | Falta de índices compuestos sobre los filtros más comunes (`isActive + categories`, `isActive + brand`, `branch + isActive + stock`) | 🟠 Alta | Todas |

**Confianza del diagnóstico:** Alta. Los problemas están en código, no en datos. Las soluciones son determinísticas y verificables con `explain()`.

**Hallazgo crítico:** la query `findAllByBranch` con `branchId='all'` (vista por defecto del admin) realiza un `$lookup` desde `branch_products` **para cada producto del catálogo**, antes de paginar. Si hay 5.000 productos × promedio de 3 sucursales con stock = ~15.000 docs procesados aunque la UI solo muestre 20.

---

## 2. QUERY 1 — CATÁLOGO DEL CLIENTE (`productService.findAll`)

**Archivo:** [`backend/src/modules/products/services/product.service.ts:26-346`](../backend/src/modules/products/services/product.service.ts)
**Endpoint:** `GET /api/products` (público)

### 2.1 Flujo completo

```
GET /api/products?branchIds=...&vehicleType=...&search=...&page=1&limit=10
       │
       ▼
[product.controller.ts:33] ProductController.getAll
       │ (cast de query params a ObjectId)
       ▼
[product.service.ts:26]   ProductService.findAll
       │
       ├── (A) Si branchIds: query #1 → BranchProduct.find({branch:$in, isActive, stock>0})
       │       → genera array productIds (puede ser 1k–10k)
       │       → filter._id = { $in: productIds }
       │
       ├── (B) Si vehicleType≠'all': query #2 → Category.find({vehicleTypes:$in})
       │       → resuelve specificCatIds + universalCatIds
       │       → filter.categories = { $in: [...] }
       │
       ├── (C) Si search: query #3 → Line.find({name:$regex})
       │       → searchConditions = $or [name, description, productModel, sku, line]
       │       → todos con $regex sin anchor
       │
       ├── (D) Si vehicleType o comboFirst: aggregate path
       │       → $match → $addFields(_priority,_comboPriority) → $sort → $facet{data, total}
       │       → data: $skip → $limit → 3×$lookup → $unwind → $project
       │   else: find path
       │       → Promise.all([find().populate×3.skip.limit.sort.lean, countDocuments])
       │
       └── (E) Si branchIds y products>0: query #4 (post) → BranchProduct.aggregate
               → match por product:$in, branch:$in
               → group por product, $first stock+branchId
               → $lookup branches
               → mergea bestBranchStock/Id/Name a cada product
```

### 2.2 Problemas detectados

#### 🔴 P1 — `$regex` sin anchor desactiva todos los índices (línea 132–163)

```ts
const searchRegex = { $regex: search, $options: 'i' };
// ...
{ name: searchRegex },          // ← Index { name: 'text' } NO se usa
{ description: searchRegex },   // ← idem
{ productModel: searchRegex },  // ← idem
{ sku: searchRegex },           // ← idem
```

- Existe el text index `{ name: 'text', description: 'text', productModel: 'text' }` (model línea 88) pero **nunca se usa** porque el código emplea `$regex`.
- Sin anchor `^`, MongoDB no puede usar el índice B-tree del campo. Se hace **collection scan completo**.
- Con `i` (case-insensitive) se descarta cualquier índice no-text incluso con anchor.
- En catálogos con 5k+ productos, una búsqueda de 3 letras puede tardar 800ms–3s.

**Solución:** usar `$text: { $search: term }` con el text index existente, o `$regex: '^' + escapeRegex(term)` sobre `name` para autocompletar prefijos.

#### 🔴 P2 — Round-trip secuencial para resolver IDs por sucursal (línea 55–66)

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
- El array `productIds` se inyecta como `$in: [10k ObjectIds]` en el query principal — esto degrada el plan de query (pierde índice si supera ~1.000 elementos).
- Doble conversión `.toString()` → `new ObjectId()` innecesaria; se puede deduplicar comparando `Buffer`.

**Solución:** sustituir por un `$lookup` desde `branch_products` dentro del pipeline principal (un solo round-trip), o precomputar una vista materializada `products_with_stock_by_branch` actualizada por trigger.

#### 🟠 P3 — Aggregation costoso por `_priority` con `$toString` (línea 195–215)

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

- `$toString` se ejecuta sobre **cada `categoryId` de cada documento**, antes del `$skip` y `$limit`.
- Con 5k productos × 3 categorías promedio = 15.000 conversiones por request, cada una con un `$filter` interno.
- Solución: comparar ObjectIds directamente con `$in: ['$$cid', specificCatIds]` (los ids ya son ObjectId).

#### 🟠 P4 — `$facet` evita short-circuit del paginado (línea 222–265)

- El `$facet` ejecuta `data` y `total` **en paralelo**, pero ambos parten del mismo dataset previo. La rama `total: [{ $count }]` no necesita los `$lookup`, sin embargo todo el `$match → $addFields → $sort` se materializa una vez.
- Más grave: el `$sort` se aplica **antes** del facet, lo que obliga a ordenar todo el dataset filtrado (podría ser 10k+) y luego paginar. Si no hay índice cubriendo `(filter, sortBy)`, MongoDB hace un `IXSCAN + SORT_KEY_GENERATOR` en memoria.

**Solución:** crear índice compuesto `{ isActive: 1, categories: 1, createdAt: -1 }` y `{ isActive: 1, brand: 1, createdAt: -1 }` para soportar las combinaciones más comunes.

#### 🟡 P5 — Tercera query post-resultado para `bestBranchStock` (línea 285–339)

- Se hace un **cuarto** round-trip a `BranchProduct.aggregate(...)` con `$lookup` a `branches` por cada página.
- Esto es razonable porque solo opera sobre los `limit` productos finales (10), pero podría integrarse al pipeline principal si ya estamos en aggregate path.

#### 🟡 P6 — Path de `find().populate()` ejecuta 4 round-trips (línea 271–282)

Cuando NO hay `vehicleType` ni `comboFirst`:

```ts
[products, total] = await Promise.all([
  Product.find(filter)
    .populate('line', ...)         // ← round-trip extra
    .populate('categories', ...)   // ← round-trip extra
    .populate('brand', ...)        // ← round-trip extra
    .skip().limit().sort().lean(),
  Product.countDocuments(filter),
]);
```

- Mongoose ejecuta una query **por cada `populate`** (3 colecciones × 1 query c/u = 3 round-trips después del find).
- Con `Promise.all` no se paralelizan los `populate` entre sí (corren secuenciales por diseño de Mongoose).
- El path de `aggregate` (con `$lookup`) que ya existe es 4× más rápido. Conviene unificar siempre por aggregate.

#### 🟡 P7 — `$or` con búsqueda + zone collision (línea 154–162)

El comentario dice *"Si ya hay $or (por zona), usar $and para combinar"* pero el filtro de zona usa `_id: $in`, no `$or`. La rama `if (filter.$or)` **nunca se ejecuta** salvo en futuros cambios. Es código defensivo muerto.

### 2.3 Veredicto Catálogo

**Severidad global: 🔴 Alta.**
Los puntos P1, P2 y P4 son las causas dominantes del tiempo de respuesta. Una búsqueda + filtro por sucursal puede tardar 1–4s con 5k productos. Sin estos filtros, ~200–400ms.

---

## 3. QUERY 2 — LISTA DE PRODUCTOS DEL ADMIN (`adminProductListService.findAllByBranch`)

**Archivo:** [`backend/src/modules/products/services/admin-product-list.service.ts:60-148`](../backend/src/modules/products/services/admin-product-list.service.ts)
**Endpoint:** `GET /api/admin/products/by-branch`

### 3.1 Flujo completo

```
GET /api/admin/products/by-branch?branchId=all|none|<id>&page=1&limit=20&search=...
       │
       ▼
[product.controller.ts:286] ProductController.getAllByBranch
       │
       ▼
[admin-product-list.service.ts:61] AdminProductListService.findAllByBranch
       │
       ├── buildProductMatch():
       │     ├── (si vehicleType≠all) query → Category.find({vehicleTypes:$in})
       │     └── (si search)            query → Line.find({name:$regex})
       │
       ├── buildBranchLookupStages(branchId):
       │     ├── 'all'      → $lookup branch_products + $sum stock + $project _bps:0
       │     ├── 'none'     → $lookup branch_products + $match _bps size 0
       │     └── '<id>'     → $lookup specific + $match + $unwind + $lookup branches
       │
       └── pipeline:
             $match(productMatch)
             → preFilterStages   ← LOOKUPS pesados ANTES del facet
             → $facet
                 ├─ data: $sort $skip $limit + 3×$lookup + $unwind  (brands, lines, categories)
                 └─ total: $count
```

### 3.2 Problemas detectados

#### 🔴 P1 — CRÍTICO: `$lookup` pre-paginate en `branchId='all'` (línea 220–247)

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
],
```

- Para **cada producto** del match, se hace un `$lookup` a `branch_products` filtrando por `product=_id` + `isActive`.
- El `$expr` con `$eq` no aprovecha el índice compuesto `{ branch: 1, product: 1 }` directamente; usa el índice secundario `{ product: 1 }` que sí existe — pero igualmente **esto se ejecuta para todos los productos del match**, no solo para los de la página actual.
- Si hay 5.000 productos activos y la UI paginada muestra 20, igual se procesan ~5.000 lookups (uno por producto del match) antes de `$skip + $limit`.

**Patrón correcto:** mover el `$lookup` **dentro del `dataPipeline`**, después de `$skip + $limit`. Solo se hacen lookups para los 20 docs visibles. El `total` no necesita el lookup porque suma sobre el match original.

#### 🔴 P2 — `branchId='none'` también pre-lookup (línea 250–273)

```ts
preFilterStages: [
  { $lookup: { from: 'branch_products', let: { productId: '$_id' }, pipeline: [...], as: '_bps' } },
  { $match: { _bps: { $size: 0 } } },
  ...
]
```

- Se ejecuta el lookup para **todos los productos** y luego se queda con los que NO tienen branch_products. El `{ $limit: 1 }` dentro del subpipeline ayuda pero no evita el lookup global.
- Si hay 5.000 productos, se generan 5.000 lookups donde el subpipeline en cada uno hace un find con `$expr`.

**Patrón correcto:** una sola query previa `BranchProduct.distinct('product')` y filtro `_id: { $nin: [...] }` en el `$match`. Resultado: 1 round-trip + 1 aggregate ligero.

#### 🟠 P3 — `branchId=<specific>` también pre-lookup (línea 278–319)

- Tres `$lookup + $unwind` secuenciales antes del facet (`branch_products`, luego `branches`).
- Hace lo correcto al usar `$limit: 1` dentro, pero igual se filtra después del lookup, no antes con un `$match` directo.

**Patrón correcto:** filtrar productos a través de `branch_products` con `$in: branch=<id>` PRIMERO en una colección virtual, y luego unir contra products. Equivalente: invertir el origen — partir de `BranchProduct` → `$lookup product` → `$match`.

#### 🟠 P4 — `$regex` sin anchor (línea 185–207)

Mismo problema que en `findAll`. Repetición de código entre los dos servicios.

#### 🟡 P5 — Sort sin índice cobertor

- `sortBy` permite `'price' | 'createdAt' | 'name'` con `sortOrder asc/desc`.
- El sort ocurre **después** del lookup pre-filter pero **antes** del facet — se ordena todo el dataset filtrado en memoria.
- No hay índice `{ isActive: 1, name: 1 }` ni `{ isActive: 1, price: 1 }`. Solo existe `{ price: 1 }` plano (model línea 82) que MongoDB difícilmente combinará con `isActive` filter.

#### 🟡 P6 — Sub-pipeline con `$expr` no usa índice óptimo (línea 224–238)

```ts
$lookup: {
  from: 'branch_products',
  let: { productId: '$_id' },
  pipeline: [{ $match: { $expr: { $eq: ['$product', '$$productId'] }, isActive: true } }],
  as: '_bps',
}
```

- MongoDB ≥5.0 puede traducir esto a IXSCAN sobre `{ product: 1 }`, pero `$expr` históricamente fue menos eficiente que `localField/foreignField`.
- Mejor:

```ts
$lookup: {
  from: 'branch_products',
  localField: '_id',
  foreignField: 'product',
  as: '_bps',
}
// luego $match: { '_bps.isActive': true }
```

…y mover este lookup a **después** del paginado.

### 3.3 Veredicto Admin

**Severidad global: 🔴 Crítica.**
La vista por defecto (`branchId='all'`) escala con el catálogo completo, no con la página visible. Con 5k productos el tiempo de respuesta crece linealmente. Es **el query más lento del sistema** según el flujo analizado.

---

## 4. QUERY 3 — DETALLES DEL PRODUCTO (`productDetailService`)

**Archivo:** [`backend/src/modules/products/services/product-detail.service.ts`](../backend/src/modules/products/services/product-detail.service.ts)
**Endpoints:** `GET /api/products/:id/info` · `/:id/stock` · `/:id/related`

### 4.1 Flujo

Tres endpoints independientes, cada uno con un `aggregate()` de un solo round-trip. La UI los dispara en paralelo desde el frontend.

| Fase | Pipeline | Round-trips |
|------|----------|-------------|
| 1 — Info | `$match _id` → 3×`$lookup` (line, brand, categories) → `$project` | 1 |
| 2 — Stock | `$match product+branch+isActive` → `$lookup branches` → `$unwind` → `$sort stock:-1` | 1 |
| 3 — Related | `$match category+!self+isActive` → `$lookup branch_products` → `$lookup brands` → `$sort` → `$limit` | 1 |

### 4.2 Problemas detectados

#### 🟢 P1 — Diseño general correcto

- Sustituye correctamente los `populate()` por `$lookup` dentro de un solo aggregate.
- Proyecta solo los campos necesarios.
- Separa en 3 fases para que la UI pinte info inmediatamente sin esperar stock/related.

#### 🟠 P2 — `getRelated` aplica stock-lookup ANTES de sort+limit (línea 243–276)

```ts
const stockLookup: PipelineStage[] = branchIds.length
  ? [
      { $lookup: { from: 'branch_products', let: { pid: '$_id' }, pipeline: [...], as: 'stockInfo' } },
      { $match: { 'stockInfo.0': { $exists: true } } },
      { $addFields: { stock: { $ifNull: [{ $arrayElemAt: ['$stockInfo.stock', 0] }, 0] } } },
    ]
  : [{ $addFields: { stock: 0 } }];

const pipeline = [
  matchStage,
  ...stockLookup,         // ← lookup para todos los productos de la categoría
  { $sort: { createdAt: -1 } },
  { $limit: limit },      // ← solo aquí se reducen a 4
  { $lookup: { from: 'brands', ... } },
  { $project: ... },
];
```

- Si una categoría tiene 200 productos activos, el `$lookup` a `branch_products` corre 200 veces antes del limit.
- **Mitigación**: el match ya excluye con `_id: $ne` y restringe por `categories`, así que en categorías pequeñas el costo es bajo.
- **Para categorías grandes**: aplicar primero `$sort + $limit` con un margen (ej. `$limit: 50`), luego stock-lookup, luego un segundo `$limit: 4`. Trade-off: si los 50 más nuevos no tienen stock, devuelves <4. Acepable según UX.

Solución más estricta: usar el patrón "intersect-via-branchProducts" — partir de `BranchProduct` con `branch:$in, stock>0`, agrupar por product, luego `$lookup` a products con la categoría correcta.

#### 🟡 P3 — Legacy `getProductDetail` aún en pie (línea 352–416 de `product.service.ts`)

- El método legacy sigue ahí con `populate()` chains (4–5 round-trips por request).
- Llamado por `GET /api/products/:id/detail` (línea 22 del routes).
- El comentario en `product-detail.service.ts:11-18` indica que hay migración en progreso. **Confirmar que el frontend ya migró** y eliminar esta ruta.

### 4.3 Veredicto Detalle

**Severidad global: 🟢 Baja.**
Es el endpoint mejor diseñado. Solo el `getRelated` con stock filter tiene un costo creciente con el tamaño de categoría. Eliminar el legacy es un nice-to-have, no urgente.

---

## 5. QUERY 4 — LANDING PAGE (`getFeaturedShowcase` + `getShowcaseAvailability`)

**Archivo:** [`backend/src/modules/products/services/product.service.ts:680-775`](../backend/src/modules/products/services/product.service.ts)
**Endpoints:**
- `GET /api/products/featured-showcase`
- `GET /api/products/featured-showcase/availability`

### 5.1 Flujo

```
getFeaturedShowcase(branchIds, vehicleType, size=4)
    │
    ├── resolveProductIdsWithStock(branchIds)
    │     └── BranchProduct.find({branch:$in, isActive, stock>0}).select('product').lean()
    │         → array de ObjectIds (potencialmente miles)
    │
    └── 4-step fallback chain (cada paso = 1 aggregate):
        Paso 1 — featured + vehicleType específico
            │  $match(isActive,featured,_id:$in) → $lookup categories → $match cats.vehicleTypes → $sample → $project
            ├── si len>0 return
        Paso 2 — active + vehicleType específico
        Paso 3 — featured + ALL universal
        Paso 4 — active + ALL universal
```

### 5.2 Problemas detectados

#### 🔴 P1 — Cadena de 4 aggregates secuenciales (línea 696–712)

- En el peor caso (catálogo nuevo o sucursal sin stock featured), se ejecutan **4 aggregations completas en serie**.
- Cada aggregation incluye `$lookup categories` para cada producto del match.
- Solución: una sola aggregation con `$facet` que evalúe los 4 buckets en paralelo + un `$project` que escoja el primer bucket no vacío.

```ts
// Patrón sugerido (1 round-trip vs 4):
Product.aggregate([
  { $match: rootMatch },
  { $lookup: { from: 'categories', ... } },
  { $facet: {
      featuredSpecific: [...],
      activeSpecific:   [...],
      featuredAll:      [...],
      activeAll:        [...],
  } },
  // post-process en JS para elegir el primer bucket no vacío
])
```

#### 🔴 P2 — `$sample` después de `$lookup` (línea 614–664)

```ts
const pipeline = [
  { $match: match },
  { $lookup: { from: 'categories', ... } },   // ← procesa TODOS los productos
  { $match: { 'cats.vehicleTypes': opts.vehicleType } },
  { $sample: { size: opts.size } },           // ← sample sobre el subset
  { $project: { ... } },
];
```

- `$sample` es eficiente cuando ocurre temprano (puede usar `_id` random offset). Después de un `$lookup + $match`, ya estamos sobre un cursor en memoria — el sample no aprovecha optimizaciones del storage engine.
- **Mejor:** mover el filtrado por `vehicleType` a un `$match` en el match inicial usando un set de `categoryIds` pre-resueltos, eliminar el `$lookup`, ejecutar `$sample` directo. Solo después de samplear se hace el `$lookup` a categorías para enriquecer la respuesta. Pasa de "sample sobre subset" a "sample sobre subset → lookup sobre 4 docs".

#### 🔴 P3 — `productIdsWithStock` como `$in: [miles]` (línea 581–596)

```ts
const bps = await BranchProduct.find({
  branch: { $in: branchIdArray.map(id => new Types.ObjectId(id)) },
  isActive: true,
  stock: { $gt: 0 },
}).select('product').lean();

return [...new Set(bps.map(bp => bp.product.toString()))]
  .map(id => new Types.ObjectId(id));
```

- Devuelve TODOS los productos con stock — sin paginar.
- Resultado: `productIdsWithStock` con potencialmente 5.000+ ObjectIds.
- Se inyecta como `$in` en cada uno de los hasta 4 aggregates posteriores. Cada `$in` con 5k+ items es un cost trade-off significativo.

#### 🟠 P4 — `getShowcaseAvailability` con doble `$unwind` (línea 730–749)

```ts
const agg = await Product.aggregate([
  { $match: rootMatch },
  { $lookup: { from: 'categories', ... } },
  { $unwind: { path: '$cats', preserveNullAndEmptyArrays: true } },
  { $unwind: { path: '$cats.vehicleTypes', preserveNullAndEmptyArrays: true } },
  { $group: { _id: null, vehicleTypes: { $addToSet: '$cats.vehicleTypes' }, productIds: { $addToSet: '$_id' } } },
]);
```

- Cada producto con N categorías × M vehicleTypes genera N×M docs.
- Si hay 5.000 productos × 3 categorías × 2 vehicleTypes promedio = 30.000 docs intermedios.
- El `$addToSet` de `productIds` es redundante: ya tenemos el count del primer match. Devolver `productIds: { $sum: 1 }` reduce memoria.

**Solución más eficiente:** usar `Category.distinct('vehicleTypes', { isActive: true })` filtrando solo categorías referenciadas → 1 query a `categories`, no a `products`. Combinado con un `Product.countDocuments(rootMatch)` para el `'all'` flag.

#### 🟡 P5 — El Landing dispara 2 endpoints en cada cambio de tab

- `getShowcaseAvailability` se llama una vez en mount.
- `getFeaturedShowcase` se llama por cada tab (vehicleType) que el usuario abre.
- Cada llamada a `featured-showcase` puede tardar 200ms–1.5s según fallback chain.
- **Mejora UX-side:** cachear las respuestas de showcase por (branchIds, vehicleType) durante 30s–2min.

### 5.3 Veredicto Landing

**Severidad global: 🟠 Alta.**
La cadena de fallback es la causa principal. Un solo `$facet` reduce de 4 round-trips a 1. El `getShowcaseAvailability` también es más caro de lo necesario por los doble unwind sobre todo el catálogo.

---

## 6. ANÁLISIS DE MODELOS E ÍNDICES

### 6.1 Product (`product.model.ts:80-88`)

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

**Faltan los siguientes índices compuestos** (los queries reales del catálogo siempre incluyen `isActive`):

| Filtro frecuente | Índice recomendado | Justificación |
|------------------|--------------------|---------------|
| isActive + categories + sort por createdAt | `{ isActive: 1, categories: 1, createdAt: -1 }` | Filtro principal del catálogo cliente |
| isActive + brand + sort por createdAt | `{ isActive: 1, brand: 1, createdAt: -1 }` | Filtro por marca |
| isActive + line + sort por createdAt | `{ isActive: 1, line: 1, createdAt: -1 }` | Filtro por línea |
| isActive + isFeatured + createdAt | `{ isActive: 1, isFeatured: 1, createdAt: -1 }` | Showcase featured (orden) |
| isActive + sort por price | `{ isActive: 1, price: 1 }` | Sort por precio del catálogo |
| isActive + sort por name | `{ isActive: 1, name: 1 }` | Sort alfabético del admin |

**El text index existe pero no se usa** — el código emplea `$regex` en su lugar (P1 de Catálogo y Admin).

### 6.2 BranchProduct (`branch-product.model.ts:26-30`)

```ts
branchProductSchema.index({ branch: 1, product: 1 }, { unique: true });
branchProductSchema.index({ product: 1 });
branchProductSchema.index({ branch: 1 });
branchProductSchema.index({ stock: 1 });
branchProductSchema.index({ isActive: 1, stock: 1, branch: 1 });
```

**Problemas:**

| # | Issue |
|---|-------|
| 1 | El índice `{ isActive: 1, stock: 1, branch: 1 }` está mal ordenado para el query más común — `branch` aparece al final pero es el filtro más selectivo. Debería ser `{ branch: 1, isActive: 1, stock: 1 }`. |
| 2 | `{ stock: 1 }` plano es inútil — no hay query que filtre solo por stock global. |
| 3 | Falta `{ branch: 1, isActive: 1, product: 1 }` para el lookup masivo del admin (queries en findAll y findAllByBranch). |

### 6.3 Category, Brand, Line

- Solo tienen text index sobre `name`. Bien para búsquedas de admin (que usan `$regex` y deberían usar `$text`).
- `Category` tiene `{ vehicleTypes: 1 }` — correcto. `{ vehicleTypes: 1, isActive: 1 }` sería mejor.

---

## 7. TABLA RESUMEN DE IMPACTO

| Query | Síntoma | Causa raíz dominante | Severidad | Costo estimado de fix |
|-------|---------|----------------------|-----------|----------------------|
| Catálogo cliente | Búsqueda y filtro por sucursal lentos (1–4s) | `$regex` sin anchor + `$in: [miles]` por zone filter | 🔴 Alta | Medio (refactor search + lookup unificado) |
| Lista admin (`branchId='all'`) | Listado con stock total lento (2–8s) | `$lookup` ejecutado para todo el catálogo antes de paginar | 🔴 Crítica | Bajo (mover lookup post-`$skip+$limit`) |
| Detalle producto | Aceptable; related lento en categorías grandes | `$lookup` stock antes de `$limit` en related | 🟢 Baja | Bajo (limitar antes de stock-lookup) |
| Landing showcase | Hasta 4 round-trips secuenciales | Fallback chain en serie | 🟠 Alta | Medio (refactor a `$facet` único) |
| Showcase availability | Doble `$unwind` sobre todo el catálogo | Reuso del catálogo en lugar de `Category.distinct` | 🟠 Media | Bajo (1 query a categories) |
| Todas | Sort sin índice cubertor | Falta de índices compuestos | 🟠 Alta | Trivial (crear índices) |

---

## 8. PLAN DE REMEDIACIÓN PRIORIZADO

### FASE 1 — Quick wins (impacto alto / esfuerzo bajo)

1. **Crear índices compuestos faltantes** (sección 6.1).
   - Migración con `Product.collection.createIndex(...)` o agregar al schema.
   - Verificar con `db.products.find({...}).explain('executionStats')` que el `winningPlan` use `IXSCAN`.

2. **Corregir el orden del índice de BranchProduct** (sección 6.2).
   - `{ branch: 1, isActive: 1, stock: 1 }` reemplaza `{ isActive: 1, stock: 1, branch: 1 }`.

3. **Mover el `$lookup` post-`$skip+$limit` en `findAllByBranch`** (Admin P1, P2, P3).
   - Para `branchId='all'`: el `$lookup branch_products` va dentro de `dataPipeline` después de `$limit`.
   - Para el `total`: una segunda subquery más simple, o aceptar que el total considere el match base sin contextualizar stock (el stock 0 es válido para "todos los productos").

### FASE 2 — Refactor de búsqueda

4. **Usar text index en lugar de `$regex`** (Catálogo P1, Admin P4).
   - Cambiar a `$text: { $search: term }` para búsquedas multi-campo.
   - Si se requiere autocompletar prefijos: usar `$regex: '^' + escapeRegex(term)` SIN `$options: 'i'` (forzar lowercase del campo en pre-save) o crear índice colation case-insensitive.

5. **Unificar zone filter como `$lookup` dentro del aggregate principal** (Catálogo P2, Landing P3).
   - Eliminar el round-trip a `BranchProduct.find()`.
   - Agregar al pipeline: `$lookup branch_products` con `$match` por `branch:$in, isActive, stock>0` y `$match: { 'bps.0': { $exists: true } }`.

### FASE 3 — Optimizaciones del showcase

6. **Convertir fallback chain a un solo `$facet`** (Landing P1).
   - 1 round-trip vs 4.
   - Lógica de selección de bucket en JS post-aggregation.

7. **Refactorizar `getShowcaseAvailability`** (Landing P4).
   - Reemplazar el doble `$unwind` por `Category.distinct('vehicleTypes', { isActive: true, _id: { $in: <cats con productos activos> } })`.

### FASE 4 — Limpieza

8. **Eliminar legacy `productService.getProductDetail` y la ruta `/:id/detail`** (Detalle P3).
   - Confirmar primero que el frontend usa los 3 endpoints fásicos.

9. **Eliminar `find().populate()` path en `findAll`** (Catálogo P6).
   - Forzar siempre el path de aggregate. Reduce 3 round-trips innecesarios.

10. **Eliminar la rama defensiva `if (filter.$or)` en search** (Catálogo P7).
    - Código muerto.

---

## ANEXO — Tabla de archivos relevantes

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

**Fin del informe.**
