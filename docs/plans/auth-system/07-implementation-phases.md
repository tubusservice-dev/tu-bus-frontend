# Plan de Implementación por Fases

> Detalle de las 5 fases del proyecto. Cada fase es independiente, revisable, y debe aprobarse antes de pasar a la siguiente.

---

## Resumen de fases

| Fase | Tema | Tiempo estimado | Dependencias |
|------|------|----------------|--------------|
| **0** | Infraestructura de correos | 1 día | — |
| **1** | Modelos de BD | 0.5 día | Fase 0 |
| **2** | Backend (endpoints + servicios) | 2 días | Fase 1 |
| **3** | Frontend (componentes + páginas) | 2 días | Fase 2 |
| **4** | Auditoría + cron + monitoreo | 0.5 día | Fase 3 |

**Total estimado: ~6 días de trabajo enfocado.**

---

## FASE 0 — Infraestructura de correos

**Objetivo:** Tener una infraestructura reutilizable de envío de correos. Probada y funcional. Sin endpoints aún.

### 0.1. Tareas

#### Backend

- [ ] **0.1.** Instalar dependencias:
  ```bash
  npm install resend handlebars express-rate-limit
  npm install --save-dev @types/handlebars
  ```

- [ ] **0.2.** Agregar las 14 variables de entorno (ver `04-environment-variables.md`):
  - `RESEND_API_KEY`
  - `RESEND_FROM_EMAIL`
  - `EMAIL_VERIFICATION_REQUIRED`
  - `EMAIL_VERIFICATION_TOKEN_TTL_MINUTES`
  - `PASSWORD_RESET_TOKEN_TTL_MINUTES`
  - `MAX_PASSWORD_RESET_RETRIES`
  - `PASSWORD_RESET_RETRIES_RESET_HOURS`
  - `MAX_VERIFICATION_RESEND_RETRIES`
  - `VERIFICATION_RESEND_RETRIES_RESET_HOURS`
  - `MAX_EMAILS_PER_DAY_GLOBAL`
  - `ZOMBIE_ACCOUNT_CLEANUP_AFTER_HOURS`
  - `RESET_PASSWORD_URL`
  - `VERIFY_EMAIL_URL`

- [ ] **0.3.** Actualizar `backend/src/config/index.ts` con las secciones `resend`, `emailVerification`, `passwordReset`, `rateLimit`, `zombieCleanup` y `urls` (ver bloque completo en `01-architecture-and-models.md` sección 6).

- [ ] **0.4.** Crear `backend/src/server.ts` función `validateAuthEnv()` (validación al arranque con rangos según `04-environment-variables.md` sección 4).

- [ ] **0.5.** Crear estructura de carpetas:
  ```
  backend/src/shared/services/mail/
  ├── interfaces/mail-provider.interface.ts
  ├── providers/resend.provider.ts
  ├── providers/mock.provider.ts
  └── mail.service.ts

  backend/src/shared/templates/emails/
  ├── base.html
  ├── email-verification.html
  ├── email-verification.txt
  ├── password-reset.html
  ├── password-reset.txt
  ├── oauth-reset-info.html
  └── oauth-reset-info.txt
  ```

- [ ] **0.6.** Implementar `IMailProvider` interface (1 método: `send`).

- [ ] **0.7.** Implementar `ResendProvider`:
  - Inicializa cliente Resend con API key
  - Método `send` con retry automático (3 intentos, backoff exponencial)
  - Maneja errores específicos de Resend (rate limit, cuota agotada)

- [ ] **0.8.** Implementar `MockMailProvider` (para tests):
  - Captura llamadas a `send` en un array
  - No envía nada real

- [ ] **0.9.** Implementar `MailService`:
  - Constructor recibe `IMailProvider` + `fromEmail`
  - Métodos: `sendVerificationEmail`, `sendPasswordResetEmail` (con flag `isOAuth`)
  - Renderiza plantillas HTML + texto con Handlebars
  - Variables comunes inyectadas (appName, logoUrl, currentYear)

- [ ] **0.10.** Crear las 3 plantillas HTML siguiendo `06-email-templates.md`.

- [ ] **0.11.** Crear las 3 plantillas TXT (texto plano alternativo).

- [ ] **0.12.** Wiring en `app.ts` o en módulo de inicialización:
  ```typescript
  import { ResendProvider } from './shared/services/mail/providers/resend.provider';
  import { MailService } from './shared/services/mail/mail.service';
  import { config } from './config';

  const mailProvider = new ResendProvider(config.resend.apiKey);
  export const mailService = new MailService(mailProvider, config.resend.fromEmail);
  ```

