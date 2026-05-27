# Variables de Entorno

> Documentación completa de las 14 variables de entorno del sistema de autenticación. Incluye defaults, validación, y ejemplos por entorno.

---

## 1. Resumen visual

```env
# === Resend ===
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# === Verificación de correo (sistema dual) ===
EMAIL_VERIFICATION_REQUIRED=false
EMAIL_VERIFICATION_TOKEN_TTL_MINUTES=60

# === Reset de contraseña ===
PASSWORD_RESET_TOKEN_TTL_MINUTES=30

# === Reintentos (cantidad + ventana de reset, todo configurable) ===
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

**Total: 14 variables.** Todas configurables desde `.env`. Ningún valor crítico hardcodeado.

---

## 2. Detalle de cada variable

### 2.1. `RESEND_API_KEY`

**Tipo:** `string` (requerido en cualquier ambiente que envíe correos)

**Función:** API key de Resend para autenticarse contra su API REST.

**Cómo obtenerla:**
1. Crear cuenta en [resend.com](https://resend.com)
2. Panel → API Keys → Create API Key
3. Copiar (solo se muestra una vez)

**Validación al arranque:** Si `NODE_ENV=production` y la variable está vacía → log fatal y refuse arrancar.

**Ejemplo:**
```env
RESEND_API_KEY=re_AbCdEfGhIjKlMnOpQrStUvWx
```

⚠️ **NUNCA commitear esta clave.**

---

### 2.2. `RESEND_FROM_EMAIL`

**Tipo:** `string`
**Default:** `onboarding@resend.dev` (sandbox de Resend)

**Función:** Dirección remitente. Aparece como "From" en los correos.

**Restricciones:**
- Sandbox `onboarding@resend.dev` solo permite enviar al correo con el que verificaste tu cuenta de Resend. **Solo apto para desarrollo.**
- Producción requiere verificar tu propio dominio en Resend (DNS: SPF, DKIM, DMARC).

**Ejemplos:**
```env
# Desarrollo
RESEND_FROM_EMAIL=onboarding@resend.dev

# Producción
RESEND_FROM_EMAIL=noreply@tubusexpress.com
```

---

### 2.3. `EMAIL_VERIFICATION_REQUIRED`

**Tipo:** `boolean` (string `'true'` o `'false'`)
**Default:** `false`

**Función:** Activa el sistema dual de verificación de correo.
- `true` → al registrarse, el usuario recibe correo y NO puede hacer login hasta verificar.
- `false` → no se envía correo de verificación. Auto-login tras registro.

**Comportamiento del grandfathering:**
El valor de esta variable **al momento del registro** se guarda en `User.requiresEmailVerification`. Cambiar la variable después **no afecta** a usuarios existentes.

**Ejemplos:**
```env
# Desarrollo (más cómodo)
EMAIL_VERIFICATION_REQUIRED=false

