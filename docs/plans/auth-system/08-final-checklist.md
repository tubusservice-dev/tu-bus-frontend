# Checklist Final y Queries de Auditoría

> Checklist consolidado de cierre del proyecto. Queries útiles para investigar incidentes. Mejoras futuras documentadas.

---

## 1. Checklist consolidado pre-deploy

### 1.1. Variables de entorno (14 totales)

**Resend:**
- [ ] `RESEND_API_KEY` configurada (real key, no placeholder)
- [ ] `RESEND_FROM_EMAIL` apunta al remitente correcto

**Verificación de correo:**
- [ ] `EMAIL_VERIFICATION_REQUIRED` definida según política de negocio
- [ ] `EMAIL_VERIFICATION_TOKEN_TTL_MINUTES` dentro del rango razonable (recomendado: 30-120)

**Reset de contraseña:**
- [ ] `PASSWORD_RESET_TOKEN_TTL_MINUTES` dentro del rango razonable (recomendado: 15-60)

**Reintentos:**
- [ ] `MAX_PASSWORD_RESET_RETRIES` definida (recomendado: 3 en prod, 10 en dev)
- [ ] `PASSWORD_RESET_RETRIES_RESET_HOURS` definida (recomendado: 24)
- [ ] `MAX_VERIFICATION_RESEND_RETRIES` definida (recomendado: 3 en prod, 10 en dev)
- [ ] `VERIFICATION_RESEND_RETRIES_RESET_HOURS` definida (recomendado: 24)

**Cuota global:**
- [ ] `MAX_EMAILS_PER_DAY_GLOBAL` ajustada según plan Resend (90 free, 1500 Pro)

**Limpieza zombie:**
- [ ] `ZOMBIE_ACCOUNT_CLEANUP_AFTER_HOURS` definida (recomendado: 24 estricto, 72 equilibrado, 168 permisivo)

**URLs:**
- [ ] `RESET_PASSWORD_URL` apunta al dominio correcto (HTTPS en prod)
- [ ] `VERIFY_EMAIL_URL` apunta al dominio correcto (HTTPS en prod)

**Seguridad básica:**
- [ ] `JWT_SECRET` cambiado del default (si es nueva instalación)
- [ ] `SESSION_SECRET` cambiado del default
- [ ] `.env` está en `.gitignore`
- [ ] `.env.example` incluye las 14 variables nuevas (sin valores reales)
- [ ] Validación al arranque (`validateAuthEnv()`) ejecutándose y rechazando configs inválidas

### 1.2. Backend

- [ ] Las 5 colecciones nuevas existen en MongoDB:
  - [ ] `authtokens`
  - [ ] `emaillogs`
  - [ ] `emailquotaalerts`
  - [ ] `authauditlogs`
  - [ ] (`users` con campos nuevos)
- [ ] TTL index activo en `authtokens.expiresAt`
- [ ] Índices compuestos creados según `01-architecture-and-models.md`
- [ ] Script de migración corrió en BD existente (setea `requiresEmailVerification: false` en usuarios viejos)
- [ ] Endpoints documentados en `05-api-contracts.md` responden 200 en caso feliz
- [ ] Endpoints rechazan correctamente con códigos específicos en cada caso de error
- [ ] Rate limit middlewares aplicados a todas las rutas sensibles
- [ ] Middleware `enforceEmailQuota` aplicado a las rutas que envían correo
- [ ] Middleware `authenticate` modificado: chequea `passwordChangedAt`
- [ ] `ResendProvider` con retry + backoff funciona
- [ ] Plantillas HTML renderizan correctamente
- [ ] Plantillas TXT existen (fallback no-HTML)
- [ ] Cron `cleanup-zombie-accounts` registrado y se ejecuta

### 1.3. Frontend

- [ ] Link "¿Olvidaste tu contraseña?" visible en login
- [ ] Modal `forgot-password-modal` funcional
- [ ] Modal `email-sent-modal` funcional
- [ ] Modal `email-not-found-modal` funcional con CTA a registrarse
- [ ] Modal `verify-email-pending-modal` funcional con reenvío
- [ ] Página `/reset-password` muestra form si token válido
- [ ] Página `/reset-password` muestra error si token inválido/expirado
- [ ] Página `/verify-email` procesa el token y muestra resultado
- [ ] Validador async de email único activo en form de registro
- [ ] `auth-modal` detecta `requiresVerification: true` tras registro
- [ ] `auth-modal` detecta `EMAIL_NOT_VERIFIED` tras login y muestra reenvío
- [ ] Tras reset exitoso, el usuario es redirigido a login (no auto-login)
- [ ] Routes nuevas registradas en `app.routes.ts`

### 1.4. Seguridad

- [ ] HTTPS forzado en producción
- [ ] Headers de seguridad (helmet) sin cambios en su comportamiento
- [ ] Tokens hasheados en BD (verificar manualmente: `db.authtokens.findOne()` no muestra raw tokens)
- [ ] Single-use de tokens funciona (consumir → reusar = error)
- [ ] Rate limit funciona (probar superar límite y verificar 429)
- [ ] Cap diario funciona (ajustar a `1` y verificar 503 al segundo intento)
- [ ] Audit log tiene entradas tras cada evento
- [ ] (Si hay dominio propio) SPF, DKIM, DMARC configurados en DNS

