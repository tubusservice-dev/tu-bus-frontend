# Customer Order Detail — Full Redesign

## Purpose & Functionality

### Business Perspective
The customer order detail view allows authenticated users to inspect the full details of any order they've placed — products, totals, dispatch information, payment data, billing address, assigned mechanic, notes, and status history. Users can also edit payment submissions for orders in `pending` or `confirmed` status, and cancel pending orders.

### Technical Perspective
Previously, the order detail was rendered as a **fullscreen overlay (`position: fixed`)** inside the `OrderListComponent`. This caused z-index conflicts with the site navbar, felt like a modal rather than a real page, and violated Separation of Concerns by bundling ~600 lines of detail logic into the list component.

The redesign extracts the order detail into a **standalone routed component** (`OrderDetailComponent`) at `/perfil/pedidos/:id`, following the same architectural pattern used by the admin panel (`/admin/orders/:id`).

---

## Architectural Decisions (The "Why")

### 1. Separate Route Instead of Overlay
**Decision:** Create a dedicated route `/perfil/pedidos/:id` instead of using a `position: fixed` overlay.

**Rationale:**
- The overlay competed with the site navbar (`sticky top-0 z-50`) for stacking context, causing the navbar to bleed through regardless of z-index values due to Angular's ViewEncapsulation creating separate stacking contexts per component.
- A routed page integrates naturally with the `MainLayout` (header + content + footer) without fighting the DOM hierarchy.
- Enables browser back/forward navigation, deep-linking, and URL sharing.
- Follows the established pattern: admin order detail is also a routed page.

### 2. Admin Design System Replication
**Decision:** Replicate the admin panel's card-based design system for the customer detail view.

**Rationale:**
- Visual consistency across the application.
- The admin's `.detail-card` + `.card-title` + `.info-rows` pattern is proven, responsive, and well-structured.
- Two-column grid (`lg:grid-cols-2`) maximizes desktop real estate while stacking cleanly on mobile.

### 3. SoC: List vs Detail Separation
**Decision:** The `OrderListComponent` now contains zero detail logic. It only handles listing, filtering, pagination, and navigation.

**Rationale:**
- Single Responsibility: list component lists, detail component shows details.
- The list went from ~350 lines of TS to ~110 lines. The HTML went from ~447 lines to ~80 lines.
- Payment editing, proof upload, cancel modal — all moved to `OrderDetailComponent` where they belong.

### 4. Dark Mode: Explicit Slate Palette
**Decision:** Use hardcoded Slate palette values (`#0f172a`, `#1e293b`, `#334155`, `#60a5fa`) via `:host-context(.dark)` instead of relying on CSS custom properties like `--accent-primary`.

**Rationale:**
- The `--accent-primary` variable resolved to a dark blue that was nearly invisible on dark backgrounds.
- Hardcoded values guarantee contrast and readability regardless of theme variable configuration.
- SVG icons use `#3b82f6` (light) / `#60a5fa` (dark) — both within WCAG AA contrast ratios against their respective backgrounds.

---

## Technical Flow & Components

### File Structure
```
frontend/src/app/features/orders/
├── order-list/
│   ├── order-list.component.ts       # List only: load, filter, paginate, navigate
│   ├── order-list.component.html     # Order cards grid + toolbar + pagination
│   └── order-list.component.scss     # List-only styles (~130 lines)
└── order-detail/
    ├── order-detail.component.ts     # Detail page: load by ID, payment edit, cancel
    ├── order-detail.component.html   # Full page: header, 2-col grid, cards, modal
    └── order-detail.component.scss   # Page styles with admin pattern (~300 lines)
```

### Routing
```
// app.routes.ts — inside MainLayout children
{
  path: 'perfil/pedidos/:id',
  loadComponent: () =>
    import('./features/orders/order-detail/order-detail.component')
      .then((m) => m.OrderDetailComponent),
  canActivate: [authGuard],
}
```

