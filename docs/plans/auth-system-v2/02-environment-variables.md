# Variables de entorno — Auth System v2

---

## Variables conservadas (sin cambios)

| Variable | Uso | Validación |
|----------|-----|-----------|
| `EMAIL_VERIFICATION_REQUIRED` | Si `true`, registro local requiere verificar correo. Decisión del operador. | `'true'` o `'false'`. |
| `EMAIL_VERIFICATION_TOKEN_TTL_MINUTES` | TTL del token de verificación email (Caso 2). | 5–10080 min. |
| `PASSWORD_RESET_TOKEN_TTL_MINUTES` | TTL del token de reset de contraseña (Caso 4). | 5–10080 min. |
| `MAX_PASSWORD_RESET_RETRIES` | Cap per-email de reseteos. | 0–1000. |
| `PASSWORD_RESET_RETRIES_RESET_HOURS` | Ventana rolling para el cap. | 1–168. |
| `MAX_VERIFICATION_RESEND_RETRIES` | Cap per-email de reenvíos de verificación. | 0–1000. |
| `VERIFICATION_RESEND_RETRIES_RESET_HOURS` | Ventana rolling. | 1–168. |
| `MAX_EMAILS_PER_DAY_GLOBAL` | Cuota diaria global. | 1–1_000_000. |
| `ZOMBIE_ACCOUNT_CLEANUP_AFTER_HOURS` | Limpieza de cuentas no verificadas. | 1–8760. |

---

## Variables nuevas

| Variable | Uso | Validación |
|----------|-----|-----------|
| `ACCOUNT_LINK_TOKEN_TTL_MINUTES` | TTL del token de vinculación de cuenta Google con password (Caso 3). | 5–10080 min. |

### Default si no se configura

`60` minutos (1 hora). Razonable para que el usuario tenga tiempo de revisar su correo sin que el token quede vivo demasiado tiempo.

### Sugerencia para `.env`

```bash
# === Account link (Caso 3 — vinculación Google → password) ===
ACCOUNT_LINK_TOKEN_TTL_MINUTES=60
```

---

## Variables eliminadas

Ninguna. Todas las variables existentes siguen siendo relevantes.

---

## Cuotas de email — análisis

Con la simplificación del Caso 5 (eliminación del email `OAUTH_RESET_INFO`), la cuenta global de emails se reduce. Tipos de email que aún consumen cuota:

| Email | Frecuencia | Per-email cap |
|-------|-----------|---------------|
| `EMAIL_VERIFICATION` | 1 al registrarse + reenvíos manuales | `MAX_VERIFICATION_RESEND_RETRIES` por ventana |
| `PASSWORD_RESET` | 1 por solicitud de "olvidé contraseña" | `MAX_PASSWORD_RESET_RETRIES` por ventana |
| `ACCOUNT_LINK_VERIFICATION` | 1 al vincular cuenta Google con password | (reusa el cap de `MAX_VERIFICATION_RESEND_RETRIES` por ahora) |

### Decisión sobre per-email cap del nuevo email

`ACCOUNT_LINK_VERIFICATION` es un evento poco frecuente (solo cuando un user Google quiere añadir password). No requiere cap propio: reusa el cap de `MAX_VERIFICATION_RESEND_RETRIES` cuando se llega vía resend, y el cap global `MAX_EMAILS_PER_DAY_GLOBAL` cubre cualquier abuso por IP.
