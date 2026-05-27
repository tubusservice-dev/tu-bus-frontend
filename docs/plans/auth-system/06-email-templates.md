# Plantillas de Correo

> Diseño y contenido HTML de los correos enviados por el sistema. Tres plantillas: verificación de cuenta, reset de contraseña (estándar), y reset de contraseña para cuenta OAuth.

---

## 1. Principios de diseño

### 1.1. Identidad visual

- **Color primario:** `#001d56` (azul corporativo, ya usado en el frontend del proyecto)
- **Color secundario:** `#FFFFFF` (fondo)
- **Color de texto:** `#1F2937` (gris oscuro, alto contraste)
- **Color de acento (botones):** `#001d56` con texto blanco
- **Tipografía:** stack universal (Arial, Helvetica, sans-serif) para máxima compatibilidad con clientes de correo

### 1.2. Compatibilidad

- HTML inline con styles (NO CSS externo) — Outlook, Gmail, Yahoo Mail, Apple Mail
- Tablas para layout (no Flex/Grid) — compatibilidad con clientes legacy
- Ancho máximo: 600px (responsive en móvil con media queries inline)
- Modo oscuro: agregar `<meta name="color-scheme" content="light">` para forzar modo claro

### 1.3. Estructura común (template base)

```
┌────────────────────────────────────────┐
│   [LOGO TuBus]                         │ ← Header con logo
├────────────────────────────────────────┤
│                                        │
│   Saludo personalizado                 │
│   Cuerpo del mensaje                   │
│                                        │
│   [BOTÓN PRINCIPAL]                    │
│                                        │
│   Texto de apoyo / link alternativo    │
│                                        │
├────────────────────────────────────────┤
│   Footer:                              │
│   - Aviso de seguridad                 │
│   - Información de contacto            │
│   - Link de soporte                    │
└────────────────────────────────────────┘
```

### 1.4. Reglas de seguridad en plantillas

- Todos los datos del usuario (`{{firstName}}`, `{{email}}`) deben **escaparse en HTML** para prevenir injection.
- Los links deben ser **absolutos** y apuntar a dominios propios (nada de redirects externos).
- Usar plantillas con motor de templating (`handlebars` o similar), nunca concatenar strings.

---

## 2. Plantilla base (`base.html`)

Layout común reutilizado por las 3 plantillas. Define header, footer y estilos.

**Variables comunes:**
- `{{appName}}` → `TuBus Express`
- `{{logoUrl}}` → URL del logo (Cloudinary)
- `{{currentYear}}` → 2026
- `{{supportEmail}}` → `soporte@tubusexpress.com` (cuando exista)
- `{{content}}` → bloque insertado por la plantilla específica

**Resumen estructural:**

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>{{subject}}</title>
</head>
<body style="margin:0; padding:0; background-color:#F3F4F6; font-family:Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0"
               style="max-width:600px; background:#fff; border-radius:12px; overflow:hidden;">

          <!-- HEADER -->
          <tr>
            <td align="center" style="background:#001d56; padding:30px 20px;">
              <img src="{{logoUrl}}" alt="{{appName}}" width="180" style="display:block;"/>
            </td>
          </tr>

          <!-- CONTENIDO -->
          <tr>
            <td style="padding:40px 30px; color:#1F2937; font-size:16px; line-height:1.6;">
              {{content}}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#F9FAFB; padding:24px 30px;
                       font-size:13px; color:#6B7280; text-align:center;">
              <p>Si no solicitaste esto, ignora este correo. {{appName}} nunca te pedirá tu contraseña por correo.</p>
              <p style="margin-top:16px;">
                ¿Necesitas ayuda? Contacta a
                <a href="mailto:{{supportEmail}}" style="color:#001d56;">{{supportEmail}}</a>
              </p>
              <p style="margin-top:16px; color:#9CA3AF;">
                © {{currentYear}} {{appName}}. Todos los derechos reservados.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 3. Plantilla 1 — Verificación de correo

**Archivo:** `backend/src/shared/templates/emails/email-verification.html`

**Asunto:** `Verifica tu cuenta en TuBus Express`

**Variables específicas:**
- `{{firstName}}` → nombre del usuario
- `{{verificationUrl}}` → `${VERIFY_EMAIL_URL}?token={rawToken}`
- `{{ttlHumanReadable}}` → string formateado del TTL (ej: "1 hora", "30 minutos", "2 horas")

