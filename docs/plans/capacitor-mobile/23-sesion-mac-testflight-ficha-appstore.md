# 23 — Sesión Mac: iOS a TestFlight (Opción B) + ficha App Store + fixes

> **Fecha:** 2026-06-24
> **Máquina:** Mac (la misma del doc 22 — ver [`22-sesion-mac-debug-logins-ios.md`](22-sesion-mac-debug-logins-ios.md))
> **Rama git:** `dev`
> **Estado al cerrar:** **Build 1 / v1.1 subido a TestFlight, en Beta App Review de Apple (`WAITING_FOR_REVIEW`).** Ficha de App Store **completa**. Tres fixes nativos aplicados al working tree (sin commit) pendientes para un **build 2**. Bloqueo único restante: que Apple apruebe la beta (~1 día) y que el tester con iPhone valide los logins.

---

## 0. TL;DR (lo esencial)

1. **Se desbloqueó la distribución iOS SIN iPhone** y se subió la app a **TestFlight** vía la **Opción B** del doc 22 (build de distribución App Store). Build 1 / v1.1 está en **Beta App Review** de Apple.
2. El bloqueo histórico de firma (docs 20/21/22) se resolvió con **firma manual de distribución**: cert de distribución **manual** + perfil **App Store**, ambos creados vía la **App Store Connect API**. La firma automática NO sirve (intenta un perfil de *Development* que exige device).
3. La **ficha de App Store quedó completa**: textos, categorías, age rating 4+, precio Gratis, info para el revisor, **5 screenshots** y **etiquetas de privacidad**.
4. Se aplicaron **3 fixes nativos** (working tree, sin commit) que van en un **build 2**: status bar siempre clara, splash con logo centrado, y `NSLocationAlwaysAndWhenInUseUsageDescription` (resuelve la advertencia `ITMS-90683`).
5. **Próximo hito real:** Apple aprueba la beta (~1 día) → el tester `gerardojcnz@gmail.com` instala vía link y **valida los logins** (Google/Apple/email) en iPhone real. Recién después: build 2 → App Review de producción.

---

## 1. Decisión: Opción B (TestFlight vía API key)

El owner eligió la **Opción B** (TestFlight, build de distribución App Store) sobre la Opción A (ad-hoc con UDID). Método de subida: **App Store Connect API key** (CLI, máxima automatización).

- **API key generada** por el owner (rol App Manager): Key ID `4HN64R6F54`, Issuer ID `87105a84-5ce8-49bd-bccc-3d234ce10ea3`. El `.p8` vive en `~/.appstoreconnect/private_keys/AuthKey_4HN64R6F54.p8` (chmod 600, fuera de git).
- **App creada** en App Store Connect: nombre `TuBus Express`, idioma es-MX, SKU `tubusexpress-ios`, bundle `com.tubusexpress.app`. **App Store ID = `6783843561`**, bundle resource id `2MP72CVZL9`.
- El JWT ES256 para llamar la ASC API se genera con Ruby (`OpenSSL::PKey.read` + `dsa_sign_asn1(SHA256)` + conversión DER→raw r||s de 32 bytes c/u, `aud: appstoreconnect-v1`). Ver scripts de la sesión.

---

## 2. El setup de firma que destrabó el bloqueo (lo más importante)

El bloqueo de los docs 20/21/22 era: *la firma automática exige un perfil de **Development**, que requiere ≥1 iPhone registrado.* La **distribución App Store NO requiere device**, pero hubo que armarla a mano:

### 2.1 — El archive automático falla (confirma el bloqueo)
`xcodebuild ... -allowProvisioningUpdates archive` con firma **automatic** intenta firmar el archive con un perfil **iOS App Development** → `error: Your team has no devices...`. Mismo muro de siempre.

### 2.2 — Archive sin firma + export automático: produce `.ipa` PERO entitlements incompletos
El export con cloud-managed signing generó un perfil **genérico** sin las capabilities. El `.ipa` salió firmado (`Apple Distribution`) pero **le faltaban** `aps-environment`, `applesignin` y `associated-domains`. Inservible (Apple Sign-In, Push y Universal Links no funcionarían).

