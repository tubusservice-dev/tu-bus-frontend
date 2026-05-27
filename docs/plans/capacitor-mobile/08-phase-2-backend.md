# 08 — Phase 2: Backend (CORS + OAuth nativo)

> **Status:** ⏳ EN EJECUCIÓN (iniciada 2026-05-15)
> **Objetivo:** ampliar el backend con (a) `CORS_ORIGINS` que incluya orígenes Capacitor, (b) endpoint nuevo `POST /api/auth/google/native` para validar `idToken` enviados por la app móvil, (c) refactor de `passport.ts` para extraer la lógica de las 3 ramas a un service reusable.
> **Entry criteria:** Phase 1 completada (`07-phase-1-bootstrap.md`) + autorización formal del owner ✅
> **Exit criteria:** backend compila sin errores TS + endpoint nuevo testeable + web actual NO regresiona + env vars documentadas para Railway
> **Lectura previa:** `00-master-plan.md` sec 8, `02-block-baseline-tests.md` (B2), `03-coexistence-strategy.md` mecanismo 3

---

## Tabla de tareas

| # | Tarea | Status |
|---|---|---|
| P2.1 | Documentar Phase 2 + leer archivos a modificar | ⏳ A EJECUTAR |
| P2.2 | Instalar `google-auth-library` en backend | ⏳ A EJECUTAR |
| P2.3 | Refactor: extraer lógica de `passport.ts` a `userService.findOrCreateFromGoogleProfile()` | ⏳ A EJECUTAR |
| P2.4 | Actualizar `passport.ts` para usar el nuevo service (preserva flujo web actual) | ⏳ A EJECUTAR |
| P2.5 | Crear `authController.googleNative()` + tipos | ⏳ A EJECUTAR |
| P2.6 | Añadir ruta `POST /api/auth/google/native` en `auth.routes.ts` | ⏳ A EJECUTAR |
| P2.7 | Actualizar `config/index.ts` con `GOOGLE_CLIENT_ID_ANDROID` y `GOOGLE_CLIENT_ID_WEB_FIREBASE` | ⏳ A EJECUTAR |
| P2.8 | Compilar TypeScript del backend (`tsc --noEmit`) sin errores | ⏳ A EJECUTAR |
| P2.9 | Generar instrucciones para owner: actualizar env vars en Railway | ⏳ A EJECUTAR |
| P2.10 | Cerrar Phase 2: actualizar log + pedir autorización Phase 3 | ⏳ A EJECUTAR |

---

## Diseño de la solución

### Problema actual (web)

```
Cliente Web → window.location.href = '/api/auth/google'
            → Passport-Google redirige a Google
            → Google callback → req.user populado
            → authController.oauthCallback genera JWT
            → res.redirect a clientUrl/auth/callback?token=JWT
```

**Esto funciona perfecto en web. NO se debe romper.**

### Problema nuevo (móvil)

WebView Android no puede ejecutar `window.location.href` a Google OAuth (Google bloquea WebViews embebidos por seguridad). Por tanto la app usa **Google Sign-In nativo** (Firebase Auth Capacitor plugin), obtiene un `idToken` directamente del SDK Google del dispositivo, y lo envía al backend.

```
App Android → FirebaseAuthentication.signInWithGoogle()
            → recibe { idToken }
            → POST /api/auth/google/native { idToken }
            → backend valida idToken con google-auth-library
            → backend hace findOrCreateUser (misma lógica que Passport)
            → backend devuelve { token, user } como JSON (NO redirect)
            → app persiste el JWT y procede igual que el flujo web
```

### Lo que cambia y lo que NO

| Aspecto | Web (actual) | App nativa (nueva) | Backend cambio |
|---|---|---|---|
| Inicio del flujo | `window.location.href` → backend redirige a Google | Plugin nativo Capacitor abre Google nativo | Cero cambio web |
| Validación de identidad | Passport-Google-OAuth20 | `google-auth-library.verifyIdToken` | Endpoint nuevo |
| Lógica de find/create user | 3 ramas en `passport.ts` | **Misma** lógica reusada | Refactor a service |
| Respuesta al cliente | HTTP 302 redirect | HTTP 200 JSON | Endpoint nuevo |
| Tokens emitidos | Mismo JWT custom | Mismo JWT custom | — |

