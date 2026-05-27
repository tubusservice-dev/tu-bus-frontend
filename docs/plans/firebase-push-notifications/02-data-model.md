# Modelo de datos

## Schemas Mongo nuevos

### `DeviceToken` (nueva colección)

**Ubicación:** `backend/src/modules/device-tokens/models/device-token.model.ts`

**Schema:**

```ts
import mongoose, { Schema } from 'mongoose';
import { IDeviceToken, DeviceTokenSubjectType, DevicePlatform } from '../interfaces/device-token.interface';

const deviceTokenSchema = new Schema<IDeviceToken>(
  {
    subjectType: {
      type: String,
      enum: ['user', 'admin'],
      required: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      required: true,
      // No `ref` porque es polimórfico — la resolución de modelo
      // depende de subjectType. Validación en application layer.
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    platform: {
      type: String,
      enum: ['web', 'android', 'ios'],
      default: 'web',
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret: Record<string, unknown>) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound index for fan-out queries: "give me all tokens for this admin/user"
deviceTokenSchema.index({ subjectType: 1, subjectId: 1 });

// Cleanup query support: "find tokens not seen in N days"
// (already covered by lastSeenAt index above)

export const DeviceToken = mongoose.model<IDeviceToken>('DeviceToken', deviceTokenSchema);
```

**Interface:**

```ts
// backend/src/modules/device-tokens/interfaces/device-token.interface.ts
import { Document, Types } from 'mongoose';

export type DeviceTokenSubjectType = 'user' | 'admin';
export type DevicePlatform = 'web' | 'android' | 'ios';

export interface IDeviceToken extends Document {
  subjectType: DeviceTokenSubjectType;
  subjectId: Types.ObjectId;
  token: string;
  platform: DevicePlatform;
  userAgent?: string;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDeviceTokenResponse {
  id: string;
  platform: DevicePlatform;
  userAgent?: string;
  lastSeenAt: Date;
  createdAt: Date;
}
```

**Operaciones soportadas:**

| Operación | Query | Índice usado |
|---|---|---|
| Registrar nuevo token | `upsert by { token }` | unique idx |
| Buscar tokens de un user/admin | `find({ subjectType, subjectId })` | compound idx |
| Borrar token muerto | `deleteOne({ token })` | unique idx |
| Cron cleanup | `deleteMany({ lastSeenAt: { $lt: Date } })` | lastSeenAt idx |
| Refrescar `lastSeenAt` | `updateOne({ token }, { $set: { lastSeenAt: now } })` | unique idx |

---

## Modelos existentes (sin cambios)

### `Notification` (admin)
**Sin cambios.** El payload FCM se construye desde los campos actuales: `type`, `title`, `message`, `metadata`, `relatedOrder`.

### `UserNotification` (cliente)
**Sin cambios.** El payload FCM se construye desde los campos actuales: `type`, `title`, `message`, `relatedOrder`, `icon`.

### `User`
**Sin cambios.** Los tokens NO se almacenan en `User`. Razón: SoC + un user puede tener N dispositivos.

### `Settings.adminNotifications.browserPush`
**Sin cambios al schema.** El campo ya existe en [settings.interface.ts:104](backend/src/modules/settings/interfaces/settings.interface.ts). Cambia solo su semántica:

| Antes | Ahora |
|---|---|
| Si `true`, el frontend admin muestra notificación local del navegador cuando el polling detecta un nuevo registro. | Si `true`, el backend envía push real vía FCM al admin **y** el frontend admin sigue mostrando notificación local. Si `false`, ninguno. |

Compatibilidad: el flag por defecto es `true` (definido en `DEFAULT_SETTINGS`), por lo que admins existentes empiezan recibiendo push sin acción manual. Para deshabilitar, usar el toggle existente en la UI de settings.

---

## Estructura del payload FCM

### Convención del proyecto

Payload **mixto**: campos `notification` (display) + campos `data` (metadatos).

```ts
// Construido por PushService antes de enviar a FcmProvider
{
  notification: {
    title: string,    // de Notification.title / UserNotification.title
    body: string,     // de Notification.message / UserNotification.message
  },
  data: {
    // Todo string — FCM exige strings en el campo `data`
    type: string,             // e.g. 'order_approved'
    notificationId: string,   // ObjectId del documento Mongo
    relatedOrder?: string,    // ObjectId si aplica
    icon: string,             // 'order' | 'mechanic' | ...
    url: string,              // ruta destino al click: '/perfil#notificaciones'
                              //                       o '/admin/orders/:id'
  },
  webpush: {
    fcmOptions: {
      link: string,  // misma url, usado como fallback de notificationclick
    },
    notification: {
      icon: '/autobus.png',
      badge: '/autobus.png',
      tag: string,   // dedupe key: `notif-${notificationId}`
      requireInteraction: false,
    },
  },
}
```

**Por qué este shape:**
- `notification.title` + `notification.body`: FCM Web los renderiza automáticamente cuando la app está cerrada. Cero código en SW.
- `data.*`: el SW lee estos campos en `notificationclick` para decidir a dónde navegar.
- `webpush.fcmOptions.link`: fallback declarativo. Si el handler `notificationclick` falla, el SDK abre este URL.
- `webpush.notification.tag`: deduplicación. Si llegan dos pushes con el mismo `tag` antes de que el usuario lo vea, solo aparece uno (evita spam).
- `requireInteraction: false`: la notificación se descarta sola tras 5-10 s. Cambiar a `true` solo para pushes críticos (no es nuestro caso).

### Mapeo desde el sistema actual

| Origen Mongo | Campo FCM |
|---|---|
| `notification.title` o `userNotification.title` | `notification.title` |
| `notification.message` o `userNotification.message` | `notification.body` |
| `notification.type` o `userNotification.type` | `data.type` |
| `notification._id` o `userNotification._id` | `data.notificationId`, `webpush.notification.tag` |
| `notification.relatedOrder` o `userNotification.relatedOrder` | `data.relatedOrder` |
| `userNotification.icon` (admin no tiene icon) | `data.icon` (default `'order'`) |
| Computado según contexto | `data.url` (admin → `/admin/orders/:id`, user → `/perfil#notificaciones`) |

---

## Decisiones de diseño cerradas sobre el modelo

| ID | Decisión | Justificación |
|---|---|---|
| DM1 | `DeviceToken.token` es `unique`. | Un token FCM identifica un par (browser × dispositivo) único. No tiene sentido duplicar. |
| DM2 | Si el mismo user inicia sesión en dos dispositivos, hay dos tokens. | Multi-device es comportamiento esperado y deseable. |
| DM3 | Si dos users distintos comparten el mismo dispositivo (logout/login), el token se reasigna al user nuevo (upsert por token). | Refleja la realidad: el navegador entrega notificaciones al dueño actual de la sesión. |
| DM4 | `subjectId` no tiene `ref` Mongoose. | Polimorfismo requiere resolución dinámica; agregaría complejidad sin beneficio (el `populate` no se usa para tokens). |
| DM5 | `lastSeenAt` se refresca en cada login y en cada `getToken()` exitoso del cliente. | Permite cleanup confiable de tokens abandonados. |
| DM6 | Cleanup cron: `lastSeenAt > 90 días` → borrar. | 90 días = inactividad real (un usuario activo se conecta al menos cada 60 días en este negocio). |
