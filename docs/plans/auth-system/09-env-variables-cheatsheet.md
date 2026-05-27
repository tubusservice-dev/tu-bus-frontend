# Cheatsheet de Variables de Entorno — Guía Rápida

> Referencia rápida y visual de las **14 variables de entorno** del sistema de autenticación. Pensada para consulta rápida cuando necesites saber qué hace cada variable sin leer la documentación completa.
>
> **Para detalle técnico profundo, ver [`04-environment-variables.md`](./04-environment-variables.md).**

---

## 📋 Bloque completo (copia-pega para `.env`)

```env
# === Resend ===
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# === Verificación de correo (sistema dual) ===
EMAIL_VERIFICATION_REQUIRED=false
EMAIL_VERIFICATION_TOKEN_TTL_MINUTES=60

# === Reset de contraseña ===
PASSWORD_RESET_TOKEN_TTL_MINUTES=30

# === Reintentos (cantidad + reset, ambos configurables) ===
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

## 🟦 Bloque Resend — Servicio de envío de correos

### `RESEND_API_KEY`
**Para qué sirve:** Es la "llave" que el backend usa para enviar correos a través de Resend.
**Cómo obtenerla:** Crear cuenta en [resend.com](https://resend.com) → API Keys → Create.
**Default:** vacío (obligatoria en producción).
**Ejemplo:** `re_AbCdEfGhIjKlMnOpQrSt`
**⚠️ Cuidado:** Nunca commitear esta clave a Git.

### `RESEND_FROM_EMAIL`
**Para qué sirve:** Es la dirección que aparece como **remitente** en los correos enviados al usuario.
**Default:** `onboarding@resend.dev` (sandbox, solo dev).
**Ejemplo (prod):** `noreply@tubusexpress.com`
**⚠️ Cuidado:** Para usar tu dominio propio, primero hay que verificarlo en Resend (DNS records).

---

## 🟦 Bloque Verificación de correo — Sistema dual

### `EMAIL_VERIFICATION_REQUIRED`
**Para qué sirve:** Es el **interruptor maestro** que decide si los nuevos usuarios deben verificar su correo electrónico al registrarse.
**Default:** `false`
**Valores:**
- `true` → al registrarse, recibe correo y NO puede entrar hasta hacer click. Más seguro.
- `false` → registro normal, entra de una vez. Más cómodo.

**Cuándo cambiarlo:**
- En **dev**: déjalo en `false` para iterar rápido.
- En **prod**: ponlo en `true` para evitar cuentas falsas.

**⚠️ Importante:** Cambiar esta variable **no afecta a usuarios ya registrados**. Cada usuario queda atado al valor que tenía la variable cuando se registró (grandfathering).

### `EMAIL_VERIFICATION_TOKEN_TTL_MINUTES`
**Para qué sirve:** Cuánto tiempo es válido el link del correo de verificación, en minutos.
**Default:** `60` (1 hora).
**Rango válido:** `5` a `10080` (de 5 minutos a 7 días).
**Ejemplos:**
- `30` → estricto, expira en media hora
- `60` → equilibrado (recomendado)
- `120` → permisivo, dura 2 horas
- `1440` → muy permisivo, dura 1 día

---

## 🟦 Bloque Reset de contraseña

### `PASSWORD_RESET_TOKEN_TTL_MINUTES`
**Para qué sirve:** Cuánto tiempo es válido el link de "Olvidé mi contraseña", en minutos.
**Default:** `30` (estándar de la industria).
**Rango válido:** `5` a `10080`.
**Ejemplos:**
- `15` → máxima seguridad (estilo banca)
- `30` → estándar (recomendado)
- `60` → cómodo
- `120` → permisivo

**⚠️ Cuidado:** Mientras más corto, más seguro pero más frustra al usuario distraído.

---

## 🟦 Bloque Reintentos — Reset de contraseña

> Estas dos variables trabajan **juntas**. Una controla cuántos envíos se permiten, la otra cuándo se "perdonan".

### `MAX_PASSWORD_RESET_RETRIES`
**Para qué sirve:** El **tope** de envíos de correo de reset que se permiten al mismo usuario en una ventana de tiempo.
**Default:** `3`
**Valores comunes:**
- `0` → solo 1 envío permitido (sin reintentos)
- `3` → hasta 3 envíos en la ventana
- `10` → permisivo (útil en dev)

**Cuenta por correo del usuario** (no por IP). Si dos personas distintas piden reset, cada una tiene su contador independiente.

### `PASSWORD_RESET_RETRIES_RESET_HOURS`
**Para qué sirve:** Cada cuántas horas se "perdona" un envío y queda libre el slot.
**Default:** `24` (un slot cada 24 horas, modo rolling).
**Cómo funciona:**

```
Si MAX=3 y RESET_HOURS=24:

Lunes 14:00 → envío 1 (1/3 usado)
Lunes 18:00 → envío 2 (2/3 usado)
Lunes 22:00 → envío 3 (3/3 usado, LÍMITE)
Martes 14:01 → el envío de las 14:00 "envejece" → 1 slot libre
            → puede pedir el envío 4
```

**Ejemplos:**
- `24` → ventana de 1 día (recomendado)
- `12` → 2 ventanas al día
- `1` → 1 slot por hora (muy estricto)
- `168` → 1 ventana por semana (muy estricto)

---

## 🟦 Bloque Reintentos — Verificación de cuenta

### `MAX_VERIFICATION_RESEND_RETRIES`
**Para qué sirve:** Igual que `MAX_PASSWORD_RESET_RETRIES`, pero para reenvíos del correo de verificación de cuenta nueva.
**Default:** `3`

### `VERIFICATION_RESEND_RETRIES_RESET_HOURS`
**Para qué sirve:** Igual que `PASSWORD_RESET_RETRIES_RESET_HOURS`, pero para verificación.
**Default:** `24`

**⚠️ Atención a la interacción con cleanup zombie:**
Si pones `ZOMBIE_ACCOUNT_CLEANUP_AFTER_HOURS=24` y `VERIFICATION_RESEND_RETRIES_RESET_HOURS=24`, el usuario solo aprovecha la primera ventana — la cuenta se elimina al mismo tiempo que se libera el primer slot. Si quieres que pueda usar más reintentos, sube el cleanup a `48` o `72`.

---

## 🟦 Bloque Cuota global

### `MAX_EMAILS_PER_DAY_GLOBAL`
**Para qué sirve:** El **tope absoluto** de correos que el sistema entero puede enviar en 24 horas. Protege tu cuota de Resend para que un atacante no la agote.
**Default:** `90` (margen sobre los 100/día del plan free de Resend).
**Cuándo ajustar:**

| Plan Resend | Recomendado |
|-------------|-------------|
| Free (3.000/mes ≈ 100/día) | `90` |
| Pro (50.000/mes ≈ 1.600/día) | `1500` |
| Business (mayor) | proporcional |

**Qué pasa si se alcanza:**
- HTTP 503 al usuario ("servicio temporalmente saturado").
- Se registra una entrada en `EmailQuotaAlert` para que el admin investigue.

---

## 🟦 Bloque Limpieza zombie

### `ZOMBIE_ACCOUNT_CLEANUP_AFTER_HOURS`
**Para qué sirve:** Cuántas horas debe pasar desde el registro de una cuenta no verificada para que el sistema la elimine automáticamente.
**Default:** `24`
**Aplica a:** solo cuentas con `requiresEmailVerification=true && isVerified=false`. Las verificadas y las que no requieren verificación nunca se eliminan por este cron.
**Cron horario:** corre cada hora, así respeta valores bajos como `6`.

**Tabla de configuraciones típicas:**

| Valor | Para qué |
|-------|----------|
| `12` | Sistemas con muchos registros falsos / spam |
| `24` | Equilibrado (default) |
| `72` | Permisivo, da margen al usuario lento (recomendado prod) |
| `168` | Producto B2B con usuarios casuales |

**⚠️ Cuidado:** Si pones `12`, alguien que se registra antes de dormir puede perder su cuenta al despertar.

---

## 🟦 Bloque URLs de callback

### `RESET_PASSWORD_URL`
**Para qué sirve:** El link base que aparece en el correo de "Olvidé mi contraseña". El sistema le agrega `?token=X` automáticamente.
**Default:** `${CLIENT_URL}/reset-password`
**Ejemplos:**
- Dev: `http://localhost:4200/reset-password`
- Prod: `https://tubusexpress.com/reset-password`

