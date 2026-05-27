# Sistema de Autenticación — Resumen Ejecutivo

> **Documento maestro.** Este documento es la entrada principal a la planificación del sistema de autenticación. Léelo primero — los demás documentos profundizan en cada área.

---

## 1. Contexto

El proyecto **TuBus Express** cuenta hoy con un sistema de login funcional pero incompleto:

- ✅ Login local con JWT (clientes y admin separados)
- ✅ OAuth con Google y Facebook
- ✅ Registro con validación de campos
- ❌ Sin recuperación de contraseña ("olvidé mi contraseña")
- ❌ Sin verificación de correo electrónico al registrarse
- ❌ Sin sistema de envío de correos
- ❌ Sin rate limiting en endpoints sensibles
- ❌ Sin protección contra enumeración de cuentas
- ❌ Sin auditoría de eventos de seguridad

Este plan cubre la implementación de **todo lo que falta** para llevar la autenticación a estándares profesionales (OWASP, mejores prácticas de la industria), conservando lo que ya funciona.

---

## 2. Objetivos del proyecto

1. **Implementar el flujo "Olvidé mi contraseña"** completo y seguro.
2. **Implementar verificación de correo electrónico** opcional (configurable por env var).
3. **Garantizar unicidad real del correo** durante el registro (eliminar la race condition actual).
4. **Mejorar la experiencia de usuario** del flujo de auth.
5. **Establecer una infraestructura de envío de correos** reutilizable para futuros features.
6. **Auditar eventos de seguridad** para detección de incidentes.

---

## 3. Decisiones clave (cerradas)

| # | Decisión | Valor |
|---|---|---|
| 1 | Provider de correo | **Resend** |
| 2 | Verificación de correo | **Configurable por env var** (sistema dual) |
| 3 | Duración del token de verificación | **Configurable** en minutos. Default `60` |
| 4 | Duración del token de reset | **Configurable** en minutos. Default `30` |
| 5 | Reintentos por correo (reset y verificación) | **Configurable**. Default `3` envíos en la ventana |
| 6 | Ventana de reset de reintentos | **Configurable** en horas. Default `24h`. Modo **rolling** |
| 7 | Cap diario global de correos | **Configurable**. Default `90` (margen sobre los 100/día de Resend free) |
| 8 | Cuentas zombie no verificadas | **Configurable** en horas. Default `24h`. Cron horario |
| 9 | Bloqueo de login si verificación pendiente | **Sí**, modal específico con botón "Reenviar correo" |
| 10 | Grandfathering de la variable de verificación | **Sí**, vía campo `requiresEmailVerification` snapshot al registrarse |
| 11 | Anti-enumeración en "olvidé contraseña" | **Excepción aceptada**: muestra modal "no hay cuenta, ¿registrarte?" si el correo no existe |
| 12 | Cuentas OAuth pidiendo reset | **Permitido**. Resultado: cuenta híbrida (login por Google + por contraseña) |
| 13 | Mensaje OAuth + reset | En el correo, no en la pantalla |
| 14 | Tras reset exitoso | **Forzar login** (no auto-login) |
| 15 | Invalidación de sesiones tras reset | **Sí**, vía campo `passwordChangedAt` |
| 16 | Requisitos de contraseña | Mantener mín. 6 caracteres por ahora (mejora futura) |
| 17 | Correos de notificación post-cambio | **NO** (para preservar cuota Resend). Reemplazado por modal en pantalla |
| 18 | Modelo de tokens | **Único** (`AuthToken`) con campo discriminador `purpose` |
| 19 | Auditoría | Logins fallidos + resets a correos inexistentes + cambios de contraseña + envíos de correo + agotamiento de cuota |
| 20 | Diseño de correos | **HTML profesional** con paleta corporativa (`#001d56`). TTL renderizado dinámicamente |
| 21 | Modo de envío | **Síncrono** con timeout 10s + 3 reintentos automáticos con backoff |
| 22 | Dominio para correos | Pendiente. Inicio con sandbox de Resend (`onboarding@resend.dev`). Migración cuando esté listo |

---

## 4. Roadmap por fases

| Fase | Tema | Documento detallado |
|------|------|---------------------|
| **Fase 0** | Infraestructura de correos (Resend + IMailProvider + plantillas) | `07-implementation-phases.md` |
| **Fase 1** | Modelos de BD (AuthToken, EmailLog, EmailQuotaAlert, AuthAuditLog, cambios a User) | `07-implementation-phases.md` |
| **Fase 2** | Backend (endpoints + servicios + middlewares + rate limiting) | `07-implementation-phases.md` |
| **Fase 3** | Frontend (modales, páginas, validadores async, integración) | `07-implementation-phases.md` |
| **Fase 4** | Auditoría completa + cron de cleanup + monitoreo | `07-implementation-phases.md` |

Cada fase es **independiente y revisable**. Se entrega y aprueba antes de pasar a la siguiente.

---

## 5. Estructura de la documentación

```
docs/plans/auth-system/
├── 00-executive-summary.md          ← este documento
├── 01-architecture-and-models.md    ← decisiones arquitectónicas + modelos de BD
├── 02-detailed-flows.md             ← diagramas detallados de cada flujo
├── 03-security-and-owasp.md         ← modelo de amenazas + mitigaciones
├── 04-environment-variables.md      ← documentación de cada env var
├── 05-api-contracts.md              ← endpoints (request/response/errores)
├── 06-email-templates.md            ← plantillas HTML de los correos
├── 07-implementation-phases.md      ← detalle de cada fase
└── 08-final-checklist.md            ← checklist y criterios de aceptación
```