### 2.3 — Solución correcta: firma MANUAL de distribución
- La ASC API solo veía certs de **Development** (el cert de distribución del export era *cloud-managed*, invisible/inusable para crear perfiles vía API).
- Se creó un **cert de distribución MANUAL**: `openssl genrsa` + CSR → `POST /v1/certificates` (type `DISTRIBUTION`) → `.p12` → `security import ... -T /usr/bin/codesign -A`. Cert id `KBV3R32D92`, identidad `Apple Distribution: Luis Manuel Carvallo Gomez (M39UFF5WFX)`.
- Se creó el **perfil App Store** vía API: `POST /v1/profiles` (type `IOS_APP_STORE`) con bundle + cert. Nombre `TuBus App Store`, uuid `58272437-4d22-4ae5-889c-7d0ce5b5ff8f`, instalado en `~/Library/MobileDevice/Provisioning Profiles/`. **Verificado** que incluye `aps-environment=production`, `applesignin`, `associated-domains=*`, `keychain-access-groups`. El App ID ya tenía las capabilities (APPLE_ID_AUTH, ASSOCIATED_DOMAINS, PUSH_NOTIFICATIONS) desde la Fase A.

### 2.4 — Manual signing SOLO en el target App
Pasar `PROVISIONING_PROFILE_SPECIFIER` por línea de comandos lo aplica a TODOS los targets, y **los frameworks de los Pods (Firebase, Capacitor) NO admiten provisioning profile** → error. Solución: configurar el manual signing **solo en el target `App` / Release** vía la gem `xcodeproj` (`CODE_SIGN_STYLE=Manual`, identity `Apple Distribution`, profile `TuBus App Store`), dejando los Pods intactos.

---

## 3. Preparación del proyecto para distribución

| Cambio | Detalle |
|---|---|
| `MARKETING_VERSION` | 1.0 → **1.1** (paridad con Android, D12) |
| `aps-environment` | development → **production** (obligatorio TestFlight/App Store) |
| `ITSAppUsesNonExemptEncryption` | `+ false` (HTTPS estándar → evita el prompt de export compliance en cada subida) |
| `ExportOptions.plist` | creado (manual signing, `method: app-store`, team `M39UFF5WFX`) |

Validación previa: `build:prod` + `cap copy ios` + `xcodebuild Release -sdk iphoneos CODE_SIGNING_ALLOWED=NO build` → **BUILD SUCCEEDED** (de-risk: el código compila en Release/device; lo único pendiente era firma).

---

## 4. Archive firmado + upload

- **Archive** con manual signing (target App) → `.ipa` con **entitlements completos** verificados: `aps-environment=production`, `applesignin=[Default]`, `associated-domains=[applinks:tubusexpress.com, applinks:www.tubusexpress.com]`, `application-identifier`, `team-identifier`, `beta-reports-active`. Firma `Apple Distribution: Luis ... (M39UFF5WFX)`.
- **Upload** con `xcrun altool --upload-app --type ios -f App.ipa --apiKey 4HN64R6F54 --apiIssuer ...` → **UPLOAD SUCCEEDED** (Delivery UUID `3a640cbb-...`, 9.99 MB). Build resource id `3a640cbb-795f-4b1f-9533-38e52f44e3c1`.
- Procesamiento de Apple → `processingState=VALID`, `internalBuildState=READY_FOR_BETA_TESTING`, `usesNonExemptEncryption=false`.

### 4.1 — TestFlight externo + envío a Beta Review
- Grupo externo `Beta Testers` (id `2d5d72ac-5480-459f-9d0b-1cbe170ec3d7`), build asignado, **public link `https://testflight.apple.com/join/T5E8EW4t`** (se activa al aprobar la beta).
- Tester `gerardojcnz@gmail.com` agregado al grupo.
- **Cuenta demo validada contra producción** antes de enviar: `POST https://api.tubusexpress.com/api/auth/login` con `gamer221193@gmail.com` / `•••••• (en vault / cargada en App Store Connect)` → **200, `isVerified=true`**. (Endpoint: `auth.service.ts` → `${environment.apiUrl}/auth/login`, body `{email,password}`.)
- `betaAppReviewDetail` (contacto Luis Carvallo, `gamer221193@gmail.com`, `+584120263111`, demo account, notas) + Beta App Description (es-MX) → **enviado a Beta App Review** (`WAITING_FOR_REVIEW`).

---

## 5. Ficha de App Store (producción) — COMPLETA

Cargada vía ASC API (copy de [`app-store-listing.md`](app-store-listing.md)) salvo privacidad (web):

- **Versión** 1.0 → **1.1** (alinea con el build).
- **Textos** es-MX: descripción (1343 chars), subtítulo "Repuestos y servicios", keywords, texto promocional.
- **URLs con `www`** (⚠️ ver §7.4): support `https://www.tubusexpress.com/contacto`, marketing `https://www.tubusexpress.com`.
- **Categorías:** Shopping (primaria) + Business (secundaria).
- **Clasificación de edad:** 4+ (cuestionario nuevo 2025 — ver D26).
- **Precio:** Gratis (USA base).
- **App Review detail:** contacto + cuenta demo + notas.
- **5 screenshots** 6.9" (ver §6).
- **Etiquetas de privacidad** + Privacy Policy URL (ver §5.1, cargadas por el owner en la web).

