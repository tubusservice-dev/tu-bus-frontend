# 01 — Definición de los 10 Bloques del Sistema

> **Status:** Baseline definition
> **Purpose:** dividir el sistema TuBus Express en 10 bloques funcionales independientes para poder (a) hacer pruebas baseline antes de Capacitor, (b) hacer pruebas post-Capacitor con la misma matriz, (c) aislar bugs por área cuando aparezcan, (d) detectar regresiones específicas.
> **Audiencia:** desarrollador implementando Capacitor + reviewer + futuros mantenedores.
> **Lectura previa requerida:** `00-master-plan.md`

---

## ¿Por qué dividir en 10 bloques?

Tres razones técnicas:

1. **Aislamiento de regresión.** Si tras Capacitor falla el carrito, basta correr el bloque 5 para reproducir; no hace falta re-testear todo.
2. **Trazabilidad.** Cada bloque tiene un set fijo de archivos y endpoints. Cuando un cambio de código toca un bloque, sabemos qué tests correr.
3. **Convenio de PRs.** Cada PR de la implementación Capacitor declara qué bloques toca y cuáles preserva. Reviewer verifica que los preservados siguen pasando.

Los 10 bloques cubren el **100% de la funcionalidad pública del frontend**. Hay overlap mínimo controlado (algunos servicios transversales como `AuthService`, `SettingsService`, `LocationService` aparecen en varios bloques porque son dependencias compartidas — eso se documenta explícitamente).

---

## Mapa de los 10 Bloques

| # | Bloque | Scope | Plataforma usuaria |
|---|---|---|---|
| B1 | **Auth Cliente Local** | Registro, login email/password, logout, password reset, email verification, change password, modal account-blocked | Cliente |
| B2 | **Auth Google y Account Linking** | OAuth Google (web), account linking (caso 3), verify-account-link, complete-profile modal | Cliente |
| B3 | **Auth Admin** | Login admin con username, sesión separada, guards `adminGuard`/`adminLoginGuard`, layout admin | Admin |
| B4 | **Navegación, Catálogo y Detalle de Producto** | Routing, lazy loading, catálogo con filtros y búsqueda, overlay de detalle de producto, hardware back, scroll preservation, chunk-load-error handler | Cliente |
| B5 | **Carrito y Estado Persistente Local** | Cart service, persistencia carrito, theme service, location service, settings service init, exchange rate, PWA install/update, oauth_return_url | Cliente |
| B6 | **Checkout, Zoning y Pagos** | Zoning modal, location service, branches/delivery resolution, 6 forms de checkout (dispatch/agency/shipping/delivery/oil-change/in-store), payment methods, proof upload, summary, confirmation, vehicle selector | Cliente |
| B7 | **Perfil Cliente y Garaje** | Profile component, profile-info, garage/vehicles CRUD, payment history, notifications list, change-password modal, complete-profile modal, avatar upload | Cliente |
| B8 | **Pedidos, Servicios y Reviews** | Order list, order detail (cliente), service tracking, mechanic progress (público sin auth), ratings, order comments, messaging modal, re-upload de comprobantes | Cliente + Mecánico |
| B9 | **Notificaciones Push y Comunicación Externa** | FCM lifecycle (web), push subjects, polling fallback, OS toasts (`browserNotify`), popover bell, badge counts, mark-as-read, device token registration, external links (WhatsApp, tel, redes sociales), clipboard | Cliente + Admin |
| B10 | **Admin Panel Operacional** | Dashboard, todos los CRUDs admin (users, products, lines, categories, brands, mechanics, branches, zones, shipping-agencies, payment-methods), order management admin, dispatch modal, slot suggestions, reviews admin, settings admin, image uploads admin | Admin |

---

## Bloque 1 — Auth Cliente Local

### Scope funcional

El cliente puede crear cuenta con email/password, iniciar sesión, cerrar sesión, recuperar contraseña olvidada, verificar su correo y cambiar su contraseña dentro del perfil. Si su cuenta está bloqueada, suspendida o eliminada, ve un modal explicativo en lugar de poder operar.

### Archivos involucrados

**Frontend:**
- `src/app/core/services/auth.service.ts` (líneas 161-269 + 395-481)
- `src/app/core/interceptors/auth.interceptor.ts`
- `src/app/core/guards/auth.guard.ts`
- `src/app/shared/components/auth-modal/auth-modal.component.ts`
- `src/app/shared/components/blocked-account-modal/blocked-account-modal.component.ts`
- `src/app/shared/components/forgot-password-modal/forgot-password-modal.component.ts`
- `src/app/shared/components/email-not-found-modal/email-not-found-modal.component.ts`
- `src/app/shared/components/email-sent-modal/email-sent-modal.component.ts`
- `src/app/shared/components/verify-email-pending-modal/verify-email-pending-modal.component.ts`
- `src/app/features/reset-password/reset-password.component.ts`
- `src/app/features/verify-email/verify-email.component.ts`
- `src/app/features/profile/change-password-modal/change-password-modal.component.ts`
- `src/environments/environment.ts` (apiUrl)