**Contenido (bloque que reemplaza `{{content}}`):**

```html
<h1 style="color:#001d56; font-size:24px; margin:0 0 24px 0;">
  ¡Bienvenido a TuBus Express, {{firstName}}!
</h1>

<p style="margin:0 0 16px 0;">
  Tu cuenta ha sido creada exitosamente. Solo falta un paso:
  <strong>verificar tu correo electrónico</strong>.
</p>

<p style="margin:0 0 32px 0;">
  Haz click en el siguiente botón para activar tu cuenta:
</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
  <tr>
    <td align="center" bgcolor="#001d56" style="border-radius:8px;">
      <a href="{{verificationUrl}}"
         style="display:inline-block; padding:14px 36px; color:#FFFFFF;
                font-weight:bold; font-size:16px; text-decoration:none;
                border-radius:8px;">
        Verificar mi cuenta
      </a>
    </td>
  </tr>
</table>

<p style="margin:32px 0 0 0; font-size:14px; color:#6B7280;">
  Si el botón no funciona, copia y pega este link en tu navegador:
</p>
<p style="margin:8px 0 0 0; font-size:13px; color:#001d56; word-break:break-all;">
  {{verificationUrl}}
</p>

<div style="margin-top:32px; padding:16px; background:#FEF3C7;
            border-left:4px solid #F59E0B; border-radius:4px;">
  <p style="margin:0; font-size:14px; color:#92400E;">
    ⏱️ Este enlace expira en <strong>{{ttlHumanReadable}}</strong>.
    Si tarda más, deberás solicitar uno nuevo.
  </p>
</div>
```

**Texto plano alternativo (text/plain):**
```
¡Bienvenido a TuBus Express, {{firstName}}!

Tu cuenta ha sido creada. Verifica tu correo electrónico para activarla:

{{verificationUrl}}

Este enlace expira en {{ttlHumanReadable}}.

Si no solicitaste esto, ignora este correo.

— El equipo de TuBus Express
```

---

## 4. Plantilla 2 — Reset de contraseña (estándar)

**Archivo:** `backend/src/shared/templates/emails/password-reset.html`

**Asunto:** `Restablece tu contraseña en TuBus Express`

**Variables:**
- `{{firstName}}` → nombre del usuario
- `{{resetUrl}}` → `${RESET_PASSWORD_URL}?token={rawToken}`
- `{{ttlHumanReadable}}` → string formateado del TTL (ej: "30 minutos", "1 hora")

**Contenido:**

```html
<h1 style="color:#001d56; font-size:24px; margin:0 0 24px 0;">
  Restablece tu contraseña
</h1>

<p style="margin:0 0 16px 0;">Hola {{firstName}},</p>

<p style="margin:0 0 24px 0;">
  Recibimos una solicitud para restablecer la contraseña de tu cuenta
  en TuBus Express.
</p>

<p style="margin:0 0 32px 0;">
  Haz click en el siguiente botón para crear una nueva contraseña:
</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
  <tr>
    <td align="center" bgcolor="#001d56" style="border-radius:8px;">
      <a href="{{resetUrl}}"
         style="display:inline-block; padding:14px 36px; color:#FFFFFF;
                font-weight:bold; font-size:16px; text-decoration:none;
                border-radius:8px;">
        Crear nueva contraseña
      </a>
    </td>
  </tr>
</table>

<p style="margin:32px 0 0 0; font-size:14px; color:#6B7280;">
  Si el botón no funciona, copia y pega este link en tu navegador:
</p>
<p style="margin:8px 0 0 0; font-size:13px; color:#001d56; word-break:break-all;">
  {{resetUrl}}
</p>

<div style="margin-top:32px; padding:16px; background:#FEF3C7;
            border-left:4px solid #F59E0B; border-radius:4px;">
  <p style="margin:0; font-size:14px; color:#92400E;">
    ⏱️ Este enlace expira en <strong>{{ttlHumanReadable}}</strong> y solo puede usarse <strong>una vez</strong>.
  </p>
</div>

<div style="margin-top:24px; padding:16px; background:#FEE2E2;
            border-left:4px solid #DC2626; border-radius:4px;">
  <p style="margin:0; font-size:14px; color:#991B1B;">
    ⚠️ <strong>¿No fuiste tú?</strong> Si no solicitaste este cambio,
    ignora este correo. Tu contraseña actual seguirá siendo válida.
  </p>
</div>
```

