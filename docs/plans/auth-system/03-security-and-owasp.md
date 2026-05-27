# Seguridad y OWASP

> Análisis del modelo de amenazas y mitigaciones aplicadas. Cubre los riesgos relevantes del OWASP Top 10 (2021).

---

## 1. Modelo de amenazas

### 1.1. Actores

| Actor | Capacidades | Objetivos |
|-------|-------------|-----------|
| Usuario legítimo | Acceso autorizado a su cuenta | Recuperar acceso, cambiar contraseña |
| Atacante externo | Ninguna credencial | Robar cuentas, enumerar usuarios, agotar recursos |
| Atacante con credenciales parciales | Conoce email de víctima | Secuestrar cuenta vía reset |
| Atacante con sesión robada | JWT robado | Mantener acceso aunque la víctima cambie su contraseña |

### 1.2. Activos protegidos

- Cuentas de usuario (datos personales, historial de pedidos)
- Cuota de envío de Resend (recurso limitado / costoso)
- Reputación del dominio (evitar marcar correos como spam)
- Disponibilidad del servicio

---

## 2. OWASP Top 10 — Análisis y mitigaciones

### A01:2021 — Broken Access Control

**Riesgo:** Usuario A accede a recursos del usuario B vía manipulación de tokens.

**Mitigación:**
- Tokens de reset se vinculan a `userId` específico en BD.
- Single-use: una vez usado, `usedAt` se setea. No reutilizable.
- Cuando se consume, se invalidan los tokens hermanos del mismo usuario para el mismo `purpose`.

---

### A02:2021 — Cryptographic Failures

**Riesgo:** Tokens almacenados en claro permiten secuestro masivo si la BD se filtra.

**Mitigación:**
- **Tokens hasheados con SHA-256** antes de guardar.
- En la BD nunca aparece el token plano. El usuario solo lo ve en el correo.
- Contraseñas con bcrypt (cost 10) — ya implementado.

**Código de ejemplo:**

```typescript
// Generación
const rawToken = crypto.randomBytes(32).toString('hex'); // 256 bits, ~78 dígitos hex
const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

// Almacenamiento
await AuthToken.create({ tokenHash, ...rest });

// Envío al usuario
mailService.sendResetEmail(user.email, rawToken);

// Validación
const incoming = req.body.token;
const incomingHash = crypto.createHash('sha256').update(incoming).digest('hex');
const stored = await AuthToken.findOne({ tokenHash: incomingHash, ... });
```

---

### A03:2021 — Injection

**Riesgo:** Inyección SQL/NoSQL vía campos de auth.

**Mitigación:**
- Express-validator y Mongoose ya sanitizan en el código existente.
- Plantillas de correo usan templating (no concatenación de strings).
- Email del usuario en plantillas siempre escapado HTML.

---

### A04:2021 — Insecure Design

**Riesgo:** Diseño inseguro del flujo de reset (single-step, sin TTL).

**Mitigación:**
- TTL corto (30 min reset, 1h verificación).
- Single-use con `usedAt`.
- Token aleatorio de 256 bits (inviable adivinar por brute force).
- Invalidación de tokens previos al pedir uno nuevo.

---

### A05:2021 — Security Misconfiguration

**Riesgo:** Variables env mal configuradas exponen al sistema.

**Mitigación:**
- Defaults seguros en `config/index.ts`:
  - `MAX_PASSWORD_RESET_RETRIES=0` (= solo 1 envío, restrictivo)
  - `EMAIL_VERIFICATION_REQUIRED=false` (no fuerza nada por defecto)
  - `MAX_EMAILS_PER_DAY_GLOBAL=90` (margen sobre cuota Resend)
- Documentación clara de cada variable en `04-environment-variables.md`.
- Validación al arranque: si `RESEND_API_KEY` falta y `NODE_ENV=production`, log de warning.

---

### A07:2021 — Identification and Authentication Failures

**Riesgo:** Brute force, enumeración de usuarios, sesiones no invalidadas.

#### 7.1. Brute force de tokens

**Riesgo:** Atacante intenta adivinar tokens de reset.

**Mitigación:**
- Token de 256 bits → 2^256 combinaciones. Inviable.
- Rate limit en `/reset-password/verify` (10/min por IP) y `/reset-password` (5/min por IP).

#### 7.2. Brute force de contraseñas (login)

**Riesgo:** Probar muchas contraseñas en `/login`.

**Mitigación:**
- Rate limit en `/login`: **5 intentos / 15 min por IP**.
- Auditoría de cada intento fallido (`AuthAuditLog`).

#### 7.3. Enumeración de usuarios

**Riesgo:** Conocer qué emails están registrados.