### 0.2. Pruebas de la fase

Crear un script temporal `backend/src/scripts/test-mail.ts` que envíe un correo de prueba a una dirección verificada en Resend. Borrar el script al cerrar la fase.

### 0.3. Criterio de aceptación de Fase 0

- ✅ Recibo un correo de prueba en mi bandeja desde el script.
- ✅ El correo tiene el diseño esperado (logo, colores, botón).
- ✅ Funciona también con texto plano (verificar en cliente sin HTML).
- ✅ Si la API key es inválida, el sistema falla con un mensaje claro.
- ✅ Los reintentos funcionan (simular fallo y verificar backoff).

---

## FASE 1 — Modelos de BD

**Objetivo:** Crear todos los modelos nuevos y modificar el modelo `User`. Sin lógica de negocio aún.

### 1.1. Tareas

#### Backend

- [ ] **1.1.** Crear módulo `auth-tokens/`:
  ```
  backend/src/modules/auth-tokens/
  ├── interfaces/auth-token.interface.ts
  ├── models/auth-token.model.ts
  ├── services/auth-token.service.ts        ← solo signaturas vacías por ahora
  └── index.ts
  ```

  El modelo debe tener:
  - Campos: `userId`, `tokenHash`, `purpose`, `expiresAt`, `usedAt`, `ipAddress`, `userAgent`
  - Índices: compound `{ tokenHash, purpose }`, `{ userId, purpose }`, TTL en `expiresAt`

- [ ] **1.2.** Crear módulo `email-logs/`:
  ```
  backend/src/modules/email-logs/
  ├── interfaces/email-log.interface.ts
  ├── interfaces/email-quota-alert.interface.ts
  ├── models/email-log.model.ts
  ├── models/email-quota-alert.model.ts
  ├── services/email-log.service.ts          ← signaturas vacías
  └── index.ts
  ```

  Modelo `EmailLog`:
  - Campos: `to`, `purpose`, `subject`, `status`, `errorMessage`, `userId`, `ipAddress`, `createdAt`
  - Índices: `{ createdAt: -1 }`, `{ to, purpose, createdAt: -1 }`

- [ ] **1.3.** Crear módulo `audit-logs/`:
  ```
  backend/src/modules/audit-logs/
  ├── interfaces/auth-audit-log.interface.ts
  ├── models/auth-audit-log.model.ts
  ├── services/auth-audit-log.service.ts     ← signaturas vacías
  └── index.ts
  ```

  Modelo `AuthAuditLog`:
  - Campos: `event`, `userId`, `email`, `ipAddress`, `userAgent`, `success`, `metadata`, `createdAt`
  - Índice: `{ createdAt: -1 }`, `{ userId, event, createdAt: -1 }`

- [ ] **1.4.** Modificar `backend/src/modules/users/models/user.model.ts`:
  - Agregar campo `passwordChangedAt: Date?`
  - Agregar campo `requiresEmailVerification: Boolean` (default `false`)

- [ ] **1.5.** Modificar `backend/src/modules/users/interfaces/user.interface.ts`:
  - Agregar los nuevos campos en `IUser`

- [ ] **1.6.** Crear script de migración (opcional pero recomendado):
  ```
  backend/src/scripts/migrate-add-auth-fields.ts
  ```
  Setea explícitamente `requiresEmailVerification: false` en todos los usuarios existentes.

### 1.2. Criterio de aceptación de Fase 1

- ✅ `npm run build` sin errores de TypeScript.
- ✅ Conectarse a MongoDB y verificar que las colecciones se crean al primer insert.
- ✅ Los TTL indexes están configurados en `AuthToken.expiresAt`.
- ✅ El script de migración corre sin errores y deja a todos los usuarios con `requiresEmailVerification: false`.

---

## FASE 2 — Backend (endpoints + servicios + middlewares)

**Objetivo:** Implementar toda la lógica de backend. Endpoints funcionales, probables con Postman/curl.

### 2.1. Tareas — Servicios

- [ ] **2.1.** Implementar `AuthTokenService`:
  - `createToken({ userId, purpose, ipAddress, userAgent }) → { rawToken, token }`
    - Genera raw token con `crypto.randomBytes(32)`
    - Hash con SHA-256
    - Calcula `expiresAt` según purpose
    - Invalida tokens previos del mismo `userId + purpose`
    - Guarda y devuelve raw token + documento
  - `consumeToken(rawToken, purpose) → IAuthToken`
    - Hash el raw token
    - `findOneAndUpdate` atómico (set `usedAt`) con condiciones
    - Tira `AppError` con códigos específicos según el caso
  - `verifyTokenWithoutConsuming(rawToken, purpose) → { valid: boolean, reason?: string }`
    - Solo lectura, no marca `usedAt`

