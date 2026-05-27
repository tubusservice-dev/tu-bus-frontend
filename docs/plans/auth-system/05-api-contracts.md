# Contratos de API

> Especificación detallada de cada endpoint nuevo y modificado. Incluye request, response (éxito y error), códigos HTTP, validaciones y rate limits.

---

## 1. Convenciones generales

### 1.1. Estructura estándar de respuesta

**Éxito:**
```json
{
  "success": true,
  "message": "string opcional",
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "message": "string descriptivo",
  "code": "CODIGO_ESPECIFICO",
  "errors": [ { "field": "...", "message": "..." } ]
}
```

### 1.2. Códigos de error específicos del sistema de auth

| Código | Significado |
|--------|-------------|
| `EMAIL_ALREADY_REGISTERED` | Email ya registrado al hacer register |
| `INVALID_CREDENTIALS` | Email o contraseña incorrectos |
| `EMAIL_NOT_VERIFIED` | Login bloqueado por verificación pendiente |
| `ACCOUNT_BLOCKED`, `ACCOUNT_SUSPENDED`, `ACCOUNT_DELETED` | Existentes, sin cambios |
| `INVALID_RESET_TOKEN` | Token de reset inválido o ya usado |
| `EXPIRED_RESET_TOKEN` | Token de reset expiró |
| `INVALID_VERIFICATION_TOKEN` | Token de verificación inválido o ya usado |
| `EXPIRED_VERIFICATION_TOKEN` | Token de verificación expiró |
| `RATE_LIMIT_EMAIL` | Excedió el cap por correo |
| `RATE_LIMIT_GLOBAL` | Excedió el cap diario global |
| `OAUTH_ACCOUNT_NO_PASSWORD` | (Solo informativo en logs) Intento de cambiar password en cuenta sin contraseña local |

### 1.3. Headers y rate limits

Todos los endpoints retornan headers estándar:
- `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` (vía `express-rate-limit`)

---

## 2. Endpoints nuevos

### 2.1. `POST /api/auth/forgot-password`

**Función:** Solicita el envío del correo de reset de contraseña.

**Rate limit:** 3 / hora por IP. Adicionalmente, valida cap por email y cap global.

**Request:**
```json
{
  "email": "pedro@gmail.com"
}
```

**Validaciones:**
- `email`: requerido, formato email, lowercase + trim antes de procesar.

**Response 200 (caso 1: email NO existe):**
```json
{
  "success": true,
  "data": {
    "exists": false
  }
}
```
*El frontend abrirá `EmailNotFoundModal`.*

**Response 200 (caso 2: email existe, normal):**
```json
{
  "success": true,
  "message": "Te hemos enviado un correo. Revisa tu bandeja.",
  "data": {
    "exists": true
  }
}
```

**Response 200 (caso 3: email existe, OAuth):**
```json
{
  "success": true,
  "message": "Te hemos enviado un correo. Revisa tu bandeja.",
  "data": {
    "exists": true
  }
}
```
*Frontend trata caso 2 y 3 igual. La distinción se hace dentro del correo.*

**Response 429 (rate limit):**
```json
{
  "success": false,
  "code": "RATE_LIMIT_EMAIL",
  "message": "Has solicitado demasiados envíos para este correo. Intenta de nuevo en 1 hora."
}
```

**Response 503 (cap global agotado):**
```json
{
  "success": false,
  "code": "RATE_LIMIT_GLOBAL",
  "message": "El servicio está temporalmente saturado. Intenta más tarde."
}
```

---

### 2.2. `POST /api/auth/reset-password`

**Función:** Establece la nueva contraseña usando el token recibido por correo.

**Rate limit:** 5 / 15 min por IP.

**Request:**
```json
{
  "token": "abc123def456...",
  "newPassword": "miNuevaContraseñaSegura"
}
```

**Validaciones:**
- `token`: requerido, string no vacío.
- `newPassword`: requerido, mínimo 6 caracteres (regla actual del proyecto).

**Response 200 (éxito):**
```json
{
  "success": true,
  "message": "Contraseña actualizada exitosamente"
}
```
*El backend invalida JWT viejos vía `passwordChangedAt`. El frontend redirige a login.*

**Response 400 (token inválido):**
```json
{
  "success": false,
  "code": "INVALID_RESET_TOKEN",
  "message": "El link es inválido o ya fue usado."
}
```

**Response 400 (token expirado):**
```json
{
  "success": false,
  "code": "EXPIRED_RESET_TOKEN",
  "message": "El link expiró. Solicita uno nuevo."
}
```

**Response 400 (contraseña débil):**
```json
{
  "success": false,
  "message": "Error de validación",
  "errors": [
    { "field": "newPassword", "message": "La contraseña debe tener al menos 6 caracteres" }
  ]
}
```

---

### 2.3. `GET /api/auth/reset-password/verify`

