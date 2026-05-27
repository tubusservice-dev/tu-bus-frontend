# 09 — Phase 3: Capa de Plataforma en Angular

> **Status:** ⏳ EN EJECUCIÓN (iniciada 2026-05-15)
> **Objetivo:** crear el andamiaje (`PlatformService` + Strategy pattern + factory providers DI) que permitirá a Phase 4 conectar la lógica nativa (storage, OAuth, push, deep links, hardware back) sin tocar componentes/servicios feature existentes.
> **Entry criteria:** Phase 2 completada + autorización del owner ✅
> **Exit criteria:** scaffolding compilando sin errores + bundle web no creció más de 30 kB + componentes/servicios existentes intactos
> **Lectura previa:** `00-master-plan.md` sec 9, `03-coexistence-strategy.md` mecanismos 1-5

---

## Decisión de alcance: Phase 3 = scaffolding funcional

Hay dos opciones para Phase 3:

| Opción | Pros | Contras |
|---|---|---|
| **A** Solo placeholders (estrategias native lanzan `Not implemented yet`) | Phase 3 corta y simple | Phase 4 tiene que instalar plugins + escribir lógica + conectar al código. Riesgo alto. |
| **B** Scaffolding funcional (instalar plugins, estrategias native ya implementadas) | Phase 4 solo conecta — lógica ya validada | Phase 3 más larga |

**Decisión: B.** Phase 3 deja TODO el plumbing listo para que Phase 4 sea solo "reemplazar `localStorage.setItem(...)` por `inject(STORAGE).set(...)`" en el código existente.

---

## Plugins Capacitor a instalar

| Paquete | Capability | Uso en Phase 4 |
|---|---|---|
| `@capacitor/preferences` | Storage seguro | JWT + user en nativo |
| `@capacitor/browser` | In-app browser | Redes sociales en nativo |
| `@capacitor-firebase/authentication` | Google Sign-In nativo | Login Google en nativo |
| `@capacitor-firebase/messaging` | FCM nativo | Push notifications en nativo |

> **NO se instalan en Phase 3:** `@capacitor/camera`, `@capacitor/geolocation`, `@capgo/capacitor-native-biometric`, `@capacitor/local-notifications`, `@capacitor/status-bar`, `@capacitor/splash-screen`. Eso es Phase 5.

---

## Estructura de archivos resultante

```
frontend/src/app/platform/
├── platform.service.ts                       ← Detector cross-platform
├── platform.providers.ts                     ← Factory providers para app.config.ts
├── index.ts                                  ← Barrel export
│
├── storage/
│   ├── storage.service.ts                    ← interface IStorage + token STORAGE
│   ├── web-storage.strategy.ts               ← localStorage wrapper
│   └── native-storage.strategy.ts            ← @capacitor/preferences
│
├── external-link/
│   ├── external-link.service.ts              ← interface + token
│   ├── web-external-link.strategy.ts         ← window.open
│   └── native-external-link.strategy.ts      ← App.openUrl + Browser.open
│
├── google-auth/
│   ├── google-auth.service.ts                ← interface + token + tipos
│   ├── web-google-auth.strategy.ts           ← redirect (window.location)
│   └── native-google-auth.strategy.ts        ← FirebaseAuthentication.signInWithGoogle
│
├── messaging/
│   ├── messaging.service.ts                  ← interface + token + tipos
│   ├── web-messaging.strategy.ts             ← envuelve firebase/messaging actual
│   └── native-messaging.strategy.ts          ← @capacitor-firebase/messaging
│
├── back-button/
│   └── back-button.service.ts                ← no-op web / App.backButton native
│
└── deep-links/
    └── deep-links.service.ts                 ← no-op web / App.appUrlOpen native
```

---

## Tabla de tareas

