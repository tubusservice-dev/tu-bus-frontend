# 17 — Mac Handoff Checklist (El día del Mac)

> **Status:** ✅ Documento generado al cierre del Phase B Windows Track (F5). ⏳ **El checklist en sí NO se ha ejecutado** — la parte Mac de Phase B sigue pendiente del Mac (a 2026-06-12). El foco actual del proyecto es Phase 7 (Android / Google Play Closed Testing).
> **Nota sobre `frontend/ios/`:** si la carpeta existe, es un **residuo del stub de assets de WB-5**, NO un proyecto Capacitor iOS real (no tiene `ios/App` ni `Podfile`). El `npx cap add ios` de verdad se ejecuta en el Bloque B de este checklist, el día del Mac.
> **Cuándo se ejecuta:** el día que el owner tenga (a) Mac con macOS 14+, (b) cuenta Apple Developer activa, (c) iPhone físico, (d) GoogleService-Info.plist descargado de Firebase Console.
> **Esfuerzo estimado:** 4-6 horas si todos los pre-requisitos están listos.
> **Output:** APK iOS firmada en TestFlight + lista para submit a App Store.

---

## Pre-requisitos (verificar ANTES de empezar)

| # | Item | Cómo confirmar |
|---|---|---|
| P1 | Mac con macOS 14 (Sonoma) o superior | Menú Apple → Acerca de este Mac |
| P2 | Xcode 15+ instalado | `xcodebuild -version` |
| P3 | Command Line Tools | `xcode-select -p` retorna path válido |
| P4 | CocoaPods + Ruby 2.6+ | `pod --version` |
| P5 | Cuenta Apple Developer activa (status `Active` en Membership) | `developer.apple.com/account` |
| P6 | Team ID copiado (10 chars alfanuméricos) | `developer.apple.com/account` → Membership |
| P7 | App ID `com.tubusexpress.app` creado con capabilities Push, Sign in with Apple, Associated Domains | `developer.apple.com/account/resources/identifiers` |
| P8 | APNs Authentication Key (.p8) generada | `developer.apple.com/account/resources/authkeys` |
| P9 | APNs key subida a Firebase Console → Cloud Messaging | `console.firebase.google.com/.../project-settings/cloudmessaging` |
| P10 | Firebase Console — app iOS añadida con bundle `com.tubusexpress.app` | `console.firebase.google.com/.../settings/general` |
| P11 | `GoogleService-Info.plist` descargado y guardado en `~/tubus-credentials/GoogleService-Info.plist` | `ls ~/tubus-credentials/` |
| P12 | Service ID para Sign in with Apple creado | `developer.apple.com/account/resources/identifiers` → Services IDs |
| P13 | iPhone físico con iOS 14+ disponible | Físicamente al lado del Mac |
| P14 | UDID del iPhone registrado en Apple Developer → Devices | `developer.apple.com/account/resources/devices` |
| P15 | Cable USB-C o Lightning para conectar iPhone | Físicamente al lado |

Si algún item falta → resolver primero. NO empezar hasta que P1-P15 estén ✅.

---

## Paso a paso (orden estricto)

### Bloque A — Clonar y construir base

```bash
cd ~/Projects   # o donde quieras alojar
git clone <repo-frontend-url> tubus-frontend
cd tubus-frontend
git checkout feat/capacitor-ios
git pull
npm install
npm run build:prod
```

Esperado: build limpio en ~15-20s. Sin errores TypeScript.

### Bloque B — Generar carpeta iOS

```bash
npx cap add ios
```

Esperado: carpeta `ios/App/` creada con:
- `App.xcodeproj`
- `App.xcworkspace`
- `Podfile`
- `App/Info.plist`
- `App/AppDelegate.swift`
- `App/Assets.xcassets/`

### Bloque C — Pegar assets iOS pre-generados (de Windows Track WB-5)

```bash
# Sobrescribe los assets default con los generados desde Windows:
rm -rf ios/App/App/Assets.xcassets/AppIcon.appiconset
rm -rf ios/App/App/Assets.xcassets/Splash.imageset
cp -r resources/ios-staging/AppIcon.appiconset ios/App/App/Assets.xcassets/
cp -r resources/ios-staging/Splash.imageset    ios/App/App/Assets.xcassets/
```

Verificar:
```bash
ls ios/App/App/Assets.xcassets/AppIcon.appiconset/   # debe haber 1 PNG + Contents.json
ls ios/App/App/Assets.xcassets/Splash.imageset/      # debe haber 6 PNGs + Contents.json
```

### Bloque D — Pegar GoogleService-Info.plist

```bash
cp ~/tubus-credentials/GoogleService-Info.plist ios/App/App/
```

Después en Xcode (Bloque G), drag-drop el archivo al target con "Copy items if needed" marcado.

### Bloque E — Editar Info.plist