### Refactor: `userService.findOrCreateFromGoogleProfile`

Hoy las 3 ramas viven inline en `config/passport.ts`. Las extraemos a un método del service `user.service.ts` que reciba un payload normalizado (no `Profile` de passport, no `TokenPayload` de google-auth-library — un tipo nuestro):

```typescript
interface GoogleProfilePayload {
  googleId: string;        // sub claim
  email: string | undefined;
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

// Returns IUser. Throws OAUTH_LOCAL_COLLISION error if branch 2 hits.
async findOrCreateFromGoogleProfile(payload: GoogleProfilePayload): Promise<IUser>
```

`passport.ts` y `authController.googleNative` lo llaman ambos con el mismo contrato.

### Validación del `idToken` (audience)

El backend acepta tokens cuyo `aud` matchea cualquiera de los 3 client IDs (ver `05-decisions-log.md` "Hallazgo Arquitectural — Dos Proyectos Google Cloud"):

```typescript
const VALID_AUDIENCES = [
  config.oauth.google.clientId,                   // Web Passport (existente)
  config.oauth.google.clientIdAndroid,            // Android nativo (NUEVO)
  config.oauth.google.clientIdWebFirebase,        // Web Firebase server (NUEVO)
];

const ticket = await client.verifyIdToken({ idToken, audience: VALID_AUDIENCES });
```

---

## Bitácora de ejecución

### 2026-05-15

- 17:30 — Phase 2 autorizada. Inicio.
- 17:30 — Documento `08-phase-2-backend.md` creado.
- 17:32 — P2.2: `npm install --save google-auth-library` exitoso (versión 10.6.2). Ya existía como dep transitiva de `firebase-admin`, ahora también directa. ✅
- 17:35 — P2.3: extraída lógica de las 3 ramas de Passport a `userService.findOrCreateFromGoogleProfile(payload: GoogleProfilePayload)`. Constante `OAUTH_LOCAL_COLLISION` declarada en `user.service.ts` como source of truth. AppError 409 con code se lanza en colisión local. ✅
- 17:38 — P2.4: `config/passport.ts` refactorizado para llamar al service. La GoogleStrategy callback se redujo de ~50 líneas a 15 (solo normaliza Profile→GoogleProfilePayload y traduce AppError→done(err) sentinel). El re-export `OAUTH_LOCAL_COLLISION` desde `passport.ts` se mantiene para no romper imports existentes en `auth.routes.ts`. ✅
- 17:42 — P2.5: `authController.googleNative()` añadido en `auth.controller.ts:457-553`. Verifica `idToken` con `OAuth2Client.verifyIdToken({ audience: [3 client IDs] })`, llama `findOrCreateFromGoogleProfile`, ejecuta `assertAccountUsable`, devuelve JSON `{ success, data: { token, user } }`. ✅
- 17:45 — P2.6: ruta `POST /api/auth/google/native` añadida en `auth.routes.ts` con `loginRateLimit + body('idToken').isString().notEmpty() + validateRequest`. ✅
- 17:47 — P2.7: `config.oauth.google` extendido con `clientIdAndroid` (env `GOOGLE_CLIENT_ID_ANDROID`) y `clientIdWebFirebase` (env `GOOGLE_CLIENT_ID_WEB_FIREBASE`). Defaults vacíos — el endpoint nativo rechaza tokens si no se configuran. ✅
- 17:50 — P2.8: `npx tsc --noEmit` exitoso (cero errores TS). `npm run build` (tsc + tsc-alias + copy:assets) exitoso. `npm test` reporta 36 tests pasando + 9 fallando — los 9 fallidos son **pre-existentes** en `branch-products` y `orders` (errores de mocking de Mongoose populate), **NO causados por mis cambios**. Mis archivos modificados (users/services, users/controllers, users/routes, config) no tienen tests directos y no se ven afectados. ✅

