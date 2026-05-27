# Arquitectura y Modelos de Datos

> Decisiones arquitectónicas, modelos de BD nuevos y modificaciones al modelo `User` existente.

---

## 1. Principios arquitectónicos aplicados

### SOLID
- **S (Single Responsibility):** Cada servicio nuevo tiene una sola razón para cambiar (mail, tokens, audit).
- **O (Open/Closed):** El proveedor de correo se inyecta vía interfaz (`IMailProvider`) — agregar SendGrid/SES más adelante no requiere tocar código existente.
- **L (Liskov Substitution):** Cualquier `IMailProvider` puede sustituir a otro sin romper consumidores.
- **I (Interface Segregation):** El `IMailProvider` expone solo `send()`, no obliga a implementar funcionalidades irrelevantes.
- **D (Dependency Inversion):** Los servicios dependen de la abstracción `IMailProvider`, no de Resend directamente.

### DRY
- Un único modelo `AuthToken` con campo discriminador `purpose` para verificación y reset (en lugar de dos modelos).
- Una sola plantilla base de correo HTML, con bloques específicos por tipo.

### KISS
- No introducir cola de mensajes (BullMQ/agenda) por ahora — envío síncrono es suficiente para el volumen actual.
- No implementar JWT refresh tokens en este sprint (aunque se documenta como mejora futura).

---

## 2. Decisiones técnicas clave

### 2.1. Hashing de tokens
Los tokens de verificación y reset **se almacenan hasheados con SHA-256**. Razón: si la BD se filtra, los tokens no son utilizables (igual que las contraseñas).

```typescript
// Pseudo-código del flujo
const rawToken = crypto.randomBytes(32).toString('hex');  // 256 bits
const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

// Se guarda tokenHash en BD
// Se envía rawToken al usuario (en el link del correo)

// Al validar:
// hash el token recibido y comparar con el guardado
```

### 2.2. TTL automático en MongoDB
El campo `expiresAt` en `AuthToken` tiene TTL index (`expireAfterSeconds: 0`). MongoDB elimina automáticamente los documentos cuya `expiresAt` ya pasó. **No requiere cron**.

### 2.3. Invalidación de JWT vía `passwordChangedAt`
Hoy, los JWT son válidos hasta su `exp` natural. No hay forma de revocarlos. La solución elegida (sin introducir refresh tokens):

```typescript
// Al cambiar contraseña:
user.passwordChangedAt = new Date();

// En el middleware authenticate:
if (jwtPayload.iat * 1000 < user.passwordChangedAt.getTime()) {
  throw new AppError('Token revocado por cambio de contraseña');
}
```

Esto invalida **todos** los JWT emitidos antes del cambio de contraseña.

### 2.4. Inyección de dependencias del proveedor de correo
El `MailService` se construye con un `IMailProvider`. En `app.ts` (o similar) se hace el wiring:

```typescript
const mailProvider = new ResendProvider(config.resend.apiKey);
const mailService = new MailService(mailProvider, config.resend.fromEmail);
```

Para tests, se inyecta un `MockMailProvider` que captura los envíos sin tocar la red.

### 2.5. Anti-enumeración con excepción documentada
El estándar OWASP recomienda mostrar el mismo mensaje siempre en "olvidé contraseña". **El usuario eligió** mostrar "no hay cuenta asociada, ¿registrarte?" cuando el correo no existe. Esta excepción se compensa con:
- Rate limiting estricto en `/forgot-password`
- Auditoría de cada intento
- Mismo modal genérico para correos OAuth (donde sí aplica anti-enumeración)

---

## 3. Modelos de BD nuevos

### 3.1. `AuthToken`

**Archivo:** `backend/src/modules/auth-tokens/models/auth-token.model.ts`

**Schema:**