**Backend:**
- `src/modules/users/routes/auth.routes.ts` (líneas 62-156)
- `src/modules/users/controllers/auth.controller.ts` (métodos `register`, `login`, `logout`, `forgotPassword`, `resetPassword`, `verifyResetToken`, `verifyEmail`, `resendVerification`, `checkEmail`)
- `src/shared/middlewares/rate-limit.middleware.ts`
- `src/shared/middlewares/enforce-email-quota.middleware.ts`

### Endpoints HTTP

```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/forgot-password
GET  /api/auth/reset-password/verify
POST /api/auth/reset-password
POST /api/auth/verify-email
POST /api/auth/resend-verification
POST /api/auth/check-email
GET  /api/users/profile
```

### Estado persistente

| Clave | Storage | Contenido |
|---|---|---|
| `auth_token` | localStorage | JWT cliente |
| `auth_user` | localStorage | User serializado |

### Dependencias hacia otros bloques

- B4 (interceptor + guards aplicados a navegación)
- B5 (limpia carrito al detectar logout)
- B7 (modal de complete-profile post-verify-email)
- B9 (logout llama `unregisterToken()` para FCM)

### Lo que NO debe romperse post-Capacitor

- Web: el flujo entero sigue funcionando idéntico.
- Web: el JWT sigue persistiendo en localStorage.
- Nativo: el JWT migra a `@capacitor/preferences` pero la API pública del `AuthService` mantiene la misma forma (los componentes no notan diferencia).

---

## Bloque 2 — Auth Google y Account Linking

### Scope funcional

El cliente puede entrar con su cuenta Google. Si su email Google colisiona con una cuenta local existente, dispara un flujo de "link account" que pide verificación adicional. Si la cuenta Google es nueva pero falta completar perfil (`profileCompleted: false`), se redirige a `/perfil?completeProfile=true`.

### Archivos involucrados

**Frontend:**
- `src/app/core/services/auth.service.ts` (`loginWithOAuth`, `handleOAuthCallback`, `linkAccount`, `verifyAccountLink`, `openAccountLinkModal`)
- `src/app/features/auth-callback/auth-callback.component.ts`
- `src/app/features/verify-account-link/verify-account-link.component.ts`
- `src/app/shared/components/account-link-pending-modal/account-link-pending-modal.component.ts`
- `src/app/shared/components/complete-profile-modal/complete-profile-modal.component.ts`

**Backend:**
- `src/modules/users/routes/auth.routes.ts` (líneas 85-100, 162-193)
- `src/modules/users/controllers/auth.controller.ts` (`linkAccount`, `verifyAccountLink`, `oauthCallback`)
- `src/config/passport.ts` (estrategia Google completa, 3 ramas)
- `src/config/index.ts` (`oauth.google`, `urls.verifyAccountLink`)

### Endpoints HTTP

```
GET  /api/auth/google                  ← inicia OAuth (Passport)
GET  /api/auth/google/callback         ← callback (Passport → redirect a frontend)
POST /api/auth/link-account            ← caso 3: dispara email de link
POST /api/auth/verify-account-link     ← consume token del email
```

### Estado persistente

| Clave | Storage | Contenido |
|---|---|---|
| `oauth_return_url` | localStorage | URL de retorno guardada antes de redirect a Google |
| `auth_token`, `auth_user` | localStorage | Compartido con B1 |

### Dependencias hacia otros bloques

- B1 (comparte storage de JWT)
- B7 (complete-profile modal vive en perfil)

### Lo que NO debe romperse post-Capacitor

- Web: OAuth con Passport sigue funcionando. Es el flujo predeterminado para usuarios web.
- Nativo: en lugar de `window.location.href` se usa Google Sign-In nativo (Capacitor plugin) que devuelve un `idToken`; este viaja a un endpoint nuevo `POST /api/auth/google/native` que reusa la misma lógica de Passport (extraída a un service compartido) y devuelve JWT.
- Account linking: el endpoint `POST /api/auth/link-account` no cambia. El email link `https://tubusexpress.com/verify-account-link?token=...` debe abrir la app nativa vía deep link (App Links Android) en lugar del navegador.

---

