# Arquitectura

## Principio rector

**Tres niveles de abstracción claramente separados.** Cada nivel tiene una responsabilidad única y depende solo del siguiente vía contratos (interfaces), no implementaciones concretas. Aplica DIP (Dependency Inversion Principle) y SoC (Separation of Concerns).

```
┌─────────────────────────────────────────────────────────────────┐
│  NIVEL 3 — NEGOCIO                                              │
│  order.service.ts, mechanic-assignment.service.ts, etc.         │
│  → No conoce push, no conoce FCM, no conoce Firebase.           │
│  → Solo sabe que llama a notificationService.create(...)        │
│    o userNotificationService.create(...).                       │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│  NIVEL 2 — NOTIFICACIONES                                       │
│  notification.service.ts, user-notification.service.ts          │
│  → Persiste en Mongo (responsabilidad actual, sin cambios).     │
│  → Llama a pushService.dispatch(...) como side-effect           │
│    fire-and-forget tras la persistencia.                        │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│  NIVEL 1 — TRANSPORTE PUSH                                      │
│  shared/services/push/                                          │
│    ├── push.service.ts (orquestador)                            │
│    ├── interfaces/push-provider.interface.ts (contrato)         │
│    └── providers/                                               │
│        ├── fcm.provider.ts (impl FCM)                           │
│        └── mock.provider.ts (tests)                             │
│  → No conoce ni Mongo ni el negocio.                            │
│  → Resuelve tokens, hace fan-out, limpia tokens muertos.        │
└────────────────────────┬────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│  NIVEL 0 — INFRAESTRUCTURA FIREBASE                             │
│  config/firebase.ts                                             │
│  → Singleton compartido entre TODOS los usos de Firebase.       │
│  → Hoy lo consume FcmProvider. Mañana lo consumirá Analytics    │
│    (sin re-bootstrap, sin duplicar credenciales).               │
└─────────────────────────────────────────────────────────────────┘
```

**Beneficio inmediato:** si Firebase deprecara FCM Web (improbable) o quieres migrar a OneSignal/web-push estándar, cambias `FcmProvider` por `WebPushProvider`. Ningún otro nivel se entera.

**Beneficio diferido:** cuando agregues Analytics, importas de `@config/firebase` y reusas la misma instancia. Cero re-bootstrap, cero duplicación de credenciales.

---

## Patrón Provider — espejo del módulo mail

El proyecto ya tiene este patrón validado en `backend/src/shared/services/mail/`:

```
mail/
├── index.ts                              ← singleton bound to ResendProvider
├── mail.service.ts                       ← orquestador
├── interfaces/mail-provider.interface.ts ← IMailProvider contract
└── providers/
    ├── resend.provider.ts                ← prod
    └── mock.provider.ts                  ← tests
```

El módulo de push replica exactamente esa estructura:

```
push/
├── index.ts                              ← singleton bound to FcmProvider
├── push.service.ts                       ← orquestador (fan-out + cleanup)
├── interfaces/push-provider.interface.ts ← IPushProvider contract
└── providers/
    ├── fcm.provider.ts                   ← prod (consume @config/firebase)
    └── mock.provider.ts                  ← tests
```

Ventajas del paralelismo:
- **Curva de aprendizaje cero** para cualquier dev del equipo: si entiende mail, entiende push.
- **Tests con MockPushProvider** siguen el mismo patrón que `MockMailProvider`.
- **Reglas operativas idénticas:** retries, error handling, logging.

---

## Flujo end-to-end con app cerrada

```
[Usuario cliente con PWA instalada, navegador en background]
                    │
                    │  (No interacciona con la app)
                    ↓
[Backend recibe POST /api/orders → status APPROVED]
                    │
                    ↓
[order.service.ts → sendUserStatusNotification()]
                    │
                    ↓
[userNotificationService.create({ userId, type, title, message, ... })]
                    │
                    ├──→ UserNotification.create(...)  ← persiste en Mongo (igual que hoy)
                    │
                    └──→ pushService.dispatch({ subjectType: 'user', subjectId: userId, payload })
                                    │
                                    ↓
                              [Resuelve tokens activos del userId desde DeviceToken collection]
                                    │
                                    ↓
                              [FcmProvider.sendMulticast(tokens, fcmPayload)]
                                    │
                                    ↓
                              [Servidor FCM de Google → Web Push HTTP/2]
                                    │
                                    ↓
                              [Navegador del usuario recibe push en background]
                                    │
                                    ↓
                              [SO despierta firebase-messaging-sw.js]
                                    │
                                    ↓
                              [SDK Firebase muestra notificación nativa con título/mensaje]
                                    │
                                    │  (usuario ve el toast del SO, click en él)
                                    ↓
                              [SW dispara notificationclick → abre/foco PWA en /perfil#notificaciones]
```

**Tiempo total:** ~1-3 segundos desde el `await Order.save()` hasta el toast visible en el SO del usuario.

---

## Coexistencia con el sistema actual

| Componente actual | Acción en este plan | Razón |
|---|---|---|
| `notifications.model.ts` (Mongo) | **Conservar** | Persistencia es necesaria como fuente de verdad. Push es solo transporte. |
| `user-notifications.model.ts` (Mongo) | **Conservar** | Misma razón. |
| `notification.service.ts` `.create()` | **Extender** con 1 línea: `pushService.dispatch(...)` post-persist. | SoC: el service de notificaciones orquesta, no implementa transporte. |
| `user-notification.service.ts` `.create()` | **Extender** con 1 línea idéntica. | Misma razón. |
| 14 call sites en `order.service.ts` y `mechanic-assignment.service.ts` | **Cero cambios.** | El `.create()` sigue teniendo la misma firma; el push es transparente. |
| Polling 30 s en `UserNotificationService` (frontend) | **Reducir a 120 s** cuando hay token FCM activo. **Conservar 30 s** como fallback si no hay token. | Push no es 100 % confiable; el polling garantiza eventual consistency de la UI. |
| `Notification` API local + `triggerBrowserPush` (frontend) | **Conservar** como fallback en el branch sin token. | Defensa en profundidad. |
| `sw.js` (PWA installability) | **Cero cambios.** | Su scope (`/`) y su responsabilidad (network-only pass-through) son ortogonales a FCM. |

