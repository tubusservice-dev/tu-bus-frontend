# 05 — Bitácora de Decisiones Formales

> **Status:** Live — se actualiza con cada decisión arquitectural durante el proyecto
> **Purpose:** registro autoritativo de las decisiones tomadas y por qué. Lo que aquí está marcado como ✅ DECIDIDO es de cumplimiento obligatorio durante la implementación; cualquier desvío requiere una nueva entrada en este log con la justificación.
> **Audiencia:** desarrollador implementando, reviewer de PR, futuros mantenedores que necesiten entender por qué se eligió X y no Y.

---

## Convenciones

- ✅ **DECIDIDO** — decisión cerrada, no se reabre sin nueva entrada en el log.
- ⏳ **PENDIENTE** — decisión necesaria pero aún no tomada.
- 🔄 **REVISADO** — decisión modificada respecto a una versión anterior; lleva fecha y razón.
- 👤 **Approver** — quién autorizó la decisión.
- 📅 **Fecha** — cuándo se tomó.

---

## Decisiones Iniciales (Pre-Phase 0)

Las 12 decisiones del documento `04-user-requirements.md` fueron resueltas en bloque por el owner. Resumen:

| # | Decisión | Valor adoptado | Estado | Fecha | Approver |
|---|---|---|---|---|---|
| 1.1 | Package name Android | `com.tubusexpress.app` | ✅ DECIDIDO | 2026-05-15 | Owner |
| 1.2 | Min SDK Android | API 23 (Android 6.0) | ✅ DECIDIDO | 2026-05-15 | Owner |
| 1.3 | Esquema biometría | Opción A — flag local | ✅ DECIDIDO | 2026-05-15 | Owner |
| 1.4 | Reverse geocoding | Opción B — bounding boxes propias | ✅ DECIDIDO | 2026-05-15 | Owner |
| 1.5 | Forced updates desde v1 | Sí | ✅ DECIDIDO | 2026-05-15 | Owner |
| 1.6 | Live updates | Diferir a v2 | ✅ DECIDIDO | 2026-05-15 | Owner |
| 1.7 | Play App Signing | Activar | ✅ DECIDIDO | 2026-05-15 | Owner |
| 1.8 | Distribución | Play Store + APK directo | ✅ DECIDIDO | 2026-05-15 | Owner |
| 1.9 | Crashlytics | Activar desde v1 | ✅ DECIDIDO | 2026-05-15 | Owner |
| 1.10 | Analytics | Firebase Analytics | ✅ DECIDIDO | 2026-05-15 | Owner |
| 1.11 | Plugin Google Auth | `@capacitor-firebase/authentication` | ✅ DECIDIDO | 2026-05-15 | Owner |
| 1.12 | Plugin FCM | `@capacitor-firebase/messaging` | ✅ DECIDIDO | 2026-05-15 | Owner |

---

## Detalle de cada decisión

### Decisión 1.1 — Package name: `com.tubusexpress.app`

**Implicaciones técnicas:**

- Identificador único en Google Play Store. **No se podrá cambiar nunca tras publicar la primera versión.** Cambiarlo significaría una app nueva con cero downloads/reviews acumulados.
- Usado en `capacitor.config.ts` como `appId`.
- Usado en `android/app/build.gradle` como `applicationId`.
- Usado en `AndroidManifest.xml` para todos los Intent Filters.
- Debe coincidir con el package registrado en Firebase Console (Android app entry).
- Debe coincidir con el package registrado en Google Cloud Console OAuth Android client ID.

**Acciones derivadas:**

- Phase 0.11: registrar app en Firebase con este package.
- Phase 0.13: crear OAuth Client ID Android con este package.
- Phase 1.2: ejecutar `npx cap init "TuBus Express" "com.tubusexpress.app"`.

---

### Decisión 1.2 — Min SDK Android: API 23 (Android 6.0)

**Implicaciones técnicas:**

- ~99% de dispositivos Android activos pueden instalar la app.
- Cubre el segmento venezolano que tiende a usar dispositivos antiguos.
- Algunos plugins requieren config adicional para API 23:
  - `@capgo/capacitor-native-biometric` usa `FingerprintManager` en API 23-27 y `BiometricPrompt` en API 28+. El plugin lo abstrae.
  - Permisos runtime (camera, storage, location) se piden con `requestPermissions()` — comportamiento estándar desde API 23.

**Acciones derivadas:**

- Phase 1.3: en `android/app/build.gradle` setear `minSdkVersion 23`.
- Phase 1.3: setear `targetSdkVersion 34` (último estable, requisito Play Store).

> **🔄 REVISADO (Phase 6.5/6.6, 2026-05-20/21):** los valores reales en `android/variables.gradle` quedaron en **`minSdkVersion 24`, `targetSdkVersion 36`, `compileSdkVersion 36`**. Razón: el *edge-to-edge enforcement* obligatorio de Android 15 (API 35+) requiere `targetSdk` ≥ 35 para no caer en modo de compatibilidad; se adoptó 36 (última API estable) y `minSdk` subió a 24 por requisitos de las dependencias androidx que arrastra Capacitor 8. Cobertura de dispositivos sigue ~95%. Esta entrada es la decisión formal que documenta el cambio (antes solo se infería de las bitácoras 6.5/6.6).

**Riesgo conocido:**

- API 23 no soporta algunas optimizaciones de batería modernas. Push notifications pueden ser deferidas en dispositivos viejos. Aceptable.

---

### Decisión 1.3 — Esquema biometría: Opción A — flag local

**Implicaciones técnicas:**

- Tras login exitoso, si el dispositivo soporta biometría, se ofrece al usuario activarla.
- Si activa: `BIOMETRIC_ENABLED=true` en `Preferences`. El JWT permanece en `Preferences` cifrado.
- Al reabrir la app: si `BIOMETRIC_ENABLED=true` y JWT presente → pedir biometría; si OK → cargar JWT y proceder.
- Si falla biometría 3 veces → fallback a login manual.
- **NO se hace round trip al backend.** El JWT cacheado se reutiliza tal cual.

**Trade-off aceptado:**

- Si un atacante obtiene el dispositivo desbloqueado con biometría desactivada para apps específicas, puede acceder a la app TuBus.
- En la práctica esto requeriría: dispositivo robado + bloqueo de pantalla del SO derrotado + biometría de TuBus desactivada por el usuario. Cadena improbable para nuestro modelo de amenazas.

**Acciones derivadas:**