# Producción (más seguro)
EMAIL_VERIFICATION_REQUIRED=true
```

---

### 2.4. `EMAIL_VERIFICATION_TOKEN_TTL_MINUTES`

**Tipo:** `number` (entero ≥ 5, ≤ 10080)
**Default:** `60`
**Unidad:** minutos

**Función:** Cuánto tiempo es válido el link del correo de verificación de cuenta nueva.

**Recomendaciones:**
- `30` — estricto, para alta seguridad
- `60` — equilibrado (default)
- `120` — más cómodo si los usuarios tardan en abrir correos
- `1440` (24h) — muy permisivo

**Validación:** mínimo 5 minutos, máximo 10080 (7 días).

**Ejemplo:**
```env
EMAIL_VERIFICATION_TOKEN_TTL_MINUTES=60
```

---

### 2.5. `PASSWORD_RESET_TOKEN_TTL_MINUTES`

**Tipo:** `number` (entero ≥ 5, ≤ 10080)
**Default:** `30`
**Unidad:** minutos

**Función:** Cuánto tiempo es válido el link del correo de reset de contraseña.

**Recomendaciones:**
- `15` — máxima seguridad (estilo banca)
- `30` — estándar industria (default)
- `60` — más cómodo
- `120` — permisivo

**Validación:** mínimo 5 minutos, máximo 10080.

**Ejemplo:**
```env
PASSWORD_RESET_TOKEN_TTL_MINUTES=30
```

---

### 2.6. `MAX_PASSWORD_RESET_RETRIES`

**Tipo:** `number` (entero ≥ 0)
**Default:** `3`

**Función:** Cantidad máxima de envíos de correo de reset que un mismo correo puede solicitar dentro de la ventana de reset.

**Semántica:**
- `0` → solo 1 envío permitido en la ventana (cero reintentos).
- `3` → 3 envíos permitidos en la ventana (3 reintentos = 3 totales).
- `N` → N envíos en la ventana.

⚠️ **Cambio respecto a versión inicial:** ahora la cuenta es de envíos totales, no "1 inicial + N reintentos". Es más simple y predecible.

**Comportamiento al exceder:**
- HTTP 429 + código `RATE_LIMIT_EMAIL`
- Mensaje: "Has solicitado demasiados envíos. Intenta de nuevo en X horas."
- Registro en `AuthAuditLog`.

**Ejemplo:**
```env
MAX_PASSWORD_RESET_RETRIES=3   # 3 envíos máximo en la ventana
```

---

### 2.7. `PASSWORD_RESET_RETRIES_RESET_HOURS`

**Tipo:** `number` (entero ≥ 1, ≤ 168)
**Default:** `24`
**Unidad:** horas

**Función:** Tiempo (en horas) que debe pasar para que un envío "envejezca" y deje de contar contra el límite.

**Modo:** Rolling (móvil). Cada envío individual se libera N horas después de hacerse.

**Ejemplo de cálculo:**

```
MAX_PASSWORD_RESET_RETRIES=3
PASSWORD_RESET_RETRIES_RESET_HOURS=24

Lunes 14:00 │ envío 1 [1/3]
Lunes 18:00 │ envío 2 [2/3]
Lunes 22:00 │ envío 3 [3/3] ← LÍMITE
Martes 14:01 │ envío de las 14:00 envejece [2/3]
             │ → puede pedir 1 más
