# Locations v2 — State › Municipality › City › Parish

> **Status (2026-09-25):** phases 0–7 are **live in production**. Server phase 6 + price freshness published 2026-09-24 (`8f29934`); customer web (phases 4–6) published 2026-09-25 together with Android app **1.2.0 (versionCode 6)**, approved on Google Play the same day. Phase 7 shipped in its revised form (see §5, item 6). Only phase 8 (legacy cleanup) remains — it must wait until app 1.1.2 has no active installs. iOS is not started (see `informes/ESTADO-AL-2026-09-25-CIERRE.md`).
> **Spans both repos:** `backend/` (Node/Express/Mongoose) and `frontend/` (Angular 20, standalone + signals, Capacitor). Each is its own git repo.
> **Business plan / decisions (Spanish):** `informes/PLAN-UBICACIONES-2026-09-21.md`, `informes/ESPECIFICACION-UBICACIONES.md`, `informes/PLAN-DE-PRUEBAS-UBICACIONES.md`, handoff `informes/ESTADO-AL-2026-09-24.md`.
> **Supersedes:** the City/Zone/BranchZone model and flows described in `zones-branches-products-architecture.md` (March 2026). BranchProduct (stock per branch) is unchanged.

---

## 1. Purpose & Functionality

### Business
TuBus Express sells auto parts and oil-change combos from physical branches in Venezuela. Before v2, a "zone" was *one legacy city + some municipalities* and delivery was priced per municipality; customers had to pick a location before seeing the store.

v2 changes this to the official Venezuelan geography — **State › Municipality › City › Parish** — so that:

- **Coverage is per parish.** An admin builds a *zone* from parishes (any mix of states and municipalities: metropolitan Caracas is Distrito Capital + 4 municipalities of Miranda; a Maracay branch may reach into Carabobo; "Zona Lara" may be a whole state).
- **Delivery is configured per city of the zone, with per-parish exceptions**, for each branch the zone is assigned to (free / with a charge / no delivery).
- **The customer's main selector asks only State › Municipality.** City and parish are asked in the delivery / home-service form, where the parish fixes the price.
- **Location is never mandatory.** Customers may explore the whole store without one ("Ahora no, solo quiero explorar"), and remove it later ("Quitar mi ubicación").
- **Changing location never empties the cart blindly**: only items the new zone's branches do not carry are removed, after confirmation.
- **The published mobile app (1.1.2) keeps working unchanged.** It still speaks the legacy model (legacy city slug + municipality slug); the server answers it from the new data.

### Technical summary
- Fixed geographic catalogue (24 states, 335 municipalities, 335 cities — one per municipality, its capital — and 1,148 parishes) seeded from an official data file at every server start, idempotently.
- In-memory coverage snapshot (catalogue + zones + assignments + active branches) with pure rule functions; rebuilt at most every 60 s or right after an admin write.
- Four legacy routes computed from parishes (`legacy-view`), pinned by production fixtures.
- New public API under `/api/geo`, new admin API under `/api/admin/geo`.
- Frontend: `LocationStore` (replaces `LocationService`), `GeoService`, `CoverageService`, `CartReviewService`, `LocationChangeService`, `ZoneSelectorService`, the `location-cascade` form control and a rewritten zoning modal hosted at the app root.
- Orders and user profiles store a structured `location` (ids + names); the server mirrors names into the legacy text fields.

---

## 2. Architectural Decisions (The "Why")