### 5.1 — Privacy nutrition labels (cargadas en web por el owner)
La API `appDataUsages` es muy laboriosa/frágil → se hizo el cuestionario web guiado (matriz de [`app-store-privacy-nutrition.md`](app-store-privacy-nutrition.md)). **12 tipos de datos, ninguno para tracking:**

| Datos | Propósito | Vinculado |
|---|---|---|
| Nombre, Email, Teléfono, Dirección física, Fotos, Historial de compras | App Functionality | Sí |
| Ubicación exacta, Datos de errores | App Functionality | No |
| ID de usuario, ID de dispositivo | App Functionality + Analytics | Sí |
| Interacción con el producto, Datos de rendimiento | Analytics | No |

Privacy Policy URL: `https://www.tubusexpress.com/legal/privacidad` (verificada 200).

---

## 6. Screenshots (slot 6.9")

5 capturas en **1320×2868** (`APP_IPHONE_67`, set id `63ad88c9-936e-46ad-b4ec-7ba9b4ac2431`): **landing · catálogo · detalle de producto · carrito · seguimiento del servicio**. Estado `COMPLETE`.

- Capturadas con `xcrun simctl io booted screenshot`, barra fijada con `simctl status_bar override --time 9:41 --batteryState charged --batteryLevel 100 ...` (look limpio App Store), restaurada al final con `status_bar clear`.
- Subidas vía API: `POST /v1/appScreenshots` (reserva) → `PUT` a `uploadOperations` → `PATCH uploaded=true + sourceFileChecksum (MD5)`.
- **Nota de proceso:** el permiso de computer-use para el Simulador **no se pudo habilitar**; se capturó **colaborativamente** (el owner navega a cada pantalla, el asistente captura con `simctl`).

---

## 7. Fixes nativos aplicados (working tree, sin commit) — para el BUILD 2

### 7.1 — Status bar: iconos del sistema siempre claros
[`splash.service.ts`](../../../src/app/platform/splash/splash.service.ts): el estilo de la status bar estaba **atado al tema** de la app (`isDark ? Style.Dark : Style.Light`), pero el header es **siempre azul oscuro `#001D56`** → en modo claro los iconos quedaban oscuros e ilegibles. Fix: **siempre `Style.Dark`** (iconos claros), removido el `effect`/dependencia de `ThemeService`. Coincide con `capacitor.config.ts` (`style: 'DARK'`).

### 7.2 — Splash: logo centrado en lugar de imagen a pantalla completa (deep-debug)
[`LaunchScreen.storyboard`](../../../ios/App/App/Base.lproj/LaunchScreen.storyboard): el storyboard mostraba el asset `Splash` (ícono casi sin margen, 2732×2732) en un `imageView` full-screen con `scaleAspectFill` → el logo llenaba la pantalla. Android no tiene el problema porque usa el **SplashScreen API** (centra el ícono). Fix: reescrito a **logo centrado 180×180pt `scaleAspectFit` sobre fondo `#001D56`**.

### 7.3 — Info.plist: `ITMS-90683` (advertencia de Apple sobre el build 1)
Apple avisó que falta `NSLocationAlwaysAndWhenInUseUsageDescription` (el plugin de geolocalización referencia la API *always*; Apple la exige aunque no se use). Agregada al [`Info.plist`](../../../ios/App/App/Info.plist). **Era warning en TestFlight pero rechazo en App Store.**

### 7.4 — URLs canónicas con `www`
Verificado con curl: `https://tubusexpress.com/contacto` → **404** (apex da 404 en rutas SPA), `https://www.tubusexpress.com/contacto` → **200**. Las URLs de la ficha se corrigieron a `www` (confirma la nota de "dominio canónico = www" del doc 19).

---

## 8. Decisiones técnicas (continúa la bitácora D1..D20)

