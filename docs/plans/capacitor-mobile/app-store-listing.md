# App Store Connect — Listing TuBus Express (es-VE)

> **Status:** Draft generado en F4 (Phase B Windows track). Pegar tal cual en App Store Connect cuando llegue el día del Mac + cuenta Apple Developer activa.
> **Idioma primario:** Español (México) → es-MX (Apple no expone es-VE como idioma de listing; es-MX es lo más cercano).

---

## App Information

| Campo | Límite Apple | Valor |
|---|---|---|
| **App Name** | 30 chars | `TuBus Express` |
| **Subtitle** | 30 chars | `Repuestos y servicios` |
| **Bundle ID** | — | `com.tubusexpress.app` |
| **SKU** | — | `tubusexpress-ios-v1` |
| **Primary Language** | — | Spanish (Mexico) |
| **Category Primary** | — | Shopping |
| **Category Secondary** | — | Business |
| **Content Rights** | — | Does not contain, show, or access third-party content |

---

## Pricing and Availability

| Campo | Valor |
|---|---|
| Price | Free |
| Availability | All countries / regions (default) |
| Pre-orders | No |

---

## App Privacy

| Campo | Valor |
|---|---|
| Privacy Policy URL | `https://tubusexpress.com/legal/privacidad` |
| Data Collection | Sí (ver `app-store-privacy-nutrition.md` para detalle) |

---

## App Store

### Promotional Text (170 chars máx — editable post-release sin re-submit)

```
Nuevas funciones: inicia sesión con tu cuenta de Apple, recibe notificaciones de tus pedidos en tiempo real y encuentra la sucursal más cercana con un toque.
```

### Description (4000 chars máx)

```
TuBus Express es la app oficial de la red de talleres y tienda de repuestos automotrices TuBus en Venezuela. Compra repuestos genuinos, agenda servicios mecánicos y recibe atención personalizada desde tu iPhone.

CATÁLOGO COMPLETO
• Miles de repuestos para autos, camionetas y SUV.
• Filtros por marca, línea, categoría y tipo de vehículo.
• Stock por sucursal — sabes dónde retirar antes de comprar.
• Imágenes de alta calidad y descripciones detalladas.

SERVICIOS MECÁNICOS
• Cambio de aceite a domicilio o en tu sucursal preferida.
• Mecánico asignado con su perfil, foto y opiniones de clientes.
• Seguimiento del servicio en tiempo real desde la app.
• Calificación y comentarios al finalizar.

CHECKOUT FLEXIBLE
• 6 modalidades de despacho: retiro en tienda, envío por agencia, entrega local, acuerdo con vendedor, oil change a domicilio o en sucursal.
• Sube el comprobante de pago directamente desde la cámara.
• Confirmación inmediata + número de pedido.
• Historial de pedidos y pagos siempre disponible.

GARAJE PERSONAL
• Registra tus vehículos (placa, marca, modelo, año).
• Filtra el catálogo automáticamente por compatibilidad.
• Servicios mecánicos pre-llenados con datos del vehículo seleccionado.

ZONIFICACIÓN INTELIGENTE
• Selecciona tu ciudad y municipio.
• La app te muestra las sucursales más cercanas y el costo de despacho.
• Usa tu ubicación GPS para detectar zona automáticamente (opcional).

NOTIFICACIONES PUSH
• Recibe alertas cuando tu pedido cambia de estado.
• Mensajes del taller cuando hay novedades sobre tu servicio.
• Recordatorios de citas mecánicas.

INICIO DE SESIÓN SEGURO
• Cuenta TuBus con correo y contraseña.
• Inicio rápido con Apple (Sign in with Apple).
• Inicio rápido con Google.
• Soporte para Face ID y Touch ID (próximamente).

SOPORTE AL CLIENTE
• Contacto directo por WhatsApp.
• Llamada con un toque a nuestras sucursales.
• Política de privacidad transparente.
• Todos los datos se mantienen en servidores nuestros y no se venden a terceros.

REQUISITOS
• iOS 14 o superior.
• Conexión a internet para navegar el catálogo y completar compras.
• Apple ID configurado para descargar la app.

¿Por qué TuBus Express?
Llevamos años atendiendo a la comunidad venezolana del transporte y la mecánica. Esta app concentra todo lo que ya ofrecemos en nuestras sucursales físicas y en la web tubusexpress.com — ahora en tu bolsillo, optimizado para iOS.

Descarga, regístrate en 30 segundos y empieza a comprar.
```

