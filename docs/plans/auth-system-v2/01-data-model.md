# Modelo de datos — Auth System v2

---

## Schema `User` — cambios

### Campos añadidos

| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `profileCompleted` | `Boolean` | `false` | Indica si el usuario completó sus datos personales obligatorios. Se recalcula automáticamente en pre-save hook. Indexed. |
| `tokensInvalidatedAt` | `Date?` | `undefined` | Fecha de invalidación masiva de JWTs. El middleware `authenticate` rechaza tokens con `iat < tokensInvalidatedAt`. Se actualiza al hacer logout, al bloquear/eliminar la cuenta, o al ejecutar `force-logout` admin. |

### Campos eliminados

| Campo | Razón |
|-------|-------|
| `username` | Nunca poblado por ningún flujo. Campo zombie. |
| `facebookId` | Facebook OAuth nunca se implementó. Contamina queries con condiciones inútiles. |

### Hook pre-save: cálculo de `profileCompleted`

```ts
// Inside userSchema.pre('save')
this.profileCompleted = !!(
  this.documentType &&
  this.documentNumber &&
  this.phone &&
  (
    (this.documentType === 'J' && this.companyName) ||
    (this.documentType !== 'J' && this.birthDate)
  )
);
```

**Justificación:** la regla equivale a la validación de registro local (`registerValidation` en `auth.routes.ts`). Si un user OAuth completa estos campos vía `/users/profile`, el flag se actualiza automáticamente.

---

## Schema `AuthToken` — cambios

### Enum `AuthTokenPurpose`

```ts
export enum AuthTokenPurpose {
  EMAIL_VERIFICATION = 'email_verification',
  PASSWORD_RESET = 'password_reset',
  ACCOUNT_LINK_VERIFICATION = 'account_link_verification', // NUEVO
}
```

**Sin cambios estructurales en el schema** — la nueva purpose reusa toda la infraestructura existente (TTL, hash SHA-256, consumo atómico, invalidación masiva).

---

## Schema `EmailLog` — cambios

### Enum `EmailPurpose`

```ts
export enum EmailPurpose {
  EMAIL_VERIFICATION = 'email_verification',
  PASSWORD_RESET = 'password_reset',
  ACCOUNT_LINK_VERIFICATION = 'account_link_verification', // NUEVO
  // OAUTH_RESET_INFO eliminado
}
```

---

## Schema `AuthAuditLog` — cambios

### Enum `AuthAuditEvent`

```ts
export enum AuthAuditEvent {
  LOGIN_ATTEMPT = 'login_attempt',
  LOGOUT = 'logout',                                              // NUEVO
  PASSWORD_RESET_REQUESTED = 'password_reset_requested',
  PASSWORD_RESET_COMPLETED = 'password_reset_completed',
  EMAIL_VERIFICATION_REQUESTED = 'email_verification_requested',
  EMAIL_VERIFICATION_COMPLETED = 'email_verification_completed',
  PASSWORD_CHANGED_VIA_PROFILE = 'password_changed_via_profile',
  ACCOUNT_LINK_REQUESTED = 'account_link_requested',              // NUEVO
  ACCOUNT_LINK_COMPLETED = 'account_link_completed',              // NUEVO
  ADMIN_BLOCKED_USER = 'admin_blocked_user',                      // NUEVO
  ADMIN_DELETED_USER = 'admin_deleted_user',                      // NUEVO
  ADMIN_FORCE_LOGOUT = 'admin_force_logout',                      // NUEVO
  ZOMBIE_CLEANUP_RUN = 'zombie_cleanup_run',
  // OAUTH_ACCOUNT_PASSWORD_SET eliminado (fusionado en flujo de reset)
}
```

---

## Migración de datos

Ejecutada por `backend/src/scripts/migrate-auth-system-v2.ts`.

### Operaciones (en orden)

1. **Recalcular `profileCompleted`** para cada User existente:
   - Match por la regla del pre-save hook.
   - `bulkWrite` para eficiencia.
2. **`$unset` masivo** de `username` y `facebookId` en todos los documentos.
3. **Drop de índices** `username_1` y `facebookId_1` (si existen).
4. **Log de resumen** con totales y conteos por categoría.

### Ejecución

```bash
npm run migrate:auth-v2
```

Aplicar en **DEV** primero, luego en **QA**. Producción no aplica (aún no desplegado).

---

## Modelo Frontend (`@models/user.model.ts`)

```ts
export interface User {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  birthDate?: string;
  documentType?: DocumentType;
  documentNumber?: string;
  phone?: string;
  alternativePhone?: string;
  // ...address fields
  companyName?: string;
  companyRif?: string;
  role: UserRole;
  isVerified: boolean;
  profileCompleted: boolean;       // NUEVO
  createdAt: Date;
  // username eliminado
}
```
