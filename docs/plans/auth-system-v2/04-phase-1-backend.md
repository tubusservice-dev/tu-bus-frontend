# Fase 1 — Refactor backend de flujos de autenticación

**Objetivo:** implementar Casos 1–3 + unificación Caso 5 + logout robusto + refuerzo bloqueo.

---

## 1.1. OAuth Google sin auto-vinculación silenciosa (Caso 1)

**Archivo:** `backend/src/config/passport.ts`

Lógica final del callback:

```ts
const user = await User.findOne({ googleId: profile.id });
const googleAvatar = profile.photos?.[0]?.value;

if (user) {
  // Update avatar/name if missing
  let needsSave = false;
  if (googleAvatar && user.avatar !== googleAvatar) { user.avatar = googleAvatar; needsSave = true; }
  if (!user.firstName && profile.name?.givenName) { user.firstName = profile.name.givenName; needsSave = true; }
  if (!user.lastName && profile.name?.familyName) { user.lastName = profile.name.familyName; needsSave = true; }
  if (needsSave) await user.save();
  return done(null, user);
}

// New googleId. Check if email already exists (rejected — security boundary).
const email = profile.emails?.[0]?.value;
if (email) {
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    // Reject: silent linking is a hijack vector
    return done(new Error('EMAIL_ALREADY_REGISTERED_LOCAL'), undefined);
  }
}

const created = await User.create({
  googleId: profile.id,
  email: email?.toLowerCase(),
  firstName: profile.name?.givenName || '',
  lastName: profile.name?.familyName || '',
  avatar: googleAvatar,
  isVerified: true,
  profileCompleted: false,
});
return done(null, created);
```

**Archivo:** `backend/src/modules/users/controllers/auth.controller.ts` → `oauthCallback`

Mapear el error a un redirect con código:

```ts
if (error.message === 'EMAIL_ALREADY_REGISTERED_LOCAL') {
  res.redirect(
    `${config.clientUrl}/auth/callback?error=EMAIL_ALREADY_REGISTERED_LOCAL`
  );
  return;
}
```

Frontend muestra mensaje: "Este correo ya tiene una cuenta. Inicia sesión con tu contraseña."

---

## 1.2. Endpoints nuevos para Caso 3

### `POST /auth/link-account`

**Archivo:** `backend/src/modules/users/controllers/auth.controller.ts`

Método `linkAccount`:

1. Recibe el mismo payload que `register`.
2. `userService.findByEmail(email)`:
   - **No existe** → delegar a flujo `register` normal (extraer helper compartido).
   - **Existe + tiene password** → 409 `EMAIL_ALREADY_REGISTERED`.
   - **Existe + Google-only (sin password)** → flujo de vinculación:
     1. Asignar campos del payload sobre el user existente (preservar `_id`, `googleId`, `email`).
     2. Setear password (pre-save hook hashea + actualiza `passwordChangedAt`).
     3. Pre-save hook recalcula `profileCompleted`.
     4. `user.save()`.
     5. `authTokenService.createToken({ purpose: ACCOUNT_LINK_VERIFICATION, ttlMinutes: config.accountLink.tokenTTLMinutes })`.
     6. `mailService.sendAccountLinkEmail(...)`.
     7. `emailLogService.log(ACCOUNT_LINK_VERIFICATION, SENT/FAILED)`.
     8. Audit log `ACCOUNT_LINK_REQUESTED`.
     9. Responder `{ success: true, data: { requiresLinkVerification: true } }` SIN auto-login.

### `POST /auth/verify-account-link`

Método `verifyAccountLink`:

1. Consume token con `purpose: ACCOUNT_LINK_VERIFICATION`.
2. Carga user.
3. Marca `isVerified: true` (idempotente).
4. Recalcula `profileCompleted` (pre-save hook).
5. Genera JWT (auto-login).
6. Audit log `ACCOUNT_LINK_COMPLETED`.
7. Responde `{ success: true, data: { user, token } }`.

### Rutas

**Archivo:** `backend/src/modules/users/routes/auth.routes.ts`

