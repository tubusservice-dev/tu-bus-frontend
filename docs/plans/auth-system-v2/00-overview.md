# Auth System v2 — Plan Maestro

**Proyecto:** TuBus Express
**Fecha de creación:** 2026-05-07
**Estado:** En implementación

---

## Resumen ejecutivo

Refactor del sistema de autenticación para resolver inconsistencias estructurales entre flujos local y OAuth, blindar la seguridad (eliminación de auto-vinculación silenciosa, logout server-side robusto, invalidación de tokens en bloqueo), unificar el flujo de recuperación de contraseña y permitir vinculación segura de cuentas Google con password mediante verificación por email.

---

## Casos de uso cubiertos

### Caso 1 — Registro por Google
- Registro directo con cuenta Google (datos básicos: email, nombre, apellido, avatar).
- `isVerified: true` automático (Google ya verificó el email).
- `profileCompleted: false` hasta que el usuario complete sus datos.
- Tras callback OAuth, redirección a `/perfil` con `?completeProfile=true`.
- Modal **dismissable** "Completa tus datos personales" en el perfil. Si el usuario lo cierra, puede navegar libremente. Solo se le exige completar al iniciar un flujo de compra.

### Caso 2 — Registro por Email + Password
- Validación completa al registrarse (datos personales, documento, teléfono, fecha de nacimiento).
- Si `EMAIL_VERIFICATION_REQUIRED=true`: envío de correo de verificación, sin auto-login. Modal "revisa tu correo".
- Click al link → página `/verify-email` → muestra confirmación → botón "Continuar" → cierra y abre modal de login.
- Si `EMAIL_VERIFICATION_REQUIRED=false`: auto-login inmediato (decisión del operador).

### Caso 3 — Registro Email/Password sobre cuenta Google existente
**Implementado vía vinculación verificada por email (Opción A).**
- Si el email ya existe como cuenta Google-only (sin password) y el usuario intenta registrarse con email/password, el endpoint `POST /auth/link-account` detecta el caso.
- Backend asigna password (hasheado) sobre el user existente, fusiona campos del payload con datos previos y emite token de vinculación con `purpose: ACCOUNT_LINK_VERIFICATION`.
- Email enviado: "Vincula tu cuenta de Google con tu nueva contraseña".
- Click al link → página `/verify-account-link` → backend marca `isVerified: true` (idempotente), recalcula `profileCompleted` y emite JWT (auto-login).
- Modal "¡Cuenta vinculada y verificada!" con botón "Continuar" que devuelve al usuario donde estaba.

### Caso 4 — Olvido de contraseña (cuenta normal)
- Usuario con password (local o dual) → email "Restablece tu contraseña".
- Sin cambios estructurales respecto al sistema actual.

### Caso 5 — Olvido de contraseña (cuenta Google-only)
- Si el sistema detecta `email registrado como Google-only`, NO envía correo.
- Frontend cierra el modal de "olvidé contraseña" y abre el modal de registro con el email **precargado** y en modo `linkAccount`.
- A partir de ahí, el usuario sigue el flujo del Caso 3.

---

## Decisiones cerradas

| ID | Decisión |
|----|----------|
| D1 | `profileCompleted=false` permite navegación libre. Bloqueo solo en flujo de compra. |
| D2 | Modal "completar perfil" tras OAuth es **dismissable** (✕ visible). |
| D3 | Caso 3 implementado vía **vinculación verificada por email** (Opción A). |
| D4 | Auto-vinculación silenciosa OAuth-by-email **eliminada**. |
| D5 | Logout robusto vía `tokensInvalidatedAt` server-side. |
| D6a | Bloqueo/eliminación admin invalida JWTs activos + auth-tokens activos. |
| D6b | **Sí** se implementa endpoint admin `force-logout` (no bloquea, solo invalida sesión). |
| D6c | **No** se implementa hard-delete programado. DELETED queda como soft-delete persistente. |
| D7 | Eliminar `username` y `facebookId` del schema con migration en DEV y QA. |
| D8 | `profileCompleted` se popula vía script: users con campos completos → `true`. |
| D9 | Forgot-password Google-only NO envía correo: deriva a modal de registro con email precargado (flujo Caso 3). |
| D10 | `EMAIL_VERIFICATION_REQUIRED` es decisión del operador. |
| D11 | Plantilla `oauth-reset-info` y enum `OAUTH_RESET_INFO` se eliminan. |

---

## Estructura de la documentación

| Archivo | Contenido |
|---------|-----------|
| `00-overview.md` | Este archivo. |
| `01-data-model.md` | Cambios en schemas Mongo. |
| `02-environment-variables.md` | Variables ENV nuevas y conservadas. |
| `03-phase-0-migration.md` | Migración del schema y datos. |
| `04-phase-1-backend.md` | Refactor de flujos backend. |
| `05-phase-2-type-cleanup.md` | Eliminación de `as any` y warnings. |
| `06-phase-3-frontend-aliases.md` | Migración a path aliases. |
| `07-phase-4-frontend-components.md` | Implementación de los casos en Angular. |
| `08-phase-5-audit-logs.md` | Eventos nuevos del audit log. |
| `09-phase-6-verification.md` | Tests E2E y verificación final. |

---

## Reglas de calidad (no negociables)

1. **Cero warnings** en WebStorm Problems panel al cerrar cada fase.
2. **Path aliases obligatorios** en frontend (`@core`, `@shared`, `@features`, `@layouts`, `@models`, `@env`).
3. **Comentarios en código en inglés**, documentación markdown en español.
4. **No comentarios "qué hace el código"** — solo el "porqué" cuando no es obvio.
5. **Archivos < 1000 líneas**: si crece, dividir por responsabilidad.
6. **SOLID, DRY, KISS** aplicados rigurosamente.
7. **No emojis** en código fuente (sí en documentación si aporta claridad).