**Mitigación parcial (excepción aceptada):**
- En `/forgot-password` el flujo distingue email existente vs no existente (UX por encima de seguridad estricta).
- **Compensación:** rate limit estricto + auditoría de cada intento + same-response-time-trick (delay artificial 200-400ms en ambos caminos para no revelar nada por timing).
- En `/check-email` (validación tiempo real) la información ya está expuesta por diseño UX.

**Mitigación total en otros endpoints:**
- Login: mensaje "Credenciales inválidas" (no "Usuario no existe" / "Contraseña incorrecta").
- Resend-verification: respuesta de éxito siempre, aunque el email no exista o ya esté verificado.

#### 7.4. Sesiones activas tras compromiso

**Riesgo:** Atacante con JWT robado mantiene acceso aunque la víctima cambie contraseña.

**Mitigación:**
- Campo `passwordChangedAt` en User.
- Middleware `authenticate` rechaza JWT con `iat * 1000 < passwordChangedAt.getTime()`.
- Tras un reset de contraseña, **todos los JWT activos del usuario quedan inválidos** instantáneamente.

---

### A08:2021 — Software and Data Integrity Failures

**Riesgo:** Dependencias vulnerables (Resend SDK, bcrypt, jsonwebtoken).

**Mitigación:**
- Usar versiones recientes y mantenidas.
- `npm audit` periódico.
- Resend es el SDK oficial mantenido por la empresa.

---

### A09:2021 — Security Logging and Monitoring Failures

**Riesgo:** Incidente sucede sin que nadie se entere.

**Mitigación:**
- Modelo `AuthAuditLog` registra:
  - Intentos de login (éxito y fallo)
  - Solicitudes de reset (incluso a correos inexistentes — útil para detectar ataques)
  - Cambios de contraseña exitosos
  - Verificaciones de correo
  - Creación de cuenta híbrida (OAuth + contraseña)
- Modelo `EmailLog` registra todos los correos enviados.
- Modelo `EmailQuotaAlert` registra agotamientos de cuota.

**Queries útiles para investigar incidentes** (documentadas en `08-final-checklist.md`):
- "Mostrar todos los intentos de login fallidos del email X en las últimas 24h"
- "Mostrar todas las solicitudes de reset desde la IP X"
- "Mostrar cuándo se alcanzó el cap diario en la última semana"

---

### A10:2021 — Server-Side Request Forgery (SSRF)

No aplica directamente al sistema de auth.

---

## 3. Riesgos específicos del proyecto

### 3.1. Cuota de Resend agotada por ataque (DoS indirecto)

**Riesgo:** Atacante envía 10.000 solicitudes de reset/forgot en una hora desde múltiples IPs. Tu cuota mensual se agota → usuarios legítimos no pueden recuperar contraseña.

**Mitigación:**
1. Cap diario global (`MAX_EMAILS_PER_DAY_GLOBAL=90`).
2. Cap por correo (`MAX_PASSWORD_RESET_RETRIES=0`).
3. Rate limiting por IP en endpoints sensibles.
4. Cuando se alcanza el cap, el endpoint devuelve `503 Service Unavailable` con mensaje genérico — no se filtra que se trata del cap.
5. Auditoría: cada vez que se alcanza el cap, alerta en `EmailQuotaAlert` para que admin revise.

### 3.2. Cuenta zombie ocupando un correo

**Riesgo:** Mala fe: alguien registra `pedro@gmail.com` con `EMAIL_VERIFICATION_REQUIRED=true` pero nunca verifica. Pedro no puede registrarse.

**Mitigación:**
- Cron job cada día: elimina cuentas con `requiresEmailVerification=true && isVerified=false && createdAt < now - 3 días`.
- Reenvío de verificación disponible (con su propio rate limit).

### 3.3. Cuenta OAuth secuestrada vía reset

**Riesgo:** Atacante con acceso al correo de víctima OAuth pide reset y crea contraseña.

**Mitigación parcial:**
- Sí, esto es posible por diseño (decisión consciente del UX).
- El correo informativo le advierte al usuario "tu cuenta es de Google, recomendamos usar Google".
- Si la víctima recibe ese correo sin haberlo solicitado, debería sospechar.
- **Mejora futura:** notificar dentro de la app o vía Google que se vinculó una contraseña.

### 3.4. Token reuse tras compartir el link

**Riesgo:** Usuario comparte link por accidente (chat, captura) y otro lo usa primero.

**Mitigación:**
- Single-use con `usedAt`.
- TTL corto (30 min reset).
- Audit log captura IP y userAgent del consumidor — útil para detectar uso indebido.

### 3.5. Phishing con emails legítimos

**Riesgo:** Atacante simula emails de TuBus para robar credenciales.

**Mitigación:**
- (Cuando haya dominio propio) Configurar SPF, DKIM, DMARC en el dominio.
- Plantilla de correo con branding consistente.
- Footer con "Si no solicitaste esto, ignora este correo. TuBus nunca te pedirá tu contraseña por correo".

