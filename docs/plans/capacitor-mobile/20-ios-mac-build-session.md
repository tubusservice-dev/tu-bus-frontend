# 20 — Sesión del Mac: armado del proyecto iOS (Fase B parcial)

> **Status:** ⏳ EN CURSO — bloques A-I del [`17-mac-handoff-checklist.md`](./17-mac-handoff-checklist.md) ejecutados en el Mac el **2026-06-23**. Pendiente: firma con cuenta Apple + QA en iPhone físico + Archive/TestFlight (bloques G-parcial, J-O).
> **Tipo:** Bitácora de ejecución (mismo patrón que docs 13/14/16, decisión D14).
> **Máquina:** Mac de Melanie Marval (macOS 26.4.1). Primera vez que el proyecto se arma en un Mac real.
> **Lectura previa:** [`19-ios-handoff-estado-real.md`](./19-ios-handoff-estado-real.md) (estado Fase A), [`17-mac-handoff-checklist.md`](./17-mac-handoff-checklist.md) (plan de bloques A-O).
> **Commit:** `e2f9dc6 feat(capacitor-ios): scaffold iOS project + fix auth-modal OAuth UX` (branch `feature/dev-ios`, local, sin push).

---

## 1. Resumen

Primera sesión de armado iOS en un Mac. Se ejecutó la mayor parte del handoff: se generó la carpeta `ios/`, se instalaron los pods nativos, se enlazaron los assets + credenciales + capabilities, y **la app compila y corre en el Simulador consumiendo el backend de producción** (`api.tubusexpress.com`). Firebase (Analytics, Messaging, Crashlytics, Auth) inicializa correctamente.

Durante el armado aparecieron 3 problemas que NO estaban previstos en el checklist (escritos desde Windows) y se resolvieron en el momento; se documentan abajo y se registran como decisiones formales D15-D17 en [`05-decisions-log.md`](./05-decisions-log.md).

Además, el owner reportó 2 bugs de UX en los botones OAuth del `auth-modal` que se corrigieron en la misma sesión.

**Lo único que bloquea el resto (TestFlight):** la cuenta Apple Developer del proyecto (Team `M39UFF5WFX`) **no está logueada en el Xcode de este Mac** — ver §6.

---

## 2. Entorno del Mac (verificado 2026-06-23)

| Herramienta | Versión | Mínimo requerido | OK |
|---|---|---|---|
| macOS | 26.4.1 (build 25E253) | 14 (Sonoma) | ✅ |
| Xcode | 26.4 (build 17E192) | 15 | ✅ |
| Command Line Tools | `/Applications/Xcode.app/Contents/Developer` | — | ✅ |
| CocoaPods | 1.16.2 | 1.10 | ✅ |
| Ruby | 2.6.10 | 2.6 | ✅ |
| Node | 22.21.0 (vía nvm) | 20 | ✅ |
| npm | 10.9.4 | — | ✅ |

> **Nota nvm:** Node está instalado con nvm (`~/.nvm/versions/node/v22.21.0/bin/node`). WebStorm/Xcode lanzados desde el Dock no heredan el PATH de nvm — hay que apuntar el intérprete Node manualmente en cada IDE.
> **Nota CocoaPods/encoding:** CocoaPods avisa `WARNING: CocoaPods requires your terminal to be using UTF-8 encoding`. Se resuelve corriendo los comandos con `export LANG=en_US.UTF-8`. Benigno.

---

## 3. Bloques ejecutados (checklist 17)

| Bloque | Descripción | Estado | Nota |
|---|---|---|---|
| A | `npm install` + `npm run build:prod` | ✅ | Build limpio, 193 kB transfer (dentro del baseline) |
| B | `npx cap add ios` | ✅ | Requirió instalar `@capacitor/ios@8.3.4` (faltaba en el repo). Regenerado con CocoaPods (ver D15) |
| C | Copiar assets iOS de `resources/ios-staging/` | ✅ | AppIcon + Splash (light/dark) |
| D | Copiar `GoogleService-Info.plist` a `ios/App/App/` | ✅ | + enlazado al target vía gem `xcodeproj` (no basta con copiarlo a la carpeta) |
| E | Editar `Info.plist` | ✅ | 4 NSUsageDescription + `CFBundleURLTypes` con `REVERSED_CLIENT_ID` real |
| F | `pod install` | ✅ | 37 pods, 15 dependencies (los 13 plugins + Capacitor + Cordova) |
| G | Signing & Capabilities | 🟡 parcial | Entitlements + capabilities + `DEVELOPMENT_TEAM` pre-cableados. **Falta loguear la cuenta Apple** (§6) |
| H | AASA: `TEAMID` → `M39UFF5WFX` | ✅ | En repo. Falta deploy del frontend a producción |
| I | Primer Run en Simulador | ✅ | iPhone 16 (iOS 18.1). App arranca, carga datos de producción, Firebase OK |

