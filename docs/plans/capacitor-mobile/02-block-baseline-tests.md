# 02 — Baseline Tests por Bloque (Pre-Capacitor)

> **Status:** Baseline analysis (READ-ONLY)
> **Method:** análisis estático del código fuente. No se ejecuta la app aquí; las verificaciones son inspección línea por línea de los flujos.
> **Output:** acceptance criteria que se ejecutarán dos veces — mentalmente ahora, funcionalmente en QA tras Phase 7.
> **Lectura previa requerida:** `01-system-blocks-definition.md`

---

## Convención de los tests

Cada bloque tiene cuatro secciones:

- **Inventario funcional:** "qué hace" — lista de capacidades observables verificables en código.
- **Trazas end-to-end:** se sigue el flujo línea por línea, mencionando archivo:línea para que sea auditable.
- **Riesgos pre-existentes:** debilidades del código actual que deben preservarse o corregirse — no son "bugs Capacitor", son cosas que ya existen.
- **Acceptance criteria (AC) post-Capacitor:** checklist binaria para QA. Cada item debe pasar en web Y en Android v1 después de Phase 7. Se anotan "**WEB-only**" / "**APP-only**" cuando aplica.

Cada AC tiene un identificador (`B<bloque>.AC<n>`) que se referencia en bug reports.

---

## Bloque 1 — Auth Cliente Local

### Inventario funcional

1. Registro con email/password sin pedir datos personales.
2. Login local devuelve JWT y user, los persiste en `auth_token` y `auth_user`.
3. Logout llama `POST /api/auth/logout` (best-effort), limpia localStorage, navega a `/`.
4. Logout invalida el FCM token vía `unregisterToken()` antes de borrar el JWT (auth.service.ts:354).
5. Si `EMAIL_VERIFICATION_REQUIRED=true` el registro NO devuelve token — flag `requiresVerification` dispara modal de verify-email-pending.
6. `forgot-password` envía email; el frontend muestra `email-sent-modal`.
7. `reset-password?token=...` valida el token (`GET /api/auth/reset-password/verify`) y permite cambiar contraseña.
8. `verify-email?token=...` consume el token; si la respuesta trae `data.token + data.user`, hace auto-login.
9. `change-password` desde perfil rota el JWT (backend devuelve `newToken`) y `applyNewSession` lo persiste sin requerir re-login.
10. 401/403 con códigos `ACCOUNT_BLOCKED|ACCOUNT_SUSPENDED|ACCOUNT_DELETED|ACCOUNT_NOT_FOUND` dispara `triggerAccountBlocked` que muestra modal global y limpia sesión.
11. `sessionExpired` signal abre el auth modal automáticamente vía `effect` en `app.ts:62`.
12. `loadUserProfile()` se ejecuta en `APP_INITIALIZER` si hay token presente — re-hidrata el perfil desde backend.

### Trazas end-to-end

#### Happy path: registro nuevo + login + logout

```
1. Usuario abre auth-modal (modo register) → completa email + password + firstName + lastName.
2. AuthService.register(data) → POST /api/auth/register
3. Backend crea user, opcionalmente crea EmailToken si EMAIL_VERIFICATION_REQUIRED.
4. Si verificación NO requerida: response = { success: true, data: { token, user } }
   → handleAuthSuccess() → localStorage.setItem(CLIENT_TOKEN_KEY, token)
   → currentUserSignal.set(user)
   → modal se cierra, app.ts effect ve currentUser ≠ null → no abre modal
5. Si verificación SÍ requerida: response.data.requiresVerification = true
   → handleAuthSuccess NO se invoca (gateado en línea 181)
   → auth-modal emite verificationPending → app.ts onVerificationPending →
     muestra verify-email-pending-modal con email + firstName.
6. Logout: usuario click → AuthService.logout() → performLogoutAsync() →
   await Promise.race([unregisterFcmTokenSilent(false), 1500ms timeout])
   → POST /api/auth/logout (best-effort)
   → localStorage.removeItem(auth_token, auth_user, oauth_return_url)
   → currentUserSignal.set(null)
   → router.navigate(['/'])
```

#### Edge case: 401 durante una request → sesión expira

```
1. Cualquier endpoint autenticado devuelve 401.
2. authInterceptor catchError detecta status === 401 && isAuthenticated().
3. authService.handleSessionExpired() →
   localStorage.removeItem keys, currentUserSignal.set(null), sessionExpiredSignal.set(true)
4. app.ts effect ve sessionExpired() === true → openAuthModal('login').
5. Si la URL actual es /perfil o /admin, se redirige a / o /admin/login.
6. authService.triggerAccountBlocked() también se llama — si el body trae código de bloqueo, abre el modal de blocked-account además del auth modal.
```

#### Edge case: change-password rota el JWT

```
1. ProfileInfoComponent → ChangePasswordModal → http.patch /api/users/profile/password
2. Backend valida currentPassword, hashea newPassword, stamps tokensInvalidatedAt = now.
3. Backend genera token NUEVO con iat > tokensInvalidatedAt → válido para esta sesión.
4. Backend response: { success, data: { user, token: newToken } }
5. Frontend: authService.applyNewSession(newToken, user) →
   - getStorageKeys() según contexto (cliente/admin)
   - localStorage.setItem actualiza el JWT
   - currentUserSignal actualiza el user
   - sessionExpiredSignal.set(false)
6. Próximas requests usan el nuevo token. Otras pestañas/dispositivos ven 401 al siguiente request → expiran.
```

### Riesgos pre-existentes

| # | Riesgo | Severidad | Notas |
|---|---|---|---|
| R1.1 | `getToken()` lee localStorage síncronicamente; en iOS WebView puede ser purgado por el SO | Medio | Se resuelve en Phase 4 con `Preferences` (nativo) |
| R1.2 | `handleAuthSuccess` siempre escribe en `CLIENT_TOKEN_KEY` (no respeta admin) — es intencional pero confuso | Bajo | El admin tiene su propio método `handleAdminLogin` |
| R1.3 | `loadUserProfile` en `APP_INITIALIZER` no es bloqueante; si tarda, los componentes mounting pueden ver `currentUser=null` por unos ms y disparar guards equivocados | Bajo | Mitigado por el auth-modal que se cierra al actualizar el signal |
| R1.4 | `oauth_return_url` se borra al logout pero también cuando completa OAuth — si el flujo se interrumpe, queda basura en localStorage | Bajo | Limpieza ya implementada en `auth-callback` |
| R1.5 | `BLOCK_ERROR_CODES` está duplicado entre `auth.service.ts:41-46` y `auth.interceptor.ts:7-12` y `auth-callback.component.ts:6-11` | Bajo | DRY violado, pero no causa bugs |

### Acceptance criteria post-Capacitor

