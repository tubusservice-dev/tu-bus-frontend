# Firebase Analytics & Crashlytics

> **Status:** Implemented & validated (Analytics confirmed via Realtime; Crashlytics confirmed via forced test crash).
> **Date:** 2026-06-02
> **Scope:** Frontend (Angular 20 + Capacitor 8). Backend: **no changes** — both products are 100% client-side.
> **Builds:** Web `ng build --configuration production` 0 errors. Android `assembleDebug` BUILD SUCCESSFUL.

---

## 1. Purpose & Functionality

Two distinct Firebase products were integrated to answer two different questions:

- **Google Analytics for Firebase (GA4)** — *what users do*: most-visited screens, most-viewed/best-selling products, search terms, and the full checkout funnel broken down by dispatch type, zone and branch.
- **Firebase Crashlytics** — *when and why the app fails*: native crash and non-fatal exception reports with device model, app version and stack trace.

Both behave differently per platform:

| | Web (`tubusexpress.com`) | Native app (Android / future iOS) |
|---|---|---|
| **Analytics** | Yes — Firebase JS SDK (GA4) | Yes — native GA SDK via `@capacitor-firebase/analytics` |
| **Crashlytics** | **No-op** (Crashlytics does not exist in the Firebase JS SDK) | Yes — `@capacitor-firebase/crashlytics` |

The integration was pre-approved in `docs/plans/capacitor-mobile/05-decisions-log.md` (decisions D1.9 Crashlytics, D1.10 Analytics) and explicitly deferred by the Firebase Push plan (`docs/plans/firebase-push-notifications/00-overview.md`), which centralised the reusable `getFirebaseApp()` bootstrap for exactly this purpose.

---

## 2. Architectural Decisions (The "Why")

### 2.1 Strategy pattern via the `@platform` layer
Analytics and Crashlytics each follow the established platform abstraction (same shape as `storage`, `messaging`, `camera`): an interface + `InjectionToken` + a `web-*` strategy + a `native-*` strategy, bound by a factory in `platform.providers.ts` based on `PlatformService.isNative()`. Consumers inject the token (`ANALYTICS` / `CRASHLYTICS`) and **never branch on platform**.

### 2.2 Crashlytics is native-only → web strategy is a deliberate no-op
The Firebase JS SDK has **no Crashlytics module**. Rather than gate every call site with `isNative()`, the web strategy implements the full `ICrashlytics` interface as no-ops. This keeps consumers (the global `ErrorHandler`, `AuthService`) platform-agnostic. The original plan (D1.9) implied Crashlytics was cross-platform; this was corrected here.

### 2.3 Web Analytics uses `firebase/analytics` directly, NOT the Capacitor plugin's web layer
Mirrors the messaging pattern: web talks to `firebase/*` directly, native uses the Capacitor plugin. Routing web through the plugin's web layer would initialise a second Firebase app and diverge from the `getFirebaseApp()` singleton. The web strategy reuses that singleton.

### 2.4 Lazy plugin imports (zero web-bundle cost)
Native plugins are imported with `await import('@capacitor-firebase/...')` **inside** the native strategies. The web bundle never loads native plugin code. `firebase/analytics` is also dynamically imported, so the GA chunk only loads when analytics actually initialises. Net eager addition to the initial bundle: ~5 kB (strategy classes + tokens), well under the 30 kB ceiling.

### 2.5 Crash reporting hooked into the single global `ErrorHandler`
`ChunkLoadErrorHandler.handleError()` forwards non-chunk errors to `crashlytics.recordException()` before `console.error`. The `CRASHLYTICS` token is resolved **lazily via `Injector`** (not constructor injection) to avoid DI-ordering issues, and the whole branch is wrapped so a telemetry failure can never re-enter the error handler.

### 2.6 DRY: single source for the GA4 `items[]` payload
`CartService.getAnalyticsItems()` is the one place that maps the cart to the GA4 `items[]` shape, reused by `view_cart`, `begin_checkout` and `purchase`. This guarantees a consistent product payload across the funnel — **required** for GA4 monetisation reports.

### 2.7 `items[]` array is mandatory, not optional
The biggest correctness decision: all e-commerce events (`view_item`, `add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout`, `purchase`, plus `view_item_list`/`select_item`) send the standard GA4 `items[]` array. Without it, GA4's entire Monetisation report suite (best sellers, item revenue, view→cart→purchase rate) stays empty — you would only see raw event counts, not *which* products.

### 2.8 Automatic `screen_view` centralised in bootstrap
`AnalyticsBootstrapService` subscribes once to Router `NavigationEnd` and emits `screen_view`. Feature components never import the analytics token just to track page views (SoC + DRY). It also enables data collection for both products at boot.

---

## 3. Technical Flow & Components