**Pendientes:** G (firma, requiere cuenta Apple), J (QA — parcial en Simulador, push/cámara/Apple Sign-In/Universal Links requieren iPhone físico), K (anti-regresión web+Android), L (Archive→TestFlight), M-O (listing + review).

---

## 4. Problemas no previstos y cómo se resolvieron

### 4.1 — Faltaba `@capacitor/ios` en el repo

El repo solo traía `@capacitor/android` en `devDependencies`. `npx cap add ios` falló con *"Could not find the ios platform"*. **Fix:** `npm install --save-dev @capacitor/ios@8.3.4` (versión exacta del core/cli/android ya instalados). Quedó en `package.json`.

### 4.2 — Capacitor 8 generó proyecto SPM por defecto → se forzó CocoaPods (D15)

`npx cap add ios` generó un proyecto **Swift Package Manager** (carpeta `CapApp-SPM/Package.swift`, sin `Podfile`). El problema: el plugin `@bcyesil/capacitor-plugin-printer` **no soporta SPM** (warning *"does not have a Package.swift"*), por lo que quedaba fuera. La documentación del equipo además asumía CocoaPods (`pod install`, `.xcworkspace`, 13 plugins).

**Fix:** se borró el `ios/` SPM y se regeneró con `npx cap add ios --packagemanager CocoaPods`. Decisión formal **D15**.

### 4.3 — Disco lleno → `pod install` murió

El volumen de datos tenía **283 MB libres de 228 GB** (100% lleno). `pod install` falló al instalar Firebase con `No space left on device`. **Fix (autorizado por el owner):** se borró `~/Library/Developer/Xcode/DerivedData/*` (9.9 GB de caché de compilación, se regenera sola). Quedaron ~9.7 GB libres y `pod install` completó.

> ⚠️ **Deuda operativa:** el Mac sigue muy justo de espacio (~188 GB usados de 228). Conviene una limpieza más profunda antes de builds grandes (Archive genera varios GB).

### 4.4 — Firebase Analytics no compilaba → subspec sin Ad ID (D16)

El plugin `@capacitor-firebase/analytics` usa `default_subspec = 'Lite'`, que **NO incluye el SDK de Firebase Analytics** → error de compilación `unable to resolve module dependency: 'FirebaseAnalytics'`. **Fix:** se editó el `Podfile` para opt-in al subspec **`AnalyticsWithoutAdIdSupport`** (sin Ad ID/IDFA), coherente con la postura de privacidad del proyecto (Android removió `AD_ID` en Phase 7; la matriz de Privacy Nutrition declara cero tracking). Decisión formal **D16**.

> ⚠️ **Fragilidad:** esta línea del `Podfile` la podría sobrescribir un futuro `npx cap update ios`. Si tras un `cap update` el build vuelve a fallar con `FirebaseAnalytics` no resuelto, re-aplicar el subspec.

### 4.5 — `FirebaseApp.configure()` faltaba en el AppDelegate (D17)

Los plugins `@capacitor-firebase` llaman a `configure()` de forma perezosa, pero Crashlytics inicializa tan temprano que se perdían crashes del arranque (warning `The default Firebase app has not yet been configured`). **Fix:** se añadió `import FirebaseCore` + `FirebaseApp.configure()` en `AppDelegate.didFinishLaunchingWithOptions`. El warning desapareció. Decisión formal **D17**.

---

## 5. Bugs de UX corregidos (auth-modal)

Reportados por el owner al recorrer la app en el Simulador. Patches dirigidos (no son fase nueva).