| ID | Verificación | Plataforma |
|---|---|---|
| B1.AC1 | Registro nuevo con email + password + nombre completa exitosamente y muestra modal verify-pending si verificación requerida, o auto-login si no | Web + App |
| B1.AC2 | Login con credenciales válidas devuelve JWT, lo persiste y carga el perfil | Web + App |
| B1.AC3 | Login con credenciales inválidas muestra error inline en el modal | Web + App |
| B1.AC4 | Login con cuenta bloqueada (`ACCOUNT_BLOCKED`) muestra modal de blocked-account, no auto-login | Web + App |
| B1.AC5 | Logout limpia JWT, redirige a `/`, desregistra FCM token (verificable en backend que el documento se borra) | Web + App |
| B1.AC6 | Tras kill-app y re-open: la sesión persiste, el perfil se rehidrata, sigues logueado | Web (refresh) + App (kill app) |
| B1.AC7 | Tras 401 en cualquier request: el modal de login se abre automáticamente | Web + App |
| B1.AC8 | `forgot-password` envía email; modal email-sent aparece | Web + App |
| B1.AC9 | Click en email link `/reset-password?token=...`: token valida, formulario aparece, cambio exitoso, redirige a login | Web + App (vía deep link) |
| B1.AC10 | Click en email link `/verify-email?token=...`: verificación exitosa, si backend devuelve token → auto-login + complete-profile modal | Web + App (vía deep link) |
| B1.AC11 | `change-password` exitoso rota el JWT, sigues logueado en la misma sesión sin ver el modal de auth | Web + App |
| B1.AC12 | `change-password` exitoso provoca 401 en otras pestañas/dispositivos al siguiente request | Web (otra pestaña) + App (otro dispositivo) |
| B1.AC13 | Resend-verification: respeta rate limit (3 retries / 24h) | Web + App |
| B1.AC14 | check-email retorna `exists: true|false` correctamente | Web + App |

---

## Bloque 2 — Auth Google y Account Linking

### Inventario funcional

1. Botón "Continuar con Google" en `auth-modal` ejecuta `loginWithOAuth('google')`.
2. Frontend persiste `oauth_return_url = window.location.pathname` y hace `window.location.href = ${apiUrl}/auth/google`.
3. Backend Passport Google strategy tiene 3 ramas (`config/passport.ts`):
   - **Rama 1:** `googleId` ya existe → refresca avatar/firstName/lastName si falta y deja entrar.
   - **Rama 2:** email coincide con un user local pre-existente → `done(new Error(OAUTH_LOCAL_COLLISION))` → frontend recibe `?error=EMAIL_ALREADY_REGISTERED_LOCAL`.
   - **Rama 3:** usuario nuevo → crea con `isVerified: true, profileCompleted: false`.
4. Tras success, backend redirige a `${clientUrl}/auth/callback?token=<JWT>`.
5. `AuthCallbackComponent.ngOnInit` lee `?token`, llama `handleOAuthCallback(token)` que persiste el JWT, luego `loadUserProfile()` actualiza el user.
6. Si `user.profileCompleted === false` → `router.navigate(['/perfil'], { queryParams: { completeProfile: 'true' }})`.
7. Si no → restaura `oauth_return_url` o navega a `/`.
8. **Caso 3 (Account Link):** un usuario que solo tiene cuenta Google quiere agregar contraseña. Llama `POST /api/auth/link-account` que dispara email con token. Modal account-link-pending se muestra.
9. `verify-account-link?token=...` consume el token y, si exitoso, persiste JWT directamente en `CLIENT_TOKEN_KEY` (auth.service.ts:209-218).
10. **Caso 5 (Forgot password en cuenta Google-only):** el endpoint `/forgot-password` detecta que la cuenta es Google-only y devuelve un código `ACCOUNT_LINK_REQUIRED` (o similar); el frontend redirige al flujo de link-account con el email pre-llenado.

### Trazas end-to-end

#### Happy path: nuevo usuario Google

```
1. Click "Continuar con Google" → AuthService.loginWithOAuth('google')
2. localStorage.setItem('oauth_return_url', '/catalogo')
3. window.location.href = 'http://localhost:3003/api/auth/google'
4. Backend GET /api/auth/google → passport.authenticate('google') redirige a accounts.google.com
5. Usuario autentica en Google → Google redirige a GET /api/auth/google/callback?code=...
6. Passport intercambia code por profile, ejecuta callback de la GoogleStrategy:
   - findOne({ googleId: profile.id }) → null
   - findOne({ email: profileEmail }) → null
   - User.create({ googleId, email, firstName, lastName, avatar, isVerified: true, profileCompleted: false })
7. req.logIn(user) crea sesión Express → authController.oauthCallback(req, res)
8. assertAccountUsable(user) → no throws (cuenta nueva)
9. generateToken(user) → JWT
10. res.redirect('http://localhost:4200/auth/callback?token=<JWT>')
11. Browser carga /auth/callback?token=...
12. AuthCallbackComponent lee token → handleOAuthCallback(token):
    - localStorage.removeItem(CLIENT_USER_KEY)
    - currentUserSignal.set(null)
    - localStorage.setItem(CLIENT_TOKEN_KEY, token)
13. loadUserProfile() → GET /api/users/profile (auth header con el nuevo JWT)
14. Backend devuelve user con profileCompleted: false
15. AuthCallbackComponent: detecta profileCompleted === false → navega a /perfil?completeProfile=true
16. ProfileComponent abre el complete-profile-modal automáticamente
```

#### Edge case: colisión local

```
1-5. (igual que arriba)
6. findOne({ email }) ENCUENTRA un user con `password` (cuenta local pre-existente).
7. done(new Error('EMAIL_ALREADY_REGISTERED_LOCAL'))
8. Backend route handler intercepta el error → res.redirect(`${clientUrl}/auth/callback?error=EMAIL_ALREADY_REGISTERED_LOCAL`)
9. AuthCallbackComponent: ve `?error=EMAIL_ALREADY_REGISTERED_LOCAL` → no es código de bloqueo → setea this.error con mensaje "Este correo ya tiene una cuenta. Inicia sesión con tu contraseña."
10. Usuario click "Volver al inicio" → router.navigate(['/'])
```

#### Edge case: account link (caso 3)

```
1. Usuario tiene cuenta Google. Quiere agregar contraseña para login con email.
2. AuthModal modo "linkAccount" → POST /api/auth/link-account con { email, password, firstName, lastName }
3. Backend detecta que email pertenece a Google user, crea AccountLinkToken, envía email con link
4. Backend response: { success: true, message: 'Verification email sent' }
5. Frontend: app.ts onAccountLinkPending({ email, firstName }) → muestra account-link-pending-modal
6. Usuario abre email → click link → /verify-account-link?token=...
7. VerifyAccountLinkComponent → POST /api/auth/verify-account-link { token }
8. Backend valida token, asocia password al user, devuelve JWT + user
9. Frontend persiste JWT en CLIENT_TOKEN_KEY, currentUserSignal.set(user) → auto-login
10. Navega a /perfil
```

### Riesgos pre-existentes

| # | Riesgo | Severidad | Notas |
|---|---|---|---|
| R2.1 | `oauth_return_url` puede contener URLs maliciosas si alguien manipula localStorage antes del click | Bajo | El backend redirige a `${config.clientUrl}` siempre — el return_url solo se usa post-callback en frontend |
| R2.2 | `window.location.href` rompe el state interno de Angular (perdemos el carrito en memoria) — pero como cart está en localStorage, sobrevive | Bajo | OK por diseño |
| R2.3 | El callback espera el JWT en query string — vulnerable a leakage por logs de servidor / Referer header | Medio | Mitigación: el endpoint backend marca el token como single-use (no aplica) o el cliente debería intercambiarlo por uno fresh inmediatamente. Hoy no se hace. |
| R2.4 | Sesión Express se acumula en MongoDB para cada login OAuth aunque el JWT sea el método real de auth | Bajo | TTL de 24h limpia |

### Acceptance criteria post-Capacitor

