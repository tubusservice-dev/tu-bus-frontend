# Client Phase 4 — Catalog + Product Card + Product Detail

> **Status:** Pending
> **Depends on:** Phase 2 (LocationService)
> **Blocks:** None (independent of Phase 5-7)
> **Estimated files:** 3
> **Verification:** `cd frontend && npx ng build` → 0 errors

---

## 1. Catalog Component

### File: `frontend/src/app/features/catalog/catalog.component.ts`

### 1.1 Changes

**Add dependency:**
```typescript
private readonly locationService = inject(LocationService);
```

**Modify `loadProducts()`:**
- Add `branchIds` from LocationService to ProductService query
- If `!locationService.hasLocation()` → redirect to landing or open zoning modal

```typescript
// In loadProducts() or wherever products are fetched:
const params: ProductQueryParams = {
  page: this.currentPage(),
  limit: this.pageSize(),
  isActive: true,
  // ... existing filters (brand, category, search, sort, vehicle)
};

// Zone filter: only products available in user's zone branches
const branchIds = this.locationService.branchIds();
if (branchIds.length > 0) {
  params.branchIds = branchIds.join(',');
}

this.productService.getAll(params).subscribe(/* ... */);
```

**Guard on init:**
```typescript
ngOnInit(): void {
  if (!this.locationService.hasLocation()) {
    this.router.navigate(['/']);
    return;
  }
  // ... existing init logic
}
```

**Remove TODOs:**
- Remove all `// TODO: Zone-based filtering disabled` comments
- Remove any unused `branchIds` signal that was previously empty

### 1.2 Reactive Refresh
When user changes location (Phase 3), catalog should refresh:
```typescript
// Option A: Effect that re-loads on branchIds change
effect(() => {
  const ids = this.locationService.branchIds();
  // Only reload if already initialized
  if (this.initialized) {
    this.loadProducts();
  }
});
```

---

## 2. Product Card Component

### File: `frontend/src/app/shared/components/product-card/product-card.component.ts`

### 2.1 Current State
- Has `@Input() product` with product data
- Add to cart calls `cartService.addItem()` with `stock: product.stock`
- But `product.stock` was REMOVED from the Product model (now in BranchProduct)

### 2.2 Changes

**Add stock input:**
```typescript
@Input() stock: number = 0;
```

**Update cart add logic:**
```typescript
// Replace hardcoded/missing stock with input:
addToCart(): void {
  if (!this.cartService.isUserAuthenticated()) {
    this.authService.openAuthModal();
    return;
  }

  const result = this.cartService.addItem({
    id: this.product.id,
    name: this.product.name,
    price: this.product.price,
    image: this.product.images?.[0] || '',
    stock: this.stock,
    freeOilChangeService: this.product.freeOilChangeService,
  });

  // Handle result...
}
```

**Add stock-related computeds:**
```typescript
readonly isOutOfStock = computed(() => this.stock <= 0);
readonly quantityInCart = computed(() =>
  this.cartService.getItemQuantity(this.product?.id || '')
);
readonly canAddToCart = computed(() => {
  if (!this.product) return false;
  return this.quantityInCart() < this.stock;
});
```

**Update template:**
- Show "Agotado" badge if `isOutOfStock()`
- Disable add button if `!canAddToCart()`

### 2.3 Parent Responsibility
The catalog component must provide stock to each card. Two approaches:

**Approach A (Batch — preferred):**
After loading products, fetch stock for all in one call per product.
Problem: N+1 queries if many products.

**Approach B (Inline — simpler):**
Products endpoint returns stock data. The backend `findAll()` with `branchIds` already filters to products WITH stock. We add a `stock` virtual/aggregation to the product response.

**Recommendation: Approach B** — add `stock` to product response when `branchIds` is provided:
- Backend: in `findAll()`, after getting products, batch-query BranchProduct for stock
- Return products with `totalStock` field attached
- Frontend: product response includes `totalStock`, pass to card

This requires a small addition to Phase 1 backend:
```typescript
// In product.service.ts findAll(), after products query:
if (branchIds && products.length > 0) {
  const productIds = products.map(p => p._id);
  const stocks = await BranchProduct.aggregate([
    { $match: { product: { $in: productIds }, branch: { $in: branchIdArray }, isActive: true } },
    { $group: { _id: '$product', totalStock: { $sum: '$stock' } } },
  ]);
  const stockMap = new Map(stocks.map(s => [s._id.toString(), s.totalStock]));
  products.forEach(p => { (p as any).totalStock = stockMap.get(p._id.toString()) || 0; });
}
```

---

## 3. Product Detail Component

### File: `frontend/src/app/features/product-detail/product-detail.component.ts`

### 3.1 Current State
- Stock hardcoded to 999
- No real stock query

### 3.2 Changes

**Add dependencies:**
```typescript
private readonly locationService = inject(LocationService);
private readonly branchProductService = inject(BranchProductService);
```

**Add stock signals:**
```typescript
protected readonly productStock = signal(0);
protected readonly stockByBranch = signal<{ branchId: string; branchName: string; stock: number }[]>([]);
protected readonly isLoadingStock = signal(false);
```

**Load stock on product load:**
```typescript
private loadStock(productId: string): void {
  const branchIds = this.locationService.branchIds();
  if (branchIds.length === 0) {
    this.productStock.set(0);
    return;
  }

  this.isLoadingStock.set(true);
  this.branchProductService.getAggregatedStock(productId, branchIds).subscribe({
    next: (res) => {
      this.productStock.set(res.data.totalStock);
      this.stockByBranch.set(res.data.byBranch);
      this.isLoadingStock.set(false);
    },
    error: () => {
      this.productStock.set(0);
      this.isLoadingStock.set(false);
    },
  });
}
```

**Replace stock=999:**
- Every place that references `stock: 999` or similar → use `this.productStock()`
- Quantity selector max = `productStock()`
- "Agotado" badge if `productStock() === 0`
- Disable add to cart if out of stock

**Update addToCart:**
```typescript
addToCart(): void {
  // ... auth check
  const result = this.cartService.addItem({
    id: this.product.id,
    name: this.product.name,
    price: this.product.price,
    image: this.product.images?.[0] || '',
    stock: this.productStock(),
    freeOilChangeService: this.product.freeOilChangeService,
  }, this.quantity());
  // ... handle result
}
```

---

## 4. Verification Checklist

| Check | Expected |
|-------|----------|
| `ng build` | 0 errors |
| Catalog with zone selected | Only products with stock in zone appear |
| Catalog without zone | Redirects to landing |
| Product card shows "Agotado" | When totalStock = 0 |
| Product card add disabled at max | Cannot exceed stock |
| Product detail shows real stock | Number from BranchProduct aggregation |
| Product detail "Agotado" | When stock = 0, add button disabled |
| Change zone | Catalog refreshes with new products |

---

## 5. Edge Cases

| Scenario | Behavior |
|----------|----------|
| Product exists but no BranchProduct entries | totalStock = 0, "Agotado" |
| branchIds empty (no coverage) | All products shown without stock filter (shipping only) |
| Product in cart, zone changes, stock now 0 | Cart item remains but cannot increment |
| Stock = 1, user adds 1, another user buys | Race condition handled at order creation (Phase 8) |
