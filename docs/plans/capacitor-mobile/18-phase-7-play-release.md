# 18 — Phase 7 — Build Firmado y Distribución (Google Play)

> **Status:** ⏳ EN CURSO — **acceso a producción CONCEDIDO** (2026-06-29). Release `versionCode 5 / 1.1.2` **en revisión** en Closed Testing tras migrar al **Android Photo Picker** (Google bloqueó el `vc4` en review de producción por `READ_MEDIA_IMAGES`). Publicación administrada activada. Pendiente: validar en dispositivo → promover `vc5` a producción. (Actualizado 2026-06-29.) — ver "Sesión 2026-06-29" abajo.
> **Plataforma:** Android (Phase A)
> **Owner:** Luis V (workstation Windows)
> **Cuenta Play:** personal — `TuBus Servicios` (account ID `7825213331489003956`)
> **App:** `TuBus Express` / `com.tubusexpress.app`
> **Lectura previa:** `00-master-plan.md` (§13 Phase 7), `05-decisions-log.md` (decisiones 1.5–1.10), `14-phase-6.6-native-insets-bridge.md`

---

## Resumen ejecutivo

Phase 7 cubre la generación del AAB firmado y su distribución por Google Play. Al iniciar esta sesión la app **ya estaba en Internal Testing** (AAB `versionCode 1`). El trabajo de esta sesión consistió en: regenerar el AAB con `versionCode 2`, subirlo, y resolver los bloqueadores de política que Play exige antes de enviar a revisión (declaración de permisos de fotos, declaración de Ad ID, y URL de política de privacidad). Durante el proceso se descubrió un problema de infraestructura del dominio (apex sin `www` devuelve 404) que afecta tanto la verificación de Play como los Android App Links.

---

## Estado de los bloqueadores históricos (verificado en código 2026-06-06)

Los 3 bloqueadores que registraba la memoria del proyecto ya estaban resueltos en código:

| # | Bloqueador | Estado | Evidencia |
|---|---|---|---|
| 1 | Signing de release | ✅ Resuelto | `android/app/build.gradle:30-42` — `signingConfigs.release` cargado desde `keystore.properties` (gitignored); `buildTypes.release` lo aplica si existe. `minifyEnabled false` a propósito (R8 rompe plugins Capacitor por reflexión). |
| 2 | Borrado de cuenta self-service | ✅ Resuelto (2026-06-04) | Backend `DELETE /api/users/account` → `UserService.anonymizeAndDeleteAccount`; UI en `/perfil`; página pública `legal/eliminar-cuenta`. |
| 3 | Permiso `AD_ID` | ✅ Removido | `AndroidManifest.xml:122` con `tools:node="remove"`. |

---

## Cronología de la sesión (2026-06-06 / 2026-06-07)

### 7.1 — Error "código de versión ya usado"

Al intentar subir un AAB nuevo a Play, el sistema rechazó con *"Ya se usó el código de la versión 1. Prueba con otro código."*

**Causa:** `versionCode` es un entero monotónico interno de Play (decisión 1.5); el AAB de Internal Testing ya ocupaba el `1`.

**Acción:** bump en `android/app/build.gradle`:
```
versionCode 1 → 2
versionName "1.0"   (sin cambios — mismo contenido funcional, solo re-empaquetado)
```

### 7.2 — Incidente: build en el proyecto equivocado

El owner ejecutó `npm run build:prod` desde `C:\Project\hot-wheels-ecommer\frontend` (otro proyecto — Diecast Market, **sin Capacitor**), generando `dist/diecast-market`. El `npx cap sync android` falló ahí con *"could not determine executable to run"* porque ese proyecto no tiene Capacitor instalado.

**Verificación realizada:**
- `hot-wheels-ecommer/frontend` → sin `capacitor.config.ts` ni carpeta `android`.
- `tu-bus-service/frontend` → SÍ tiene ambos. **Es el proyecto correcto.**

