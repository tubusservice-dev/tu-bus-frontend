# Fase 6 — Verificación final

**Objetivo:** validar end-to-end y dejar el panel Problems vacío.

---

## Checklist de tests E2E

### Caso 1 — Registro Google

- [ ] Click "Iniciar con Google" → flujo OAuth → callback → redirect a `/perfil?completeProfile=true`.
- [ ] Modal "completa tus datos" abierto.
- [ ] Cerrar modal con ✕ → puedo navegar al catálogo.
- [ ] Banner "Completa tu perfil" persistente.
- [ ] Completar form → modal cierra → `profileCompleted: true` en backend (verify in DB).

### Caso 1 — Email ya registrado localmente

- [ ] Crear cuenta local con `juan@gmail.com`.
- [ ] Logout.
- [ ] Click "Iniciar con Google" eligiendo `juan@gmail.com`.
- [ ] Recibido en `/auth/callback?error=EMAIL_ALREADY_REGISTERED_LOCAL`.
- [ ] Mensaje claro al usuario.

### Caso 2 — Registro Email (con verificación)

- [ ] Setear `EMAIL_VERIFICATION_REQUIRED=true`.
- [ ] Registro nuevo → email enviado → modal "verificación pendiente" abre.
- [ ] Click link en correo → `/verify-email?token=...` → success.
- [ ] Click "Continuar" → `/` con auth modal en login.
- [ ] Login OK.

### Caso 2 — Registro Email (sin verificación)

- [ ] `EMAIL_VERIFICATION_REQUIRED=false`.
- [ ] Registro nuevo → auto-login.

### Caso 3 — Vinculación de cuenta

- [ ] User Google-only existente: `juan@gmail.com`.
- [ ] Logout.
- [ ] Abrir registro local con email `juan@gmail.com` → submit → email enviado.
- [ ] Click link → `/verify-account-link?token=...` → success → auto-login.
- [ ] Verify in DB: `googleId` mantenido, `password` añadido, `profileCompleted` recalculado.

### Caso 4 — Forgot password normal

- [ ] User local existente.
- [ ] Forgot password → email recibido.
- [ ] Click link → reset → password actualizado.
- [ ] JWT previo invalidado (`passwordChangedAt`).

### Caso 5 — Forgot password Google-only

- [ ] User Google-only.
- [ ] Forgot password → frontend NO recibe email.
- [ ] Modal de registro abre con email precargado en modo `linkAccount`.
- [ ] Submit → flujo Caso 3.

### Logout robusto

- [ ] Login normal → JWT válido.
- [ ] Logout → llamada a backend.
- [ ] Intentar request con JWT antiguo → 401 `TOKEN_REVOKED`.

### Bloqueo admin

- [ ] User con sesión activa.
- [ ] Admin bloquea cuenta.
- [ ] Siguiente request del user → 403 `ACCOUNT_BLOCKED` o 401 `TOKEN_REVOKED`.
- [ ] Tokens de password-reset activos invalidados (verify in DB).

### Force-logout admin

- [ ] User con sesión activa.
- [ ] Admin invoca force-logout.
- [ ] Siguiente request del user → 401 `TOKEN_REVOKED`.
- [ ] User puede volver a hacer login normalmente.

---

## Checklist de calidad de código

### Backend

- [ ] `npm run build` sin warnings.
- [ ] Búsqueda de `as any` en archivos auth-related: solo casos justificados (ObjectId casts permanecen como `as Types.ObjectId`).
- [ ] WebStorm Problems panel vacío en backend auth scope.

### Frontend

- [ ] `ng build` sin warnings.
- [ ] Búsqueda de `'../../'` en archivos auth-related: 0 hits.
- [ ] WebStorm Problems panel vacío en frontend auth scope.
- [ ] Path aliases consistentes en todos los imports nuevos.

### Documentación

- [ ] Carpeta `docs/plans/auth-system-v2/` completa con los 10 archivos.
- [ ] Archivos antiguos `docs/plans/auth-system/` se conservan como histórico (no se borran).

---

## Archivos eliminados (resumen)

| Archivo | Razón |
|---------|-------|
| `backend/src/shared/templates/emails/oauth-reset-info.html` | Plantilla obsoleta. |
| `backend/src/shared/templates/emails/oauth-reset-info.txt` | Plantilla obsoleta. |

## Archivos creados (resumen)

### Backend

- `backend/src/scripts/migrate-auth-system-v2.ts`
- `backend/src/types/express.d.ts`
- `backend/src/shared/templates/emails/account-link-verification.html`
- `backend/src/shared/templates/emails/account-link-verification.txt`

### Frontend

- `frontend/src/app/shared/components/complete-profile-modal/` (3 archivos)
- `frontend/src/app/shared/components/account-link-pending-modal/` (3 archivos)
- `frontend/src/app/features/verify-account-link/` (3 archivos)

### Documentación

- `docs/plans/auth-system-v2/` (10 archivos markdown).