## Bloque 3 — Auth Admin

### Scope funcional

Los administradores tienen un login totalmente separado del cliente: usan **username + password** (no email), ingresan por `/admin/login`, y su sesión vive en claves localStorage distintas (`admin_auth_token`, `admin_auth_user`). Tienen su propio layout (`AdminLayoutComponent`) y guards.

### Archivos involucrados

**Frontend:**
- `src/app/features/admin/login/admin-login.component.ts`
- `src/app/core/guards/admin.guard.ts`
- `src/app/core/services/auth.service.ts` (métodos `handleAdminLogin`, `isAdminContext`, `getStorageKeys`)
- `src/app/layouts/components/admin-layout/admin-layout.component.ts`

**Backend:**
- `src/modules/admin/...` (módulo completo admin — su propio set de routes/controllers/services)
- `src/shared/middlewares/auth.middleware.ts` (verifica JWT igual que cliente, pero gates por `role: 'admin'`)

### Endpoints HTTP

```
POST /api/admin/login
GET  /api/admin/profile
POST /api/admin/device-tokens
DELETE /api/admin/device-tokens/:token
... (todos los endpoints admin del backend)
```

### Estado persistente

| Clave | Storage | Contenido |
|---|---|---|
| `admin_auth_token` | localStorage | JWT admin |
| `admin_auth_user` | localStorage | Admin serializado |

### Dependencias hacia otros bloques

- B5 (sigue limpiando carrito si cambia auth)
- B9 (admin notifications también usan FCM, distinto subject)
- B10 (todo el panel admin depende de este bloque)

### Lo que NO debe romperse post-Capacitor

- **Decisión arquitectural:** Phase A NO incluye admin en la app móvil. La app es solo para clientes. Los admins seguirán entrando vía web.
- Por tanto: este bloque debe quedar **idéntico** post-Capacitor — la lógica admin sigue compilando y funcionando para la web.
- En la app móvil: si un usuario navega manualmente a `/admin`, se le redirige a home (comportamiento actual ya existente).

---

## Bloque 4 — Navegación, Catálogo y Detalle de Producto

### Scope funcional

Routing completo de la app, lazy loading de todas las features, catálogo con filtros (search, vehicle type, brand, category, sort, only-combos), paginación, vehicle filter desde garaje, overlay full-screen para detalle de producto y carrito (manejados por `OverlayStackService` con sincronización History API), preservación de scroll del catálogo al volver de overlay.

### Archivos involucrados

**Frontend:**
- `src/app/app.routes.ts`
- `src/app/app.config.ts` (`provideRouter` con `withInMemoryScrolling({ scrollPositionRestoration: 'disabled' })` + `withNavigationErrorHandler`)
- `src/app/core/services/overlay-stack.service.ts`
- `src/app/core/error-handlers/chunk-load-error.handler.ts`
- `src/app/features/catalog/catalog.component.ts`
- `src/app/features/product-detail/product-detail-page/product-detail-page.component.ts`
- `src/app/shared/components/product-card/product-card.component.ts`
- `src/app/shared/components/search-input/search-input.component.ts`
- `src/app/shared/components/image-carousel/image-carousel.component.ts`
- `src/app/layouts/components/main-layout/main-layout.component.ts`
- `src/app/layouts/components/header/header.component.ts`
- `src/app/layouts/components/footer/footer.component.ts`
- `src/app/layouts/pages/tu-bus-servicio/tu-bus-servicio.component.ts` (landing)
- `src/app/core/services/product.service.ts`
- `src/app/core/services/brand.service.ts`
- `src/app/core/services/category.service.ts`

**Backend:**
- `src/modules/products/...`
- `src/modules/branches/...`
- `src/modules/branch-products/...`

### Endpoints HTTP

```
GET /api/products                     (con muchos query params)
GET /api/products/:id
GET /api/brands
GET /api/categories
GET /api/branch-products?branchIds=...
```

### Estado persistente

Ninguno propio (depende del scroll position que es responsabilidad del `OverlayStackService`).

### Dependencias hacia otros bloques

- B5 (location service condiciona qué productos se muestran)
- B6 (navegación a checkout)
- B7 (vehicle filter desde garaje)

### Lo que NO debe romperse post-Capacitor

- Hardware back: en web sigue siendo el botón Atrás del navegador. En Android se conecta el `App.backButton` listener al `OverlayStackService.goBack()`.
- Scroll preservation: comportamiento idéntico en ambas plataformas.
- Lazy loading: en web sigue cargando chunks vía HTTP. **En Capacitor todos los chunks van empaquetados** — no debería haber `ChunkLoadError`. El handler queda como guard preventivo.