- [ ] **2.2.** Implementar `EmailLogService`:
  - `log({ to, purpose, status, ... })` → crea registro
  - `countSentInWindow({ to?, purpose?, sinceMinutesAgo }) → number` → para validar caps
  - `countSentGlobalLast24h() → number` → para validar cap global

- [ ] **2.3.** Implementar `EmailQuotaAlertService`:
  - `recordIfNeeded({ dailyCap, currentCount })` → solo crea alerta si no hay una en las últimas 24h

- [ ] **2.4.** Implementar `AuthAuditLogService`:
  - `record({ event, userId?, email?, ip, userAgent, success, metadata })` → crea registro

### 2.2. Tareas — Middlewares

- [ ] **2.5.** Implementar `rate-limit.middleware.ts`:
  - Wrapper sobre `express-rate-limit` con presets:
    - `loginRateLimit` (5/15min)
    - `registerRateLimit` (3/hora)
    - `forgotPasswordRateLimit` (3/hora)
    - `resendVerificationRateLimit` (3/hora)
    - `verifyEmailRateLimit` (10/5min)
    - `resetPasswordRateLimit` (5/15min)
    - `verifyResetTokenRateLimit` (10/5min)
    - `checkEmailRateLimit` (30/min)

- [ ] **2.6.** Implementar middleware `enforceEmailQuota.middleware.ts`:
  - Antes de los endpoints que envían correo
  - Consulta `EmailLogService.countSentGlobalLast24h()`
  - Si excede `MAX_EMAILS_PER_DAY_GLOBAL` → 503 + `EmailQuotaAlertService.recordIfNeeded()`

- [ ] **2.7.** Modificar `backend/src/shared/middlewares/auth.middleware.ts`:
  - En `authenticate`, tras decodificar el JWT, leer `User.passwordChangedAt`
  - Si `jwtPayload.iat * 1000 < passwordChangedAt.getTime()` → 401 + `code: 'TOKEN_REVOKED'`

### 2.3. Tareas — Controllers y rutas

- [ ] **2.8.** Modificar `auth.controller.ts`:
  - `register`:
    - Capturar `MongoServerError E11000` y mapear a `AppError(409, EMAIL_ALREADY_REGISTERED)`
    - Si `config.emailVerification.required === true`:
      - NO generar JWT
      - Crear AuthToken purpose=email_verification
      - Enviar correo
      - Audit log
      - Response sin token, con `requiresVerification: true`
    - Caso normal → flujo actual (auto-login)
  - `login`:
    - Normalizar email (lowercase + trim)
    - Audit log de cada intento
    - Si user requiere verif y no verificado → 403 + `EMAIL_NOT_VERIFIED`

- [ ] **2.9.** Implementar nuevos métodos en `auth.controller.ts`:
  - `forgotPassword`
  - `resetPassword`
  - `verifyResetToken`
  - `verifyEmail`
  - `resendVerification`
  - `checkEmail`

  Cada uno sigue el flujo descrito en `02-detailed-flows.md` y el contrato en `05-api-contracts.md`.

- [ ] **2.10.** Modificar `backend/src/modules/users/services/user.service.ts`:
  - `create`: try/catch para E11000 → throw `AppError(409, EMAIL_ALREADY_REGISTERED)`
  - `findByEmail`: normalizar input (`email.toLowerCase().trim()`)

- [ ] **2.11.** Modificar `backend/src/modules/users/routes/auth.routes.ts`:
  - Aplicar rate limit middlewares a las rutas existentes (`login`, `register`)
  - Agregar las nuevas rutas con sus middlewares

  ```typescript
  router.post('/forgot-password',
    forgotPasswordRateLimit,
    enforceEmailQuota,
    forgotPasswordValidation,
    validateRequest,
    authController.forgotPassword.bind(authController)
  );
  // ... etc
  ```

- [ ] **2.12.** Crear validaciones express-validator para los nuevos endpoints (en el mismo `auth.routes.ts` o archivo separado).

### 2.4. Pruebas manuales de Fase 2

Con Postman/curl, probar cada endpoint. Verificar:
- Códigos HTTP correctos
- Códigos de error en responses
- Que efectivamente se crean documentos en BD
- Que el audit log captura los eventos
- Que el rate limit bloquea tras N intentos
- Que el cap global rechaza con 503 cuando se excede

### 2.5. Criterio de aceptación de Fase 2