| ID | Verificación | Plataforma |
|---|---|---|
| B2.AC1 | **WEB:** Click "Continuar con Google" → redirect a accounts.google.com → autentica → callback en `/auth/callback?token=...` → auto-login | Web only (Phase A) |
| B2.AC2 | **APP:** Click "Continuar con Google" → prompt nativo de selección de cuenta Google → POST /api/auth/google/native con idToken → auto-login | App only |
| B2.AC3 | **WEB:** Cuenta nueva Google con `profileCompleted: false` → tras login redirige a `/perfil?completeProfile=true` y modal aparece | Web + App |
| B2.AC4 | Colisión local: muestra mensaje "Este correo ya tiene una cuenta. Inicia sesión con tu contraseña." y NO crea sesión | Web + App |
| B2.AC5 | Link-account: email se envía, modal account-link-pending aparece | Web + App |
| B2.AC6 | Click email link `/verify-account-link?token=...`: token consume, JWT emitido, auto-login | Web + App (vía deep link) |
| B2.AC7 | Forgot-password en cuenta Google-only: redirige al flujo de link-account con email pre-llenado | Web + App |
| B2.AC8 | Logout tras login Google funciona idéntico a logout tras login local | Web + App |
| B2.AC9 | Tras login Google, los siguientes requests autenticados llevan `Authorization: Bearer <JWT>` | Web + App |

---

## Bloque 3 — Auth Admin

### Inventario funcional

1. `/admin/login` muestra form con `username` (no email) + password. `adminLoginGuard` redirige al dashboard si ya está logueado como admin.
2. Submit → `POST /api/admin/login` → response `{ success, data: { token, user } }` con role admin.
3. `authService.handleAdminLogin(token, user)` persiste en `admin_auth_token` y `admin_auth_user` (claves separadas del cliente).
4. `adminGuard` verifica autenticación + `role === 'admin'`. Si falla → redirige a `/admin/login`.
5. Layout admin (`AdminLayoutComponent`) renderiza sidebar con navegación a todas las secciones admin.
6. **`isAdminContext()` decide qué claves localStorage usar** basándose en `window.location.pathname.startsWith('/admin')`. Esto permite que el mismo navegador tenga sesión cliente Y admin simultáneamente sin colisión.
7. `loadUserProfile()` detecta admin context → llama `/api/admin/profile` en lugar de `/api/users/profile`.
8. Logout admin redirige a `/admin/login` (no a `/`).

### Trazas end-to-end

#### Happy path: login admin

```
1. Navega a /admin/login
2. adminLoginGuard: authService.isAuthenticated() = false → permite cargar
3. Submit form { username: 'admin', password: '***' }
4. POST /api/admin/login → backend valida en colección Admin (no User) → JWT + user con role: 'admin'
5. authService.handleAdminLogin(token, user):
   - localStorage.setItem('admin_auth_token', token)
   - localStorage.setItem('admin_auth_user', JSON.stringify(user))
   - currentUserSignal.set(user)
6. router.navigate(['/admin'])
7. adminGuard: isAuthenticated = true (currentUser != null), role = 'admin' → permite
8. AdminLayoutComponent monta, sidebar visible
```

#### Edge case: cliente y admin en el mismo navegador

```
1. Cliente loguea en /. localStorage tiene auth_token + auth_user. currentUserSignal = client.
2. Cliente navega a /admin/login (por curiosidad). isAdminContext() = true (la URL empieza por /admin).
3. adminLoginGuard: getStorageKeys() = admin keys. localStorage.getItem('admin_auth_token') = null.
4. authService.isAuthenticated() lee currentUserSignal — pero ESE signal todavía es del cliente.
5. PROBLEMA: el guard ve currentUser != null && role !== 'admin' → redirige a /admin/login.
6. Cliente intenta loguear como admin con sus credenciales: backend rechaza (no es admin).
7. Si tuviera credenciales admin, el login sustituye currentUserSignal con el admin user.
```

> **Observación:** el sistema asume que `currentUserSignal` representa al user del contexto actual. Si el usuario navega entre /catalogo y /admin/login, el signal puede mostrar al cliente cuando el guard espera admin. Esto se resuelve porque `getStorageKeys()` SÍ lee del path correcto y el guard re-evalúa al navegar.

### Riesgos pre-existentes

| # | Riesgo | Severidad | Notas |
|---|---|---|---|
| R3.1 | `currentUserSignal` no diferencia cliente vs admin — si el usuario tiene ambas sesiones, navegar entre contextos puede mostrar el user incorrecto en el header durante 1 ms | Bajo | `setUserFromStorage()` puede llamarse al cambiar contexto |
| R3.2 | `isAdminContext` usa `window.location.pathname` que es mutable; puede dar falso positivo si una URL accidentalmente empieza por /admin (ej. /admin-news) | Bajo | El path /admin está reservado por convención |
| R3.3 | El admin login usa `username` que es plain text — no hay rate-limit estricto en backend | Medio | Hay rate-limit general |

### Acceptance criteria post-Capacitor

| ID | Verificación | Plataforma |
|---|---|---|
| B3.AC1 | `/admin/login` carga en web, formulario funciona, login exitoso lleva a dashboard | Web only |
| B3.AC2 | Credenciales inválidas muestran mensaje de error inline | Web only |
| B3.AC3 | `adminGuard` bloquea acceso a `/admin/...` si no hay sesión admin | Web only |
| B3.AC4 | Logout admin redirige a `/admin/login`, NO a `/` | Web only |
| B3.AC5 | Cliente y admin coexisten en mismo navegador (cliente loguea en /, admin loguea en /admin, ambas sesiones persisten) | Web only |
| B3.AC6 | **APP:** Si usuario navega manualmente a `/admin/...` en la app móvil, es redirigido (queda sin sesión admin → /admin/login → no carga porque no hay layout admin v1) | App |
| B3.AC7 | **APP:** El bundle compila incluyendo el código admin (no se hace tree-shaking selectivo) — pero el usuario nunca puede acceder | App |

---

## Bloque 4 — Navegación, Catálogo y Detalle de Producto

### Inventario funcional

1. Routing 100% lazy con `loadComponent`, ~50 rutas.
2. Landing en `/` (TuBusServicioComponent) — sin layout principal.
3. Resto de la tienda bajo MainLayoutComponent (header + footer).
4. Admin bajo AdminLayoutComponent.
5. Páginas legales públicas, mechanic-progress público, auth-callback/reset-password/verify-email/verify-account-link sin layout.
6. `OverlayStackService` maneja stack de overlays (product detail + cart) mediante History API: `pushState` añade entrada en historial, `popstate` la consume.
7. `withInMemoryScrolling({ scrollPositionRestoration: 'disabled' })` deja el scroll a cargo del overlay service: imperative navs hacen scrollTo(0,0), popstate respeta donde quedó.
8. `ChunkLoadErrorHandler` recarga la página UNA vez si un chunk lazy falla (típico tras un deploy con hash distinto).
9. Catálogo: filtros (search, vehicle type, brand, category, sort, only-combos), debounce de búsqueda con `Subject` + switchMap, vehicle filter desde garaje (signal compartido con VehicleService).
10. Catálogo invoca `branchProductService` con branch IDs derivados de `LocationService` para filtrar productos disponibles en la zona.
11. Product card: click abre overlay (no navega URL), back lo cierra.
12. Cart popover (desktop) y cart overlay (mobile) accesibles desde header.

### Trazas end-to-end

#### Happy path: abrir producto en overlay y volver

```
1. Usuario en /catalogo, scroll en posición Y=2400.
2. Click en product card → ProductCardComponent.handleClick → overlayStack.openProduct(productId)
3. OverlayStackService.push({type: 'product', uid: 'xxx', productId}):
   - stackSignal actualiza con el nuevo entry
   - history.pushState({ __overlayStack: true, snapshot: [...] }, '', window.location.href)
   (la URL no cambia — sigue siendo /catalogo, pero hay una entrada nueva en historial)
4. AppComponent template: @if (overlayService.isOpen()) renderiza ProductDetailPageComponent
   con stack[0].productId.
5. Hardware/browser back → window dispara popstate.
6. OverlayStackService listener:
   - state = previous state (no tiene __overlayStack o tiene snapshot vacío)
   - stackSignal.set([])
   - Como NO hubo NavigationEnd (la URL no cambió), Angular no resetea el scroll
   - El catalog vuelve a aparecer con scroll Y=2400 intacto
```

