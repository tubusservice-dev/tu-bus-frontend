# 22 — Sesión Mac: setup local + debug de logins OAuth en iOS (Google / Apple)

> **Fecha:** 2026-06-23
> **Máquina:** Mac (la "Mac nueva" del handoff, ver [`21-cambio-de-mac-handoff.md`](21-cambio-de-mac-handoff.md))
> **Rama git:** `dev`
> **Estado al cerrar:** Frontend web corriendo en local; proyecto iOS compila y corre en Simulador (iPhone 17 Pro Max, iOS 26.3); **logins OAuth nativos (Google/Apple) bloqueados en Simulador por falta de firma con provisioning profile** (requiere iPhone físico registrado). Código de los fixes aplicado y verificado.

---

## 0. TL;DR (lo esencial)

1. **Se arreglaron DOS bugs reales de código del login Google en iOS** (ver §3). Ambos fixes están aplicados y verificados a nivel de binario.
2. **NO se pudo validar el login en el Simulador** porque los logins OAuth nativos (Google y Apple) necesitan permisos del sistema (Keychain / Sign in with Apple) que **solo se activan con una firma respaldada por un provisioning profile**, y ese profile **exige un iPhone físico registrado** en el team `M39UFF5WFX`. Es regla de Apple, comprobada empíricamente probando todas las variantes de firma.
3. **Bloqueo único pendiente: validar los logins nativos requiere un iPhone** (cualquiera, una vez). **PERO no hace falta comprar uno** — basta el UDID de un tester, o usar TestFlight. Ver **§10** (opciones para avanzar sin iPhone propio). Es el mismo bloqueo ya documentado en docs 19/20/21.
4. **El login local (email/contraseña) sí funciona** en el Simulador para seguir probando el resto de la app.
5. **Generar/subir la app a TestFlight/App Store NO requiere iPhone** (profile de distribución). Ver §10. **Decisión de qué camino tomar: pendiente (owner decide).**

---

## 1. Setup del entorno local (hecho)

### 1.1 Frontend web
- `npm install` (faltaba `node_modules` por completo).
- `environment.ts` (dev) apuntado a **producción** porque no hay backend local en esta Mac:
  ```ts
  apiUrl: 'https://api.tubusexpress.com/api',
  // apiUrl: 'http://localhost:3003/api',   // backend local (no disponible aquí)
  ```
- `npm start` → dev server en `http://localhost:4200` (HTTP 200 verificado).

### 1.2 Toolchain iOS (verificado en esta Mac)
| Herramienta | Versión |
|---|---|
| Xcode | 26.3 (build 17C529), licencia aceptada |
| CocoaPods | 1.15.2 |
| Ruby | 2.6.10 |
| Node | 24.5.0 / npm 11.5.1 |

> Antes de `pod install` / `npx cap copy ios` exportar `export LANG=en_US.UTF-8` (CocoaPods se queja del encoding si no).

### 1.3 Proyecto iOS armado
- `GoogleService-Info.plist` copiado de `../Firma de la App/GoogleService-Info (1).plist` → `ios/App/App/GoogleService-Info.plist` (validado: BUNDLE_ID `com.tubusexpress.app`, PROJECT_ID `tubusexpress`). Es secreto, **gitignored**.
- `pod install` (necesitó `--repo-update` la primera vez por catálogo CocoaPods desactualizado: pedía `FirebaseMessaging 12.7.0`).
- Bundle web embebido: `npm run build:prod` + `npx cap copy ios` → `ios/App/App/public`.
- Compila y corre en Simulador (firma por defecto "Sign to Run Locally").

---

## 2. Problema reportado

El login con **Google** en la app iOS (Simulador) fallaba. La investigación reveló **tres capas de problemas distintos**, atacadas en orden:

1. Plugin no compilado → "FirebaseAuthentication plugin is not implemented on ios".
2. Token rechazado por el backend → "Wrong recipient, payload audience != requiredAudience".
3. Acceso a Keychain denegado → "keychain error" (y, en paralelo, Apple Sign-In → `AuthorizationError error 1000`).