**Acción correcta (ejecutada en `tu-bus-service/frontend`):**
```
npm run build:prod      → dist/tubus-express (193 kB transfer, dentro de baseline)
npx cap sync android    → copió web assets + confirmó 13 plugins Capacitor
```

> **Regla operativa registrada:** los comandos de build/sync de la app móvil SIEMPRE se corren desde `C:\Project\tu-bus-service\frontend`, nunca desde `hot-wheels-ecommer`.

### 7.3 — Regeneración y subida del AAB

AAB firmado regenerado desde Android Studio (*Generate Signed Bundle / APK → Android App Bundle → upload keystore alias `UPLOAD` → release*).

**Verificación del binario (sesión anterior, sobre `app/release/app-release.aab`):**
- Firmado con upload key (`META-INF/UPLOAD.RSA`/`.SF`), `jar verified`.
- El warning PKIX (certificado self-signed) es esperado y benigno.
- Play App Signing activo (decisión 1.7) → Google re-firma con su app signing key al subir.

Subido a Play: `versionCode 2`, tamaño de entrega **11.7 MB**. (Posteriormente se iteró a **`versionCode 3` / `versionName 1.1`** — el binario que finalmente quedó en Closed Testing.)

### 7.4 — Bloqueadores de política en Play Console

Al crear la versión de prueba cerrada, Play reportó:

**Error A — Permiso de fotos/videos.** La app declara `READ_MEDIA_IMAGES` (`AndroidManifest.xml:84`) → Google exige declarar la funcionalidad principal que lo justifica.
- **Resolución (Opción A adoptada):** declarar el permiso. Funcionalidad legítima: comprobantes de pago + fotos de perfil + imágenes admin (productos/marcas/agencias).
- **Deuda futura (Opción B):** migrar a Android Photo Picker para eliminar el permiso y la obligación de declarar.

**Error B — Declaración de Ad ID incompleta.** Android 13+ exige declarar si se usa Advertising ID.
- **Resolución:** declarar **No** (el permiso `AD_ID` fue removido del manifest). Consistente con Data Safety "no advertising data". ✅ Resuelto por el owner.

**Error C — Política de privacidad da 404.** El crawler de Play no pudo acceder a la URL declarada.

### 7.5 — Hallazgo crítico de infraestructura: dominio canónico es `www`

Verificación empírica con `curl` (2026-06-06):

| URL | apex (`tubusexpress.com`) | `www.tubusexpress.com` |
|---|---|---|
| `/legal/privacidad` | ❌ 404 | ✅ 200 |
| `/legal/eliminar-cuenta` | ❌ 404 | ✅ 200 |
| `/legal/terminos` | (no probado apex) | ✅ 200 |
| `/.well-known/assetlinks.json` | ❌ 404 | ✅ 200 |

**Conclusión:** el dominio canónico es **`www.tubusexpress.com`**. El apex NO sirve las rutas profundas del SPA (responde 404/405 reales — está en un servicio distinto sin fallback a `index.html`). La nota previa en memoria que decía "404 falso de WebFetch" era **incorrecta** y fue corregida.

**Resolución del Error C:** usar URL **con www** en Play Console:
```
https://www.tubusexpress.com/legal/privacidad
```
Idem para Data Safety (borrado de cuenta): `https://www.tubusexpress.com/legal/eliminar-cuenta`.

### 7.6 — Advertencias no bloqueantes (2 mensajes por release)

| Advertencia | Causa | Veredicto |
|---|---|---|
| Sin archivo de desofuscación (mapping) | `minifyEnabled false` (R8 desactivado a propósito) | Ignorar — no hay ofuscación, no hay mapping que subir. |
| Código nativo sin símbolos de depuración | `.so` de plugins sin debug symbols | Ignorar para v1. Mejorable con `ndk { debugSymbolLevel 'SYMBOL_TABLE' }` (requiere NDK + nuevo versionCode). |

---

## Estado actual (2026-06-12)