| # | Síntoma | Causa | Fix |
|---|---|---|---|
| 5.1 | Botones de login Apple/Google **lado a lado**, apretados en móvil | `.oauth-buttons { flex }` (fila) + `.oauth-btn { flex-1 }` | `flex flex-col` + `w-full` → apilados verticalmente, ancho completo. Respeta orden iOS HIG (Apple arriba). Solo afecta iOS visualmente (en web/Android solo hay 1 botón) |
| 5.2 | Al tocar un botón OAuth, **ambos** mostraban el spinner "Conectando..." | Los dos botones leían la misma señal `isOAuthLoading()` | Nueva señal `oauthLoadingProvider` (`'google'\|'apple'\|null`). Solo el botón tocado gira; ambos se deshabilitan para evitar doble disparo |

Archivos: [`auth-modal.component.ts`](../../../src/app/shared/components/auth-modal/auth-modal.component.ts), [`auth-modal.component.html`](../../../src/app/shared/components/auth-modal/auth-modal.component.html), [`auth-modal.component.scss`](../../../src/app/shared/components/auth-modal/auth-modal.component.scss).

---

## 6. El bloqueo de la firma (Team M39UFF5WFX)

La cuenta Apple Developer del proyecto (`M39UFF5WFX`, de Luis Manuel Carvallo Gomez) **NO está logueada en el Xcode de este Mac**. Los certificados de firma presentes son de otras cuentas:

```
Apple Development: Yornel Marval Guzman (3JSBSP5S95)
Apple Development: Adrian Real (HZAB27BV9C)
Apple Development: Melanie Marval (7U34997GGB)
Apple Distribution: Conceptual Dynamic PSC. C.A. (QG5HJCC4Z5)
```

**Implicaciones:**
- **Simulador:** funciona sin firma ("Sign to Run Locally") → por eso la app ya corre. ✅
- **iPhone físico / Archive / TestFlight:** requieren la cuenta `M39UFF5WFX` (donde están registrados el App ID, Service ID, llave APNs y app iOS de Firebase de la Fase A). ⛔

Se dejó pre-configurado en el proyecto (`DEVELOPMENT_TEAM = M39UFF5WFX`, `CODE_SIGN_STYLE = Automatic`, `App.entitlements` con las 3 capabilities) para que, al agregar la cuenta, Xcode solo tenga que aprovisionar.

> **Nota:** NO usar otra de las cuentas presentes. Cambiar de team obligaría a rehacer App ID + Service ID + llave APNs + app iOS en Firebase + el Team ID del AASA — toda la Fase A se hizo con `M39UFF5WFX`.

**El owner confirmó (2026-06-23) que SÍ tiene acceso a la cuenta de Apple** — el siguiente paso es loguearla en Xcode → Settings → Accounts.

---

## 7. Estado de git

Commit `e2f9dc6` en `feature/dev-ios` (local, sin push). 28 archivos. **No** se commitearon `GoogleService-Info.plist` (secreto) ni `Pods/` ni `dist/` (gitignored). Se añadió `App/App/GoogleService-Info.plist` a `ios/.gitignore`.

---

## 8. Qué falta (pendiente, en orden)

1. **Loguear la cuenta Apple `M39UFF5WFX`** en Xcode → Settings → Accounts. (owner tiene acceso)
2. Verificar la pestaña Signing & Capabilities sin errores rojos.
3. **Deploy del frontend a producción** para publicar el AASA con el Team ID real (Universal Links).
4. **QA en iPhone físico:** push, cámara, Apple Sign-In, Universal Links (no validables en Simulador). Sigue actualmente sin iPhone (doc 19 §8).
5. Actualizar la política de privacidad en `www.tubusexpress.com/legal/privacidad` (texto en [`privacy-policy-additions.md`](./privacy-policy-additions.md)).
6. Archive → TestFlight (bloque L) → listing (bloque M, copy en [`app-store-listing.md`](./app-store-listing.md)) → submit.

---

## 9. Validación al cierre de la sesión

- ✅ `npm run build:prod` limpio (193 kB transfer).
- ✅ `xcodebuild ... -sdk iphonesimulator ... build` → **BUILD SUCCEEDED** (los 13 plugins + Firebase compilan).
- ✅ App instalada y corriendo en Simulador iPhone 16; landing + modal de zonificación con datos reales de producción.
- ✅ Logs: Firebase Analytics / Messaging / Crashlytics / Auth inician sin el warning de configuración. Errores de keychain/aps-environment/biometría en Simulador son esperados (build sin firma/capabilities, sin iPhone) — se resuelven al firmar.