Las capas 1 y 2 son **bugs de código reales** y se arreglaron. La capa 3 es el **bloqueo de firma** (no es código).

---

## 3. Fixes de código aplicados (capas 1 y 2)

### 3.1 Fix A — Plugin "not implemented on ios" (bug de subspec en CocoaPods)

**Causa raíz:** declarar los pods `@capacitor-firebase/*` **con subspec** y `:path =>` (p. ej. `pod 'CapacitorFirebaseAuthentication/Google', :path => ...`) dispara un bug de CocoaPods donde **NO se genera el `PBXNativeTarget`** del framework del plugin. Resultado: el código del plugin no se compila, su clase nunca llega al binario, y Capacitor responde *"plugin is not implemented on ios"* para cualquier método. **Rompe Google Y Apple a la vez** (ambos providers viven en la misma clase `FirebaseAuthenticationPlugin`).

**Evidencia objetiva:** `grep -c "productName = CapacitorFirebaseAuthentication" Pods/Pods.xcodeproj/project.pbxproj` daba **0** con subspec (vs 1 para Messaging/Crashlytics, que no usan subspec).

**Solución (en `ios/App/Podfile`):** declarar los plugins **sin subspec** y replicar a mano, en `post_install`, lo que el subspec hacía:
- `pod 'CapacitorFirebaseAuthentication', :path => ...` (sin `/Google`)
- `pod 'GoogleSignIn', '9.0.0'` (top-level)
- `pod 'CapacitorFirebaseAnalytics', :path => ...` (sin `/AnalyticsWithoutAdIdSupport`)
- `pod 'FirebaseAnalytics/Core', '~> 12.7.0'` (top-level; `Core` = sin `IdentitySupport` = **sin IDFA**, respeta decisión **D16**)
- `post_install` que sobre los targets `CapacitorFirebaseAuthentication` y `CapacitorFirebaseAnalytics`:
  - inyecta el flag Swift `-DRGCFA_INCLUDE_GOOGLE`,
  - añade los `FRAMEWORK_SEARCH_PATHS` que faltaban (incluyendo los xcframeworks vendor: `FirebaseAnalytics/Core`, `GoogleAppMeasurement/Core` bajo `PODS_XCFRAMEWORKS_BUILD_DIR`, y `${PODS_ROOT}/.../Frameworks`),
  - añade `add_dependency` a los targets necesarios — **incluidos los `PBXAggregateTarget`** de los xcframeworks (`FirebaseAnalytics`, `GoogleAppMeasurement`); sin esa dependencia, su script "[CP] Copy XCFrameworks" no se dispara y el módulo no se encuentra al compilar.

> **IMPORTANTE — `:linkage => :static` NO es la solución.** Se probó y NO arregla el target faltante; mantener `use_frameworks!` **dynamic**.

**Verificado:** target generado (1), `-framework "CapacitorFirebaseAuthentication"` presente en `OTHER_LDFLAGS`, `GoogleSignIn 9.0.0` instalado, `BUILD SUCCEEDED`, y `strings App.debug.dylib | grep FirebaseAuthenticationPlugin` con resultados.

### 3.2 Fix B — Token Google rechazado por audience (client ID equivocado)

**Causa raíz:** el plugin iOS (`GoogleAuthProviderHandler.swift`) hacía:
```swift
let config = GIDConfiguration(clientID: clientId, serverClientID: clientId)   // clientId = iOS client ID
```
Usaba el **client ID de iOS** (`...khqrcgl16...`) como `serverClientID`, así que el ID token salía con `aud = iOS client ID`. Pero el backend solo acepta el **WEB client ID** `...ggktf2e4q2a1kl7pjt866rqvm8ad0gft...` (el mismo que Android usa via `server_client_id` en `strings.xml`). De ahí el error *"Wrong recipient, payload audience != requiredAudience"*.

**Solución:**
1. Patch del plugin (vía **patch-package**) para leer el server client ID del `Info.plist`:
   ```swift
   let serverClientId = Bundle.main.object(forInfoDictionaryKey: "GIDServerClientID") as? String ?? clientId
   let config = GIDConfiguration(clientID: clientId, serverClientID: serverClientId)
   ```
   → archivo `patches/@capacitor-firebase+authentication+8.2.0.patch`