### Cambios resumidos

| Archivo | Tipo | Líneas |
|---|---|---|
| `backend/src/modules/users/services/user.service.ts` | Modificado: añadido `findOrCreateFromGoogleProfile` + tipos + constante `OAUTH_LOCAL_COLLISION` | +90 / -0 |
| `backend/src/config/passport.ts` | Modificado: refactor para usar el service. Re-exporta `OAUTH_LOCAL_COLLISION`. | +12 / -45 |
| `backend/src/modules/users/controllers/auth.controller.ts` | Modificado: nuevo método `googleNative` + import OAuth2Client | +97 / -0 |
| `backend/src/modules/users/routes/auth.routes.ts` | Modificado: nueva ruta `POST /google/native` | +18 / -1 |
| `backend/src/config/index.ts` | Modificado: añadidos `clientIdAndroid` y `clientIdWebFirebase` | +20 / -1 |
| `backend/package.json` | Modificado: `google-auth-library` añadido como dep directa | +1 / -0 |
| `backend/package-lock.json` | Modificado: lockfile actualizado | regenerado |

### Validación contractual

| Garantía | Validación |
|---|---|
| Backend compila sin errores TS | ✅ `npx tsc --noEmit` clean |
| Build full pasa | ✅ `npm run build` clean |
| Cero modificación a endpoints existentes | ✅ Solo se añadió uno nuevo + refactor interno transparente |
| Web flow Passport NO se rompe | ✅ Misma lógica, mismo resultado, solo extraída a service. Re-export del sentinel preserva imports |
| Sin tests fallando por Phase 2 | ✅ 36 pasan; 9 fallan pero pre-existentes en orders/branch-products |
| Cero variables existentes renombradas | ✅ Solo se AÑADEN 2 (`GOOGLE_CLIENT_ID_ANDROID`, `GOOGLE_CLIENT_ID_WEB_FIREBASE`) |

### Estado final Phase 2

✅ **TODAS las 10 tareas de la tabla principal completadas.**

Phase 2 cerrada el 2026-05-15 a las 17:55.

**Pendiente del lado del owner:**

1. **Añadir 2 env vars nuevas en Railway** (ver sección "Acción del owner" abajo).
2. **Pushear los cambios del backend** y deployear a Railway.
3. **Smoke test post-deploy:** verificar que web Google login sigue funcionando en producción.
4. **Autorización formal para iniciar Phase 3** (capa de plataforma en Angular).

---

## 🔑 Acción del owner — Añadir env vars en Railway

Las nuevas env vars son **aditivas y opcionales** — sin ellas, el endpoint `POST /api/auth/google/native` rechaza con `OAUTH_NOT_CONFIGURED`. La web actual sigue funcionando idéntico.

### En Railway → tu-bus-backend → Variables → New Variable

Añadir las 2 siguientes:

```
GOOGLE_CLIENT_ID_ANDROID=1071922885496-2knh1l8lkintplr4oc8j4iibla2v5j1d.apps.googleusercontent.com
GOOGLE_CLIENT_ID_WEB_FIREBASE=1071922885496-ggktf2e4q2a1kl7pjt866rqvm8ad0gft.apps.googleusercontent.com
```

> **No añadir `CORS_ORIGINS` todavía.** El backend actual sigue usando el fallback de `CLIENT_URL` + localhost. Lo añadiremos cuando empecemos a probar la app Android contra producción (Phase 4 o Phase 6, según convenga). Por ahora todo sigue funcionando idéntico.

### Smoke test web post-deploy

Una vez Railway termine el deploy del nuevo commit:

1. Abrir https://tubusexpress.com en navegador.
2. Click "Continuar con Google" en el modal de login.
3. Completar el flujo OAuth.
4. Verificar que entras a /perfil correctamente.

Si funciona → Phase 2 confirmada en producción. ✅
Si falla → revisamos juntos los logs de Railway.