- Phase 5.2: implementar `BiometricService` con `enroll()` / `authenticate()` / `unenroll()` / `isEnrolled()`.
- Phase 5.2: añadir modal post-login "¿Activar inicio rápido con huella?".
- Phase 5.2: añadir splash de re-autenticación al reabrir la app si está enrolado.

**Migración futura (v2):**

- Si en v2 queremos endurecer, añadir endpoint `POST /api/auth/refresh-with-biometric` que requiera un `biometric_credential_token` opaco emitido al enrolar. **Esto se documenta como deuda técnica** pero no entra en v1.

---

### Decisión 1.4 — Reverse geocoding: Opción B — bounding boxes propias

**Implicaciones técnicas:**

- Endpoint nuevo: `GET /api/cities/by-coordinates?lat=...&lng=...` resuelve a `{ citySlug, municipalitySlug }` consultando una tabla precomputada de bounding boxes por municipio en Venezuela.
- Si el punto no cae en ningún bounding box → devuelve `null` y el frontend pide selección manual.
- Costo operativo: $0.
- Precisión esperada: alta para grandes ciudades (Caracas, Maracaibo, Valencia, Maracay, Barquisimeto, Mérida...). Baja en zonas rurales (no relevante para TuBus).

**Datos requeridos:**

- Lista de municipios cubiertos hoy en `City` collection del backend.
- Para cada municipio: bounding box (`{ minLat, maxLat, minLng, maxLng }`).
- Fuente: OpenStreetMap polígonos administrativos de Venezuela (descarga única) + script para extraer bounding boxes y poblar la collection.

**Acciones derivadas:**

- Phase 5.3: crear script `backend/src/scripts/seed-municipality-bboxes.ts` que pobla el campo `bbox` en cada documento `City`.
- Phase 5.3: implementar endpoint en `cities.controller.ts`.
- Phase 5.3: el `GeolocationService` frontend llama el endpoint y pre-selecciona en el zoning modal.

**Migración futura:**

- Si la precisión no satisface, migrar a Google Maps Geocoding (~$5/mes).

---

### Decisión 1.5 — Forced updates desde v1: Sí

**Implicaciones técnicas:**

- Endpoint nuevo: `GET /api/app/version-check?platform=android&version=1.0.0` devuelve `{ minSupported, latest, forceUpdate, playStoreUrl, apkDirectUrl }`.
- Frontend nativo invoca al boot. Si `forceUpdate: true` → modal bloqueante con CTA "Actualizar ahora" → abre Play Store.
- Permite hacer breaking changes en backend con seguridad: bumpeas `minSupported` en backend y todas las apps anteriores reciben el modal.

**Acciones derivadas:**

- Phase 4.X: crear módulo nuevo backend `app-versioning` con env vars `APP_MIN_SUPPORTED_ANDROID`, `APP_LATEST_ANDROID`.
- Phase 4.X: frontend `VersionCheckService` consume al boot.
- Phase 4.X: modal `force-update-modal.component.ts`.

**Convención:**

- Bumpear `versionName` y `versionCode` en cada release de Play.
- `versionCode` es entero monotónicamente creciente (1, 2, 3...) — Play exige.
- `versionName` es SemVer human-readable ("1.0.0", "1.0.1", "1.1.0", "2.0.0").

---

### Decisión 1.6 — Live updates: Diferir a v2

**Implicaciones técnicas:**

- Cualquier patch al frontend requiere nuevo release de Play (1-3 días de revisión + adopción del usuario).
- Acotar el riesgo: solo lanzar a producción tras QA exhaustivo en internal testing.
- En el futuro, si queremos agilidad, evaluamos Capgo self-hosted ($0).

**Acciones derivadas:**

- Phase 7: documentar en release notes que NO hay live updates en v1.

**Convención:**

- Todo cambio frontend que requiera deploy implica: release de Play + tiempo de adopción. Plan en consecuencia.

---

### Decisión 1.7 — Play App Signing: Activar

**Implicaciones técnicas:**

- Generamos un **upload key** (un keystore que tú firmas localmente).
- Subimos a Play tu primera AAB firmada con upload key + activamos Play App Signing.
- Google genera y guarda el **app signing key** (el "real").
- En subsiguientes uploads: tú firmas con upload key, Google re-firma con app signing key antes de distribuir.
- Si pierdes el upload key, Google permite resetear (verificación humana).
- El app signing key NUNCA se pierde.

**Trade-offs:**

- Vendor lock-in con Google (no puedes migrar el binario firmado a otra store sin cambios).
- A cambio: imposible perder definitivamente la app.

**Acciones derivadas:**

- Phase 7.1: generar upload keystore.
- Phase 7.7: al subir primera AAB, activar Play App Signing en Play Console.
- Phase 7.3: el SHA-256 a registrar en Firebase y Google Cloud OAuth es el del **app signing key** (Google lo muestra en Play Console tras activación), NO el del upload key.

---

### Decisión 1.8 — Distribución: Play Store + APK directo

**Implicaciones técnicas:**

- **APK directo** servido desde `https://tubusexpress.com/download/tubus-express.apk` (lo añadimos al deploy frontend).
- **Play Store** como canal principal para usuarios estándar.

**Estrategia de rollout sugerida:**

1. Phase 7.4: generar AAB firmada → Play internal testing.
2. Phase 7.5: generar APK firmada → publicar en `tubusexpress.com/download` con instrucciones.
3. Tras QA validation con beta testers internos, promover Play a closed testing.
4. Tras feedback de closed testing, promover a production.

**Convención:**

- Las dos versiones (Play y APK directo) son **el mismo binario en versión**. NO se mantienen builds divergentes.
- El backend `version-check` no distingue entre canal — solo entre `latest` y `minSupported`.

**Acciones derivadas:**

- Phase 7.5: añadir página `/download` al frontend (estática) con link a la APK.
- Phase 7.7: configurar Play Console listing.

---

### Decisión 1.9 — Crashlytics: Activar desde v1

**Implicaciones técnicas:**

- Plugin: `@capacitor-firebase/crashlytics` (Robingenz).
- Crashes nativos (Android Java/Kotlin) y JS (capturados por `ErrorHandler` de Angular y reportados manualmente vía API del plugin) llegan a Firebase Console.
- $0 hasta volúmenes muy altos.

**Acciones derivadas:**

- Phase 4.X: instalar plugin, registrar en `Capacitor.config.ts`.
- Phase 4.X: extender `ChunkLoadErrorHandler` actual y otros catch globales para reportar a Crashlytics en nativo.
- Phase 7: validar que Crashlytics recibe un test crash antes del release.