- **D21 — Distribución iOS sin iPhone = firma MANUAL de distribución vía ASC API.** Cert de distribución manual (`openssl` CSR → `POST /v1/certificates`) + perfil `IOS_APP_STORE` (`POST /v1/profiles`), instalados localmente. La firma **automatic** no sirve (intenta perfil de Development que exige device); el cert cloud-managed del export es invisible para la API de perfiles.
- **D22 — Manual signing SOLO en el target `App`** (vía gem `xcodeproj`), nunca global por línea de comandos: los frameworks de los Pods no admiten provisioning profile.
- **D23 — Status bar iOS siempre con iconos claros**, independiente del tema de la app, porque el header es siempre `#001D56`. Se elimina la sincronización con `ThemeService`.
- **D24 — Splash iOS = logo centrado acotado sobre fondo de marca** (no imagen full-screen `scaleAspectFill`), para igualar el look del SplashScreen API de Android 12+.
- **D25 — `ITSAppUsesNonExemptEncryption = false`** declarado en Info.plist (HTTPS estándar, cifrado exento) para evitar el prompt de export compliance en cada subida.
- **D26 — Age rating cargado vía API con el cuestionario nuevo 2025.** Ojo: `messagingAndChat`, `advertising`, `userGeneratedContent`, `ageAssurance`, `healthOrWellnessTopics` son **BOOLEAN**; el resto son enums (`"NONE"`). Todo limpio → 4+.

---

## 9. Estado de cada cosa al cierre

| Cosa | Estado |
|---|---|
| Build 1 / v1.1 en TestFlight | ✅ subido, **en Beta App Review** (`WAITING_FOR_REVIEW`) |
| Validación de logins en iPhone real | ⛔ **pendiente** — depende de la aprobación de Apple + el tester |
| Ficha de App Store | ✅ **completa** (textos, screenshots, privacidad, precio, age rating, review info) |
| Cert distribución + perfil App Store | ✅ creados e instalados (reutilizables para próximos builds) |
| Fixes status bar / splash / Info.plist | ✅ aplicados al working tree (**sin commit**) — van en el **build 2** |
| AASA / Universal Links | ⛔ pendiente re-deploy del frontend con Team `M39UFF5WFX` |

---

## 10. Próximos pasos (en orden)

1. **Esperar la aprobación de la Beta Review** (Apple, ~1 día). Llega por email.
2. **El tester `gerardojcnz@gmail.com` valida los logins** (Google/Apple/email) en su iPhone vía el link de TestFlight. 🎯 Hito que destraba todo.
3. **Generar y subir un BUILD 2** con los 3 fixes de §7 (el de Info.plist es **obligatorio** para App Store; el build 1 no lo tiene). Asignarlo a la versión 1.1.
4. **Enviar a App Review** (producción) → publicar (~1-3 días).
5. **Pendiente externo (no Apple):** re-deploy del frontend con el AASA (Team `M39UFF5WFX`) para Universal Links.

---

## 11. Inventario de cambios (working tree, sin commit)

| Archivo | Cambio | Tracked |
|---|---|---|
| `ios/App/App.xcodeproj/project.pbxproj` | `MARKETING_VERSION` 1.1 + manual signing en target App/Release | sí |
| `ios/App/App/App.entitlements` | `aps-environment` → production | sí |
| `ios/App/App/Info.plist` | `+ ITSAppUsesNonExemptEncryption`, `+ NSLocationAlwaysAndWhenInUseUsageDescription` | sí |
| `ios/App/ExportOptions.plist` | creado (manual signing) | sí |
| `ios/App/App/Base.lproj/LaunchScreen.storyboard` | logo centrado sobre fondo azul | sí |
| `src/app/platform/splash/splash.service.ts` | status bar siempre clara (sin dependencia de tema) | sí |

> Nada commiteado. **No se tocó git** (a pedido del owner, igual que el doc 22).

---

## 12. Identificadores de la sesión (referencia rápida)

| Recurso | Valor |
|---|---|
| App Store ID | `6783843561` |
| Bundle resource id | `2MP72CVZL9` |
| API key | Key ID `4HN64R6F54` · Issuer `87105a84-5ce8-49bd-bccc-3d234ce10ea3` · `.p8` en `~/.appstoreconnect/private_keys/` |
| Cert distribución | id `KBV3R32D92` (`Apple Distribution: Luis ... M39UFF5WFX`) |
| Perfil App Store | `TuBus App Store` · uuid `58272437-4d22-4ae5-889c-7d0ce5b5ff8f` |
| appStoreVersion id | `7eabd72f-dca9-46ca-827a-46af252c8763` |
| appInfo id | `8e2a1313-b80d-4286-9319-293c1083cc0e` |
| Build resource id | `3a640cbb-795f-4b1f-9533-38e52f44e3c1` |
| Beta group externo | `Beta Testers` · id `2d5d72ac-5480-459f-9d0b-1cbe170ec3d7` · link `https://testflight.apple.com/join/T5E8EW4t` |
| Screenshot set 6.9" | `63ad88c9-936e-46ad-b4ec-7ba9b4ac2431` |
| Tester | `gerardojcnz@gmail.com` |
| Cuenta demo (review) | `gamer221193@gmail.com` / `•••••• (en vault / cargada en App Store Connect)` (login local, verificada en prod) |