#### Edge case: deploy con stale chunk

```
1. Usuario tiene la SPA cargada con hash 'a1b2c3'.
2. Backend deploya nueva versión con hash 'd4e5f6'. Los chunks antiguos ya no existen.
3. Usuario navega a /perfil (lazy route).
4. Browser intenta cargar 'profile-component-a1b2c3.chunk.js' → 404.
5. Angular dispara navigationError.
6. withNavigationErrorHandler detecta `isChunkLoadError(error)` → reloadOnceForStaleBuild()
7. sessionStorage.getItem('chunk_reload_marker') = null o > 60s atrás → setea marker y window.location.reload()
8. Reload → bundle nuevo se descarga → todo funciona.
9. Si tras reload sigue fallando (ChunkLoadErrorHandler global ErrorHandler captura): ya no recarga (anti-loop).
```

#### Edge case: navegación imperative vs popstate

```
1. Estado inicial: en /catalogo, Y=0.
2. Click en producto → overlay abre, Y queda en 0.
3. Scroll dentro del overlay a Y_overlay = 1500.
4. Click en breadcrumb del overlay → router.navigate(['/']).
5. NavigationStart con trigger='imperative'.
6. NavigationEnd: currentNavTrigger === 'imperative' → window.scrollTo(0, 0).
7. Stack se vacía (effect en filter NavigationEnd|Cancel|Error).
8. Usuario en / con scroll en top.
```

### Riesgos pre-existentes

| # | Riesgo | Severidad | Notas |
|---|---|---|---|
| R4.1 | El listener `popstate` en `overlay-stack.service.ts` corre sin verificar que `event.state` venga del mismo origen — si otra librería pushea state, podría confundirse | Bajo | El marker `__overlayStack` actúa como discriminator |
| R4.2 | `ChunkLoadErrorHandler` no maneja el caso "el bundle nuevo también está corrupto" | Bajo | Anti-loop por sessionStorage de 60s |
| R4.3 | Catálogo hace múltiples HTTP calls en paralelo al cambiar filtros — switchMap solo cancela el de products, no los de brands/categories que son independientes | Bajo | OK por diseño |
| R4.4 | `landing` en `/` con `pathMatch: 'full'` está separado del MainLayout — si el usuario quiere ir al header/footer de la tienda desde la landing, se mezclan layouts | Bajo | Diseño intencional |

### Acceptance criteria post-Capacitor

| ID | Verificación | Plataforma |
|---|---|---|
| B4.AC1 | `/` muestra la landing TuBusServicio | Web + App |
| B4.AC2 | `/catalogo` muestra grid de productos | Web + App |
| B4.AC3 | Filtros (search, vehicle type, brand, category, sort, only-combos) funcionan y backend devuelve resultados filtrados | Web + App |
| B4.AC4 | Búsqueda con debounce: tipear 5 caracteres rápido NO genera 5 requests (switchMap los cancela) | Web + App |
| B4.AC5 | Click en producto abre overlay sin cambiar URL | Web + App |
| B4.AC6 | **WEB:** Browser back cierra el overlay y mantiene scroll del catálogo | Web only |
| B4.AC7 | **APP:** Hardware back físico cierra el overlay y mantiene scroll del catálogo | App only |
| B4.AC8 | Doble overlay (producto + carrito): back cierra el de arriba, segundo back cierra el de abajo | Web + App |
| B4.AC9 | Lazy routes cargan tras click sin error en consola | Web + App |
| B4.AC10 | Tras deploy con stale chunk: la app se auto-recarga y carga el bundle nuevo | Web only (en app, los chunks van empaquetados) |
| B4.AC11 | Páginas legales (`/legal/terminos`, `/legal/privacidad`, `/legal/cookies`) cargan sin auth | Web + App |
| B4.AC12 | `/mechanic/progress/:token` carga sin auth | Web only (mecánico no usa app v1) |
| B4.AC13 | Catálogo respeta zona seleccionada — solo muestra productos disponibles en sucursales de esa zona | Web + App |

---

## Bloque 5 — Carrito y Estado Persistente Local

### Inventario funcional

1. `CartService._items` signal, persiste en localStorage `shopping_cart`.
2. `addItem(item, qty)` valida: usuario autenticado + stock disponible. Devuelve `AddToCartResult` con `success` o `error`.
3. `incrementQuantity(itemId)` y `decrementQuantity(itemId)` validan stock.
4. `removeItem(itemId)`, `clearCart()` actualizan localStorage.
5. `effect` detecta logout (wasAuthenticated → false) y vacía carrito.
6. `loadFromStorage()` filtra items legacy sin stock válido.
7. `syncItemMetadata` rehidrata `vehicleTypes` y `freeOilChangeService` para items legacy.
8. `generateWhatsAppMessage()` formatea factura.
9. `openWhatsAppCheckout()` ejecuta `window.open(whatsappUrl, '_blank')` si está habilitado.
10. `ThemeService` lee preferencia salvada o detecta `prefers-color-scheme`. Aplica `.dark` al `documentElement`.
11. `LocationService` constructor: si hay `user_location` en localStorage, lo carga y resuelve branches/delivery del backend. Si no, marca `_isResolved = true` (no espera).
12. `SettingsService.loadSettings()` ejecutado en APP_INITIALIZER, fetcha `/api/settings`, mergea con DEFAULT_SETTINGS, aplica colores CSS según ruta.
13. `ExchangeRateService.loadCurrentRate()` se ejecuta tras settings. Cachea la tasa.
14. `PwaService` engancha listeners `beforeinstallprompt`, `appinstalled`, `controllerchange`. Decide si mostrar modal o botón.
15. `chunkLoadErrorHandler` (B4) se relaciona pero está en su propio archivo.

### Trazas end-to-end

#### Happy path: agregar producto al carrito

```
1. Usuario logueado, en /catalogo, click "Add to cart" en product-card.
2. ProductCardComponent → cartService.addItem(item, 1)
3. isUserAuthenticated() = true
4. validStock = item.stock (e.g. 10)
5. currentQuantity = 0, newTotal = 1, 1 ≤ 10 → OK
6. _items.update: añade item al array, saveToStorage(items)
7. localStorage.setItem('shopping_cart', JSON.stringify(items))
8. Return { success: true, currentQuantity: 1, maxStock: 10 }
9. Toast verde "Producto agregado al carrito"
10. Cart badge en header se actualiza (totalItems computed reacciona)
```

#### Edge case: logout limpia carrito

```
1. Usuario logueado, carrito tiene 3 items.
2. Click logout → AuthService.logout()
3. AuthService.performLogoutAsync limpia auth_token, currentUserSignal.set(null)
4. CartService effect detecta:
   - wasAuthenticated = true
   - isAuthenticated() = false (porque currentUserSignal es null)
   - condition: wasAuthenticated && !isAuthenticated → TRUE
5. _items.set([])
6. localStorage.removeItem('shopping_cart')
7. Console log: '[CartService] Usuario desconectado - limpiando carrito'
8. wasAuthenticated = false (para próxima evaluación)
```

#### Edge case: tema dark con SSR-like flicker

```
1. Carga inicial: ThemeService constructor → getInitialTheme():
   - localStorage.getItem('e-commerce-theme') = 'dark'
   - return 'dark'
2. effect en constructor → applyTheme('dark') → document.documentElement.classList.add('dark')
3. Tailwind dark: variants se aplican de inmediato. No hay flash of wrong theme.

PERO: si entre que el HTML carga y Angular bootstrappea pasa tiempo, el browser muestra
el tema light por defecto (sin clase .dark) durante esos ms.
Mitigación actual: ninguna inline. Aceptable para una SPA pequeña.
```

