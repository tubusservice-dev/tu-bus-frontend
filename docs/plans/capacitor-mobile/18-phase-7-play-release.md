# 18 — Phase 7 — Build Firmado y Distribución (Google Play)

> **Status:** ⏳ EN CURSO — app en **Closed Testing** (Google Play); release `versionCode 3 / 1.1` enviado. Acumulando los 14 días con 12 testers antes de poder habilitar producción. (Actualizado 2026-06-12.)
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
| DT-2 | Migrar a **Android Photo Picker** y eliminar `READ_MEDIA_IMAGES` | Elimina el error de permiso de fotos y la obligación de declarar | Frontend (`@capacitor/camera` config) + manifest + re-QA POCO |
| DT-3 | `ndk { debugSymbolLevel 'SYMBOL_TABLE' }` en release | Símbolos nativos legibles en Crashlytics/Play (crashes nativos) | Requiere NDK + nuevo versionCode |
| DT-4 | Evaluar R8/ProGuard con keep rules de Capacitor | Reduce tamaño app + genera mapping | Requiere QA en dispositivo |

---

## Métricas del release

| Métrica | Valor |
|---|---|
| `versionCode` | 3 |
| `versionName` | "1.1" |
| Tamaño de entrega (Play) | 11.7 MB |
| Bundle web transfer | ~193 kB (dentro de baseline Phase 6.6) |
| Plugins Capacitor | 13 |
| Firma AAB | upload key (alias `UPLOAD`), `jar verified` |

---

## Próximo documento

Al promover a producción (tras 12 testers / 14 días), actualizar este documento con la bitácora del lanzamiento en producción y el cierre formal de Phase 7.