- AAB final **`versionCode 3` / `versionName 1.1`** subido y en **Closed Testing**.
- Errores de política resueltos: permiso de fotos (declarado funcionalidad principal), Ad ID (declarado "No"), política de privacidad (URL corregida a `www`).
- Cambios enviados a revisión; la app está en **prueba cerrada** con el segmento "Prueba de Validación de Testers" (país Venezuela).
- Los 12 testers están instalando la app desde el enlace de opt-in de Play.

**Próximo hito:** completar **14 días con 12 testers activos** → habilitar acceso a producción → submit a producción.

> **Nota sobre métricas de Play:** el contador de "usuarios con la app instalada" se actualiza con 24–48 h de retraso, así que ver `1` no implica error. Solo cuentan las instalaciones hechas desde el opt-in de Play (no las de APK sideload).

---

## Requisito pendiente para producción (cuenta personal)

Google exige para cuentas personales: **mínimo 12 testers participando durante 14 días** en Closed Testing antes de habilitar acceso a producción. La prueba cerrada en curso es justamente para cumplir este requisito.

---

## Verificaciones críticas pendientes (no se ven en código, fallan en silencio)

Por Play App Signing, lo que importa es el **app signing key de Google**, no el upload key:

1. **SHA-256 del app signing key** debe coincidir con el segundo fingerprint de `public/.well-known/assetlinks.json` (`79:C3:8B:DF...`). Confirmar en Play Console → App integrity → App signing key certificate. Si no coincide → deep links abren en navegador.
2. **SHA-1 del app signing key** debe estar registrado en Firebase Console o el login Google nativo falla en la build de Play. Prueba empírica: login Google desde la app de testing.

---

## Deuda técnica registrada (post-v1)

| # | Item | Razón | Esfuerzo |
|---|---|---|---|
| DT-1 | Redirect **301 apex → www** para todas las rutas (incl. `/.well-known/`) | Resuelve de raíz: política de privacidad, Data Safety y verificación de App Links del host apex. Afecta SEO y links compartidos. | Infra/hosting (apex está en servicio distinto al nginx de www — ubicar primero) |
| ~~DT-2~~ ✅ | ~~Migrar a **Android Photo Picker** y eliminar `READ_MEDIA_IMAGES`~~ **RESUELTO 2026-06-29 (vc5)** | Google bloqueó el `vc4` en review de producción por la política de permisos de fotos. Se eliminaron `READ_MEDIA_IMAGES` + `READ_EXTERNAL_STORAGE` del manifest (sin romper nada — ver sesión 2026-06-29). | Hecho |
| DT-3 | `ndk { debugSymbolLevel 'SYMBOL_TABLE' }` en release | Símbolos nativos legibles en Crashlytics/Play (crashes nativos) | Requiere NDK + nuevo versionCode |
| DT-4 | Evaluar R8/ProGuard con keep rules de Capacitor | Reduce tamaño app + genera mapping | Requiere QA en dispositivo |

---

## Métricas del release

| Métrica | Valor |
|---|---|
| `versionCode` | 5 (cadena: 3 → 4 App Links fix → 5 Photo Picker) |
| `versionName` | "1.1.2" |
| Tamaño de entrega (Play) | 11.7 MB |
| Bundle web transfer | ~193 kB (dentro de baseline Phase 6.6) |
| Plugins Capacitor | 13 |
| Firma AAB | upload key (alias `UPLOAD`), `jar verified` |

---

## Sesión 2026-06-29 — App Links (vc4) + migración Photo Picker (vc5)

> Cubre el fix de Android App Links, la concesión del acceso a producción, y el bloqueo de permisos de fotos que forzó la migración al Android Photo Picker (resuelve DT-2).

### vc4 (1.1.1) — fix de Android App Links (2026-06-25)

Deep-debug detectó que el `intent-filter` `autoVerify` declaraba dos hosts (`tubusexpress.com` apex + `www`), pero el **apex sirve 404 sin redirect** en `/.well-known/assetlinks.json` (verificado con `curl`). Con `autoVerify`, Android verifica CADA host por HTTPS **sin seguir redirects** → el host apex nunca verifica → App Links rotos: **total en Android ≤11** (verificación all-or-nothing por app), parcial en 12+.