### Data Flow
1. **Navigation:** `OrderListComponent.viewDetail(order)` calls `router.navigate(['/perfil/pedidos', order.id])`.
2. **Loading:** `OrderDetailComponent.ngOnInit()` reads `:id` from `ActivatedRoute.snapshot.paramMap`, calls `OrderService.getOrderById(id)`.
3. **Back navigation:** `goBack()` navigates to `/perfil` with `fragment: 'pedidos'` to return to the orders tab.
4. **Payment edit:** Self-contained within the detail component. Uses `OrderService.updatePayment()` and `UploadService.uploadImage()` for proof files.
5. **Cancel order:** Opens a centered modal overlay (scoped to this component, z-index: 50), calls `OrderService.cancelOrder()`, then navigates back to the list.

### UI Layout (Desktop — 2 Columns)
```
┌─────────────────────────────────────────────────────┐
│ < Mis Pedidos                                       │
│ Orden #TBS-20260331-9281  [Pendiente]               │
├─────────────────────┬───────────────────────────────┤
│ 📦 Productos (1)    │ 💳 Datos del Pago        [✏] │
│   item rows...      │   method, ref, bank...        │
│   ─────────────     │                               │
│   Subtotal  $49.00  ├───────────────────────────────┤
│   Envío     Gratis  │ 📄 Dirección de Facturación   │
│   Total    $49.00   │   source, name, address...    │
├─────────────────────┤                               │
│ 🚚 Despacho         ├───────────────────────────────┤
│   type, branch...   │ 🔧 Mecánico Asignado          │
│   recipient info    │   name, phone                 │
├─────────────────────┤                               │
│ 🚗 Vehículo         ├───────────────────────────────┤
│   marca modelo year │ 📝 Notas                      │
│                     │   user notes text             │
│                     ├───────────────────────────────┤
│                     │ 🕐 Historial de Estados       │
│                     │   timeline with dots          │
├─────────────────────┴───────────────────────────────┤
│  Cancel inline text... [Cancelar orden]             │
└─────────────────────────────────────────────────────┘
```

### Services Used
- `OrderService` — `getOrderById()`, `cancelOrder()`, `updatePayment()`
- `UploadService` — `uploadImage()` for payment proof files
- `ActivatedRoute` — route param `:id`
- `Router` — navigation to/from detail

---

## Limitations & Edge Cases

1. **No real-time updates:** The detail page loads data once on init. If the order status changes server-side while the user is viewing, they won't see it until they refresh or navigate away and back.

2. **`dispatchDetails` assumed non-null:** The template accesses `o.dispatchDetails.selectedBranchName` etc. directly. If the backend returns an order with `dispatchDetails: null`, this would throw. The model defines it as required, but edge cases with legacy data could cause issues.

3. **Payment edit requires existing `paymentSubmission`:** The `savePayment()` method guards with `if (!o.paymentSubmission) return`. If a user needs to submit payment data for the first time (no prior submission), the current flow won't support it — they'd need to go through the checkout payment flow.

4. **Fragment-based tab restoration:** `goBack()` navigates to `/perfil` with `fragment: 'pedidos'`. The `ProfileComponent` must handle this fragment to activate the orders tab on arrival. If the profile component doesn't read the fragment, the user will land on the default tab.

5. **Cancel section only visible for `pending` orders:** By design, only orders with `status === 'pending'` show the cancel link. This is correct business logic but means confirmed orders cannot be cancelled from the frontend.

---

## Integration Guide & Future Improvements

### For Developers
- **Adding new sections:** Create a new `<section class="detail-card">` with a `<h3 class="card-title">` containing an SVG icon. Place it in the appropriate column (left for order data, right for metadata/history).
- **Adding new dispatch types:** Update `getDispatchLabel()` in `order-detail.component.ts` with the new type key-value pair.
- **Styling consistency:** All dark mode overrides use `:host-context(.dark)` with the Slate palette. Do not use `dark:` Tailwind utilities for critical colors — they may not override correctly with Angular encapsulation.

### Future Improvements
1. **Real-time status polling:** Add a periodic `interval()` or WebSocket listener to refresh order status while the user is on the page.
2. **Print/PDF export:** Add a "Descargar PDF" button that generates a printable order summary.
3. **Payment proof gallery:** If multiple proof images are supported in the future, display them in a lightbox gallery instead of a single image.
4. **Breadcrumb navigation:** Replace the simple "< Mis Pedidos" back button with a breadcrumb trail: `Perfil > Mis Pedidos > Orden #TBS-...`.
5. **Skeleton loading:** Replace the spinner with skeleton placeholders matching the card layout for perceived performance improvement.