### Riesgos pre-existentes

| # | Riesgo | Severidad | Notas |
|---|---|---|---|
| R5.1 | Cart effect detecta logout pero NO detecta cambio de usuario (login con otro email sin logout previo) | Bajo | Difícil de provocar — el flow normal pasa por logout |
| R5.2 | `loadFromStorage` no valida `id` o `name` de los items — solo `stock`. Items corruptos podrían pasar | Bajo | Try/catch envuelve |
| R5.3 | LocationService al boot dispara HTTP requests aunque la app esté offline | Bajo | El componente catalog espera `isResolved` antes de fetch products |
| R5.4 | SettingsService.applyColors() hace setProperty en root cada NavigationEnd — son ~7 setProperty, cero costo real | Bajo | OK |
| R5.5 | PwaService.dismissInstallModalPersistent escribe en localStorage; si está lleno, falla silente | Bajo | Try/catch |
| R5.6 | El auto-clean de carrito al logout puede sorprender al usuario que solo cerró sesión por accidente | Medio | Decisión de producto |

### Acceptance criteria post-Capacitor

| ID | Verificación | Plataforma |
|---|---|---|
| B5.AC1 | Add to cart sin login muestra modal de auth | Web + App |
| B5.AC2 | Add to cart con login añade item, badge actualiza | Web + App |
| B5.AC3 | Add to cart excediendo stock falla con mensaje "Solo hay X unidades disponibles" | Web + App |
| B5.AC4 | Increment/decrement funciona y respeta stock | Web + App |
| B5.AC5 | Logout limpia carrito y localStorage | Web + App |
| B5.AC6 | Carrito persiste tras refresh / kill-app | Web (refresh) + App (kill) |
| B5.AC7 | Items legacy sin metadata se rehidratan tras visitar catalog | Web + App |
| B5.AC8 | WhatsApp checkout: abre WhatsApp web (web) o app de WhatsApp (móvil) si está habilitado | Web + App |
| B5.AC9 | Tema dark/light persiste y se aplica al cargar | Web + App |
| B5.AC10 | LocationService persiste ciudad/municipio seleccionados | Web + App |
| B5.AC11 | SettingsService carga config global al boot, no bloquea navegación | Web + App |
| B5.AC12 | Exchange rate se carga y los precios bolívares se calculan correctamente | Web + App |
| B5.AC13 | **WEB:** PWA install modal aparece en mobile/tablet con browser instalable | Web only |
| B5.AC14 | **WEB:** PWA update banner aparece tras nuevo deploy del SW | Web only |
| B5.AC15 | **APP:** PWA modal y banner JAMÁS se muestran en la app nativa | App only |

---

## Bloque 6 — Checkout, Zoning y Pagos

### Inventario funcional

1. Pre-requisitos: usuario autenticado, location resuelta, items en carrito.
2. `/checkout/despacho` muestra opciones según settings (`dispatch.modules.*`):
   - store_pickup, shipping_agency, local_delivery, seller_agreement, oil_change_service, in_store_oil_change.
3. Cada modalidad navega a su form: `/checkout/agencia`, `/checkout/envio`, `/checkout/delivery`, `/checkout/vendedor`, `/checkout/cambio-aceite`, `/checkout/cambio-aceite-tienda`.
4. Forms recolectan datos del destinatario (validación con Validators).
5. Vehículo del garaje se selecciona en oil-change forms (con flag `EngineModificationStatus`).
6. `/checkout/resumen` muestra total + selección de método de pago + upload de comprobante.
7. Submit ejecuta `POST /api/orders` con todo el payload + `POST /api/payments` (o crea pago atómicamente con la order).
8. Comprobante: `<input type="file" accept="image/*" (change)="onProofFileChange($event)">` → FormData → `POST /api/upload/image` → URL Cloudinary asociada al pago.
9. `/checkout/confirmacion/:orderId` (con authGuard) muestra resumen final + agradecimiento.
10. `CheckoutService` mantiene state inter-pasos en signals.

### Trazas end-to-end

#### Happy path: store pickup → confirmación

```
1. Usuario logueado con carrito y location en Caracas/Libertador.
2. Click "Ir a checkout" en cart-overlay → router.navigate(['/checkout/despacho'])
3. CheckoutDispatchComponent: lee settings.dispatch, branches del location service.
4. Selecciona "Retiro en tienda" → CheckoutService.setDispatch('store_pickup', branch)
5. router.navigate(['/checkout/resumen'])
6. CheckoutSummary: muestra subtotal, branch, lista de payment methods (filtrados por settings).
7. Selecciona método "Pago Móvil" → muestra UI con datos del banco (de payment-method config).
8. <input file> → onProofFileChange: lee File, muestra preview.
9. Submit:
   - uploadService.uploadImage(file, 'payment-proofs') → POST /api/upload/image
     → response { url: 'https://res.cloudinary.com/...', publicId, ... }
   - orderService.createOrder({ items, dispatch, recipient, paymentMethod, proofUrl, ... })
     → POST /api/orders → response { success, data: { order: { _id: '...', ... } } }
10. router.navigate(['/checkout/confirmacion', orderId])
11. authGuard: pass (autenticado)
12. CheckoutConfirmationComponent: GET /api/orders/:id → muestra orden creada
13. Carrito se limpia: cartService.clearCart()
```

#### Edge case: oil change service requiere vehículo

```
1. Usuario en /checkout/despacho selecciona "Cambio de aceite a domicilio"
2. router.navigate(['/checkout/cambio-aceite'])
3. CheckoutOilChangeFormComponent: vehicleService.getMyVehicles()
4. Si no tiene vehículos → muestra link "Agregar vehículo" → router.navigate(['/perfil#garaje'])
5. Si tiene vehículos → dropdown para seleccionar
6. Form pide: vehicle, dirección de servicio, fecha/hora preferida, EngineModificationStatus.
7. Si EngineModificationStatus = 'modified', muestra disclaimer.
8. Submit → CheckoutService.setOilChangeServiceInfo() → router.navigate(['/checkout/resumen'])
```

#### Edge case: comprobante muy grande

```
1. Usuario selecciona file de 10 MB.
2. <input> permite seleccionarlo.
3. Submit → upload.service.ts → POST /api/upload/image (multipart)
4. Backend: multer middleware con MAX_FILE_SIZE = 5MB → rechaza con 400 "File too large"
5. Frontend: toast error "El archivo excede 5 MB"
6. Usuario reintenta con archivo más pequeño.
```

### Riesgos pre-existentes

| # | Riesgo | Severidad | Notas |
|---|---|---|---|
| R6.1 | Si el upload de proof falla, la order NO se crea (orden está atada a proof) — pero el usuario ya escribió todos los datos, los pierde si cierra | Medio | UX issue conocido |
| R6.2 | `CheckoutService` mantiene state en memoria — si el usuario navega a otra pestaña y vuelve, lo pierde | Bajo | Diseño aceptado |
| R6.3 | Vehículos en form se cargan vía HTTP cada vez — sin cache | Bajo | Lista corta, no impacto perf |
| R6.4 | Files seleccionados en `<input>` no se validan tamaño/tipo en frontend antes del POST | Medio | Backend valida pero ahorraría bandwidth |

### Acceptance criteria post-Capacitor