---

## 4. Defensas en profundidad (capas)

```
┌─────────────────────────────────────────────────────┐
│  Capa 1: Frontend                                   │
│  - Validación en form (no es seguridad real)        │
│  - Throttle UI: deshabilita botón mientras envía    │
└─────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────┐
│  Capa 2: Rate limiting (express-rate-limit)         │
│  - Por IP                                           │
│  - Antes de la lógica de negocio                    │
└─────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────┐
│  Capa 3: Validación de input (express-validator)    │
│  - Formato de email, password, etc.                 │
└─────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────┐
│  Capa 4: Lógica de negocio + cap por usuario        │
│  - Verifica retries por email en EmailLog           │
│  - Verifica cap global del día                      │
└─────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────┐
│  Capa 5: BD (índices únicos, TTL)                   │
│  - email unique sparse                              │
│  - tokenHash hasheado                               │
│  - TTL automático en tokens expirados               │
└─────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────┐
│  Capa 6: Auditoría                                  │
│  - Cada evento sensible queda registrado            │
│  - Para detección retroactiva de ataques            │
└─────────────────────────────────────────────────────┘
```

Si un atacante supera una capa, debe enfrentar la siguiente.

---

## 5. Configuración de rate limiting

| Endpoint | Límite | Ventana | Razón |
|----------|--------|---------|-------|
| `POST /auth/login` | 5 | 15 min | Brute force passwords |
| `POST /auth/register` | 3 | 1 hora | Anti-spam de registros |
| `POST /auth/forgot-password` | 3 | 1 hora | Anti-abuso de correos |
| `POST /auth/resend-verification` | 3 | 1 hora | Anti-abuso de correos |
| `POST /auth/verify-email` | 10 | 5 min | Permitir reintentos por errores de UI |
| `POST /auth/reset-password` | 5 | 15 min | Permitir corregir typos |
| `GET /auth/reset-password/verify` | 10 | 5 min | Carga inicial del form |
| `POST /auth/check-email` | 30 | 1 min | Validador async puede dispararse seguido |

**Implementación:** `express-rate-limit` con `MemoryStore` (suficiente para single-instance) o `RedisStore` (si se escala horizontalmente).

**Importante:** estos límites son **por IP**. Los límites por correo son adicionales y se calculan consultando `EmailLog`.

---

## 6. Plantillas de correo — Consideraciones de seguridad

- **Escapado HTML:** Todo dato del usuario en plantillas se escapa (especialmente `firstName` y `email`) para prevenir HTML injection en clientes de correo.
- **Links absolutos firmados:** Los links incluyen el token. No exponer detalles internos.
- **Sin información sensible en el cuerpo:** No mostrar contraseñas, último login, etc.
- **Footer de seguridad:** "Si no solicitaste esto, ignora este correo. TuBus nunca pedirá tu contraseña."

---

## 7. Checklist de seguridad — Pre-deploy

Antes de pasar a producción, verificar:

- [ ] `JWT_SECRET` y `SESSION_SECRET` cambiados desde los defaults
- [ ] `RESEND_API_KEY` configurada (nunca commiteada)
- [ ] `EMAIL_VERIFICATION_REQUIRED` definida según política
- [ ] `MAX_EMAILS_PER_DAY_GLOBAL` razonable según plan de Resend
- [ ] `RESET_PASSWORD_URL` y `VERIFY_EMAIL_URL` apuntan al dominio correcto (HTTPS)
- [ ] Rate limit middlewares aplicados a todas las rutas sensibles
- [ ] Auditoría: revisar manualmente que cada evento sensible llama a `auditLog.create()`
- [ ] Plantillas de correo escapan los datos del usuario
- [ ] (Cuando haya dominio) SPF, DKIM, DMARC configurados
- [ ] Cron de cleanup zombie ejecutándose correctamente
- [ ] HTTPS forzado en producción
- [ ] Headers de seguridad (helmet ya está configurado, verificar CSP)

---

## 8. Plan ante incidente

Si se detecta una cuenta comprometida:

1. Setear `passwordChangedAt = new Date()` en el user → invalida JWT al instante.
2. Setear `status = SUSPENDED` mientras se investiga.
3. Consultar `AuthAuditLog` filtrando por ese usuario para reconstruir el ataque.
4. Notificar al usuario fuera de banda (teléfono).

Si se detecta abuso del cap diario:

1. Identificar IPs en `EmailLog` y `AuthAuditLog`.
2. Bloquear vía firewall si es ataque coordinado.
3. Considerar bajar el cap temporalmente.
4. Considerar upgrade del plan de Resend si el tráfico legítimo está escalando.

---

**Documento siguiente:** [`04-environment-variables.md`](./04-environment-variables.md) — todas las variables de entorno documentadas.