2. `GIDServerClientID` = web client ID en `ios/App/App/Info.plist`:
   ```
   1071922885496-ggktf2e4q2a1kl7pjt866rqvm8ad0gft.apps.googleusercontent.com
   ```
3. Hook `postinstall: patch-package` + `patch-package` en devDependencies de `package.json` (reaplica el patch en cada `npm install`).

**Verificado a nivel de binario:** `GIDServerClientID` correcto en el `Info.plist` del `.app` compilado y `strings App.debug.dylib | grep GIDServerClientID`.

> El login end-to-end de Google no se pudo confirmar porque chocó con la capa 3 (Keychain) — ver §4.

---

## 4. El bloqueo real: firma con provisioning profile (capa 3)

Tras los fixes A y B, el login Google avanzó hasta fallar con **"keychain error"** (`errSecMissingEntitlement`, -34018), y Apple con **`AuthorizationError 1000`**. Ambos son **el mismo problema de fondo**: la app no tiene los permisos del sistema (Keychain para Google, `applesignin` para Apple) porque **no está firmada con un provisioning profile**.

### 4.1 Pruebas hechas (todas las variantes de firma)
| Firma del `.app` | ¿Arranca en Simulador? | Permisos aplicados |
|---|---|---|
| "Sign to Run Locally" (default Xcode) | ✅ sí | **vacíos** → Google (keychain) y Apple fallan |
| `CODE_SIGNING_ALLOWED=NO` (sin firma) | ✅ sí | ninguno → igual fallan |
| Cert real Luis + entitlements **completos** (`applesignin`, push, domains) | ❌ **no** (SBMainWorkspace deny) | rechazada |
| Cert real Luis + **solo** `application-identifier` + `keychain-access-groups` | ❌ **no** (SBMainWorkspace deny) | rechazada |
| Ad-hoc `-` + entitlements restringidos | ❌ no | rechazada |

**Conclusión comprobada:** el Simulador **rechaza arrancar** cualquier build cuyos permisos del sistema no provengan de un **provisioning profile válido**. Un profile de desarrollo con esas capabilities (Sign in with Apple, Push, Associated Domains, Keychain) **requiere ≥1 device (iPhone) registrado** en el team de Apple. **No hay iPhone en esta Mac → no hay profile → los logins nativos no arrancan firmados.**

### 4.2 Datos de firma confirmados en esta Mac
- Certificado válido presente: `Apple Development: Luis Manuel Carvallo Gomez`, con `OU=M39UFF5WFX` (team correcto de TuBus).
- Proyecto ya configurado: `DEVELOPMENT_TEAM = M39UFF5WFX`, `CODE_SIGN_STYLE = Automatic`, `CODE_SIGN_ENTITLEMENTS = App/App.entitlements`.
- El único provisioning profile presente es de **otro proyecto** ("Mi Claro", team `CSG9B6JZ9G`) — **no sirve**.
- `xcodebuild ... -allowProvisioningUpdates` para Simulador **cae a "Sign to Run Locally"** (no genera profile porque no hay device).

---

## 5. Estado final de cada login

| Login | Código | En Simulador (esta Mac) | Qué falta |
|---|---|---|---|
| **Local (email/pass)** | ✅ ok | ✅ **funciona** | nada |
| **Google** | ✅ fixes A+B aplicados y verificados | ❌ bloqueado por Keychain (firma) | iPhone → profile |
| **Apple** | ✅ plugin registrado | ❌ bloqueado por `applesignin` (firma) | iPhone → profile |

---

## 6. Inventario de cambios (working tree, sin commit)