| Decision | Why | Trade-off |
|---|---|---|
| **Fixed catalogue, no admin editing of places** (user decision, 2026-09-22) | Admins were creating cities that do not exist. Corrections go into the data file (`geo/seed/geo-seed-overrides.ts`) and ship with a deploy. | A missing/wrong place needs a code change. |
| **One city per municipality: its capital**, all parishes hang from it | The raw file lists ~479 non-capital "cities" with no reliable municipality link. | "City" is mostly a label; parish is the real delivery unit. |
| **`seedKey` + upsert with `$setOnInsert`** in the seed plan | Re-running the seed must never duplicate or clobber; ids stay stable so zones and orders keep pointing at the same docs. | Renames in the file are applied deliberately via overrides only. |
| **Pure rules over an in-memory snapshot** (`geo/coverage/*`) | The dataset is small (hundreds of municipalities, ~1k parishes, tens of zones). Pure functions are trivially testable and shared by runtime, migration and tests. | 60 s staleness bound; writes call `coverageService.invalidate()` (zones, assignments, branch update/toggle/delete). |
| **Zones may span states and legacy cities** (user decision, 2026-09-23) | The migrated "Caracas" zone already spanned Distrito Capital + Miranda; the one-state / one-legacy-city rules blocked real use (and saving any branch with Caracas). | Legacy fields of a v2 zone can no longer represent it → next row. |
| **Legacy routes answered from parishes** (`legacy-view.ts` + `legacy-coverage.service.ts`) instead of from each zone's legacy fields | A multi-city zone cannot be written as one legacy zone. Computing the answer per legacy pair from parishes removes the constraint entirely. Each rule mirrors the old route **including its quirks** (e.g. `cities?withCoverage` matches delivering municipalities by slug only; `coverage?branchIds` ignores active flags). | Verified against production fixtures (21 covered pairs, 4 routes): identical except municipality order inside a city in `coverage?branchIds` (now catalogue order; accepted by the user). |
| **Fallback to legacy fields for zones without parishes** | Deploying before running the migration would otherwise have shown "no coverage" everywhere. | Removed in phase 8 with the rest of the legacy path. |
| **Branch assignments saved all-or-nothing** (`PUT /api/admin/geo/branches/:id/assignments`, Mongo transaction) | Previously the branch saved and its zones failed separately, leaving half-saved data. | Declarative: the payload is the full list; missing assignments are removed. |
| **Parish price fixed in the form**, municipality summary elsewhere (`deliveryStatus`, `minDeliveryCharge`, `allFree`) | Delivery varies by parish; the card can only say "Gratis" or "desde $X". | The exact price is known only after the parish pick. |
| **`LocationStore` persisted in `localStorage`, read synchronously** (not the async `STORAGE` platform token the spec suggested) | The header decides on first render whether to open the selector; async reads would have opened it for everyone. | Web storage on native (WebView) — same as the old service. |
| **Selector hosted at the app root** (`ZoneSelectorHostComponent` + `ZoneSelectorService`) | Checkout hides the header, so a header-owned modal could not be opened from checkout ("Elige tu ubicación" options for a customer without a location). Auto-open still lives in the header so the admin panel never triggers it. | One extra root component. |
| **Two checkout forms kept, sharing `location-cascade`** (instead of the spec's single `checkout-address-form`) | The home-service form also selects vehicles; merging would couple unrelated concerns. Both forms dropped all duplicated list logic. | Personal-data prefill/lock and field errors now live in `features/checkout/utils/checkout-contact-form.ts` (2026-09-24). |
| **Parish mirrored into the legacy city text** (`"Tocuyito (parroquia Independencia)"`) | Admin panel, mechanic page, customer pages and WhatsApp messages all print `recipientCity`; couriers/mechanics need the parish without changing 8 templates. | Legacy text field carries composite text. |
| **Without a location, stock = every active branch** (`LocationStore.stockBranchIds`) | Without branch ids the product API returns no stock → everything showed "Agotado". The plan says "show what any branch has". | Stock shown may be in a branch far away; pickup/agency still work. |
| **`order.service.ts` untouched** | It is already 1,223 lines (above the 1,000-line cap). The order `location` feature was done in the model (`pre('validate')` hook + `location-mirror.ts`). | Split on 2026-09-24 into `order-price-check`, `order-shipping-quote`, `order-stock`, `order-service-date`, `order-servicing-branch`, `order-notifications` (783 lines left). |

SoC: catalogue (seed/services), coverage rules (pure `coverage/*`), I/O loaders (`coverage-snapshot.loader.ts`), HTTP adapters (controllers/routes), and on the frontend: state (`LocationStore`), I/O (`GeoService`, `CoverageService`), orchestration (`LocationChangeService`, `ZoneSelectorHost`), presentation (steps, cascade, forms).

---

## 3. Technical Flow & Components

### 3.1 Backend (`backend/src`)

**Catalogue — `modules/geo/`**
- `seed/venezuela-raw.json` (official source) → `seed/build-geo-seed.ts` (+ `geo-seed-overrides.ts`, `geo-aliases.ts`) → `seed/geo-seed-plan.ts` (pure upsert plan) → `services/geo-seed.service.ts` (runs at boot from `server.ts`; logs "Catálogo geográfico: sin cambios" when idempotent).
- Models: `geo-state`, `geo-municipality` (aliases, `seedKey`), `geo-city` (`isCapital`), `geo-parish` (denormalised `municipality`, `state`). Collections prefixed `geo_`.
- `services/geo-catalog.service.ts` (lists), `geo-search-index.ts` + `geo-search.service.ts` (accent/case-insensitive search by municipality, alias or city; `coveredOnly`).
- `seed/legacy-location-map.ts`: 44 legacy pairs `citySlug/municipalitySlug` → `{ state, municipality }` (injective; tested).

**Coverage — pure rules in `modules/geo/coverage/`**
- `coverage-types.ts` (snapshot types), `build-geo-catalog.ts`.
- `delivery-terms.ts`: `aggregateDelivery` (OR / OR / min, with the legacy quirk "delivering charge 0 counts as free") and `effectiveTerms` (parish exception › city terms › none).
- `coverage-queries.ts`: `parishCoverage`, `municipalityCoverage` (branches, cities → parishes with terms, `deliveryStatus`, `minDeliveryCharge`, `allFree`), `coverageTree` (states/municipalities with service + `hint`).
- `v2-derivation.ts`: zone validation (non-empty, known, active parishes; any states), `alignCityConfig` (new cities default to free delivery — the fix for the Guarenas gap), `validateCityConfig`, and legacy-field derivation for v2 zones (only for the legacy admin listing).
- `legacy-derivation.ts`: legacy → v2 derivation used by the migration and by `legacy-sync` while the old panel is used; `legacyPairCoverage` replica.
- `legacy-view.ts`: builds per-assignment legacy views (from parishes, or from legacy fields if a zone has none) and answers `by-location` / `delivery-config`, `cities?withCoverage`, `coverage?branchIds`.
- `coverage-equivalence.ts`: migration safety net (every parish of a mapped municipality must equal the legacy answer).

**Services**
- `services/coverage-snapshot.loader.ts` (one query per collection; assignments sorted by `createdAt, _id`), `services/coverage.service.ts` (snapshot cache 60 s, `invalidate()`, `getLegacyView()`, municipality/parish coverage, `resolveLegacyLocation`).
- `services/legacy-coverage.service.ts`: the 4 legacy routes' response shapes; `branch-zones/services/branch-zone.service.ts` and `cities/services/city.service.ts` delegate to it.
- `services/zone-v2.service.ts`: v2 zone create/update (marks `v2Managed`, realigns assignments), `saveBranchAssignments` (validate all → transaction: delete missing, update changed, insert new).
- `services/legacy-sync.service.ts`: while the legacy panel edits non-v2 zones, derives their v2 fields.
- `zones/services/zone.service.ts` → `assertLegacyEditable`: legacy panel gets 409 on `v2Managed` zones.

**Routes**
- Public `/api/geo`: `GET /states`, `/states/:id/municipalities`, `/municipalities/:id/cities`, `/cities/:id/parishes`, `/search?q=&coveredOnly=true`, `/coverage-tree`, `/coverage/municipalities/:id`, `/coverage/parishes/:id`, `/legacy-resolve?citySlug=&municipality=`.
- Admin `/api/admin/geo` (admin auth): `GET /states`, `GET /tree?stateId=`, `POST /zones`, `PUT /zones/:id`, `PUT /branches/:id/assignments`.
- Legacy (published app, same shapes as before): `GET /api/cities?withCoverage=true`, `/api/branch-zones/by-location`, `/api/branch-zones/delivery-config`, `/api/branch-zones/coverage?branchIds`.

**Orders & users (phase 6)**
- `shared/schemas/location-ref.schema.ts`: `{ state, stateName, municipality, municipalityName, city?, cityName?, parish?, parishName? }` (`_id: false`, required state/municipality + names, max lengths).
- `orders/models/order.model.ts`: `dispatchDetails.location`, `billingAddress.location`; `pre('validate')` → `orders/utils/location-mirror.ts` fills `recipientState/City/Municipality` (and billing `state/city/municipality`) from the location; city text includes the parish.
- `users/models/user.model.ts`: `location`; `users/services/user.service.ts` whitelists and returns it. The six legacy profile text fields are still written by the web.

**Infra**
- `config/dns-override.ts` + `config/bootstrap-dns.ts`: `DNS_SERVERS=1.1.1.1,8.8.8.8` in the local `.env` makes Node resolve Atlas SRV records on machines with VPN adapters (ignored when `NODE_ENV=production`). Imported in `server.ts` before `./app` because the session store connects at import time; also applied in the location scripts.
- `config/database-guard.ts`: a non-production server refuses to start against `tu-bus-express-QA` (production) or `tu-bus-express-prod`.

**Scripts (`src/scripts`, run with `npx ts-node -r tsconfig-paths/register …`, flags from `scripts/lib/target-env.ts`: `--env dev|qa`, dry-run by default, `--apply`, `--confirm-target qa` required for production)**
- `backup-collections.ts`, `restore-collections.ts`, `migrate-locations-v2.ts` (done in production on 2026-09-23: 0 differences, 18 documents), `refresh-dev-locations.ts`, `drop-legacy-geo-collections.ts`, `add-municipality-to-zone.ts`.

### 3.2 Frontend (`frontend/src/app`)

**Models / utils**
- `models/geo.model.ts`: public types (`GeoPlace`, `LocationRef` `{state, municipality, city?, parish?}` as `{id,name}`, `StoredLocation` flat server shape, `DeliveryStatus`, `GeoCoverageState`, `GeoSearchHit`, `BranchSummary`, `MunicipalityCoverage`, `ParishDelivery`) and admin types.
- `shared/utils/location-ref.util.ts`: `toStoredLocation`, `fromStoredLocation`, `cityAndParishLabel`.
- `shared/utils/zone-states.util.ts`: "Distrito Capital + Miranda" labels (admin).

**State & services (`core/services`)**
- `location-store.service.ts` — `LocationStore`: `status: 'undecided' | 'browsing' | 'selected'`, `location`, `coverage`, computed `branches`, `branchIds`, `hasCoverage`, `hasInStoreOilChange`, `branchesWithOilChange`, `deliveryStatus`, `minDeliveryCharge`, `allFree`, `locationLabel` ("Chacao, Miranda"), **`stockBranchIds`** (zone branches, or all active branches while browsing), `isResolved`. `setLocation(state, municipality, coverage?)`, `browseWithoutLocation()`. Persists `user_location_v2`; migrates the old `user_location` (`{citySlug, municipalitySlug}`) once via `legacy-resolve` (kept for retry if offline). Stale responses are dropped with a request sequence.
- `geo.service.ts` (catalogue lists cached per id; search; coverage tree; legacy resolve), `coverage.service.ts` (municipality / parish coverage, not cached).
- `cart-review.service.ts`: items with no stock in the given branches; network error ⇒ keep the item; no branches ⇒ everything unavailable. `removeUnavailable`.
- `location-change.service.ts`: `prepare(state, municipality)` → coverage + cart review; `apply(plan)` → remove only unavailable items + `setLocation` with the prefetched coverage.
- `zone-selector.service.ts`: `open()` / `close()`. Opened only by the header (changing location) and by a checkout option that needs one for a customer who never picked any. Address forms never open it (user decision, 2026-09-24): their state and municipality are the customer's location, fixed; only the agency, billing and profile cascades pick states nationally, and none of them touches the main location.

**Selector**
- `shared/components/zone-selector-host/` (in `app.html`): hosts `app-zoning-modal` and the "items will be removed" confirmation; closing without a pick while `undecided` ⇒ browsing.
- `shared/components/zoning-modal/` (orchestrator) + `zoning-state-step/` (states by name only + search) + `zoning-municipality-step/` (delivery badge per municipality), shared styles `_zoning-buttons.scss`. Title "Elige tu ubicación"; footer "Ahora no, solo quiero explorar" or, with a location, "Quitar mi ubicación". Escape/✕/outside close; frozen while `busy`.
- Header (`layouts/pages/tu-bus-servicio/components/tubus-header`): label "Elige tu ubicación" when not selected; auto-opens the selector once, only when `status === 'undecided'` after the store resolves.

**Form control**
- `shared/components/location-cascade/` — `ControlValueAccessor` with value `LocationRef | null`; inputs `source: 'coverage' | 'national'`, `levels`, `fixed` (shown as text, with `fixedPrefix` / `fixedNote`; no way to change it from the form; a new `fixed` resets the selection and ignores late answers for the old one), `deliverableOnly`, `optionalLevels`; output `deliveryChange: ParishDelivery | null` (coverage mode, on parish pick or written value). Auto-picks single options (and reports them in `registerOnChange`, since forms register after the first `writeValue`).

**Checkout (`features/checkout`)**
- `services/checkout.service.ts`: `dispatchOptions` with `requiresLocation` (zone-bound options shown without a location), local delivery shown when `deliveryStatus !== 'none'`, "Gratis" / "desde $X"; `deliveryQuote` + `setDeliveryQuote`; `getShippingCost` / label use the parish quote; `LocalDeliveryRecipientInfo.location`, `OilChangeServiceInfo.location`, `ShippingRecipientInfo.location`, `BillingAddress.location`.
- `checkout-dispatch`: a `requiresLocation` option opens the selector and is selected automatically when the chosen zone offers it.
- `checkout-local-delivery-form`: cascade `coverage`, `['city','parish']`, `deliverableOnly`, price shown; clears the place if the customer's municipality changes; profile prefill only in the same municipality.
- `checkout-oil-change-form`: same cascade without `deliverableOnly` (the mechanic travels to every covered parish).
- `checkout-shipping-form` (agency) and billing "custom" (`checkout-summary/services/checkout-billing.service.ts`): cascade `national`, `['state','municipality','city']`.
- `checkout-summary`: sends `dispatchDetails.location` / `billingAddress.location`; shipping cost from `CheckoutService.getShippingCost()`; `checkout-branch-stock.service.ts` offers every active branch for store pickup without a location.

**Profile** — `features/profile/profile-info`: cascade `national` with optional parish; saves `location` plus the six legacy fields (legacy `stateCode` = letter of the official code, e.g. "G" for "VE-G").

**Admin** — `features/admin/zones/zone-form` (one parish tree per state, "Añadir otro estado", "Quitar estado"), `zone-list` (multi-state labels), `features/admin/branches/branch-form` + `branch-zone-delivery` (city table with parish exceptions; trees of every state of the zone; atomic save).

**Catalogue screens** — `features/catalog`, `product-detail-page`, `tubus-combos` use `LocationStore.stockBranchIds`; the catalogue reloads when it changes.

### 3.3 Main flows
1. **First visit:** store resolves (`undecided`) → header opens the selector → pick (state › municipality, or search) → `LocationChangeService.prepare` → confirm only if items would be removed → `apply`.
2. **Explore:** "Ahora no" / ✕ while undecided → `browsing` persisted; active branches loaded; catalogue shows stock of any branch.
3. **Delivery checkout:** dispatch card ("desde $X") → form: fixed state/municipality, city + parish (deliverable only) → `ParishDelivery` → `deliveryQuote` → summary total → order with `dispatchDetails.location` → server mirrors text fields (parish in city text).
4. **Published app:** legacy routes → `legacyCoverageService` → `legacy-view` over the snapshot → same shapes and values as before.

---

## 4. Limitations & Edge Cases

- **Published app (1.1.2) sees whole municipalities.** A municipality with some parishes delivering shows as delivering, at the best terms among them. Rule for admins until the new app is adopted: do not set different prices inside one municipality (the old app would charge the lowest).
- **Legacy quirks deliberately kept** in `legacy-view` (slug-only delivery match in `cities?withCoverage`, no active-flag checks in `coverage?branchIds`). Do not "fix" them while 1.1.2 is in use.
- **Zones without parishes** are answered from legacy fields. After the production migration none remain; any new legacy-panel zone is re-derived by `legacy-sync`.
- **The legacy admin panel** (inside the 1.1.2 app bundle / old web) gets 409 when editing a `v2Managed` zone.
- **Snapshot staleness:** up to 60 s for changes made outside the invalidating services (e.g. direct DB edits, scripts). Scripts that write coverage should be followed by a server restart or wait 60 s.
- **Shipping cost is still trusted from the client** (phase 7 adds server validation behind a flag, coordinated with "punto 21" and the new app release).
- **Customer location lives in `localStorage`**; private mode / blocked storage ⇒ session-only location.
- **A customer location in a municipality without coverage** is kept (status `selected`, no branches): zone-bound options disappear; the catalogue shows no stock filter results for that zone.
- **Parish in the legacy city text** makes `recipientCity` composite; parse `dispatchDetails.location` instead of the text when you need structure.
- **Files over the 1,000-line cap:** split on 2026-09-24 — `order.service.ts` (focused modules), `order-dispatch-modal` (`.ts`/`.html`/`.scss`), backend `auth.controller.ts` (into `auth`, `social-auth`, `password-reset`, `email-verification` controllers + `users/utils/auth-session.ts` + `users/services/email-verification-dispatch.ts`), `checkout-summary.component.html` (payment modal → `checkout-summary/components/checkout-payment-modal`, 1,290 → 970 lines) and `admin/settings/settings.component.scss` (4 ordered partials). Verified: compiled styles identical; checkout summary screenshots identical in 14 states (light/dark). The remaining five were split on 2026-09-25: admin settings → one standalone component per section under `admin/settings/sections/` plus `accordion-item/` and shared partials in `settings/styles/` (dead `dispatchForm` store-pickup group, `homeHeroForm` and `whatsappForm` removed; the `storePickup` module toggle stays); `AuthService` → public facade (547 lines) over `core/services/auth/` (`auth-session.store`, `auth-success.handler`, `account-blocked.store`, `auth-modal.store`, `oauth-account-link.service`, `native-oauth-sign-in.service`), public API unchanged; `date-picker-panel` → template/styles in their own files + pure `utils/date-picker-calendar.util.ts` (with specs); both order-detail stylesheets → ordered partials in `styles/`. Verified: compiled CSS identical, all 9 settings sections pixel-identical to production, 154 frontend tests. **No source file is over the cap.**
- **Not done by design:** editing places from the panel; per-parish pricing for the agency flow; offline catalogue.

---

## 5. Integration Guide & Future Improvements

**Integrating**
- Need the customer's place or its branches? Inject `LocationStore`; use `stockBranchIds` for stock/catalogue queries and `branchIds`/`branches` only when a real zone is required (checkout).
- Need a place picker in a form? Use `<app-location-cascade formControlName="…">` with the right `source` and `levels`; store with `toStoredLocation`, restore with `fromStoredLocation`.
- Need to open the selector? `ZoneSelectorService.open()`. Never render another `app-zoning-modal`.
- Need a location change that respects the cart? `LocationChangeService.prepare` → confirm → `apply`. Never `clearCart()` on location change.
- Writing coverage on the server? Go through `zone-v2.service.ts` and call `coverageService.invalidate()`; never write `zones`/`branch_zones` legacy fields directly for v2 zones.
- Touching legacy routes? Run `modules/geo/__tests__/legacy-view.test.ts` (production fixtures, both "not migrated" and "migrated" data) — they must stay identical. Never refresh the fixtures after the migration.
- Local dev: `.env` needs `DNS_SERVERS=1.1.1.1,8.8.8.8` if VPN adapters are up; everything runs against `tu-bus-express-dev`.

**Verification commands**
- Backend: `npx tsc --noEmit -p .` and `npx jest` (261 tests at phase 6).
- Frontend: `npx tsc --noEmit -p tsconfig.app.json`, `npx ng test --watch=false --browsers=ChromeHeadless` (154 tests on 2026-09-25), and **always** `npx ng build` (templates are only type-checked by the build).

**Next steps**
1. ~~Publish the phase-6 server changes~~ — done 2026-09-24.
2. ~~Publish web + mobile app with phases 4–6 together~~ — done 2026-09-25 (web + Android 1.2.0 / vc6).
3. ~~Phase 7~~ (superseded by item 6): server-side validation of `shippingCost` (parish terms for local delivery, 0 for agency), behind a flag; enable with the new app; 409 + client message ("punto 21").
4. Phase 8 (when 1.1.2 has no active installs): remove `legacy-view`/`legacy-coverage`, legacy fields (`zone.city`, `zone.municipalities`, `branchZone.deliveryConfig`), `cities` collection and seed, `legacy-location-map`, `legacy-sync`, `LocationStore` legacy migration, `city.model`/zone legacy fields on the frontend; then the per-municipality price rule no longer applies.
5. ~~Refactors~~ — done 2026-09-24/25 (shared checkout contact helper; every oversized file split, see §4).
6. **Price freshness (2026-09-24, user decision):** the customer is never told a price changed. `CartPriceSyncService` refreshes cart prices from `GET /api/products/prices` at start-up, every 60 s while visible and on tab focus; the checkout summary locks it while the payment modal is open, a payment is registered, the confirm modal is open or the order is being sent, so the order keeps what was paid. The server never rejects on price: `priceCheck` (now also shipping: parish price for local delivery, agency charge, 0 otherwise) only notifies the admin. This replaces phase 7 / "punto 21" as originally specified (no 409, no flag).
8. **Android back button (2026-09-24):** `core/services/back-dismiss.service.ts` keeps a stack of open modals; `BackButtonService` closes the top one before overlays/history. Modals opt in with `dismissOnBack(isOpen, close)` in their constructor (20 customer-facing modals wired). Modals always present in the DOM must pass their real open state, never `() => true` (the link-password modals once blocked back entirely). The catalog request now times out after 20 s so a request caught by a network drop shows the error state.
7. **Store pickup placeholder removed (2026-09-24):** the summary no longer shows `settings.dispatch.storePickup` (it held example data in production: «Av. Principal #123…»), and orders no longer fall back to it — pickup always stores the selected branch's real address. The unused admin settings fields were removed from the panel on 2026-09-25 (the server model still has them; drop them in phase 8).
9. **Hosting (2026-09-25):** the Railway services ran in Southeast Asia while MongoDB Atlas is in Virginia; every query crossed the Pacific (catalogue 2.5–6.5 s). All three services now run in US East: catalogue ~0.6 s, home page ~0.5 s. Keep Railway and Atlas in the same region.
10. **Location picker layout (2026-09-25):** municipalities list in one column on phones and two from `sm` up (the modal widens to `max-w-2xl` there) so the delivery badge never wraps.
