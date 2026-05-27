# 13 — Phase 6.5: Fixes Post-QA (Android 15+ + Bidirectional Auth + Admin Agnostic)

> **Status:** ✅ CERRADA (2026-05-20)
> **Tipo:** Hardening + 1 feature nuevo
> **Trigger:** validación funcional en un **segundo dispositivo distinto al POCO X4 Pro 5G** reveló bugs latentes que Phase 6 no capturó (Android 13 vs Android 15+ edge-to-edge enforcement)
> **Entry criteria:** Phase 6 cerrada + autorización del owner para resolver bugs descubiertos
> **Exit criteria:** los 9 bugs encontrados resueltos + 1 feature (bidirectional Google linking) implementado + smoke test web sin regresión
> **Lectura previa:** `00-master-plan.md`, `12-phase-6-qa.md`, `05-decisions-log.md`

---

## Resumen ejecutivo

La Phase 6 cerró con el POCO X4 Pro 5G (Android 13, Tier B) validando los flujos críticos. Al distribuir el APK a otros dispositivos **Android 15/16 (edge-to-edge enforcement obligatorio)** afloraron 9 bugs interrelacionados que se agrupan en **3 familias**:

| Familia | Bugs | Causa raíz común |
|---|---|---|
| **A — Safe-area / Edge-to-edge** | 6 | El CSS del proyecto fue diseñado antes de que `targetSdk=36` forzara edge-to-edge. Cero uso de `env(safe-area-inset-*)` en el layout global. |
| **B — Auth Google nativo** | 3 | Tres puntos del flujo de autenticación Google nativo silenciaban errores o dejaban sesiones residuales. |
| **C — Admin agnóstico** | 2 (mejora UX) | `ThemeService` aplicaba `prefers-color-scheme` globalmente; el admin debería ser independiente. |

Adicionalmente se implementó **1 feature nuevo**: bidirectional Google account linking (`POST /api/auth/link-google-with-password`).

**Total: 39 archivos modificados** (32 frontend + 3 backend + 1 modal nuevo + 3 docs).

---

## Familia A — Bugs de Edge-to-Edge Android 15+

### A.1 — Desbordamiento de status bar y gesture bar en landing

**Síntoma reportado:** *"hay un desbordamiento en la parte superior e inferior, la aplicación debe funcionar en todos los dispositivos por igual"* — captura mostraba los iconos del SO superpuestos al hero "Cambia el aceite..." y el bloque negro inferior cortado por la gesture bar.

**Investigación deep-debug:**

1. [`variables.gradle`](frontend/android/variables.gradle) declara `targetSdkVersion = 36`. **Desde Android 15 (API 35)**, Google obliga edge-to-edge para apps con `targetSdk >= 35`: el SO ignora `Window.setDecorFitsSystemWindows(true)` y el flag `StatusBar.overlaysWebView: false` del plugin Capacitor también es silenciosamente descartado.
2. El POCO corre Android 13 (API 33) — en esa versión edge-to-edge NO es obligatorio. El comportamiento `overlaysWebView: false` SÍ se respeta, por eso el bug nunca apareció en el dispositivo de QA original.
3. El CSS del proyecto NO usa `env(safe-area-inset-*)` en el layout global. Solo 4 componentes específicos (cart-popover, order-messaging-modal, user-notifications-bell, user-notification-detail-modal) lo usan.

**Causa raíz:** edge-to-edge forzado por API 35+ + ausencia de safe-area-insets en el layout global.

**Solución estructural (5 archivos):**

| Archivo | Cambio |
|---|---|
| [`styles.scss`](frontend/src/styles.scss) | Añade 4 variables CSS: `--safe-area-top/bottom/left/right` que envuelven `env(safe-area-inset-*)` con fallback `0px`. Una sola fuente de verdad para todo el proyecto. |
| [`header-shell.component.scss`](frontend/src/app/shared/components/header-shell/header-shell.component.scss) | `:host` crece a `calc(--app-header-height + --safe-area-top)` con `padding-top: --safe-area-top`. El `background-color` del header cubre la zona del status bar, eliminando la franja transparente. |
| [`main-layout.component.scss`](frontend/src/app/layouts/components/main-layout/main-layout.component.scss) | `.main-content` reserva `header + safe-area-top` arriba; `.main-layout` añade `padding-bottom: --safe-area-bottom`. |
| [`tu-bus-servicio.component.scss`](frontend/src/app/layouts/pages/tu-bus-servicio/tu-bus-servicio.component.scss) | Mismo patrón aplicado a la landing. |
| [`splash.service.ts`](frontend/src/app/platform/splash/splash.service.ts) | Inyecta `ThemeService`. Un `effect()` aplica `Style.Light/Dark` al status bar según el tema actual. Elimina `setBackgroundColor` (no-op en API 35+). |