**Política de privacidad:**

- Actualizar `https://tubusexpress.com/legal/privacidad` para mencionar Firebase Crashlytics como procesador de datos de error.

---

### Decisión 1.10 — Analytics: Firebase Analytics

**Implicaciones técnicas:**

- Plugin: `@capacitor-firebase/analytics`.
- Eventos custom: `login`, `logout`, `add_to_cart`, `purchase`, `view_product`, `search`, `filter_apply`, etc.
- Eventos automáticos: `first_open`, `session_start`, `screen_view`, `app_remove`.
- $0.

**Acciones derivadas:**

- Phase 4.X: instalar plugin, configurar.
- Phase 4.X: implementar `AnalyticsService` que abstrae los eventos. En web puede ser no-op o usar Firebase Web Analytics (si quieres metric parity).
- Phase 4.X: instrumentar los eventos clave en el flujo de checkout.

**Política de privacidad:**

- Actualizar `https://tubusexpress.com/legal/privacidad` para mencionar Firebase Analytics.
- Considerar opt-out toggle en perfil (no requerido por GDPR Venezuela pero buena práctica).

---

### Decisión 1.11 — Plugin Google Auth: `@capacitor-firebase/authentication`

**Justificación:**

- Mismo proveedor que el plugin de FCM (Robingenz) → APIs simétricas, documentación coherente.
- Si en futuro queremos Apple Sign-In, Microsoft, Facebook → mismo plugin lo soporta.
- Integrado con Firebase Auth → si en v3 queremos rotar a Firebase Auth como source of truth en lugar de JWT custom, el camino es directo.

**Acciones derivadas:**

- Phase 3.4: implementar `NativeGoogleAuthStrategy` con `FirebaseAuthentication.signInWithGoogle()`.
- Phase 4.3: conectar al endpoint `POST /api/auth/google/native`.

---

### Decisión 1.12 — Plugin FCM: `@capacitor-firebase/messaging`

**Justificación:**

- Coherente con la decisión 1.11 (mismo proveedor).
- API limpia: `requestPermissions`, `getToken`, `addListener('notificationReceived'|'notificationActionPerformed')`.
- Soporta foreground display config.

**Acciones derivadas:**

- Phase 3.5: implementar `NativeMessagingStrategy`.
- Phase 4.5: conectar al `DeviceTokenService` con `platform: 'android'`.

---

## Items aún PENDIENTES (bloquean Phase 0)

### ✅ Acceso a Firebase Console del proyecto `tubusexpress` — RESUELTO

**Estrategia adoptada:** owner ejecuta los pasos en consola siguiendo guía del desarrollador (no se otorga acceso directo).
**Status:** ✅ RESUELTO el 2026-05-15.

**Configuración completada:**
- App Android registrada con package `com.tubusexpress.app`.
- SHA-1 del debug keystore registrado: `D6:37:DC:C9:BC:5C:13:EB:4D:D8:E3:8D:2D:F8:5F:1E:78:E5:B5:89`.
- SHA-256 del debug keystore disponible: `F3:43:03:D5:57:86:1D:66:C7:C4:5D:47:8E:75:A0:7F:66:BF:B9:57:25:82:89:6E:1B:67:2F:84:90:FC:C0:88`.
- Authentication → Google Sign-In habilitado.
- Firebase auto-generó OAuth Client IDs en Google Cloud Console.
- `google-services.json` descargado y guardado en `C:\Users\luisv\tubus-credentials\google-services.json` (fuera del repo).

### ✅ Acceso a Google Cloud Console — RESUELTO

**Estrategia adoptada:** owner ejecuta verificaciones en consola. Se descubrió la coexistencia de dos proyectos Cloud (ver "Hallazgo Arquitectural — Dos Proyectos Google Cloud" abajo).

**Status:** ✅ RESUELTO el 2026-05-15.

**Verificaciones completadas en el proyecto `tubusexpress` (project number `1071922885496`):**

- OAuth Consent Screen → Estado de publicación = **"En producción"** ✅
- Tipo de usuario = **Externos** ✅
- OAuth Clients confirmados:
  - Android client for `com.tubusexpress.app` → `1071922885496-2knh1l8lkintplr4oc8j4iibla2v5j1d.apps.googleusercontent.com` ✅
  - Web client (auto created by Google Service) → `1071922885496-ggktf2e4q2a1kl7pjt866rqvm8ad0gft.apps.googleusercontent.com` ✅
- APIs habilitadas verificadas:
  - Identity Toolkit API ✅
  - Token Service API ✅
  - FCM Registration API ✅ (22 reqs, 0% errores)
  - Firebase Cloud Messaging API ✅ (habilitada — endpoint legacy con errores conocidos, no bloqueante; el plugin Capacitor usa V1 moderno vía FCM Registration API)
  - Firebase App Distribution API ✅ (bonus, útil para distribución interna en Phase 7)
  - Firebase Hosting API, Firebase Installations API, Firebase Management API, Firebase Remote Config API, Firebase Rules API ✅

### ✅ Acceso al dashboard de Railway — VERIFICADO

**Estrategia adoptada:** owner ejecuta los cambios en consola siguiendo guía cuando se requiera.
**Status:** ✅ VERIFICADO el 2026-05-15. Cambios reales se aplicarán en Phase 2.

**Servicio backend localizado:** `tu-bus-backend` (vinculado a GitHub).

**Inventario de env vars actuales (34 service variables):**

```
CLIENT_URL
CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_CLOUD_NAME, CLOUDINARY_URL
EMAIL_LOGO_URL, EMAIL_VERIFICATION_REQUIRED, EMAIL_VERIFICATION_TOKEN_TTL_MINUTES
FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_PROJECT_ID, FIREBASE_PUSH_ENABLED
GOOGLE_CALLBACK_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
JWT_EXPIRES_IN, JWT_SECRET
MAX_EMAILS_PER_DAY_GLOBAL, MAX_PASSWORD_RESET_RETRIES, MAX_VERIFICATION_RESEND_RETRIES
MONGODB_URI, NODE_ENV, PORT
PASSWORD_RESET_RETRIES_RESET_HOURS, PASSWORD_RESET_TOKEN_TTL_MINUTES
RESEND_API_KEY, RESEND_FROM_EMAIL
RESET_PASSWORD_URL, SESSION_SECRET, SUPPORT_EMAIL, TZ
VERIFICATION_RESEND_RETRIES_RESET_HOURS, VERIFY_EMAIL_URL
ZOMBIE_ACCOUNT_CLEANUP_AFTER_HOURS
```

