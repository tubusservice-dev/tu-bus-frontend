# Fase 3 — Backend integration

**Objetivo:** conectar la capa de transporte (Fase 2) con los servicios de notificaciones existentes. Tras esta fase, **cada vez que el negocio crea una notificación, se dispara automáticamente un push real**. Cero cambios en los 14 call sites de negocio.

**Esfuerzo estimado:** 0.5 día.

---

## 3.1 — Helper común para construir el payload

Para evitar duplicar lógica en `notification.service.ts` y `user-notification.service.ts`, crear un helper compartido.

### Archivo nuevo: `backend/src/shared/services/push/payload-builder.ts`

```ts
import type {
  PushNotificationContent,
  PushDataPayload,
} from './interfaces/push-provider.interface';
import type { INotification } from '@modules/notifications';
import type { IUserNotification } from '@modules/user-notifications';

/**
 * Maps a persisted Notification (admin) into the FCM payload shape.
 */
export const buildAdminPushPayload = (
  notification: INotification
): { content: PushNotificationContent; data: PushDataPayload } => {
  return {
    content: {
      title: notification.title,
      body: notification.message,
    },
    data: {
      type: notification.type,
      notificationId: String(notification._id),
      relatedOrder: notification.relatedOrder ? String(notification.relatedOrder) : undefined,
      icon: 'order',
      url: notification.relatedOrder
        ? `/admin/orders/${notification.relatedOrder}`
        : '/admin/notifications',
    },
  };
};

/**
 * Maps a persisted UserNotification (customer) into the FCM payload shape.
 */
export const buildUserPushPayload = (
  notification: IUserNotification
): { content: PushNotificationContent; data: PushDataPayload } => {
  return {
    content: {
      title: notification.title,
      body: notification.message,
    },
    data: {
      type: notification.type,
      notificationId: String(notification._id),
      relatedOrder: notification.relatedOrder ? String(notification.relatedOrder) : undefined,
      icon: notification.icon || 'order',
      url: '/perfil#notificaciones',
    },
  };
};
```

### Exportar desde `backend/src/shared/services/push/index.ts`

```ts
export { buildAdminPushPayload, buildUserPushPayload } from './payload-builder';
```

---

## 3.2 — Integrar en `notification.service.ts` (admin)

**Archivo:** `backend/src/modules/notifications/services/notification.service.ts`

### Cambio en el método `create(...)`

**Antes (snippet relevante):**

```ts
return Notification.create(data);
```

**Después:**

```ts
const notification = await Notification.create(data);

// Fire-and-forget push dispatch. Failures are logged inside dispatch();
// they MUST NOT propagate to the business transaction.
this.dispatchPush(notification).catch((err) => {
  console.warn('[NotificationService] Push dispatch swallowed error:', err);
});

return notification;
```

### Método privado nuevo

```ts
private async dispatchPush(notification: INotification): Promise<void> {
  // Late imports to avoid potential circular dep at module load time.
  const { pushService, buildAdminPushPayload } = await import('@shared/services/push');
  const { content, data } = buildAdminPushPayload(notification);
  await pushService.dispatch({
    subjectType: 'admin',
    toAllAdmins: true,
    content,
    data,
  });
}
```

### Resultado: el método `create(...)` completo

```ts
async create(data: {
  type: NotificationType;
  title: string;
  message: string;
  relatedOrder?: string;
  relatedAssignment?: string;
  metadata?: Record<string, any>;
}): Promise<INotification | null> {
  // Existing admin preference check (unchanged)
  try {
    const settings = await settingsService.get();
    const prefKey = TYPE_TO_PREF[data.type];
    const prefs = (settings as any).adminNotifications;
    if (prefs && prefKey && prefs[prefKey] === false) {
      return null;  // Skip persistence and push entirely
    }
  } catch {
    // If settings fail, default to creating the notification
  }

  const notification = await Notification.create(data);

  // NEW: fire-and-forget push dispatch
  this.dispatchPush(notification).catch((err) => {
    console.warn('[NotificationService] Push dispatch swallowed error:', err);
  });

  return notification;
}
```

**Nota importante:** cuando el método retorna `null` (porque el admin desactivó el toggle de ese tipo en settings), **tampoco se dispara push**. Comportamiento consistente con la lógica actual.

---

## 3.3 — Integrar en `user-notification.service.ts` (cliente)

**Archivo:** `backend/src/modules/user-notifications/services/user-notification.service.ts`

### Cambio en el método `create(...)`

**Antes:**

```ts
async create(data: {...}): Promise<IUserNotification> {
  return UserNotification.create({
    user: data.userId,
    type: data.type,
    title: data.title,
    message: data.message,
    relatedOrder: data.relatedOrder,
    icon: data.icon || 'order',
  });
}
```

**Después:**

```ts
async create(data: {...}): Promise<IUserNotification> {
  const notification = await UserNotification.create({
    user: data.userId,
    type: data.type,
    title: data.title,
    message: data.message,
    relatedOrder: data.relatedOrder,
    icon: data.icon || 'order',
  });

  // Fire-and-forget push dispatch.
  this.dispatchPush(notification, data.userId).catch((err) => {
    console.warn('[UserNotificationService] Push dispatch swallowed error:', err);
  });

  return notification;
}

private async dispatchPush(notification: IUserNotification, userId: string): Promise<void> {
  const { pushService, buildUserPushPayload } = await import('@shared/services/push');
  const { content, data } = buildUserPushPayload(notification);
  await pushService.dispatch({
    subjectType: 'user',
    subjectId: userId,
    content,
    data,
  });
}
```

---

## 3.4 — Verificación: los 14 call sites NO se tocan

Como reality check de que la integración es transparente, verificar que **ningún** archivo de los siguientes tiene cambios en esta fase:

- [order.service.ts](backend/src/modules/orders/services/order.service.ts) (8 call sites)
- [mechanic-assignment.service.ts](backend/src/modules/mechanic-assignments/services/mechanic-assignment.service.ts) (6 call sites)

Si tu diff de la Fase 3 muestra cambios en estos archivos, algo se hizo mal: vuelve a la integración por composición en `notification.service.ts` y `user-notification.service.ts`.

---

## 3.5 — Logs estructurados

El `PushService.dispatch(...)` ya emite logs (definido en Fase 2). Verificar que aparecen en consola con el formato:

```
[PushService] Dispatch complete: 2/3 (subjectType=user, type=order_approved)
[PushService] Cleaned up 1 invalid token(s) (subjectType=user)
```

Si necesitas más telemetría más adelante (e.g. métricas Prometheus), aquí es donde se hookea — no en los services de notificación.

---

## Criterios de aceptación de la Fase 3

- [ ] Crear una orden vía API → admin con token registrado recibe push.
- [ ] Crear una orden vía API → admins SIN token registrado no reciben nada (no error).
- [ ] Aprobar una orden vía panel admin → cliente con token recibe push de `order_approved`.
- [ ] Si Firebase está deshabilitado (env var vacía), la creación de orden sigue funcionando, sin bloqueos.
- [ ] Si FCM responde con error transitorio, el negocio no se ve afectado, el log lo registra.
- [ ] **Cero cambios** en `order.service.ts` y `mechanic-assignment.service.ts`.
- [ ] El polling de 30 s del frontend sigue trayendo el contador correcto en todos los escenarios anteriores.
- [ ] Tests existentes de `order.service.test.ts` siguen pasando sin modificación.
