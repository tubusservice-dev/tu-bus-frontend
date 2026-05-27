# Sistema de Autenticación — Documentación

> Plan completo de implementación del sistema de autenticación de TuBus Express:
> - Recuperación de contraseña ("Olvidé mi contraseña")
> - Verificación de correo electrónico (configurable)
> - Validación de email único en tiempo real
> - Auditoría de eventos de seguridad
> - Sistema de envío de correos vía Resend

---

## 📚 Índice de documentos

Lee los documentos **en este orden** para entender el plan completo:

| # | Documento | Tema |
|---|-----------|------|
| 1 | [`00-executive-summary.md`](./00-executive-summary.md) | **Empieza aquí.** Visión general, decisiones cerradas, roadmap |
| 2 | [`01-architecture-and-models.md`](./01-architecture-and-models.md) | Arquitectura SOLID + modelos de BD nuevos y modificados |
| 3 | [`02-detailed-flows.md`](./02-detailed-flows.md) | Diagramas paso a paso de los 11 flujos del sistema |
| 4 | [`03-security-and-owasp.md`](./03-security-and-owasp.md) | Modelo de amenazas, OWASP Top 10, mitigaciones |
| 5 | [`04-environment-variables.md`](./04-environment-variables.md) | Cada env var documentada con defaults y ejemplos |
| 6 | [`05-api-contracts.md`](./05-api-contracts.md) | Contratos request/response de cada endpoint |
| 7 | [`06-email-templates.md`](./06-email-templates.md) | Plantillas HTML de los 3 correos del sistema |
| 8 | [`07-implementation-phases.md`](./07-implementation-phases.md) | Plan detallado de las 5 fases |
| 9 | [`08-final-checklist.md`](./08-final-checklist.md) | Checklist pre-deploy + queries de auditoría + mejoras futuras |
| 10 | [`09-env-variables-cheatsheet.md`](./09-env-variables-cheatsheet.md) | **Cheatsheet visual** — guía rápida para saber qué hace cada env var |

---

## 🚀 Estado actual

**Planificación cerrada.** Pendiente aprobación para iniciar **Fase 0** (infraestructura de correos).

**Comando para iniciar:** `Aplica la solución — Fase 0`

---

## 📌 Decisiones rápidas (TL;DR)

- Provider de correo: **Resend**
- Verificación de correo: **Configurable** (env var `EMAIL_VERIFICATION_REQUIRED`)
- Token de verificación: **Configurable en minutos** (default `60`)
- Token de reset: **Configurable en minutos** (default `30`)
- Reintentos por correo: **Configurable** (default `3` envíos en la ventana)
- Ventana de reset de reintentos: **Configurable en horas** (default `24h`, modo rolling)
- Cap diario global: **Configurable** (default `90`)
- Cuentas zombie: eliminadas tras `N` horas (configurable, default `24h`)
- Cuentas OAuth + reset: cuenta híbrida (login por ambos métodos)
- Anti-enumeración en "olvidé contraseña" para correos no existentes: **excepción aceptada** (UX > seguridad estricta en ese punto)
- Modelo de tokens: **Único** (`AuthToken` con discriminador `purpose`)
- Tras reset: **Forzar login** (no auto-login) + invalidar JWT viejos vía `passwordChangedAt`
- **14 variables de entorno** totales, todas configurables sin redeploy

---

## 📊 Resumen del impacto

| Área | Archivos nuevos | Archivos modificados |
|------|----------------|----------------------|
| Backend | ~22 | ~6 |
| Frontend | ~14 | ~3 |
| Documentación | 10 | — |

---

## ⏱️ Tiempo estimado

**6 días** de trabajo enfocado, distribuido en 5 fases independientes y revisables.

---

## 🔗 Recursos externos

- [Resend](https://resend.com) — provider de correos
- [OWASP Top 10](https://owasp.org/Top10/) — referencia de seguridad
- [Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) — guía OWASP

---

**Autor del plan:** Tech Lead Architecture (deep-debug analysis)
**Fecha:** 2026-04-28
**Última revisión:** 2026-04-28