| Campo | Tipo | Notas |
|-------|------|-------|
| `userId` | `ObjectId` (ref: User) | Required, indexed |
| `tokenHash` | `String` | Required, indexed (no `unique`, ver razón abajo) |
| `purpose` | `enum: 'email_verification' \| 'password_reset'` | Required, indexed |
| `expiresAt` | `Date` | Required, **TTL index** |
| `usedAt` | `Date \| null` | null mientras esté disponible |
| `ipAddress` | `String` | Capturado al crearse |
| `userAgent` | `String` | Capturado al crearse |
| `createdAt` | `Date` | Auto |

**Índices:**
- `{ tokenHash: 1, purpose: 1 }` — búsqueda al validar
- `{ userId: 1, purpose: 1 }` — búsqueda para invalidar tokens previos
- `{ expiresAt: 1 }` con `expireAfterSeconds: 0` — TTL

**Por qué `tokenHash` no es `unique`:** colisiones SHA-256 son matemáticamente imposibles, pero un mismo usuario puede generar varios tokens al pedir reset varias veces. Solo invalidamos los previos al consumir uno.

### 3.2. `EmailLog`

**Archivo:** `backend/src/modules/email-logs/models/email-log.model.ts`

**Propósito:** Registrar cada correo enviado. Permite (a) auditar, (b) calcular el cap diario consultando los enviados en las últimas 24h.

**Schema:**

| Campo | Tipo | Notas |
|-------|------|-------|
| `to` | `String` | Lowercase, indexed |
| `purpose` | `enum: 'email_verification' \| 'password_reset' \| 'oauth_reset_info'` | Indexed |
| `subject` | `String` | Para auditoría |
| `status` | `enum: 'sent' \| 'failed' \| 'rate_limited'` | Indexed |
| `errorMessage` | `String?` | Si `status: 'failed'` |
| `userId` | `ObjectId?` (ref: User) | Si aplica |
| `ipAddress` | `String` | IP del request originador |
| `createdAt` | `Date` | **Indexed** (para query del cap diario) |

**Índices:**
- `{ createdAt: -1 }` — query del cap diario
- `{ to: 1, purpose: 1, createdAt: -1 }` — query del cap por usuario

### 3.3. `EmailQuotaAlert`

**Archivo:** `backend/src/modules/email-logs/models/email-quota-alert.model.ts`

**Propósito:** Cada vez que se alcanza el cap diario global, registrar una alerta. Útil para detectar abuso o necesidad de upgrade del plan de Resend.

**Schema:**

| Campo | Tipo | Notas |
|-------|------|-------|
| `triggeredAt` | `Date` | Auto |
| `dailyCap` | `Number` | Valor de `MAX_EMAILS_PER_DAY_GLOBAL` al momento de la alerta |
| `emailsSentInWindow` | `Number` | Cantidad real al momento de la alerta |
| `windowStart` | `Date` | Inicio de la ventana de 24h |
| `windowEnd` | `Date` | Fin de la ventana de 24h |

### 3.4. `AuthAuditLog`

**Archivo:** `backend/src/modules/audit-logs/models/auth-audit-log.model.ts`

**Propósito:** Registrar eventos sensibles de seguridad. Útil ante un incidente.

**Schema:**

| Campo | Tipo | Notas |
|-------|------|-------|
| `event` | `enum` | Ver lista de eventos abajo |
| `userId` | `ObjectId?` (ref: User) | Si aplica |
| `email` | `String?` | Para eventos donde no hay user (login fallido, reset de email no existente) |
| `ipAddress` | `String` | |
| `userAgent` | `String` | |
| `success` | `Boolean` | |
| `metadata` | `Object` | Flexible para contexto adicional |
| `createdAt` | `Date` | Auto, indexed |

**Eventos auditados:**
- `login_attempt` (success/fail)
- `password_reset_requested` (incluye casos de email inexistente)
- `password_reset_completed`
- `email_verification_requested`
- `email_verification_completed`
- `password_changed_via_profile` (cambio voluntario)
- `oauth_account_password_set` (cuenta híbrida creada)