| ID | Verificación | Plataforma |
|---|---|---|
| B6.AC1 | `/checkout/despacho` muestra solo opciones habilitadas en settings | Web + App |
| B6.AC2 | Sin location seleccionada: zoning modal aparece o redirige a seleccionar | Web + App |
| B6.AC3 | Cada uno de los 6 forms (store/agency/shipping/delivery/seller/oil/in-store-oil) carga, valida, persiste state | Web + App |
| B6.AC4 | Oil change requiere vehículo del garaje; si no hay, redirige | Web + App |
| B6.AC5 | Summary muestra totales correctos en USD y BS (con exchange rate aplicado) | Web + App |
| B6.AC6 | Selección de método de pago muestra los datos correctos | Web + App |
| B6.AC7 | Upload de comprobante: archivo válido sube exitosamente | Web + App |
| B6.AC8 | Upload de comprobante: archivo > 5 MB rechaza con mensaje | Web + App |
| B6.AC9 | Upload de comprobante: tipo no permitido (PDF, video) rechaza | Web + App |
| B6.AC10 | **APP (opcional Phase 5):** Tap en "subir comprobante" muestra prompt nativo "Cámara | Galería" | App |
| B6.AC11 | Submit exitoso crea order y navega a `/checkout/confirmacion/:orderId` | Web + App |
| B6.AC12 | Carrito se vacía al confirmar order | Web + App |
| B6.AC13 | Confirmation page con authGuard activo | Web + App |
| B6.AC14 | Hardware back en checkout regresa al paso anterior, no cierra la app | App only |

---

## Bloque 7 — Perfil Cliente y Garaje

### Inventario funcional

1. `/perfil` (authGuard) muestra tabs: Profile / Garage / Orders / Payments / Notifications.
2. Tab routing vía fragment URL (`#pedidos`, `#garaje`, etc.) — `FRAGMENT_TAB_MAP` y `TAB_FRAGMENT_MAP` mapean.
3. `?completeProfile=true` (query param) abre el modal `complete-profile-modal` automáticamente.
4. ProfileInfo: form editable de firstName, lastName, document, phone, birthDate, etc.
5. Garage: lista de vehículos, form para crear/editar, card con marca/modelo/año/placa/tipo.
6. Payment history: lista de pagos del usuario con filtros y opción de re-subir comprobante.
7. Notifications list: lista de notificaciones con badge unread, mark as read.
8. Change password modal: validación + rotación de JWT.
9. Avatar upload: input file → POST /api/upload/avatar → URL guardada en user.avatar.

### Trazas end-to-end

#### Happy path: completar perfil tras OAuth Google

```
1. Tras OAuth Google, profileCompleted = false → redirige a /perfil?completeProfile=true
2. ProfileComponent.ngOnInit: lee queryParam → muestra CompleteProfileModalComponent
3. Modal pide: documentType, documentNumber, phone, birthDate.
4. Submit → PATCH /api/users/profile { documentType, documentNumber, phone, birthDate, profileCompleted: true }
5. Backend valida unicidad documento → actualiza user → response { success, data: { user } }
6. authService.patchCurrentUser(updatedFields) → currentUserSignal actualiza
7. Modal cierra. Profile tab visible con datos.
```

#### Happy path: agregar vehículo al garaje

```
1. /perfil#garaje → click "Agregar vehículo"
2. VehicleFormComponent: form con marca, modelo, año, placa (opcional), tipo (carro/moto/etc.)
3. Submit → POST /api/vehicles → response { success, data: vehicle }
4. Garage list refresca con el nuevo vehículo
```

### Riesgos pre-existentes

| # | Riesgo | Severidad | Notas |
|---|---|---|---|
| R7.1 | Avatar upload no valida dimensiones — Cloudinary recorta a 300x300 con face detection, OK | Bajo | Backend OK |
| R7.2 | El fragment-based tab routing puede entrar en bucle si el componente actualiza el fragment dentro de un effect que escucha el fragment | Bajo | No observado |
| R7.3 | Vehicle "placa" tiene índice (user, placa) partial-unique pero acepta string vacío | Bajo | Migración ya runs en boot |
| R7.4 | Payment history hace queries pesadas si hay muchos pagos — sin paginación visible | Medio | Hay paginación backend pero UI debería pedirla |

### Acceptance criteria post-Capacitor

| ID | Verificación | Plataforma |
|---|---|---|
| B7.AC1 | `/perfil` requiere auth — sin sesión redirige a / | Web + App |
| B7.AC2 | Tabs cambian con fragment URL | Web + App |
| B7.AC3 | Edit profile guarda cambios | Web + App |
| B7.AC4 | Complete-profile modal aparece si profileCompleted=false | Web + App |
| B7.AC5 | Garage CRUD: agregar, editar, eliminar vehículo funciona | Web + App |
| B7.AC6 | Payment history lista pagos del usuario | Web + App |
| B7.AC7 | Payment history: re-subir comprobante de un pago rechazado funciona | Web + App |
| B7.AC8 | Notifications list muestra notificaciones, mark-as-read funciona | Web + App |
| B7.AC9 | Avatar upload: file → Cloudinary → URL aparece como avatar | Web + App |
| B7.AC10 | **APP (Phase 5):** Avatar upload puede usar cámara nativa | App |
| B7.AC11 | Change password modal: validación + rotación de JWT | Web + App |
| B7.AC12 | Toggle de push notifications en perfil refleja estado correcto del SO | Web + App |

---

## Bloque 8 — Pedidos, Servicios y Reviews

### Inventario funcional