**Validación post-fix:** Initial bundle transfer +6.55 kB vs baseline Phase 0 (180.79 kB → 187.34 kB). Dentro del límite contractual de 30 kB.

---

### A.2 — Botón scroll-to-top desbordado, footer pegado al SO

**Síntoma reportado:** botón flotante "↑" cortado por la gesture/nav bar; texto del footer pegado a los 3 botones del SO.

**Causa raíz:**
- `position: fixed; bottom: 1.5rem` ancla al borde físico del viewport, no al área segura.
- `padding-bottom: var(--safe-area-bottom)` resuelve a `0px` en dispositivos sin edge-to-edge → footer sin respiración mínima.

**Solución (5 archivos):**

| Archivo | Cambio |
|---|---|
| [`tu-bus-servicio.component.scss`](frontend/src/app/layouts/pages/tu-bus-servicio/tu-bus-servicio.component.scss) | `bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px))` + `padding-bottom: max(1rem, env(...))` |
| [`catalog.component.scss`](frontend/src/app/features/catalog/catalog.component.scss) | Mismo `bottom` para el segundo `.scroll-top-btn` que vive en el catálogo |
| [`main-layout.component.scss`](frontend/src/app/layouts/components/main-layout/main-layout.component.scss) | `padding-bottom: max(1rem, env(...))` — piso mínimo de 16px |
| [`toast-container.component.ts`](frontend/src/app/shared/components/toast-container/toast-container.component.ts) | `top: calc(--app-header-height + --safe-area-top + 1rem)` para que los toasts no queden bajo el header expandido |

**Bug colateral encontrado durante el build:** el comentario interno del `toast-container.component.ts` contenía un backtick (`` `--safe-area-top` ``) dentro del template literal externo de `styles: [\` ... \`]`, lo que cerraba prematuramente el template y rompía la compilación AOT con `Code: 1010, Failed to resolve styles at position 0`. Reemplazado por texto plano.

---

### A.3 — Cart overlay y product-detail con header/footer pegados al SO

**Síntoma reportado:** en el cart overlay, el botón "Seguir comprando" cortado por la nav bar; "Productos en tu carrito" recortado por arriba. En product-detail similar.

**Causa raíz:** ambos overlays usan `position: fixed; inset: 0` con `padding-top: var(--app-header-height)` que **no incluye `--safe-area-top`**. Y sin `padding-bottom` alguno.

**Solución (2 archivos):**

| Archivo | Cambio |
|---|---|
| [`cart-overlay.component.scss`](frontend/src/app/features/cart/cart-overlay/cart-overlay.component.scss) | `padding-top: calc(--app-header-height + --safe-area-top)` + `padding-bottom: max(1rem, env(...))` |
| [`product-detail-page.component.scss`](frontend/src/app/features/product-detail/product-detail-page/product-detail-page.component.scss) | Mismo patrón |

---

### A.4 — Análisis profundo: 23 archivos con el mismo bug

**Síntoma reportado:** *"realiza un análisis completo en busca de estos casos, partiendo de los que te muestro, que sea un análisis profundo y meticuloso para evitar perder mas tiempo en este mismo problema"*. El usuario envió 6 capturas con header de checkout, modal de pago y "Tipo de Despacho" todos pegados al status bar / nav bar.

**Investigación:** búsqueda sistemática vía `grep` por:
- `position:\s*(fixed|sticky)` → 15 archivos
- `padding-top:.*--app-header-height` (sin `+ --safe-area-top`) → 9 archivos
- `@apply fixed inset-0` (Tailwind utility) → 11 modales sin safe-area

**Causa raíz común:** todo el código se diseñó para web tradicional (browser empuja contenido al área segura automáticamente). Capacitor con `viewport-fit=cover` traslada esa responsabilidad al CSS.

**Solución masiva — 23 archivos en 3 sub-familias:**

#### A.4.A — Pantallas de checkout (9 archivos)

Patrón uniforme:
```scss
padding-top: calc(var(--app-header-height) + var(--safe-area-top));
padding-bottom: max(1rem, env(safe-area-inset-bottom, 0px));
```