**Variables NO presentes (usan defaults del código `backend/src/config/index.ts`):**

- `CORS_ORIGINS` → fallback a `CLIENT_URL` + localhost. Se añadirá en Phase 2.
- `VERIFY_ACCOUNT_LINK_URL` → fallback a `${clientUrl}/verify-account-link`. OK.
- `ACCOUNT_LINK_TOKEN_TTL_MINUTES` → fallback 60 min. OK.

**Variables a AÑADIR en Phase 2 (aditivas, no destructivas):**

| Variable nueva | Valor | Para qué |
|---|---|---|
| `CORS_ORIGINS` | `https://tubusexpress.com,https://www.tubusexpress.com,capacitor://localhost,http://localhost,https://localhost` | Permitir orígenes web + Capacitor |
| `GOOGLE_CLIENT_ID_ANDROID` | `1071922885496-2knh1l8lkintplr4oc8j4iibla2v5j1d.apps.googleusercontent.com` | Validar idToken Android nativo |
| `GOOGLE_CLIENT_ID_WEB_FIREBASE` | `1071922885496-ggktf2e4q2a1kl7pjt866rqvm8ad0gft.apps.googleusercontent.com` | Audience adicional Firebase tokens |
| `APP_MIN_SUPPORTED_ANDROID` | `1.0.0` | Forced updates (decisión 1.5) |
| `APP_LATEST_ANDROID` | `1.0.0` | Forced updates (decisión 1.5) |

**Convención sobre CORS_ORIGINS:** la presencia de esta variable hace que el backend USE su valor en lugar del fallback. Por tanto, hay que incluir TODOS los orígenes válidos (web + Capacitor) en su valor, no solo los nuevos.

**Variables a MODIFICAR:** ninguna. Cero variables existentes se renombran ni eliminan.

**Confirmado (2026-05-15):** `FIREBASE_PROJECT_ID = tubusexpress` (sin guiones) — coincide exactamente con el `project_id` del `google-services.json`. Backend ya apunta al proyecto Firebase correcto. Sin ajuste necesario.

### ✅ Dispositivo Android físico para QA — RESUELTO

**Status:** ✅ RESUELTO el 2026-05-15.

**Dispositivo confirmado:**

| Concepto | Valor |
|---|---|
| Marca / Modelo | POCO X4 Pro 5G (Xiaomi sub-brand) |
| Modelo interno | 2201116PG |
| Android version | **13** (API 33) |
| OS skin | HyperOS 1.0.12.0.TKCMIXM (sucesor de MIUI) |
| Procesador | Snapdragon 695 5G Octa-core 2.2GHz |
| RAM | 8 GB físicos + 4 GB virtuales |
| Storage libre | 203.9 GB |
| Security patch | 2024-12-01 |
| Conector | USB-C (cable se confirma en Phase 1 al primer adb connect) |
| Tier QA | **Tier B (medio)** — segmento más común en Venezuela |

**Capabilities confirmadas para features del proyecto:**

- ✅ Cámara 108MP triple → ideal para Phase 5 (cámara nativa, comprobantes de pago)
- ✅ Lector de huella en botón de encendido lateral → ideal para Phase 5 (biometría)
- ✅ GPS + 5G → ideal para Phase 5 (geolocalización)
- ✅ Sensor de proximidad, acelerómetro, giroscopio → estándar
- ✅ NFC → no requerido en v1 pero presente
- ✅ Hardware-backed keystore (Android 9+) → JWT en Preferences cifrado seguro

**Notas operativas para HyperOS / MIUI durante el desarrollo (no bloqueante, configurable cuando se requiera):**

1. **Autostart:** activar para `com.tubusexpress.app` en HyperOS settings → Apps → Permisos especiales → Autostart. Sin esto, los push con app cerrada se pueden perder.
2. **MIUI Optimization toggle:** desactivar en Developer Options para que el debugging USB y comportamiento de la app sea estándar Android.
3. **Install via USB:** activar en Developer Options junto con USB Debugging.
4. **Battery saver:** marcar la app como "Sin restricciones" en battery management para garantizar entrega de FCM en background.

### ✅ Autorización formal para iniciar Phase 0 — RESUELTO

**Necesario:** owner indica explícitamente "OK, empieza Phase 0" o equivalente.
**Status:** ✅ RESUELTO el 2026-05-15. El owner autorizó y se ejecutaron las Phases 0 → 6.6 (todas cerradas); Phase 7 está en Closed Testing en Google Play. Ver bitácoras `06`–`14` y `18`.

---

## 🗝️ Identificadores Capturados

> Todos los IDs capturados durante el setup. Esta tabla es source of truth para configuración del proyecto.

### Firebase / Google Cloud (Capturados 2026-05-15)

| Concepto | Valor |
|---|---|
| Firebase Project ID | `tubusexpress` |
| Firebase Project Number | `1071922885496` |
| Firebase Storage Bucket | `tubusexpress.firebasestorage.app` |
| Android Package Name | `com.tubusexpress.app` |
| Mobile SDK App ID (Android) | `1:1071922885496:android:6c3765956b221552930e8d` |
| Firebase Web SDK App ID | `1:1071922885496:web:d84becd2da3f1c21930e8d` |
| Firebase API Key (Android) | `AIzaSyBZnogAw3T2BNZZQTnDx3qRBMQNvl-2LJ8` |
| Firebase API Key (Web) | `AIzaSyAdJBdLYX4mNYToBOrL9A06UZ25dvTnsDM` |
| FCM Sender ID (messagingSenderId) | `1071922885496` |
| FCM VAPID Public Key (Web) | `BHfs0RFF_bqAjOu1qKSgTw5v38-9X9w4BS87vedogb4Uw5-UsIgMJEfM-_J7gVbChZ1bhr4zKPNNYhYYs5TTq0Q` |

### OAuth 2.0 Client IDs (auto-creados por Firebase)

| Tipo | Client ID | Uso |
|---|---|---|
| Android (type 1) | `1071922885496-2knh1l8lkintplr4oc8j4iibla2v5j1d.apps.googleusercontent.com` | App nativa al iniciar flujo Google Sign-In |
| Web (type 3) | `1071922885496-ggktf2e4q2a1kl7pjt866rqvm8ad0gft.apps.googleusercontent.com` | Backend al verificar `idToken` enviado por la app |

