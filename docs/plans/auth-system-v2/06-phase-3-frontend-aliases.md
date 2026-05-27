# Fase 3 — Path aliases en frontend

**Objetivo:** alinear todos los archivos auth-related con la convención de path aliases del proyecto.

---

## Aliases declarados (`tsconfig.json`)

```json
"paths": {
  "@core/*":     ["src/app/core/*"],
  "@shared/*":   ["src/app/shared/*"],
  "@features/*": ["src/app/features/*"],
  "@layouts/*":  ["src/app/layouts/*"],
  "@models/*":   ["src/app/models/*"],
  "@models":     ["src/app/models"],
  "@env/*":      ["src/environments/*"],
  "@env":        ["src/environments/environment"]
}
```

---

## Archivos a migrar

### Servicios y guards

- `frontend/src/app/core/services/auth.service.ts`
- `frontend/src/app/core/services/user.service.ts`
- `frontend/src/app/core/services/admin-user.service.ts`
- `frontend/src/app/core/guards/auth.guard.ts`
- `frontend/src/app/core/interceptors/auth.interceptor.ts`

### Componentes

- `frontend/src/app/shared/components/auth-modal/auth-modal.component.ts`
- `frontend/src/app/shared/components/forgot-password-modal/forgot-password-modal.component.ts`
- `frontend/src/app/shared/components/verify-email-pending-modal/verify-email-pending-modal.component.ts`
- `frontend/src/app/shared/components/email-not-found-modal/email-not-found-modal.component.ts`
- `frontend/src/app/shared/components/email-sent-modal/email-sent-modal.component.ts`
- `frontend/src/app/features/auth-callback/auth-callback.component.ts`
- `frontend/src/app/features/verify-email/verify-email.component.ts`
- `frontend/src/app/features/reset-password/reset-password.component.ts`
- `frontend/src/app/features/profile/profile.component.ts`
- `frontend/src/app/features/profile/profile-info/profile-info.component.ts`

### Componentes nuevos (de Fase 4)

Los nuevos archivos creados en Fase 4 nacen ya con path aliases.

---

## Reglas de migración

| Patrón actual | Reemplazo |
|---------------|-----------|
| `'../../../environments/environment'` | `'@env'` |
| `'../../../core/services'` | `'@core/services'` |
| `'../../../core/services/auth.service'` | `'@core/services/auth.service'` |
| `'../../models'` | `'@models'` |
| `'../../models/auth.model'` | `'@models/auth.model'` |
| `'../../shared/components/...'` | `'@shared/components/...'` |
| `'../../../features/...'` | `'@features/...'` |

---

## Validación de Fase 3

1. `ng build` exitoso sin warnings.
2. Búsqueda de `'../../'` en archivos migrados → 0 hits.
3. WebStorm Problems panel vacío.
