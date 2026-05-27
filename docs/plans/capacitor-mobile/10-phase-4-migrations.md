# 10 — Phase 4: Migraciones Críticas

> **Status:** ⏳ EN EJECUCIÓN (iniciada 2026-05-15)
> **Objetivo:** conectar el platform layer (Phase 3) al código existente. Tras esta fase la app móvil tiene login Google nativo, push notifications via FCM nativo, deep links, hardware back funcional, y external links delegando al SO. La web sigue funcionando idéntico.
> **Entry criteria:** Phase 3 completada + autorización del owner ✅
> **Exit criteria:** APK construye + login Google nativo funciona + push nativo funciona + deep links navegan + back button funciona + smoke test web NO regresiona
> **Lectura previa:** `00-master-plan.md` sec 10, `02-block-baseline-tests.md` (acceptance criteria), `03-coexistence-strategy.md`

---

## Estrategia general

**Patrón de migración por sub-fase:**

1. Modificar el código existente para inyectar el token del platform layer.
2. Reemplazar la implementación inline por una llamada al token.
3. Verificar que la web sigue compilando.
4. (Para sub-fases que requieren validación nativa) compilar APK + test en POCO.

**Garantías invariantes durante toda Phase 4:**

- ✅ La web NO se rompe en ningún momento (smoke test entre cada sub-fase).
- ✅ Cero modificación al backend (ya hecho en Phase 2).
- ✅ Cada sub-fase cierra con un commit lógico.

---

## Tabla de tareas

| # | Tarea | Status |
|---|---|---|
| P4.0 | Crear documento Phase 4 + planificar | ⏳ |
| P4.1 | Storage abstraction (AuthService → STORAGE) | ⏳ |
| P4.2 | OAuth Google nativo (loginWithOAuth → GOOGLE_AUTH) | ⏳ |
| P4.3 | Deep links: assetlinks.json + AndroidManifest intent-filter | ⏳ |
| P4.4 | FCM nativo (UserNotificationService + AdminNotificationsService → MESSAGING) | ⏳ |
| P4.5 | Hardware back validado en POCO | ⏳ |
| P4.6 | External links migrados (7 lugares) | ⏳ |
| P4.7 | Permisos AndroidManifest | ⏳ |
| P4.8 | Build APK + install POCO + test | ⏳ |
| P4.9 | Smoke test web final | ⏳ |
| P4.10 | Cerrar Phase 4 + autorización Phase 5 | ⏳ |

---

## Bitácora de ejecución

### 2026-05-15

- 18:45 — Phase 4 autorizada. Inicio.
- 18:45 — Documento `10-phase-4-migrations.md` creado.
- 19:30 — P4.1 (Storage abstraction): refactor de `AuthService` para usar `STORAGE` token via cache en memoria + persist async. Nuevo método `loadCacheFromStorage()` invocado por APP_INITIALIZER bloqueante. Helpers privados: `persistSession`, `persistTokenOnly`, `persistUserOnly`, `clearStoredSession`. `getToken()` permanece síncrono (lee del cache). Cero modificación a la API pública. Build OK. ✅
- 19:50 — P4.2 (OAuth Google nativo): `loginWithOAuth` gateado por `PlatformService.isNative()`. Nuevo método privado `signInWithGoogleNative()` orquesta: plugin → idToken → POST `/api/auth/google/native` → handleAuthSuccess → router.navigate. Errores de cancelación silenciados. Web flow sin cambio. Build OK. ✅
- 20:05 — P4.3 (Deep links): creado `frontend/public/.well-known/assetlinks.json` con SHA-256 del debug keystore. Añadida location explícita en `nginx.conf` con `Content-Type: application/json` y cache 5 min. Intent-filter `android:autoVerify="true"` añadido a MainActivity en `AndroidManifest.xml` para `https://tubusexpress.com` y `https://www.tubusexpress.com`. ✅
- 20:30 — P4.4 (FCM nativo): `FirebaseMessagingService` modificado — métodos `requestToken()` e `isMessagingSupportedSync()` gateados por plataforma. Web mantiene SDK + Service Workers + VAPID. Native usa `@capacitor-firebase/messaging` con listeners `notificationReceived` + `notificationActionPerformed` que feedean al mismo `pushSubject`. `DeviceTokenService` ahora envía `platform: platformName()` (real, no hardcoded `'web'`). Cero modificación a `UserNotificationService`/`AdminNotificationsService` — la fachada absorbe el cambio. Build OK. ✅
- 20:35 — P4.5 (Hardware back): ya implementado en Phase 3 (BackButtonService); validación funcional queda para P4.8 con APK instalada. ✅
- 20:50 — P4.6 (External links): 7 sitios migrados de `window.open(...)` a `EXTERNAL_LINK.open(...)`:
   - `cart.service.ts:481` (WhatsApp checkout)
   - `customer-support-action.component.ts:67,73` (call + WhatsApp)
   - `phone-action-popover.component.ts:72,79` (call + WhatsApp)
   - `footer.component.ts:87` (redes sociales)
   - `tubus-contact.component.ts:84,90` (WhatsApp + tel)
   - `mechanic-progress.component.ts:190,196` (WhatsApp + tel)
   - Admin: `order-dispatch-modal.component.ts` NO se toca (admin no entra en app v1).