```

**Recomendaciones:**
- `24` — diario (default)
- `12` — más permisivo
- `168` (7 días) — muy estricto
- `1` — un slot por hora (máxima protección)

**Validación:** mínimo 1 hora, máximo 168.

---

### 2.8. `MAX_VERIFICATION_RESEND_RETRIES`

**Tipo:** `number` (entero ≥ 0)
**Default:** `3`

**Función:** Igual que `MAX_PASSWORD_RESET_RETRIES`, pero para reenvíos del correo de verificación de cuenta nueva.

**Ejemplo:**
```env
MAX_VERIFICATION_RESEND_RETRIES=3
```

---

### 2.9. `VERIFICATION_RESEND_RETRIES_RESET_HOURS`

**Tipo:** `number` (entero ≥ 1, ≤ 168)
**Default:** `24`

**Función:** Igual que `PASSWORD_RESET_RETRIES_RESET_HOURS`, pero para reenvíos de verificación.

**Ejemplo:**
```env
VERIFICATION_RESEND_RETRIES_RESET_HOURS=24
```

⚠️ **Interacción con cleanup zombie:** si `ZOMBIE_ACCOUNT_CLEANUP_AFTER_HOURS=24` y `VERIFICATION_RESEND_RETRIES_RESET_HOURS=24`, el usuario solo aprovecha la primera ventana de reintentos (la cuenta se elimina antes de que se libere el primer slot). Si quieres que pueda usar más reintentos, sube el cleanup.

---

### 2.10. `MAX_EMAILS_PER_DAY_GLOBAL`

**Tipo:** `number` (entero > 0)
**Default:** `90`
**Unidad:** correos / 24 horas

**Función:** Cap diario de correos enviados por **todo el sistema**. Suma verificaciones + resets + informativos OAuth. Protege la cuota de Resend.

**Ventana:** Móvil de 24 horas (consulta `EmailLog` con `createdAt > now - 24h`).

**Por qué 90 como default:**
Plan free de Resend = 100/día. Default `90` deja margen de 10 para administración.

**Comportamiento al exceder:**
- HTTP 503 + código `RATE_LIMIT_GLOBAL`
- Registro en `EmailQuotaAlert` (solo la primera por día).

**Recomendaciones:**
- Plan free → `90`
- Plan Pro (50K/mes) → `1500`
- Cuotas mayores → ajustar proporcional

---

### 2.11. `ZOMBIE_ACCOUNT_CLEANUP_AFTER_HOURS`

**Tipo:** `number` (entero ≥ 1, ≤ 8760)
**Default:** `24`
**Unidad:** horas

**Función:** Tras cuántas horas sin verificar el correo, el cron elimina la cuenta automáticamente.

**Aplicabilidad:** Solo afecta a usuarios con `requiresEmailVerification=true && isVerified=false`. Cuentas verificadas o que no requieren verificación nunca se eliminan por este cron.

**Frecuencia del cron:** Cada hora. Permite buena resolución incluso con valores bajos (ej: `6` horas).

**Recomendaciones:**

| Valor | Cuándo usar |
|-------|-------------|
| `12` | Sistema con muchos registros falsos / spam alto |
| `24` (default) | Equilibrado (estándar) |
| `72` | Permisivo, da margen al usuario lento |
| `168` (7 días) | Producto B2B, usuarios casuales |

⚠️ **Cuidado con valores bajos:** Si pones `12`, un usuario que se registró antes de irse a dormir puede perder la cuenta al día siguiente.

**Ejemplo:**
```env
ZOMBIE_ACCOUNT_CLEANUP_AFTER_HOURS=24
```

---

### 2.12. `RESET_PASSWORD_URL`

**Tipo:** `string` (URL absoluta)
**Default:** `${CLIENT_URL}/reset-password`

**Función:** URL base a donde apunta el link del correo de reset. El backend agrega `?token=X` automáticamente.

**Ejemplos:**
```env
RESET_PASSWORD_URL=http://localhost:4200/reset-password
RESET_PASSWORD_URL=https://tubusexpress.com/reset-password
```

---

### 2.13. `VERIFY_EMAIL_URL`

**Tipo:** `string` (URL absoluta)
**Default:** `${CLIENT_URL}/verify-email`

**Función:** URL base del link de verificación de correo.

**Ejemplos:**
```env
VERIFY_EMAIL_URL=http://localhost:4200/verify-email
VERIFY_EMAIL_URL=https://tubusexpress.com/verify-email
```

---

## 3. Configuración por ambiente

### Desarrollo local

```env
NODE_ENV=development
EMAIL_VERIFICATION_REQUIRED=false
EMAIL_VERIFICATION_TOKEN_TTL_MINUTES=60
PASSWORD_RESET_TOKEN_TTL_MINUTES=30
RESEND_API_KEY=<tu key personal>
RESEND_FROM_EMAIL=onboarding@resend.dev
MAX_PASSWORD_RESET_RETRIES=10
PASSWORD_RESET_RETRIES_RESET_HOURS=1
MAX_VERIFICATION_RESEND_RETRIES=10
VERIFICATION_RESEND_RETRIES_RESET_HOURS=1
MAX_EMAILS_PER_DAY_GLOBAL=200
ZOMBIE_ACCOUNT_CLEANUP_AFTER_HOURS=168
RESET_PASSWORD_URL=http://localhost:4200/reset-password
VERIFY_EMAIL_URL=http://localhost:4200/verify-email
```

**Razón de los valores permisivos:** facilitar testing iterativo sin bloqueos.

---

### QA

```env
NODE_ENV=production
EMAIL_VERIFICATION_REQUIRED=true
EMAIL_VERIFICATION_TOKEN_TTL_MINUTES=60
PASSWORD_RESET_TOKEN_TTL_MINUTES=30
RESEND_API_KEY=<key separada para QA>
RESEND_FROM_EMAIL=qa@tubusexpress.com
MAX_PASSWORD_RESET_RETRIES=3
PASSWORD_RESET_RETRIES_RESET_HOURS=24
MAX_VERIFICATION_RESEND_RETRIES=3
VERIFICATION_RESEND_RETRIES_RESET_HOURS=24
MAX_EMAILS_PER_DAY_GLOBAL=90
ZOMBIE_ACCOUNT_CLEANUP_AFTER_HOURS=24
RESET_PASSWORD_URL=https://qa.tubusexpress.com/reset-password
VERIFY_EMAIL_URL=https://qa.tubusexpress.com/verify-email
```

---

### Producción

```env
NODE_ENV=production
EMAIL_VERIFICATION_REQUIRED=true
EMAIL_VERIFICATION_TOKEN_TTL_MINUTES=60
PASSWORD_RESET_TOKEN_TTL_MINUTES=30
RESEND_API_KEY=<key de prod>
RESEND_FROM_EMAIL=noreply@tubusexpress.com
MAX_PASSWORD_RESET_RETRIES=3
PASSWORD_RESET_RETRIES_RESET_HOURS=24
MAX_VERIFICATION_RESEND_RETRIES=3
VERIFICATION_RESEND_RETRIES_RESET_HOURS=24
MAX_EMAILS_PER_DAY_GLOBAL=1500
ZOMBIE_ACCOUNT_CLEANUP_AFTER_HOURS=72
RESET_PASSWORD_URL=https://tubusexpress.com/reset-password
VERIFY_EMAIL_URL=https://tubusexpress.com/verify-email
```

**Diferencias respecto a QA:**
- `MAX_EMAILS_PER_DAY_GLOBAL` ajustado al plan Pro de Resend.
- `ZOMBIE_ACCOUNT_CLEANUP_AFTER_HOURS` más permisivo (72h = 3 días) para no perder usuarios reales.

---

## 4. Validación al arranque

En `backend/src/server.ts` (o `validate-env.ts`):

```typescript
function validateAuthEnv(): void {
  const isProd = process.env.NODE_ENV === 'production';

  // Resend obligatoria en producción
  if (isProd && !process.env.RESEND_API_KEY) {
    console.error('[FATAL] RESEND_API_KEY no configurada en producción');
    process.exit(1);
  }

  // Validar TTLs (en minutos)
  validateRange('EMAIL_VERIFICATION_TOKEN_TTL_MINUTES', 5, 10080);
  validateRange('PASSWORD_RESET_TOKEN_TTL_MINUTES', 5, 10080);

  // Validar reintentos (cantidad)
  validateRange('MAX_PASSWORD_RESET_RETRIES', 0, 1000);
  validateRange('MAX_VERIFICATION_RESEND_RETRIES', 0, 1000);

  // Validar ventanas de reset (en horas)
  validateRange('PASSWORD_RESET_RETRIES_RESET_HOURS', 1, 168);
  validateRange('VERIFICATION_RESEND_RETRIES_RESET_HOURS', 1, 168);

  // Validar cap global
  validateRange('MAX_EMAILS_PER_DAY_GLOBAL', 1, 1000000);

  // Validar cleanup (en horas)
  validateRange('ZOMBIE_ACCOUNT_CLEANUP_AFTER_HOURS', 1, 8760);

  // Warnings no bloqueantes
  if (process.env.RESEND_FROM_EMAIL === 'onboarding@resend.dev' && isProd) {
    console.warn('[WARN] RESEND_FROM_EMAIL usa el sandbox en producción.');
  }
}