---

## Por qué dos Service Workers separados (no fusionados)

### Opción descartada: SW único

Mover toda la lógica FCM al `sw.js` actual usando `firebase.messaging().useServiceWorker(reg)`.

**Contras:**
- Acopla un SW que existe solo para PWA installability con lógica de mensajería.
- Si se rompe el handler `push`, puede afectar la instalabilidad PWA.
- Mezcla SoC: un SW = una responsabilidad.

### Opción elegida: SW separado

`firebase-messaging-sw.js` registrado por el SDK de Firebase, en su propio scope (`/firebase-cloud-messaging-push-scope`).

**Pros:**
- Cada SW tiene una sola responsabilidad.
- El SDK de Firebase lo registra automáticamente y lo mantiene actualizado.
- El `sw.js` actual no se toca; la PWA installability queda blindada.
- Convención oficial de Firebase: cero fricción con tooling externo.

**Único costo:** duplicar el handler `notificationclick` en ambos SWs (~30 líneas). Aceptable.

---

## Modelo de tokens: por qué polimórfico (`subjectType`)

### Opción descartada: dos colecciones (`UserDeviceToken`, `AdminDeviceToken`)

**Contras:**
- Duplicación de schema, índices, controllers, servicios.
- `pushService.dispatch()` necesitaría dos paths según el subject.
- Difícil de extender si mañana agregas otro tipo de receptor (e.g. mecánicos con token propio).

### Opción elegida: una sola colección con discriminator

```ts
{
  subjectType: 'user' | 'admin',
  subjectId: ObjectId,  // ref polimórfico
  token: string,
  ...
}
```

**Pros:**
- Un solo modelo, un solo controller, un solo service.
- Índice compuesto `{ subjectType, subjectId }` resuelve consultas en O(log n).
- Extensible: agregar `'mechanic'` requiere solo extender el enum.
- `pushService.dispatch({ subjectType, subjectId })` es uniforme.

**Tradeoff aceptado:** no hay foreign key constraint nativa de Mongoose con tipo dinámico. Se valida en application layer al crear el token.

---

## Por qué el polling no se elimina

Push web NO es 100 % confiable. Casos donde se pierde:

1. Battery Saver de Android retiene pushes hasta desactivarse.
2. Modo No Molestar / Focus de iOS los retiene también.
3. Token caducó silenciosamente y el cliente aún no se enteró.
4. FCM tuvo un outage transitorio (raro pero ha pasado).
5. Usuario revocó permisos en configuración del navegador.

El polling cada 120 s sirve como **eventual consistency**: aunque se pierda un push, el contador y la lista de notificaciones se sincronizan en máximo 2 minutos. Sin polling, el usuario podría ver "0 notificaciones nuevas" cuando en realidad tiene 5.

**Trade-off:** ligero overhead de red (1 request cada 2 min por sesión activa). Aceptable comparado con el costo de un usuario que se queja de "no me llegan notificaciones" cuando en realidad sí se generaron pero no llegaron al dispositivo.

---

## Manejo de errores y resiliencia

### Principio: el push NUNCA bloquea el negocio

Todos los `pushService.dispatch(...)` se invocan con `.catch()` no-bloqueante:

```ts
// In notification.service.ts
const notification = await Notification.create(data);
pushService.dispatch({ ... }).catch((err) => {
  logger.warn('[push] dispatch failed', { error: err.message });
});
return notification;
```

Si Firebase está caído, si las credenciales son inválidas, si el dispatcher tarda 30 s — la creación de la orden **no se ve afectada**. Esto es consistente con el patrón actual (`try { ... } catch { /* silent */ }` en los call sites).

### Cleanup automático de tokens muertos

`FcmProvider.send()` debe interpretar errores específicos:

| Error code FCM | Acción |
|---|---|
| `messaging/registration-token-not-registered` | Borrar token de BD inmediatamente |
| `messaging/invalid-registration-token` | Borrar token de BD inmediatamente |
| `messaging/invalid-argument` | Loggear, no borrar (puede ser bug en payload) |
| `messaging/quota-exceeded` | Retry con backoff (max 3 intentos) |
| Otros | Loggear, no borrar |

Esta limpieza es **dentro del send**, no en un cron separado, para minimizar la ventana donde el token muerto sigue gastando tiempo en cada dispatch.

---

## Resumen de SOLID

| Principio | Aplicación en este diseño |
|---|---|
| **SRP** (Single Responsibility) | Cada servicio tiene UNA responsabilidad: persistir, transportar, configurar Firebase. |
| **OCP** (Open-Closed) | Agregar un nuevo provider (e.g. WebPush nativo) no toca `PushService`. |
| **LSP** (Liskov) | `MockPushProvider` y `FcmProvider` son intercambiables vía `IPushProvider`. |
| **ISP** (Interface Segregation) | `IPushProvider` solo declara `send()`. No expone detalles FCM en el contrato. |
| **DIP** (Dependency Inversion) | `PushService` depende de `IPushProvider`, no de `FcmProvider`. |
