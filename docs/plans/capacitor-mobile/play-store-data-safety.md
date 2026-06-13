# Google Play — Data Safety Form (TuBus Express)

> **Status:** ✅ En uso — Phase 7 / Closed Testing (actualizado 2026-06-12). Source of truth interno para Play Console → *App content → Data safety*.
> **Norma:** Política de Datos de Usuario de Google Play. La declaración debe coincidir 1:1 con lo que la app realmente hace. Declarar mal = suspensión de la app.
> **Equivalente iOS:** [`app-store-privacy-nutrition.md`](app-store-privacy-nutrition.md). El **modelo de Play es distinto** al de Apple — leer §1.

---

## 1. Diferencias clave del modelo Play vs Apple

| Concepto | Apple (App Privacy) | Google (Data Safety) |
|---|---|---|
| Unidad | "Data type" con flags Linked/Tracking | "Data type" agrupado en categorías Play |
| ¿Recolectado? | "Collect" | **"Collected"** = se transmite fuera del dispositivo |
| Procesamiento temporal | (no existe) | **"Processed ephemerally"** = se usa en memoria y NO se almacena |
| Compartir | implícito en "Tracking" | **"Shared"** = transferido a un TERCERO. **OJO:** transferir a un *service provider* que procesa **en tu nombre** (Firebase, Cloudinary) NO cuenta como "Shared". |
| Obligatorio/Opcional | (no existe) | **"Required" vs "Optional"** por cada dato |
| Propósitos | listа Apple | lista Google: App functionality, Analytics, Developer communications, Advertising/marketing, Fraud prevention & security, Personalization, Account management |
| Seguridad | (no en este form) | **"Encrypted in transit"** + **"Users can request deletion"** (obligatorio responder) |

> **Definición crítica de "Shared":** Firebase (Auth, FCM, Crashlytics, Analytics) y Cloudinary son **proveedores de servicio** que procesan datos por encargo de TuBus. Bajo la política de Play, eso **NO es "compartir con terceros"**. Por tanto **Shared = No** en todas las filas. Solo sería "Shared" si vendiéramos/cediéramos datos a un tercero para sus propios fines (no es el caso).

---

## 2. Resumen ejecutivo

TuBus Express recolecta datos para: **gestión de cuenta**, **funcionalidad de la app**, **analítica** y **diagnóstico de crashes**.

- ✅ Todos los datos se transmiten **cifrados (HTTPS/TLS)**.
- ✅ El usuario **puede solicitar la eliminación** de su cuenta y datos.
- ❌ **NO** hay publicidad, ni tracking publicitario, ni venta de datos a terceros.
- ❌ **NO** se recolectan: contactos, mensajes, calendario, audio, salud, datos financieros de tarjeta, historial de navegación web.

---

## 3. Prácticas de seguridad (Security practices) — preguntas globales

| Pregunta de Google | Respuesta | Justificación |
|---|---|---|
| ¿Los datos están **cifrados en tránsito**? | **Sí** | Todo el tráfico va por HTTPS a `api.tubusexpress.com`; `androidScheme: 'https'` en `capacitor.config.ts`. |
| ¿Los usuarios pueden **solicitar la eliminación** de sus datos? | **Sí** ✅ | Implementado (§6): borrado in-app + página pública `legal/eliminar-cuenta`. |
| ¿La app sigue las políticas de Families? | No aplica (target 18+) | |

---

## 4. Matriz de datos — qué declarar como RECOLECTADO

Leyenda: **C** = Collected · **S** = Shared · **E** = Processed ephemerally · **R/O** = Required/Optional

### 4.1 Personal info

| Dato | C | S | E | R/O | Propósito(s) Play |
|---|---|---|---|---|---|
| Name | ✅ | No | No | Required | Account management, App functionality |
| Email address | ✅ | No | No | Required | Account management, App functionality |
| Phone number | ✅ | No | No | Required | App functionality (contacto delivery, link WhatsApp) |
| Address (física/envío) | ✅ | No | No | Optional | App functionality (destino de despacho, zonificación) |
| User IDs | ✅ | No | No | Required | Account management, Analytics |
| Race, political, religion, sexual orientation | ❌ | — | — | — | No se recolecta |
| Other personal info | ❌ | — | — | — | — |

### 4.2 Financial info