### 3.1 Bootstrap
- `core/firebase/firebase.config.ts` — `getFirebaseApp()` singleton (shared with messaging).
- `platform/analytics/analytics-bootstrap.service.ts` — `start()`: enables collection (Analytics + Crashlytics) and wires automatic `screen_view`.
- `app.config.ts` — `initializeAnalytics` APP_INITIALIZER calls `AnalyticsBootstrapService.start()`. The global `ErrorHandler` is `ChunkLoadErrorHandler` (now Crashlytics-aware).
- `environments/environment(.prod).ts` — `firebase.measurementId: 'G-ZCFBGB0C3R'` (GA4 web stream; required for web Analytics).

### 3.2 Platform layer files
```
platform/analytics/
  analytics.service.ts            interface IAnalytics + ANALYTICS token + AnalyticsEvent const
  native-analytics.strategy.ts    @capacitor-firebase/analytics (lazy)
  web-analytics.strategy.ts       firebase/analytics (lazy), gated on measurementId + isSupported()
  analytics-bootstrap.service.ts  setEnabled + screen_view on NavigationEnd
platform/crashlytics/
  crashlytics.service.ts          interface ICrashlytics + CRASHLYTICS token
  native-crashlytics.strategy.ts  @capacitor-firebase/crashlytics (lazy)
  web-crashlytics.strategy.ts     no-op
platform/platform.providers.ts    factory bindings for ANALYTICS + CRASHLYTICS
platform/index.ts                 barrel exports (ANALYTICS, CRASHLYTICS, AnalyticsEvent, AnalyticsBootstrapService, types)
```

### 3.3 `IAnalytics` API
`setEnabled`, `logEvent(name, params?)`, `setUserId(id|null)`, `setUserProperty(name, value|null)`, `setScreen(name)`.
`ICrashlytics` API: `setEnabled`, `recordException(message, error?)`, `log`, `setUserId`.

### 3.4 Instrumented events (the catalogue)
| Event | Fires in | Payload highlights |
|---|---|---|
| `screen_view` | `AnalyticsBootstrapService` (Router) | automatic per navigation |
| `login` | `AuthService.handleAuthSuccess` (single funnel for local + OAuth + link) | + `setUserId` (analytics & crashlytics) |
| `logout` | `AuthService.performLogoutAsync` | clears `setUserId` |
| `sign_up` | `AuthService.register` | `{ method: 'email' }` |
| `view_item_list` | `CatalogComponent` (on products loaded) | `item_list_name`, `items[]` |
| `select_item` | `ProductCardComponent.navigateToDetail` (catalog/related/landing) | `items[]` |
| `view_item` | `ProductDetailPageComponent` (Phase 1 load) | `items[]` incl. `item_brand`/`item_category` |
| `add_to_cart` | `CartService.addItem` | `items[]` |
| `remove_from_cart` | `CartService.removeItem` | `items[]` (captured before removal) |
| `view_cart` | `CartOverlayComponent` (constructor) | `items[]` |
| `begin_checkout` | `CheckoutDispatchComponent.ngOnInit` | `items[]` |
| `add_shipping_info` | `CheckoutDispatchComponent.onContinue` | `shipping_tier = dispatchType` |
| `add_payment_info` | `CheckoutSummaryComponent.executeOrder` | `payment_type` |
| `purchase` | `CheckoutSummaryComponent` (order created) | `transaction_id`, `value`, `shipping`, `dispatch_type`, `items[]` |
| `purchase_failed` | `CheckoutSummaryComponent` (order error callback) | `screen`, `reason`, `dispatch_type` |
| `form_error` | 5 checkout forms (invalid submit) | `screen` (`checkout_shipping`/`_delivery`/`_oil_change`/`_seller_agreement`/`_payment`) |
| `exception` | `ChunkLoadErrorHandler` (uncaught runtime errors) | `description`, `fatal:false` (also reported to Crashlytics on native) |

### 3.4.1 Screen-view coverage (drop-off / abandonment analysis)
Automatic `screen_view` fires on every **routed** navigation, with names normalised by `AnalyticsBootstrapService.toScreenName()` (id segments collapsed to `:id`, query/hash stripped) so funnels and the "Pages and screens" report don't fragment.

Overlays and modals reuse the current URL (no `NavigationEnd`), so they emit `setScreen()` **manually**:
- `product_detail`, `cart` → `OverlayStackService.push()` (one central place).
- `auth_modal` → root `App` effect on `authModalOpen`.
- `zoning_city` / `zoning_municipality` / `zoning_no_coverage` → `ZoningModalComponent` effect (one screen per step, to pinpoint where users abandon the mandatory zone selection).

Because every `screen_view` carries GA4's automatic `engagement_time_msec`, "where users linger" works out of the box; abandonment is read via Funnel Exploration over the screen/event sequence.