**Texto plano:**
```
Hola {{firstName}},

Recibimos una solicitud para restablecer la contraseña de tu cuenta en TuBus Express.

Crea una nueva contraseña aquí:
{{resetUrl}}

Este enlace expira en {{ttlHumanReadable}} y solo puede usarse una vez.

Si no solicitaste esto, ignora este correo. Tu contraseña actual sigue siendo válida.

— El equipo de TuBus Express
```

---

## 5. Plantilla 3 — Reset para cuenta OAuth

**Archivo:** `backend/src/shared/templates/emails/oauth-reset-info.html`

**Asunto:** `Tu cuenta en TuBus Express está vinculada con Google`

**Variables:**
- `{{firstName}}` → nombre del usuario
- `{{provider}}` → `Google` o `Facebook`
- `{{loginUrl}}` → `${CLIENT_URL}` (página principal con login disponible)
- `{{resetUrl}}` → `${RESET_PASSWORD_URL}?token={rawToken}`
- `{{ttlHumanReadable}}` → string formateado del TTL del token de reset

**Contenido:**

```html
<h1 style="color:#001d56; font-size:24px; margin:0 0 24px 0;">
  Tu cuenta usa {{provider}}
</h1>

<p style="margin:0 0 16px 0;">Hola {{firstName}},</p>

<p style="margin:0 0 16px 0;">
  Recibimos una solicitud para restablecer tu contraseña.
</p>

<p style="margin:0 0 24px 0;">
  Sin embargo, tu cuenta de TuBus Express está
  <strong>vinculada con {{provider}}</strong> y no tiene una contraseña
  configurada actualmente.
</p>

<h2 style="color:#001d56; font-size:18px; margin:32px 0 16px 0;">
  ✅ Recomendamos: iniciar sesión con {{provider}}
</h2>

<p style="margin:0 0 24px 0;">
  La forma más rápida y segura es usar el botón de {{provider}} para entrar:
</p>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
  <tr>
    <td align="center" bgcolor="#001d56" style="border-radius:8px;">
      <a href="{{loginUrl}}"
         style="display:inline-block; padding:14px 36px; color:#FFFFFF;
                font-weight:bold; font-size:16px; text-decoration:none;
                border-radius:8px;">
        Ir a iniciar sesión
      </a>
    </td>
  </tr>
</table>

<hr style="margin:40px 0; border:none; border-top:1px solid #E5E7EB;"/>

<h2 style="color:#001d56; font-size:18px; margin:0 0 16px 0;">
  ¿Prefieres crear una contraseña?
</h2>

<p style="margin:0 0 16px 0;">
  Si quieres poder iniciar sesión también con tu correo y una contraseña
  (sin perder el acceso por {{provider}}), puedes crear una contraseña aquí:
</p>

<p style="margin:0 0 24px 0;">
  <a href="{{resetUrl}}"
     style="color:#001d56; font-weight:bold; text-decoration:underline;">
    Crear contraseña para mi cuenta
  </a>
</p>

<p style="margin:0 0 24px 0; font-size:14px; color:#6B7280;">
  Tras crear la contraseña, podrás iniciar sesión con cualquiera de los dos métodos.
</p>

<div style="margin-top:32px; padding:16px; background:#FEF3C7;
            border-left:4px solid #F59E0B; border-radius:4px;">
  <p style="margin:0; font-size:14px; color:#92400E;">
    ⏱️ Este enlace expira en <strong>{{ttlHumanReadable}}</strong>.
  </p>
</div>

<div style="margin-top:24px; padding:16px; background:#FEE2E2;
            border-left:4px solid #DC2626; border-radius:4px;">
  <p style="margin:0; font-size:14px; color:#991B1B;">
    ⚠️ <strong>¿No fuiste tú?</strong> Si no solicitaste este cambio, ignora este correo.
  </p>
</div>
```

**Texto plano:**
```
Hola {{firstName}},

Tu cuenta de TuBus Express está vinculada con {{provider}} y no tiene contraseña actualmente.

Te recomendamos iniciar sesión con {{provider}}:
{{loginUrl}}

Si prefieres crear una contraseña para usar también con tu correo:
{{resetUrl}}

(Tras crearla, podrás entrar con ambos métodos.)

Este enlace expira en {{ttlHumanReadable}}.

Si no solicitaste esto, ignora este correo.

— El equipo de TuBus Express
```