| Dato | C | S | E | R/O | Propósito(s) |
|---|---|---|---|---|---|
| User payment info (tarjeta) | ❌ | — | — | — | **No** — pagos offline, sin datos de tarjeta |
| Purchase history | ✅ | No | No | Required | App functionality (historial de pedidos/pagos, soporte) |
| Credit score / Other financial info | ❌ | — | — | — | No |

> ⚠️ En Play, **"Purchase history" vive bajo Financial info** (a diferencia de Apple, donde está en "Purchases" aparte). Hay pedidos/pagos asociados al usuario → declararlo.

### 4.3 Location

| Dato | C | S | E | R/O | Propósito(s) |
|---|---|---|---|---|---|
| Approximate location | ❌ | — | — | — | No (la app pide `ACCESS_COARSE` pero el flujo usa fine para zonificación) |
| Precise location | ✅ | No | **Sí (ephemeral)** | **Optional** | App functionality (sugerir zona/sucursal al tocar "Usar mi ubicación") |

> La lat/lng se envía a `GET /api/cities/by-coordinates` **solo cuando el usuario toca el botón**, se usa para resolver la zona y **no se persiste con el userId** (el endpoint hoy ni siquiera la almacena). Por eso: **Optional + Processed ephemerally**.

### 4.4 Photos and videos

| Dato | C | S | E | R/O | Propósito(s) |
|---|---|---|---|---|---|
| Photos | ✅ | No | No | Optional | App functionality (foto de comprobante de pago, avatar) |
| Videos | ❌ | — | — | — | No |

> Las fotos se suben a Cloudinary (service provider) → **Shared = No**. Son opcionales (solo si el usuario sube comprobante/avatar).

### 4.5 App activity

| Dato | C | S | E | R/O | Propósito(s) |
|---|---|---|---|---|---|
| App interactions (product interaction) | ✅ | No | No | Optional | Analytics (Firebase Analytics) |
| In-app search history | ✅ | No | No | Optional | Analytics |
| Installed apps / Other user-generated content / Other actions | ❌ | — | — | — | No |

> Reseñas y comentarios de pedidos son *contenido del usuario* asociado a su cuenta, pero su propósito es App functionality. Si el revisor lo cuestiona, declararlos bajo "Other user-generated content" → App functionality. Por defecto se cubren con Purchase history + interactions.

### 4.6 App info and performance

| Dato | C | S | E | R/O | Propósito(s) |
|---|---|---|---|---|---|
| Crash logs | ✅ | No | No | Required | App functionality / Fraud prevention & security (Firebase Crashlytics) |
| Diagnostics (performance) | ✅ | No | No | Required | Analytics (Firebase Performance, si se activa) |
| Other app performance data | ❌ | — | — | — | — |

### 4.7 Device or other IDs

| Dato | C | S | E | R/O | Propósito(s) |
|---|---|---|---|---|---|
| Device or other IDs | ✅ | No | No | Required | App functionality (FCM device token para push), Analytics |

---

## 5. Datos NO recolectados (declarar "No" explícito)

| Categoría Play | ¿Recolecta? |
|---|---|
| Health and fitness | ❌ No |
| Messages (SMS/email/in-app) | ❌ No (WhatsApp es externo, no leemos mensajes) |
| Contacts | ❌ No |
| Calendar | ❌ No |
| Audio files (voz, grabaciones) | ❌ No |
| Music files | ❌ No |
| Files and docs | ❌ No |
| Web browsing history | ❌ No |
| User payment info (tarjeta/crédito) | ❌ No |
| Advertising ID / datos publicitarios | ❌ No |

> **Advertising ID — ✅ RESUELTO (removido del manifest):** el permiso `com.google.android.gms.permission.AD_ID` lo inyecta `play-services-measurement` (Firebase Analytics) de forma transitiva. Se removió explícitamente en el manifest fuente (`android/app/src/main/AndroidManifest.xml:122`):
> ```xml
> <uses-permission android:name="com.google.android.gms.permission.AD_ID" tools:node="remove" />
> ```
> (con `xmlns:tools="http://schemas.android.com/tools"` ya declarado en el `<manifest>`). El AAB de release (`versionCode 3`) ya no expone `AD_ID`, de modo que la declaración "no advertising data" es **consistente con el binario**. Confirmado al subir la versión a Play (no reaparece el problema de declaración de Ad ID).

---

## 6. ✅ RESUELTO: eliminación de cuenta (Account deletion)