| Archivo | Cambio | Tracked en git |
|---|---|---|
| `src/environments/environment.ts` | `apiUrl` → producción | sí |
| `ios/App/Podfile` | sin subspec + `GoogleSignIn` + `FirebaseAnalytics/Core` + `post_install` ampliado | sí |
| `ios/App/App/Info.plist` | `+ GIDServerClientID` (web client ID) | sí |
| `node_modules/@capacitor-firebase/authentication/ios/Plugin/Handlers/GoogleAuthProviderHandler.swift` | leer `GIDServerClientID` (vía patch) | no (node_modules) |
| `patches/@capacitor-firebase+authentication+8.2.0.patch` | patch del cambio anterior | sí |
| `package.json` | `+ "postinstall": "patch-package"` y `+ patch-package` en devDeps | sí |
| `ios/App/App/GoogleService-Info.plist` | copiado (secreto) | **no** (gitignored) |
| `ios/App/Pods/`, `ios/App/build/` | generados | no |

> Nada de esto está commiteado. **No se tocó git** (a pedido del owner).

---

## 7. Cómo retomar (próxima sesión)

### Pre-requisito para desbloquear Google + Apple
**Conseguir un iPhone físico** (una sola vez) y:
1. Conectarlo a la Mac, confiar el equipo.
2. En Xcode → registrar el device (Window → Devices, o al seleccionarlo como destino).
3. Con automatic signing + Team `M39UFF5WFX`, Xcode genera el provisioning profile de desarrollo con las capabilities (Sign in with Apple, Push, Associated Domains).
4. Correr en el iPhone (Cmd+R) → Google y Apple deberían funcionar (los fixes A+B ya están).
   - Apple en Simulador también requeriría además una cuenta iCloud logueada en el Simulador, pero la validación real de Apple Sign-In es en device.

### Si se hace `npm install` de nuevo
- El hook `postinstall` reaplica el patch del plugin automáticamente. Verificar que `patches/` siga presente.
- Si `npx cap update ios` regenera el `Podfile`, **re-aplicar** el patrón de §3.1 (sin subspec + `post_install`) — es el cambio más frágil.

### Verificaciones rápidas (sin login)
```bash
# Fix A: target del plugin generado
grep -c "productName = CapacitorFirebaseAuthentication" ios/App/Pods/Pods.xcodeproj/project.pbxproj   # debe ser >=1
# Fix B: audience correcto en el bundle
/usr/libexec/PlistBuddy -c "Print :GIDServerClientID" ios/App/App/Info.plist   # web client ID
```

---

## 8. Decisiones técnicas de esta sesión (continúa la bitácora D1..D17)

- **D18 — Plugins `@capacitor-firebase/*` se declaran SIN subspec + `post_install` manual.** Por el bug de CocoaPods (`subspec + :path` → no genera `PBXNativeTarget`). Se replican dependencias, flags y search paths a mano. Mantener `use_frameworks!` dynamic (NO `:linkage => :static`).
- **D19 — El server client ID de Google en iOS se inyecta vía `GIDServerClientID` en `Info.plist` + patch del plugin (`patch-package`).** El token debe llevar `aud` = web client ID (el que el backend valida, igual que Android). Se prefiere `patch-package` (versionado, reaplicado en `postinstall`) sobre editar `node_modules` a mano.
- **D20 — Los logins OAuth nativos (Google/Apple) NO se validan en Simulador sin un iPhone registrado.** Comprobado que el Simulador rechaza cualquier build con permisos del sistema sin provisioning profile, y el profile exige un device. La validación de Google/Apple nativos queda condicionada a conseguir un iPhone (confirma el bloqueo de docs 19/20/21).

---

## 9. Nota de proceso

Esta sesión gastó mucho tiempo en intentos de firma en el Simulador antes de confirmar que el bloqueo (provisioning/iPhone) es un límite de Apple, no resoluble por software. **Lección:** ante "funciona el plugin pero el login nativo no arranca", verificar PRIMERO el estado de firma/provisioning (`security find-identity`, perfiles disponibles, si hay device registrado) antes de iterar builds. Los fixes de código (A y B) son sólidos; el resto era el bloqueo de firma.

---

## 10. Opciones para avanzar SIN un iPhone propio (decisión pendiente — owner decide mañana)

> Aclaración clave que matiza la conclusión de §4: **hay que separar "generar/subir la app" de "probar los logins nativos".** Son cosas distintas con requisitos distintos.

### 10.1 ¿Generar y subir la app sin device? → SÍ se puede