---

## Bloque 5 — Carrito y Estado Persistente Local

### Scope funcional

Carrito de compras con add/remove/update, validación de stock contra backend, sincronización de metadata (vehicleTypes, freeOilChangeService) para items legacy, persistencia en localStorage que sobrevive a recargas, limpieza automática al detectar logout, generación de mensaje WhatsApp con formato factura, opción de checkout vía WhatsApp si está habilitado en settings.

Adicionalmente este bloque agrupa **todo el estado persistente transversal** que no encaja en otros bloques: tema (dark/light), ubicación seleccionada, settings globales cargados al boot, exchange rate, dismissal del PWA install modal, cleanup del oauth_return_url tras callback exitoso.

### Archivos involucrados

**Frontend:**
- `src/app/core/services/cart.service.ts`
- `src/app/core/services/theme.service.ts`
- `src/app/core/services/location.service.ts`
- `src/app/core/services/settings.service.ts`
- `src/app/core/services/exchange-rate.service.ts`
- `src/app/core/services/pwa.service.ts`
- `src/app/features/cart/cart-overlay/cart-overlay.component.ts`
- `src/app/features/cart/cart-redirect/cart-redirect.component.ts` (`/carrito` legacy → catalog + overlay)
- `src/app/features/cart/cart.component.ts` (componente interno del overlay)
- `src/app/shared/components/cart-popover/cart-popover.component.ts`
- `src/app/shared/components/pwa-install-modal/pwa-install-modal.component.ts`
- `src/app/shared/components/pwa-install-button/pwa-install-button.component.ts`
- `src/app/shared/components/pwa-update-banner/pwa-update-banner.component.ts`
- `src/app/shared/components/zoning-modal/zoning-modal.component.ts`

**Backend:**
- `src/modules/settings/...`
- `src/modules/exchange-rate/...`
- `src/modules/branch-zones/...`
- `src/modules/cities/...`

### Endpoints HTTP

```
GET /api/settings
GET /api/exchange-rate/current
GET /api/cities
GET /api/branch-zones/by-location?citySlug=...&municipalitySlug=...
GET /api/branch-zones/delivery-config?citySlug=...&municipalitySlug=...
```

### Estado persistente

| Clave | Storage | Contenido | Plataforma post-Capacitor |
|---|---|---|---|
| `shopping_cart` | localStorage | Items del carrito | localStorage en ambos (no sensible) |
| `e-commerce-theme` | localStorage | `light` o `dark` | localStorage en ambos |
| `user_location` | localStorage | `{citySlug, cityName, municipalitySlug, municipalityName}` | localStorage en ambos |
| `pwa_install_dismissed_at` | localStorage | Timestamp dismissal | localStorage en ambos (irrelevante en nativo) |

### Dependencias hacia otros bloques

- B1 (escucha logout para limpiar carrito)
- B6 (carrito alimenta checkout)

### Lo que NO debe romperse post-Capacitor

- Carrito persiste tras kill app.
- Theme dark/light se respeta.
- Location seleccionada se mantiene.
- En nativo: el PWA install modal NUNCA se muestra (en una APK no aplica). Banner de PWA update tampoco. Pero el código sigue funcionando si por algún error se intenta renderizar.

---

## Bloque 6 — Checkout, Zoning y Pagos

### Scope funcional

Flujo completo de compra: selección de zona/sucursal (zoning modal), elección de tipo de despacho (6 modalidades: store_pickup, shipping_agency, local_delivery, seller_agreement, oil_change_service, in_store_oil_change), formularios específicos por modalidad con datos del destinatario, selección de vehículo del garaje cuando aplica, métodos de pago, **upload de comprobante de pago (input file)**, summary, confirmación con orderId.

### Archivos involucrados

**Frontend:**
- `src/app/features/checkout/services/checkout.service.ts`
- `src/app/features/checkout/checkout-dispatch/checkout-dispatch.component.ts`
- `src/app/features/checkout/checkout-shipping-agency/checkout-shipping-agency.component.ts`
- `src/app/features/checkout/checkout-shipping-form/checkout-shipping-form.component.ts`
- `src/app/features/checkout/checkout-local-delivery-form/checkout-local-delivery-form.component.ts`
- `src/app/features/checkout/checkout-seller-agreement-form/checkout-seller-agreement-form.component.ts`
- `src/app/features/checkout/checkout-oil-change-form/checkout-oil-change-form.component.ts`
- `src/app/features/checkout/checkout-in-store-oil-change-form/checkout-in-store-oil-change-form.component.ts`
- `src/app/features/checkout/checkout-payment-form/checkout-payment-form.component.ts` (input file comprobante)
- `src/app/features/checkout/checkout-summary/checkout-summary.component.ts` (input file también)
- `src/app/features/checkout/checkout-confirmation/checkout-confirmation.component.ts`
- `src/app/features/checkout/components/checkout-header/checkout-header.component.ts`
- `src/app/core/services/order.service.ts`
- `src/app/core/services/payment.service.ts`
- `src/app/core/services/payment-method.service.ts`
- `src/app/core/services/upload.service.ts`
- `src/app/core/services/vehicle.service.ts`
- `src/app/core/services/shipping-agency.service.ts`
- `src/app/shared/components/searchable-select/searchable-select.component.ts`
- `src/app/shared/components/date-input/date-input.component.ts`
- `src/app/shared/components/service-date-picker/service-date-picker.component.ts`