Google Play exige (política vigente desde 2024) que **toda app que permita crear una cuenta** ofrezca:

1. Una forma de **eliminar la cuenta desde dentro de la app**.
2. Un **enlace web público** para solicitar la eliminación, que se declara en el Data Safety form (campo "URL for account deletion").

**✅ IMPLEMENTADO (2026-06-04):** el borrado self-service de cuenta ya existe con estrategia de **anonimización** (no hard-delete, para preservar registros contables):
- **Backend:** `DELETE /api/users/account` (`backend/src/modules/users/routes/user.routes.ts`) → `UserController.deleteAccount` → `UserService.anonymizeAndDeleteAccount`. Verifica identidad (contraseña en cuentas locales; frase "ELIMINAR" en cuentas OAuth puras), borra PII del documento User, elimina device tokens / vehículos / notificaciones, invalida auth tokens y JWT (`tokensInvalidatedAt`), borra el avatar de Cloudinary y registra `AuthAuditEvent.ACCOUNT_SELF_DELETED`. Conserva pedidos/pagos despersonalizados.
- **Frontend (app + web):** botón "Eliminar Cuenta" en la sección ACCIONES de `/perfil` → `DeleteAccountModalComponent` (doble confirmación: identidad + checkbox de irreversibilidad). Tras el éxito hace logout automático.
- **Página pública (2026-06-04):** ruta `legal/eliminar-cuenta` (`frontend/src/app/features/legal/pages/account-deletion/account-deletion.component.ts`, registrada en `app.routes.ts`, sin `authGuard` → accesible sin login). Enlazada desde el footer. Documenta el borrado in-app, la vía por email (`privacidad@tubusexpress.com`), qué se elimina vs. qué se conserva anonimizado, y los pedidos en curso.
- **URL para el Data Safety form:** `https://www.tubusexpress.com/legal/eliminar-cuenta` (**con `www`** — el apex devuelve 404)

> Nota: el `DELETE /api/admin/users/:id` preexistente (`backend/src/modules/admin/routes/users.routes.ts:17`) es admin-borra-usuario y sigue siendo un soft-delete distinto; no confundir con el flujo self-service.

**Estado (2026-06-12):**
- [x] **Deploy a producción** — `https://www.tubusexpress.com/legal/eliminar-cuenta` responde **HTTP 200** (verificado). ⚠️ Solo funciona con `www`; el apex `tubusexpress.com` sin `www` devuelve 404 (ver deuda DT-1 en `18-phase-7-play-release.md`).
- [x] **URL declarada** en Play Console → App content → Data safety → "URL for account deletion": `https://www.tubusexpress.com/legal/eliminar-cuenta`.

> Este punto **no aparece en los docs de iOS** porque Apple lo gestiona distinto (exige el borrado in-app pero no la URL pública). Para Play es un campo obligatorio del form.

---

## 7. Checklist de validación del Data Safety form

- [ ] Cada fila de §4 cargada en Play Console con sus flags C/S/E y R/O.
- [ ] Todas las categorías de §5 marcadas explícitamente como "No collected".
- [ ] "Encrypted in transit" = **Sí**.
- [x] "Users can request deletion" = **Sí** + URL `https://www.tubusexpress.com/legal/eliminar-cuenta` declarada en el form (§6).
- [ ] **Shared = No** en todas las filas (Firebase/Cloudinary son service providers, no terceros).
- [x] Verificado que el `AndroidManifest.xml` no expone `AD_ID` (§5) — removido con `tools:node="remove"`.
- [ ] El form coincide con la política de privacidad (`privacy-policy-additions.md`) y con las nutrition labels de iOS (`app-store-privacy-nutrition.md`) — las 3 fuentes deben ser consistentes.

---

## 8. Por qué importa que esto sea exacto

Google cruza la declaración del Data Safety form con un análisis estático y dinámico del binario:
- Si el AAB invoca `FusedLocationProviderClient` pero no declaraste Precise location → rechazo.
- Si Firebase Analytics recolecta el Advertising ID y declaraste "no advertising data" → rechazo + posible warning de política.
- Si permites crear cuenta y no ofreces borrado/URL → rechazo bajo la política de eliminación de cuentas.

Una declaración falsa puede derivar en **suspensión de la app y de la cuenta de developer**. Este documento es el source of truth; el form en Play Console debe reflejarlo 1:1.
