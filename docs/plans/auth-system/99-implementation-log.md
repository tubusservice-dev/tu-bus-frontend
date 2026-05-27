# Log de Implementación — Sistema de Autenticación

> Bitácora viva del progreso de implementación. Se actualiza con cada paso significativo, decisión técnica, error encontrado y solución aplicada.
>
> **Inicio:** 2026-04-29
> **Estado:** En progreso

---

## 📊 Estado por fase

| Fase | Estado | Notas |
|------|--------|-------|
| Fase 0 — Infraestructura de correos | 🟢 Completada | TypeScript compila sin errores |
| Fase 1 — Modelos de BD | 🟢 Completada | 4 modelos nuevos + cambios a User. TypeScript OK |
| Fase 2 — Backend | 🟢 Completada | 6 endpoints nuevos + 2 modificados. Rate limit + cuota. TypeScript OK |
| Fase 3 — Frontend | 🟢 Completada | 4 modales nuevos + 2 páginas + validador async + integración en 2 headers. TypeScript OK |
| Fase 4 — Cron + auditoría | 🟢 Completada | Cron horario activo + auditoría completa en todos los flujos críticos |

**Leyenda:** ⚪ Pendiente · 🟡 En progreso · 🟢 Completada · 🔴 Bloqueada

---

## Fase 0 — Infraestructura de correos

### ✅ Paso 1 — Instalación de dependencias

**Comando ejecutado:**
```bash
npm install resend handlebars express-rate-limit
npm install --save-dev @types/handlebars
```

**Resultado:**
- `resend` instalado
- `handlebars` instalado
- `express-rate-limit` instalado
- `@types/handlebars` instalado
- Total: 9 paquetes nuevos + 1 dev dep

**Advertencia detectada:**
- `npm` reporta 15 vulnerabilidades (6 moderate, 9 high) preexistentes en el proyecto.
- **No relacionadas con las nuevas dependencias.** Son del estado actual del repo.
- Se documentan como deuda técnica fuera del scope de este sprint.

**Tiempo:** ~1 minuto

---

### ✅ Paso 2 — Variables de entorno

**Archivo:** `backend/.env`

Se agregaron las **14 variables** del sistema de autenticación al archivo `.env` local.

**Valores en dev (permisivos para testing):**
```env
RESEND_API_KEY=                                # ⚠️ pendiente: usuario debe configurar
RESEND_FROM_EMAIL=onboarding@resend.dev
EMAIL_VERIFICATION_REQUIRED=false
EMAIL_VERIFICATION_TOKEN_TTL_MINUTES=60
PASSWORD_RESET_TOKEN_TTL_MINUTES=30
MAX_PASSWORD_RESET_RETRIES=10
PASSWORD_RESET_RETRIES_RESET_HOURS=1
MAX_VERIFICATION_RESEND_RETRIES=10
VERIFICATION_RESEND_RETRIES_RESET_HOURS=1
MAX_EMAILS_PER_DAY_GLOBAL=200
ZOMBIE_ACCOUNT_CLEANUP_AFTER_HOURS=168
RESET_PASSWORD_URL=http://localhost:4200/reset-password
VERIFY_EMAIL_URL=http://localhost:4200/verify-email
```