---

## 6. Componentes nuevos vs modificados

### Backend — Nuevos
- Módulo `auth-tokens/` (modelo + servicio)
- Módulo `email-logs/` (modelo + servicio)
- Módulo `audit-logs/` (modelo + servicio)
- Servicio `shared/services/mail/` con `IMailProvider` + `ResendProvider`
- Plantillas HTML en `shared/templates/emails/`
- Endpoints `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`, `GET /api/auth/reset-password/verify`, `POST /api/auth/check-email`, `POST /api/auth/verify-email`, `POST /api/auth/resend-verification`
- Middleware `rate-limit.middleware.ts`
- Cron job de limpieza de cuentas zombie

### Backend — Modificados
- `users/models/user.model.ts` — agregar `passwordChangedAt`, `requiresEmailVerification`
- `users/services/user.service.ts` — capturar `E11000`, normalizar emails
- `users/controllers/auth.controller.ts` — flujo de registro condicional, validación de verificación
- `users/routes/auth.routes.ts` — nuevas rutas + rate limiting
- `shared/middlewares/auth.middleware.ts` — chequeo de `passwordChangedAt`
- `config/index.ts` — nuevas env vars

### Frontend — Nuevos
- `shared/components/forgot-password-modal/` — modal de pedir email
- `shared/components/email-not-found-modal/` — modal cuando email no existe
- `shared/components/email-sent-modal/` — modal genérico "te enviamos un correo"
- `shared/components/verify-email-pending-modal/` — modal post-registro con verificación
- `features/reset-password/` — página /reset-password?token=X
- `features/verify-email/` — página /verify-email?token=X
- `shared/validators/email-unique.validator.ts` — validador async

### Frontend — Modificados
- `shared/components/auth-modal/auth-modal.component.ts` — link "¿Olvidaste?", manejo del flujo de verificación
- `core/services/auth.service.ts` — nuevos métodos
- `app.routes.ts` — nuevas rutas /reset-password y /verify-email

---

## 7. Variables de entorno nuevas (14 totales)

Detalle completo en `04-environment-variables.md` y referencia rápida en `09-env-variables-cheatsheet.md`.

```env
# === Resend ===
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# === Verificación de correo (sistema dual) ===
EMAIL_VERIFICATION_REQUIRED=false
EMAIL_VERIFICATION_TOKEN_TTL_MINUTES=60

# === Reset de contraseña ===
PASSWORD_RESET_TOKEN_TTL_MINUTES=30

# === Reintentos (cantidad + ventana, todo configurable) ===
MAX_PASSWORD_RESET_RETRIES=3
PASSWORD_RESET_RETRIES_RESET_HOURS=24
MAX_VERIFICATION_RESEND_RETRIES=3
VERIFICATION_RESEND_RETRIES_RESET_HOURS=24

# === Cuota global del sistema ===
MAX_EMAILS_PER_DAY_GLOBAL=90

# === Limpieza de cuentas zombie ===
ZOMBIE_ACCOUNT_CLEANUP_AFTER_HOURS=24

# === URLs de callback ===
RESET_PASSWORD_URL=
VERIFY_EMAIL_URL=
```

---

## 8. Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| Cuota de Resend agotada por ataque | Cap diario global + rate limiting + auditoría |
| Enumeración de cuentas vía "olvidé contraseña" | Riesgo aceptado. UX por encima de seguridad estricta en este punto |
| Tokens de reset robados | Hash SHA-256 en BD + TTL corto (30 min) + single-use |
| Cuenta zombie ocupando un correo | Cleanup automático cada 3 días |
| Registros con email duplicado por race condition | Captura de `E11000` + normalización + índice único |
| Sesiones activas tras reset (cuenta comprometida) | `passwordChangedAt` invalida JWT viejos |

---

## 9. Criterios de éxito

El sistema se considera **listo para producción** cuando:

- [ ] Un usuario puede recuperar su contraseña usando un correo registrado
- [ ] Un usuario OAuth (Google) puede crear una contraseña conservando su vínculo OAuth
- [ ] Tokens expirados son rechazados con mensaje claro
- [ ] El flujo no permite registrar dos veces el mismo correo
- [ ] Si la variable de verificación está activa, el usuario no puede entrar sin verificar
- [ ] El sistema respeta el cap diario y registra cuándo se alcanza
- [ ] Las sesiones activas se invalidan tras un reset
- [ ] Todos los eventos sensibles quedan auditados en BD
- [ ] El cron limpia cuentas zombie cada 3 días

---

## 10. Próximos pasos

1. Leer `01-architecture-and-models.md` para entender la arquitectura.
2. Leer `02-detailed-flows.md` para ver cada flujo.
3. Revisar `07-implementation-phases.md` para ver el detalle de las tareas.
4. Cuando esté todo entendido, dar la orden de iniciar con la **Fase 0**.

---

**Última actualización:** 2026-04-28
**Autor del plan:** Tech Lead Architecture (deep-debug analysis)
**Estado:** Planificación cerrada — pendiente aprobación para iniciar Fase 0
