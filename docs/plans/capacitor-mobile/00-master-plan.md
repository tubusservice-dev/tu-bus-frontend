# Capacitor Mobile — Master Plan

> **Status:** Draft / Pending approval
> **Owner:** —
> **Created:** 2026-05-14
> **Last updated:** 2026-05-15
> **Target platforms (Phase A):** Android only
> **Target platforms (Phase B, deferred):** iOS
> **Codebase impact:** Frontend Angular 20.1 (`/frontend`) + Backend Express (`/backend`, mínimo)
> **Verification gate per phase:** see "Definition of Done" of each phase

## 📚 Documentos del plan (orden de lectura)

| # | Archivo | Propósito |
|---|---|---|
| 00 | **`00-master-plan.md`** (este) | Plan maestro: visión, fases, riesgos, estimación |
| 01 | [`01-system-blocks-definition.md`](./01-system-blocks-definition.md) | Sistema dividido en 10 bloques funcionales con archivos, endpoints, dependencias |
| 02 | [`02-block-baseline-tests.md`](./02-block-baseline-tests.md) | Análisis baseline (READ-ONLY) de cada bloque + 122 acceptance criteria que se ejecutarán dos veces (ahora mentalmente, después de Phase 7 funcionalmente) |
| 03 | [`03-coexistence-strategy.md`](./03-coexistence-strategy.md) | Justificación arquitectural de cada cambio y cómo coexisten web + nativo sin perder funcionalidad |
| 04 | [`04-user-requirements.md`](./04-user-requirements.md) | Lo que necesito del owner: 12 decisiones bloqueantes + credenciales + accesos + costos |
| 05 | [`05-decisions-log.md`](./05-decisions-log.md) | Bitácora autoritativa de decisiones formales tomadas (12 iniciales + 5 de Phase 6.5 + items pendientes) |
| 06 | [`06-phase-0-prerequisites.md`](./06-phase-0-prerequisites.md) | Fase 0 ejecutada: setup del workstation Android + dispositivo POCO |
| 07 | [`07-phase-1-bootstrap.md`](./07-phase-1-bootstrap.md) | Fase 1 ejecutada: Capacitor instalado, primer APK corriendo en POCO |
| 08 | [`08-phase-2-backend.md`](./08-phase-2-backend.md) | Fase 2 ejecutada: CORS + endpoint OAuth Google nativo + refactor passport.ts |
| 09 | [`09-phase-3-platform-layer.md`](./09-phase-3-platform-layer.md) | Fase 3 ejecutada: Strategy pattern + factory providers + 4 plugins instalados |
| 10 | [`10-phase-4-migrations.md`](./10-phase-4-migrations.md) | Fase 4 ejecutada: 9 migraciones críticas (storage, OAuth nativo, FCM, deep links, hardware back, external links) |
| 11 | [`11-phase-5-mobile-features.md`](./11-phase-5-mobile-features.md) | Fase 5 ejecutada: cámara, biometría, geolocalización, splash, status bar |
| 12 | [`12-phase-6-qa.md`](./12-phase-6-qa.md) | Fase 6 ejecutada: QA en POCO + 5 bugs corregidos + ícono TuBus |
| 13 | [`13-phase-6.5-post-qa-fixes.md`](./13-phase-6.5-post-qa-fixes.md) | Phase 6.5 ejecutada: 9 bugs descubiertos post-distribución (Android 15+ edge-to-edge + auth Google + admin agnóstico) + 1 feature nuevo (bidirectional Google linking) |
| 14 | [`14-phase-6.6-native-insets-bridge.md`](./14-phase-6.6-native-insets-bridge.md) | Phase 6.6 ejecutada: descubrimiento del bug raíz (Android WebView no propaga `WindowInsets` al CSS) + bridge nativo `MainActivity.java` + normalización masiva `env()` → `var(--safe-area-*)` en 36 archivos + grid de municipios siempre 2 columnas |

> **Antes de aprobar la implementación:** lee los 6 primeros documentos en orden. El 04 te pide decisiones explícitas; el 05 las registra como cerradas. Los documentos 06-13 son bitácoras ejecutadas que se consultan para entender el estado actual del proyecto.

---

## Índice