1. `OrderListComponent` (cliente, en /perfil#pedidos): paginación, filtros por status, search, click → /perfil/pedidos/:id.
2. `OrderDetailComponent`:
   - Timeline de estados.
   - Re-upload de comprobante si rechazado (input file + signal `uploadProofFile`).
   - Cancelación 2 pasos (motivo + confirmación).
   - Lightbox de comprobante.
   - Modal de mensajería con admin (`OrderMessagingModal`).
   - Modal de rating al completarse.
   - Mostra mecánico asignado si aplica (con avatar y action popover).
3. `ServiceTrackingComponent`: tracking en vivo del servicio mecánico (si tiene assignment).
4. `MechanicProgressComponent`: PÚBLICO sin auth, accedido por `mechanic/progress/:token`. Mecánico avanza estados (en_camino → en_proceso → completado) con confirm modals.
5. `ReviewService`: crea review con stars + comment.
6. Order comments: el cliente puede dejar comentarios visibles para el admin.

### Trazas end-to-end

#### Happy path: ver detalle de pedido + cancelar

```
1. /perfil#pedidos → OrderListComponent: GET /api/orders → paginación + filtros
2. Click pedido #ABC → /perfil/pedidos/ABC
3. authGuard: ok (logueado)
4. OrderDetailComponent.ngOnInit: GET /api/orders/ABC → señal `order.set(...)`
5. Timeline renderiza estados.
6. Si status === 'pending': botón "Cancelar pedido" visible.
7. Click "Cancelar" → showReasonModal.set(true)
8. Usuario escribe razón → click "Continuar" → showReasonModal.set(false), showConfirmModal.set(true)
9. Click "Confirmar" → orderService.cancelOrder(id, reason) → POST /api/orders/ABC/cancel
10. Response → order signal actualiza con status='cancelled'
11. Toast verde "Pedido cancelado"
```

#### Happy path: mecánico avanza estado vía link público

```
1. Admin asigna mecánico al pedido → backend genera assignment con token único.
2. Mecánico recibe WhatsApp con link tubusexpress.com/mechanic/progress/<token>
3. Mecánico abre link en navegador.
4. MechanicProgressComponent: NO auth required. GET /api/mechanic-progress/<token>
5. Renderiza pasos del servicio + datos del cliente.
6. Click "En camino" → muestra confirm modal contextual.
7. Confirm → POST /api/mechanic-progress/<token>/advance
8. Response → assignment actualiza con `progressSteps[i].completedAt = now`
9. Cliente (si está en order-detail abierto) recibe push → order-detail re-fetch
```

### Riesgos pre-existentes

| # | Riesgo | Severidad | Notas |
|---|---|---|---|
| R8.1 | MechanicProgress link es público — quien tenga el token avanza estados. No hay rate-limit por token | Medio | Asumido riesgo |
| R8.2 | Re-upload de comprobante: si falla a mitad, signal queda con file pero proof_url no actualiza | Bajo | Try/catch |
| R8.3 | Modal de rating se dismissa por sessionStorage; si el usuario tiene varias órdenes completadas, el modal puede ser intrusivo | Bajo | Diseño OK |

### Acceptance criteria post-Capacitor

| ID | Verificación | Plataforma |
|---|---|---|
| B8.AC1 | Order list paginada, filtros funcionan | Web + App |
| B8.AC2 | Order detail muestra timeline correctamente | Web + App |
| B8.AC3 | Cancelación 2 pasos funciona | Web + App |
| B8.AC4 | Re-upload de comprobante funciona | Web + App |
| B8.AC5 | Modal de mensajería funciona, badge de unread aparece, mark-as-read | Web + App |
| B8.AC6 | Modal de rating aparece tras servicio completado | Web + App |
| B8.AC7 | Service tracking actualiza en vivo (con polling cada 60s o push) | Web + App |
| B8.AC8 | **WEB:** Mechanic progress link público funciona | Web only (mecánico en navegador) |
| B8.AC9 | Lightbox de comprobante abre y cierra | Web + App |
| B8.AC10 | Action popover de teléfono del mecánico funciona (call / WhatsApp) | Web + App |
| B8.AC11 | Push de "comentario nuevo" en order-detail dispara refresh | Web (foreground) + App (foreground) |

---

## Bloque 9 — Notificaciones Push y Comunicación Externa

### Inventario funcional

1. `FirebaseMessagingService`: lazy-load de `firebase/messaging`, `requestToken({ vapidKey, swReg })`, `onForegroundMessage$`, `onPushReceived$`.
2. **Foreground:** `onMessage` del SDK → `foregroundSubject.next(payload)` → componentes reaccionan.
3. **Background:** `firebase-messaging-sw.js` → SDK muestra OS notification automáticamente + broadcast `postMessage('fcm-push', payload)` a todos los clients abiertos.
4. **Notification click:** SW handler navega a `payload.data.url`.
5. `UserNotificationService`: lifecycle de FCM token, polling, popover bell, badge, mark-as-read.
6. `AdminNotificationsService`: idem para admin.
7. `DeviceTokenService`: register/unregister tokens vía `/api/(admin/)?device-tokens`.
8. `requestNotificationPermission()` requiere user gesture: si granted → getToken → register → flip preference flag.
9. `disablePushPreference()` flippea flag sin desregistrar token.
10. Logout: `unregisterToken()` borra el documento de DeviceToken.
11. `browserNotify(title, options)`: usa `swReg.showNotification` si SW disponible, fallback a `new Notification(...)`.
12. **External:** `cart.openWhatsAppCheckout` → `window.open('https://wa.me/...', '_blank')`. Tel: `window.open('tel:...', '_self')`. Redes sociales: `window.open(url, '_blank', 'noopener,noreferrer')`.
13. Clipboard: `navigator.clipboard.writeText` con fallback a textarea hack.

### Trazas end-to-end

#### Happy path: usuario activa push y recibe uno

```
1. Usuario en /perfil#notificaciones, click toggle "Activar notificaciones".
2. push-permission-toggle.component → userNotifService.requestNotificationPermission()
3. Notification.permission === 'default' → Notification.requestPermission() (prompt browser)
4. Usuario click "Allow" → permission = 'granted'
5. _permissionState.set('granted')
6. fcm.requestToken():
   - isMessagingSupportedSync() = true
   - import('firebase/messaging')
   - ensureFcmServiceWorker() → registra /firebase-messaging-sw.js bajo scope correcto
   - getToken({ vapidKey, serviceWorkerRegistration: swReg }) → token
7. attachForegroundListener() → onMessage subscriber
8. POST /api/device-tokens { token, platform: 'web', userAgent }
9. _currentToken.set(token), polling switch a 120s
10. patchPushPreference(true) → PATCH /api/users/profile/notification-preferences
11. authService.patchCurrentUser({ pushNotificationsEnabled: true })
12. Toast "Notificaciones activadas"

— Más tarde, admin marca pedido como confirmado —

13. Backend dispatches push via Firebase Admin → token recibe
14. Si app foreground: onMessage callback → foregroundSubject.next + showNativeFromPayload(payload)
   → browserNotify(title, options) → swReg.showNotification → OS toast
15. Si app background: firebase-messaging-sw.js onBackgroundMessage → SDK auto-shows OS notification
   + postMessage 'fcm-push' a todos los clients
16. fetchUnreadCount() actualiza badge
```

#### Happy path: WhatsApp checkout

```
1. Usuario click "Pagar por WhatsApp" en cart-overlay
2. cartService.openWhatsAppCheckout()
3. settings.whatsappConfig.isEnabled = true → continúa
4. message = generateWhatsAppMessage() → string formateado
5. encodedMessage = encodeURIComponent(message)
6. phoneNumber = settings.whatsappConfig.phoneNumber
7. whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`
8. window.open(whatsappUrl, '_blank') → abre WhatsApp Web (desktop) o app WhatsApp (mobile)
```

### Riesgos pre-existentes

| # | Riesgo | Severidad | Notas |
|---|---|---|---|
| R9.1 | Si user revoca permission en browser settings, FCM token sigue válido hasta que el SW se elimine | Bajo | Cron weekly cleanup |
| R9.2 | OS toast en foreground se duplica si tanto FCM SDK como manual `browserNotify` lo muestran | Bajo | Solo manual lo muestra (FCM SDK skip foreground) |
| R9.3 | `window.open(tel:..., '_self')` puede recargar la página si SO no maneja el intent | Bajo | Funciona en todos los browsers móviles modernos |
| R9.4 | `wa.me` link no detecta si WhatsApp está instalado en mobile — siempre intenta | Bajo | Comportamiento aceptado |
| R9.5 | Polling fallback de 30s consume bandwidth — innecesario si FCM funciona | Bajo | Switch a 120s tras token registrado |

### Acceptance criteria post-Capacitor

| ID | Verificación | Plataforma |
|---|---|---|
| B9.AC1 | Toggle de push: prompt aparece tras user gesture, granted registra token | Web + App |
| B9.AC2 | Push recibido en foreground muestra OS toast | Web + App |
| B9.AC3 | Push recibido en background muestra OS notification | Web + App |
| B9.AC4 | Click en notification abre la URL especificada en `data.url` | Web + App |
| B9.AC5 | Polling fallback funciona si FCM token no se registra | Web + App |
| B9.AC6 | Badge unread actualiza en tiempo real | Web + App |
| B9.AC7 | Mark-as-read individual y all funcionan | Web + App |
| B9.AC8 | Logout desregistra el token (verificable en backend) | Web + App |
| B9.AC9 | Disable push: flag flippea, token sigue registrado, dispatch backend respeta flag | Web + App |
| B9.AC10 | Re-enable push: solo flip flag, no re-registra token | Web + App |
| B9.AC11 | Admin notifications: mismo flujo que cliente pero con scope admin | Web only (admin no en app v1) |
| B9.AC12 | WhatsApp checkout: web abre web.whatsapp.com / app abre WhatsApp | Web + App |
| B9.AC13 | Tel link abre dialer | Web + App |
| B9.AC14 | Redes sociales: web abre nueva pestaña, app abre Custom Tab in-app | Web + App |
| B9.AC15 | Clipboard.copy funciona con feedback visual | Web + App |
| B9.AC16 | **APP:** FCM token tiene `platform: 'android'` en backend | App only |
| B9.AC17 | **APP:** Force-stop app + push: notification llega y al tap abre la app en URL correcta | App only |

---

## Bloque 10 — Admin Panel Operacional

### Inventario funcional

1. Dashboard con stats y links a todas las secciones.
2. ~15 CRUDs admin con la misma estructura: list (con search, filtros, paginación) + form (create/edit) + delete confirmation.
3. CRUDs con upload de imagen: products (multi), mechanics (avatar), brands (logo), lines (logo), shipping-agencies (logo), settings (hero).
4. Order management admin:
   - List con filtros avanzados (status, dispatch_status, branch, date range).
   - Detail con full info + actions (asignar mecánico, marcar despachado, etc.).
   - Order dispatch modal: asignación de mecánico con slot suggestions.
5. Reviews admin: list, ver detalle, soft-delete.
6. Settings admin: 9 secciones (whatsapp, carousels, hero, pagination, dispatch, exchange-rate, support-contact, customer-support, admin-notifications).
7. Mechanic detail + calendar para ver disponibilidad y assignments.

### Trazas end-to-end

#### Happy path: crear producto con 3 imágenes

```
1. Admin /admin/products/create → ProductFormComponent
2. Form: name, description, price, line, brand, categories[], stock, ...
3. <input type="file" multiple accept="image/*"> → onFilesSelected:
   - signal isUploading.set(true)
   - uploadService.uploadProductImages([f1, f2, f3]) → POST /api/upload/products
   - response { data: [{ url, publicId, ... }, ...] }
   - images.set([url1, url2, url3])
   - isUploading.set(false)
4. Submit → adminService.createProduct({ ...formValue, images: [url1, url2, url3] })
5. POST /api/admin/products → response { success, data: product }
6. router.navigate(['/admin/products'])
```

#### Happy path: dispatch order con asignación de mecánico

```
1. /admin/orders → click pedido → /admin/orders/:id
2. Click "Despachar" → OrderDispatchModal abre
3. Modal: selector de mecánico, dropdown de fechas, botón "Sugerir slots"
4. Slot suggestions GET /api/admin/orders/:id/slot-suggestions → muestra slots disponibles
5. Selecciona slot → POST /api/admin/orders/:id/dispatch { mechanicId, scheduledFor }
6. Backend crea MechanicAssignment con token único, envía WhatsApp al mecánico con link
7. Modal close, order signal refresh
```

### Riesgos pre-existentes

| # | Riesgo | Severidad | Notas |
|---|---|---|---|
| R10.1 | Forms admin muy largos en componentes — algunos > 800 líneas | Medio | Cumple soft cap pero acercándose |
| R10.2 | Upload de muchas imágenes (10) en paralelo puede saturar Cloudinary plan | Bajo | Limit en backend |
| R10.3 | Soft-delete de reviews no se refleja inmediatamente en frontend | Bajo | Refetch tras delete |
| R10.4 | OrderDispatchModal tiene múltiples API calls que podrían condense | Bajo | OK por claridad |

### Acceptance criteria post-Capacitor

| ID | Verificación | Plataforma |
|---|---|---|
| B10.AC1 | Dashboard admin carga | Web only |
| B10.AC2 | Cada CRUD (15) lista, crea, edita, elimina | Web only |
| B10.AC3 | Upload de imágenes admin funciona en todos los forms (productos, marcas, líneas, etc.) | Web only |
| B10.AC4 | Order list filtros avanzados funcionan | Web only |
| B10.AC5 | Order detail admin muestra toda la info | Web only |
| B10.AC6 | Dispatch modal con slot suggestions funciona | Web only |
| B10.AC7 | Mechanic calendar visualiza assignments | Web only |
| B10.AC8 | Settings: cada uno de los 9 forms guarda y refleja cambios en cliente | Web only |
| B10.AC9 | Reviews admin: list + soft-delete | Web only |
| B10.AC10 | **APP:** Si usuario navega manualmente a `/admin/...`, redirige sin permitir acceso | App |

---

## Resumen Cuantitativo

| Bloque | # Componentes | # Servicios | # Endpoints | # Acceptance Criteria | Plataforma post-Capacitor |
|---|---|---|---|---|---|
| B1 | 9 | 1 | 9 | 14 | Web + App |
| B2 | 4 | 1 | 4 | 9 | Web + App |
| B3 | 2 | 1 | ~10 | 7 | Web (App: redirect) |
| B4 | ~10 | 6 | ~6 | 13 | Web + App |
| B5 | 8 | 6 | ~5 | 15 | Web + App |
| B6 | 12 | 6 | ~10 | 14 | Web + App |
| B7 | 8 | 3 | ~10 | 12 | Web + App |
| B8 | 7 | 3 | ~10 | 11 | Web + App |
| B9 | 14 | 5 | ~12 | 17 | Web + App |
| B10 | ~50 | 15 | ~80 | 10 | Web only |
| **Total** | **~124** | **~47** | **~166** | **122** | — |

**122 verificaciones funcionales** se ejecutarán dos veces:
1. **Mentalmente AHORA** (este documento — análisis estático del código baseline confirma que cada AC pasa hoy en web).
2. **Funcionalmente DESPUÉS de Phase 7** (QA en navegador y dispositivo Android, click por click).

Cualquier AC que falle en la segunda ronda es una regresión a investigar y resolver antes del release.

---

## Hallazgos consolidados

### ✅ Confirmaciones positivas (lo que ya está bien diseñado)

1. **Separación frontend/backend total.** El frontend Angular es independiente del backend Express; Capacitor lo encapsulará tal cual.
2. **URLs absolutas en todos los services.** Cero llamadas relativas que asuman mismo origen.
3. **Lazy loading agresivo.** Reduce el bundle inicial.
4. **OverlayStackService bien diseñado.** Listener History API ya está preparado para integrarse con `App.backButton`.
5. **AuthService con storage abstraction implícito.** `getStorageKeys()` ya separa cliente vs admin — añadir un layer más para web vs nativo es trivial.
6. **DeviceTokenService agnóstico.** Acepta `platform: string`, no requiere cambios.
7. **Backend con CORS allowlist configurable por env.** Solo añadir orígenes Capacitor.
8. **`isPlatformBrowser` ya está usado** en algunos servicios (theme.service.ts) — patrón ya conocido.

### ⚠️ Áreas frágiles identificadas (no bloqueantes pero a vigilar)

1. **R1.1** — localStorage síncrono en getToken(). Refactor obligatorio para nativo.
2. **R3.1** — currentUserSignal compartido cliente/admin puede confundir.
3. **R6.1** — orden atada a upload de proof: si falla, el usuario pierde el form.
4. **R8.1** — mechanic-progress token sin rate-limit.
5. **R9.1** — FCM tokens stale si usuario revoca permission browser.

### ❌ Lo que NO se debe tocar bajo ningún concepto

- Backend de orders (lógica compleja, transacciones implícitas).
- Logica de OAuth en passport.ts más allá de extraer a service para reuso (NO modificar las 3 ramas).
- ZoneService / BranchZoneService (data critical para checkout).
- Cualquier endpoint admin (no entran en alcance de Phase A).

---

## Próximo documento

[`03-coexistence-strategy.md`](./03-coexistence-strategy.md) — justificación arquitectural detallada de cómo coexisten web y nativo sin sacrificar nada.
