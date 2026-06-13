# Google Play Console — Listing TuBus Express (es)

> **Status:** ✅ En uso — Phase 7 en **Closed Testing** (actualizado 2026-06-12). Contenido del listing ya aplicado en Play Console.
> **Idioma primario del listing:** Español (`es`). Play sí permite Español genérico; opcionalmente añadir `es-419` (Latinoamérica) como traducción.
> **Cuenta:** Google Play Developer ya verificada ✅. App creada en la consola (`com.tubusexpress.app`, cuenta personal `TuBus Servicios`).
> **Equivalente iOS:** [`app-store-listing.md`](app-store-listing.md). Las diferencias clave están marcadas con ⚠️ **DIFF iOS**.

---

## 1. Detalles de la app (App details)

| Campo | Límite Play | Valor |
|---|---|---|
| **App name** | 30 chars | `TuBus Express` |
| **Short description** | 80 chars | `Repuestos, cambio de aceite y servicios mecánicos a domicilio en Venezuela.` |
| **Full description** | 4000 chars | (ver bloque §3) |
| **Package name** | — | `com.tubusexpress.app` (inmutable tras la primera subida) |
| **App o Game** | — | App |
| **Categoría** | — | Shopping |
| **Tags** | 5 máx | Seleccionar de la lista predefinida de Play (sugeridos: *Shopping*, *Auto & Vehicles* si está disponible como tag). Play solo deja elegir tags de su catálogo. |
| **Email de contacto** | obligatorio | `tubusservice@gmail.com` |
| **Teléfono** | opcional | +58 (a completar) |
| **Sitio web** | opcional | `https://tubusexpress.com` |
| **Privacy Policy URL** | obligatorio | `https://www.tubusexpress.com/legal/privacidad` (dominio canónico **con `www`**; el apex sin `www` devuelve 404) |

> ⚠️ **DIFF iOS:** Apple usa *App Name* (30) + *Subtitle* (30) + *Keywords* (100). Play usa *App name* (30) + *Short description* (80) + *Full description* (4000). **Play NO tiene campo de keywords** — el indexado se hace sobre el texto de la descripción. No metas listas de palabras separadas por comas en la descripción (Google lo penaliza como spam).

---

## 2. Modelo de negocio

| Campo | Valor |
|---|---|
| Precio | Gratis (Free) |
| Compras dentro de la app (in-app products) | **No** |
| Contiene anuncios (Contains ads) | **No** |
| Disponibilidad / países | Todos (default) — confirmar al menos Venezuela |

> Declarar **"No contiene anuncios"** en *Store presence → Store settings*. Si dejas mal este flag, Play muestra el badge "Contains ads" falso en la ficha.

---

## 3. Full description (4000 chars máx)

> ⚠️ **DIFF iOS:** se eliminó toda mención a Apple/Sign in with Apple, Face ID/Touch ID se sustituyó por "huella o reconocimiento facial", y los requisitos pasan de iOS 14 a Android 7.

```
TuBus Express es la app oficial de la red de talleres y tienda de repuestos automotrices TuBus en Venezuela. Compra repuestos genuinos, agenda servicios mecánicos y recibe atención personalizada desde tu teléfono Android.

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
• Usa tu ubicación GPS para detectar tu zona automáticamente (opcional).

NOTIFICACIONES PUSH
• Recibe alertas cuando tu pedido cambia de estado.
• Mensajes del taller cuando hay novedades sobre tu servicio.
• Recordatorios de citas mecánicas.

INICIO DE SESIÓN SEGURO
• Cuenta TuBus con correo y contraseña.
• Inicio rápido con Google.
• Desbloqueo con huella o reconocimiento facial para volver a entrar sin escribir tu contraseña.

SOPORTE AL CLIENTE
• Contacto directo por WhatsApp.
• Llamada con un toque a nuestras sucursales.
• Política de privacidad transparente.
• Todos los datos se mantienen en servidores nuestros y no se venden a terceros.

REQUISITOS
• Android 7.0 o superior.
• Conexión a internet para navegar el catálogo y completar compras.

¿Por qué TuBus Express?
Llevamos años atendiendo a la comunidad venezolana del transporte y la mecánica. Esta app concentra todo lo que ya ofrecemos en nuestras sucursales físicas y en la web tubusexpress.com — ahora en tu bolsillo.

Descarga, regístrate en 30 segundos y empieza a comprar.
```

---

## 4. Recursos gráficos (Graphic assets) — OBLIGATORIOS

Play tiene requisitos distintos a Apple. Estos son los mínimos para publicar:

| Recurso | Especificación Play | Estado | Notas |
|---|---|---|---|
| **App icon** | 512 × 512 px, PNG 32-bit (con alpha), ≤ 1 MB | ✅ Disponible | Ya existe `resources/icon.png` 1024×1024 → reescalar a 512. NO confundir con el icono adaptativo del APK (eso ya lo generó `capacitor-assets`). Este es el icono de la **ficha de Play**. |
| **Feature graphic** | 1024 × 500 px, JPG o PNG 24-bit (SIN alpha) | ⏳ **FALTA** | Obligatorio. Es el banner superior de la ficha. Hay que diseñarlo (logo + claim sobre fondo `#001D56`). |
| **Phone screenshots** | 2–8 imágenes. Min 320 px, máx 3840 px lado. Ratio ≤ 2:1. JPG o PNG 24-bit | ⏳ **FALTA** | Recomendado 1080 × 1920 (9:16). Capturar de la build firmada en el POCO X4 Pro 5G. |
| **Tablet screenshots (7" y 10")** | Opcional | ❌ Omitir v1 | Solo si se quiere destacar en tablets. No bloqueante. |

> ⚠️ **DIFF iOS:** Apple exige screenshots por 3 tamaños de iPhone y NO usa feature graphic. Play exige **1 feature graphic 1024×500** + **mínimo 2 screenshots de teléfono**. El feature graphic es el bloqueador real porque hay que diseñarlo desde cero.

**Sugerencia de contenido por screenshot (reusar guion de iOS):**
1. Landing con hero "Cambia el aceite" + carrusel de productos.
2. Catálogo con filtros activos.
3. Detalle de producto con badge COMBO + galería.
4. Carrito con varios items + total.
5. Checkout summary con métodos de pago.

**Ventaja vs iOS:** aquí SÍ tienes el dispositivo físico (POCO X4 Pro 5G). Las capturas son reales, no mockups Figma. Capturar con la **build firmada de release**, no la debug.

---

## 5. Categorización y clasificación de contenido

### 5.1 Content rating (cuestionario IARC)

Play obliga a completar el cuestionario IARC. Respuestas esperadas para esta app:

| Pregunta IARC | Respuesta |
|---|---|
| Categoría de la app | Utility / Productivity / Communication / Other → **"Reference, News, or Educational"** o **"Other"** (es e-commerce, no juego) |
| ¿Violencia, sangre, contenido sexual, lenguaje fuerte, drogas? | No (a todo) |
| ¿Los usuarios pueden interactuar / comunicarse entre sí? | **Sí** — hay mensajería usuario↔taller y reseñas/comentarios. Declararlo. |
| ¿Comparte la ubicación del usuario con otros usuarios? | **No** (la ubicación es solo para zonificación interna, no se muestra a otros usuarios) |
| ¿Permite compras de bienes digitales? | No (pagos offline de bienes físicos) |

**Resultado esperado:** apta para todo público (PEGI 3 / ESRB Everyone), posiblemente con la nota "Interacción entre usuarios".

### 5.2 Target audience and content (público objetivo)

| Campo | Valor recomendado | Justificación |
|---|---|---|
| Grupos de edad objetivo | **18 y más** | Es una app transaccional (compras, pagos, servicios mecánicos). Elegir solo 18+ evita caer en la **Families Policy** de Google (que exige requisitos extra de privacidad infantil). |
| ¿La app está dirigida a niños? | **No** | |
| ¿Podría atraer a niños involuntariamente? | No (contenido 100% de repuestos/mecánica) | |

> ⚠️ Si marcas cualquier rango por debajo de 13, Play activa la **Families Policy** y la revisión se endurece muchísimo. Mantener 18+.

---

## 6. App access (acceso para revisión)

La app requiere login para casi todo. Play exige credenciales de prueba si hay contenido tras autenticación.

| Campo | Valor |
|---|---|
| ¿Todas las funciones están disponibles sin restricciones especiales? | **No — requiere login** |
| Usuario demo | `play-review@tubusexpress.com` |
| Contraseña demo | (generar antes del submit — guardar en vault) |
| Instrucciones | Pre-cargar la cuenta con un pedido en estado "aprobado" para que el revisor inspeccione el flujo post-compra. |

> ⚠️ **DIFF iOS:** mismo concepto que el "Demo account" de App Store Connect, pero usa una cuenta distinta (`play-review@`) para poder rastrear de qué tienda viene cada acceso de revisión.

---

## 7. Declaraciones obligatorias (App content)

Play exige completar TODAS estas secciones antes de publicar. Respuestas para TuBus Express:

| Declaración | Respuesta | Notas |
|---|---|---|
| **Privacy policy** | URL: `https://www.tubusexpress.com/legal/privacidad` | Debe estar viva y mencionar los SDK third-party (ver [`privacy-policy-additions.md`](privacy-policy-additions.md)). **Usar `www`** — el apex devuelve 404. |
| **Ads** | No contiene anuncios | |
| **App access** | Requiere credenciales (ver §6) | |
| **Content ratings** | Cuestionario IARC completo (§5.1) | |
| **Target audience** | 18+ (§5.2) | |
| **Data safety** | Ver [`play-store-data-safety.md`](play-store-data-safety.md) | Sección crítica. |
| **Government apps** | No es app gubernamental | |
| **Financial features** | ⚠️ Revisar — la app maneja pedidos con pago offline. Declarar que **NO** procesa pagos ni es app financiera. Los pagos son por transferencia/pago móvil fuera de la app (foto de comprobante). | |
| **Health apps** | No | |
| **News apps** | No | |

---

## 8. Versionado del release

| Campo | Valor | Fuente |
|---|---|---|
| `versionCode` | `3` | `android/app/build.gradle` (entero monotónico, +1 por cada subida; durante la subida a Play se iteró v1→v2→v3) |
| `versionName` | `1.1` | `android/app/build.gradle` (visible al usuario) |
| Release name (Play Console) | `1.1 (3)` | Nombre interno del release en la consola |

**Release notes v1.0 (Play Console → "What's new"):**

```
Lanzamiento oficial de TuBus Express para Android.

Esta primera versión incluye:
• Catálogo completo de repuestos con filtros y búsqueda.
• 6 modalidades de despacho y checkout end-to-end.
• Agenda de servicios mecánicos con seguimiento en vivo.
• Garaje personal con vehículos guardados.
• Notificaciones push de tus pedidos y servicios.
• Inicio de sesión con Google o correo.
• Desbloqueo con huella.
• Detección automática de zona vía GPS.
```

> ⚠️ Tras activar **Play App Signing** (decisión 1.7 = sí), Google re-firma el AAB con su release key. El **SHA-256 de esa release key** (visible en Play Console → *Setup → App signing*) debe añadirse a:
> 1. Firebase Console → Project settings → tu app Android (para que el login Google nativo funcione en la build de producción).
> 2. `public/.well-known/assetlinks.json` en producción (para que los **App Links con `autoVerify`** funcionen — ya contiene **2 SHA-256**: el del debug keystore y el del app signing key de Play).
>
> **Si te saltas esto, en la build de Play el login Google fallará y los deep links abrirán el navegador en vez de la app.** Es el error más común al publicar Capacitor + Firebase.
>
> **Nota de dominio (descubierto en Phase 7):** el host apex `tubusexpress.com` no sirve `assetlinks.json` (404); la verificación de App Links solo pasa en `www.tubusexpress.com`. Ver deuda **DT-1 (redirect 301 apex→www)** en [`18-phase-7-play-release.md`](18-phase-7-play-release.md).

---

## 9. Ruta de publicación recomendada

```
1. Crear la app en Play Console (package com.tubusexpress.app)
2. Completar TODAS las secciones de "App content" (§7) + Data safety
3. Subir el AAB firmado a → Testing → Internal testing
4. Añadir testers internos (emails) → instalar vía link de Play
5. QA en el POCO con la build de PLAY (no la local) — validar login Google + deep links
6. Promover a → Closed testing (opcional) o directo a Production
7. Production → Submit for review (primera revisión de Google: 1-7 días para cuentas nuevas)
```

> ⚠️ **Cuentas personales (2024+) — APLICA A ESTE PROYECTO:** Google exige **closed testing con mínimo 12 testers durante 14 días** antes de habilitar producción. La cuenta `TuBus Servicios` es personal, así que el requisito está activo. **Estado a 2026-06-12: en Closed Testing acumulando los 14 días con los 12 testers.**

---

## 10. Checklist pre-submit Google Play

- [ ] App creada en Play Console con package `com.tubusexpress.app`.
- [ ] AAB **firmado** subido (no APK debug).
- [ ] Play App Signing activado.
- [ ] SHA-256 de la release key añadido a Firebase Console.
- [ ] SHA-256 de la release key añadido a `assetlinks.json` en producción.
- [ ] App icon 512×512 subido.
- [ ] **Feature graphic 1024×500 diseñado y subido** (bloqueador — hay que crearlo).
- [ ] Mínimo 2 screenshots de teléfono (capturas reales del POCO con build de release).
- [ ] Full description pegada (sin listas de keywords).
- [ ] Data safety form completo y coincidente con [`play-store-data-safety.md`](play-store-data-safety.md).
- [ ] Content rating (IARC) completado.
- [ ] Target audience = 18+.
- [ ] Privacy policy viva con SDKs third-party declarados.
- [ ] Cuenta demo `play-review@tubusexpress.com` creada y con pedido de muestra.
- [ ] Verificado si aplica el requisito de 12 testers / 14 días.
```