---

## 4. Modificaciones al modelo `User` existente

**Archivo:** `backend/src/modules/users/models/user.model.ts`

### 4.1. Campos nuevos

| Campo | Tipo | Default | Notas |
|-------|------|---------|-------|
| `passwordChangedAt` | `Date?` | `undefined` | Se setea al cambiar contraseña. El middleware `authenticate` invalida JWT con `iat < passwordChangedAt` |
| `requiresEmailVerification` | `Boolean` | depende de env | Snapshot al registrarse. Si `true`, el usuario debe verificar antes de poder usar el sistema |

### 4.2. Lógica del campo `requiresEmailVerification`

```
Al registrarse (POST /register):
  user.requiresEmailVerification = process.env.EMAIL_VERIFICATION_REQUIRED === 'true'
  user.isVerified = false  // ya existía, no cambia

Al verificar correo (POST /verify-email):
  user.isVerified = true
  user.requiresEmailVerification = false  // ya cumplió

Al hacer login (POST /login):
  if (user.requiresEmailVerification && !user.isVerified) {
    throw new AppError('Debes verificar tu correo electrónico', 403, {
      code: 'EMAIL_NOT_VERIFIED'
    });
  }
```

**Nota crítica:** Cambiar la variable env **NO afecta** a usuarios existentes. Su valor de `requiresEmailVerification` quedó congelado al momento del registro.

### 4.3. Interfaz `IUser` actualizada

```typescript
export interface IUser extends Document {
  // ... campos existentes ...
  passwordChangedAt?: Date;
  requiresEmailVerification: boolean;  // default false
  // ...
}
```

### 4.4. Migración de datos

Los usuarios existentes en BD no tienen estos campos. Al desplegar:
- `passwordChangedAt` → `undefined` (válido — los JWT actuales siguen siendo válidos hasta su `exp` natural).
- `requiresEmailVerification` → default a `false` (grandfathered: nadie pre-existente debe verificar).

**Script de migración** (opcional, no obligatorio): `backend/src/scripts/migrate-add-auth-fields.ts` que setea `requiresEmailVerification: false` explícitamente en todos los usuarios existentes.

---

## 5. Estructura de carpetas resultante

### Backend

```
backend/src/
├── config/
│   └── index.ts                              ← agregar resend, mail, rateLimit configs
├── shared/
│   ├── services/
│   │   └── mail/
│   │       ├── interfaces/
│   │       │   └── mail-provider.interface.ts
│   │       ├── providers/
│   │       │   ├── resend.provider.ts
│   │       │   └── mock.provider.ts          ← para tests
│   │       └── mail.service.ts
│   ├── templates/
│   │   └── emails/
│   │       ├── base.html                     ← layout común
│   │       ├── email-verification.html
│   │       ├── password-reset.html
│   │       └── oauth-reset-info.html
│   ├── middlewares/
│   │   ├── auth.middleware.ts                ← MODIFICAR (chequear passwordChangedAt)
│   │   └── rate-limit.middleware.ts          ← NUEVO
│   └── jobs/
│       └── cleanup-zombie-accounts.cron.ts   ← NUEVO
└── modules/
    ├── auth-tokens/                          ← NUEVO
    │   ├── interfaces/auth-token.interface.ts
    │   ├── models/auth-token.model.ts
    │   ├── services/auth-token.service.ts
    │   └── index.ts
    ├── email-logs/                           ← NUEVO
    │   ├── interfaces/...
    │   ├── models/email-log.model.ts
    │   ├── models/email-quota-alert.model.ts
    │   ├── services/email-log.service.ts
    │   └── index.ts
    ├── audit-logs/                           ← NUEVO
    │   ├── interfaces/...
    │   ├── models/auth-audit-log.model.ts
    │   ├── services/auth-audit-log.service.ts
    │   └── index.ts
    └── users/
        ├── controllers/auth.controller.ts    ← MODIFICAR
        ├── routes/auth.routes.ts             ← MODIFICAR (nuevas rutas + rate limit)
        ├── services/user.service.ts          ← MODIFICAR (E11000 capture)
        ├── models/user.model.ts              ← MODIFICAR (nuevos campos)
        └── interfaces/user.interface.ts      ← MODIFICAR
```