Abrir `ios/App/App/Info.plist` con Xcode o un editor de texto. Pegar dentro del `<dict>` raíz las 4 Usage Descriptions y el bloque CFBundleURLTypes que están preparados en:

```
resources/ios-staging/Info.plist.usage-descriptions.md
```

**Sustituir** el placeholder `REVERSED_CLIENT_ID_HERE` con el valor real del campo `REVERSED_CLIENT_ID` del `GoogleService-Info.plist` (típicamente `com.googleusercontent.apps.1071922885496-XXXXXXXXXX`).

### Bloque F — Pod install

```bash
cd ios/App
pod install
cd ../..
```

Esperado: `Podfile.lock` generado + carpeta `Pods/` poblada con todos los plugins Capacitor (11 plugins ≈ 30-50 pods transitivos). Tarda 2-5 min la primera vez.

### Bloque G — Configurar Signing & Capabilities en Xcode

```bash
open ios/App/App.xcworkspace
```

En Xcode:

1. Click en el proyecto **App** (raíz del navigator).
2. Seleccionar target **App**.
3. Pestaña **Signing & Capabilities**:
   - **Team:** seleccionar tu Apple Developer Team
   - **Bundle Identifier:** verificar `com.tubusexpress.app` (debe coincidir EXACTAMENTE con el del App ID en Apple Developer)
   - **Provisioning Profile:** Automatic (deja que Xcode genere development + distribution)
4. Click **+ Capability** (esquina superior izquierda de la pestaña):
   - **Push Notifications** ← obligatorio para FCM
   - **Sign in with Apple** ← obligatorio para el provider apple.com (App Store Guideline 4.8)
   - **Associated Domains** ← obligatorio para Universal Links
5. En Associated Domains añadir:
   - `applinks:tubusexpress.com`
   - `applinks:www.tubusexpress.com`

### Bloque H — Verificar AASA y reemplazar TEAMID

El AASA file (`frontend/public/.well-known/apple-app-site-association`) tiene un placeholder `TEAMID`. Reemplazarlo con el Team ID real:

```bash
# Desde la raíz del repo:
sed -i.bak 's/TEAMID\.com\.tubusexpress\.app/<TU_TEAM_ID>\.com\.tubusexpress\.app/' \
  public/.well-known/apple-app-site-association
rm public/.well-known/apple-app-site-association.bak

# Verificar:
cat public/.well-known/apple-app-site-association
```

Después de este cambio, el archivo debe deployarse a producción para que Apple lo verifique. **Sin este deploy, los Universal Links no funcionan.**

### Bloque I — Primer Run en iPhone físico

1. Conectar el iPhone al Mac via cable.
2. En el iPhone, aceptar el prompt "Trust this Mac" si aparece.
3. En Xcode, en la barra superior, seleccionar el iPhone físico como destino (no simulator).
4. Cmd + R (o botón Play).
5. Primera vez: el iPhone puede pedirte ir a **Settings → General → VPN & Device Management → Trust Developer**. Hazlo y vuelve a correr.

Esperado: la app abre en el iPhone, muestra splash + landing TuBus Express.

### Bloque J — QA Tier A (iOS 17+)

Validar este checklist en el iPhone físico:

#### J.1 — Auth
- [ ] Login local (email + password) funciona, entra a perfil
- [ ] Logout funciona
- [ ] Login con Google nativo: aparece picker iOS Google → entra normal
- [ ] **Login con Apple: aparece el sheet nativo Apple → "Continue with Apple" → entra normal**
- [ ] **Botón Apple aparece ARRIBA del Google** (iOS HIG D8)
- [ ] Hacer logout y login Apple de nuevo → no aparece "No credentials available" (signOutAppleSilent funciona)

#### J.2 — Bidirectional linking
- [ ] Crear cuenta local con email X
- [ ] Logout
- [ ] Intentar login Apple con MISMO email X (si Apple lo provee — solo primer sign-in) → debe aparecer modal "Vincular cuenta con Apple"
- [ ] Ingresar password local incorrecta → toast "Contraseña incorrecta"
- [ ] Ingresar password correcta → vincula + auto-login

#### J.3 — Push Notifications
- [ ] Activar push en /perfil → permission prompt iOS aparece → aceptar
- [ ] Enviar notif desde Firebase Console (o desde admin) → llega al iPhone
- [ ] App foreground: toast aparece
- [ ] App background: notif del SO con badge en icono
- [ ] Tap notif con app killed → app abre directo en URL del payload

#### J.4 — Universal Links
- [ ] Mandar email a tu cuenta con un link `https://tubusexpress.com/verify-email?token=...`
- [ ] Abrir el email desde Mail.app del iPhone
- [ ] Tap en el link → **debe abrir la app TuBus directamente, no Safari**
- [ ] Si abre Safari → el AASA no se verificó (revisar deploy del frontend + cache de Apple CDN)