Archivos modificados:
1. [`checkout-dispatch.component.scss`](frontend/src/app/features/checkout/checkout-dispatch/checkout-dispatch.component.scss)
2. [`checkout-payment-form.component.scss`](frontend/src/app/features/checkout/checkout-payment-form/checkout-payment-form.component.scss)
3. [`checkout-in-store-oil-change-form.component.scss`](frontend/src/app/features/checkout/checkout-in-store-oil-change-form/checkout-in-store-oil-change-form.component.scss)
4. [`checkout-local-delivery-form.component.scss`](frontend/src/app/features/checkout/checkout-local-delivery-form/checkout-local-delivery-form.component.scss)
5. [`checkout-oil-change-form.component.scss`](frontend/src/app/features/checkout/checkout-oil-change-form/checkout-oil-change-form.component.scss)
6. [`checkout-shipping-agency.component.scss`](frontend/src/app/features/checkout/checkout-shipping-agency/checkout-shipping-agency.component.scss)
7. [`checkout-shipping-form.component.scss`](frontend/src/app/features/checkout/checkout-shipping-form/checkout-shipping-form.component.scss)
8. [`checkout-seller-agreement-form.component.scss`](frontend/src/app/features/checkout/checkout-seller-agreement-form/checkout-seller-agreement-form.component.scss)
9. [`checkout-summary/styles/_layout.scss`](frontend/src/app/features/checkout/checkout-summary/styles/_layout.scss)

#### A.4.B — Modal de Pago Móvil/Tarjeta (1 archivo desktop + 1 mobile breakpoint)

| Archivo | Cambio |
|---|---|
| [`_modal-payment.scss`](frontend/src/app/features/checkout/checkout-summary/styles/_modal-payment.scss) | `.modal-overlay` padding cambia de `1rem` plano a `max(1rem, env(safe-area-inset-*))` en los 4 lados |

**Bug derivado descubierto en testing posterior:** el media query `@media (max-width: 639px)` en [`_responsive.scss`](frontend/src/app/features/checkout/checkout-summary/styles/_responsive.scss) **sobrescribía mi fix** con `padding: 0` + `max-height: 100vh`. En móvil el modal se renderiza fullscreen y mi padding nunca aplicaba.

Fix adicional en el breakpoint mobile:
```scss
@media (max-width: 639px) {
  .modal-overlay {
    padding: env(safe-area-inset-top, 0px)
             env(safe-area-inset-right, 0px)
             env(safe-area-inset-bottom, 0px)
             env(safe-area-inset-left, 0px);
    align-items: stretch;
  }
  .modal-container {
    max-height: calc(100vh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
  }
}
```

**Por qué `env()` sin `max(1rem,...)` floor en mobile:** el modal es fullscreen por diseño — queremos que ocupe TODO el espacio menos los safe-areas, no que tenga padding extra de 1rem.

Mismo patrón aplicado a [`_confirm-modal.scss`](frontend/src/app/features/checkout/checkout-summary/styles/_confirm-modal.scss) (modal de confirmación de orden).

#### A.4.C — Modales con `fixed inset-0` sin safe-area (13 archivos)

Patrón uniforme (sobrescribir el `p-4` de Tailwind con padding safe-area-aware):
```scss
padding: max(1rem, env(safe-area-inset-top, 0px))
         max(1rem, env(safe-area-inset-right, 0px))
         max(1rem, env(safe-area-inset-bottom, 0px))
         max(1rem, env(safe-area-inset-left, 0px));
```

Archivos modificados:
1. [`account-link-pending-modal.component.scss`](frontend/src/app/shared/components/account-link-pending-modal/account-link-pending-modal.component.scss)
2. [`admin-notification-detail-modal.component.scss`](frontend/src/app/shared/components/admin-notification-detail-modal/admin-notification-detail-modal.component.scss)
3. [`auth-modal.component.scss`](frontend/src/app/shared/components/auth-modal/auth-modal.component.scss)
4. [`blocked-account-modal.component.scss`](frontend/src/app/shared/components/blocked-account-modal/blocked-account-modal.component.scss)
5. [`complete-profile-modal.component.scss`](frontend/src/app/shared/components/complete-profile-modal/complete-profile-modal.component.scss)
6. [`email-not-found-modal.component.scss`](frontend/src/app/shared/components/email-not-found-modal/email-not-found-modal.component.scss)
7. [`email-sent-modal.component.scss`](frontend/src/app/shared/components/email-sent-modal/email-sent-modal.component.scss)
8. [`forgot-password-modal.component.scss`](frontend/src/app/shared/components/forgot-password-modal/forgot-password-modal.component.scss)
9. [`rating-modal.component.scss`](frontend/src/app/shared/components/rating-modal/rating-modal.component.scss)
10. [`verify-email-pending-modal.component.scss`](frontend/src/app/shared/components/verify-email-pending-modal/verify-email-pending-modal.component.scss)
11. [`zoning-modal.component.scss`](frontend/src/app/shared/components/zoning-modal/zoning-modal.component.scss)
12. [`push-unblock-modal.component.ts`](frontend/src/app/shared/components/push-unblock-modal/push-unblock-modal.component.ts) (estilos inline)
13. [`date-picker-panel.component.ts`](frontend/src/app/shared/components/date-input/date-picker-panel.component.ts) — ajuste de `max-height: calc(100vh - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom))`

---

## Familia B — Bugs del Auth Google nativo

### B.1 — Plugin nativo falla silenciosamente