---

## 6. Implementación técnica

### 6.1. Motor de templating

Recomendado: **`handlebars`** (`npm i handlebars`).

**Razones:**
- Sintaxis simple y segura (escapado automático con `{{var}}` vs `{{{var}}}` para HTML literal).
- Bien establecido, compatible con Node.
- No requiere compilación previa.

### 6.2. Estructura del servicio

```typescript
// backend/src/shared/services/mail/mail.service.ts

interface SendVerificationEmailArgs {
  to: string;
  firstName: string;
  verificationUrl: string;
}

interface SendPasswordResetArgs {
  to: string;
  firstName: string;
  resetUrl: string;
  isOAuth: boolean;
  provider?: 'Google' | 'Facebook';
  loginUrl?: string;
}

class MailService {
  constructor(
    private provider: IMailProvider,
    private fromEmail: string
  ) {}

  async sendVerificationEmail(args: SendVerificationEmailArgs): Promise<void> {
    const html = this.renderTemplate('email-verification', args);
    const text = this.renderTextTemplate('email-verification.txt', args);

    await this.provider.send({
      from: this.fromEmail,
      to: args.to,
      subject: 'Verifica tu cuenta en TuBus Express',
      html,
      text,
    });
  }

  async sendPasswordResetEmail(args: SendPasswordResetArgs): Promise<void> {
    const templateName = args.isOAuth ? 'oauth-reset-info' : 'password-reset';
    const html = this.renderTemplate(templateName, args);
    // ...
  }

  private renderTemplate(name: string, vars: object): string {
    const tplPath = path.join(__dirname, '../../templates/emails', `${name}.html`);
    const tpl = fs.readFileSync(tplPath, 'utf-8');
    return Handlebars.compile(tpl)({
      ...vars,
      appName: 'TuBus Express',
      logoUrl: process.env.EMAIL_LOGO_URL || 'https://tubusexpress.com/logo.png',
      currentYear: new Date().getFullYear(),
      supportEmail: 'soporte@tubusexpress.com',
    });
  }

  /**
   * Formats a TTL in minutes to a human-readable string.
   * Examples: 30 → "30 minutos", 60 → "1 hora", 90 → "1 hora y 30 minutos", 120 → "2 horas"
   */
  static formatTtl(minutes: number): string {
    if (minutes < 60) return `${minutes} minutos`;
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    const hoursStr = hours === 1 ? '1 hora' : `${hours} horas`;
    if (remaining === 0) return hoursStr;
    return `${hoursStr} y ${remaining} minutos`;
  }
}
```

**Uso del helper:**

```typescript
const ttlHumanReadable = MailService.formatTtl(config.passwordReset.tokenTTLMinutes);
mailService.sendPasswordResetEmail({
  to: user.email,
  firstName: user.firstName,
  resetUrl,
  ttlHumanReadable,  // ← se inyecta en la plantilla
  isOAuth: false,
});
```

### 6.3. Reintentos con backoff

```typescript
async function sendWithRetry(fn: () => Promise<void>, maxAttempts = 3): Promise<void> {
  let lastError;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await fn();
      return;
    } catch (err) {
      lastError = err;
      if (i < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));  // 1s, 2s, 4s
      }
    }
  }
  throw lastError;
}
```

---

## 7. Pruebas manuales

Antes de cerrar la implementación, verificar visualmente cada plantilla en:
- Gmail (web)
- Outlook (web y desktop)
- Apple Mail
- Móvil (iOS Mail, Gmail app)

Herramientas útiles:
- [Litmus](https://litmus.com) (de pago, screenshots de muchos clientes)
- [Mailtrap](https://mailtrap.io) (sandbox de correos para dev)

---

## 8. Checklist de plantillas

- [ ] Logo carga en todos los clientes (verificar URL accesible)
- [ ] Botón se ve en todos los clientes (Outlook tiende a romper)
- [ ] Texto del botón legible con buen contraste
- [ ] Link alternativo visible si el botón no funciona
- [ ] Footer presente con aviso de seguridad
- [ ] Texto plano disponible (algunos lectores no muestran HTML)
- [ ] Variables escapadas correctamente (probar con `firstName="<script>alert(1)</script>"`)

---

**Documento siguiente:** [`07-implementation-phases.md`](./07-implementation-phases.md) — detalle de cada fase de implementación.