### Frontend

```
frontend/src/app/
├── core/
│   └── services/
│       └── auth.service.ts                   ← MODIFICAR (nuevos métodos)
├── features/
│   ├── reset-password/                       ← NUEVO
│   │   ├── reset-password.component.ts
│   │   ├── reset-password.component.html
│   │   └── reset-password.component.scss
│   └── verify-email/                         ← NUEVO
│       ├── verify-email.component.ts
│       ├── verify-email.component.html
│       └── verify-email.component.scss
├── shared/
│   ├── components/
│   │   ├── auth-modal/                       ← MODIFICAR
│   │   ├── forgot-password-modal/            ← NUEVO
│   │   ├── email-not-found-modal/            ← NUEVO
│   │   ├── email-sent-modal/                 ← NUEVO
│   │   └── verify-email-pending-modal/       ← NUEVO
│   └── validators/
│       └── email-unique.validator.ts         ← NUEVO
└── app.routes.ts                             ← MODIFICAR (nuevas rutas)
```

---

## 6. Configuración (`config/index.ts`)

Bloques nuevos. **Todos los valores leen desde variables de entorno con defaults seguros.**

```typescript
const clientUrl = process.env.CLIENT_URL || 'http://localhost:4200';

export const config = {
  // ... existente ...

  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    fromEmail: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
  },

  emailVerification: {
    required: process.env.EMAIL_VERIFICATION_REQUIRED === 'true',
    tokenTTLMinutes: parseInt(
      process.env.EMAIL_VERIFICATION_TOKEN_TTL_MINUTES || '60', 10
    ),
  },

  passwordReset: {
    tokenTTLMinutes: parseInt(
      process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES || '30', 10
    ),
  },

  rateLimit: {
    passwordResetRetries: parseInt(
      process.env.MAX_PASSWORD_RESET_RETRIES || '3', 10
    ),
    passwordResetRetriesResetHours: parseInt(
      process.env.PASSWORD_RESET_RETRIES_RESET_HOURS || '24', 10
    ),
    verificationResendRetries: parseInt(
      process.env.MAX_VERIFICATION_RESEND_RETRIES || '3', 10
    ),
    verificationResendRetriesResetHours: parseInt(
      process.env.VERIFICATION_RESEND_RETRIES_RESET_HOURS || '24', 10
    ),
    emailsPerDayGlobal: parseInt(
      process.env.MAX_EMAILS_PER_DAY_GLOBAL || '90', 10
    ),
  },

  zombieCleanup: {
    afterHours: parseInt(
      process.env.ZOMBIE_ACCOUNT_CLEANUP_AFTER_HOURS || '24', 10
    ),
  },

  urls: {
    resetPassword: process.env.RESET_PASSWORD_URL || `${clientUrl}/reset-password`,
    verifyEmail: process.env.VERIFY_EMAIL_URL || `${clientUrl}/verify-email`,
  },
};
```

**Notas:**
- Cada parsing está acompañado por validación al arranque (ver `04-environment-variables.md` sección 4).
- Nada está hardcodeado. Cambiar el `.env` y reiniciar el server reconfigura todo el comportamiento.

---

## 7. Resumen de archivos nuevos vs modificados

**Backend:**
- 🆕 ~22 archivos nuevos
- ✏️ ~6 archivos modificados

**Frontend:**
- 🆕 ~14 archivos nuevos
- ✏️ ~3 archivos modificados

Detalle exacto en `07-implementation-phases.md`.

---

**Documento siguiente:** [`02-detailed-flows.md`](./02-detailed-flows.md) — diagramas paso a paso de cada flujo.