**Síntoma reportado:** *"cuando intento ingresar por Google no paso nada, ni me mostro un mensaje de error o algo"*.

**Causa raíz:** el `catch (err)` en `signInWithGoogleNative()` ([auth.service.ts](frontend/src/app/core/services/auth.service.ts)) trataba CUALQUIER excepción como cancelación intencional del usuario:
```typescript
} catch (err) {
  // User cancelled the picker, or plugin failure. No-op silently —
  // surfacing a toast for an intentional dismissal is annoying.
  console.warn(...);
  return;
}
```

Resultado: el plugin podía fallar por GMS no disponible, audience mismatch, network error — todo silenciado.

**Solución (Nivel 1):** distinguir cancelación intencional vs fallo real usando códigos canónicos:

```typescript
const errCode = String((err as { code?: unknown } | null)?.code ?? '').toLowerCase();
const errMsg = String((err as { message?: unknown } | null)?.message ?? err ?? '');
const isUserCancelled =
  errCode === '12501' ||                  // Google Sign-In SIGN_IN_CANCELLED
  /cancel/i.test(errMsg) ||
  /dismiss/i.test(errMsg);

if (isUserCancelled) return;

this.toast.error(
  `No se pudo iniciar sesión con Google. Detalle: ${errMsg || 'Error desconocido'}`,
  8000,
);
```

Modificación adicional: el `subscribe.error` del HTTP exchange ahora también dispara toast en cualquier error que no sea `BLOCK_CODES`.

**Archivos modificados:**
- [`auth.service.ts`](frontend/src/app/core/services/auth.service.ts) — añade `inject(ToastService)`, modifica los dos catch.

---

### B.2 — Cuenta local existente bloquea login Google sin ofrecer alternativa

**Síntoma reportado:** *"tengo una cuenta que fue registrada con correo y contraseña, pero yo quiero que también esté registrada a través de google para tener un doble tipo de login y no me esta dejando"*.

**Causa raíz (doble):**

1. El backend `userService.findOrCreateFromGoogleProfile` correctamente lanza `AppError 409 { code: 'EMAIL_ALREADY_REGISTERED_LOCAL' }` cuando el email Google coincide con cuenta local sin `googleId` — esto es una **barrera de seguridad documentada** (`user.service.ts:337`: *"closes the silent-linking hijack vector"*). Sin esta barrera, cualquiera podría linkear su Google a una cuenta ajena conociendo solo el email.

2. El frontend nativo `signInWithGoogleNative` no manejaba el código `EMAIL_ALREADY_REGISTERED_LOCAL` específicamente:
   - `catchError` → `triggerAccountBlocked` solo maneja `ACCOUNT_BLOCKED|SUSPENDED|DELETED|NOT_FOUND`.
   - `subscribe.error` solo hacía `console.warn` + apagar spinner.

3. **No existía un endpoint** para el flujo simétrico Google → local link. El backend tenía `/link-account` para Google→añadir-password (Caso 3) pero nada para local-cuenta→añadir-Google.

**Solución (Nivel 2 — feature nuevo: bidirectional Google linking):**

#### Backend (3 archivos)

| Archivo | Cambio |
|---|---|
| [`user.service.ts`](backend/src/modules/users/services/user.service.ts) | Nuevo método `linkGoogleToLocalAccount(payload, password)`: valida email + password + idempotencia (rechaza si ya está linkado o si la cuenta no tiene password local). Lookup usa `.select('+password')` porque el schema declara `password` con `select: false`. |
| [`auth.controller.ts`](backend/src/modules/users/controllers/auth.controller.ts) | Refactor: extracción del helper privado `verifyGoogleIdToken(idToken)` reutilizado por `googleNative` y `linkGoogleWithPassword`. Nuevo método `linkGoogleWithPassword(req, res, next)`. |
| [`auth.routes.ts`](backend/src/modules/users/routes/auth.routes.ts) | Nueva ruta `POST /api/auth/link-google-with-password` con `loginRateLimit` + body validators. |

#### Frontend (3 archivos + 1 modal nuevo)

| Archivo | Cambio |
|---|---|
| [`auth.service.ts`](frontend/src/app/core/services/auth.service.ts) | Signals: `linkGooglePendingSignal` (idToken staged) + `linkGoogleModalOpen` (computed). Métodos: `openLinkGoogleModal(idToken)` (también cierra auth-modal), `closeLinkGoogleModal()`, `linkGoogleWithPassword(password): Observable<AuthResponse>`. Modificado el `subscribe.error`: si código === `EMAIL_ALREADY_REGISTERED_LOCAL` → `openLinkGoogleModal(idToken)`. |
| `link-google-password-modal.component.{ts,html,scss}` | **NUEVO** modal: input de password + botón "Vincular cuenta". Mapea códigos `INVALID_PASSWORD`, `GOOGLE_ALREADY_LINKED`, `ACCOUNT_HAS_NO_PASSWORD`, `ACCOUNT_NOT_FOUND` a mensajes específicos. |
| [`app.ts`](frontend/src/app/app.ts) | Import + registro del nuevo modal en imports[]. |
| [`app.html`](frontend/src/app/app.html) | `<app-link-google-password-modal />` self-hosted (sin inputs/outputs, su visibilidad lee `authService.linkGoogleModalOpen()`). |

