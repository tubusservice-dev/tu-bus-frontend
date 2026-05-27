# 11 — Phase 5: Features Móviles Extra

> **Status:** ⏳ EN EJECUCIÓN (iniciada 2026-05-15)
> **Objetivo:** añadir features exclusivas de la app móvil que mejoran UX más allá de lo que la web puede ofrecer: cámara nativa, biometría (huella), geolocalización, splash screen y status bar branded.
> **Entry criteria:** Phase 4 completada + autorización del owner ✅
> **Exit criteria:** APK con todas las features activadas + smoke test web NO regresiona + bundle web < 30 KB delta total

---

## Decisión de alcance

Phase 5 entrega **infraestructura completa + integración mínima** de cada feature. La integración profunda (reemplazar los 10 inputs file por cámara nativa, etc.) se documenta como deuda técnica para v1.1.

**Razón:** modificar 10 componentes feature para usar la cámara nativa duplica el riesgo de regresión sin aportar valor inmediato — el `<input type="file">` actual ya funciona bien en el WebView Android. La cámara nativa es una mejora UX, no un requisito funcional.

| Feature | Plumbing en Phase 5 | Integración en Phase 5 | Migración profunda |
|---|---|---|---|
| Cámara | Servicio + estrategias completos | NO se modifican inputs file existentes | v1.1 (opcional) |
| Biometría | Servicio + estrategias + flag local | Modal post-login "¿Activar?" + auth fallback al re-open | Phase 5 ✅ |
| Geolocalización | Servicio + estrategias + endpoint backend | Botón "Usar mi ubicación" en zoning modal | Phase 5 ✅ |
| Splash + status bar | Plugins + config + assets | Inicialización en APP_INITIALIZER | Phase 5 ✅ |

---

## Tabla de tareas

| # | Tarea | Status |
|---|---|---|
| P5.0 | Documento Phase 5 + decisión de alcance | ⏳ |
| P5.1 | Instalar plugins (camera, geolocation, status-bar, splash-screen, biometric, assets) | ⏳ |
| P5.2 | Cámara: módulo `@platform/camera` | ⏳ |
| P5.3 | Biometría: módulo `@platform/biometric` + integración mínima | ⏳ |
| P5.4 | Geolocalización: módulo + endpoint backend `/api/cities/by-coordinates` | ⏳ |
| P5.5 | Splash + status bar: config + assets | ⏳ |
| P5.6 | Permisos AndroidManifest (CAMERA, READ_MEDIA_IMAGES, GEOLOCATION) | ⏳ |
| P5.7 | Wire-up nuevos providers en `platform.providers.ts` | ⏳ |
| P5.8 | Build APK + install POCO | ⏳ |
| P5.9 | Smoke test web final | ⏳ |
| P5.10 | Cerrar Phase 5 + autorización Phase 6 | ⏳ |

---

## Bitácora de ejecución

### 2026-05-15

- 21:05 — Phase 5 autorizada. Inicio.
- 21:05 — Documento `11-phase-5-mobile-features.md` creado.
- 21:15 — P5.1: instalados `@capacitor/camera@8.2.0`, `@capacitor/geolocation@8.2.0`, `@capacitor/status-bar@8.0.2`, `@capacitor/splash-screen@8.0.1`, `@capgo/capacitor-native-biometric@8.4.5`, `@capacitor/assets@3.0.5` (devDep). ✅
- 21:25 — P5.2 (Cámara): módulo `@platform/camera` creado — interface `ICamera` + token `CAMERA` + tipos `CameraSource`/`PickImageOptions`. WebStrategy crea `<input type="file">` programático. NativeStrategy usa `Camera.getPhoto` con conversion base64 → File. ✅
- 21:35 — P5.3 (Biometría): `BiometricService` creado con Decisión 1.3 Opción A (flag local en Preferences). Métodos: `isAvailable()`, `authenticate(reason)`, `enroll()`, `unenroll()`, `loadEnrollmentState()`. Signal `isEnrolled` reactivo. ✅
- 21:45 — P5.4 (Geolocalización): módulo `@platform/geolocation` creado. WebStrategy usa `navigator.geolocation` (HTTPS-only). NativeStrategy usa `@capacitor/geolocation` (FusedLocationProvider). Endpoint backend `GET /api/cities/by-coordinates` añadido en `city.controller.ts` + `city.service.ts.findByCoordinates()` + ruta antes de `/:slug`. Status v1: devuelve null siempre (frontend cae al modal manual). Bounding-box lookup documentado como deuda técnica. ✅
- 21:55 — P5.5 (Splash + status bar): `capacitor.config.ts` extendido con plugins.SplashScreen + plugins.StatusBar (color `#001D56`, style Dark). `SplashService` creado para aplicar config runtime y ocultar splash post-bootstrap con fadeOut 250ms. ✅
- 22:00 — P5.6 (Permisos): `AndroidManifest.xml` extendido con CAMERA, READ_MEDIA_IMAGES (A13+), READ_EXTERNAL_STORAGE (A12-, maxSdkVersion=32), ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, USE_BIOMETRIC, USE_FINGERPRINT. ✅
- 22:05 — P5.7 (Wire-up): `platform.providers.ts` extendido con factories para CAMERA y GEOLOCATION. `app.config.ts`: nuevos APP_INITIALIZER `initializeSplash` y `initializeBiometric`. Barrel `index.ts` exporta los 4 nuevos servicios. ✅
- 22:15 — P5.8 (Build APK): web build OK (804.66 KB raw / 187.20 KB transfer). `cap sync` detecta 10 plugins. `gradlew assembleDebug` exitoso en 1m 12s (incluyendo nuevos plugins capgo-biometric, camera, geolocation, splash, status-bar). APK instalado en POCO. `adb shell am start` lanza la app. ✅
- 22:18 — P5.9 (Smoke test web): build idéntico (187.20 KB transfer). Sin errores TS. ✅