```ts
router.post('/link-account',
  registerRateLimit, enforceEmailQuota,
  registerValidation, validateRequest,
  authController.linkAccount.bind(authController));

router.post('/verify-account-link',
  verifyEmailRateLimit, tokenOnlyValidation, validateRequest,
  authController.verifyAccountLink.bind(authController));
```

---

## 1.3. Refactor `forgotPassword` — Casos 4 y 5 unificados

**Archivo:** `backend/src/modules/users/controllers/auth.controller.ts:305`

Lógica final:

```ts
const user = await userService.findByEmail(normalizedEmail);

if (!user) {
  // ... audit, response { exists: false }
  return;
}

// Caso 5: Google-only (sin password) → no envía correo, deriva al frontend
const isOAuthOnly = !user.password && !!user.googleId;
if (isOAuthOnly) {
  await authAuditLogService.record({
    event: PASSWORD_RESET_REQUESTED,
    userId: user._id,
    success: true,
    metadata: { redirectedToAccountLink: true },
  });
  res.json({ success: true, data: { exists: true, requiresAccountLink: true } });
  return;
}

// Caso 4: flujo normal de password reset
// ... rate-limit per-email (fix bug `>` → `>=`) ...
// ... crear AuthToken PASSWORD_RESET, sendPasswordResetEmail, log, audit ...
res.json({ success: true, data: { exists: true } });
```

**Eliminar:**
- Doble conteo `oauthSentInWindow` (líneas 339-344).
- Rama `isOAuth` que enviaba `OAUTH_RESET_INFO`.

**Fix:** `>` → `>=` en línea 345 para respetar el cap correctamente.

---

## 1.4. Eliminación de OAUTH_RESET_INFO

### Archivos a modificar

- `backend/src/modules/email-logs/interfaces/email-log.interface.ts` → eliminar `OAUTH_RESET_INFO` del enum.
- `backend/src/shared/services/mail/mail.service.ts` → eliminar método `sendOAuthResetInfoEmail` y `OAuthResetInfoEmailArgs`.

### Archivos a eliminar

- `backend/src/shared/templates/emails/oauth-reset-info.html`
- `backend/src/shared/templates/emails/oauth-reset-info.txt`

---

## 1.5. Plantilla nueva `account-link-verification`

### Archivos nuevos

- `backend/src/shared/templates/emails/account-link-verification.html`
- `backend/src/shared/templates/emails/account-link-verification.txt`

### Variables Handlebars

- `firstName`, `verificationUrl`, `ttlHumanReadable`, `appName`, `supportEmail`, `currentYear`, `logoUrl`, `hasLogo`, `preheader`.

### Subject

`Vincula tu cuenta de Google con tu nueva contraseña en TuBus Express`

### Método nuevo en MailService

```ts
async sendAccountLinkEmail(args: AccountLinkEmailArgs): Promise<void>
```

---

## 1.6. Logout robusto

### Backend

**Archivo:** `backend/src/modules/users/controllers/auth.controller.ts:284`

Refactor `logout`:

```ts
async logout(req: Request, res: Response): Promise<void> {
  const ctx = getRequestContext(req);
  const authHeader = req.headers.authorization;

  // Best-effort: extract userId from JWT to invalidate sessions server-side.
  // Logout is idempotent — even with an invalid/expired token, return 200.
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], config.jwt.secret) as JwtPayload;
      if (decoded.role !== 'admin') {
        await User.updateOne(
          { _id: decoded.id },
          { $set: { tokensInvalidatedAt: new Date() } }
        );
        await authAuditLogService.record({
          event: AuthAuditEvent.LOGOUT,
          userId: decoded.id as any,
          email: decoded.email,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          success: true,
        });
      }
    } catch {
      // Invalid token — best-effort, ignore.
    }
  }

  req.logout((err) => {
    if (err) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Error al cerrar sesión' });
      return;
    }
    res.status(StatusCodes.OK).json({ success: true, message: 'Sesión cerrada exitosamente' });
  });
}
```

### Middleware

**Archivo:** `backend/src/shared/middlewares/auth.middleware.ts`