#### Decisión arquitectural

**Opción 2B — verificación por password (elegida) vs Opción 2A — verificación por email:**

| Criterio | 2B (password) | 2A (email) |
|---|---|---|
| Seguridad | ✅ Igual (requiere conocer password) | ✅ Igual (requiere acceso a email) |
| UX | ✅ Inmediato (1 paso) | ❌ Email back-and-forth (3 pasos) |
| Esfuerzo | Medio | Alto (templates email + token TTL + reset retries) |
| Reutiliza código | bcrypt del login local | AccountLinkToken pero invertido |

#### Bug colateral 1: false-positive ACCOUNT_HAS_NO_PASSWORD

Tras deployar el backend, el modal mostraba *"Esta cuenta no tiene contraseña"* incluso para cuentas con password.

**Causa raíz:** `User.findOne({ email })` retornaba `user.password` como `undefined` porque el schema declara el campo con `select: false`. El guard `if (!user.password)` se disparaba como falso positivo.

**Fix:** añadir `.select('+password')` al lookup. Mismo patrón usado en otros ~13 lookups del backend.

#### Bug colateral 2: auth-modal permanecía visible detrás del link-modal

**Causa raíz:** `openLinkGoogleModal()` solo seteaba `linkGooglePendingSignal` pero no cerraba el `authModalOpenSignal`.

**Fix:** `openLinkGoogleModal()` ahora invoca `closeAuthModal()` también — mismo patrón que `onAccountLinkPending` en [app.ts:106-111](frontend/src/app/app.ts) usa para sus modales hermanos.

---

### B.3 — "No credentials available" tras logout y re-intento de login Google

**Síntoma reportado:** *"despes que ya ingrese una ves y luego le doy logout y luego vuelvo a intentar ingresar con google sucede esto, como si el logout no hubiera limpiado bien la secion"*. Toast: `"No se pudo iniciar sesión con Google. Detalle: No credentials available"`.

**Causa raíz:** `performLogoutAsync()` ([auth.service.ts](frontend/src/app/core/services/auth.service.ts)) limpiaba:
- FCM token
- JWT en Preferences
- `currentUserSignal`
- Backend `/logout`

**Pero NUNCA invocaba `googleAuth.signOut()`.** El SDK de Firebase Authentication en Android mantiene un `FirebaseAuth.currentUser` independiente del JWT del backend. Sin limpiarlo:

1. Primer login: Credential Manager muestra selector → SDK Firebase Auth queda con `currentUser` activo.
2. Logout (incompleto): JWT borrado, pero Firebase Auth conserva la sesión.
3. Segundo login: `FirebaseAuthentication.signInWithGoogle()` → Credential Manager detecta sesión Firebase activa → `NoCredentialException("No credentials available")` porque su contrato es "no entrego credenciales nuevas cuando ya hay una sesión activa".

La interface `IGoogleAuth.signOut()` ya existía y estaba implementada en `NativeGoogleAuthStrategy` — solo nadie la invocaba.

**Fix (frontend, 1 archivo):**

```typescript
// auth.service.ts
private async signOutGoogleSilent(): Promise<void> {
  try {
    await this.googleAuth.signOut();
  } catch {
    /* silent — Google sign-out failure must not block app logout */
  }
}

// performLogoutAsync:
await Promise.race([
  Promise.allSettled([
    this.unregisterFcmTokenSilent(isAdmin),
    this.signOutGoogleSilent(),    // ← NUEVO
  ]),
  new Promise<void>((resolve) => setTimeout(resolve, 1500)),
]);
```

**Decisión:** llamar `signOut()` SIEMPRE, no condicional según si el user vino de Google. La strategy web es no-op; en nativo llamar `FirebaseAuthentication.signOut()` cuando no hay sesión Firebase activa es seguro (el plugin lo trata como no-op).

---

## Familia C — Admin agnóstico al cliente

### C.1 — Admin se ve oscuro en primer boot si el SO está en oscuro

**Síntoma reportado:** *"porqué el admin quedó modo oscuro si siempre ha sido claro?"*.

