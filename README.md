# TuBus Express — Frontend (Angular 20 + Capacitor 8)

> ## 🛑 LEE ESTO ANTES DE TOCAR CÓDIGO
>
> Este repositorio contiene una **documentación crítica** del proyecto que debes leer **antes** de empezar cualquier tarea. Todo el historial técnico, decisiones arquitecturales, fases ejecutadas y trabajo pendiente vive en:
>
> ### 📂 `docs/plans/capacitor-mobile/`
>
> **Si estás retomando el proyecto en una nueva máquina (especialmente en un Mac para continuar con la app iOS), arranca por:**
>
> 1. [`docs/plans/capacitor-mobile/00-master-plan.md`](docs/plans/capacitor-mobile/00-master-plan.md) — plan maestro completo (estado de las Phases 0-6.6 Android + Phase B Windows Track iOS)
> 2. [`docs/plans/capacitor-mobile/05-decisions-log.md`](docs/plans/capacitor-mobile/05-decisions-log.md) — bitácora autoritativa de las 14 decisiones formales (D1-D14)
> 3. [`docs/plans/capacitor-mobile/16-phase-B-windows-track.md`](docs/plans/capacitor-mobile/16-phase-B-windows-track.md) — qué se hizo desde Windows para preparar iOS (Apple Sign-In backend + frontend + assets + AASA + legal copy)
> 4. **`docs/plans/capacitor-mobile/17-mac-handoff-checklist.md`** ← **si estás en el Mac, este es tu punto de partida exacto.** 15 bloques A-O para ir de `git clone` a TestFlight en 4-6 horas.
>
> **Sin leer estos documentos primero, vas a romper cosas o duplicar trabajo ya hecho.** No es una sugerencia — está documentado en orden de lectura y cada uno apunta al siguiente.

---

## Estado actual del proyecto (al 2026-05-27)

| Plataforma | Status | Detalle |
|---|---|---|
| **Web** (`https://tubusexpress.com`) | ✅ En producción | Auto-deploy desde `main` |
| **Backend** (`https://api.tubusexpress.com`) | ✅ En producción | Auto-deploy desde `feat/capacitor-ios` (rama actual de trabajo) |
| **Android APK** | ✅ Validada en POCO X4 Pro 5G + Samsung A56 | Pendiente release firmado + Play Store (Phase 7) |
| **iOS** | 🟡 Preparado al 70 % desde Windows | Pendiente Mac + cuenta Apple Developer para Phase B post-Mac. Sigue `17-mac-handoff-checklist.md` |

---

## Stack

- **Angular** 20.1.x + standalone components + signals
- **Capacitor** 8.3.4 (Android nativo, iOS pendiente)
- **11 plugins Capacitor:** core, app, preferences, browser, camera, geolocation, status-bar, splash-screen, firebase-authentication, firebase-messaging, native-biometric, printer
- **Tailwind** 3.4 + SCSS
- **Firebase** (Auth, Cloud Messaging, futuro: Analytics + Crashlytics)
- **Backend:** Express + TypeScript + Mongoose en repo separado (`../backend`), deployado en Railway

---

## Scripts npm

```bash
npm start              # Angular dev server en http://localhost:4200
npm run build:prod     # Bundle de producción → dist/tubus-express/browser/
npx cap sync android   # Copia bundle + plugins a android/app/src/main/assets/
                       # Requiere build:prod previo
```

Para generar el APK Android debug:

```powershell
npm run build:prod
npx cap sync android
cd android
.\gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk (~17 MB)
```

Instalar en dispositivo:

```powershell
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.tubusexpress.app/.MainActivity
```

---

## Branches

| Branch | Propósito | Deploy |
|---|---|---|
| `main` | Producción web | Auto a `tubusexpress.com` |
| **`feat/capacitor-ios`** | Trabajo Capacitor iOS + cambios Apple Sign-In | Backend auto-deploya a Railway prod; frontend NO auto-deploya (deploy manual) |
| `feat/capacitor-android` | (Histórico) Trabajo Capacitor Android Phases 0-6.6 | Merged en feat/capacitor-ios |

---

## Convenciones del proyecto (resumen)

1. **Path aliases obligatorios:** `@core/*`, `@shared/*`, `@features/*`, `@layouts/*`, `@models/*`, `@env`, `@platform/*`. Nunca relativos largos.
2. **Cero warnings** en `npm run build:prod` antes de cualquier PR.
3. **Backend aditivo:** cero modificación a endpoints existentes (la rama actual va a Railway producción).
4. **Tests pre-commit:** `npx tsc --noEmit` + `npm test` (backend) sin regresiones sobre los 36 tests pre-existentes.
5. **Strategy pattern** para todo lo que difiera web ↔ Android ↔ iOS. Ver `src/app/platform/`.
6. **Plugins Capacitor:** `await import('@capacitor/...')` SOLO dentro de strategies nativas (lazy load para no inflar bundle web).

---

## Estructura

```
frontend/
├── src/
│   ├── app/
│   │   ├── platform/          ← Strategy pattern: web vs native (Android/iOS)
│   │   │   ├── apple-auth/    ← iOS-only, gateado por isIos()
│   │   │   ├── google-auth/
│   │   │   ├── storage/, messaging/, camera/, geolocation/, etc.
│   │   ├── core/              ← Servicios singleton (auth, products, etc.)
│   │   ├── shared/            ← Componentes reutilizables
│   │   ├── features/          ← Páginas (catalog, checkout, perfil, etc.)
│   │   ├── layouts/           ← Header, footer, main-layout, admin-layout
│   │   └── models/
│   ├── environments/
│   └── styles.scss
├── android/                   ← Proyecto Android nativo (TRACKED)
│   └── app/src/main/
│       ├── java/com/tubusexpress/app/MainActivity.java   ← bridge safe-area Phase 6.6
│       └── AndroidManifest.xml
├── ios/                       ← NO EXISTE TODAVÍA — se genera con `npx cap add ios` en el Mac
├── public/
│   └── .well-known/
│       ├── assetlinks.json                       ← Android App Links
│       └── apple-app-site-association            ← iOS Universal Links (TEAMID placeholder)
├── resources/
│   ├── icon.png  (1024×1024 master)
│   ├── splash.png  (2732×2732 master)
│   └── ios-staging/           ← Assets iOS pre-generados desde Windows (Phase B WB-5)
│       ├── AppIcon.appiconset/
│       ├── Splash.imageset/
│       └── README.md           ← cómo usar en el día del Mac
├── docs/
│   └── plans/
│       └── capacitor-mobile/  ← TODA la documentación técnica del proyecto (LEER PRIMERO)
├── capacitor.config.ts
├── nginx.conf
└── package.json
```

---

## Para el día que continuamos en el Mac

1. `git clone <este-repo> tubus-frontend`
2. `cd tubus-frontend && git checkout feat/capacitor-ios && git pull`
3. **Lee primero** `docs/plans/capacitor-mobile/00-master-plan.md` y `docs/plans/capacitor-mobile/16-phase-B-windows-track.md` para ponerte al día.
4. **Después** abre `docs/plans/capacitor-mobile/17-mac-handoff-checklist.md` y ejecuta los 15 bloques A-O en orden estricto.
5. Cualquier decisión nueva que tomes durante el handoff → registrarla en `docs/plans/capacitor-mobile/05-decisions-log.md` como D15, D16, etc.

**Tiempo estimado total en Mac:** 4-6 horas si todos los pre-requisitos del checklist están listos.