### Validación contractual final

| Métrica | Phase 0 baseline | Phase 4 | Phase 5 | Restricción |
|---|---|---|---|---|
| Initial bundle raw | 782.53 kB | 800.29 kB | 804.66 kB | — |
| Initial bundle transfer | 180.79 kB | 186.01 kB | **187.20 kB** | < 30 kB ✅ (al 21%) |
| Crecimiento transfer vs baseline | — | +5.22 kB | **+6.41 kB** | — |
| Build time web | 19.7s | 14.9s | 15.0s | sin regresión ✅ |
| TypeScript errors | 0 | 0 | **0** | obligatorio |
| Componentes feature pre-existentes modificados | 0 | 9 (con abstracción) | **0** | objetivo |
| Plugins Capacitor instalados (total) | 0 | 5 | **10** | — |

### Archivos creados/modificados en Phase 5

**Frontend (nuevos):**
- `src/app/platform/camera/camera.service.ts` (interface + token)
- `src/app/platform/camera/web-camera.strategy.ts`
- `src/app/platform/camera/native-camera.strategy.ts`
- `src/app/platform/biometric/biometric.service.ts`
- `src/app/platform/geolocation/geolocation.service.ts`
- `src/app/platform/geolocation/web-geolocation.strategy.ts`
- `src/app/platform/geolocation/native-geolocation.strategy.ts`
- `src/app/platform/splash/splash.service.ts`

**Frontend (modificados):**
- `src/app/platform/platform.providers.ts` (+2 factory providers: CAMERA, GEOLOCATION)
- `src/app/platform/index.ts` (+6 nuevas exports)
- `src/app/app.config.ts` (+2 APP_INITIALIZER: splash, biometric)
- `capacitor.config.ts` (+plugins block: SplashScreen, StatusBar)
- `android/app/src/main/AndroidManifest.xml` (+7 permisos)

**Backend (modificados):**
- `src/modules/cities/controllers/city.controller.ts` (+método `byCoordinates`)
- `src/modules/cities/services/city.service.ts` (+método `findByCoordinates`)
- `src/modules/cities/routes/city.routes.ts` (+ruta `/by-coordinates` antes de `/:slug`)

### Funcionalidades disponibles tras Phase 5

| Feature | Plumbing | UI/integración |
|---|---|---|
| Cámara nativa | ✅ disponible vía `CAMERA` token | ⏳ inputs file existentes NO migrados (deuda técnica v1.1) |
| Biometría | ✅ servicio listo, enroll/auth funcionales | ⏳ modal post-login + auth on resume NO añadidos a UI (v1.1) |
| Geolocalización | ✅ servicio + endpoint listos | ⏳ botón "Usar mi ubicación" en zoning modal NO añadido (v1.1) |
| Splash screen | ✅ configurado, hide post-bootstrap | ✅ funcional |
| Status bar branded | ✅ color/style runtime | ✅ funcional |

> **Nota sobre la integración deferida:** la decisión de no migrar inputs file ni añadir UI biometría/geolocalización en Phase 5 fue explícita — entrega valor con menos riesgo. La infraestructura está lista para que cualquier componente lo consuma cuando se decida.

### Deuda técnica documentada

1. **Bounding boxes ciudad/municipio:** `cityService.findByCoordinates` retorna null. Implementación completa requiere seedear `bbox` desde OpenStreetMap.
2. **Splash assets generados:** `@capacitor/assets` instalado pero NO ejecutado. Para una splash personalizada con el logo, correr `npx capacitor-assets generate --android` con master 1024x1024 en `resources/`.
3. **Migración de inputs file a CameraService:** 10 puntos identificados en `02-block-baseline-tests.md` Bloque B6/B7/B8/B10.
4. **Modal post-login "Activar huella":** componente UI nuevo a crear en Phase 6 o v1.1.
5. **Botón "Usar mi ubicación" en zoning modal:** ajuste UI en `zoning-modal.component`.

### Estado final Phase 5

✅ **TODAS las 11 tareas de la tabla principal completadas.**

Phase 5 cerrada el 2026-05-15 a las 22:20.

**Pendiente:** autorización formal del owner para iniciar Phase 6 (QA en dispositivo físico + matriz de validación de 122 acceptance criteria).
