# Flujos Detallados

> Diagramas paso a paso de cada flujo del sistema de autenticación. Cubre los caminos felices y los casos de error.

---

## Tabla de contenidos

1. [Registro con verificación de correo deshabilitada](#1-registro-con-verificación-deshabilitada)
2. [Registro con verificación de correo habilitada](#2-registro-con-verificación-habilitada)
3. [Login estándar](#3-login-estándar)
4. [Login con verificación pendiente](#4-login-con-verificación-pendiente)
5. [Verificación de correo desde el link del email](#5-verificación-de-correo)
6. [Reenvío de correo de verificación](#6-reenvío-de-verificación)
7. [Olvidé mi contraseña — correo registrado normal](#7-olvidé-contraseña--cuenta-normal)
8. [Olvidé mi contraseña — correo OAuth](#8-olvidé-contraseña--cuenta-oauth)
9. [Olvidé mi contraseña — correo no registrado](#9-olvidé-contraseña--correo-no-existe)
10. [Reset de contraseña desde el link](#10-reset-de-contraseña)
11. [Validación de email único en tiempo real](#11-validación-email-único)

---

## 1. Registro con verificación deshabilitada

**Precondición:** `EMAIL_VERIFICATION_REQUIRED=false`

```
[Frontend] Usuario completa form de registro (auth-modal, 2 steps)
     ↓
[Frontend] POST /api/auth/register { email, password, ... }
     ↓
[Backend] auth.routes.ts → registerValidation (express-validator)
     ↓
[Backend] auth.controller.register()
     ├─ userService.create():
     │    ├─ User.findOne({ email: lowercase }) → si existe, throw 409
     │    └─ User.create({ ..., requiresEmailVerification: false, isVerified: false })
     │       (try/catch E11000 por race condition)
     ├─ generateToken(user) → JWT
     └─ Response: { success: true, data: { user, token } }
     ↓
[Frontend] AuthService.handleAuthSuccess() → guarda token + user en localStorage
     ↓
[Frontend] auth-modal: muestra modal de éxito "¡Registro exitoso!" + botón "Continuar"
     ↓
[Usuario] Click "Continuar" → modal cierra → usuario ya logueado
```

**Estado en BD:**
- `User.isVerified = false`
- `User.requiresEmailVerification = false`
- `User.passwordChangedAt = undefined`

**Resultado:** Usuario logueado con JWT válido. Puede usar el sistema.

---

## 2. Registro con verificación habilitada

**Precondición:** `EMAIL_VERIFICATION_REQUIRED=true`

```
[Frontend] Usuario completa form de registro
     ↓
[Frontend] POST /api/auth/register { email, password, ... }
     ↓
[Backend] auth.controller.register()
     ├─ userService.create({ ..., requiresEmailVerification: true, isVerified: false })
     ├─ Genera AuthToken { purpose: 'email_verification', expiresAt: now + 1h }
     ├─ mailService.send() → correo de verificación
     ├─ auditLog.create({ event: 'email_verification_requested', success: true })
     └─ Response (SIN token JWT):
        {
          success: true,
          data: { user: {...}, requiresVerification: true },
          message: 'Te enviamos un correo para verificar tu cuenta'
        }
     ↓
[Frontend] AuthService.register():
     ├─ Detecta `requiresVerification: true` en response
     ├─ NO llama handleAuthSuccess() (no guarda token, no loguea)
     └─ Devuelve flag al componente
     ↓
[Frontend] auth-modal: muestra VerifyEmailPendingModal:
     "¡Registro exitoso, {firstName}!
      Te hemos enviado un correo a {email}.
      Revisa tu bandeja de entrada y haz click en el link
      para activar tu cuenta.

      [Reenviar correo]   [Continuar]"
     ↓
[Usuario] Click "Continuar" → modal cierra → usuario NO está logueado
```

**Estado en BD:**
- `User.isVerified = false`
- `User.requiresEmailVerification = true`
- `AuthToken` creado con `purpose: 'email_verification'`

**Resultado:** Usuario sin sesión. Debe ir al correo para activar la cuenta.

---

## 3. Login estándar

**Precondición:** Usuario existe, `requiresEmailVerification=false` (o `isVerified=true`)

```
[Frontend] auth-modal: tab Login → submit
     ↓
[Frontend] POST /api/auth/login { email, password }
     ↓
[Backend] auth.controller.login()
     ├─ userService.findByEmail(email.toLowerCase().trim())
     ├─ user.comparePassword(password) → throw si no match
     ├─ assertAccountUsable(user) → status checks (active, suspended, etc.)
     ├─ assertEmailVerified(user) → SI requiere verif y no verificado → throw 403
     ├─ generateToken(user) → JWT
     ├─ auditLog.create({ event: 'login_attempt', success: true })
     └─ Response: { success: true, data: { user, token } }
     ↓
[Frontend] AuthService.handleAuthSuccess() → guarda y setea currentUser
     ↓
[Frontend] auth-modal cierra → usuario logueado
```

---

## 4. Login con verificación pendiente

**Precondición:** Usuario existe, `requiresEmailVerification=true`, `isVerified=false`

```
[Frontend] auth-modal: tab Login → submit
     ↓
[Frontend] POST /api/auth/login
     ↓
[Backend] auth.controller.login()
     ├─ user encontrado, password correcto
     ├─ assertEmailVerified(user) → falla
     │   throw new AppError('Verifica tu correo', 403, {
     │     code: 'EMAIL_NOT_VERIFIED'
     │   })
     ├─ auditLog.create({ event: 'login_attempt', success: false, ...metadata })
     └─ Response: { success: false, message, code: 'EMAIL_NOT_VERIFIED' }
     ↓
[Frontend] auth-modal detecta `code: 'EMAIL_NOT_VERIFIED'`:
     "Debes verificar tu correo electrónico antes de iniciar sesión.
      [Reenviar correo de verificación]"
     ↓
[Usuario] Click "Reenviar"
     ↓
[Frontend] POST /api/auth/resend-verification { email }
     (continúa en flujo 6)
```

---

## 5. Verificación de correo

**Precondición:** Usuario hizo click en link del correo

```
URL del correo: {VERIFY_EMAIL_URL}?token=abc123...
     ↓
[Frontend] Ruta /verify-email → VerifyEmailComponent.ngOnInit()
     ↓
[Frontend] POST /api/auth/verify-email { token }
     ↓
[Backend] auth.controller.verifyEmail()
     ├─ Hash el token recibido
     ├─ AuthToken.findOne({ tokenHash, purpose: 'email_verification', usedAt: null })
     │   ├─ No existe → throw 'Token inválido o ya usado'
     │   └─ existe pero expiresAt < now → throw 'Token expirado'
     ├─ user = User.findById(token.userId)
     ├─ user.isVerified = true
     ├─ user.requiresEmailVerification = false
     ├─ user.save()
     ├─ token.usedAt = new Date(); token.save()
     ├─ auditLog.create({ event: 'email_verification_completed' })
     └─ Response: { success: true }
     ↓
[Frontend] VerifyEmailComponent muestra:
     "¡Correo verificado!
      Tu cuenta está activa. Ahora puedes iniciar sesión.
      [Iniciar sesión]"
     ↓
[Usuario] Click → redirect al home con auth-modal abierto en tab Login
```

**Casos de error:**
- Token expirado: muestra "El link ha expirado" + botón "Reenviar correo"
- Token inválido: muestra "Link inválido o ya usado"

---

## 6. Reenvío de verificación

**Trigger:** Botón "Reenviar correo" en modal post-registro o en error de login no-verificado

```
[Frontend] POST /api/auth/resend-verification { email }
     ↓
[Backend] Rate limit middleware:
     ├─ Cuenta envíos previos a este email en las últimas 1h
     │   (consulta EmailLog donde to=email AND purpose='email_verification')
     ├─ Si supera MAX_VERIFICATION_RESEND_RETRIES + 1 → 429 Too Many Requests
     └─ Si supera MAX_EMAILS_PER_DAY_GLOBAL → registra alerta + 503
     ↓
[Backend] auth.controller.resendVerification()
     ├─ user = userService.findByEmail(email)
     ├─ Si no existe O ya está verificado → respuesta genérica de éxito
     │   (anti-enumeración)
     ├─ Invalida AuthTokens previos del usuario (purpose=email_verification)
     ├─ Genera nuevo AuthToken
     ├─ mailService.send()
     └─ Response: { success: true, message: 'Correo enviado' }
     ↓
[Frontend] muestra confirmación "Correo enviado, revisa tu bandeja"
```

---

## 7. Olvidé contraseña — cuenta normal

**Precondición:** Email registrado, sin `googleId` ni `facebookId`

```
[Frontend] auth-modal login: click "¿Olvidaste tu contraseña?"
     ↓
[Frontend] Abre ForgotPasswordModal con campo email
     ↓
[Usuario] Escribe email + click "Enviar"
     ↓
[Frontend] POST /api/auth/forgot-password { email }
     ↓
[Backend] Rate limit middleware (per-email + global)
     ↓
[Backend] auth.controller.forgotPassword()
     ├─ user = userService.findByEmail(email.toLowerCase().trim())
     ├─ Si no existe → Response { exists: false } (ver flujo 9)
     ├─ Si user.googleId || user.facebookId → ver flujo 8
     ├─ Caso normal:
     │    ├─ Invalida AuthTokens previos (purpose=password_reset)
     │    ├─ Genera AuthToken { purpose: 'password_reset', expiresAt: now+30min }
     │    ├─ mailService.send() → correo con link RESET_PASSWORD_URL?token=X
     │    ├─ auditLog.create({ event: 'password_reset_requested', success: true })
     │    └─ Response: { success: true, exists: true, isOAuth: false }
     ↓
[Frontend] ForgotPasswordModal cierra → abre EmailSentModal:
     "📧 Te hemos enviado un correo a {email}.
      Revisa tu bandeja y haz click en el link.
      El link expira en 30 minutos."
     ↓
[Usuario] Cierra el modal y va a su correo
     (continúa en flujo 10)
```

---

## 8. Olvidé contraseña — cuenta OAuth

**Precondición:** Email registrado con `googleId` o `facebookId`

```
[Frontend] POST /api/auth/forgot-password { email }
     ↓
[Backend] auth.controller.forgotPassword()
     ├─ user encontrado con googleId/facebookId
     ├─ Genera AuthToken { purpose: 'password_reset', expiresAt: now+30min }
     ├─ mailService.send() → correo INFORMATIVO con dos opciones:
     │    "Hola {firstName},
     │     Tu cuenta TuBus está vinculada con Google.
     │     Te recomendamos iniciar sesión con el botón de Google.
     │
     │     [Iniciar con Google]
     │
     │     ¿Prefieres crear una contraseña?
     │     Click aquí: {RESET_PASSWORD_URL}?token=X
     │     Tras crear tu contraseña podrás entrar por ambos métodos."
     ├─ auditLog.create({ event: 'password_reset_requested', metadata: { isOAuth: true } })
     └─ Response: { success: true, exists: true, isOAuth: true }

     NOTA: La response NO revela isOAuth al frontend en pantalla.
     El frontend trata todos los casos exists=true igual.
     ↓
[Frontend] EmailSentModal (mismo modal genérico)
```

**Tras click en link del correo:** flujo 10 estándar. Cuando guarda la contraseña, el `googleId` se mantiene → cuenta híbrida.

---

## 9. Olvidé contraseña — correo no existe

**Precondición:** El correo no está registrado en la BD

```
[Frontend] POST /api/auth/forgot-password { email }
     ↓
[Backend] auth.controller.forgotPassword()
     ├─ user = null (no existe)
     ├─ NO se envía correo (decisión: ahorrar cuota Resend)
     ├─ auditLog.create({
     │     event: 'password_reset_requested',
     │     email,
     │     success: false,
     │     metadata: { reason: 'email_not_registered' }
     │   })
     └─ Response: { success: true, exists: false }
     ↓
[Frontend] ForgotPasswordModal cierra → abre EmailNotFoundModal:
     "❓ No encontramos una cuenta con el correo {email}.
      ¿Quieres registrarte?
      [Registrarme]   [Cancelar]"
     ↓
[Usuario] Click "Registrarme" → abre auth-modal en tab Register
                              con email pre-completado
```

**Nota de seguridad:** Esta es la **excepción aceptada** al principio anti-enumeración. Riesgo aceptado en favor de UX clara.

---

## 10. Reset de contraseña

**Precondición:** Usuario hizo click en link del correo

```
URL del correo: {RESET_PASSWORD_URL}?token=abc123...
     ↓
[Frontend] Ruta /reset-password?token=X → ResetPasswordComponent.ngOnInit()
     ↓
[Frontend] GET /api/auth/reset-password/verify?token=X
     ↓
[Backend] auth.controller.verifyResetToken()
     ├─ Hash el token
     ├─ AuthToken.findOne({ tokenHash, purpose: 'password_reset', usedAt: null })
     ├─ Validar expiresAt
     ├─ Si OK → Response { valid: true }
     └─ Si no → Response { valid: false, reason: 'expired'|'used'|'invalid' }
     ↓
[Frontend] Si valid:
     Muestra form { newPassword, confirmPassword } + botón "Cambiar contraseña"
     Si no:
     Muestra "Link expirado/inválido" + botón "Solicitar uno nuevo"
     ↓
[Usuario] Llena form → submit
     ↓
[Frontend] POST /api/auth/reset-password { token, newPassword }
     ↓
[Backend] auth.controller.resetPassword()
     ├─ Valida que newPassword ≥ 6 caracteres (regla actual)
     ├─ Hash el token, busca AuthToken válido (no usado, no expirado)
     ├─ user = User.findById(token.userId)
     ├─ user.password = newPassword (pre-save hook hace bcrypt)
     ├─ user.passwordChangedAt = new Date()  ← invalida JWT viejos
     ├─ user.save()
     ├─ token.usedAt = new Date(); token.save()
     ├─ Invalida tokens hermanos (otros AuthToken del mismo user con purpose=password_reset)
     ├─ auditLog.create({ event: 'password_reset_completed' })
     │   (si era OAuth → también auditLog event: 'oauth_account_password_set')
     └─ Response: { success: true, message: 'Contraseña actualizada' }
     ↓
[Frontend] ResetPasswordComponent muestra:
     "✅ ¡Contraseña actualizada!
      Ya puedes iniciar sesión con tu nueva contraseña.
      [Iniciar sesión]"
     ↓
[Usuario] Click → redirige al home con auth-modal abierto en tab Login
```

**Resultado clave para cuenta OAuth:** `googleId` se mantiene. El usuario ahora puede entrar con Google **o** con email/contraseña.

---

## 11. Validación email único (tiempo real)

**Trigger:** Usuario escribe email en form de registro y pierde el foco

```
[Frontend] Validador async (debounce 400ms al perder foco):
     ↓
[Frontend] POST /api/auth/check-email { email }
     ↓
[Backend] Rate limit (30/min por IP)
     ↓
[Backend] auth.controller.checkEmail()
     ├─ exists = await User.exists({ email: email.toLowerCase() })
     └─ Response: { exists: !!exists }
     ↓
[Frontend] Si exists → marca campo email como inválido:
     "Este correo ya está registrado.
      ¿Olvidaste tu contraseña?"
     (link a forgot-password con email pre-completado)
```

**Beneficio UX:** evita que el usuario llegue al final del registro (paso 2) para descubrir que el email ya existe.

---

## 12. Resumen de los 3 escenarios de "Olvidé mi contraseña"

| Escenario | Backend | Correo enviado | Frontend muestra |
|-----------|---------|----------------|------------------|
| Email no existe | Sin envío. Registra audit | ❌ | EmailNotFoundModal con CTA "Registrarte" |
| Email normal | Crea AuthToken + envía | ✅ Reset estándar | EmailSentModal genérico |
| Email OAuth | Crea AuthToken + envía | ✅ Informativo dual | EmailSentModal genérico |

El frontend siempre muestra el mismo modal genérico cuando `exists=true` (anti-enumeración para distinguir OAuth/normal). La distinción entre normal y OAuth se hace **dentro del correo**.

---

## 13. Estados del usuario y transiciones

```
[Registrarse]
       │
       ├─ EMAIL_VERIFICATION_REQUIRED=false →  [LOGUEADO]
       │
       └─ EMAIL_VERIFICATION_REQUIRED=true →   [PENDIENTE-VERIF]
                                                       │
                                          (click link en correo)
                                                       ↓
                                                  [VERIFICADO]
                                                       │
                                                  (login)
                                                       ↓
                                                  [LOGUEADO]


[LOGUEADO] ── (logout) ──→ [SLOGUEADO]
            ── (forgot password + reset) ──→ [LOGUEADO con nueva contraseña + JWT viejos invalidados]


[PENDIENTE-VERIF] ── (3 días sin verificar) ──→ [ELIMINADO por cron]
```

---

**Documento siguiente:** [`03-security-and-owasp.md`](./03-security-and-owasp.md) — análisis de seguridad y mitigaciones.