**Backend:**
- `src/modules/orders/...`
- `src/modules/payments/...`
- `src/modules/payment-methods/...` (público)
- `src/modules/upload/...` (proof upload)
- `src/modules/vehicles/...`
- `src/modules/shipping-agencies/...` (rutas públicas)

### Endpoints HTTP

```
POST /api/orders
POST /api/payments
POST /api/upload/image          (proof of payment)
GET  /api/payment-methods
GET  /api/shipping-agencies
GET  /api/vehicles              (del usuario)
GET  /api/cities/.../municipalities
```

### Estado persistente

Ninguno propio. El checkout flow vive en memoria; al completarse navega a `/checkout/confirmacion/:orderId` (autenticated).

### Dependencias hacia otros bloques

- B1 (auth requerida — `authGuard` en `/checkout/confirmacion`)
- B5 (carrito + location)
- B7 (vehículos del garaje, payment history)

### Lo que NO debe romperse post-Capacitor

- Las 4 modalidades adicionales además de store pickup deben seguir disponibles (configurables vía settings).
- El input file del comprobante debe funcionar en web (sin cambios) y en Android (puede usar el `<input type="file">` nativo del WebView O reemplazarse por `@capacitor/camera` para mejor UX).
- Validación del tipo de archivo (image/jpeg, image/png, image/webp, image/gif) y tamaño (5 MB) sigue siendo del backend (`upload.middleware.ts`).
- El zoning modal con la lista de ciudades/municipios sigue intacto. En nativo se añade un botón "Usar mi ubicación" (Phase 5) **adicional**, no reemplaza el flujo manual.

---

## Bloque 7 — Perfil Cliente y Garaje

### Scope funcional

Tabs en `/perfil`: información personal (con edit), garaje (vehículos CRUD), pedidos (lista), pagos (historial), notificaciones. Cambio de contraseña en modal. Modal de "completar perfil" si `profileCompleted=false`. Avatar generado o subido vía `/api/upload/avatar`. Toggle de notificaciones push.

### Archivos involucrados

**Frontend:**
- `src/app/features/profile/profile.component.ts`
- `src/app/features/profile/profile-info/profile-info.component.ts`
- `src/app/features/profile/change-password-modal/change-password-modal.component.ts`
- `src/app/features/profile/components/notifications-list/notifications-list.component.ts`
- `src/app/features/profile/components/payment-history/payment-history.component.ts` (input file aquí también)
- `src/app/features/garage/garage.component.ts`
- `src/app/features/garage/vehicle-form/vehicle-form.component.ts`
- `src/app/features/garage/vehicle-card/vehicle-card.component.ts`
- `src/app/shared/components/complete-profile-modal/complete-profile-modal.component.ts`
- `src/app/shared/components/push-permission-toggle/push-permission-toggle.component.ts`
- `src/app/shared/components/push-unblock-modal/push-unblock-modal.component.ts`
- `src/app/core/services/user.service.ts`
- `src/app/core/services/vehicle.service.ts`

**Backend:**
- `src/modules/users/routes/user.routes.ts`
- `src/modules/vehicles/...`
- `src/modules/payments/...` (historial)
- `src/modules/upload/...` (avatar)

### Endpoints HTTP

```
GET    /api/users/profile
PATCH  /api/users/profile
PATCH  /api/users/profile/password
PATCH  /api/users/profile/notification-preferences
POST   /api/upload/avatar
GET    /api/vehicles
POST   /api/vehicles
PATCH  /api/vehicles/:id
DELETE /api/vehicles/:id
GET    /api/payments/me
```

### Estado persistente

`auth_user` (compartido con B1; se actualiza con `patchCurrentUser`).

### Dependencias hacia otros bloques