**Función:** Pre-valida el token (sin consumirlo) cuando el usuario abre el link. Permite mostrar el form solo si el token es válido.

**Rate limit:** 10 / 5 min por IP.

**Query params:**
- `token` (requerido)

**Request:** `GET /api/auth/reset-password/verify?token=abc123...`

**Response 200 (válido):**
```json
{
  "success": true,
  "data": {
    "valid": true
  }
}
```

**Response 200 (inválido):**
```json
{
  "success": true,
  "data": {
    "valid": false,
    "reason": "expired" | "used" | "invalid"
  }
}
```
*Nota: respuesta 200 incluso cuando es inválido — es información, no error.*

---

### 2.4. `POST /api/auth/verify-email`

**Función:** Marca el correo como verificado, consumiendo el token.

**Rate limit:** 10 / 5 min por IP.

**Request:**
```json
{
  "token": "xyz789..."
}
```

**Response 200 (éxito):**
```json
{
  "success": true,
  "message": "Correo verificado exitosamente. Ya puedes iniciar sesión."
}
```

**Response 400 (token inválido):**
```json
{
  "success": false,
  "code": "INVALID_VERIFICATION_TOKEN",
  "message": "El link es inválido o ya fue usado."
}
```

**Response 400 (token expirado):**
```json
{
  "success": false,
  "code": "EXPIRED_VERIFICATION_TOKEN",
  "message": "El link expiró. Solicita uno nuevo."
}
```

---

### 2.5. `POST /api/auth/resend-verification`

**Función:** Reenvía el correo de verificación.

**Rate limit:** 3 / hora por IP. Adicionalmente, valida cap por email y cap global.

**Request:**
```json
{
  "email": "pedro@gmail.com"
}
```

**Response 200 (siempre éxito — anti-enumeración):**
```json
{
  "success": true,
  "message": "Si el correo está registrado y pendiente de verificar, recibirás un enlace."
}
```
*Internamente, si el correo no existe o ya está verificado, no se envía. Pero la respuesta es la misma.*

**Response 429:**
```json
{
  "success": false,
  "code": "RATE_LIMIT_EMAIL",
  "message": "Demasiados envíos para este correo. Intenta más tarde."
}
```

---

### 2.6. `POST /api/auth/check-email`

**Función:** Validar si un correo ya está registrado (UX en tiempo real durante el registro).

**Rate limit:** 30 / min por IP.

**Request:**
```json
{
  "email": "pedro@gmail.com"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "exists": false
  }
}
```

*Si `exists: true`, el frontend marca el campo email como inválido y sugiere "¿Olvidaste tu contraseña?".*

⚠️ **Nota de seguridad:** este endpoint expone enumeración por diseño UX. El rate limit es la única mitigación.

---

## 3. Endpoints modificados

### 3.1. `POST /api/auth/register`

**Cambios:**
- Captura `MongoServerError E11000` y lo mapea a respuesta 409 estándar.
- Si `EMAIL_VERIFICATION_REQUIRED=true`:
  - NO genera JWT.
  - Genera AuthToken purpose=email_verification.
  - Envía correo de verificación.
  - Response sin token, con `requiresVerification: true`.

**Request (sin cambios):**
```json
{
  "email": "...",
  "password": "...",
  "firstName": "...",
  "lastName": "...",
  "documentType": "V|E|J|P|G",
  "documentNumber": "...",
  "phone": "...",
  "birthDate": "...",
  "companyName": "..."
}
```

**Response 201 — verificación NO requerida (flujo actual):**
```json
{
  "success": true,
  "message": "Usuario registrado exitosamente",
  "data": {
    "user": { ... },
    "token": "JWT..."
  }
}
```

**Response 201 — verificación SÍ requerida (NUEVO):**
```json
{
  "success": true,
  "message": "Te hemos enviado un correo para verificar tu cuenta",
  "data": {
    "user": { ... },
    "requiresVerification": true
  }
}
```
*El frontend debe detectar `requiresVerification: true` y NO loguear automáticamente. Mostrar `VerifyEmailPendingModal`.*

**Response 409 (email duplicado — manejo robusto del E11000):**
```json
{
  "success": false,
  "code": "EMAIL_ALREADY_REGISTERED",
  "message": "El correo electrónico ya está registrado"
}
```

---

### 3.2. `POST /api/auth/login`

**Cambios:**
- Normaliza email (lowercase + trim) antes de query.
- Si el usuario tiene `requiresEmailVerification && !isVerified`, rechaza con 403 + `code: 'EMAIL_NOT_VERIFIED'`.

**Response 403 (NUEVO — verificación pendiente):**
```json
{
  "success": false,
  "code": "EMAIL_NOT_VERIFIED",
  "message": "Debes verificar tu correo electrónico antes de iniciar sesión.",
  "data": {
    "email": "pedro@gmail.com"
  }
}
```
*El frontend muestra modal con botón "Reenviar correo".*