> **Acción para Phase 2 (backend):** estos dos client IDs se configurarán como env vars en Railway:
> - `GOOGLE_CLIENT_ID_ANDROID=1071922885496-2knh1l8lkintplr4oc8j4iibla2v5j1d.apps.googleusercontent.com`
> - `GOOGLE_CLIENT_ID_WEB=1071922885496-ggktf2e4q2a1kl7pjt866rqvm8ad0gft.apps.googleusercontent.com`
>
> El backend verificará el `idToken` con `audience: [GOOGLE_CLIENT_ID_ANDROID, GOOGLE_CLIENT_ID_WEB]` para aceptar tokens emitidos por cualquiera de los dos clients.

### Debug Keystore (workstation del owner)

| Concepto | Valor |
|---|---|
| Path | `C:\Users\luisv\.android\debug.keystore` |
| Alias | `androiddebugkey` |
| Store password | `android` (default Android) |
| Key password | `android` (default Android) |
| SHA-1 | `D6:37:DC:C9:BC:5C:13:EB:4D:D8:E3:8D:2D:F8:5F:1E:78:E5:B5:89` |
| SHA-256 | `F3:43:03:D5:57:86:1D:66:C7:C4:5D:47:8E:75:A0:7F:66:BF:B9:57:25:82:89:6E:1B:67:2F:84:90:FC:C0:88` |
| Validity | Mar 2025 → Mar 2055 |

> **Solo para desarrollo.** El keystore de release se generará en Phase 7 con SHA distintos.

### Workstation del owner

| Concepto | Valor |
|---|---|
| OS | Windows |
| Shell estándar acordada | PowerShell |
| JDK 11 (legacy, en PATH) | `C:\Program Files\Java\jdk-11.0.12\` |
| JDK 17 (incluido con Android Studio) | `C:\Program Files\Android\jdk\` ← se usará para Phase 1+ |
| Android Studio | `C:\Program Files\Android\Android Studio\bin\studio64.exe` ✅ instalado |
| Carpeta de credenciales | `C:\Users\luisv\tubus-credentials\` (NO commitear, fuera del repo) |

---

## 🔍 Hallazgo Arquitectural — Dos Proyectos Google Cloud

**Detectado:** 2026-05-15.

**Hecho:** los OAuth Client IDs del sistema están repartidos en **dos proyectos Google Cloud** distintos:

| Project Name (Cloud) | Project Number | Project ID | OAuth Clients hospedados |
|---|---|---|---|
| "Tu Bus Express" (proyecto antiguo) | `636574312835` | `tu-bus-express` (con guiones) | `636574312835-tuo0mismqebqtk7jss7p014m6mmjcm9.apps.googleusercontent.com` (Web — Passport actual) |
| "TuBusExpress" (proyecto Firebase) | `1071922885496` | `tubusexpress` (sin guiones) | `1071922885496-2knh1l8lkintplr4oc8j4iibla2v5j1d.apps.googleusercontent.com` (Android), `1071922885496-ggktf2e4q2a1kl7pjt866rqvm8ad0gft.apps.googleusercontent.com` (Web/Server) |

> **Acceso del owner:** ambos proyectos visibles desde la misma cuenta Google del owner — confirmado vía pestaña "Todos" en selector de proyectos Google Cloud.

> **Convención visual para distinguirlos:**
> - **`tu-bus-express`** (con guiones, project number `636574312835`) = backend Passport.
> - **`tubusexpress`** (sin guiones, project number `1071922885496`) = Firebase / Android.

**Causa probable:** el OAuth client del backend (`636574312835-...`) se creó manualmente en un proyecto Google Cloud independiente antes de configurar Firebase. Cuando se creó Firebase project `tubusexpress`, Google generó automáticamente un proyecto Cloud paralelo (`1071922885496`).

**Estado:** funciona correctamente. NO se requiere migrar ni consolidar para v1.

**Decisión arquitectural:**

El backend (Phase 2) validará `idToken` con `google-auth-library` usando un array `audience` que acepta los **3 Client IDs**:

```typescript
const VALID_AUDIENCES = [
  '636574312835-tuo0mismqebqtk7jss7p014m6mmjcm9.apps.googleusercontent.com', // Web Passport (legacy)
  '1071922885496-2knh1l8lkintplr4oc8j4iibla2v5j1d.apps.googleusercontent.com', // Android (Firebase)
  '1071922885496-ggktf2e4q2a1kl7pjt866rqvm8ad0gft.apps.googleusercontent.com', // Web Firebase server (FALLBACK)
];

