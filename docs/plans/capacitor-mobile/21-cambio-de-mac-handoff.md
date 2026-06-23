# 21 — Cambio de Mac: cómo retomar en otra máquina

> **Status:** ⏳ Handoff de máquina. La sesión del 2026-06-23 se hizo en la Mac de Melanie, que **se quedó sin espacio en disco** (estaba al 100%, dio problemas). Se cambia a otra Mac para continuar.
> **Propósito:** pasos exactos para retomar el trabajo iOS en una Mac nueva sin perder nada y sin re-hacer lo ya hecho.
> **Lectura previa:** [`20-ios-mac-build-session.md`](./20-ios-mac-build-session.md) (todo lo que se hizo), [`19-ios-handoff-estado-real.md`](./19-ios-handoff-estado-real.md) (datos de Apple/Firebase).

---

## 🔴 LO PRIMERO (en la Mac vieja, ANTES de apagarla)

**El trabajo de hoy está commiteado SOLO localmente. La branch `feature/dev-ios` NO está en GitHub.** Si no se sube, se pierde al cambiar de Mac.

```bash
cd "/Users/macbook/Projects/TuBus Express/tu-bus-frontend"
git push -u origin feature/dev-ios
```

Esto sube los 2 commits:
- `e2f9dc6` — proyecto iOS (`ios/`) + fixes de botones del auth-modal
- `33ad08c` — documentación (docs 19/20, decisiones D15-D17, README, master plan)
- (este doc 21 se añade en un tercer commit)

> Verificar después: `git ls-remote --heads origin feature/dev-ios` debe devolver un hash.

---

## 📦 Qué viaja por git y qué NO

| Cosa | ¿En git? | En la Mac nueva |
|---|---|---|
| Proyecto `ios/` (pbxproj, Podfile, Podfile.lock, Info.plist, entitlements, AppDelegate, assets) | ✅ Sí | Llega con el clone |
| `GoogleService-Info.plist` | ❌ **NO** (gitignored, es secreto) | **Hay que copiarlo a mano** (ver abajo) |
| `Pods/` (dependencias nativas) | ❌ No | Se regenera con `pod install` |
| `node_modules/` | ❌ No | Se regenera con `npm install` |
| `dist/` y `ios/App/App/public/` (bundle web) | ❌ No | Se regenera con `build:prod` + `cap copy ios` |

**Archivo a llevar físicamente a la Mac nueva** (USB / Drive / AirDrop): el `GoogleService-Info.plist`. En la Mac vieja está en:
`/Users/macbook/Projects/TuBus Express/Firma de la App/GoogleService-Info.plist`
(También se puede re-descargar de Firebase Console → proyecto `tubusexpress` → app iOS.)

---

## ✅ Pre-requisitos de la Mac nueva (verificar ANTES)

| # | Requisito | Cómo verificar |
|---|---|---|
| 1 | **Espacio en disco ≥ 20 GB libres** ⚠️ | `df -h /System/Volumes/Data` — el build + Pods + DerivedData de Xcode consumen ~10-15 GB. ESTE fue el problema en la Mac vieja. |
| 2 | macOS 14+ | `sw_vers` |
| 3 | Xcode 15+ | `xcodebuild -version` |
| 4 | CocoaPods | `pod --version` (si falta: `brew install cocoapods`) |
| 5 | Node 20+ | `node -v` (el proyecto usó 22.21 vía nvm) |
| 6 | Cuenta Apple de Luis (Team `M39UFF5WFX`) logueada en Xcode | Xcode → Settings → Accounts |

---

## 🔧 Pasos para retomar (en la Mac nueva)