#### J.5 — Safe area
- [ ] En iPhone con notch / Dynamic Island, verificar que el header NO se solapa con la barra de estado
- [ ] El footer NO se solapa con el home indicator
- [ ] Modales fullscreen respetan el safe area
- [ ] **Validar la hipótesis crítica del análisis deep-debug:** iOS WKWebView SÍ propaga `env(safe-area-inset-*)` al CSS automáticamente, por lo que NO necesitamos un bridge nativo equivalente al `MainActivity.java` de Android. Si por alguna razón fallara, habría que crear `AppDelegate` bridge específico.

#### J.6 — Cámara + galería
- [ ] Tap "Subir comprobante" → prompt "Cámara | Galería" aparece
- [ ] Cámara: captura foto → sube OK
- [ ] Galería: selecciona foto → sube OK
- [ ] Si NO aparece prompt y la app crashea → falta `NSCameraUsageDescription` o `NSPhotoLibraryUsageDescription`

#### J.7 — Geolocalización
- [ ] Tap "Usar mi ubicación" en zoning modal → prompt iOS Location aparece → aceptar
- [ ] Zona se autodetecta

### Bloque K — Validación cross-platform anti-regresión

Antes de subir a TestFlight, validar que NADA se rompió:

- [ ] Web (`https://tubusexpress.com`): login Google sigue funcionando
- [ ] APK Android existente en POCO: login Google + push sigue funcionando
- [ ] Backend producción: endpoints existentes responden idéntico

### Bloque L — Archive + Upload a TestFlight

1. En Xcode, en la barra superior, cambiar destino a **Any iOS Device (arm64)** (no el iPhone físico).
2. Menu Product → Archive.
3. Esperar ~3-5 min mientras compila release build.
4. Window → Organizer → seleccionar el archive recién creado.
5. Click **Distribute App** → **App Store Connect** → **Upload** → wizard hasta el final.
6. Esperar 5-15 min mientras Apple procesa.
7. En App Store Connect → TestFlight → la build aparece como "Processing" → "Ready to Test".

### Bloque M — Listing en App Store Connect

Pegar TODO el contenido de `docs/plans/capacitor-mobile/app-store-listing.md` en los campos correspondientes:

- App Information
- Pricing and Availability
- App Privacy (matriz del `app-store-privacy-nutrition.md`)
- Versión 1.0.0 → screenshots + description + keywords + what's new

Después de completar la matriz de privacy → guardar borrador → **NO submit a review todavía**.

### Bloque N — TestFlight Closed Testing

1. En TestFlight: añadir el archive a Internal Testing.
2. Invitar tu propio Apple ID + máx 5 testers internos.
3. Ellos descargan TestFlight app, aceptan invitación, instalan TuBus Express.
4. QA full en sus dispositivos durante 1-2 semanas.
5. Si todo OK → promover a Open Testing → eventualmente Submit for App Review.

### Bloque O — Submit for App Review

1. App Store Connect → Versión 1.0.0 → Submit for Review.
2. Responder preguntas finales (export compliance: standard encryption N/A para nosotros).
3. Esperar 24-48h. Apple responde con `Approved`, `Rejected` o `In Review`.

Si Rejected → leer feedback, corregir, re-submit. El error más común con apps Capacitor es:
- 4.8 (no implementaste Sign in with Apple) → ya lo implementamos, no debería pasar.
- 5.1.1 (privacy policy outdated) → asegurarse de que `tubusexpress.com/legal/privacidad` lista todos los proveedores.

---

## Si algo falla durante el Run en iPhone

| Síntoma | Causa probable | Fix |
|---|---|---|
| Xcode dice "Unable to install" | UDID no registrado en Apple Developer | Bloque P14 |
| App crashea al pedir Face ID | Falta NSFaceIDUsageDescription | Bloque E |
| Google Sign-In: picker vacío | Falta REVERSED_CLIENT_ID en CFBundleURLTypes | Bloque E |
| Apple Sign-In: error "Sign in with Apple is not enabled" | Capability Sign in with Apple no activada | Bloque G.4 |
| Push no llega: token no se genera | .p8 mal subida a Firebase o capability Push no activa | Bloques P9, G.4 |
| Universal Link abre Safari en vez de la app | AASA no verificado por Apple | Bloque H + verificar `https://app-site-association.cdn-apple.com/a/v1/tubusexpress.com` |
| Pod install falla con CDN error | Network issue | Reintentar con `pod install --repo-update` |

---

## Estado final esperado del Mac handoff

- [x] App iOS corriendo en iPhone físico con todas las features Apple Sign-In + Universal Links + Push + Cámara + Geo + Biometría
- [x] TestFlight build #1 subida y aprobada para internal testing
- [x] App Store Connect listing 100% completo
- [x] Privacy nutrition labels declarados
- [x] Política de privacidad actualizada (con menciones Apple Sign In + Firebase suite)
- [x] AASA file deployado a producción con Team ID real
- [x] iOS + Android + Web → triple plataforma funcionando idéntico

Después de eso → submit for review → publicar.