- B1 (auth + JWT)
- B6 (vehículos se usan en checkout oil-change)
- B9 (toggle de push enlaza a `UserNotificationService`)

### Lo que NO debe romperse post-Capacitor

- CRUD de vehículos.
- Avatar upload (input file → cámara nativa en Android opcional Phase 5).
- Modal complete-profile dispara correctamente cuando `profileCompleted=false`.
- Toggle de push: en web sigue mostrando estado del browser; en nativo refleja permission del SO.

---

## Bloque 8 — Pedidos, Servicios y Reviews

### Scope funcional

Cliente: lista de sus pedidos con filtros, detalle de pedido con timeline de estados, posibilidad de re-subir comprobante si fue rechazado, modal de cancelación con razón, modal de mensajería con admin (con badge de unread), modal de rating al completarse, tracking en vivo del servicio mecánico (cuando aplica).

Mecánico (PÚBLICO, sin login, vía token URL): página `mechanic/progress/:token` para avanzar pasos del servicio (en_camino → en_proceso → completado).

### Archivos involucrados

**Frontend:**
- `src/app/features/orders/order-list/order-list.component.ts`
- `src/app/features/orders/order-detail/order-detail.component.ts`
- `src/app/features/orders/service-tracking/service-tracking.component.ts`
- `src/app/features/mechanic-progress/mechanic-progress.component.ts`
- `src/app/shared/components/order-comments/order-comments.component.ts`
- `src/app/shared/components/order-messaging-modal/order-messaging-modal.component.ts`
- `src/app/shared/components/rating-modal/rating-modal.component.ts`
- `src/app/shared/components/mechanic-avatar/mechanic-avatar.component.ts`
- `src/app/core/services/order.service.ts` (compartido)
- `src/app/core/services/review.service.ts`
- `src/app/core/services/mechanic-assignment.service.ts`
- `src/app/core/services/upload.service.ts` (re-upload de comprobante)

**Backend:**
- `src/modules/orders/...`
- `src/modules/reviews/...`
- `src/modules/mechanic-assignments/...` (incluye `public.routes.ts`)

### Endpoints HTTP

```
GET   /api/orders
GET   /api/orders/:id
POST  /api/orders/:id/cancel
POST  /api/orders/:id/upload-proof
GET   /api/reviews/by-order/:orderId
POST  /api/reviews
GET   /api/mechanic-assignments/by-order/:orderId
GET   /api/mechanic-progress/:token       (público sin auth)
POST  /api/mechanic-progress/:token/advance
POST  /api/mechanic-progress/:token/reject
```

### Estado persistente

| Clave | Storage | Contenido |
|---|---|---|
| `review-dismissed:<orderId>` | sessionStorage | Flag temporal: usuario cerró el modal de rating |

### Dependencias hacia otros bloques

- B1 (auth)
- B6 (datos del pedido vienen de checkout)
- B9 (push notifications de updates de pedido)

### Lo que NO debe romperse post-Capacitor

- Lista, detalle, cancelación, re-upload, rating, messaging.
- **Mechanic progress es público sin auth** — debe abrir tanto en web como (vía deep link) en la app si el mecánico tiene la app instalada. **Decisión:** dejar que se abra siempre en el navegador (es el comportamiento actual). Mecánicos no son target de la app v1.
- Push de "comentario nuevo" debe disparar refresh del order-detail si está abierto (ya implementado vía `pushReceived$`).

---

## Bloque 9 — Notificaciones Push y Comunicación Externa

### Scope funcional

**Push notifications (FCM):**
- Cliente: toggle en perfil para activar/desactivar push. Token FCM registrado en backend al activar. Pushes se reciben tanto en foreground (con OS toast) como en background (Service Worker dedicado de Firebase). Polling cada 30s/120s como fallback. Badge con count de unread. Popover con últimas 5. Mark as read individual y all.
- Admin: lo mismo pero con su propio subject (`/api/admin/notifications` y `/api/admin/device-tokens`).

**Comunicación externa:**
- WhatsApp: `wa.me/<phone>?text=...` para checkout opcional + soporte cliente.
- Tel: `tel:<phone>` para llamadas directas (popovers de teléfono).
- Redes sociales: Facebook/Instagram/Twitter desde footer.
- Clipboard: copiar links/datos.

### Archivos involucrados