const ticket = await client.verifyIdToken({
  idToken,
  audience: VALID_AUDIENCES,
});
```

**Ventajas:**

- Preserva el flujo web actual sin cambios (sigue usando Passport con `636574312835-...`).
- Acepta tokens emitidos por la app Android (que llevarán `aud` con Web Firebase ID).
- Defensa en profundidad: ningún token de un proyecto inesperado es aceptado.

**Env vars Railway resultantes (Phase 2):**

```
GOOGLE_CLIENT_ID_WEB_LEGACY=636574312835-tuo0mismqebqtk7jss7p014m6mmjcm9.apps.googleusercontent.com
GOOGLE_CLIENT_ID_ANDROID=1071922885496-2knh1l8lkintplr4oc8j4iibla2v5j1d.apps.googleusercontent.com
GOOGLE_CLIENT_ID_WEB_FIREBASE=1071922885496-ggktf2e4q2a1kl7pjt866rqvm8ad0gft.apps.googleusercontent.com
```

**Migración futura (opcional, NO en alcance v1):**

Si se decide consolidar todo en un solo proyecto Google Cloud, la opción cleanest es migrar el OAuth Client web Passport al proyecto Firebase. Esto requeriría:

1. Crear nuevo OAuth Client Web en proyecto Firebase con mismas redirect URIs.
2. Cambiar env var `GOOGLE_CLIENT_ID` del backend al nuevo Client ID.
3. Aceptar que los refresh tokens existentes de la web actual se invalidan (forzando re-login a usuarios web).

**Decisión:** NO migrar en v1. Trade-off de complejidad/disrupción no vale la pena.

---

## Decisiones durante implementación — Phase 6.5

> Decisiones formales tomadas mientras se resolvían los 9 bugs descubiertos en Phase 6.5. Detalle completo de cada bug y su solución en [`13-phase-6.5-post-qa-fixes.md`](./13-phase-6.5-post-qa-fixes.md).

### Decisión D1 — Bidirectional Google linking: verificación por password

**Contexto:** un usuario con cuenta local intenta loguear con Google (su email coincide). El backend `findOrCreateFromGoogleProfile` rechaza con `EMAIL_ALREADY_REGISTERED_LOCAL` por la barrera anti-takeover. El usuario quería poder vincular Google a su cuenta local, no quedar bloqueado.

**Opciones evaluadas:**

| Opción | UX | Esfuerzo | Seguridad |
|---|---|---|---|
| **2A — Verificación por email** (token, similar al Caso 3 inverso) | 3 pasos (email back-and-forth) | Alto (template + token TTL + retries) | ✅ Requiere acceso al email |
| **2B — Verificación por password** (endpoint inmediato) | 1 paso | Medio | ✅ Requiere conocer password |
| 2C — Auto-link silencioso | 0 pasos | Bajo | ❌ Account takeover trivial |

**Decisión:** **Opción 2B**. Inmediato, seguro (password = posesión de la cuenta local), reutiliza `bcrypt` del login. UX óptima.

**Aprobada el 2026-05-20 por:** Owner.

**Acciones derivadas:**
- Backend: nuevo endpoint `POST /api/auth/link-google-with-password` + service method `linkGoogleToLocalAccount` + refactor del helper `verifyGoogleIdToken`.
- Frontend: nuevo componente `link-google-password-modal` + signals `linkGooglePendingSignal` / `linkGoogleModalOpen` en AuthService.

---

### Decisión D2 — `googleAuth.signOut()` en logout: invocación incondicional

**Contexto:** tras login Google → logout → segundo intento de login Google fallaba con `"No credentials available"` porque el SDK de Firebase Auth mantenía `FirebaseAuth.currentUser` activo.

**Opciones evaluadas:**

| Opción | Pros | Contras |
|---|---|---|
| Llamar `signOut()` **siempre** | Simple, garantiza limpieza | Llamada inútil cuando el user vino de email/password |
| Llamar `signOut()` **solo si user.googleId** | Optimizado | Requiere chequear modelo, lógica condicional frágil, posible race entre logout y limpieza del user signal |

**Decisión:** **siempre**. La strategy web es no-op (cost zero); en nativo `FirebaseAuthentication.signOut()` cuando no hay sesión activa también es no-op. No hay penalty.

**Aprobada el 2026-05-20 por:** Owner.

**Acciones derivadas:**
- `AuthService.performLogoutAsync` invoca `signOutGoogleSilent()` en paralelo con `unregisterFcmTokenSilent()` dentro del `Promise.allSettled` con cap de 1500ms.

---

### Decisión D3 — Theme admin: agnóstico al cliente, default light

**Contexto:** `ThemeService` era global. En el primer boot, si el SO está en dark, el admin también se montaba en dark. El owner indicó *"el admin es agnóstico al cliente"*.

**Opciones evaluadas:**

| Opción | Pros | Contras |
|---|---|---|
| Forzar admin always light (sin toggle) | Simple, predecible | El owner pidió un toggle |
| Dos themes separados con storage keys distintos | Cliente y admin independientes; admin default light | Más complejo, requiere router awareness |
| Cambiar `ThemeService.getInitialTheme()` para ignorar `prefers-color-scheme` siempre | Simple | Rompe la convención web del cliente |

**Decisión:** **dos themes separados con detección por ruta**. Cliente conserva su comportamiento histórico; admin agnóstico con default light + toggle dedicado en el sidebar.

**Aprobada el 2026-05-20 por:** Owner.

**Acciones derivadas:**
- Refactor de `ThemeService`: signals `clientThemeSignal` + `adminThemeSignal`, computed `theme`, storage keys `e-commerce-theme` + `admin-theme`, suscripción a `Router.events` para `NavigationEnd`.
- `<app-theme-toggle>` añadido al `.header-right` del `AdminLayoutComponent`.

---

### Decisión D4 — Modales fullscreen mobile: `env()` puro sin floor `max(1rem,...)`

**Contexto:** los modales del checkout en `@media (max-width: 639px)` son fullscreen por diseño. Mi primer fix usaba `padding: max(1rem, env(safe-area-inset-*))` en todos los modales, lo que añadía 1rem extra de padding en mobile.

**Decisión:** en breakpoints mobile fullscreen, usar `padding: env(safe-area-inset-*)` SIN el `max(1rem, ...)` floor. El modal debe ocupar TODO el espacio menos los safe-areas exactos del SO — no necesita respiración adicional.

**Aprobada el 2026-05-20 por:** Owner (implícito al confirmar resolución).

**Acciones derivadas:**
- `_responsive.scss` y `_confirm-modal.scss` aplican `env()` puro en sus breakpoints mobile.
- `_modal-payment.scss` (selector base, no-mobile) mantiene `max(1rem, env(...))` como respiración desktop.

---

### Decisión D5 — Logo admin: PNG transparente en lugar de SVG con `currentColor`

**Contexto:** el sidebar header del admin usaba un SVG flat de escudo con `stroke="currentColor"`. En dark mode el sidebar bg pasa a oscuro y el icono quedaba invisible.

**Opciones evaluadas:**

| Opción | Pros | Contras |
|---|---|---|
| Hardcodear `color` del SVG (e.g. accent-primary) | Mantiene formato vectorial | Requiere variantes para light/dark |
| Reemplazar por PNG transparente del proyecto | Consistente con el cliente, sin lógica de tema | PNG no escala como SVG (irrelevante en 40×40) |

**Decisión:** **PNG (`assets/icons/autobus.png`)**. Mismo asset usado por el header del cliente. Consistencia visual + simplicidad (sin reglas dark/light específicas).

**Aprobada el 2026-05-20 por:** Owner.

**Acciones derivadas:**
- `admin-layout.component.html` cambia `<svg>` por `<img class="logo-img" />`.
- `admin-layout.component.scss` añade `.logo .logo-img { @apply w-10 h-10 object-contain; }` para preservar tamaño.

---

## Decisiones durante implementación — Phase 6.6

> Decisión adicional tomada al descubrir el bug raíz que Phase 6.5 no había detectado. Detalle completo del análisis y solución en [`14-phase-6.6-native-insets-bridge.md`](./14-phase-6.6-native-insets-bridge.md).

### Decisión D6 — Bridge nativo para safe-area insets en Android WebView

**Contexto:** los fixes CSS-only de Phase 6.5 (`env(safe-area-inset-*)` en padding y position) NO funcionaban uniformemente. Samsung A56 (Android 14) seguía mostrando el bug de status-bar/nav-bar superpuestas al contenido. Investigación profunda reveló que **el WebView Android no propaga los `WindowInsets` del SO al motor CSS por defecto**. `env(safe-area-inset-*)` retorna `0px` en todas las versiones Android (7-16) salvo casos esporádicos no documentados. iOS WKWebView sí lo hace automáticamente, lo que explica por qué la doc de Capacitor da la falsa impresión de que CSS basta.

**Opciones evaluadas:**

| Opción | Pros | Contras |
|---|---|---|
| Plugin `@capacitor-community/safe-area` | Mantenido externamente, abstrae el bridge | Dependencia que puede ser abandonada, peso extra en el bundle Java |
| **Bridge nativo manual** en `MainActivity.java` | Sin dependencias, ~135 líneas, usa solo `androidx.core` (oficial Google) | Requiere mantener código nativo Java |
| Esperar a Capacitor 9 con fix oficial | Cero código | Sin ETA, bloquea release v1 |

**Decisión:** **bridge nativo manual** (`MainActivity.java`). Captura `WindowInsets` con `setOnApplyWindowInsetsListener`, convierte de px a CSS px usando `density`, e inyecta como CSS custom properties (`--safe-area-top/bottom/left/right`) en `<html>` vía `evaluateJavascript`. Funciona uniformemente en Android 7-16.

**Aprobada el 2026-05-21 por:** Owner.

**Acciones derivadas:**
- [`MainActivity.java`](frontend/android/app/src/main/java/com/tubusexpress/app/MainActivity.java) reescrito (~135 líneas).
- **36 archivos** normalizados con `sed`: `env(safe-area-inset-*)` → `var(--safe-area-*)`.
- [`styles.scss`](frontend/src/styles.scss) conserva el `:root { --safe-area-*: env(...) }` como fallback para web/iOS.

**Lección clave registrada:** cuando un CSS fix funciona "en algunos dispositivos sí, en otros no", la causa NO es CSS — está en una capa más baja (WebView, runtime nativo, plugin). Nunca aceptar "funciona a veces" como solución.

---

## Decisiones Phase B (iOS) — pre-implementación

> Decisiones formales tomadas el **2026-05-27** durante la planificación de Phase B (iOS), antes de tocar código. Surgieron del análisis deep-debug (`dd-ios-gap-analysis`) y del refinamiento del plan en `16-phase-B-windows-track.md`.

### Decisión D7 — Adoptar Sign in with Apple obligatorio en iOS

**Contexto:** App Store Review Guideline 4.8 (vigente 2026) requiere que toda app con login OAuth de terceros (Google, Facebook, etc.) ofrezca también Sign in with Apple. Sin esto, Apple rechaza el binario en review.

**Opciones evaluadas:**

| Opción | Pros | Contras |
|---|---|---|
| **A — Implementar Sign in with Apple desde v1** | Cumple Guideline 4.8 al primer intento de review | Esfuerzo adicional (~1.5 días backend + 0.5 día frontend) |
| B — Submitir sin Apple Sign-In y esperar rechazo | Cero esfuerzo inicial | Pierdes 1-2 semanas de review + tienes que implementarlo igual |
| C — Quitar Google Sign-In de iOS solamente | Esquiva el guideline | UX inconsistente entre Android y iOS; mala señal a usuarios |

**Decisión:** **Opción A**. Implementar Sign in with Apple desde el primer release iOS.

**Aprobada el 2026-05-27 por:** Owner.

**Acciones derivadas:**
- Backend: nuevo endpoint `POST /api/auth/apple/native` + `userService.findOrCreateFromAppleProfile` (paralelo al de Google de Phase 6.5).
- Frontend: nuevo `@platform/apple-auth/` con strategy native + factory provider gateado por `platform.isIos()`.
- Capacitor: añadir `'apple.com'` al array `providers` en `capacitor.config.ts` plugin `FirebaseAuthentication`.

---

### Decisión D8 — Orden visual auth-modal: Apple arriba en iOS, Google arriba en Android

**Contexto:** ahora el `auth-modal` tendrá dos botones OAuth (Apple + Google) en iOS. Hay que decidir el orden.

**Opciones evaluadas:**

| Opción | Pros | Contras |
|---|---|---|
| Apple primero en iOS, Google primero en Android | Respeta iOS HIG (Apple primero en su SO) y Material Design (Google primero en Android) | Requiere gateifying por plataforma |
| Google siempre primero | Consistencia visual cross-platform | Viola iOS HIG, mala señal en review Apple |
| Apple siempre primero | Cumple iOS HIG | Inconsistente en Android donde Apple no aplica |

**Decisión:** Apple primero en iOS, Google primero en Android. Implementado via `@if (platform.isIos())` en el template del `auth-modal`.

**Aprobada el 2026-05-27 por:** Owner.

---

### Decisión D9 — Distribución iOS: App Store + TestFlight closed

**Contexto:** Apple, a diferencia de Android, NO permite sideload de APKs en cuentas Individual/Organization estándar. La única vía oficial es App Store.

**Opciones evaluadas:**

| Opción | Pros | Contras |
|---|---|---|
| **App Store + TestFlight closed** | Único camino oficial sin Enterprise account ($299/año) | Tarda 24-48h cada review |
| Apple Developer Enterprise Program | Permite distribución privada sin Apple review | $299/año + requiere D-U-N-S + sólo para empleados/contratistas internos (uso fuera viola TOS) |
| Sideload via Xcode build to device | Cero costo | Solo funciona en iPhones del owner registrados — no escalable |

**Decisión:** **App Store** como canal principal. **TestFlight closed** durante desarrollo/QA con hasta 100 testers internos.

**Aprobada el 2026-05-27 por:** Owner.

---

### Decisión D10 — Mac de desarrollo: acceso flexible

**Contexto:** Xcode es Mac-only. Para compilar iOS se requiere acceso a un Mac.

**Opciones evaluadas:**

| Opción | Costo | Pros | Contras |
|---|---|---|---|
| Comprar Mac mini M4 | ~$700 USD único | Control total, sin latencia | Costo inicial alto |
| Alquilar MacStadium | ~$50-80 USD/mes | Sin costo upfront | Latencia red, dependencia |
| Alquilar MacInCloud | ~$30-50 USD/mes | Más barato | Calidad variable |
| Pedir prestado | $0 | Sin costo | Dependencia logística |

**Decisión:** Owner indica que tendrá **acceso a un Mac pronto** (modalidad no especificada — flexible). No se compromete a una vía específica.

**Aprobada el 2026-05-27 por:** Owner.

**Implicación:** todo el Windows track del plan (~6 días-hombre) puede ejecutarse sin Mac. Solo el último ~30% del trabajo (compilación Xcode, QA en iPhone físico, archive/upload TestFlight) requiere el Mac y se ejecutará cuando esté disponible.

---

### Decisión D11 — iOS minSdk: iOS 14

**Contexto:** Capacitor 8 (el instalado) requiere iOS 14 mínimo. Bajar requeriría downgrade de Capacitor.

**Opciones evaluadas:**

| iOS mínimo | Cobertura dispositivos | Costo técnico |
|---|---|---|
| iOS 13 | ~98% | Requiere Capacitor 7 (rollback) |
| **iOS 14** (default Capacitor 8) | ~95% | Cero — es el default |
| iOS 15 | ~85% | Cero |

**Decisión:** **iOS 14** (default Capacitor 8). Alineado con `minSdkVersion 24` de Android (~95% cobertura también).

**Aprobada el 2026-05-27 por:** Owner.

---

### Decisión D12 — Versionado iOS ↔ Android: SemVer sincronizado, build numbers independientes

**Contexto:** versión iOS y Android pueden divergir si se manejan separado, complicando el versioning del backend forced-update endpoint.

**Opciones evaluadas:**

| Opción | Pros | Contras |
|---|---|---|
| **SemVer sincronizado** (`1.0.0` en ambos) + `versionCode`/`CFBundleVersion` independientes | Simple para forced-update + usuarios entienden | Releases requieren bump coordinado |
| Versiones totalmente independientes | Flexibilidad | Confusión, backend tiene que tracking dual |

**Decisión:** **SemVer sincronizado**. Backend `app-versioning` module trata Android y iOS con el mismo número canónico de versión.

**Aprobada el 2026-05-27 por:** Owner.

---

### Decisión D13 — Modal `link-apple-password-modal`: Opción A (separado, no genérico)

**Contexto:** ya existe `link-google-password-modal` desde Phase 6.5. Para Apple hay dos opciones: crear uno separado (calca) o refactorizar a componente genérico que sirva para ambos providers.

**Opciones evaluadas:**

| Opción | Pros | Contras |
|---|---|---|
| **A — Modal Apple separado** (calca) | Cero riesgo de regresión en Android producción; el modal Google sigue intocado | ~95 líneas duplicadas; mantener sincronizado manualmente |
| B — Refactorizar a `link-oauth-password-modal` genérico | DRY puro; un solo componente para todos los providers | Toca código de Android en producción → requiere re-QA en POCO |

**Decisión:** **Opción A — modal Apple separado**. La regla "Android producción no se toca" tiene prioridad sobre DRY en esta iteración.

**Aprobada el 2026-05-27 por:** Owner.

**Acciones derivadas:**
- Calcar 3 archivos de `link-google-password-modal/` a `link-apple-password-modal/`, cambiando solo nombres y strings.
- Documentar como deuda técnica futura: posible refactor a genérico post-v1 con QA dedicado.

---

### Decisión D14 — Documentación: plan upfront + bitácora al cierre de cada fase

**Contexto:** discusión sobre cuándo redactar la documentación de cada fase.

**Opciones evaluadas:**

| Opción | Pros | Contras |
|---|---|---|
| **Plan upfront + bitácora al cierre de cada fase** | Mismo patrón que Phases 0-6.6, validado; doc nunca diverge del código | Requiere disciplina de actualizar el doc al cerrar cada fase |
| Doc solo al final | Menos overhead inicial | Riesgo de olvidar detalles relevantes |
| Doc día por día | Trazabilidad máxima | Overhead excesivo |

**Decisión:** **plan upfront + bitácora al cierre de cada fase**. El doc del plan (`16-phase-B-windows-track.md`) ya existe; se actualizará la sección "Bitácora de ejecución" al cerrar cada fase consolidada (F1-F5).

**Aprobada el 2026-05-27 por:** Owner.

---

## Restricciones de contexto registradas (no son decisiones — son hechos)

### R-Railway: branch `feat/capacitor-ios` deploya a producción

**Confirmado el 2026-05-27 por:** Owner.

**Hecho:** la branch `feat/capacitor-ios` está vinculada al pipeline de auto-deploy de Railway. Cualquier commit pusheado a esta branch deploya automáticamente al backend de producción que sirve a web (`https://tubusexpress.com`) y a la APK Android Android distribuida en QA.