**Causa raíz:** `ThemeService` era global y aplicaba `prefers-color-scheme: dark` del SO al primer boot. El admin layout SÍ tenía clases `dark:*` (siempre soportó dark mode visualmente), pero nadie las activaba en producción web porque el navegador del usuario probablemente estaba en light. En el nuevo dispositivo Android (en modo oscuro a nivel SO), el cliente Y el admin se montaron en dark.

**Decisión arquitectural:** *"el admin es agnóstico al cliente"*.

**Solución (3 archivos + nuevo token):**

#### Refactor de ThemeService

| Antes | Ahora |
|---|---|
| Un solo `theme` signal | `clientThemeSignal` + `adminThemeSignal` separados |
| Un solo storage key `e-commerce-theme` | `e-commerce-theme` (cliente) + `admin-theme` (admin, NUEVO) |
| `prefers-color-scheme` se respeta siempre | Solo el cliente respeta `prefers-color-scheme`; **admin default `light` SIEMPRE** |
| `theme()` retorna el global | `theme()` computed devuelve el del contexto activo |

```typescript
private computeIsAdmin(): boolean {
  if (!this.isBrowser) return false;
  return window.location.pathname.startsWith('/admin');
}
```

Detección de contexto via `Router.events.filter(NavigationEnd)` para re-evaluar al navegar. `applyTheme()` persiste bajo la key del contexto activo.

#### Theme toggle añadido al header admin

| Archivo | Cambio |
|---|---|
| [`theme.service.ts`](frontend/src/app/core/services/theme.service.ts) | Refactor completo (descrito arriba) |
| [`admin-layout.component.ts`](frontend/src/app/layouts/components/admin-layout/admin-layout.component.ts) | Import + registro de `ThemeToggleComponent` |
| [`admin-layout.component.html`](frontend/src/app/layouts/components/admin-layout/admin-layout.component.html) | `<app-theme-toggle>` añadido al inicio de `.header-right` |

---

### C.2 — Logo del admin invisible en dark mode

**Síntoma reportado:** *"en esta sección del admin el icono ese no se ve, cámbialo por el icono del proyecto, el que esta en el cliente"*.

**Causa raíz:** el sidebar header del admin usaba un SVG flat de escudo con `stroke="currentColor"`. En dark mode el sidebar bg pasa a `#1f2937` y el `currentColor` se queda casi negro → invisible.

**Solución (2 archivos):**

| Archivo | Cambio |
|---|---|
| [`admin-layout.component.html`](frontend/src/app/layouts/components/admin-layout/admin-layout.component.html) | SVG → `<img src="assets/icons/autobus.png" alt="TuBus Express" class="logo-img" />` — mismo asset que el header del cliente, PNG con transparencia (independiente del tema) |
| [`admin-layout.component.scss`](frontend/src/app/layouts/components/admin-layout/admin-layout.component.scss) | `.logo .logo-img { @apply w-10 h-10 object-contain; }` — preserva el tamaño 40×40 del SVG previo, sin cambios al layout (gap, padding, altura del header) |

---

## Inventario consolidado de archivos modificados

### Backend (3 archivos)

```
backend/src/modules/users/services/user.service.ts     | +90 líneas (linkGoogleToLocalAccount + .select('+password'))
backend/src/modules/users/controllers/auth.controller.ts | +135 / -50 (helper verifyGoogleIdToken + linkGoogleWithPassword + refactor)
backend/src/modules/users/routes/auth.routes.ts        | +23 (POST /link-google-with-password)
```

### Frontend modificados (32 archivos)

**Layout y servicios core:**
```
src/styles.scss                                                                          | vars --safe-area-*
src/app/core/services/auth.service.ts                                                    | toasts + bidir linking + Google signOut
src/app/core/services/theme.service.ts                                                   | refactor contexto-aware
src/app/platform/splash/splash.service.ts                                                | effect ThemeService → StatusBar
src/app/app.ts                                                                           | registro link-google modal
src/app/app.html                                                                         | render del modal
```

**Headers y overlays:**
```
src/app/shared/components/header-shell/header-shell.component.scss                       | +safe-area-top
src/app/shared/components/toast-container/toast-container.component.ts                   | +safe-area-top en top
src/app/layouts/components/main-layout/main-layout.component.scss                        | +safe-area-top/bottom
src/app/layouts/pages/tu-bus-servicio/tu-bus-servicio.component.scss                     | +safe-area-top/bottom + scroll-top fix
src/app/layouts/components/admin-layout/admin-layout.component.ts                        | +theme-toggle import
src/app/layouts/components/admin-layout/admin-layout.component.html                      | +theme-toggle + logo img
src/app/layouts/components/admin-layout/admin-layout.component.scss                      | +.logo-img sizing
src/app/features/catalog/catalog.component.scss                                          | scroll-top con safe-area
src/app/features/cart/cart-overlay/cart-overlay.component.scss                           | +safe-area top/bottom
src/app/features/product-detail/product-detail-page/product-detail-page.component.scss   | +safe-area top/bottom
```