function validateRange(varName: string, min: number, max: number): void {
  const val = process.env[varName];
  if (val === undefined) return; // usa default del config

  const num = parseInt(val, 10);
  if (isNaN(num) || num < min || num > max) {
    console.error(`[FATAL] ${varName} debe ser un entero entre ${min} y ${max}. Valor: "${val}"`);
    process.exit(1);
  }
}
```

---

## 5. Cambios respecto a `.gitignore`

Verificar que `.env` esté en `.gitignore` (ya debería). El archivo `.env.example` SÍ se commitea como referencia.

---

## 6. FAQ

**P: Si pongo `MAX_PASSWORD_RESET_RETRIES=0`, ¿el reset deja de funcionar?**
R: No. `0` significa "1 envío permitido en la ventana, sin reintentos". El usuario puede pedir reset una vez y, tras `RESET_HOURS` horas, otro.

**P: ¿Qué pasa si `RESEND_API_KEY` está vacía en desarrollo?**
R: Los endpoints que envían correos devuelven 500. El sistema no crashea, pero los flujos de correo no funcionan.

**P: ¿Puedo cambiar `EMAIL_VERIFICATION_REQUIRED` en runtime?**
R: Sí, pero requiere reiniciar el server. Cambiarla **no afecta** a usuarios existentes (grandfathering).

**P: ¿Las ventanas son por usuario o globales?**
R: `MAX_*_RETRIES` cuenta por correo del usuario. `MAX_EMAILS_PER_DAY_GLOBAL` cuenta el total del sistema.

**P: ¿Cómo cuenta el sistema los reintentos? ¿Por usuario, por IP, o ambos?**
R: La variable `MAX_*_RETRIES` cuenta **por correo (email del usuario)**. La protección por IP se hace adicionalmente con `express-rate-limit` (ver `03-security-and-owasp.md` sección 5).

**P: Si el usuario cambia su correo de "victima@correo.com" a "victima2@correo.com" durante un ataque, ¿el atacante puede agotar los reintentos?**
R: No. La variable se cuenta por correo destino. Cada correo distinto tiene su propio contador.

**P: ¿Por qué cleanup en horas y no en días?**
R: Más flexible. Si quieres "1 día" pones `24`. Si quieres "12 horas" pones `12`. No estás limitado a múltiplos de 24.

**P: ¿Por qué el cron de cleanup corre cada hora?**
R: Para respetar configuraciones bajas. Si configuras `cleanup=6` horas y el cron solo corre 1 vez al día, una cuenta creada justo antes del cron sobreviviría hasta el día siguiente. Cron horario garantiza precisión ± 1 hora.

**P: ¿Cómo sé si estoy cerca del cap diario?**
R: Consultar `EmailLog` con `createdAt > now - 24h`. Más adelante se puede agregar endpoint admin con esta info (ver Fase 4).

---

## 7. Quick reference — Defaults

| Variable | Default | Mínimo | Máximo |
|----------|---------|--------|--------|
| `RESEND_API_KEY` | (vacío) | — | — |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` | — | — |
| `EMAIL_VERIFICATION_REQUIRED` | `false` | — | — |
| `EMAIL_VERIFICATION_TOKEN_TTL_MINUTES` | `60` | `5` | `10080` |
| `PASSWORD_RESET_TOKEN_TTL_MINUTES` | `30` | `5` | `10080` |
| `MAX_PASSWORD_RESET_RETRIES` | `3` | `0` | `1000` |
| `PASSWORD_RESET_RETRIES_RESET_HOURS` | `24` | `1` | `168` |
| `MAX_VERIFICATION_RESEND_RETRIES` | `3` | `0` | `1000` |
| `VERIFICATION_RESEND_RETRIES_RESET_HOURS` | `24` | `1` | `168` |
| `MAX_EMAILS_PER_DAY_GLOBAL` | `90` | `1` | `1000000` |
| `ZOMBIE_ACCOUNT_CLEANUP_AFTER_HOURS` | `24` | `1` | `8760` |
| `RESET_PASSWORD_URL` | `${CLIENT_URL}/reset-password` | — | — |
| `VERIFY_EMAIL_URL` | `${CLIENT_URL}/verify-email` | — | — |

---

**Documento siguiente:** [`05-api-contracts.md`](./05-api-contracts.md) — contratos de cada endpoint nuevo y modificado.

**Documento complementario:** [`09-env-variables-cheatsheet.md`](./09-env-variables-cheatsheet.md) — guía rápida visual de cada variable.