1. [Objetivos y alcance](#1-objetivos-y-alcance)
2. [Principios rectores](#2-principios-rectores)
3. [Stack final y dependencias](#3-stack-final-y-dependencias)
4. [Estructura del repositorio resultante](#4-estructura-del-repositorio-resultante)
5. [Mapa de fases](#5-mapa-de-fases)
6. [Fase 0 — Pre-requisitos del entorno](#6-fase-0--pre-requisitos-del-entorno)
7. [Fase 1 — Bootstrap de Capacitor (Android)](#7-fase-1--bootstrap-de-capacitor-android)
8. [Fase 2 — Backend (CORS + endpoint OAuth nativo)](#8-fase-2--backend-cors--endpoint-oauth-nativo)
9. [Fase 3 — Capa de plataforma en Angular](#9-fase-3--capa-de-plataforma-en-angular)
10. [Fase 4 — Migraciones críticas (los 9 puntos)](#10-fase-4--migraciones-críticas-los-9-puntos)
11. [Fase 5 — Features móviles extra](#11-fase-5--features-móviles-extra)
12. [Fase 6 — QA en dispositivo físico](#12-fase-6--qa-en-dispositivo-físico)
13. [Fase 7 — Build firmado y distribución](#13-fase-7--build-firmado-y-distribución)
14. [Esquema de versionado web ↔ app](#14-esquema-de-versionado-web--app)
15. [Live Updates (decisión diferida)](#15-live-updates-decisión-diferida)
16. [Riesgos y mitigaciones](#16-riesgos-y-mitigaciones)
17. [Estimación de esfuerzo](#17-estimación-de-esfuerzo)
18. [Bitácora de progreso](#18-bitácora-de-progreso)
19. [Glosario](#19-glosario)

---

## 1. Objetivos y alcance

### 1.1 Qué se va a lograr

Generar una APK / AAB firmada de **TuBus Express** para Android, distribuible vía Google Play Store o sideloading directo, **sin sacrificar ni degradar la versión web actual** (`https://tubusexpress.com`).

### 1.2 Alcance funcional

La app móvil ofrecerá **el mismo set de features que la web**, más estas funcionalidades exclusivas nativas:

| Feature móvil extra | Plugin Capacitor | Justificación |
|---|---|---|
| Cámara real para subir comprobantes/avatares | `@capacitor/camera` | UX superior al `<input type="file">` y permite captura inmediata |
| Login biométrico (huella / face unlock) | `@capgo/capacitor-native-biometric` | Reduce fricción de re-autenticación tras cierre de la app |
| Geolocalización para sucursales cercanas | `@capacitor/geolocation` | Pre-selecciona ciudad/municipio desde GPS y ordena sucursales por distancia |
| Notificaciones push nativas | `@capacitor-firebase/messaging` | Delivery confiable en background sin depender de Service Workers |
| Splash screen y status bar nativas | `@capacitor/splash-screen`, `@capacitor/status-bar` | Aspecto profesional |
| Acceso al hardware back button | `@capacitor/app` | Sincronizar con `OverlayStackService` |

### 1.3 Lo que NO está en alcance (esta iteración)

- iOS (se aborda en Phase B después de validar Android).
- Live updates / OTA (se decide después de la primera publicación).
- App watch / wearables.
- Soporte offline real (la app sigue requiriendo conectividad — no caching de catálogo).
- Pagos in-app con Google Pay nativo (sigue usándose el flujo actual de comprobantes).

### 1.4 Restricciones inviolables

1. **La web NO puede romperse en ningún momento.** Todo cambio debe ser gateado por `Capacitor.isNativePlatform()` o ser equivalente funcional para web y nativo.
2. **El backend NO se rompe para clientes web actuales.** Todo cambio en backend es aditivo (nuevos endpoints, nuevas env vars).
3. **No se introduce un segundo repositorio.** Single source of truth: este monorepo.
4. **No se duplica el bundle Angular.** El mismo `dist/tubus-express/browser` alimenta web y app nativa.
5. **No se usan deprecaciones.** Capacitor 6.x o 7.x (la mayor estable al momento de implementar).
6. **Toda dependencia añadida debe documentarse** en este plan con la justificación.

---

## 2. Principios rectores

### 2.1 Detección de plataforma

Toda decisión runtime se canaliza a través de **un único servicio**: `PlatformService`. Reglas:

- Nunca importar `Capacitor` directamente en componentes/servicios de feature.
- Nunca consultar `navigator.userAgent` para detectar plataforma — es frágil.
- El `PlatformService` expone signals computados (`isNative`, `isAndroid`, `isIos`, `isWeb`) y banderas de capability (`hasCamera`, `hasBiometrics`, `hasGeolocation`).

### 2.2 Strategy pattern por capability

Las features con implementación divergente entre web y nativo se modelan como **estrategias intercambiables** detrás de una interfaz común. Ejemplo:

```
StorageService (interface)
 ├── WebStorageStrategy (localStorage)
 └── NativeStorageStrategy (@capacitor/preferences)
```

El factory provider de Angular elige la implementación correcta en `app.config.ts`. **Los consumidores nunca saben qué estrategia se está usando.**

### 2.3 Lazy loading de plugins nativos

Los plugins de Capacitor se importan dinámicamente (`await import('@capacitor/camera')`) **dentro de las estrategias nativas**, nunca a nivel de módulo. Esto evita engordar el bundle web con código que jamás se ejecutará.

### 2.4 Backwards compatibility en el backend

- Endpoints nuevos siempre coexisten con los viejos.
- Si un endpoint cambia su contrato, se versiona (`/api/v2/...`) en lugar de modificar.
- Las env vars existentes nunca se renombran — solo se amplían valores.

### 2.5 Comentarios y documentación de código

Por la regla de proyecto (`CLAUDE.md` global, sección 5):
- Comentarios en **inglés** para nuevas variables, funciones, clases.
- Esta documentación de plan en **español**.
- Solo se comenta el "por qué" no obvio, nunca el "qué".

### 2.6 Cero warnings

Cumple regla `feedback_zero_warnings.md`: el panel Problems debe quedar vacío al cerrar cualquier task. Esto incluye warnings de Android Studio y Gradle.

### 2.7 Path aliases obligatorios

Cumple regla `feedback_path_aliases.md`: todo nuevo código usa `@core/*`, `@shared/*`, `@features/*`, `@layouts/*`, `@models/*`, `@env`. Se añadirá `@platform/*` para los nuevos servicios de plataforma.

---

## 3. Stack final y dependencias

### 3.1 Versiones objetivo (a verificar al instalar)

| Tecnología | Versión esperada | Fuente |
|---|---|---|
| Capacitor Core | ^7.0.0 (mayor estable a 2026-05) | npm |
| Android Gradle Plugin | 8.5+ | Capacitor 7 requirements |
| Android SDK | API 34 (target), API 23 (min) | Google Play policy |
| JDK | 17 (LTS) | Android Studio Hedgehog+ |
| Android Studio | Hedgehog (2023.1) o superior | jetbrains.com |
| Node.js | 20 LTS (ya alineado con Dockerfile) | proyecto |
| Angular | 20.1.x (ya instalado) | proyecto |

### 3.2 Plugins Capacitor a instalar (Phase A — Android)

| Paquete npm | Propósito | Reemplaza/extiende |
|---|---|---|
| `@capacitor/core` | Runtime | — |
| `@capacitor/cli` | CLI para sync, build, etc. | — |
| `@capacitor/android` | Plataforma Android | — |
| `@capacitor/app` | Eventos de app (back button, deep links, foregrounded) | `OverlayStackService` |
| `@capacitor/preferences` | Storage seguro key-value | `localStorage` para JWT |
| `@capacitor/browser` | Abrir URLs externas in-app | `window.open(url, '_blank')` |
| `@capacitor/status-bar` | Color/estilo status bar | meta tags iOS PWA |
| `@capacitor/splash-screen` | Splash nativo | imágenes `public/splash/` |
| `@capacitor/clipboard` | Portapapeles cross-platform | `navigator.clipboard` |
| `@capacitor/camera` | Captura/selección de imágenes | `<input type="file">` (UX premium) |
| `@capacitor/geolocation` | GPS | (feature nueva) |
| `@capacitor-firebase/messaging` | FCM nativo | `firebase/messaging` web SDK |
| `@capacitor-firebase/authentication` | Sign-In con Google nativo | `passport-google-oauth20` (vía web) |
| `@capacitor/local-notifications` | Notificaciones locales (toast en foreground) | `Notification` API |
| `@capgo/capacitor-native-biometric` | Huella / Face Unlock | (feature nueva) |
| `@capacitor/assets` | Generador de iconos y splash | scripts manuales |
| `@bcyesil/capacitor-plugin-printer` | Impresión nativa (PrintManager Android) — botón "Imprimir" en detalle de orden | `window.print()` (no-op en Android WebView) |

> **Nota:** los paquetes `@capacitor-firebase/*` (Robingenz) son una alternativa a los oficiales de Capgo. Se elige la familia Robingenz por ser la más mantenida en 2026 y tener APIs simétricas para messaging y auth. **Verificar al instalar** que la versión es compatible con Capacitor 7.

> **Nota — Plugin printer (añadido post-Phase 6.6):** `@bcyesil/capacitor-plugin-printer@0.0.6` se incorporó después del cierre de Phase 6.6 al detectar que `window.print()` es no-op en Android WebView. Integrado en la capa `@platform/print/` con Strategy pattern (web usa `window.print()`, native delega al `PrintManager` del SO). Cero impacto en bundle web (lazy import). El sheet nativo del SO ofrece impresora física, "Guardar como PDF" y compartir a otras apps.

### 3.3 Dependencias backend nuevas

| Paquete npm | Propósito |
|---|---|
| `google-auth-library` | Verificar `idToken` enviado por la app nativa contra Google |

### 3.4 Software del workstation (instalación una vez)

| Tool | Versión | Notas |
|---|---|---|
| Android Studio | Hedgehog+ | Incluye SDK Manager, AVD Manager, Gradle |
| JDK 17 | OpenJDK Temurin | Setear `JAVA_HOME` |
| Android SDK Platform Tools | latest | Para `adb` |
| Android SDK Build Tools | 34.0.0+ | |
| Android NDK | (opcional) | Solo si algún plugin lo requiere |
| Dispositivo Android físico | API 23+ | **Obligatorio** para QA — el emulador no replica todo (push, biometría, GPS) |
| Cuenta Google Play Developer | $25 USD una vez | Solo si se publicará en Play Store |

---

## 4. Estructura del repositorio resultante

Después de completar Phase A, la estructura del frontend queda:

```
frontend/
├── android/                          ← NUEVO (gitignored excepto build.gradle, etc.)
│   ├── app/
│   │   ├── build.gradle              ← Versionado y firma
│   │   ├── google-services.json      ← Firebase Android (NO commitear, usar template)
│   │   └── src/main/
│   │       ├── AndroidManifest.xml   ← Permisos, deep links, intent filters
│   │       ├── res/                  ← Iconos, splash, strings
│   │       └── java/com/tubusexpress/app/
│   │           └── MainActivity.java ← Bridge Capacitor (no se toca)
│   ├── build.gradle                  ← Top-level
│   └── gradle/
├── capacitor.config.ts               ← NUEVO (configuración Capacitor)
├── public/
│   ├── ... (sin cambios — sw.js, manifest, etc. siguen sirviendo a web)
├── src/
│   ├── app/
│   │   ├── platform/                 ← NUEVO (servicios de plataforma)
│   │   │   ├── platform.service.ts
│   │   │   ├── storage/
│   │   │   │   ├── storage.service.ts                (interface + factory)
│   │   │   │   ├── web-storage.strategy.ts
│   │   │   │   └── native-storage.strategy.ts
│   │   │   ├── auth/
│   │   │   │   ├── google-auth.service.ts            (interface + factory)
│   │   │   │   ├── web-google-auth.strategy.ts       (window.location.href)
│   │   │   │   └── native-google-auth.strategy.ts    (Firebase Auth Capacitor)
│   │   │   ├── messaging/
│   │   │   │   ├── messaging.service.ts              (interface + factory)
│   │   │   │   ├── web-messaging.strategy.ts         (firebase/messaging)
│   │   │   │   └── native-messaging.strategy.ts      (@capacitor-firebase/messaging)
│   │   │   ├── external-link/
│   │   │   │   ├── external-link.service.ts          (interface + factory)
│   │   │   │   ├── web-external-link.strategy.ts
│   │   │   │   └── native-external-link.strategy.ts
│   │   │   ├── biometric/
│   │   │   │   └── biometric.service.ts              (no-op en web)
│   │   │   ├── geolocation/
│   │   │   │   └── geolocation.service.ts            (cae a IP-based en web)
│   │   │   ├── camera/
│   │   │   │   ├── camera.service.ts                 (interface + factory)
│   │   │   │   ├── web-camera.strategy.ts            (input file)
│   │   │   │   └── native-camera.strategy.ts         (@capacitor/camera)
│   │   │   ├── deep-links/
│   │   │   │   └── deep-links.service.ts             (no-op en web)
│   │   │   ├── back-button/
│   │   │   │   └── back-button.service.ts            (no-op en web)
│   │   │   └── print/                                ← AÑADIDO post-Phase 6.6
│   │   │       ├── print.service.ts                  (interface + factory)
│   │   │       ├── web-print.strategy.ts             (window.print)
│   │   │       └── native-print.strategy.ts          (@bcyesil/capacitor-plugin-printer)
│   │   ├── core/
│   │   │   └── services/
│   │   │       └── notification-router.service.ts   ← AÑADIDO post-Phase 6.6
│   │   │                                              (consume FCM tapSubject → Router.navigateByUrl)
│   │   ├── features/                                 (sin cambios)
│   │   ├── layouts/                                  (sin cambios)
│   │   ├── models/                                   (sin cambios)
│   │   ├── shared/                                   (sin cambios)
│   │   ├── app.config.ts                             ← MODIFICADO (APP_INITIALIZER: auth, settings,
│   │   │                                                pwa, backButton, deepLinks, splash, biometric,
│   │   │                                                notificationRouter, notificationPermissionSync)
│   │   └── app.routes.ts                             (sin cambios)
│   ├── environments/
│   │   ├── environment.ts                            (sin cambios)
│   │   └── environment.prod.ts                       (sin cambios)
│   ├── main.ts                                       ← MODIFICADO (skip SW si nativo)
│   └── index.html                                    (sin cambios)
├── tsconfig.json                                     ← MODIFICADO (agregar @platform/*)
├── package.json                                      ← MODIFICADO (deps + scripts)
└── ... (resto sin cambios)
```

Backend:

```
backend/
├── src/
│   ├── modules/
│   │   └── users/
│   │       ├── controllers/auth.controller.ts        ← MODIFICADO (nuevo método googleNative)
│   │       └── routes/auth.routes.ts                 ← MODIFICADO (nueva ruta POST /google/native)
│   └── ... (resto sin cambios)
├── package.json                                      ← MODIFICADO (+google-auth-library)
└── ... (resto sin cambios)
```

### 4.1 Archivos `.gitignore` requeridos

**`frontend/.gitignore`** (añadir):

```
# Capacitor
android/.gradle/
android/.idea/
android/app/build/
android/app/release/
android/build/
android/local.properties
android/captures/
android/app/google-services.json    # commitear template, no real

# iOS (placeholder para Phase B)
ios/App/Pods/
ios/App/build/
ios/App/App/GoogleService-Info.plist  # commitear template, no real

# Capacitor build artifacts
.capacitor/
```

### 4.2 Archivos a commitear

- `capacitor.config.ts` ✅
- `android/build.gradle`, `android/app/build.gradle`, `android/gradle/wrapper/*` ✅
- `android/app/src/main/AndroidManifest.xml` ✅
- `android/app/src/main/res/` (iconos, splash, strings) ✅
- `android/app/google-services.json.example` (template, sin secretos reales) ✅
- `android/keystore.properties.example` (template) ✅

### 4.3 Secretos y credenciales

| Archivo | Manejo |
|---|---|
| `android/app/google-services.json` | NO commitear. Distribuir vía vault interno. |
| Keystore `.jks` para firmar | NO commitear. Solo en máquina de release. Backup cifrado. |
| `keystore.properties` | NO commitear. Solo en máquina de release. |
| `GOOGLE_CLIENT_ID_ANDROID` (env backend) | Variable de entorno Railway. |

---

## 5. Mapa de fases

```
Phase 0    Pre-requisitos del entorno          (1 día)        ✅ CERRADA
   ↓
Phase 1    Bootstrap Capacitor                 (0.5 día)      ✅ CERRADA
   ↓
Phase 2    Backend ajustes                     (1 día)        ✅ CERRADA
   ↓
Phase 3    Capa de plataforma                  (1 día)        ✅ CERRADA
   ↓
Phase 4    Migraciones críticas (9 puntos)    (5-7 días)     ✅ CERRADA
   ↓
Phase 5    Features móviles extra              (3-4 días)     ✅ CERRADA
   ↓
Phase 6    QA en dispositivo                   (2-3 días)     ✅ CERRADA
   ↓
Phase 6.5  Fixes post-QA (no prevista)         (1 día)        ✅ CERRADA
   ↓
Phase 6.6  Bridge nativo safe-area (hotfix)    (0.5 día)      ✅ CERRADA
   ↓
Phase 7    Build firmado y distribución        (1 día)        ⏳ PENDIENTE
                                               ─────────
                                               ~16-20 días hombre

Phase B (futuro, fuera de alcance)
   iOS replication                             (~5 días si Phase A bien diseñada)
```

**Phase 6.5** no estaba en el plan original. Apareció cuando el owner distribuyó el APK a un segundo dispositivo (Android 15+) tras cerrar Phase 6. Reveló 9 bugs latentes — la mayoría causados por **edge-to-edge enforcement obligatorio en Android 15+ con `targetSdk=36`**. Detalle en [`13-phase-6.5-post-qa-fixes.md`](./13-phase-6.5-post-qa-fixes.md).

**Phase 6.6** apareció cuando la validación de Phase 6.5 en Samsung A56 (Android 14) mostró que los fixes CSS-only seguían fallando. La investigación profunda reveló que el WebView Android **no propaga los `WindowInsets` del SO al CSS** por defecto — `env(safe-area-inset-*)` retorna `0px` en todas las versiones Android. La solución estructural fue un bridge nativo en `MainActivity.java` que captura los insets via `setOnApplyWindowInsetsListener` y los inyecta como CSS variables. Detalle en [`14-phase-6.6-native-insets-bridge.md`](./14-phase-6.6-native-insets-bridge.md).

Cada fase tiene su propio archivo de especificación detallada (a crearse cuando se apruebe avanzar): `01-phase-0.md`, `02-phase-1.md`, etc. Este documento maestro contiene los resúmenes y los acceptance criteria.

---

## 6. Fase 0 — Pre-requisitos del entorno

### 6.1 Objetivo

Dejar el workstation listo para compilar Android. Cero código tocado.

### 6.2 Tareas

| # | Tarea | Validación |
|---|---|---|
| 0.1 | Instalar JDK 17 (Temurin) | `java -version` muestra 17.x |
| 0.2 | Setear `JAVA_HOME` y agregar a PATH | `echo $env:JAVA_HOME` en PowerShell |
| 0.3 | Instalar Android Studio Hedgehog+ | App abre sin errores |
| 0.4 | Instalar Android SDK Platform 34 + Build Tools 34 | Visible en SDK Manager |
| 0.5 | Setear `ANDROID_SDK_ROOT` env var | `adb version` funciona |
| 0.6 | Aceptar todas las licencias Android | `sdkmanager --licenses` → todos `Y` |
| 0.7 | Crear AVD (Android Virtual Device) Pixel 7 API 34 | El emulador arranca y muestra home |
| 0.8 | Conseguir un dispositivo físico Android API 23+ | `adb devices` lo lista |
| 0.9 | Activar "Developer options" + "USB debugging" en el dispositivo | `adb devices` muestra `device` no `unauthorized` |
| 0.10 | Crear/recuperar proyecto Firebase para `tubusexpress` | Console accesible |
| 0.11 | Registrar app Android en Firebase con package `com.tubusexpress.app` | `google-services.json` descargado |
| 0.12 | Obtener SHA-1 del debug keystore (`~/.android/debug.keystore`) y registrarlo en Firebase + Google Cloud OAuth | Aparece en consola |
| 0.13 | Crear OAuth 2.0 Client ID tipo "Android" en Google Cloud Console | Client ID copiado |
| 0.14 | Crear OAuth 2.0 Client ID tipo "Web application" (si no existe) | Client ID copiado para verificar tokens en backend |

### 6.3 Definition of Done

- [ ] `npx cap doctor` (cuando se instale Capacitor) reporta entorno OK.
- [ ] Puedo abrir un proyecto Android dummy en Android Studio y ejecutarlo en mi dispositivo físico.
- [ ] `google-services.json` real disponible (vault).
- [ ] OAuth Client IDs Android + Web disponibles.

### 6.4 Riesgos

| Riesgo | Mitigación |
|---|---|
| `JAVA_HOME` apunta a JDK distinto al esperado por Gradle | Validar con `gradle --version` |
| Dispositivo físico no aparece en `adb devices` | Reinstalar drivers OEM USB |
| Firewall bloquea descarga de SDK | Usar proxy o red distinta |

---

## 7. Fase 1 — Bootstrap de Capacitor (Android)

### 7.1 Objetivo

Tener la app actual compilando y corriendo dentro de un WebView Android, **sin ninguna lógica móvil específica todavía**. Es el "hello world" de la migración.

### 7.2 Tareas

#### 7.2.1 Instalación de dependencias

Ejecutar en `frontend/`:

```bash
npm install --save @capacitor/core @capacitor/app
npm install --save-dev @capacitor/cli @capacitor/android
```

#### 7.2.2 Inicializar Capacitor

```bash
npx cap init "TuBus Express" "com.tubusexpress.app" --web-dir="dist/tubus-express/browser"
```

Genera `capacitor.config.ts` que se configurará así:

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tubusexpress.app',
  appName: 'TuBus Express',
  webDir: 'dist/tubus-express/browser',
  // androidScheme: 'https' enables Cookies/secure-context APIs to work
  // identically to production web, avoiding mixed-content quirks.
  server: {
    androidScheme: 'https',
    // Allow navigation to API and asset domains. Without this entry the
    // WebView blocks fetches as cross-origin even when CORS is correct.
    allowNavigation: [
      'api.tubusexpress.com',
      'res.cloudinary.com',
      '*.googleusercontent.com',
      '*.firebaseio.com',
      '*.googleapis.com',
    ],
  },
  android: {
    // Disables the default backgroundColor flash before web content paints.
    backgroundColor: '#001D56',
  },
};

export default config;
```

#### 7.2.3 Generar carpeta Android

```bash
npm run build:prod        # genera dist/tubus-express/browser
npx cap add android
npx cap sync android
```

#### 7.2.4 Verificar build

```bash
npx cap open android      # abre Android Studio
```

En Android Studio: Build → Make Project → Run en dispositivo físico.

#### 7.2.5 Añadir scripts npm

A `package.json` del frontend:

```json
{
  "scripts": {
    "android:build": "npm run build:prod && npx cap sync android",
    "android:open": "npm run android:build && npx cap open android",
    "android:run": "npm run android:build && npx cap run android"
  }
}
```

### 7.3 Definition of Done

- [ ] La app abre en el dispositivo físico Android.
- [ ] Se ve la landing page (`/`) idéntica a la web.
- [ ] Se puede navegar al catálogo (`/catalogo`) y los productos cargan vía HTTPS.
- [ ] El bundle web sigue compilando con `npm run build:prod`.
- [ ] El deploy web a Railway sigue funcionando (validar con un push trivial).
- [ ] **Lo que NO funciona aún (esperado):** login, push, OAuth Google. Eso es Phase 4.

### 7.4 Riesgos

| Riesgo | Mitigación |
|---|---|
| `webDir` apunta mal y la app abre vacía | Verificar `dist/tubus-express/browser/index.html` existe |
| CORS rechaza las requests | Esto se arregla en Phase 2 — esperado por ahora |
| Bundle excede 100 MB (límite Play Store) | Auditar con `du -sh dist/tubus-express/browser` — actualmente debería estar muy por debajo |

---

## 8. Fase 2 — Backend (CORS + endpoint OAuth nativo)

### 8.1 Objetivo

Dos cambios aditivos en el backend que permiten que la app móvil consuma la API. **Cero impacto en la web actual.**

### 8.2 Tareas

#### 8.2.1 Ampliar CORS

Editar la env var Railway `CORS_ORIGINS`:

```
CORS_ORIGINS=https://tubusexpress.com,capacitor://localhost,http://localhost,https://localhost
```

> El código en `backend/src/app.ts:51-82` ya soporta esto vía split por comas. **No requiere cambio de código.**

> **Importante:** mantener `https://tubusexpress.com` y cualquier valor preexistente. Estos solo se *añaden*.

#### 8.2.2 Endpoint OAuth Google nativo

**Archivo nuevo o método nuevo en:** `backend/src/modules/users/controllers/auth.controller.ts`

Método: `googleNative(req, res, next)`. Lógica:

1. Recibe `{ idToken: string }` en body.
2. Valida con `google-auth-library`:
   ```
   const ticket = await client.verifyIdToken({
     idToken,
     audience: [config.oauth.google.androidClientId, config.oauth.google.webClientId],
   });
   const payload = ticket.getPayload();
   ```
3. Reusa la lógica de `passport.ts` (3 ramas: existing googleId, email collision, new user). Lo más limpio es **extraer la lógica de `passport.ts` a un service** `userService.findOrCreateGoogleUser(profile)` y llamarlo desde ambos lugares.
4. Genera JWT igual que `oauthCallback`: `this.generateToken(user)`.
5. Devuelve JSON: `{ success: true, data: { token, user } }` (NO redirect — la app maneja la respuesta directamente).
6. Casos de error: códigos `ACCOUNT_BLOCKED`, `ACCOUNT_SUSPENDED`, `EMAIL_ALREADY_REGISTERED_LOCAL` → respuesta JSON 403 con `{ code, message }`.

**Archivo modificado:** `backend/src/modules/users/routes/auth.routes.ts`

Añadir ruta:

```typescript
router.post(
  '/google/native',
  loginRateLimit,
  body('idToken').notEmpty().withMessage('idToken requerido'),
  validateRequest,
  authController.googleNative.bind(authController)
);
```

#### 8.2.3 Refactor preventivo de `passport.ts`

Extraer la lógica de las 3 ramas (lookup por googleId, email collision, create) a `userService.findOrCreateFromGoogleProfile(profile)`. Luego:

- `passport.ts` la llama (mantiene compat con web actual).
- `authController.googleNative` la llama (nuevo flujo nativo).

DRY + un solo lugar para auditar la política de OAuth.

#### 8.2.4 Env vars nuevas en backend

```
GOOGLE_CLIENT_ID_ANDROID=<el client id Android del Google Cloud Console>
GOOGLE_CLIENT_ID_WEB=<el client id Web ya existente o nuevo>
```

> El existente `GOOGLE_CLIENT_ID` se mantiene (lo usa Passport-Google-OAuth20).

### 8.3 Definition of Done

- [ ] Web sigue logueando con Google sin cambios percibibles.
- [ ] `POST /api/auth/google/native` con un `idToken` válido devuelve JWT + user.
- [ ] `POST /api/auth/google/native` con un `idToken` inválido devuelve 401.
- [ ] Test unitario nuevo: `userService.findOrCreateFromGoogleProfile` cubre las 3 ramas.
- [ ] Backend QA: `npm test` en `backend/` pasa.
- [ ] Backend deploy en Railway exitoso, web sigue logueando.

### 8.4 Riesgos

| Riesgo | Mitigación |
|---|---|
| Audience del idToken nativo no coincide → `verifyIdToken` falla | Aceptar **ambos** client IDs (Android y Web) en el array `audience` |
| Race condition en email collision | Mongoose unique index ya garantiza atomicidad |
| Sesiones express se llenan de basura por requests sin cookie | El nuevo endpoint NO usa Passport — bypass total |

---

## 9. Fase 3 — Capa de plataforma en Angular

### 9.1 Objetivo

Crear los servicios de plataforma (`PlatformService` + estrategias) **vacíos** o con implementación mínima. Sin migrar lógica todavía. Este es el andamiaje sobre el que se construye Phase 4.

### 9.2 Tareas

#### 9.2.1 Configurar path alias

`frontend/tsconfig.json` → añadir:

```json
"paths": {
  ...,
  "@platform/*": ["src/app/platform/*"]
}
```

#### 9.2.2 Crear `PlatformService`

Archivo: `src/app/platform/platform.service.ts`

API:

```typescript
@Injectable({ providedIn: 'root' })
export class PlatformService {
  readonly isNative: Signal<boolean>;
  readonly isAndroid: Signal<boolean>;
  readonly isIos: Signal<boolean>;
  readonly isWeb: Signal<boolean>;
  // Feature capabilities
  readonly hasBiometrics: Signal<boolean>;  // populated via APP_INITIALIZER
  readonly hasGeolocation: Signal<boolean>;
}
```

Internamente usa `Capacitor.getPlatform()`, `Capacitor.isNativePlatform()`. En web devuelve `'web'`, sin importar `@capacitor/core` falla — **`@capacitor/core` se importa siempre**, es solo runtime detection.

#### 9.2.3 Crear interfaces de strategy

Por cada capability (storage, auth, messaging, external-link, camera), crear:

- `<capability>.service.ts` — interface + token de inyección + factory provider
- `web-<capability>.strategy.ts` — implementación web (puede ser un thin wrapper sobre el código actual)
- `native-<capability>.strategy.ts` — placeholder con `throw new Error('Not implemented yet')` o lazy-load del plugin

#### 9.2.4 Wirering en `app.config.ts`

Para cada capability se añade un provider con factory:

```typescript
{
  provide: STORAGE_TOKEN,
  useFactory: (platform: PlatformService) =>
    platform.isNative() ? new NativeStorageStrategy() : new WebStorageStrategy(),
  deps: [PlatformService],
}
```

#### 9.2.5 Stub plugin imports

Importar los plugins instalados pero **no usarlos aún**. Validar que el bundle web sigue compilando.

### 9.3 Definition of Done

- [ ] `PlatformService` retorna correctamente `isNative=false` en navegador.
- [ ] `PlatformService` retorna correctamente `isNative=true` cuando se corre en la APK.
- [ ] Todas las strategies web son thin wrappers del código actual y la web sigue funcionando 100%.
- [ ] Todas las strategies native compilan (no hay errores de TS) pero pueden lanzar `Not implemented yet` si se invocan.
- [ ] Bundle web no crece más de 30 kB.
- [ ] `npm run build:prod` cero warnings.

### 9.4 Riesgos

| Riesgo | Mitigación |
|---|---|
| Imports estáticos de plugins inflan bundle web | Usar `await import('@capacitor/x')` dentro de strategies nativas |
| Factory provider mal configurado → DI falla en runtime | Tests unitarios para cada strategy + smoke test E2E |

---

## 10. Fase 4 — Migraciones críticas (los 9 puntos)

### 10.1 Objetivo

Conectar las strategies nativas creadas en Phase 3 a los 9 puntos críticos identificados en el análisis. **Web sigue funcionando idéntico, app cobra vida.**

### 10.2 Sub-fases (orden estricto)

#### 10.2.1 Step 4.1 — CORS (ya hecho en Phase 2)

Validación: hacer una request manual desde la APK a `/api/products` y confirmar que NO da error CORS.

#### 10.2.2 Step 4.2 — Storage abstraction

**Archivos modificados:**
- `src/app/core/services/auth.service.ts`
- `src/app/core/interceptors/auth.interceptor.ts`
- `src/app/app.config.ts` (initializer ahora es async)

**Cambios:**
1. `AuthService.getToken()` pasa a `Promise<string | null>`.
2. `AuthService.handleAuthSuccess(...)` pasa a `async`.
3. `authInterceptor` cambia de síncrono a `from(authService.getToken()).pipe(switchMap(...))`.
4. `getStoredUser()` se llama en `APP_INITIALIZER` y se cachea en signal — el resto del código lee el signal sincronicamente.

**Web:** la strategy web envuelve `localStorage` con `Promise.resolve(...)` para mantener compat.

**Nativo:** la strategy nativa usa `Preferences.get/set/remove`.

**Otras claves migradas a Preferences en nativo (en localStorage en web):**
- `auth_token`, `auth_user`, `admin_auth_token`, `admin_auth_user` ✅ (críticas)
- `oauth_return_url` ✅
- **NO se migra:** `shopping_cart` (puede vivir en localStorage incluso en nativo — datos no sensibles)
- **NO se migra:** `e-commerce-theme`, `pwa_install_dismissed_at`, `user_location` (no sensibles)

#### 10.2.3 Step 4.3 — OAuth Google nativo

**Archivos modificados:**
- `src/app/core/services/auth.service.ts` → `loginWithOAuth(provider)` se gateifica:
  ```typescript
  loginWithOAuth(provider: OAuthProvider): void {
    if (this.platform.isNative()) {
      this.googleAuthService.signIn().subscribe({...});
    } else {
      // Comportamiento ACTUAL sin cambios
      localStorage.setItem('oauth_return_url', window.location.pathname);
      window.location.href = `${this.apiUrl}/${provider}`;
    }
  }
  ```

**Strategy nativa (`native-google-auth.strategy.ts`):**
1. `await import('@capacitor-firebase/authentication')`.
2. `FirebaseAuthentication.signInWithGoogle()` → devuelve `idToken`.
3. `POST /api/auth/google/native` con `{ idToken }`.
4. Recibe `{ token, user }` → `authService.applyNewSession(token, user)` (método ya existe).
5. Maneja errores `ACCOUNT_BLOCKED` etc. con el mismo `triggerAccountBlocked` actual.

**Validación:** después de login nativo, el resto de la app funciona idéntico (interceptor mete el JWT, etc.).

#### 10.2.4 Step 4.4 — Deep links (verify-email, reset-password, verify-account-link, auth/callback)

**Pre-requisito:** servir desde `https://tubusexpress.com` los archivos:
- `/.well-known/assetlinks.json` (para Android App Links)

Contenido (template):

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.tubusexpress.app",
    "sha256_cert_fingerprints": ["<SHA-256 del keystore de release>"]
  }
}]
```

**Configuración en `AndroidManifest.xml`:**

```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https" android:host="tubusexpress.com" />
</intent-filter>
```

**Servicio nativo (`deep-links.service.ts`):**

```typescript
async init(): Promise<void> {
  if (!this.platform.isNative()) return;
  const { App } = await import('@capacitor/app');
  App.addListener('appUrlOpen', (event) => {
    const url = new URL(event.url);
    const path = url.pathname + url.search + url.hash;
    this.zone.run(() => this.router.navigateByUrl(path));
  });
}
```

Inicializado en un `APP_INITIALIZER` nuevo.

**Web:** servicio existe pero su `init()` retorna sin hacer nada.

#### 10.2.5 Step 4.5 — FCM nativo

**Archivos modificados:**
- `src/app/core/firebase/firebase-messaging.service.ts` → gateifica `requestToken()` y `getMessagingInstance()`.
- `src/app/core/services/device-token.service.ts` → el campo `platform` deja de ser hardcoded `'web'`.

**Strategy nativa:**
1. `await import('@capacitor-firebase/messaging')`.
2. `FirebaseMessaging.requestPermissions()`.
3. `FirebaseMessaging.getToken()` → registra en backend con `platform: 'android'`.
4. `FirebaseMessaging.addListener('notificationReceived', ...)` → equivale al `onMessage` foreground.
5. `FirebaseMessaging.addListener('notificationActionPerformed', ...)` → equivale al `notificationclick`.

**Backend:** ningún cambio. El `device-tokens` module ya es agnóstico (`platform` es string libre, el `firebase-admin` envía igual a tokens iOS/Android/web).

**Web:** strategy web envuelve el código actual sin cambios.

#### 10.2.6 Step 4.6 — Hardware back button

**Archivos modificados:**
- `src/app/platform/back-button/back-button.service.ts` (nuevo)
- `src/app/app.ts` o `app.config.ts` → APP_INITIALIZER que llama `backButtonService.init()`

```typescript
async init(): Promise<void> {
  if (!this.platform.isNative()) return;
  const { App } = await import('@capacitor/app');
  App.addListener('backButton', ({ canGoBack }) => {
    this.zone.run(() => {
      if (this.overlayStack.isOpen()) {
        this.overlayStack.goBack();
        return;
      }
      if (canGoBack) {
        this.location.back();
      } else {
        // Show "exit app?" prompt or just exit
        App.exitApp();
      }
    });
  });
}
```

**Web:** init() es no-op.

#### 10.2.7 Step 4.7 — External links (WhatsApp, tel, redes sociales)

**Archivos modificados:**
- `src/app/core/services/cart.service.ts:481` (WhatsApp checkout)
- `src/app/shared/components/customer-support-action/customer-support-action.component.ts:67,73`
- `src/app/shared/components/phone-action-popover/phone-action-popover.component.ts:72,79`
- `src/app/layouts/components/footer/footer.component.ts:87`
- `src/app/layouts/pages/tu-bus-servicio/components/tubus-contact/tubus-contact.component.ts:84,90`
- `src/app/features/mechanic-progress/mechanic-progress.component.ts:190,196`

Reemplazar `window.open(url, '_blank' | '_self')` por `externalLinkService.open(url)`.

**Strategy web:** `window.open(url, target)` (idéntico al actual).

**Strategy nativa:**
- `tel:`, `mailto:`, `sms:` → `App.openUrl({ url })` → SO maneja el intent.
- `https://wa.me/...` → `App.openUrl({ url })` también (SO abre WhatsApp si está instalado).
- URLs sociales (Facebook, Instagram, Twitter) → `Browser.open({ url })` (Custom Tabs in-app).

#### 10.2.8 Step 4.8 — File inputs / cámara (deferido a Phase 5)

En Phase 4 los inputs file siguen funcionando con `<input type="file" accept="image/*">` en el WebView Android — funciona out-of-the-box. La mejora UX con plugin Camera se hace en Phase 5.

**Permisos en `AndroidManifest.xml`:**

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"
                 android:maxSdkVersion="32" />
```

#### 10.2.9 Step 4.9 — Splash, status bar, iconos

**Archivos modificados:**
- `android/app/src/main/res/drawable/splash.png` (generado por `@capacitor/assets`)
- `android/app/src/main/res/values/styles.xml` (si se quiere customizar el theme del splash)
- `capacitor.config.ts` → bloque `plugins: { SplashScreen: { ... } }`
- `src/app/platform/platform.service.ts` o un nuevo APP_INITIALIZER que llame a `StatusBar.setBackgroundColor({ color: '#001D56' })`.

Generación de assets:

```bash
npm install --save-dev @capacitor/assets
# Colocar logo 1024x1024 en frontend/resources/icon.png
# Colocar splash 2732x2732 en frontend/resources/splash.png
npx capacitor-assets generate --android
```

### 10.3 Definition of Done de Phase 4

- [ ] Login local funciona en la app.
- [ ] Login admin funciona en la app.
- [ ] Login Google nativo funciona en la app y devuelve JWT.
- [ ] Web sigue logueando con Google igual que antes (sin cambios percibibles).
- [ ] Push notification con la app cerrada llega al dispositivo y al tap navega a la URL correcta.
- [ ] Hardware back en overlay producto/carrito → cierra overlay (no la app).
- [ ] Hardware back sin overlays y sin historial → muestra prompt de salir.
- [ ] WhatsApp checkout abre WhatsApp app del SO.
- [ ] Tap en `tel:` abre dialer.
- [ ] Tap en email link verify-email/reset-password desde Gmail app → abre la app, no el navegador.
- [ ] Splash screen aparece al abrir la app.
- [ ] Status bar tiene color `#001D56`.
- [ ] Web sigue compilando, sigue deployando, sigue funcionando idéntico.

### 10.4 Riesgos

| Riesgo | Mitigación |
|---|---|
| `getToken()` async rompe lugares no migrados | Buscar todas las llamadas con grep antes de mergear |
| FCM nativo no recibe push si el app process está muerto | Verificar con `adb shell` y test real desde Firebase Console |
| Deep links solo funcionan después de instalar app firmada | Probar con APK firmada (no con `cap run`) |
| `appUrlOpen` se dispara antes de que Angular esté listo | Encolar la URL en el servicio hasta que router esté ready |

---

## 11. Fase 5 — Features móviles extra

### 11.1 Objetivo

Implementar las 3 features exclusivas móviles que el usuario aprobó: **cámara nativa, biometría, geolocalización**.

### 11.2 Feature 5.1 — Cámara nativa

#### 11.2.1 Cobertura

Reemplazar (en nativo) los siguientes inputs file:

| Componente | Uso | Plugin Camera mode |
|---|---|---|
| `product-form.component` (admin) | Subir imágenes producto | `pickImages` (multi) |
| `mechanic-form.component` (admin) | Avatar mecánico | `getPhoto` (single, gallery+camera) |
| `brand-form.component` (admin) | Logo marca | `getPhoto` |
| `line-form.component` (admin) | Logo línea | `getPhoto` |
| `shipping-agency-form.component` (admin) | Logo agencia | `getPhoto` |
| `settings.component` (admin) | Hero image | `getPhoto` |
| `payment-form.component` (cliente) | Comprobante de pago | `getPhoto` (gallery+camera, prefiero camera) |
| `checkout-summary.component` (cliente) | Comprobante checkout | `getPhoto` |
| `payment-history.component` (cliente) | Comprobante historial | `getPhoto` |
| `order-detail.component` (cliente) | Comprobante en detail | `getPhoto` |

#### 11.2.2 API del servicio

```typescript
interface CameraService {
  pickImage(options?: { source?: 'camera' | 'gallery' | 'prompt' }): Promise<File>;
  pickImages(options?: { limit?: number }): Promise<File[]>;
}
```

**Estrategia web:** abre el `<input type="file">` programáticamente y devuelve el `File`.

**Estrategia nativa:**
1. `Camera.getPhoto({ resultType: 'base64', source: 'Prompt' })` → base64.
2. Convertir a `File` con un helper (`base64ToFile`).
3. Pasar al `FormData` existente que va al backend (cero cambios en `upload.service.ts` ni en backend).

#### 11.2.3 Permisos Android

`AndroidManifest.xml` (ya añadidos en Phase 4):

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```

#### 11.2.4 UX

- En desktops/tablets web: input file actual sin cambios.
- En la app nativa: tap muestra prompt nativo "Cámara | Galería | Cancelar".

### 11.3 Feature 5.2 — Biometría (huella / face unlock)

#### 11.3.1 Caso de uso

Re-autenticar al cliente cuando reabre la app **si ya inició sesión antes** y tiene biometría disponible. Evita pedir contraseña cada vez.

#### 11.3.2 Flujo

1. Al loguearse exitosamente (cualquier método: local, Google, admin), si `biometricService.isAvailable()` → preguntar si quiere activar "Inicio de sesión rápido con huella".
2. Si acepta: guardar un flag `biometric_enabled: true` en Preferences + un `biometric_credential_token` (opaco, no es el JWT).
3. La próxima vez que se abre la app y el JWT esté presente pero próximo a expirar / expirado → en vez de pedir login, pide huella → si exitoso, llama a `POST /api/auth/refresh-with-biometric` (endpoint nuevo) que valida el `biometric_credential_token` y emite JWT nuevo.

> **Decisión arquitectural pendiente:** ¿el "biometric_credential_token" es solo un flag local que despierta el JWT desde Preferences, o requiere un round trip al backend? La opción simple (flag local) es suficiente para v1; backend round trip es más seguro pero más compleja. Definir antes de implementar.

#### 11.3.3 API del servicio

```typescript
interface BiometricService {
  isAvailable(): Promise<boolean>;
  authenticate(reason: string): Promise<boolean>;
  enroll(): Promise<void>;          // Marks user as opted-in
  unenroll(): Promise<void>;
  isEnrolled(): Promise<boolean>;
}
```

#### 11.3.4 Plugin

`@capgo/capacitor-native-biometric` — wrap de Android BiometricPrompt (API 28+) e iOS LocalAuthentication.

#### 11.3.5 Pantallas nuevas

- Modal post-login: "¿Activar inicio rápido con huella?"
- Pantalla de splash al reabrir: "Coloca tu huella para continuar" (solo si enrolado).

#### 11.3.6 Web

`isAvailable()` siempre devuelve `false`. `authenticate()` rechaza. La UI nunca muestra opciones biométricas en web.

### 11.4 Feature 5.3 — Geolocalización para sucursales cercanas

#### 11.4.1 Caso de uso

En el modal de zonificación (`zoning-modal`), añadir un botón "Usar mi ubicación actual" que:
1. Pide permiso de GPS.
2. Obtiene `{ latitude, longitude }`.
3. Llama a un endpoint nuevo `GET /api/cities/by-coordinates?lat=...&lng=...` que devuelve la ciudad/municipio detectado por reverse geocoding (puede usarse Google Maps API o cálculo simple por bounding boxes).
4. Pre-selecciona ciudad/municipio en el modal.

Adicionalmente: ordenar las sucursales en `BranchSummary` por distancia geodésica si hay coordenadas.

#### 11.4.2 API del servicio

```typescript
interface GeolocationService {
  isAvailable(): Promise<boolean>;
  getCurrentPosition(): Promise<{ lat: number; lng: number; accuracy: number }>;
  watchPosition(callback): Promise<string>;  // Returns watcher ID
  clearWatch(id: string): Promise<void>;
}
```

#### 11.4.3 Plugin

`@capacitor/geolocation` — Android FusedLocationProvider + iOS CoreLocation.

#### 11.4.4 Permisos Android

```xml
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

#### 11.4.5 Web

En web usa `navigator.geolocation.getCurrentPosition` (HTTPS only). Funciona en `tubusexpress.com` pero solo si el usuario otorga permiso del navegador.

#### 11.4.6 Backend

Endpoint nuevo:

```
GET /api/cities/by-coordinates?lat=10.4806&lng=-66.9036
→ { citySlug: 'caracas', municipalitySlug: 'libertador' }
```

Implementación: lookup en `City` model + cálculo de bounding box. **Si la implementación full requiere mucho trabajo, en v1 puede devolver siempre `caracas/libertador` y queda como deuda técnica.**

### 11.5 Definition of Done de Phase 5

- [ ] Cámara nativa funciona en los 10 puntos de subida de imagen.
- [ ] Biometría: usuario puede activarla, autenticar con ella, desactivarla.
- [ ] Geolocalización: botón "usar ubicación" pre-selecciona ciudad/municipio.
- [ ] Web no muestra UI biométrica (correctamente oculta).
- [ ] Web sigue usando input file y geolocation HTML5.
- [ ] Cero regresiones en flujos web.

### 11.6 Riesgos

| Riesgo | Mitigación |
|---|---|
| Plugin biometric tiene bugs en Android específicos | Validar lista de dispositivos compatibles antes |
| GPS otorga `accuracy` baja → ciudad incorrecta | Mostrar fallback al modal manual si accuracy > 5 km |
| Reverse geocoding requiere API de Google con costo | Empezar con bounding boxes propias, escalar si necesario |

---

## 12. Fase 6 — QA en dispositivo físico

### 12.1 Objetivo

Validar la app en al menos **3 dispositivos físicos** distintos antes de considerar lista para distribución.

### 12.2 Matriz de dispositivos

| Tier | Modelo objetivo | API | Por qué |
|---|---|---|---|
| Tier A (alto) | Pixel 7 / Samsung S22+ | API 34 | Validar comportamiento en hardware moderno |
| Tier B (medio) | Xiaomi Redmi Note 10 / Samsung A52 | API 30-31 | Cubre el segmento más común en Venezuela |
| Tier C (bajo) | Cualquier API 23-26 con 2 GB RAM | API 23 | Validar performance mínima soportada |

### 12.3 Casos de prueba

#### 12.3.1 Auth

- [ ] Login local cliente: éxito + token persistido tras kill app.
- [ ] Login local admin: éxito + admin layout cargado.
- [ ] Login Google nativo: éxito + perfil cargado.
- [ ] Login Google con cuenta colisionada (caso EMAIL_ALREADY_REGISTERED_LOCAL): muestra modal correcto.
- [ ] Logout: limpia Preferences, regresa a home, FCM token desregistrado.
- [ ] Re-autenticación con biometría tras 24 h.
- [ ] Reset password desde email: tap en link → abre app → muestra form → cambio exitoso.
- [ ] Verify email desde email: tap en link → abre app → confirma + auto-login.

#### 12.3.2 Catálogo y carrito

- [ ] Catálogo carga productos vía API.
- [ ] Imágenes Cloudinary se ven.
- [ ] Búsqueda funciona.
- [ ] Filtros funcionan.
- [ ] Add to cart sin login → modal de auth.
- [ ] Add to cart con login → carrito actualiza.
- [ ] Carrito persiste tras kill app.
- [ ] Overlay de detalle producto: hardware back lo cierra.
- [ ] Overlay de carrito: hardware back lo cierra.

#### 12.3.3 Checkout

- [ ] Selección de zona/sucursal funciona.
- [ ] Botón "usar mi ubicación" otorga permiso, detecta ciudad.
- [ ] Forma de checkout despacho/agencia/envío/delivery.
- [ ] Subida de comprobante con cámara nativa.
- [ ] Subida con galería.
- [ ] Confirmación de orden.

#### 12.3.4 Push notifications

- [ ] App en foreground recibe push y muestra toast.
- [ ] App en background recibe push como notificación nativa.
- [ ] App matada (force stop) recibe push y al tap abre la app en la URL correcta.
- [ ] Logout desregistra el token (verificar en backend que el documento se borra).

#### 12.3.5 External

- [ ] WhatsApp checkout abre WhatsApp.
- [ ] Tap en teléfono abre dialer.
- [ ] Link de redes sociales abre Custom Tab.

#### 12.3.6 Performance

- [ ] Tiempo de cold start < 4 s.
- [ ] Catálogo carga primera vez < 3 s.
- [ ] Sin crashes en 30 min de uso continuo.
- [ ] Memoria < 200 MB.

### 12.4 Definition of Done

- [ ] 100% de los casos pasan en Tier A.
- [ ] 100% en Tier B.
- [ ] 90%+ en Tier C (degradación de performance aceptable, no crashes).
- [ ] Cero regresiones en QA web (correr smoke test web también).

### 12.5 Bugs encontrados

Tabla en `06-qa-bugs-log.md` (a crear durante Phase 6).

---

## 13. Fase 7 — Build firmado y distribución

### 13.1 Objetivo

Generar APK y AAB firmados para distribución.

### 13.2 Tareas

#### 13.2.1 Generar keystore de release

```bash
keytool -genkey -v -keystore tubus-release.jks -keyalg RSA \
  -keysize 2048 -validity 10000 -alias tubus
```

**Guardar contraseñas en gestor seguro. NO commitear el keystore.**

#### 13.2.2 Configurar `android/app/build.gradle`

```groovy
android {
  signingConfigs {
    release {
      storeFile file("../keystore/tubus-release.jks")
      storePassword System.getenv("KEYSTORE_PASSWORD")
      keyAlias "tubus"
      keyPassword System.getenv("KEY_PASSWORD")
    }
  }
  buildTypes {
    release {
      signingConfig signingConfigs.release
      minifyEnabled true
      proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
  }
}
```

#### 13.2.3 Obtener SHA-256 del keystore de release

```bash
keytool -list -v -keystore tubus-release.jks -alias tubus
```

Registrar:
- En `assetlinks.json` servido desde `https://tubusexpress.com/.well-known/assetlinks.json`.
- En Firebase Console (proyecto `tubusexpress` → Project Settings → Add fingerprint).
- En Google Cloud Console OAuth Android client ID.

#### 13.2.4 Generar AAB

```bash
cd android
./gradlew bundleRelease
# Salida: android/app/build/outputs/bundle/release/app-release.aab
```

#### 13.2.5 Generar APK (para sideloading)

```bash
./gradlew assembleRelease
# Salida: android/app/build/outputs/apk/release/app-release.apk
```

#### 13.2.6 Validación pre-publicación

- [ ] APK instala en dispositivo limpio.
- [ ] Tras instalación: deep links funcionan (assetlinks.json verificado).
- [ ] Login Google funciona (SHA-256 release coincide con Firebase).
- [ ] Push notifications funcionan en build release.

#### 13.2.7 Subida a Google Play Console

1. Crear app en Play Console.
2. Completar listing: título, descripción corta y larga (en español), screenshots (5+), feature graphic 1024x500, política de privacidad URL.
3. Configurar contenido: rating IARC, target audience, ads, data safety.
4. Subir AAB en internal testing.
5. Una vez validado, promover a closed testing → open testing → production.

### 13.3 Definition of Done

- [ ] AAB firmado generado.
- [ ] APK firmado generado y testado.
- [ ] App publicada en internal testing de Play Console.
- [ ] Track invitation enviado a 5+ testers internos.
- [ ] Documentación de release en `07-release-notes.md`.

### 13.4 Riesgos

| Riesgo | Mitigación |
|---|---|
| Pérdida del keystore = imposibilidad de actualizar la app | Backup cifrado + Play App Signing (Google guarda copia) |
| ProGuard rompe código por minificación agresiva | Tener `proguard-rules.pro` con keep para Capacitor + Firebase |
| Play Console rechaza por política | Revisar checklist Play Policy antes de subir |

---

## 14. Esquema de versionado web ↔ app

### 14.1 Versiones independientes

| Componente | Esquema | Ejemplo |
|---|---|---|
| Web | SemVer + commit hash | `2.4.3+a1b2c3` |
| Backend | SemVer | `1.8.0` |
| App Android | SemVer + versionCode incremental | `1.0.0 (versionCode 1)` |

### 14.2 Compatibilidad API

- El backend mantiene **N-1 compatibilidad** con la app: si backend está en v1.8, debe seguir respondiendo a contratos de v1.7.
- Si se introduce un breaking change en backend, **se versiona la ruta** (`/api/v2/...`) y se mantiene `/api/v1/...` durante al menos 6 meses (para dar tiempo a usuarios a actualizar la app).
- Cliente añade header `X-Client-Version` y `X-Client-Platform` (`web` | `android` | `ios`) para que backend pueda log y rate-limit.

### 14.3 Forced updates

- App Android consulta endpoint `/api/app/version-check?platform=android&version=1.0.0` al boot.
- Respuesta:
  ```json
  {
    "minSupported": "1.0.0",
    "latest": "1.2.0",
    "forceUpdate": false,
    "playStoreUrl": "https://play.google.com/store/apps/details?id=com.tubusexpress.app"
  }
  ```
- Si `forceUpdate: true` → app muestra modal bloqueante "Actualiza para continuar" con botón a Play Store.

### 14.4 Política de soporte

| Versión app | Soporte |
|---|---|
| Última | Full |
| Última -1 (3 meses) | Full |
| Última -2 (6 meses) | Solo seguridad |
| Última -3+ | Forzar actualización |

---

## 15. Live Updates (decisión diferida)

### 15.1 Qué son

Servicios que permiten empujar bundle JS/HTML/CSS a apps instaladas sin pasar por revisión de Play/App Store. La app descarga el nuevo bundle y lo aplica al siguiente arranque.

### 15.2 Opciones evaluadas

| Servicio | Pricing | Pros | Contras |
|---|---|---|---|
| Capgo | Self-hosted gratis o cloud desde $12/mes | Open source, dev friendly | Requiere setup |
| Capacitor Live Updates (Ionic Appflow) | Desde $499/mes | Soporte enterprise | Caro |
| Self-rolled (S3 + plugin propio) | Costo S3 ~ $0 | Control total | Mantenimiento |

### 15.3 Recomendación para ahora

**Diferir.** Lanzar la primera versión sin live updates. Después de 1-2 meses, evaluar si la frecuencia de patches lo justifica. Si sí → Capgo self-hosted.

### 15.4 Implicaciones técnicas si se adopta

- No tocar plugins nativos vía live updates.
- Versionar live updates en sintonía con la app store version (no debe romper compat con plugin nativo).
- A/B testing de bundles → posible.

---

## 16. Riesgos y mitigaciones

### 16.1 Tabla consolidada

| # | Riesgo | Probabilidad | Impacto | Fase | Mitigación |
|---|---|---|---|---|---|
| R1 | Web se rompe por refactor de auth async | Media | Alto | 4 | Tests e2e web antes y después; smoke test obligatorio |
| R2 | OAuth Google nativo no valida `idToken` | Media | Alto | 2 | Aceptar ambos client IDs (Android + Web) en `audience` |
| R3 | Deep links no abren la app | Media | Medio | 4 | Validar `assetlinks.json` con verifier de Google |
| R4 | FCM no entrega push en background | Media | Alto | 4 | Probar en app force-stopped; usar `priority: high` |
| R5 | Pérdida de keystore | Baja | Crítico | 7 | Backup cifrado + Play App Signing |
| R6 | Bundle excede 100 MB | Baja | Medio | 1 | Auditar `dist/` size; lazy chunks ya están |
| R7 | Gradle compila lento (>5 min) | Alta | Bajo | 0 | Gradle daemon + caching |
| R8 | Pérdida de tokens al evict de localStorage | Baja | Bajo | 4 | Migrar a Preferences |
| R9 | Cookies de sesión Express conflictúan en WebView | Baja | Medio | 8 | El nuevo flujo OAuth nativo no usa cookies — bypass total |
| R10 | Plugin biometric incompatible con Samsung Knox | Media | Bajo | 5 | Fallback a password si plugin reporta `NOT_AVAILABLE` |
| R11 | Reverse geocoding API costo | Baja | Bajo | 5 | Empezar con bounding boxes propias |
| R12 | Play Console rechaza por contenido | Baja | Medio | 7 | Pre-validar con checklist Play Policy |
| R13 | Race condition: deep link llega antes de Angular ready | Media | Medio | 4 | Encolar URL hasta que `router` resuelva |
| R14 | Push token cambia y backend tiene tokens stale | Alta | Bajo | 4 | Cron weekly cleanup ya existe (`cleanup-stale-device-tokens.cron`) |
| R15 | App no actualiza tras live update por cache de WebView | Media | Bajo | 15 | Versionar bundle name |
| R16 | **Bugs solo aparecen en Android 15+ (targetSdk≥35 fuerza edge-to-edge)** | Alta | Alto | 6 | **Lección aprendida en Phase 6.5**: Tier A del matrix QA DEBE incluir un Android 15+. El POCO (Android 13) NO detecta el bug. Mitigación permanente: `env(safe-area-inset-*)` aplicado en TODOS los `position: fixed` / overlays / modales del proyecto. |
| R17 | Media queries mobile sobrescriben fixes globales de safe-area | Media | Medio | 6 | **Lección Phase 6.5**: al hacer un fix de CSS layout, buscar también todos los `@media (max-width: ...)` que toquen ese selector. Ejemplo: `_responsive.scss` anulaba un fix en `_modal-payment.scss`. |
| R18 | Plugins Capacitor mantienen estado nativo independiente del frontend | Media | Medio | 4 | **Lección Phase 6.5**: cuando un plugin expone `signIn()/signOut()`, AMBOS deben usarse en el ciclo de vida (logout debe llamar el `signOut()` del plugin, no solo limpiar el JWT del backend). |
| R19 | **Android WebView NO propaga `WindowInsets` al motor CSS por defecto** | Crítica (recurrente) | Crítico | 6 / 7 | **Lección Phase 6.6**: `env(safe-area-inset-*)` retorna `0px` en todas las versiones Android — iOS WKWebView sí lo propaga, lo que crea la falsa impresión de que CSS basta. Solución: bridge nativo en `MainActivity.java` que captura `WindowInsets` y los inyecta como CSS vars. Sin este bridge, NINGÚN fix CSS funciona uniformemente. |
| R20 | "Funciona en algunos dispositivos pero no en otros" como red flag | Alta | Alto | 6 / 7 | **Lección Phase 6.6**: este síntoma significa que el bug NO está en la capa visible (CSS, lógica frontend) — está en una capa más baja (WebView config, runtime nativo, plugin behavior). Nunca aceptar "funciona a veces" como solución estable. |

### 16.2 Plan de rollback

Si Phase 4 introduce regresión web grave:

1. Revertir merge de Phase 4 en `main` → web restaurada.
2. Capacitor sigue compilando con la branch original; el deploy web no se afecta.
3. Auditar qué change rompió, fix en branch nueva, re-merge.

---

## 17. Estimación de esfuerzo

### 17.1 Por fase

| Fase | Esfuerzo (días hombre) | Bloqueante |
|---|---|---|
| 0 — Pre-requisitos | 1 | No |
| 1 — Bootstrap | 0.5 | Phase 0 |
| 2 — Backend | 1 | Phase 0 |
| 3 — Capa plataforma | 1 | Phase 1 |
| 4 — Migraciones | 5-7 | Phase 2 + 3 |
| 5 — Features extra | 3-4 | Phase 4 |
| 6 — QA | 2-3 | Phase 4 + 5 |
| 7 — Build firmado | 1 | Phase 6 |
| **TOTAL** | **14-18 días** | |

### 17.2 Asunciones

- Un solo desarrollador full-time.
- Sin imprevistos mayores.
- Acceso a dispositivos físicos para testing.
- Cuentas Google Play, Firebase, Google Cloud ya creadas.

### 17.3 Buffer

Agregar **30% buffer** para imprevistos → **18-23 días reales**. Comunicar plazo de **4 semanas** al stakeholder.

---

## 18. Bitácora de progreso

> Esta sección se va llenando conforme se ejecutan las fases. Cada sub-task completada se marca con [x] y se referencia el commit/PR.

### 18.1 Phase 0 — Pre-requisitos

- [ ] 0.1 JDK 17 instalado
- [ ] 0.2 `JAVA_HOME` seteado
- [ ] 0.3 Android Studio instalado
- [ ] 0.4 Android SDK 34 instalado
- [ ] 0.5 `ANDROID_SDK_ROOT` seteado
- [ ] 0.6 Licencias aceptadas
- [ ] 0.7 AVD creado
- [ ] 0.8 Dispositivo físico listo
- [ ] 0.9 USB debugging activo
- [ ] 0.10 Firebase Console accesible
- [ ] 0.11 App Android registrada en Firebase
- [ ] 0.12 SHA-1 debug registrado
- [ ] 0.13 OAuth Client ID Android creado
- [ ] 0.14 OAuth Client ID Web creado/verificado

### 18.2 Phase 1 — Bootstrap

- [ ] 1.1 Dependencias instaladas (`@capacitor/core`, `cli`, `android`, `app`)
- [ ] 1.2 `npx cap init` ejecutado
- [ ] 1.3 `capacitor.config.ts` configurado
- [ ] 1.4 `npx cap add android` ejecutado
- [ ] 1.5 App abre en dispositivo físico
- [ ] 1.6 Scripts npm añadidos
- [ ] 1.7 `.gitignore` actualizado

### 18.3 Phase 2 — Backend

- [ ] 2.1 `CORS_ORIGINS` actualizado en Railway
- [ ] 2.2 `google-auth-library` instalada
- [ ] 2.3 `userService.findOrCreateFromGoogleProfile` extraído
- [ ] 2.4 `authController.googleNative` creado
- [ ] 2.5 Ruta `POST /api/auth/google/native` añadida
- [ ] 2.6 Env vars `GOOGLE_CLIENT_ID_ANDROID` y `_WEB` configuradas
- [ ] 2.7 Tests unitarios pasan
- [ ] 2.8 Backend deployado a Railway
- [ ] 2.9 Web sigue logueando con Google (verificado)

### 18.4 Phase 3 — Capa plataforma

- [ ] 3.1 `@platform/*` path alias añadido
- [ ] 3.2 `PlatformService` creado
- [ ] 3.3 `StorageService` (interface + 2 strategies) creado
- [ ] 3.4 `GoogleAuthService` (interface + 2 strategies) creado
- [ ] 3.5 `MessagingService` (interface + 2 strategies) creado
- [ ] 3.6 `ExternalLinkService` (interface + 2 strategies) creado
- [ ] 3.7 `CameraService` (interface + 2 strategies) creado
- [ ] 3.8 `BiometricService` creado (no-op web)
- [ ] 3.9 `GeolocationService` (interface + 2 strategies) creado
- [ ] 3.10 `DeepLinksService` creado (no-op web)
- [ ] 3.11 `BackButtonService` creado (no-op web)
- [ ] 3.12 Factories registrados en `app.config.ts`
- [ ] 3.13 Web compila sin warnings, bundle no crece >30 kB
- [x] 3.14 `PrintService` (interface + 2 strategies) creado — añadido post-Phase 6.6, ver §18.11

### 18.5 Phase 4 — Migraciones críticas

- [ ] 4.1 CORS validado desde APK
- [ ] 4.2 Storage migrado (auth tokens en Preferences en nativo)
- [ ] 4.3 OAuth Google nativo conectado
- [ ] 4.4 Deep links configurados (`assetlinks.json`, intent-filter, listener)
- [ ] 4.5 FCM nativo migrado
- [ ] 4.6 Hardware back button conectado
- [ ] 4.7 External links migrados (WhatsApp, tel, redes)
- [ ] 4.8 Permisos cámara/storage en `AndroidManifest.xml`
- [ ] 4.9 Splash, status bar, iconos generados

### 18.6 Phase 5 — Features extra

- [ ] 5.1 Cámara nativa integrada en 10 puntos de upload
- [ ] 5.2 Biometría implementada (enroll, authenticate, unenroll)
- [ ] 5.3 Geolocalización integrada en zoning modal
- [ ] 5.4 Endpoint `GET /api/cities/by-coordinates` creado
- [ ] 5.5 Web no muestra UI biométrica (verificado)

### 18.7 Phase 6 — QA

- [ ] 6.1 Tier A device tested (todos los casos)
- [ ] 6.2 Tier B device tested
- [ ] 6.3 Tier C device tested
- [ ] 6.4 Web smoke test (sin regresión)
- [ ] 6.5 Bugs documentados en `06-qa-bugs-log.md`
- [ ] 6.6 Bugs críticos resueltos

### 18.8 Phase 6.5 — Fixes post-QA (descubierta tras distribución a otros dispositivos)

> Phase intermedia no prevista en el plan original. Surgió cuando el owner distribuyó la APK a un segundo dispositivo Android 15+ y aparecieron bugs latentes que el POCO X4 Pro 5G (Android 13) no había capturado.

- [x] 6.5.1 Familia A — 6 bugs de edge-to-edge resueltos (status bar, gesture bar, scroll-to-top, headers/footers en overlays, 23 archivos del barrido sistemático)
- [x] 6.5.2 Familia B — 3 bugs del auth Google nativo (toast errors, bidirectional linking, signOut post-logout)
- [x] 6.5.3 Familia C — 2 mejoras admin (theme agnóstico al cliente, logo PNG visible en dark)
- [x] 6.5.4 Feature nuevo — `POST /api/auth/link-google-with-password` + modal `link-google-password-modal`
- [x] 6.5.5 5 decisiones formales registradas en `05-decisions-log.md` (D1-D5)
- [x] 6.5.6 Backend deployado a Railway (branch `feat/capacitor-android`)
- [x] 6.5.7 APK debug reinstalada y validada por el owner
- [x] 6.5.8 Documento `13-phase-6.5-post-qa-fixes.md` creado

Detalle completo en [`13-phase-6.5-post-qa-fixes.md`](./13-phase-6.5-post-qa-fixes.md).

### 18.9 Phase 6.6 — Bridge nativo safe-area (hotfix raíz)

> Phase intermedia descubierta cuando Phase 6.5 no resolvió el bug en Samsung A56. La investigación profunda reveló que el WebView Android no propaga `WindowInsets` al CSS — el CSS solo no es suficiente, se necesita código nativo Java.

- [x] 6.6.1 Diagnóstico de causa raíz (WebView Android vs iOS WKWebView)
- [x] 6.6.2 `MainActivity.java` reescrito con bridge nativo (~135 líneas)
- [x] 6.6.3 Normalización masiva de 36 archivos: `env(safe-area-inset-*)` → `var(--safe-area-*)` (sed)
- [x] 6.6.4 Modal de zoning: grid de municipios siempre 2 columnas (eliminado `@media (max-width: 400px)`)
- [x] 6.6.5 Validación: build web OK + APK compila el Java nuevo + reinstalación validada por owner
- [x] 6.6.6 Decisión D6 registrada en `05-decisions-log.md`
- [x] 6.6.7 Documento `14-phase-6.6-native-insets-bridge.md` creado

Detalle completo en [`14-phase-6.6-native-insets-bridge.md`](./14-phase-6.6-native-insets-bridge.md).

### 18.11 Ajustes UX post-Phase 6.6 (housekeeping continuo)

> Ajustes de UX descubiertos durante la fase de pulido visual posterior al cierre técnico de Phase 6.6, antes de iniciar Phase 7. No constituyen una phase nueva — son patches dirigidos a casos puntuales reportados por el owner al recorrer la APK.

- [x] 18.11.1 Long-press en botones deja la card "desaparecida" en dark mode (Android WebView text-selection + tap-highlight) → fix global en `styles.scss` con `user-select: none`, `-webkit-touch-callout: none`, `-webkit-tap-highlight-color: transparent` para todos los `<button>`.
- [x] 18.11.2 Focus ring rojo en botones (paleta `primary` legacy en Tailwind) → migrada a azul TuBus en `tailwind.config.js` + reemplazado `ring-primary-500` por `var(--accent-primary)` en `styles.scss`.
- [x] 18.11.3 Header truncado en cards del catálogo (mobile) → header del product-card pasa a `flex-col` en `< 640px`, deshabilitando truncate.
- [x] 18.11.4 Plate fantasma en vehicle-select-card cuando `placa` está vacía → `@if (vehicle.placa)` envolviendo el span; mismo fix duplicado en `checkout-oil-change-form` y `checkout-in-store-oil-change-form`.
- [x] 18.11.5 Badge "Misma dirección de envío" desbordaba en checkout-confirmation mobile → `.detail-section-header` con `flex-wrap: wrap` + `sm:ml-auto` en el badge.
- [x] 18.11.6 Popover de notificaciones sin loading state → nueva signal `isLoadingRecent` en `AdminNotificationsService` y `UserNotificationService` + spinner inline en ambos popovers (admin + cliente).
- [x] 18.11.7 Badge "COMBO" tapando nombre del producto en order-detail cliente → movido a cinta diagonal en esquina superior derecha de la imagen (`.combo-ribbon` + `.product-img-wrap` con clipping).
- [x] 18.11.8 Ojito de "Datos del Pago" inútil para tarjeta/efectivo → nuevo método `hasExpandablePaymentDetails(order)` oculta el toggle cuando no hay `referenceNumber`/`sourceBank`/`senderName`/`paymentDate`.
- [x] 18.11.9 Picker indicator nativo de `<input type="time/date">` pegado al borde derecho en Android WebView → fix global en `styles.scss` con `padding-right` + `margin-left/right` en `::-webkit-calendar-picker-indicator`.
- [x] 18.11.10 Notas de aprobación/reprogramación invisibles para el admin → sub-bloque "Historial de notas" dentro de "Información General" (`noteHistory` computed en `admin-order-detail.component.ts`). Cliente sigue viendo solo la nota más reciente. Backend ya acumulaba — solo era bug de visualización en admin.
- [x] 18.11.11 Botón "Imprimir" no funcionaba en APK (`window.print()` es no-op en Android WebView) → nueva capability `@platform/print/` con `WebPrintStrategy` (window.print) y `NativePrintStrategy` (`@bcyesil/capacitor-plugin-printer@0.0.6`). Plugin sincronizado en `android/` — 11 plugins Capacitor en total.
- [x] 18.11.12 **Notificaciones push: tap no abría el modal de mensajería ni navegaba al detalle correcto.** Cadena completa:
  - **Backend** (`backend/src/shared/services/push/payload-builder.ts`): URL deep-link específica por tipo. Cliente ahora aterriza en `/perfil/pedidos/:id?notif=<id>` (+ `&openMessages=1` cuando `type === 'order_comment'`). Admin suma `?notif=<id>` y `&openMessages=1` para el mismo tipo. Helper `composeDeepUrl(basePath, notificationId, type)` centraliza el query-param building.
  - **Frontend `FirebaseMessagingService`**: nuevo `ReplaySubject(1)` `tapSubject` + observable `notificationTap$` separado de `pushSubject` (push entrante). SW message listener discrimina `'fcm-push'` vs `'fcm-notification-click'`. Plugin nativo listener separa `notificationReceived` (foreground) vs `notificationActionPerformed` (tap → tap stream).
  - **Frontend `NotificationRouterService` (nuevo, `core/services/notification-router.service.ts`)**: se suscribe a `notificationTap$`, lee `data.url` y navega con el Router de Angular dentro del Angular zone. Inicializado vía `APP_INITIALIZER` (`initializeNotificationRouter`).
  - **Componentes cliente + admin order-detail**: lectura de `route.queryParamMap` → si llega `notif`, marca la notificación como leída silenciosamente; si llega `openMessages=1`, cliente abre el `<app-order-messaging-modal>` mediante `pendingOpenMessages` + `tryOpenPendingMessaging()` (espera a que cargue la orden), admin hace scroll suave al `<app-order-comments>` mediante `pendingScrollToMessages` + `tryScrollToMessages()`.
- [x] 18.11.13 **Tap notificación nativa en cold-start no disparaba el handler aunque el plugin retenía el evento.** Verificado en el código Java del plugin (`@capacitor-firebase/messaging`): `notifyListeners(NOTIFICATION_ACTION_PERFORMED_EVENT, result, true)` usa `retainUntilConsumed = true`, lo que significa que el plugin guarda el evento hasta que un listener JS se attach. Pero `attachNativeListeners()` solo se llamaba desde `requestToken()` que en cold-start nativo NUNCA corría (early-return en el `effect`). Fix: `attachNativeListeners()` ahora público + invocado desde `NotificationRouterService.start()` antes de la suscripción + logs `[FCM-Native]` / `[NotificationRouter]` para diagnóstico.
- [x] 18.11.14 **Tarjeta "Mecánico Asignado" se mueve al tope cuando el servicio está activo + badge dinámico por estado del assignment.** En `order-detail.component.ts` cliente:
  - Nuevo `assignmentStatusBadge(order)` que mapea `AssignmentStatus` → `{ label, colorClass }` (scheduled → "Mecánico Asignado" azul, en_camino → "En Camino" índigo, in_progress → "En Servicio" morado, completed → "Servicio Completo" esmeralda, paused/cancelled/expired también cubiertos).
  - Nuevo computed `mechanicCardOnTop` (true cuando hay mecánico Y status orden no es `completed` ni `cancelled`).
  - HTML: card extraída a `<ng-template #mechanicCardTpl>` reutilizable, renderizada con `*ngTemplateOutlet` en dos posiciones mutuamente excluyentes — arriba del `.detail-grid` ocupando ancho completo cuando se promueve, o en su posición original (sección 7 columna derecha) cuando no.
  - Badge ya no usa `getStatusLabel(o.status)` (estado de la ORDEN) sino `assignmentStatusBadge(o)` (estado del SERVICIO).
- [x] 18.11.15 **Botón "¿Recibir notificaciones?" no se ocultaba en cold-start nativo aunque el SO ya tenía granted.** Tres causas combinadas:
  - `_permissionState` se inicializaba siempre en `'default'` en nativo.
  - `readPermission()` infería granted solo si había token cacheado, pero el token NO se rehidrataba al boot (early-return deliberado en el effect).
  - `syncPermissionState()` era síncrono y solo leía `Notification.permission` (no existe en WebView).
  - Fix: `syncPermissionState()` ahora `async` y en nativo invoca `FirebaseMessaging.checkPermissions()` (la única fuente de verdad del SO). Effect ya no hace early-return nativo — llama nuevo `syncAndRehydrateNative()` que consulta el SO y, si granted, rehidrata token silenciosamente. Nuevo `APP_INITIALIZER` `initializeNotificationPermissionSync` dispara el sync al boot.
  - `PushUnblockModal`: instrucciones específicas por plataforma — Android ("Ajustes → Aplicaciones → TuBus Express → Notificaciones → Activar"), iOS ("Ajustes → Notificaciones → TuBus Express → Permitir notificaciones") y Web (instrucciones del candado del navegador, como ya existían).
  - `UserMenuComponent.activatePushNotifications()` en nativo: sync primero → si `'denied'` abre el modal en lugar de llamar `requestPermissions()` que Android 13+ rechaza silenciosamente.

### 18.12 Phase B Windows Track — iOS preparation sin Mac

> Phase intermedia ejecutada en Windows, sin necesidad de Mac ni cuenta Apple Developer activa. Resuelve ~70 % del trabajo iOS y deja el resto preparado para el día del Mac (handoff checklist `17-mac-handoff-checklist.md`).
> Plan detallado: [`16-phase-B-windows-track.md`](./16-phase-B-windows-track.md).

- [x] F1 — Setup + Decisiones D7-D14 (Apple Sign-In obligatorio, orden iOS HIG, App Store + TestFlight, Mac flexible, iOS 14, SemVer sincronizado, modal Apple separado, plan upfront + bitácora al cierre). Branch `feat/capacitor-ios` confirmada en ambos repos. Baselines anotadas.
- [x] F2 — Backend Apple Sign-In end-to-end (apple-signin-auth + AppleProfilePayload + findOrCreateFromAppleProfile + linkAppleToLocalAccount + verifyAppleIdToken con audience+issuer mandatory + POST /api/auth/apple/native + POST /api/auth/link-apple-with-password + 10 tests unitarios + deploy Railway producción sin regresión sobre los 36 tests pre-existentes).
- [x] F3 — Frontend platform layer + UI (`@platform/apple-auth` strategy + factory provider gateado por `isIos()` + AuthService Apple methods + signOutAppleSilent en logout + auth-modal con botón Apple gateado en orden iOS HIG + `link-apple-password-modal` calcado del Google modal con códigos Apple-specific + APK Android rebuilt y validada por owner en múltiples dispositivos sin regresión).
- [x] F4 — Estáticos iOS desde Windows (Assets iOS pre-generados a `resources/ios-staging/` + AASA file con TEAMID placeholder + nginx location block para AASA con `application/json` + Info.plist Usage Descriptions en español + App Store listing completo + Privacy Nutrition matrix).
- [x] F5 — Consolidación, docs y handoff (master plan actualizado, `17-mac-handoff-checklist.md` generado, texto de actualización política de privacidad preparado, bitácora final en `16-phase-B-windows-track.md`).

**Pendiente exclusivo del día del Mac** (~1 día siguiendo `17-mac-handoff-checklist.md`):

- Apple Developer Program payment + Team ID + APNs key + GoogleService-Info.plist iOS + Service ID Sign in with Apple.
- `npx cap add ios` + copiar assets `ios-staging/` al `Assets.xcassets/` real.
- Pegar `Info.plist` Usage Descriptions + `CFBundleURLTypes` con REVERSED_CLIENT_ID.
- Xcode → Signing & Capabilities → Team + Push Notifications + Sign in with Apple + Associated Domains (`applinks:tubusexpress.com`).
- `pod install` + Run en iPhone físico.
- QA matrix Apple Sign-In (login local + Google + Apple) + Universal Links + Push iOS.
- Archive → TestFlight upload → App Store Connect listing (copy ya preparado en `app-store-listing.md`).

### 18.10 Phase 7 — Release

- [ ] 7.1 Keystore de release generado y backed up
- [ ] 7.2 `build.gradle` configurado para signing
- [ ] 7.3 SHA-256 release registrado en Firebase, Google Cloud, assetlinks
- [ ] 7.4 AAB generado
- [ ] 7.5 APK generado
- [ ] 7.6 APK validado en dispositivo limpio
- [ ] 7.7 Listing en Play Console completado
- [ ] 7.8 Internal testing track activo
- [ ] 7.9 Release notes documentadas
- [ ] 7.10 QA Tier A (Pixel/Samsung Android 15+) — valida 15 AC nuevos de Phase 6.5
- [ ] 7.11 QA Tier B (POCO Android 13, Samsung A56 Android 14) — valida 8 AC nuevos de Phase 6.6 (B4.AC16-23)
- [ ] 7.12 QA Tier C (Android 7-9 si está disponible) — valida que el bridge nativo funciona en API 24+

---

## 19. Glosario

| Término | Definición |
|---|---|
| **AAB** | Android App Bundle — formato de distribución para Play Store, optimiza per-device delivery |
| **APK** | Android Package — instalable directo, también para sideloading |
| **App Links** | Deep links verificados en Android (assetlinks.json) |
| **AVD** | Android Virtual Device — emulador |
| **Bridge** | Capa de comunicación entre WebView y código nativo en Capacitor |
| **Capacitor** | Framework cross-platform que envuelve web apps en nativo |
| **Custom Tabs** | Pestaña Chrome embebida con UI personalizada (Android) |
| **FCM** | Firebase Cloud Messaging — sistema de push notifications |
| **Gradle** | Sistema de build de Android |
| **Intent Filter** | Declaración en AndroidManifest que indica qué URLs/acciones puede manejar la app |
| **Keystore** | Archivo cifrado con la clave privada para firmar APKs |
| **Plugin Capacitor** | Módulo que expone APIs nativas (cámara, GPS, etc.) al WebView |
| **Preferences** | Plugin de Capacitor para storage key-value seguro |
| **PWA** | Progressive Web App — la app actual ya es una |
| **SHA-1/SHA-256** | Fingerprint del keystore — Google lo usa para verificar la identidad de la app |
| **Universal Links** | Deep links verificados en iOS (similar a App Links) |
| **WebView** | Componente nativo que renderiza HTML/JS/CSS dentro de una app |

---

## Apéndice A — Archivos detallados (estado al cierre de Phase 6.5)

| Archivo | Estado |
|---|---|
| `06-phase-0-prerequisites.md` | ✅ Generado y ejecutado |
| `07-phase-1-bootstrap.md` | ✅ Generado y ejecutado |
| `08-phase-2-backend.md` | ✅ Generado y ejecutado |
| `09-phase-3-platform-layer.md` | ✅ Generado y ejecutado |
| `10-phase-4-migrations.md` | ✅ Generado y ejecutado |
| `11-phase-5-mobile-features.md` | ✅ Generado y ejecutado |
| `12-phase-6-qa.md` | ✅ Generado y ejecutado |
| `13-phase-6.5-post-qa-fixes.md` | ✅ Generado y ejecutado (NUEVO, no estaba previsto) |
| `14-phase-6.6-native-insets-bridge.md` | ✅ Generado y ejecutado (NUEVO, no estaba previsto — hotfix del bug raíz) |
| `15-phase-7-release.md` | ⏳ Por generar al autorizar Phase 7 |
| `versioning-and-compatibility.md` | ⏳ Por crear durante Phase 7 |
| `troubleshooting.md` | ⏳ Vivo, se llena con cada bug recurrente |

---

## Apéndice B — Decisiones (CERRADAS al 2026-05-15)

✅ **Las 12 decisiones quedaron resueltas.** Detalle completo y justificación de cada una en [`05-decisions-log.md`](./05-decisions-log.md). Resumen:

| # | Decisión | Valor adoptado |
|---|---|---|
| 1.1 | Package name | `com.tubusexpress.app` |
| 1.2 | Min SDK Android | API 23 |
| 1.3 | Esquema biometría | Flag local |
| 1.4 | Reverse geocoding | Bounding boxes propias |
| 1.5 | Forced updates desde v1 | Sí |
| 1.6 | Live updates | Diferidos a v2 |
| 1.7 | Play App Signing | Activar |
| 1.8 | Distribución | Play Store + APK directo |
| 1.9 | Crashlytics | Activar v1 |
| 1.10 | Analytics | Firebase Analytics |
| 1.11 | Plugin Google Auth | `@capacitor-firebase/authentication` |
| 1.12 | Plugin FCM | `@capacitor-firebase/messaging` |

### Items aún pendientes para iniciar Phase 0

- ⏳ Acceso a Firebase Console
- ⏳ Acceso a Google Cloud Console
- ⏳ Acceso a Railway
- ⏳ Confirmación de dispositivo Android físico para QA
- ⏳ Autorización formal del owner para iniciar Phase 0

---

> **Estado del documento:** este es el plan maestro. Las decisiones arquitecturales están cerradas. Pendiente: accesos + dispositivo + autorización para iniciar Phase 0.