**Checkout (9 pantallas + 3 modales):**
```
src/app/features/checkout/checkout-dispatch/checkout-dispatch.component.scss
src/app/features/checkout/checkout-payment-form/checkout-payment-form.component.scss
src/app/features/checkout/checkout-in-store-oil-change-form/checkout-in-store-oil-change-form.component.scss
src/app/features/checkout/checkout-local-delivery-form/checkout-local-delivery-form.component.scss
src/app/features/checkout/checkout-oil-change-form/checkout-oil-change-form.component.scss
src/app/features/checkout/checkout-shipping-agency/checkout-shipping-agency.component.scss
src/app/features/checkout/checkout-shipping-form/checkout-shipping-form.component.scss
src/app/features/checkout/checkout-seller-agreement-form/checkout-seller-agreement-form.component.scss
src/app/features/checkout/checkout-summary/styles/_layout.scss
src/app/features/checkout/checkout-summary/styles/_modal-payment.scss
src/app/features/checkout/checkout-summary/styles/_responsive.scss        | breakpoint mobile fullscreen + safe-area
src/app/features/checkout/checkout-summary/styles/_confirm-modal.scss     | breakpoint mobile fullscreen + safe-area
```

**Modales shared (11 archivos):**
```
src/app/shared/components/account-link-pending-modal/account-link-pending-modal.component.scss
src/app/shared/components/admin-notification-detail-modal/admin-notification-detail-modal.component.scss
src/app/shared/components/auth-modal/auth-modal.component.scss
src/app/shared/components/blocked-account-modal/blocked-account-modal.component.scss
src/app/shared/components/complete-profile-modal/complete-profile-modal.component.scss
src/app/shared/components/email-not-found-modal/email-not-found-modal.component.scss
src/app/shared/components/email-sent-modal/email-sent-modal.component.scss
src/app/shared/components/forgot-password-modal/forgot-password-modal.component.scss
src/app/shared/components/rating-modal/rating-modal.component.scss
src/app/shared/components/verify-email-pending-modal/verify-email-pending-modal.component.scss
src/app/shared/components/zoning-modal/zoning-modal.component.scss
src/app/shared/components/push-unblock-modal/push-unblock-modal.component.ts             | inline styles
src/app/shared/components/date-input/date-picker-panel.component.ts                      | max-height con safe-area
```

### Frontend nuevos (3 archivos del modal)

```
src/app/shared/components/link-google-password-modal/link-google-password-modal.component.ts
src/app/shared/components/link-google-password-modal/link-google-password-modal.component.html
src/app/shared/components/link-google-password-modal/link-google-password-modal.component.scss
```

### Docs (3 archivos)

```
docs/plans/capacitor-mobile/13-phase-6.5-post-qa-fixes.md  | NUEVO (este archivo)
docs/plans/capacitor-mobile/05-decisions-log.md            | añadir decisiones D1-D5
docs/plans/capacitor-mobile/00-master-plan.md              | índice actualizado
```

---

## Métricas finales

| Métrica | Phase 0 baseline | Phase 6 final | Phase 6.5 final | Delta vs baseline | Restricción |
|---|---|---|---|---|---|
| Initial bundle raw | 782.53 kB | 805.77 kB | ~820 kB | +37 kB | — |
| Initial bundle transfer | 180.79 kB | 187.34 kB | ~187 kB | **+6.5 kB** | < 30 kB ✅ (al 22%) |
| Build time web | 19.7s | 18.4s | 14-17s | sin regresión ✅ | — |
| Errores TypeScript | 0 | 0 | **0** | — | obligatorio |
| Plugins Capacitor | 0 | 10 | 10 | — | — |
| APK debug size | — | 17 MB | 17 MB | — | — |

> El bundle raw creció a ~820 kB (+20 kB), excediendo el budget de Angular `800 kB` con un warning. Existía desde Phase 6 (805.77 kB). Es deuda técnica de configuración (`angular.json` budget), no de código. Resolver subiendo el budget a 850 kB en una task separada.

---

## Decisiones formales tomadas (post-Phase 6)

Ver detalle completo en `05-decisions-log.md`:

| # | Decisión | Valor |
|---|---|---|
| D1 | Bidirectional Google linking — esquema de verificación | Password (Opción 2B), no email |
| D2 | `googleAuth.signOut()` en logout — condicional o siempre | Siempre (incluye web no-op) |
| D3 | Theme admin — agnóstico al cliente | Storage keys separados, admin default `light` |
| D4 | Modales mobile fullscreen — padding con safe-area | `env()` puro sin floor `max(1rem,...)` |
| D5 | Logo admin — SVG con currentColor vs PNG transparente | PNG (mismo asset cliente) |

---

## Acceptance criteria nuevos para QA