---

### 3.3. Middleware `authenticate` (todos los endpoints protegidos)

**Cambio:**
- Tras decodificar el JWT, consulta `User.passwordChangedAt`.
- Si `jwtPayload.iat * 1000 < passwordChangedAt.getTime()` → rechaza con 401 + `code: 'TOKEN_REVOKED'`.

**Response 401 (NUEVO — sesión invalidada):**
```json
{
  "success": false,
  "code": "TOKEN_REVOKED",
  "message": "Tu sesión expiró debido a un cambio de seguridad. Inicia sesión nuevamente."
}
```
*El frontend lo trata igual que un token expirado: limpia localStorage y abre auth-modal.*

---

## 4. Resumen de rutas

```
[NUEVO]      POST  /api/auth/forgot-password
[NUEVO]      POST  /api/auth/reset-password
[NUEVO]      GET   /api/auth/reset-password/verify
[NUEVO]      POST  /api/auth/verify-email
[NUEVO]      POST  /api/auth/resend-verification
[NUEVO]      POST  /api/auth/check-email

[MODIFICADO] POST  /api/auth/register
[MODIFICADO] POST  /api/auth/login

[SIN CAMBIO] POST  /api/auth/logout
[SIN CAMBIO] GET   /api/auth/google
[SIN CAMBIO] GET   /api/auth/google/callback
[SIN CAMBIO] GET   /api/auth/facebook
[SIN CAMBIO] GET   /api/auth/facebook/callback
```

---

## 5. Flujo end-to-end por endpoint

### 5.1. Forgot password — ejemplo completo

**1. Usuario llena form:**
```http
POST /api/auth/forgot-password
Content-Type: application/json

{ "email": "pedro@gmail.com" }
```

**2. Backend procesa:**
- Rate limit OK
- Normaliza email
- `User.findOne({ email: 'pedro@gmail.com' })` → encuentra
- `googleId` y `facebookId` son null → caso normal
- Invalida AuthTokens previos del user con `purpose='password_reset'`
- Genera nuevo token, hash, guarda
- `MailService.sendResetEmail(...)` (con backoff)
- `AuthAuditLog.create(...)`
- `EmailLog.create(...)`
- Responde:

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "Te hemos enviado un correo. Revisa tu bandeja.",
  "data": { "exists": true }
}
```

**3. Frontend muestra `EmailSentModal` genérico.**

**4. Usuario abre correo y hace click en `https://app.com/reset-password?token=raw_token_aqui`**

**5. Frontend (ResetPasswordComponent) carga:**
```http
GET /api/auth/reset-password/verify?token=raw_token_aqui
```

**6. Backend valida (sin consumir):**
```http
HTTP/1.1 200 OK
{ "success": true, "data": { "valid": true } }
```

**7. Frontend muestra form de nueva contraseña.**

**8. Usuario llena y submit:**
```http
POST /api/auth/reset-password
{ "token": "raw_token_aqui", "newPassword": "MiPassword123" }
```

**9. Backend procesa:**
- Hash el token, busca AuthToken válido
- Actualiza `user.password = 'MiPassword123'` (pre-save hace bcrypt)
- `user.passwordChangedAt = now`
- `user.save()`
- `token.usedAt = now; token.save()`
- Invalida tokens hermanos
- Auditoría
- Responde:

```http
HTTP/1.1 200 OK
{ "success": true, "message": "Contraseña actualizada exitosamente" }
```

**10. Frontend muestra pantalla de éxito + botón "Iniciar sesión" → redirige al home con auth-modal.**

---

## 6. Consideraciones adicionales

### 6.1. Idempotencia

Los endpoints de `forgot-password` y `resend-verification` son **idempotentes** desde el punto de vista del cliente. Pedirlos N veces causa N envíos (limitados por el cap), pero no genera estados inconsistentes.

### 6.2. Concurrencia

El consumo del token (`reset-password` y `verify-email`) usa una operación atómica:

```typescript
const token = await AuthToken.findOneAndUpdate(
  { tokenHash, purpose, usedAt: null, expiresAt: { $gt: new Date() } },
  { usedAt: new Date() },
  { new: false }  // devuelve la versión PREVIA (antes del set)
);

if (!token) {
  // ya usado, expirado, o inexistente
  throw new AppError(...);
}
```

Esto previene race conditions si el usuario hace doble click y se envían dos requests simultáneos.

### 6.3. Auditoría

Cada endpoint llama a `auditLog.create()` con el evento correspondiente. Eventos exactos en `01-architecture-and-models.md` sección 3.4.

---

## 7. Cliente OpenAPI / Postman collection (futuro)

No se incluye en este sprint, pero al cerrar la implementación se puede generar un export Postman para tener documentación interactiva.

---

**Documento siguiente:** [`06-email-templates.md`](./06-email-templates.md) — diseño visual y contenido de las plantillas de correo.
