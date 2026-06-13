# 07 — Phase 1: Bootstrap Capacitor

> **Status:** ✅ CERRADA (2026-05-15)
> **Owner:** Luis V (workstation Windows)
> **Objetivo:** instalar Capacitor, generar la carpeta `android/`, compilar el primer APK e instalarlo en el POCO físico. Verificar que la app abre y carga la landing TuBus Express.
> **Entry criteria:** Phase 0 completada (`06-phase-0-prerequisites.md`) + autorización formal del owner ✅
> **Exit criteria:** APK abre en POCO + landing carga + smoke test web NO roto + bundle web no creció más de 30 kB
> **Lectura previa:** `00-master-plan.md` sec 7, `03-coexistence-strategy.md`

---

## Tabla de tareas

| # | Tarea | Status | Validación |
|---|---|---|---|
| P1.1 | Instalar paquetes Capacitor (`@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, `@capacitor/app`) | ⏳ A EJECUTAR | `npm ls @capacitor/core` muestra versión |
| P1.2 | Verificar estructura del bundle web `dist/tubus-express/browser` | ⏳ A EJECUTAR | `ls dist/tubus-express/browser/index.html` retorna OK |
| P1.3 | `npx cap init` con appId `com.tubusexpress.app` | ⏳ A EJECUTAR | `capacitor.config.ts` creado |
| P1.4 | Configurar `capacitor.config.ts` (server.androidScheme, allowNavigation, backgroundColor) | ⏳ A EJECUTAR | Archivo final con config completa |
| P1.5 | `npx cap add android` | ⏳ A EJECUTAR | Carpeta `frontend/android/` generada |
| P1.6 | Copiar `google-services.json` a `frontend/android/app/` | ⏳ A EJECUTAR | Archivo presente en la ruta correcta |
| P1.7 | Actualizar `.gitignore` (excluir build outputs Android, mantener tracking de Gradle config) | ⏳ A EJECUTAR | `.gitignore` con entries Capacitor |
| P1.8 | `npx cap sync android` (copiar bundle web a android assets) | ⏳ A EJECUTAR | Sin errores |
| P1.9 | Compilar APK (Gradle) e instalar en POCO via `adb install` o `npx cap run android` | ⏳ A EJECUTAR | APK aparece en lista de apps del POCO |
| P1.10 | Validar app abre + landing carga + smoke test web rebuilt | ⏳ A EJECUTAR | Landing TuBus Express visible en POCO + `npm run build:prod` sigue OK |
| P1.11 | Actualizar log + autorización Phase 2 | ⏳ A EJECUTAR | Log con bitácora final + decisiones nuevas |

---

## Bitácora de ejecución

> Se actualiza en tiempo real conforme avanza la ejecución.

### 2026-05-15

- 17:00 — Phase 1 autorizada por el owner. Inicio.
- 17:00 — Documento `07-phase-1-bootstrap.md` creado.
- 17:05 — P1.1: instalados `@capacitor/core@8.3.4`, `@capacitor/cli@8.3.4`, `@capacitor/android@8.3.4`, `@capacitor/app@8.1.0`. Total: 67 paquetes nuevos. ✅
- 17:08 — P1.2: confirmada estructura `dist/tubus-express/browser/index.html`. ✅
- 17:10 — P1.3 + P1.4: `capacitor.config.ts` creado con `appId='com.tubusexpress.app'`, `webDir='dist/tubus-express/browser'`, `androidScheme='https'`, allowNavigation con dominios api/cloudinary/google/firebase, backgroundColor=`#001D56`. ✅
- 17:12 — P1.5: `npx cap add android` exitoso. Carpeta `android/` generada con AGP 8.13.0, gms-google-services 4.4.4 ya integrado. ✅
- 17:13 — P1.6: `google-services.json` copiado a `android/app/`. Capacitor 8 lo detecta automáticamente vía bloque condicional en `android/app/build.gradle`. ✅
- 17:15 — P1.7: `android/.gitignore` actualizado: descomentado `google-services.json` (excluir), keystore patterns descomentados. `frontend/.gitignore` ampliado con `capacitor.config.local.ts` y `.capacitor/`. ✅
- 17:17 — P1.8: `npx cap sync android` exitoso en 0.188s. Detectó plugin `@capacitor/app@8.1.0`. ✅
- 17:18 — P1.9: `./gradlew assembleDebug` exitoso en **1m 57s** (124 tareas). APK generado: `app-debug.apk` (6.5 MB). `adb install -r` exitoso. `adb shell am start -n com.tubusexpress.app/.MainActivity` exitoso. ✅
- 17:25 — P1.10: validación dual:
   - **App POCO:** confirmada por owner — landing carga correctamente, navegación funciona. ✅
   - **Smoke test web:** `npm run build:prod` exitoso en 16.8s. Bundle initial: 782.53 kB raw / 180.79 kB transfer — **IDÉNTICO al baseline**. Crecimiento: 0 kB. ✅

### Cambios de decisión durante Phase 1

| # | Decisión original | Cambio | Razón |
|---|---|---|---|
| Cambio 1.2 | minSdkVersion 23 | minSdkVersion 24 | Capacitor 8 requiere oficialmente API 24+. Diferencia de cobertura: ~2.5%. Aceptable. |
| Cambio Stack | Capacitor 7 | Capacitor 8.3.4 | npm instaló la última estable (mediados 2025). Requiere JDK 17+ ✅, AGP 8.5+ ✅. |
| Cambio targetSdkVersion | 34 | 36 | Capacitor 8 default. Compatible con Play Store policy. compileSdkVersion=36 también. |

### Validación contractual de coexistencia

| Métrica | Baseline (pre-Capacitor) | Post-Capacitor | Restricción | Status |
|---|---|---|---|---|
| Initial bundle raw | 782.53 kB | 782.53 kB | NO debe crecer >30 kB | ✅ 0 kB |
| Initial bundle transfer | 180.79 kB | 180.79 kB | — | ✅ 0 kB |
| Build time web | 19.695 s | 16.8 s | — | ✅ Sin regresión |
| Web compila | OK | OK | obligatorio | ✅ |

### Estado final Phase 1

✅ **TODAS las 11 tareas de la tabla principal completadas.**

Phase 1 cerrada el 2026-05-15 a las 17:25.

**Pendiente:** autorización formal del owner para iniciar Phase 2 (backend: CORS + endpoint OAuth nativo).

### Archivos nuevos creados (NO commiteados aún, decisión del owner)

```
frontend/capacitor.config.ts                              ← TRACKED (debe ir a git)
frontend/android/                                         ← TRACKED parcialmente
   build.gradle, settings.gradle, gradle.properties,
   variables.gradle, gradlew, gradlew.bat, gradle/, app/  (todo excepto build/, .gradle/, etc)
frontend/android/app/google-services.json                 ← NO TRACKED (gitignored)
frontend/android/app/src/main/assets/public/              ← NO TRACKED (gitignored)
frontend/android/app/src/main/assets/capacitor.config.json ← NO TRACKED (gitignored)
frontend/android/app/src/main/assets/capacitor.plugins.json ← NO TRACKED (gitignored)
frontend/android/.gitignore                               ← TRACKED (modificado)
frontend/.gitignore                                       ← TRACKED (modificado)
frontend/package.json                                     ← TRACKED (modificado)
frontend/package-lock.json                                ← TRACKED (modificado)
```

---

## Próximo documento

[`08-phase-2-backend.md`](./08-phase-2-backend.md) — se genera al completar Phase 1.