- ✅ Todos los endpoints documentados en `05-api-contracts.md` funcionan.
- ✅ El correo llega correctamente en cada flujo (verificación, reset normal, reset OAuth).
- ✅ Tokens expirados son rechazados.
- ✅ Tokens reutilizados son rechazados.
- ✅ Rate limit funciona.
- ✅ El JWT viejo de un usuario que reseteó contraseña es rechazado al usarlo.
- ✅ Audit log y EmailLog tienen entradas.

---

## FASE 3 — Frontend (componentes + páginas)

**Objetivo:** UI completa integrada con el backend. Usuario puede recuperar su contraseña end-to-end.

### 3.1. Tareas — Servicios y modelos

- [ ] **3.1.** Actualizar `frontend/src/app/models/auth.model.ts`:
  - Agregar interfaces: `ForgotPasswordRequest`, `ResetPasswordRequest`, `VerifyEmailRequest`, `CheckEmailResponse`, `ForgotPasswordResponse` (con flags `exists`, `requiresVerification`)

- [ ] **3.2.** Actualizar `frontend/src/app/core/services/auth.service.ts`:
  - Nuevos métodos:
    - `forgotPassword(email): Observable<...>`
    - `verifyResetToken(token): Observable<...>`
    - `resetPassword(token, newPassword): Observable<...>`
    - `verifyEmail(token): Observable<...>`
    - `resendVerification(email): Observable<...>`
    - `checkEmail(email): Observable<{ exists: boolean }>`
  - Modificar `register()`: detectar `requiresVerification: true` y NO llamar `handleAuthSuccess`.

### 3.2. Tareas — Validador async

- [ ] **3.3.** Crear `frontend/src/app/shared/validators/email-unique.validator.ts`:
  - Async validator que llama `authService.checkEmail(value)` con debounce 400ms
  - Devuelve `{ emailTaken: true }` si `exists: true`

### 3.3. Tareas — Componentes nuevos

- [ ] **3.4.** Crear `forgot-password-modal/`:
  - Modal con campo email + botón "Enviar"
  - Llama `authService.forgotPassword`
  - Si `exists: false` → emite evento para abrir `EmailNotFoundModal`
  - Si `exists: true` → emite evento para abrir `EmailSentModal`

- [ ] **3.5.** Crear `email-not-found-modal/`:
  - Mensaje "No encontramos cuenta con {email}"
  - Botón "Registrarme" → abre `auth-modal` en tab register con email pre-completado

- [ ] **3.6.** Crear `email-sent-modal/`:
  - Mensaje genérico "Te hemos enviado un correo a {email}"
  - Botón "Cerrar"

- [ ] **3.7.** Crear `verify-email-pending-modal/`:
  - Mensaje "Te enviamos un correo para verificar tu cuenta"
  - Botón "Reenviar correo" (con feedback de éxito)
  - Botón "Continuar" → cierra modal sin loguear

### 3.4. Tareas — Páginas nuevas

- [ ] **3.8.** Crear `features/reset-password/reset-password.component.ts`:
  - `ngOnInit`: leer `?token=X`, llamar `verifyResetToken`
  - Si válido → mostrar form `{ newPassword, confirmPassword }`
  - Si inválido → mostrar error + botón "Solicitar uno nuevo"
  - Submit → llamar `resetPassword`
  - Éxito → pantalla de éxito + botón "Iniciar sesión" (redirige a `/`)

- [ ] **3.9.** Crear `features/verify-email/verify-email.component.ts`:
  - `ngOnInit`: leer `?token=X`, llamar `verifyEmail`
  - Loading spinner mientras espera
  - Éxito → pantalla "Correo verificado, inicia sesión" + botón
  - Error → pantalla "Link expirado/inválido" + botón "Solicitar uno nuevo"

### 3.5. Tareas — Modificaciones

- [ ] **3.10.** Modificar `auth-modal.component.ts` y `.html`:
  - Agregar link "¿Olvidaste tu contraseña?" debajo del campo password (solo visible en mode='login')
  - Click → cierra `auth-modal` y emite evento para abrir `forgot-password-modal`
  - En `onRegister`, detectar `requiresVerification: true` y NO autoautenticar — mostrar `verify-email-pending-modal` en su lugar
  - En `onLogin`, detectar `code: 'EMAIL_NOT_VERIFIED'` y mostrar mensaje específico con botón "Reenviar"
  - En el form de registro paso 1, agregar el validador async `emailUniqueValidator` al campo email

- [ ] **3.11.** Modificar `app.routes.ts`:
  - Agregar ruta `/reset-password` → `ResetPasswordComponent`
  - Agregar ruta `/verify-email` → `VerifyEmailComponent`