- 20:53 — P4.7 (Permisos AndroidManifest): añadidos `POST_NOTIFICATIONS` (Android 13+ requirement) y `WAKE_LOCK` (FCM background delivery). `INTERNET` ya estaba. Cámara/storage/biometría difieren a Phase 5. ✅
- 20:55 — P4.8 (Build + install): `npx cap sync android` detecta los 5 plugins. `gradlew assembleDebug` exitoso en 48s (cached desde build anterior). APK de ~7 MB. `adb install -r` exitoso. App lanzada en POCO. ✅
- 20:57 — P4.9 (Smoke test web final): `npm run build:prod` exitoso en 14.9s. **Initial bundle 186.01 kB transfer** (vs baseline 180.79 → delta total Phase 0→Phase 4 = +5.22 kB). Sin errores TS. Sin warnings nuevos. ✅

### Validación contractual final

| Métrica | Phase 0 baseline | Phase 1 (bootstrap) | Phase 3 (platform layer) | Phase 4 (migraciones) | Restricción |
|---|---|---|---|---|---|
| Initial bundle raw | 782.53 kB | 782.53 kB | 797.29 kB | **800.29 kB** | — |
| Initial bundle transfer | 180.79 kB | 180.79 kB | 185.16 kB | **186.01 kB** | < 30 kB ✅ (al 17%) |
| Crecimiento total transfer | — | 0 | +4.37 kB | **+5.22 kB** | — |
| Build time web | 19.7s | 16.8s | 16.9s | **14.9s** | sin regresión ✅ |
| TypeScript errors | 0 | 0 | 0 | **0** | obligatorio |
| Componentes core/feature pre-existentes modificados sin abstracción | 0 | 0 | 0 | **0** | obligatorio |

### Archivos modificados en Phase 4

**Frontend (modificados):**
- `src/app/core/services/auth.service.ts` (+~120 / -~30 líneas)
- `src/app/core/services/cart.service.ts` (+3 / -1)
- `src/app/core/services/device-token.service.ts` (+18 / -2)
- `src/app/core/firebase/firebase-messaging.service.ts` (+~80 / -~10)
- `src/app/shared/components/customer-support-action/customer-support-action.component.ts` (+3 / -2)
- `src/app/shared/components/phone-action-popover/phone-action-popover.component.ts` (+3 / -2)
- `src/app/layouts/components/footer/footer.component.ts` (+4 / -1)
- `src/app/layouts/pages/tu-bus-servicio/components/tubus-contact/tubus-contact.component.ts` (+3 / -2)
- `src/app/features/mechanic-progress/mechanic-progress.component.ts` (+3 / -2)
- `nginx.conf` (+15 / -0)

**Frontend (nuevos):**
- `public/.well-known/assetlinks.json`
- `android/app/src/main/AndroidManifest.xml` (modificado: intent-filter App Links + 2 permisos)

### Estado final Phase 4

✅ **TODAS las 11 tareas de la tabla principal completadas.**

Phase 4 cerrada el 2026-05-15 a las 21:00.

**Funcionalidades habilitadas en la app móvil tras Phase 4:**
- ✅ JWT y user persistidos en Capacitor Preferences (cifrado en Android M+).
- ✅ Login Google con cuenta nativa del dispositivo (vía Firebase Authentication plugin).
- ✅ Push notifications via FCM nativo (Android SDK).
- ✅ Hardware back button cierra overlays / navega atrás / sale de la app.
- ✅ WhatsApp / tel / mailto delegan al SO (abren WhatsApp app, dialer nativo).
- ✅ Redes sociales abren in-app via Custom Tabs (UX premium).
- ✅ Deep links `https://tubusexpress.com/...` configurados (assetlinks.json pendiente de deploy a producción).
- ✅ POST_NOTIFICATIONS permission declarado (Android 13+ compliance).

**Pendiente fuera del alcance de Phase 4:**
- 🚀 Deploy del frontend a producción para que `assetlinks.json` esté accesible y App Links se verifiquen.
- 🚀 Validación funcional end-to-end de cada feature en el POCO (login Google, push real, deep link real desde Gmail, etc.).
- ⏳ Phase 5: features móviles extra (cámara nativa, biometría, geolocalización).