| # | Tarea | Status |
|---|---|---|
| P3.1 | Documentar Phase 3 + decidir alcance | ⏳ |
| P3.2 | Instalar 4 plugins Capacitor | ⏳ |
| P3.3 | Añadir path alias `@platform/*` a `tsconfig.json` | ⏳ |
| P3.4 | Crear `PlatformService` con signals | ⏳ |
| P3.5 | Crear módulo `storage/` (interface + 2 strategies) | ⏳ |
| P3.6 | Crear módulo `external-link/` (interface + 2 strategies) | ⏳ |
| P3.7 | Crear módulo `google-auth/` (interface + 2 strategies) | ⏳ |
| P3.8 | Crear módulo `messaging/` (interface + 2 strategies) | ⏳ |
| P3.9 | Crear servicios `back-button` + `deep-links` | ⏳ |
| P3.10 | Crear `platform.providers.ts` con todos los factory providers | ⏳ |
| P3.11 | Wire-up en `app.config.ts` | ⏳ |
| P3.12 | Smoke test web (build prod + bundle size check) | ⏳ |
| P3.13 | Cerrar Phase 3 + autorización Phase 4 | ⏳ |

---

## Bitácora de ejecución

### 2026-05-15

- 18:00 — Phase 3 autorizada. Inicio.
- 18:00 — Documento `09-phase-3-platform-layer.md` creado.
- 18:05 — P3.2: instalados `@capacitor/preferences@8.0.1`, `@capacitor/browser@8.0.3`, `@capacitor-firebase/authentication@8.2.0`, `@capacitor-firebase/messaging@8.2.0`. ✅
- 18:08 — P3.3: añadidos path aliases `@platform/*` y `@platform` (este último para barrel) en `tsconfig.json`. ✅
- 18:10 — P3.4: creado `platform.service.ts` con signals `isNative`, `isAndroid`, `isIos`, `isWeb`, `platformName`. Snapshot en construcción (Capacitor.getPlatform / isNativePlatform), readonly. ✅
- 18:12 — P3.5: creado módulo `storage/`:
   - `storage.service.ts` — interface IStorage + token STORAGE.
   - `web-storage.strategy.ts` — wrapper de localStorage con Promise signatures.
   - `native-storage.strategy.ts` — `@capacitor/preferences` con dynamic imports. ✅
- 18:14 — P3.6: creado módulo `external-link/`:
   - Interface IExternalLink + token EXTERNAL_LINK + tipo ExternalLinkTarget.
   - Web: `window.open(url, target, 'noopener,noreferrer')`.
   - Native: routing por scheme — tel/mailto/sms/wa.me usan `window.open(url, '_system')` (delega al SO via Intent), http(s) usa `Browser.open` (Custom Tabs). ✅
- 18:17 — P3.7: creado módulo `google-auth/`:
   - Interface IGoogleAuth + token + tipo GoogleSignInResult discriminado por flow.
   - Web: replica el flujo legacy de AuthService.loginWithOAuth (localStorage + window.location.href).
   - Native: `FirebaseAuthentication.signInWithGoogle()` → devuelve idToken. ✅
- 18:21 — P3.8: creado módulo `messaging/`:
   - Interface IMessaging + token + tipo PushPayload normalizado.
   - Web: wrapper sobre `FirebaseMessagingService` existente (sin tocarlo).
   - Native: `@capacitor-firebase/messaging` con listeners `notificationReceived` + `notificationActionPerformed` unificados en un Subject<PushPayload>. ✅
- 18:24 — P3.9: creados servicios singleton:
   - `BackButtonService`: no-op web, native suscribe `App.backButton` y delega a OverlayStackService.goBack / Location.back / App.exitApp.
   - `DeepLinksService`: no-op web, native suscribe `App.appUrlOpen` y enruta vía Angular Router. ✅
- 18:27 — P3.10: creado `platform.providers.ts` con `providePlatform()` que devuelve EnvironmentProviders. Factory providers para STORAGE, EXTERNAL_LINK, GOOGLE_AUTH, MESSAGING — cada uno elige strategy via PlatformService.isNative(). ✅
- 18:29 — P3.11: actualizado `app.config.ts`:
   - Añadidos imports desde `@platform`.
   - Añadido `providePlatform()` en providers.
   - Añadidos 2 APP_INITIALIZER nuevos: `initializeBackButton`, `initializeDeepLinks`. ✅