### 1.5. Pruebas funcionales end-to-end

Ejecutar manualmente cada flujo de `02-detailed-flows.md`:

- [ ] **Flujo 1:** Registro con `EMAIL_VERIFICATION_REQUIRED=false` → auto-login OK
- [ ] **Flujo 2:** Registro con `EMAIL_VERIFICATION_REQUIRED=true` → modal pendiente, sin login
- [ ] **Flujo 3:** Login estándar funciona
- [ ] **Flujo 4:** Login con verif pendiente → bloqueado con mensaje + botón reenviar
- [ ] **Flujo 5:** Verificación de correo desde link → activa cuenta
- [ ] **Flujo 6:** Reenvío de verificación funciona (con su rate limit)
- [ ] **Flujo 7:** Olvidé contraseña — cuenta normal → correo recibido
- [ ] **Flujo 8:** Olvidé contraseña — cuenta OAuth → correo informativo recibido
- [ ] **Flujo 9:** Olvidé contraseña — correo no existe → modal "registrarte"
- [ ] **Flujo 10:** Reset desde link → contraseña actualizada + JWT viejos invalidados
- [ ] **Flujo 11:** Validación email único en tiempo real durante registro

### 1.6. Pruebas de regresión

Verificar que estos flujos existentes **NO se rompieron**:

- [ ] Login admin (`/admin/login`) sigue funcionando
- [ ] OAuth Google funciona end-to-end
- [ ] OAuth Facebook funciona end-to-end
- [ ] Cambio voluntario de contraseña en perfil (`PUT /users/change-password`) funciona
- [ ] Visualización de perfil del usuario funciona
- [ ] Sesión expirada al cabo de `JWT_EXPIRES_IN` tiempo
- [ ] Logout limpia el localStorage correctamente

---

## 2. Queries útiles para investigación

### 2.1. ¿Cuántos correos llevamos enviados hoy?

```javascript
// MongoDB shell
db.emaillogs.countDocuments({
  createdAt: { $gt: new Date(Date.now() - 24*60*60*1000) },
  status: 'sent'
})
```

### 2.2. ¿Se ha alcanzado el cap diario alguna vez?

```javascript
db.emailquotaalerts.find().sort({ triggeredAt: -1 }).limit(10)
```

### 2.3. Intentos de login fallidos del email X en las últimas 24h

```javascript
db.authauditlogs.find({
  event: 'login_attempt',
  email: 'pedro@gmail.com',
  success: false,
  createdAt: { $gt: new Date(Date.now() - 24*60*60*1000) }
}).sort({ createdAt: -1 })
```

### 2.4. Solicitudes de reset desde una IP específica

```javascript
db.authauditlogs.find({
  event: 'password_reset_requested',
  ipAddress: '192.168.1.100'
}).sort({ createdAt: -1 })
```

### 2.5. Cuentas zombie pendientes de cleanup

```javascript
db.users.find({
  requiresEmailVerification: true,
  isVerified: false,
  createdAt: { $lt: new Date(Date.now() - 3*24*60*60*1000) }
})
```

### 2.6. Tokens activos no consumidos para un usuario

```javascript
db.authtokens.find({
  userId: ObjectId('...'),
  usedAt: null,
  expiresAt: { $gt: new Date() }
})
```

### 2.7. Distribución de envíos por tipo en los últimos 7 días

```javascript
db.emaillogs.aggregate([
  { $match: { createdAt: { $gt: new Date(Date.now() - 7*24*60*60*1000) } } },
  { $group: { _id: '$purpose', count: { $sum: 1 } } }
])
```

### 2.8. Top 10 IPs con más intentos de reset

```javascript
db.authauditlogs.aggregate([
  { $match: { event: 'password_reset_requested' } },
  { $group: { _id: '$ipAddress', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
  { $limit: 10 }
])
```

### 2.9. Cuentas híbridas (OAuth + password) creadas

```javascript
db.users.find({
  $or: [{ googleId: { $exists: true } }, { facebookId: { $exists: true } }],
  password: { $exists: true, $ne: null }
})
```

### 2.10. Usuarios que cambiaron contraseña en la última semana

```javascript
db.users.find({
  passwordChangedAt: { $gt: new Date(Date.now() - 7*24*60*60*1000) }
}, { email: 1, passwordChangedAt: 1 })
```

---

## 3. Criterios de éxito del proyecto

El sistema se considera **listo para producción** cuando:

### 3.1. Funcionalidad
- ✅ Un usuario puede recuperar su contraseña usando un correo registrado.
- ✅ Un usuario OAuth puede crear una contraseña conservando su vínculo OAuth.
- ✅ Tokens expirados son rechazados con mensaje claro.
- ✅ El flujo no permite registrar dos veces el mismo correo (incluso bajo concurrencia).
- ✅ Si la verificación está activa, el usuario no puede entrar sin verificar.
- ✅ El sistema respeta el cap diario y registra cuando se alcanza.
- ✅ Las sesiones activas se invalidan tras un reset.
- ✅ Todos los eventos sensibles quedan auditados en BD.
- ✅ El cron limpia cuentas zombie cada 3 días.