- [ ] **3.12.** Modificar `header.component.ts` y `tubus-header.component.ts`:
  - Renderizar `forgot-password-modal`, `email-not-found-modal`, `email-sent-modal`, `verify-email-pending-modal` junto con el `auth-modal` actual
  - Sincronizar señales (cuando uno se abre, cierra los otros)

### 3.6. Criterio de aceptación de Fase 3

- ✅ Usuario puede hacer click en "¿Olvidaste tu contraseña?" desde el modal de login.
- ✅ Tras enviar email, se muestra el modal correcto (sent, not-found).
- ✅ El link del correo lleva al form de nueva contraseña.
- ✅ Tras cambiar la contraseña, el usuario puede entrar con la nueva.
- ✅ Si el token expiró, mensaje claro + acción para solicitar uno nuevo.
- ✅ La validación async muestra "ya registrado" en tiempo real durante el registro.
- ✅ Cuenta OAuth + reset = cuenta híbrida funcional (login con ambos métodos).
- ✅ Modal de "verificación pendiente" se muestra cuando la env está activa.

---

## FASE 4 — Auditoría, cron y monitoreo

**Objetivo:** Cerrar los flancos de operación y resiliencia.

### 4.1. Tareas

#### Backend

- [ ] **4.1.** Crear cron job `cleanup-zombie-accounts.cron.ts`:
  - **Frecuencia: cada hora** (en el minuto 0 — `0 * * * *`).
    Razón: respetar configuraciones bajas de `ZOMBIE_ACCOUNT_CLEANUP_AFTER_HOURS` (ej: `6h`).
  - Lee `config.zombieCleanup.afterHours` desde el config object.
  - Query:
    ```typescript
    const cutoff = new Date(Date.now() - config.zombieCleanup.afterHours * 60 * 60 * 1000);
    User.deleteMany({
      requiresEmailVerification: true,
      isVerified: false,
      createdAt: { $lt: cutoff }
    })
    ```
  - Loguear cantidad eliminada (console.log + AuthAuditLog evento `zombie_cleanup_run`)

- [ ] **4.2.** Registrar el cron en `app.ts` o `server.ts` usando `node-cron` (ya está como dep).

- [ ] **4.3.** Endpoint admin para consultar estadísticas (opcional pero recomendado):
  - `GET /api/admin/auth-stats`
  - Devuelve: emails enviados últimas 24h, alertas de cuota, intentos de login fallidos, etc.
  - Usar dentro de `admin/` siguiendo patrón existente.

- [ ] **4.4.** Verificar que TODOS los puntos clave llaman a `AuthAuditLogService`:
  - Registro exitoso
  - Login (éxito y fallo)
  - Forgot password (éxito y email no existente)
  - Reset password completado
  - Verificación de email completada
  - Reenvío de verificación
  - Cambio voluntario de contraseña (en `/users/change-password`)
  - Creación de cuenta híbrida (OAuth + password set)

### 4.2. Pruebas

- [ ] **4.5.** Crear cuenta no verificada en BD manualmente con `createdAt` antes del cutoff configurado. Esperar al próximo tick del cron (máx 1h) o forzar ejecución. Verificar eliminación.

- [ ] **4.6.** Hacer ataque manual a `/forgot-password` con 100 IPs distintas (simulado con script). Verificar que se alcanza el cap global y se registra `EmailQuotaAlert`.

### 4.3. Criterio de aceptación de Fase 4

- ✅ Cron limpia cuentas zombie correctamente.
- ✅ Cada evento sensible aparece en `AuthAuditLog`.
- ✅ Endpoint admin muestra estadísticas útiles.
- ✅ Cuando se alcanza el cap global, se registra una alerta y los siguientes envíos son rechazados con 503.

---

## Criterios globales de cierre del proyecto

Cuando las 5 fases están completas:

- [ ] Todos los criterios de aceptación de cada fase están cumplidos.
- [ ] Pruebas end-to-end manuales recorrieron los 11 flujos de `02-detailed-flows.md`.
- [ ] La documentación está actualizada (este folder).
- [ ] El `.env.example` refleja todas las variables nuevas.
- [ ] No hay TODOs, console.logs de debug, ni código comentado en los archivos.
- [ ] El proyecto compila sin warnings de TypeScript.
- [ ] No hay regresiones en flujos existentes (registro, login, OAuth, perfil).

---

**Documento siguiente:** [`08-final-checklist.md`](./08-final-checklist.md) — checklist consolidado y queries útiles para auditoría.