### 3.5 User properties (segmentation)
`LocationService` constructor runs an `effect()` that sets two user properties whenever the user's zone changes:
- `zone` = `locationLabel()` ("Municipio, Ciudad")
- `branch` = first `branchIds()` entry

These tag **every** subsequent event, enabling per-zone / per-branch segmentation across all reports.

### 3.6 Android native config
- `package.json` — `@capacitor-firebase/analytics@8.2.0`, `@capacitor-firebase/crashlytics@8.2.0` (aligned with auth/messaging 8.2.0). Native Firebase SDKs (`firebase-analytics:23.0.0`, `firebase-crashlytics:20.0.3`) come transitively from the plugins.
- `android/build.gradle` — classpath `com.google.firebase:firebase-crashlytics-gradle:3.0.2`.
- `android/app/build.gradle` — `apply plugin: 'com.google.firebase.crashlytics'` (inside the existing `google-services.json` guard).
- `android/app/google-services.json` — already present; valid for native Analytics + Crashlytics (no `measurementId` field exists here — that is web-only).

### 3.7 Privacy policy
`features/legal/pages/privacy-policy/privacy-policy.component.ts` — new section **2.6 "Datos de uso y diagnóstico"** + Google (Firebase) added as processor in section 5; `lastUpdated` bumped.

---

## 4. Limitations & Edge Cases

- **Crashlytics on web does nothing** — by design. Web error visibility relies on `ChunkLoadErrorHandler` + console.
- **Web Analytics needs `measurementId`** — empty value ⇒ web strategy is an inert no-op (native unaffected). Currently set to `G-ZCFBGB0C3R`.
- **Custom dimensions must be registered in the GA4 console** — User scope: `zone`, `branch`. Event scope: `dispatch_type`, `payment_type`, `screen`, `reason`. The params/properties travel regardless, but won't appear as report columns until registered. `shipping_tier`, `search_term`, `item_*`, `description`, `fatal` are GA4-standard and surface automatically. **(Registered by the owner.)**
- **Overlays/modals emit `screen_view` manually** — product detail, cart, auth modal and the zoning steps are NOT routes, so they call `setScreen()` explicitly (see 3.4.1). If a new overlay/modal is added, remember to emit its screen.
- **`form_error` covers 5 forms** — shipping, delivery, oil-change, seller-agreement, payment. The agency *selection* step and the in-store oil-change (vehicle-only) step have no blocking form validation, so they emit no `form_error`.
- **`sign_up` + `login` both fire on auto-login registration** — acceptable (the user did sign up *and* log in).
- **Data latency** — Realtime ≈ minutes; standard reports & newly-registered dimensions ≈ 24–48 h (not retroactive).
- **Pre-existing initial-bundle budget warning** (~847 kB vs 800 kB) is NOT caused by this feature (baseline was 841 kB). Separate tech-debt decision.
- **`google-services.json` must never be committed** (it is gitignored; distributed via the credentials vault).

---

## 5. Integration Guide & Future Improvements

### Add a new analytics event
1. Add the canonical name to `AnalyticsEvent` in `platform/analytics/analytics.service.ts`.
2. `inject(ANALYTICS)` in the owning service/component.
3. `void this.analytics.logEvent(AnalyticsEvent.X, { ...params })`. For e-commerce events, always include `items: this.cartService.getAnalyticsItems()` (or an inline `items[]`).

### Add a user property
1. Add `analytics.setUserProperty('name', value)` at the natural source (e.g. a service `effect`).
2. Register a matching **User-scoped** custom dimension in GA4 → Admin → Custom definitions.

### Register custom dimensions in GA4 (owner / console)
GA4 → Admin → Custom definitions → Create:
- User scope: `zone`, `branch`.
- Event scope: `dispatch_type`, `payment_type`, `screen`, `reason`.

(`shipping_tier`, `search_term`, `item_*`, `description`, `fatal` are standard — no registration needed.)

### Verify
- Analytics: GA4 → Realtime (or DebugView via `adb shell setprop debug.firebase.analytics.app com.tubusexpress.app`).
- Crashlytics: trigger a crash, **reopen the app** (reports upload on next launch), check the Crashlytics dashboard.

### Pending / future
- **Deploy the web frontend** so `tubusexpress.com` also reports Analytics (the native app already does; backend untouched). Owner-managed.
- **`refund` event** on order cancellation.
- **Backend best-sellers aggregation** (`$group` by `items.product`) — only if the metric is wanted inside the admin panel rather than GA4 (GA4 already provides it via `purchase` + `items[]`).
- **Firebase Analytics on iOS** — works automatically once Phase B (iOS) ships; the platform layer is already platform-agnostic.
- A **temporary QA page** (`/crash-test` + floating button) was used to validate Crashlytics and has been fully removed.
```