**Fix (commit `7533a4b`):** se quitó el host apex del `intent-filter`; queda solo `www.tubusexpress.com`.
- `CLIENT_URL = https://www.tubusexpress.com` (verificado en Railway, servicio `tu-bus-express-frontend`) ⇒ ningún enlace real (verify-email/reset) apunta al apex.
- `assetlinks.json` ya tenía el fingerprint correcto del **app signing key** (`79:C3:8B:DF…`, **verificado** en Play Console → Protegido con Play → Administra la firma de apps de Play). El otro fingerprint (`F3:43:03…`) es el debug keystore.
- `versionCode 3 → 4`, `versionName → 1.1.1`. Subido a Closed Testing + **solicitud de acceso a producción** enviada (criterios 12 testers / 14 días ya cumplidos).

### Acceso a producción concedido + bloqueo de permisos de fotos (2026-06-29)

Google **concedió el acceso a producción**. Al crear el release de producción promoviendo el `vc4`, el pre-check de Play lo **bloqueó**:

> *"Uso no válido de los permisos de fotos y vídeos: tu app no puede utilizar READ_MEDIA_IMAGES ni READ_MEDIA_VIDEO porque solo necesita acceder de forma puntual o con poca frecuencia…"*

La declaración de "funcionalidad principal" (que **sí pasó en Closed Testing** en Phase 7 inicial) **NO califica para producción**: esa excepción es para galerías/editores de foto/vídeo, no para un e-commerce que sube comprobantes/avatares de forma ocasional. "Continuar de todos modos" tenía riesgo alto de rechazo humano.

### Migración a Android Photo Picker — vc5 (1.1.2)

Investigación del uso real de imágenes en el código:
- **25 de 26 flujos** (comprobantes de pago en checkout, avatar de perfil, imágenes admin de productos/marcas/agencias/líneas) usan **`<input type="file">`** en el WebView → el file chooser del SO **no requiere permiso de la app**.
- **1 flujo** (`mechanic-progress.component.ts`) usa **`@capacitor/camera@8.2.0`**; para galería (`CameraSource.Photos`) usa el **Android Photo Picker** del sistema → **tampoco requiere permiso** en la v8.

**Conclusión:** el permiso era innecesario. Se eliminaron `READ_MEDIA_IMAGES` y `READ_EXTERNAL_STORAGE` del `AndroidManifest.xml` (se mantiene `CAMERA` para captura). Comentario obsoleto en `native-camera.strategy.ts` corregido. `versionCode 4 → 5`, `versionName → 1.1.2`. **Resuelve DT-2.**

Sin el permiso, el bloqueo de Play desaparece de raíz (nada que declarar). El `vc4` (con permiso) se **descartó** del release de producción; el `vc5` se subió a Closed Testing y está **en revisión**.

### Publicación administrada (managed publishing) activada

Se activó la **publicación administrada** para desacoplar "enviar a revisión" de "publicar": Google revisa, pero nada sale a usuarios hasta pulsar **"Publicar"** manualmente. Permite validar en dispositivo antes de exponer producción.

### Pendiente (próximos checkpoints)

1. Google aprueba el `vc5` → **publicarlo manualmente** (managed publishing) → llega a testers.
2. **Validar en dispositivo (crítico antes de producción):**
   - Subir comprobante/avatar **funciona sin el permiso** (Photo Picker) — afecta el checkout.
   - App Links: `adb shell pm get-app-links com.tubusexpress.app` → `www.tubusexpress.com: verified`; tap en enlace `verify-email` desde Gmail abre la app.
3. Si ambas pasan → crear release de **producción** con `vc5` (+ Venezuela, ya en cola) → **Publicar** manualmente.

> **Nota:** la declaración de "Permisos de fotos y videos" que se llenó durante el bloqueo quedó como cambio "indicado" en Play; es **irrelevante** ahora que el `vc5` no declara el permiso. No requiere acción.

---

## Próximo documento

Al promover a producción, actualizar este documento con la bitácora del lanzamiento en producción y el cierre formal de Phase 7.