### `VERIFY_EMAIL_URL`
**Para qué sirve:** El link base que aparece en el correo de verificación de cuenta.
**Default:** `${CLIENT_URL}/verify-email`
**Ejemplos:**
- Dev: `http://localhost:4200/verify-email`
- Prod: `https://tubusexpress.com/verify-email`

---

## 📊 Tabla resumen — Defaults y rangos

| Variable | Default | Mín | Máx |
|----------|---------|-----|-----|
| `RESEND_API_KEY` | (vacío) | — | — |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` | — | — |
| `EMAIL_VERIFICATION_REQUIRED` | `false` | — | — |
| `EMAIL_VERIFICATION_TOKEN_TTL_MINUTES` | `60` | `5` | `10080` |
| `PASSWORD_RESET_TOKEN_TTL_MINUTES` | `30` | `5` | `10080` |
| `MAX_PASSWORD_RESET_RETRIES` | `3` | `0` | `1000` |
| `PASSWORD_RESET_RETRIES_RESET_HOURS` | `24` | `1` | `168` |
| `MAX_VERIFICATION_RESEND_RETRIES` | `3` | `0` | `1000` |
| `VERIFICATION_RESEND_RETRIES_RESET_HOURS` | `24` | `1` | `168` |
| `MAX_EMAILS_PER_DAY_GLOBAL` | `90` | `1` | `1.000.000` |
| `ZOMBIE_ACCOUNT_CLEANUP_AFTER_HOURS` | `24` | `1` | `8760` |
| `RESET_PASSWORD_URL` | `${CLIENT_URL}/reset-password` | — | — |
| `VERIFY_EMAIL_URL` | `${CLIENT_URL}/verify-email` | — | — |

---

## 🎯 Configuraciones recomendadas por escenario

### Escenario 1 — Desarrollo local (lo más cómodo)

```env
EMAIL_VERIFICATION_REQUIRED=false
EMAIL_VERIFICATION_TOKEN_TTL_MINUTES=60
PASSWORD_RESET_TOKEN_TTL_MINUTES=30
MAX_PASSWORD_RESET_RETRIES=10
PASSWORD_RESET_RETRIES_RESET_HOURS=1
MAX_VERIFICATION_RESEND_RETRIES=10
VERIFICATION_RESEND_RETRIES_RESET_HOURS=1
MAX_EMAILS_PER_DAY_GLOBAL=200
ZOMBIE_ACCOUNT_CLEANUP_AFTER_HOURS=168
```

**Por qué:** muchos reintentos por hora, sin cleanup agresivo, para no estar "luchando" contra el sistema mientras pruebas.

### Escenario 2 — QA/Staging (probar como prod pero relajado)

```env
EMAIL_VERIFICATION_REQUIRED=true
EMAIL_VERIFICATION_TOKEN_TTL_MINUTES=60
PASSWORD_RESET_TOKEN_TTL_MINUTES=30
MAX_PASSWORD_RESET_RETRIES=3
PASSWORD_RESET_RETRIES_RESET_HOURS=24
MAX_VERIFICATION_RESEND_RETRIES=3
VERIFICATION_RESEND_RETRIES_RESET_HOURS=24
MAX_EMAILS_PER_DAY_GLOBAL=90
ZOMBIE_ACCOUNT_CLEANUP_AFTER_HOURS=24
```

**Por qué:** valores idénticos a producción para detectar problemas reales antes del deploy.

### Escenario 3 — Producción estándar

```env
EMAIL_VERIFICATION_REQUIRED=true
EMAIL_VERIFICATION_TOKEN_TTL_MINUTES=60
PASSWORD_RESET_TOKEN_TTL_MINUTES=30
MAX_PASSWORD_RESET_RETRIES=3
PASSWORD_RESET_RETRIES_RESET_HOURS=24
MAX_VERIFICATION_RESEND_RETRIES=3
VERIFICATION_RESEND_RETRIES_RESET_HOURS=24
MAX_EMAILS_PER_DAY_GLOBAL=1500
ZOMBIE_ACCOUNT_CLEANUP_AFTER_HOURS=72
```

**Por qué:** verificación obligatoria, reintentos razonables, cleanup permisivo (3 días) para no perder usuarios reales que abren correos tarde, cap de Resend Pro.

### Escenario 4 — Producción estricta (alto valor de seguridad)

```env
EMAIL_VERIFICATION_REQUIRED=true
EMAIL_VERIFICATION_TOKEN_TTL_MINUTES=30
PASSWORD_RESET_TOKEN_TTL_MINUTES=15
MAX_PASSWORD_RESET_RETRIES=1
PASSWORD_RESET_RETRIES_RESET_HOURS=24
MAX_VERIFICATION_RESEND_RETRIES=2
VERIFICATION_RESEND_RETRIES_RESET_HOURS=24
MAX_EMAILS_PER_DAY_GLOBAL=500
ZOMBIE_ACCOUNT_CLEANUP_AFTER_HOURS=24
```

**Por qué:** TTL cortos, casi sin reintentos, cleanup agresivo. Para sistemas tipo banca o salud.

---

## ❓ Preguntas frecuentes

### ¿Qué pasa si falta una variable?
- `RESEND_API_KEY` faltante en producción → el server **no arranca** (log fatal).
- Cualquier otra variable faltante → se usa el default documentado.
- Una variable con valor inválido (ej: número fuera de rango) → el server **no arranca** (log fatal).

### ¿Las variables se pueden cambiar sin reiniciar el server?
**No.** Las variables de entorno se leen al arranque. Cambiar el `.env` requiere reiniciar el proceso del backend.

### ¿Qué unidad usa cada variable de tiempo?
- TTL de tokens → **minutos** (`*_TTL_MINUTES`)
- Ventanas de reintentos → **horas** (`*_RESET_HOURS`)
- Cleanup → **horas** (`*_AFTER_HOURS`)

Coherentes con el sufijo del nombre.

### ¿Cómo cambia el correo si modifico el TTL?
Las plantillas usan `{{ttlHumanReadable}}`. Si configuras `120` minutos, el correo dirá "este enlace expira en **2 horas**". Si configuras `45`, dirá "expira en **45 minutos**". Conversión automática.

### ¿La cuota global cuenta todos los correos?
Sí. Verificación + reset + informativos OAuth, todos suman al mismo contador de las últimas 24h. Aplica antes de hacer cada envío.

### ¿La validación de email único usa el cap?
No. `POST /auth/check-email` no envía correo, solo consulta la BD. Tiene su propio rate limit por IP (30/min) pero no consume cuota.

---

## 🔗 Documentos relacionados

- **Detalle técnico completo:** [`04-environment-variables.md`](./04-environment-variables.md)
- **Decisiones cerradas:** [`00-executive-summary.md`](./00-executive-summary.md)
- **Cómo se usan en código:** [`01-architecture-and-models.md`](./01-architecture-and-models.md) sección 6
- **Plantillas que usan los TTLs:** [`06-email-templates.md`](./06-email-templates.md)

---

**Última actualización:** 2026-04-29
**Estado:** Cheatsheet vigente para la configuración final aprobada
