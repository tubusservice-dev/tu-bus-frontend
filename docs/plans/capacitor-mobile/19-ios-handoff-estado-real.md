# 19 — Handoff iOS: estado real al 2026-06-22 (Fase A completada)

> **Status:** Fase A (trámites Apple + Firebase + Railway) ✅ **COMPLETA**. Fase B (armado en Mac/Xcode) 🟡 **EN CURSO** — el 2026-06-23 se ejecutaron los bloques A-I del checklist en el Mac (proyecto `ios/` generado, compila y corre en Simulador). Bitácora completa en [`20-ios-mac-build-session.md`](./20-ios-mac-build-session.md). Pendiente: firma con la cuenta Apple + QA en iPhone + Archive/TestFlight.
> **Propósito:** punto de partida para el día del Mac. Recoge los **datos reales** ya recolectados y exactamente qué falta. Complementa el checklist genérico [`17-mac-handoff-checklist.md`](./17-mac-handoff-checklist.md) con los valores concretos del proyecto.
> **Owner:** Luis Manuel Carvallo Gomez — cuenta Apple Developer **Individual** ("Persona física"), activa hasta 2027-06-08.
> **Nota de seguridad:** los identificadores de abajo (Team ID, Key IDs, Bundle ID) **no son secretos** (Apple los expone en su consola y no sirven sin la llave privada). Los **secretos reales** son el *contenido* de los archivos `.p8` y la `APPLE_PRIVATE_KEY` — esos viven solo en `Firma de la App/`, Firebase y Railway, **nunca en el repo**.

---

## 1. Resumen

El ~70 % del código iOS ya estaba hecho desde el "Windows track" (login con Apple en backend + frontend, ver [`16-phase-B-windows-track.md`](./16-phase-B-windows-track.md)). El 2026-06-22 se completó **toda la parte administrativa** (Fase A): se sacaron las credenciales de Apple, se registró la app en Firebase y se encendió el login con Apple en el servidor de producción.

**Lo que queda (Fase B) es 100 % en la Mac, con Xcode**: generar la carpeta `ios/`, instalar dependencias nativas, configurar firmas, correr la app y subir a TestFlight.

---

## 2. Pre-requisitos (estado al 2026-06-22)

| # | Requisito | Estado |
|---|---|---|
| Xcode instalado en la Mac | ✅ Sí |
| Cuenta Apple Developer activa | ✅ Sí (Individual, renueva 2027-06-08) |
| Acceso a Firebase Console | ✅ Sí (proyecto `TuBusExpress`) |
| Acceso a Railway | ✅ Sí |
| **iPhone físico para QA** | ❌ **NO disponible** — ver §8 |
| Proyecto clonado en la Mac | ✅ Sí (rama `feat/capacitor-ios`) |

---

## 3. Datos reales recolectados (configuración del proyecto)

| Dato | Valor | Dónde se usa |
|---|---|---|
| **Apple Team ID** | `M39UFF5WFX` | AASA, env var `APPLE_TEAM_ID`, Xcode Signing |
| **Bundle ID / App ID** | `com.tubusexpress.app` | env var `APPLE_BUNDLE_ID`, Xcode, Firebase iOS |
| **Service ID (Sign in with Apple)** | `com.tubusexpress.app.signin` | env var `APPLE_SERVICE_ID`, Firebase Apple auth |
| **APNs Key (notificaciones)** | archivo `AuthKey_7YRB33RBB2.p8` — Key ID `7YRB33RBB2` | subida a Firebase Cloud Messaging (dev + prod) |
| **Sign in with Apple Key (login)** | archivo `AuthKey_UUF383R894.p8` — Key ID `UUF383R894` | env var `APPLE_KEY_ID` + `APPLE_PRIVATE_KEY` + Firebase Apple auth |

