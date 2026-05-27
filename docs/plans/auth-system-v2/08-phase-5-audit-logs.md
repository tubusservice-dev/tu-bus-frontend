# Fase 5 — Audit logs

**Objetivo:** trazabilidad completa de eventos sensibles del sistema de autenticación y administración.

---

## Eventos del enum `AuthAuditEvent`

### Conservados

- `LOGIN_ATTEMPT`
- `PASSWORD_RESET_REQUESTED`
- `PASSWORD_RESET_COMPLETED`
- `EMAIL_VERIFICATION_REQUESTED`
- `EMAIL_VERIFICATION_COMPLETED`
- `PASSWORD_CHANGED_VIA_PROFILE`
- `ZOMBIE_CLEANUP_RUN`

### Nuevos

| Evento | Cuándo se dispara | Metadata |
|--------|-------------------|----------|
| `LOGOUT` | Usuario hace logout (vía endpoint). | `{ }` |
| `ACCOUNT_LINK_REQUESTED` | `POST /auth/link-account` exitoso. | `{ source: 'register' }` |
| `ACCOUNT_LINK_COMPLETED` | `POST /auth/verify-account-link` exitoso. | `{ }` |
| `ADMIN_BLOCKED_USER` | Admin cambia status a SUSPENDED/BLOCKED. | `{ adminId, oldStatus, newStatus, reason, suspendedUntil? }` |
| `ADMIN_DELETED_USER` | Admin elimina (status=DELETED). | `{ adminId }` |
| `ADMIN_FORCE_LOGOUT` | Admin invoca force-logout. | `{ adminId }` |

### Eliminados

- `OAUTH_ACCOUNT_PASSWORD_SET` — ya no aplica con flujo unificado.

---

## Modificaciones requeridas

### `backend/src/modules/audit-logs/interfaces/auth-audit-log.interface.ts`

Actualizar el enum.

### `backend/src/modules/admin/services/admin-user.service.ts`

- En `updateStatus`:
  ```ts
  await authAuditLogService.record({
    event: AuthAuditEvent.ADMIN_BLOCKED_USER,
    userId: id as any,
    email: user.email,
    success: true,
    metadata: {
      adminId,
      oldStatus: previousStatus,
      newStatus: dto.status,
      reason: dto.reason,
      suspendedUntil: dto.suspendedUntil,
    },
  });
  ```
- En `delete`:
  ```ts
  await authAuditLogService.record({
    event: AuthAuditEvent.ADMIN_DELETED_USER,
    userId: id as any,
    email: user.email,
    success: true,
    metadata: { adminId },
  });
  ```

Para registrar el `oldStatus` previamente, modificar el método para hacer `findById` antes del `findByIdAndUpdate`.

### `backend/src/modules/admin/controllers/admin-user.controller.ts`

- En `forceLogout`: ya cubierto en Fase 1.8.

### `backend/src/modules/users/controllers/auth.controller.ts`

- En `logout`: emitir `LOGOUT`.
- En `linkAccount`: emitir `ACCOUNT_LINK_REQUESTED`.
- En `verifyAccountLink`: emitir `ACCOUNT_LINK_COMPLETED`.

---

## Validación de Fase 5

1. Smoke tests: cada acción admin / user genera el evento esperado en `AuthAuditLog`.
2. Verificar query en MongoDB: `db.authauditlogs.find({ event: 'admin_blocked_user' })` retorna entradas con metadata correcta.