**Frontend:**
- `src/app/core/firebase/firebase.config.ts`
- `src/app/core/firebase/firebase-messaging.service.ts`
- `src/app/core/firebase/push-event.types.ts`
- `src/app/core/services/user-notification.service.ts`
- `src/app/core/services/admin-notifications.service.ts`
- `src/app/core/services/admin-notification.service.ts` (helper distinto)
- `src/app/core/services/device-token.service.ts`
- `src/app/shared/utils/browser-notify.util.ts`
- `src/app/shared/components/push-permission-toggle/push-permission-toggle.component.ts`
- `src/app/shared/components/push-unblock-modal/push-unblock-modal.component.ts`
- `src/app/shared/components/user-notifications-bell/user-notifications-bell.component.ts`
- `src/app/shared/components/user-notification-detail-modal/user-notification-detail-modal.component.ts`
- `src/app/shared/components/admin-notification-detail-modal/admin-notification-detail-modal.component.ts`
- `src/app/shared/components/customer-support-action/customer-support-action.component.ts`
- `src/app/shared/components/phone-action-popover/phone-action-popover.component.ts`
- `src/app/shared/services/clipboard.service.ts`
- `src/app/layouts/components/footer/footer.component.ts` (links redes)
- `src/app/layouts/pages/tu-bus-servicio/components/tubus-contact/tubus-contact.component.ts`
- `src/app/core/services/cart.service.ts:481` (WhatsApp checkout)
- `src/app/features/mechanic-progress/mechanic-progress.component.ts:190,196`

**Backend:**
- `src/modules/user-notifications/...`
- `src/modules/notifications/...` (admin)
- `src/modules/device-tokens/...`
- `src/config/firebase.ts` (Firebase Admin init)

**Public assets:**
- `public/sw.js` (PWA installability + notification click handler)
- `public/firebase-messaging-sw.js` (FCM background handler — auto-generado)
- `scripts/generate-firebase-sw.js`

### Endpoints HTTP

```
GET    /api/user-notifications
GET    /api/user-notifications/unread-count
PATCH  /api/user-notifications/:id/read
PATCH  /api/user-notifications/read-all
GET    /api/user-notifications/by-order/:orderId/unread-count
PATCH  /api/user-notifications/by-order/:orderId/read
POST   /api/device-tokens
DELETE /api/device-tokens/:token
POST   /api/admin/device-tokens
DELETE /api/admin/device-tokens/:token
GET    /api/admin/notifications
... (etc admin)
```

### Estado persistente

Tokens FCM viven en MongoDB (backend). Frontend cachea el token en memoria (`_currentToken` signal).

### Dependencias hacia otros bloques

- B1, B3 (auth lifecycle)
- B7 (UI de toggle push)
- B8 (refresh de order-detail al recibir push)

### Lo que NO debe romperse post-Capacitor

- **Web:** flujo entero idéntico — Firebase web SDK, Service Workers, OS notifications via `Notification` API.
- **Nativo (Android):** se reemplaza el FCM web por `@capacitor-firebase/messaging`. El backend recibe el token igual (campo `platform` cambia a `'android'`). El token se enrutará vía Firebase Admin igual que antes.
- WhatsApp / tel: en web sigue siendo `window.open(...)`. En nativo se usa `App.openUrl({ url })` que delega al SO.
- Clipboard: en web `navigator.clipboard`. En nativo: `@capacitor/clipboard`.

---

## Bloque 10 — Admin Panel Operacional

### Scope funcional

CRUDs administrativos completos:
- **Administradores**, **Usuarios** (lista + detalle), **Productos**, **Líneas**, **Categorías**, **Marcas**, **Mecánicos** (lista + form + detail + calendar), **Sucursales**, **Zonas**, **Agencias de Envío**, **Métodos de Pago**.
- **Pedidos admin:** lista con filtros, detalle, modal de despacho con asignación de mecánico, slot suggestions.
- **Reviews admin.**
- **Settings admin** (todos los settings: WhatsApp, carruseles, hero, paginación, despacho, exchange rate, support contact, customer support, admin notifications).

Cada CRUD que maneja imágenes usa `<input type="file">`.

### Archivos involucrados