```bash
# 1. Clonar y entrar a la branch correcta
git clone https://github.com/tubusservice-dev/tu-bus-frontend.git
cd tu-bus-frontend
git checkout feature/dev-ios

# 2. Dependencias web
npm install

# 3. Build de producción (apunta al backend de prod)
npm run build:prod

# 4. Copiar el bundle web al proyecto iOS
export LANG=en_US.UTF-8
npx cap copy ios

# 5. Copiar el GoogleService-Info.plist (traído de la Mac vieja) al target
cp /ruta/a/GoogleService-Info.plist ios/App/App/GoogleService-Info.plist
#    (queda gitignored; es normal, no se commitea)

# 6. Instalar los pods nativos
cd ios/App && pod install && cd ../..

# 7. Abrir en Xcode
open ios/App/App.xcworkspace
```

> **Nota:** el `GoogleService-Info.plist` ya está referenciado en el `.xcodeproj` (se enlazó con la gem `xcodeproj`), así que con solo copiar el archivo a `ios/App/App/` Xcode lo toma. No hay que arrastrarlo de nuevo.

Tras esto, para validar en Simulador:
```bash
# Compilar para simulador (no requiere firma)
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```
O directo en Xcode: seleccionar un Simulador (iPhone 16) y darle ▶ Run.

---

## 📍 Estado actual (dónde quedamos)

**Funciona:**
- Proyecto iOS generado (CocoaPods, 13 plugins + Firebase). Decisión D15.
- Compila y **corre en el Simulador** consumiendo el backend de producción.
- Firebase (Analytics sin Ad ID, Messaging, Crashlytics, Auth) inicializa OK.
- Fixes de UX del auth-modal (botones apilados + spinner por proveedor).
- Cuenta Apple de Luis logueada; Team `M39UFF5WFX` confirmado (cert con `OU=M39UFF5WFX`).

**Bloqueado (hallazgo de esta sesión):**
- **No se puede construir para dispositivo ni hacer el Archive de TestFlight** porque la firma automática necesita un **perfil de desarrollo**, y ese perfil **exige al menos un iPhone registrado** en la cuenta. No hay iPhone. Error literal: *"Your team has no devices... No profiles for 'com.tubusexpress.app'"*.
- Esto confirma empíricamente la limitación del doc 19 §8: **sin iPhone, el Simulador es el techo.**

---

## ⏭️ Decisión pendiente para llegar a TestFlight

Hay dos caminos (elegir en la Mac nueva):

1. **Firma manual de distribución (App Store) — SIN iPhone.** El perfil de distribución App Store NO requiere dispositivos. Se puede generar el Archive con firma manual de distribución (técnica: archive sin firmar + export con `-allowProvisioningUpdates` y método `app-store`). **Implica crear un certificado de distribución y un perfil App Store** en la cuenta de Apple de Luis (puede pedir contraseña/2FA). Es el camino real a TestFlight sin iPhone.
2. **Conectar/conseguir un iPhone una vez** para registrarlo → desbloquea la firma automática para todo (run en device + Archive). Es lo que recomendaba el doc 19 §8.

> Ojo `aps-environment`: hoy está en `development` (para que el Simulador y futuros builds de desarrollo no rompan). Para el Archive de App Store/TestFlight debe ser `production`. Lo ideal es manejarlo por configuración (Debug=development, Release=production) o cambiarlo solo al momento de archivar. Quedó documentado para no olvidarlo.

---

## 🧹 Sobre el disco (la causa del cambio)

La Mac vieja quedó al 100% (188 GB usados de 228). Durante esta sesión se borró `~/Library/Developer/Xcode/DerivedData` (9.9 GB, caché que se regenera) para poder correr `pod install`. En la Mac nueva, asegurar **≥20 GB libres** antes de empezar, porque el Archive de Release genera varios GB extra.

---

## 📚 Pendientes que NO dependen de la Mac (recordatorio)

- **Deploy del frontend a producción** para publicar el AASA (`apple-app-site-association` ya tiene el Team ID `M39UFF5WFX`) → necesario para Universal Links.
- **Actualizar la política de privacidad** en `www.tubusexpress.com/legal/privacidad` (texto en [`privacy-policy-additions.md`](./privacy-policy-additions.md)).
- **QA en iPhone físico**: push, cámara, Apple Sign-In, Universal Links (no validables en Simulador).