En `assertActiveUserById`, añadir:

```ts
if (user.tokensInvalidatedAt && jwtIat !== undefined) {
  const invalidatedAtMs = new Date(user.tokensInvalidatedAt).getTime();
  if (jwtIat * 1000 < invalidatedAtMs) {
    throw new AppError(
      'Tu sesión ha sido cerrada. Inicia sesión nuevamente.',
      StatusCodes.UNAUTHORIZED,
      { code: AUTH_ERROR_CODES.TOKEN_REVOKED }
    );
  }
}
```

Y seleccionar `tokensInvalidatedAt` en `User.findById(userId).select(...)`.

---

## 1.7. Refuerzo del sistema de bloqueo (Admin)

### `adminUserService.updateStatus`

**Archivo:** `backend/src/modules/admin/services/admin-user.service.ts:209`

Cuando status pasa a SUSPENDED/BLOCKED/DELETED:

- `tokensInvalidatedAt: new Date()` en el `$set`.
- Tras update: `authTokenService.invalidateAllForUserAcrossPurposes(userId)` (método nuevo).
- Audit log `ADMIN_BLOCKED_USER` con metadata `{ adminId, oldStatus, newStatus, reason, suspendedUntil }`.

### `adminUserService.delete`

Análogo:
- `tokensInvalidatedAt: new Date()`.
- Invalidar todos los AuthToken activos.
- Audit log `ADMIN_DELETED_USER`.

### Método nuevo en `AuthTokenService`

**Archivo:** `backend/src/modules/auth-tokens/services/auth-token.service.ts`

```ts
async invalidateAllForUserAcrossPurposes(
  userId: string | Types.ObjectId
): Promise<void> {
  await AuthToken.updateMany(
    { userId, usedAt: null },
    { $set: { usedAt: new Date() } }
  );
}
```

---

## 1.8. Endpoint admin force-logout

**Archivo:** `backend/src/modules/admin/controllers/admin-user.controller.ts`

Método `forceLogout`:

```ts
async forceLogout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const adminId = req.admin?.id;
    if (!adminId) throw new AppError('Administrador no autenticado', StatusCodes.UNAUTHORIZED);

    const userId = req.params.id;
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { tokensInvalidatedAt: new Date() } },
      { new: true }
    );
    if (!user) throw new AppError('Usuario no encontrado', StatusCodes.NOT_FOUND);

    await authTokenService.invalidateAllForUserAcrossPurposes(userId);

    await authAuditLogService.record({
      event: AuthAuditEvent.ADMIN_FORCE_LOGOUT,
      userId: userId as any,
      email: user.email,
      success: true,
      metadata: { adminId },
    });

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Sesiones del usuario revocadas exitosamente',
    });
  } catch (error) {
    next(error);
  }
}
```

### Ruta

**Archivo:** `backend/src/modules/admin/routes/users.routes.ts`

```ts
router.post('/:id/force-logout', adminUserController.forceLogout.bind(adminUserController));
```

---

## 1.9. Configuración

**Archivo:** `backend/src/config/index.ts`

Añadir bloque `accountLink`:

```ts
accountLink: {
  tokenTTLMinutes: parseIntEnv(process.env.ACCOUNT_LINK_TOKEN_TTL_MINUTES, 60),
},
```

**Archivo:** `backend/src/config/validate-env.ts`

Añadir regla numérica para `ACCOUNT_LINK_TOKEN_TTL_MINUTES` (5–10080).

---

## Validación de Fase 1

1. Tests unitarios de los nuevos endpoints.
2. Build backend sin warnings.
3. Smoke test manual:
   - Registro Google nuevo → `isVerified=true, profileCompleted=false`.
   - OAuth con email existente local → redirect con error code.
   - Caso 3: `POST /auth/link-account` → recibe email link → click → auto-login.
   - Forgot password Google-only → `requiresAccountLink: true` sin enviar correo.
   - Logout → JWT previo rechazado.
   - Bloqueo admin → JWT activo del user rechazado inmediatamente.
   - Force-logout admin → user puede volver a loguearse.