**Acción pendiente del usuario:**
- Crear cuenta en Resend (https://resend.com)
- Generar API Key
- Pegar el valor en `RESEND_API_KEY` antes de probar el envío real

---

### ✅ Paso 3 — Configuración (`config/index.ts`)

**Archivo:** `backend/src/config/index.ts`

**Cambios:**
- Reescrito completo siguiendo `01-architecture-and-models.md` sección 6.
- Helper `parseIntEnv()` para parsear con fallback.
- 6 secciones nuevas: `resend`, `emailVerification`, `passwordReset`, `rateLimit`, `zombieCleanup`, `urls`.
- Defaults seguros documentados.

**Decisión técnica:**
- Helper `parseIntEnv` evita NaN si la variable está mal configurada — usa el default automáticamente.
- Validación estricta de rangos se hace en `validate-env.ts` (paso siguiente).

---

## Errores encontrados (ninguno hasta el momento)

_Esta sección registra cualquier error técnico encontrado durante la implementación y cómo se resolvió._

---

## Decisiones tomadas durante implementación

_Decisiones técnicas que surgen al implementar y no estaban en el plan original._

---

## Resumen final de archivos creados/modificados

### Backend — archivos nuevos

| Ruta | Propósito |
|------|-----------|
| `src/config/validate-env.ts` | Validación de env vars al arranque |
| `src/shared/services/mail/interfaces/mail-provider.interface.ts` | Interface DIP |
| `src/shared/services/mail/providers/resend.provider.ts` | Implementación Resend |
| `src/shared/services/mail/providers/mock.provider.ts` | Implementación in-memory para tests |
| `src/shared/services/mail/mail.service.ts` | Servicio con templating + retry |
| `src/shared/services/mail/index.ts` | Singleton wiring |
| `src/shared/templates/emails/email-verification.html/txt` | Plantilla verificación |
| `src/shared/templates/emails/password-reset.html/txt` | Plantilla reset normal |
| `src/shared/templates/emails/oauth-reset-info.html/txt` | Plantilla reset OAuth |
| `src/shared/middlewares/rate-limit.middleware.ts` | Presets de rate limiting |
| `src/shared/middlewares/enforce-email-quota.middleware.ts` | Cap diario global |
| `src/shared/jobs/cleanup-zombie-accounts.cron.ts` | Cron horario |
| `src/modules/auth-tokens/*` | 4 archivos (interface, model, service, index) |
| `src/modules/email-logs/*` | 5 archivos (interface, 2 models, service, index) |
| `src/modules/audit-logs/*` | 4 archivos (interface, model, service, index) |

### Backend — archivos modificados

| Ruta | Cambio |
|------|--------|
| `.env` | 14 variables nuevas |
| `src/config/index.ts` | Bloques resend, emailVerification, passwordReset, rateLimit, zombieCleanup, urls |
| `src/server.ts` | `validateAuthEnv()` + `startZombieCleanupCron()` |
| `src/shared/middlewares/auth.middleware.ts` | Chequeo de `passwordChangedAt` + nuevos códigos |
| `src/modules/users/models/user.model.ts` | Campos `requiresEmailVerification` y `passwordChangedAt` + hook |
| `src/modules/users/interfaces/user.interface.ts` | Tipado de los nuevos campos |
| `src/modules/users/services/user.service.ts` | Captura E11000 + normalización de email + `existsByEmail` |
| `src/modules/users/controllers/auth.controller.ts` | Reescrito con 6 nuevos métodos |
| `src/modules/users/routes/auth.routes.ts` | 6 rutas nuevas + rate limit en todas las sensibles |

### Frontend — archivos nuevos

| Ruta | Propósito |
|------|-----------|
| `shared/validators/email-unique.validator.ts` | Validador async con debounce |
| `shared/components/forgot-password-modal/*` | 3 archivos (ts/html/scss) |
| `shared/components/email-not-found-modal/*` | 3 archivos |
| `shared/components/email-sent-modal/*` | 3 archivos |
| `shared/components/verify-email-pending-modal/*` | 3 archivos |
| `features/reset-password/*` | 3 archivos (página standalone) |
| `features/verify-email/*` | 3 archivos (página standalone) |

### Frontend — archivos modificados

| Ruta | Cambio |
|------|--------|
| `models/auth.model.ts` | 6 interfaces nuevas (forgot/reset/verify/check) |
| `core/services/auth.service.ts` | 7 métodos nuevos + control del modal forgot |
| `shared/components/auth-modal/auth-modal.component.{ts,html,scss}` | Link "¿Olvidaste?" + flujo verificación + validador async + reenvío |
| `shared/components/index.ts` | 4 exports nuevos |
| `layouts/components/header/header.component.{ts,html}` | Orquestación de los 4 modales |
| `layouts/pages/.../tubus-header/tubus-header.component.{ts,html}` | Misma orquestación en landing |
| `app.routes.ts` | Rutas `/reset-password` y `/verify-email` |

---

## Verificaciones técnicas finales

- ✅ `npx tsc --noEmit` (backend) — sin errores
- ✅ `npx tsc --noEmit -p tsconfig.app.json` (frontend) — sin errores
- ✅ Las 14 variables de entorno cargan con defaults seguros
- ✅ El validador al arranque rechaza configuraciones inválidas
- ✅ Cron registrado para correr cada hora en minuto 0

---

## Mejoras posteriores aplicadas

### 2026-04-29 — Logo en el header de los correos

**Solicitud del usuario:** *"al header del correo que se envía le puedes agregar el logo del proyecto?"*

**Implementación:**
- Copiado `frontend/src/assets/icons/autobus blanco.png` → `backend/src/shared/assets/email-logo.png` (10 KB)
- Extendida la interfaz `IMailProvider` con `attachments` opcionales (`MailAttachment` con `contentId` para CID)
- `ResendProvider.send()` mapea attachments al formato del SDK (`content_id` para inline)
- `MailService` carga el logo lazy + cachea en memoria. Adjunta como CID `tubus-logo` en cada envío
- Las 3 plantillas HTML ahora usan `<img src="cid:{{logoCid}}" alt="{{appName}}" width="72" height="72">` en el header
- Si el archivo del logo no existe, se loguea un warning y los correos se envían sin imagen (degradación grácil)

**Archivos tocados:**
| Archivo | Cambio |
|---------|--------|
| `backend/src/shared/assets/email-logo.png` | 🆕 nuevo (logo blanco sobre fondo azul) |
| `backend/src/shared/services/mail/interfaces/mail-provider.interface.ts` | Agregado `MailAttachment` y campo `attachments` |
| `backend/src/shared/services/mail/providers/resend.provider.ts` | Map de attachments a Resend SDK |
| `backend/src/shared/services/mail/mail.service.ts` | Carga logo + adjunto CID + helper `buildAttachments` |
| `backend/src/shared/templates/emails/email-verification.html` | Header con `<img src="cid:...">` |
| `backend/src/shared/templates/emails/password-reset.html` | Header con `<img src="cid:...">` |
| `backend/src/shared/templates/emails/oauth-reset-info.html` | Header con `<img src="cid:...">` |

**Decisión técnica:** se eligió **CID inline attachment** sobre URL pública porque:
1. No requiere hosting externo (Cloudinary, CDN, etc.)
2. Funciona en todos los clientes de correo sin bloqueo (Gmail, Outlook, Apple Mail)
3. El correo es autocontenido — sigue funcionando offline
4. No depende del estado de la red al renderizar

**Siguiente prueba:** reiniciar backend y disparar "olvidé contraseña" → el correo llegará con el logo en el header.

---

### 2026-04-29 — Dominio propio + correo de soporte configurable

**Solicitud del usuario:** registró el dominio `tubusexpress.com` en GoDaddy y configuró el correo `info@tubusexpress.com`. Pidió usarlo en el remitente y en la sección de información de los correos.

**Cambios técnicos:**
- Nueva env var `SUPPORT_EMAIL` (con fallback al `RESEND_FROM_EMAIL`).
- `config.resend.supportEmail` lee la variable.
- Eliminado hardcode `SUPPORT_EMAIL = 'soporte@tubusexpress.com'` de `mail.service.ts`.
- `MailService` constructor recibe `supportEmail` como tercer parámetro (DI).
- Singleton del wiring (`shared/services/mail/index.ts`) lo inyecta.

**Cambios de configuración:**
```env
RESEND_FROM_EMAIL=info@tubusexpress.com    # antes: onboarding@resend.dev
SUPPORT_EMAIL=info@tubusexpress.com        # nueva
```

**Archivos tocados:**
| Archivo | Cambio |
|---------|--------|
| `backend/.env` | `RESEND_FROM_EMAIL` actualizado + `SUPPORT_EMAIL` nueva |
| `backend/src/config/index.ts` | Bloque `resend.supportEmail` |
| `backend/src/shared/services/mail/mail.service.ts` | Parámetro DI + remoción de constante hardcoded |
| `backend/src/shared/services/mail/index.ts` | Wiring singleton actualizado |

**Nota importante:** este cambio solo será efectivo *después* de verificar el dominio `tubusexpress.com` en Resend (DNS records). Mientras esté pendiente, los envíos fallarán con error de dominio no verificado.

---

### 2026-04-30 — Logo en correos: refactor de CID a URL pública

**Problema detectado:** El usuario reportó logo roto en el correo recibido. Investigación reveló que **Resend NO soporta `content_id` para imágenes inline** (lo asumí incorrectamente al implementar la versión inicial). Sus attachments son siempre archivos descargables, nunca inline.

**Solución aplicada:**
1. Subido el logo a Cloudinary (carpeta `ecommerce/email-assets`) vía script `src/scripts/upload-email-logo.ts`.
2. URL pública resultante:
   `https://res.cloudinary.com/du0zutdnb/image/upload/v1777565961/ecommerce/email-assets/tubus-express-email-logo.png`
3. Nueva env var `EMAIL_LOGO_URL` (con fallback a string vacío).
4. `config.resend.logoUrl` lee la variable.
5. `MailService` recibe `logoUrl` como cuarto parámetro DI.
6. Plantillas HTML usan `{{#if hasLogo}}<img src="{{logoUrl}}">{{/if}}` (degradación grácil si la URL está vacía).
7. Eliminada la lógica de attachments con CID en `MailService` (ya no se usa).

**Archivos tocados:**
| Archivo | Cambio |
|---------|--------|
| `backend/src/scripts/upload-email-logo.ts` | 🆕 nuevo — script idempotente para (re)subir el logo |
| `backend/.env` | + `EMAIL_LOGO_URL=...` |
| `backend/src/config/index.ts` | + `resend.logoUrl` |
| `backend/src/shared/services/mail/mail.service.ts` | Constructor con `logoUrl`, removido `loadLogoBuffer`/`buildAttachments`, vars del template ahora incluyen `logoUrl` y `hasLogo` |
| `backend/src/shared/services/mail/index.ts` | Singleton inyecta `config.resend.logoUrl` |
| `backend/src/shared/templates/emails/*.html` (3 plantillas) | `<img src="cid:...">` → `{{#if hasLogo}}<img src="{{logoUrl}}">{{/if}}` |

**Decisión técnica:** Se eligió URL pública (Cloudinary) sobre CID por incompatibilidad de Resend. La interfaz `IMailProvider.attachments` se mantiene en su lugar para futuros providers (SendGrid sí lo soporta) o usos no-inline (PDFs, etc.).

**Mantenimiento futuro:** El logo en `backend/src/shared/assets/email-logo.png` ya no se usa en runtime (sólo lo lee el script de upload). Podría eliminarse, pero se mantiene para que el script siga funcionando sin requerir descarga.

---

## Acciones pendientes del usuario antes del primer uso real

1. **Crear cuenta en Resend:** https://resend.com
2. **Generar API key** y pegarla en `RESEND_API_KEY` del `.env`
3. **(Opcional) Verificar dominio propio** en Resend para usar `noreply@tubusexpress.com`
4. **Reiniciar el backend** para que cargue las nuevas variables de entorno
5. **Probar el flujo completo:**
   - Registro normal (verificación off)
   - Cambiar `EMAIL_VERIFICATION_REQUIRED=true` y reiniciar
   - Registro con verificación
   - Olvidé contraseña (los 3 escenarios)
   - Verificar que JWT viejos quedan inválidos tras reset

---