**Implicaciones:**

- Cero modificación a endpoints existentes (estrictamente aditivo).
- Tests obligatorios pre-commit (`npx tsc --noEmit` + `npm test` sin regresión sobre los 36 pre-existentes).
- Endpoints nuevos deben degradar limpio si faltan env vars (responder `500 OAUTH_NOT_CONFIGURED` sin crashear el proceso Node).
- Smoke test manual post-deploy (login Google web en producción) tras cada push.
- Commits pequeños y atómicos para que un `git revert` aislado funcione si algo se rompe.

Esta restricción está documentada como aviso crítico al inicio de [`16-phase-B-windows-track.md`](./16-phase-B-windows-track.md).

---

## Decisiones futuras (a resolver durante el proyecto)

Estas no bloquean el inicio pero se resolverán en su momento:

| # | Decisión | Cuándo | Notas |
|---|---|---|---|
| F1 | Texto del modal "¿Activar biometría?" | Phase 5.2 | Pequeño copy decision |
| F2 | Iconos / splash master 1024x1024 | Phase 1 / Phase 4.9 | Owner provee asset |
| F3 | Listing Play Store: textos, screenshots, feature graphic | Phase 7 | Owner provee assets |
| F4 | Política de privacidad actualizada (mencionar Crashlytics + Analytics + Apple Sign-In) | Phase 7 + Phase B | Owner edita |
| F5 | Release notes de v1.0.0 | Phase 7 | Owner aprueba |

---

## Cómo registrar nuevas decisiones

Cuando durante la implementación surja una decisión arquitectural no prevista:

1. Pausar la implementación.
2. Documentar en este archivo bajo nueva sección "Decisiones durante implementación":
   - Contexto (qué problema apareció).
   - Opciones evaluadas.
   - Opción elegida + razón.
   - Approver + fecha.
3. Continuar implementación.

Esto garantiza que en 6 meses cuando alguien pregunte "¿por qué hicimos X?" la respuesta exista.

---

## Próximo documento

Una vez los items pendientes ⏳ estén resueltos, se crea [`06-phase-0-prerequisites.md`](./06-phase-0-prerequisites.md) (todavía no existe — se genera al autorizar Phase 0).
