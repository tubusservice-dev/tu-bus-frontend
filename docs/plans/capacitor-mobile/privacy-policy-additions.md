# Política de Privacidad — Adiciones para iOS (Phase B)

> **Status:** Texto listo para pegar en `https://www.tubusexpress.com/legal/privacidad` (dominio canónico **con `www`**; el apex sin `www` devuelve 404).
> **Cuándo aplicar:** antes de submit a App Store Connect (Apple Review rechaza apps cuya política no menciona los proveedores third-party que la app usa).
> **Quién aplica:** owner — editar manualmente el sitio web (esto está fuera del repo de Capacitor).

---

## Cambios mínimos requeridos

La política actual probablemente menciona Firebase Cloud Messaging (FCM) y Crashlytics desde Phase 6. Hay que **añadir** las siguientes secciones / menciones:

---

### Sección "Servicios de terceros" — añadir Sign in with Apple

Si ya existe una sección de "Servicios de terceros", añadir esta entrada. Si no existe, crearla.

```
🍎 Sign in with Apple
TuBus Express ofrece la opción de iniciar sesión usando tu cuenta Apple
(disponible solo en dispositivos iOS). Cuando lo haces, Apple comparte
con nosotros únicamente:
  - Un identificador único de tu cuenta Apple (estable y exclusivo para
    TuBus Express).
  - Tu nombre, sólo en el PRIMER inicio de sesión (Apple no lo entrega
    en sesiones siguientes).
  - Tu correo electrónico — si eliges "Compartir mi correo", recibimos
    tu correo real; si eliges "Ocultar mi correo", recibimos una dirección
    de reenvío de Apple (xxxx@privaterelay.appleid.com) que Apple
    reenvía a tu correo real.

NO recibimos tu contraseña Apple. Apple no comparte con nosotros tu
historial de compras App Store, tu localización, ni ningún otro dato.

Más información sobre Sign in with Apple:
https://www.apple.com/legal/privacy/data/es/sign-in-with-apple/
```

---

### Sección "Servicios de terceros" — verificar Firebase Authentication

Si ya está mencionado para Google, ampliar para cubrir Apple también:

```
🔐 Firebase Authentication (Google)
Cuando inicias sesión con tu cuenta Google, Google comparte con nosotros
tu identificador único Google, tu correo, tu nombre y (opcionalmente)
tu foto de perfil. Tu contraseña Google nunca llega a nuestros servidores.
Más información: https://policies.google.com/privacy
```

---

### Sección "Servicios de terceros" — confirmar Firebase Cloud Messaging

Debería ya estar desde Phase 6. Verificar que el texto sea similar a:

```
📲 Firebase Cloud Messaging (FCM)
Para enviarte notificaciones push (cambios de estado de tu pedido,
mensajes del taller, recordatorios de servicio) usamos Firebase Cloud
Messaging de Google. FCM utiliza:
  - En Android: el sistema nativo de notificaciones de Google.
  - En iOS: Apple Push Notification service (APNs).
En ambos casos, FCM genera un "device token" único que asociamos a tu
cuenta para enviarte sólo las notificaciones que te corresponden.
Más información: https://firebase.google.com/policies/messaging
```

---

### Sección "Servicios de terceros" — confirmar Firebase Crashlytics

Debería ya estar desde Phase 6. Si no:

```
🐛 Firebase Crashlytics
Cuando la app sufre un error inesperado, enviamos automáticamente a
Crashlytics el reporte técnico del crash (línea de código, modelo de
dispositivo, versión del SO). No incluimos tu correo, contraseña ni
ningún dato personal en estos reportes — sólo información técnica
anónima que nos ayuda a corregir el problema.
Más información: https://firebase.google.com/support/privacy
```

---

### Sección "Servicios de terceros" — añadir Firebase Analytics (si se activa)

Pendiente decisión sobre activarlo en v1 (decisión 1.10 = sí desde v1).

```
📊 Firebase Analytics
Para entender qué funciones de la app usas más y mejorar la experiencia,
usamos Firebase Analytics. Esto recolecta de forma agregada y anónima:
  - Qué pantallas visitas y cuánto tiempo permaneces en cada una.
  - Qué acciones realizas (búsquedas, agregar al carrito, completar
    compra, etc).
  - El tipo de dispositivo y versión de SO.
NO recolecta tu identidad personal ni cruza estos datos con publicidad
de terceros. NO usamos identificadores publicitarios (IDFA en iOS,
ADID en Android).
Más información: https://firebase.google.com/support/privacy
```

---

### Nueva sección "Permisos del dispositivo (iOS y Android)" — añadir o ampliar

```
🔓 Permisos del dispositivo

La app pide los siguientes permisos sólo cuando son necesarios para una
acción que tú inicias. Puedes revocarlos en cualquier momento desde la
configuración de tu sistema operativo.

  - Cámara — para capturar fotos de comprobantes de pago o fotos de
    perfil. La pedimos cuando tocas "Subir foto" → "Cámara".
  - Galería de fotos — para seleccionar imágenes ya guardadas. La
    pedimos cuando tocas "Subir foto" → "Galería".
  - Ubicación (mientras usas la app) — para sugerirte la sucursal más
    cercana. La pedimos sólo cuando tocas "Usar mi ubicación" en la
    pantalla de zonificación. NUNCA recolectamos tu ubicación en
    segundo plano.
  - Face ID / Touch ID (iOS) o Huella (Android) — para iniciar sesión
    rápido sin volver a escribir tu contraseña. La pedimos sólo
    cuando tú activas "Inicio rápido con biometría" en tu perfil.
  - Notificaciones push — para avisarte de cambios en tus pedidos.
    La pedimos cuando activas el toggle "Recibir notificaciones" en
    tu perfil.

NO pedimos permisos de: contactos, micrófono, calendario, salud,
publicidad ni ningún otro recurso del dispositivo.
```

---

### Nueva sección "Datos que NO recolectamos" (recomendada para Apple Review)

```
❌ Lo que NO hacemos

  - NO te rastreamos a través de otras apps o sitios web.
  - NO compartimos tus datos con empresas de publicidad.
  - NO vendemos tu información a terceros.
  - NO usamos identificadores publicitarios (IDFA, Google Advertising ID).
  - NO accedemos a tus contactos, calendario, salud ni micrófono.
  - NO recolectamos información financiera (los pagos son por transferencia
    o pago móvil — tú subes una foto del comprobante, sin datos de tarjeta).
```

---

## Checklist de validación post-publicación

Antes de pegar el texto en producción:

- [ ] Texto en español venezolano (consistente con el resto del sitio).
- [ ] Fecha de "Última actualización" actualizada al día del cambio.
- [ ] Versión anterior archivada (para auditoría legal).
- [ ] Footer del sitio enlaza correctamente a `/legal/privacidad`.
- [ ] App Store Connect → App Privacy → URL de política coincide con la URL final.

Una vez pegado en producción, en App Store Connect debes pegar la URL EXACTA: `https://tubusexpress.com/legal/privacidad` (no `/privacy`, no `/legal/privacy-policy` — debe ser idéntica para que Apple la encuentre).

---

## Por qué importa

App Store Review Guideline 5.1.1 — toda app que use third-party SDKs (Firebase, Apple ID, Google) debe declarar cada uno en su política de privacidad. Apple Review scrappea el HTML de la URL declarada y busca menciones explícitas. Si no encuentra "Firebase" o "Apple Sign In" → rechazo.

Este documento da el texto mínimo. Si tu legal team quiere endurecerlo (cláusulas GDPR, derecho al olvido, etc.) está fuera del scope técnico de este plan.