Se añaden a las 122 AC del `02-block-baseline-tests.md`. Todas deben pasar en Tier A/B/C antes del release Phase 7.

### Edge-to-edge Android 15+ (8 AC)

| ID | Verificación |
|---|---|
| B4.AC14 | Landing `/`: status icons del SO NO se superponen al hero. Gesture bar NO corta el bloque inferior. |
| B5.AC16 | Cart overlay: "Productos en tu carrito" visible completo, "Seguir comprando" NO cortado por SO. |
| B5.AC17 | Product-detail overlay: header completo, última fila de productos relacionados NO cortada. |
| B6.AC15 | Checkout dispatch: lista completa visible, último item "Acordar con Vendedor" NO cortado. |
| B6.AC16 | Checkout summary: encabezado "Resumen del Pedido" NO bajo status bar. |
| B6.AC17 | Modal Pago Móvil/Tarjeta: título NO bajo status bar; "Cancelar" / "Confirmar Pago" NO cortados por nav bar. |
| B6.AC18 | Modal confirmación de orden: header y botones dentro de safe-area. |
| B4.AC15 | Scroll-to-top button (landing y catálogo): flota sobre la gesture/nav bar sin solapamiento. |

### Auth Google nativo (4 AC)

| ID | Verificación |
|---|---|
| B2.AC10 | Tap "Continuar con Google" con cuenta cuyo email YA EXISTE como cuenta local → aparece modal "Vincular cuenta con Google" (auth-modal queda cerrado). |
| B2.AC11 | Ingresar password correcta en modal → vincula Google → autologueado → ambos modales cerrados → próximo login Google entra directo (caso 1). |
| B2.AC12 | Ingresar password incorrecta → toast inline "Contraseña incorrecta". |
| B2.AC13 | Login Google → logout → login Google de nuevo → selector de cuentas Google aparece (sin "No credentials available"). |

### Admin agnóstico (3 AC)

| ID | Verificación |
|---|---|
| B3.AC8 | Cliente en dark + navegar a `/admin` → admin se ve en light (primera vez). |
| B3.AC9 | Toggle theme en admin → solo el admin cambia. Navegar a `/` → cliente conserva su estado. |
| B3.AC10 | Admin sidebar header muestra logo "autobus.png" visible en light Y dark. |

---

## Lecciones aprendidas

1. **El matrix de QA importa más que la cantidad de AC.** Phase 6 validó 100% de los flujos críticos en POCO X4 Pro 5G (Android 13). Pero el bug masivo de edge-to-edge solo aparece en Android 15+. Lección: **un solo dispositivo en el Tier objetivo NO basta**. Para v1.1 sumar al menos un Pixel/Samsung con Android 15+ al matrix.

2. **`env(safe-area-inset-*)` es una convención que el equipo debe internalizar.** No es opcional en un app Capacitor con `targetSdk >= 35`. Sería conveniente añadir un ESLint/stylelint rule que detecte `position: fixed` con `top:/bottom:` literales y exija `env(safe-area-inset-*)`.

3. **Media queries pueden anular silenciosamente fixes globales.** El bug `_responsive.scss padding: 0` mostró que un fix en el selector base no es suficiente si hay overrides condicionales. Lección: al hacer un fix de safe-area, **buscar también todos los media queries** que toquen ese selector.

4. **Plugins Capacitor mantienen estado nativo independiente del frontend.** El bug "No credentials available" tras logout no podía deducirse mirando solo el JS — había que entender qué hace el plugin a nivel SDK Android. Lección: cuando un plugin expone `signIn()/signOut()`, ambos deben usarse en el ciclo de vida apropiado.

5. **Backticks dentro de template literals rompen AOT.** El error `Code: 1010, Failed to resolve styles at position 0` fue causado por un backtick dentro de un comentario `styles: [\` ... \`]`. Lección: nunca usar backticks dentro de un styles inline. Para nombres de variables CSS en comentarios, usar comillas dobles o ningún delimitador.

6. **`schema.select: false` requiere `.select('+field')` en cada lookup.** El bug del falso `ACCOUNT_HAS_NO_PASSWORD` se reprodujo porque omitir `.select('+password')` da silencio (no error TS, no error runtime) — solo lógica errónea. Lección: documentar este patrón en un README del módulo `users/`.

---

## Estado final Phase 6.5

✅ **9 bugs resueltos + 1 feature implementado + 3 docs actualizados.**

Phase 6.5 cerrada el 2026-05-20 a las 16:20.

**Pendiente:**
- Autorización formal para iniciar Phase 7 (release firmado + listing Play Console).
- QA en Tier A (Pixel / Samsung Android 15+) para validar los 15 AC nuevos.
- Resolver warning de bundle budget (subir de 800 KB a 850 KB en `angular.json`).