### 3.2. Calidad
- ✅ TypeScript compila sin errores.
- ✅ No hay TODOs ni console.log de debug en código de producción.
- ✅ La documentación refleja la realidad del código.
- ✅ Los archivos no superan el límite de 1000 líneas (regla del proyecto).
- ✅ Los módulos siguen los patrones SOLID, DRY, KISS.

### 3.3. Operación
- ✅ Variables de entorno documentadas en `.env.example`.
- ✅ Defaults seguros si alguna variable falta.
- ✅ Errores claros (no genéricos) en cada caso.
- ✅ Logs de auditoría útiles para investigar incidentes.

---

## 4. Mejoras futuras (fuera de scope de este sprint)

### 4.1. Seguridad

- **Endurecer requisitos de contraseña:** mínimo 8 caracteres, mayúscula, número, símbolo. Hoy se mantiene en 6 por compatibilidad.
- **Refresh tokens:** implementar JWT refresh tokens para mejorar UX (sesiones más largas con renovación silenciosa) sin sacrificar seguridad.
- **2FA (Two-factor authentication):** TOTP, SMS, o email-based para usuarios que lo activen voluntariamente.
- **Notificación al cambio de contraseña:** correo de alerta tras cambio exitoso. Hoy se descartó por preservar cuota.
- **Captcha:** integrar reCAPTCHA en endpoints de forgot-password y register para reducir abuso.
- **CSP estricto:** revisar Content Security Policy del helmet para endurecer.

### 4.2. UX

- **Cambio de email:** flujo para cambiar el correo asociado a la cuenta (con verificación en ambos correos).
- **Eliminación de cuenta:** flujo de "borrar mi cuenta" auto-servicio.
- **Histórico de sesiones:** mostrar al usuario sus dispositivos/IPs con sesiones activas y permitir revocarlas.
- **Recuperación con número de documento:** alternativa para usuarios sin acceso al correo.

### 4.3. Operación

- **Dashboard admin de auth:** UI para visualizar `AuthAuditLog`, `EmailLog`, alertas de cuota.
- **Alertas externas:** notificación a Slack/Telegram cuando se alcanza el cap diario.
- **Cola de mensajes:** migrar `MailService` a procesamiento asíncrono con BullMQ cuando el volumen lo justifique.
- **Múltiples providers de correo:** integrar fallback (Resend → SendGrid) en caso de caída.
- **Métricas (Prometheus/Grafana):** instrumentar endpoints sensibles con métricas.

### 4.4. Pruebas automatizadas

- **Tests unitarios:** servicios de `AuthTokenService`, `MailService`, `EmailLogService`.
- **Tests de integración:** flujos completos con Supertest + Mongo en memoria.
- **Tests E2E:** Cypress/Playwright cubriendo flujos de UI.

---

## 5. Glosario

| Término | Definición |
|---------|------------|
| **AuthToken** | Token genérico de un solo uso, con TTL, para verificación o reset |
| **JWT** | JSON Web Token. Token de sesión emitido tras login exitoso |
| **OAuth** | Protocolo de delegación de auth (Google/Facebook lo implementan) |
| **OWASP** | Open Web Application Security Project (referencia de seguridad) |
| **TTL** | Time To Live. MongoDB elimina automáticamente los documentos expirados |
| **Race condition** | Concurrencia que produce resultados inconsistentes |
| **Anti-enumeración** | Práctica de no revelar si un correo está registrado |
| **Grandfathering** | Conservar el comportamiento antiguo para entidades pre-existentes |
| **Cuenta zombie** | Cuenta registrada pero nunca verificada (potencialmente abandonada) |
| **Cuenta híbrida** | Cuenta vinculada con OAuth Y con contraseña local |

---

## 6. Referencias técnicas

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [OWASP Top 10 (2021)](https://owasp.org/Top10/)
- [Resend Documentation](https://resend.com/docs)
- [express-rate-limit](https://www.npmjs.com/package/express-rate-limit)
- [Handlebars](https://handlebarsjs.com/)
- [MongoDB TTL Indexes](https://www.mongodb.com/docs/manual/core/index-ttl/)

---

## 7. Cierre

Este documento marca el fin de la fase de **planificación y análisis**. Cuando el equipo dé la orden, se inicia la **Fase 0** (infraestructura de correos).

**No se debe iniciar la implementación sin antes:**
1. Haber leído los 9 documentos de esta carpeta.
2. Tener creada la cuenta de Resend y la API key disponible.
3. Tener definido en qué ambiente arrancar (dev/QA).
4. Aprobación explícita del Tech Lead / dueño del producto.

---

**Última actualización:** 2026-04-28
**Estado del proyecto:** Planificación cerrada — listo para iniciar Fase 0
**Comando para iniciar:** `Aplica la solución — Fase 0`