El device sólo es obligatorio para el **provisioning profile de _desarrollo_** (debug en Simulador/device). Para **generar la app firmada y subirla a TestFlight / App Store** se usa un **provisioning profile de _distribución_ (App Store)**, que **NO requiere ningún dispositivo registrado** (ya anticipado en doc 21).

- Con el profile de distribución, los permisos restringidos (Keychain de Google, Apple Sign-In, Push, Associated Domains) **sí se aplican** correctamente.
- Es independiente de si se mantiene o no Apple Sign-In.

### 10.2 Apple Sign-In NO se puede quitar si se mantiene Google (Guideline 4.8)

App Store Review Guideline **4.8**: si la app ofrece login social de terceros (Google), Apple **obliga** a ofrecer **Sign in with Apple** como alternativa equivalente.
- Quitar Apple Sign-In + mantener Google → **rechazo en review**.
- Sólo se podría quitar Apple Sign-In si también se quita Google (dejar sólo email/contraseña).
- **Decisión:** mantener Apple Sign-In. El código ya está; con firma de distribución se activa.

### 10.3 ¿Instalar en un iPhone de tester, estilo `app-debug.apk`?

iOS **no** tiene un instalable libre como el APK. Dos caminos reales:

| | **Opción A — `.ipa` Ad-hoc/Development** | **Opción B — TestFlight** |
|---|---|---|
| Equivalente a | `app-debug.apk` (archivo que instalás) | repartir un link de invitación |
| ¿Requiere UDID del iPhone del tester? | ✅ **Sí** — registrar UDID en la cuenta (máx **100 devices/año**) | ❌ No |
| ¿Cómo instala el tester? | conectando a una Mac (Xcode/Apple Configurator) o servicio tipo Firebase App Distribution | app **TestFlight** + invitación (email/link) |
| Cantidad de testers | hasta 100 devices | Internal 100 / External 10.000 |
| ¿Review de Apple? | No | Internal: no · External: ligera (~1-2 días) |
| Firma | development o ad-hoc | distribución (App Store) |

### 10.4 El "doble desbloqueo" con UN solo UDID

Si un tester comparte el **UDID de su iPhone** y se registra en la cuenta Apple Developer:
1. Se puede generar e instalar un **`.ipa` development/ad-hoc** en ese iPhone.
2. Se **desbloquea el provisioning profile de desarrollo** que faltaba (§4) → con eso también se validan los logins nativos en ese iPhone.

→ **No hay que comprar un iPhone.** Basta el UDID de un tester (Opción A) o usar TestFlight (Opción B).

### 10.5 Matriz de decisión

| Objetivo | Camino | ¿Necesita UDID/iPhone? | Review |
|---|---|---|---|
| Subir a TestFlight para testers | Distribución → Archive → TestFlight | ❌ No | Internal no / External ligera |
| Instalar "a mano" en 1-2 iPhones cercanos | `.ipa` ad-hoc con UDID | ✅ UDID del tester | No |
| Validar logins nativos en local (Simulador) | Development profile | ✅ ≥1 UDID registrado | No |
| Publicar en App Store | Distribución → submit | ❌ No (pero QA real recomendada) | Sí (completa) |

### 10.6 Recomendación

- **Para repartir a varios testers cómodamente → TestFlight (Opción B).** No necesita UDIDs, es la vía estándar, y es el siguiente hito natural del proyecto.
- **Para una prueba rápida en el iPhone de alguien cercano → `.ipa` ad-hoc (Opción A)** con su UDID.
- Ambas se preparan **sin un iPhone propio**.

### 10.7 Pendiente para mañana

**Owner elige Opción A (ad-hoc) o B (TestFlight).** Según la elección, la próxima sesión prepara:
- **Si B (TestFlight):** distribution certificate + App Store provisioning profile (sin device) → Archive → subir a App Store Connect → invitar testers.
- **Si A (ad-hoc):** pedir UDID(s) al/los tester(s) → registrar en portal → ad-hoc provisioning profile → generar `.ipa` → distribuir (Firebase App Distribution o conexión directa).

> Nota: con cualquiera de las dos, los fixes de Google (A+B de §3) y Apple ya están en el código y se activan al firmar con el profile correcto.