> Los dos archivos `.p8` están guardados en `C:\Project\tu-bus-service\Firma de la App\` (carpeta fuera de git, junto al keystore de Android).

---

## 4. Trámites completados (Fase A)

### Apple Developer
- [x] **T1** — Team ID anotado: `M39UFF5WFX`.
- [x] **T2** — App ID `com.tubusexpress.app` creado con capabilities: Push Notifications, Sign in with Apple, Associated Domains.
- [x] **T3** — Service ID `com.tubusexpress.app.signin` creado.
- [x] **T4** — APNs Auth Key generada (`AuthKey_7YRB33RBB2.p8`, Key ID `7YRB33RBB2`).
- [x] **T5** — Sign in with Apple Key generada (`AuthKey_UUF383R894.p8`, Key ID `UUF383R894`, Primary App ID = `com.tubusexpress.app`).

### Firebase (proyecto `TuBusExpress`)
- [x] **T6** — App iOS registrada con bundle `com.tubusexpress.app`. `GoogleService-Info.plist` descargado a `Firma de la App/`.
- [x] **T7** — Proveedor **Apple** habilitado en Authentication → Sign-in method (Services ID + Team ID + Key ID `UUF383R894` + private key).
- [x] **T8** — APNs Key `7YRB33RBB2` subida en Cloud Messaging, en **ambos** entornos (desarrollo **y** producción).

### Railway (servicio `tu-bus-express-backend`)
- [x] **T9** — Las 5 env vars Apple añadidas (aditivas, sin tocar las existentes):
  - `APPLE_BUNDLE_ID` = `com.tubusexpress.app`
  - `APPLE_SERVICE_ID` = `com.tubusexpress.app.signin`
  - `APPLE_TEAM_ID` = `M39UFF5WFX`
  - `APPLE_KEY_ID` = `UUF383R894`
  - `APPLE_PRIVATE_KEY` = contenido de `AuthKey_UUF383R894.p8`

> **Nota técnica:** el backend ([`auth.controller.ts:684`](../../../../backend/src/modules/users/controllers/auth.controller.ts)) hoy solo usa `APPLE_BUNDLE_ID` y `APPLE_SERVICE_ID` (como `audience`) para validar el login. `TEAM_ID`, `KEY_ID` y `PRIVATE_KEY` quedan listas pero reservadas para una función futura (revocación de sesiones).

---

## 5. Verificación de producción (2026-06-22)

Prueba al endpoint público con un token inválido:

```
POST https://api.tubusexpress.com/api/auth/apple/native
body: {"identityToken":"invalid-token-for-verification"}
→ 401 {"success":false,"message":"Token de Apple inválido","code":"ACCOUNT_NOT_FOUND","reason":"jwt malformed"}
```

Interpretación: el servidor **ya está configurado** (antes respondía `OAUTH_NOT_CONFIGURED`). El login con Apple está **encendido en producción** y no rompió nada de la web ni de Android.

---

## 6. Archivos a llevar a la Mac

| Archivo | ¿Llevar a la Mac? | Por qué |
|---|---|---|
| `GoogleService-Info.plist` | ✅ **SÍ** | Xcode lo necesita dentro del proyecto iOS |
| `AuthKey_7YRB33RBB2.p8` (APNs) | ❌ No | Ya está subida a Firebase |
| `AuthKey_UUF383R894.p8` (login) | ❌ No | Ya está en Firebase + Railway |

> Lo único que cruza a la Mac es el `GoogleService-Info.plist`.

---

## 7. Qué falta — Fase B (en la Mac, con Xcode)

> **Actualización 2026-06-23:** los pasos 1-8 de abajo ya se ejecutaron en el Mac (ver [`20-ios-mac-build-session.md`](./20-ios-mac-build-session.md)) — el proyecto `ios/` existe, compila y corre en Simulador con datos de producción. **Lo que sigue pendiente:** loguear la cuenta Apple `M39UFF5WFX` en Xcode (paso 7), re-desplegar el frontend con el AASA (paso 8), y los pasos 9-11 (Run, QA en iPhone, TestFlight).

Sigue el checklist [`17-mac-handoff-checklist.md`](./17-mac-handoff-checklist.md). Resumen con los datos reales ya insertados:

1. En la Mac, en el repo `tu-bus-frontend` (rama `feat/capacitor-ios`): `git pull` + `npm install` + `npm run build:prod`.
2. `npx cap add ios` → genera la carpeta `ios/`.
3. Copiar los assets pre-generados de `resources/ios-staging/` (AppIcon + Splash) a `ios/App/App/Assets.xcassets/`.
4. Copiar el `GoogleService-Info.plist` a `ios/App/App/`.
5. En `ios/App/App/Info.plist`: pegar las 4 *Usage Descriptions* + el bloque `CFBundleURLTypes`, reemplazando `REVERSED_CLIENT_ID` con el valor del `GoogleService-Info.plist` (campo `REVERSED_CLIENT_ID`). Textos listos en `resources/ios-staging/Info.plist.usage-descriptions.md`.
6. `cd ios/App && pod install`.
7. En Xcode → Signing & Capabilities:
   - **Team:** la cuenta de Luis Manuel Carvallo Gomez (Team ID `M39UFF5WFX`).
   - **Bundle Identifier:** `com.tubusexpress.app`.
   - **+ Capability:** Push Notifications, Sign in with Apple, Associated Domains.
   - **Associated Domains:** `applinks:tubusexpress.com` y `applinks:www.tubusexpress.com`.
8. **AASA / Universal Links:** en `frontend/public/.well-known/apple-app-site-association`, reemplazar el placeholder `TEAMID` por `M39UFF5WFX` (queda `M39UFF5WFX.com.tubusexpress.app`) y **re-desplegar el frontend** a producción.
9. Correr la app (en **Simulador** si no hay iPhone, ver §8).
10. QA (matriz del checklist 17, bloque J).
11. Archive → subir a TestFlight → completar listing ([`app-store-listing.md`](./app-store-listing.md) + [`app-store-privacy-nutrition.md`](./app-store-privacy-nutrition.md)) → submit.

---

## 8. El tema del iPhone (pendiente)

No hay iPhone físico disponible. Implicaciones:

- ✅ **Se puede sin iPhone:** armar todo en Xcode, correr en el **Simulador** (validar UI, navegación, login local), y dejar la app **lista para TestFlight**.
- ❌ **Requiere iPhone real:** probar **push notifications**, **cámara** y **login con Apple** de forma fiable. También se recomienda probar en real antes del submit final a la App Store.
- **Acción recomendada:** conseguir un iPhone prestado con iOS 14+ para la QA final. Registrar su UDID en Apple Developer → Devices (o dejar que Xcode lo registre automáticamente con firma automática).

---

## 9. Advertencias / recordatorios

- ⚠️ **Backend = producción:** la rama `feat/capacitor-ios` del backend auto-despliega a Railway producción. **No hacer `git push` del backend** sin validación previa (tests + smoke test). Los cambios de Fase B son en el **frontend** y en Xcode.
- ⚠️ **Dominio canónico = `www`:** el frontend vive en `www.tubusexpress.com` (el apex sin `www` puede devolver 404). Tenerlo en cuenta para Universal Links y para la URL de la política de privacidad en App Store Connect.
- 🔒 **Nunca commitear:** contenido de los `.p8`, `GoogleService-Info.plist` real, ni valores de env vars. (Ya están gitignored por convención del proyecto.)
- 📋 **Pendiente legal (owner, fuera del repo):** actualizar la política de privacidad en `www.tubusexpress.com/legal/privacidad` antes del submit (texto en [`privacy-policy-additions.md`](./privacy-policy-additions.md)).