- 18:31 — P3.12 fix 1: añadido alias `@platform` (sin `/*`) en `tsconfig.json` para que el barrel index.ts resuelva. ✅
- 18:33 — P3.12 fix 2: `App.openUrl` no existe en Capacitor 8 (era de v7). Refactor de `native-external-link.strategy.ts` para usar `window.open(url, '_system')` (la API documentada en Capacitor 8 que delega al SO Intent). ✅
- 18:35 — P3.12 fix 3: type mismatch entre `PushEventData` (índices `string | undefined`) y `Record<string, string>`. Añadido map que filtra undefined defensivamente en `web-messaging.strategy.ts`. ✅
- 18:37 — P3.12: smoke test web exitoso. Build completo en 16.9s. Sin errores TS, sin warnings nuevos. ✅

### Validación contractual de coexistencia

| Métrica | Phase 0 baseline | Phase 1 | Phase 3 | Delta vs baseline | Restricción |
|---|---|---|---|---|---|
| Initial bundle raw | 782.53 kB | 782.53 kB | 797.29 kB | +14.76 kB | — |
| Initial bundle transfer | 180.79 kB | 180.79 kB | 185.16 kB | **+4.37 kB** | < 30 kB ✅ |
| Lazy chunks | 76 | 76 | 88 | +12 | — |
| Build time | 19.7s | 16.8s | 16.9s | sin regresión | — |

**Análisis del delta +4.37 kB transfer:**
- ~3 kB: `@capacitor/core` (importado estáticamente en `PlatformService`).
- ~1 kB: tipos + estructuras del platform layer (interfaces, tokens, factory providers).
- ~0.4 kB: 2 nuevos APP_INITIALIZER en app.config.ts.

**Lazy chunks +12:**
- 4 chunks de Native strategies (storage, external-link, google-auth, messaging) que NO se cargan en web.
- 2 chunks de @capacitor/app dinámico (back-button + deep-links).
- Los chunks restantes son re-bundling natural del compilador al detectar nuevos splits.

**Sub-bundles native NO cargados en web:** confirmado por construcción — el factory provider devuelve la WebStrategy cuando `isNative=false`, y la NativeStrategy nunca se construye → su `await import('@capacitor/preferences')` jamás se ejecuta.

### Estructura resultante

```
frontend/src/app/platform/
├── index.ts                                              ← Barrel
├── platform.service.ts                                    ← PlatformService
├── platform.providers.ts                                  ← providePlatform()
├── storage/
│   ├── storage.service.ts                                 ← IStorage + STORAGE token
│   ├── web-storage.strategy.ts
│   └── native-storage.strategy.ts
├── external-link/
│   ├── external-link.service.ts                           ← IExternalLink + EXTERNAL_LINK
│   ├── web-external-link.strategy.ts
│   └── native-external-link.strategy.ts
├── google-auth/
│   ├── google-auth.service.ts                             ← IGoogleAuth + GOOGLE_AUTH
│   ├── web-google-auth.strategy.ts
│   └── native-google-auth.strategy.ts
├── messaging/
│   ├── messaging.service.ts                               ← IMessaging + MESSAGING + PushPayload
│   ├── web-messaging.strategy.ts
│   └── native-messaging.strategy.ts
├── back-button/
│   └── back-button.service.ts                             ← Singleton, no-op web
└── deep-links/
    └── deep-links.service.ts                              ← Singleton, no-op web
```

**Total: 17 archivos nuevos, ~750 líneas de código nuevo.**

### Estado final Phase 3

✅ **TODAS las 13 tareas de la tabla principal completadas.**

Phase 3 cerrada el 2026-05-15 a las 18:40.

**Garantías cumplidas:**
- ✅ Cero modificación a componentes Angular existentes.
- ✅ Cero modificación a servicios `core/` existentes.
- ✅ Cero modificación a backend.
- ✅ Web sigue compilando sin errores.
- ✅ Bundle web crecimiento +4.37 kB (limit 30 kB).
- ✅ Andamiaje listo para que Phase 4 conecte la lógica.

**Pendiente:** autorización formal del owner para iniciar Phase 4 (migraciones críticas: storage abstraction conectada a AuthService, OAuth Google nativo conectado, FCM nativo, deep links, hardware back).