**Frontend (estructura completa de `src/app/features/admin/`):**
- `dashboard/admin-dashboard.component.ts`
- `administrators/{admin-list,admin-form}/...`
- `users/{user-list,user-detail}/...`
- `products/{product-list,product-form,branch-stock-modal}/...`
- `lines/{line-list,line-form}/...`
- `categories/{category-list,category-form}/...`
- `brands/{brand-list,brand-form}/...`
- `mechanics/{mechanic-list,mechanic-form,mechanic-detail,mechanic-calendar}/...`
- `branches/{branch-list,branch-form}/...`
- `zones/{zone-list,zone-form}/...`
- `shipping-agencies/{shipping-agency-list,shipping-agency-form}/...`
- `payment-methods/{payment-method-list,payment-method-form}/...`
- `orders/{order-list,order-detail,order-dispatch-modal,slots-suggestions}/...`
- `reviews/review-list/...`
- `settings/settings.component.ts`
- `payments/...`
- `src/app/core/services/admin.service.ts`
- `src/app/core/services/admin-user.service.ts`
- `src/app/core/services/branch.service.ts`
- `src/app/core/services/branch-availability.service.ts`
- `src/app/core/services/branch-product.service.ts`
- `src/app/core/services/branch-zone.service.ts`
- `src/app/core/services/zone.service.ts`
- `src/app/core/services/city.service.ts`
- `src/app/core/services/line.service.ts`
- `src/app/core/services/category.service.ts` (admin uses too)
- `src/app/core/services/brand.service.ts`
- `src/app/core/services/mechanic.service.ts`
- `src/app/core/services/shipping-agency.service.ts`
- `src/app/core/services/payment-method.service.ts`
- `src/app/core/services/review.service.ts`

**Backend:**
- `src/modules/admin/...` (estructura completa)
- Todos los endpoints `/api/admin/*`

### Endpoints HTTP

Cientos. Principales prefijos:
```
/api/admin/users/...
/api/admin/products/...
/api/admin/lines/...
/api/admin/categories/...
/api/admin/brands/...
/api/admin/mechanics/...
/api/admin/branches/...
/api/admin/zones/...
/api/admin/shipping-agencies/...
/api/admin/payment-methods/...
/api/admin/orders/...
/api/admin/reviews/...
/api/admin/settings/...
/api/admin/dashboard/...
/api/upload/products
/api/upload/image
```

### Estado persistente

Compartido con B3 (admin auth tokens).

### Dependencias hacia otros bloques

- B3 (auth admin)
- B9 (notificaciones admin)

### Lo que NO debe romperse post-Capacitor

- **Decisión:** este bloque NO entra en la app móvil v1. Todos los componentes y endpoints siguen funcionando exactamente igual para la web.
- En la app móvil: las rutas `/admin/*` están bloqueadas por `adminGuard` que redirige a `/admin/login` y luego, al no tener sesión admin, redirige a home.
- Cero cambios de código en este bloque por la implementación Capacitor.

---

## Resumen Tabular: Cambios por Bloque

| Bloque | Cambios web | Cambios nativo | Cambios backend |
|---|---|---|---|
| B1 Auth Cliente Local | Storage abstraction (transparente) | JWT en `Preferences` | Cero |
| B2 Auth Google + Link | Cero | Plugin Google nativo + nuevo flujo | Endpoint `POST /api/auth/google/native` (aditivo) |
| B3 Auth Admin | Cero | Cero (admin no entra en app v1) | Cero |
| B4 Navegación / Catálogo | Cero | `App.backButton` listener | Cero |
| B5 Carrito y estado local | Cero | localStorage funciona; PWA modal NO se muestra | Cero |
| B6 Checkout / Pagos | Cero | Opcional: cámara nativa para proof | Cero (Phase A); permisos en backend para Phase 5 features |
| B7 Perfil / Garaje | Cero | Opcional: cámara nativa para avatar | Cero |
| B8 Pedidos / Servicios | Cero | Mechanic-progress sigue abriendo en navegador | Cero |
| B9 Notificaciones / Comm | Cero | FCM nativo, `App.openUrl` para WhatsApp/tel, `Browser.open` para social | `platform` field puede ser `android` (ya soportado) |
| B10 Admin Panel | Cero | Cero (admin no entra en app v1) | Cero |

**Total cambios web:** 0 funcionales (solo refactor interno transparente del storage en B1, gateado por `Capacitor.isNativePlatform()`).
**Total cambios backend:** 1 endpoint nuevo + 1 env var ampliada.

---

## Convención para los Tests Baseline

Cada bloque será evaluado en `02-block-baseline-tests.md` con la siguiente estructura:

1. **Inventario funcional:** lista de "what does it do" verificable en código.
2. **Trazas end-to-end:** happy path y edge cases analizados línea por línea.
3. **Riesgos identificados pre-Capacitor:** lo que YA es frágil hoy y debe vigilarse.
4. **Acceptance criteria post-Capacitor:** la lista exacta de verificaciones que se ejecutan tras implementar Capacitor para confirmar cero regresión.

Esos acceptance criteria son los que se ejecutarán **dos veces**: una **ahora** (mentalmente / leyendo código, porque este es modo READ-ONLY) y una **después** de Phase 7 (funcionalmente, click por click en QA).

---

## Próximo documento

[`02-block-baseline-tests.md`](./02-block-baseline-tests.md) — análisis baseline de cada uno de los 10 bloques.