### Keywords (100 chars máx, separados por coma SIN espacios)

```
repuestos,autos,mecanico,aceite,filtros,venezuela,caracas,delivery,taller,bus
```

### Support URL

```
https://tubusexpress.com/contacto
```

### Marketing URL (opcional)

```
https://tubusexpress.com
```

---

## What's New in This Version (v1.0.0)

```
Lanzamiento oficial de TuBus Express para iPhone.

Esta primera versión incluye:
• Catálogo completo de repuestos con filtros y búsqueda.
• 6 modalidades de despacho y checkout end-to-end.
• Agenda de servicios mecánicos con seguimiento en vivo.
• Garaje personal con vehículos guardados.
• Notificaciones push de tus pedidos y servicios.
• Inicio de sesión con Apple ID, Google o correo.
• Detección automática de zona vía GPS.
```

---

## App Review Information

| Campo | Valor |
|---|---|
| Sign-in required | Yes |
| Demo account username | `apple-review@tubusexpress.com` |
| Demo account password | (generar antes del submit — anotar en vault) |
| Contact First Name | Luis |
| Contact Last Name | Carvallo |
| Contact Phone | +58 (a completar) |
| Contact Email | `tubusservice@gmail.com` |
| Notes for the App Reviewer | (ver bloque abajo) |

### Notes for the App Reviewer (texto sugerido)

```
TuBus Express is an e-commerce + mechanical services app for the Venezuelan
market. The demo account above is pre-configured with a sample order in
"approved" state so the reviewer can inspect the post-purchase flow.

Sign in with Apple is implemented to comply with App Review Guideline 4.8.
The backend endpoint POST /api/auth/apple/native verifies the identityToken
against Apple's public JWKS (apple-signin-auth library) with strict audience
check against our bundle ID (com.tubusexpress.app).

Push notifications are delivered via Firebase Cloud Messaging (APNs).
Camera and Photo Library access are requested only when the user explicitly
taps "Upload receipt" or "Change avatar". GPS access is opt-in via a single
"Use my location" button in the zoning modal.

No in-app purchases or external payments in v1. Payment is offline (bank
transfer / mobile payment Venezuela-specific) and the user uploads a receipt
photo as proof — same flow already operating on web (tubusexpress.com) and
Android (com.tubusexpress.app on Google Play).

Server-side code repository: private (available on request).
```

---

## Screenshots (a producir antes del submit)

Apple requiere screenshots para **3 tamaños obligatorios** mínimo:

| Device | Resolución | Cantidad | Estado |
|---|---|---|---|
| iPhone 6.9" (15/16 Pro Max) | 1290 × 2796 | 5 mínimo (10 máx) | ⏳ Pendiente — capturar tras instalar la primera build firmada |
| iPhone 6.5" (11/12/13 Pro Max) | 1242 × 2688 | 5 mínimo | ⏳ Pendiente |
| iPhone 5.5" (8 Plus) | 1242 × 2208 | 5 mínimo | ⏳ Pendiente |

**Sugerencia de contenido por screenshot:**
1. Landing con hero "Cambia el aceite" + carousel productos.
2. Catálogo con filtros activos.
3. Detalle de producto con badge COMBO + galería.
4. Carrito con varios items + total.
5. Checkout summary con métodos de pago.

**Estrategia mientras no haya iPhone:** generar mockups en Figma con frames device iOS pegando capturas del Android (POCO) re-escaladas. Apple acepta mockups stilizados.

---

## Version Number

```
1.0.0 (CFBundleShortVersionString)
1 (CFBundleVersion, increment con cada submit)
```

Sincronizado con Android `versionName "1.0"` + `versionCode 1` per decision D12.
