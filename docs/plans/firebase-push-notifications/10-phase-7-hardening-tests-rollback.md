# Fase 7 — Hardening, tests y rollback

**Objetivo:** robustecer la implementación con cleanup de tokens muertos, tests automatizados, observabilidad y un plan de rollback documentado para usar si algo sale mal en producción.

**Esfuerzo estimado:** 1 día.

---

## 7.1 — Cron de cleanup de tokens muertos

**Archivo nuevo:** `backend/src/shared/jobs/cleanup-stale-device-tokens.cron.ts`

Espejo del patrón de `cleanup-zombie-accounts.cron.ts`.

```ts
import cron from 'node-cron';
import { deviceTokenService } from '@modules/device-tokens';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Weekly cleanup of FCM tokens not seen in 90 days.
 *
 * Why a cron in addition to inline cleanup in FcmProvider:
 *   - FcmProvider only deletes tokens that fail with UNREGISTERED.
 *   - A token can become "stale" without ever being used in a dispatch
 *     (e.g. user installed PWA but never received any push).
 *   - This cron sweeps those silently abandoned tokens.
 *
 * Schedule: every Sunday at 03:00 server time. Low-traffic window.
 */
export const startStaleDeviceTokenCleanup = (): void => {
  cron.schedule('0 3 * * 0', async () => {
    console.log('[Cron] Starting stale device-token cleanup...');
    try {
      const deleted = await deviceTokenService.deleteStale(NINETY_DAYS_MS);
      console.log(`[Cron] Deleted ${deleted} stale device token(s)`);
    } catch (err) {
      console.error('[Cron] Stale token cleanup failed:', err);
    }
  });
};
```

### Wire-up en `server.ts`

```ts
import { startStaleDeviceTokenCleanup } from '@shared/jobs/cleanup-stale-device-tokens.cron';
// ... after startZombieCleanupCron()
startStaleDeviceTokenCleanup();
```

---

## 7.2 — Tests unitarios

### Test: `PushService` con `MockPushProvider`

**Archivo nuevo:** `backend/src/shared/services/push/__tests__/push.service.test.ts`

```ts
import { PushService } from '../push.service';
import { MockPushProvider } from '../providers/mock.provider';
import { deviceTokenService } from '@modules/device-tokens';

jest.mock('@modules/device-tokens', () => ({
  deviceTokenService: {
    findBySubject: jest.fn(),
    bulkDelete: jest.fn(),
  },
}));

jest.mock('@config/firebase', () => ({
  isFirebaseEnabled: jest.fn(() => true),
  isPushKillSwitchOn: jest.fn(() => false),
}));

jest.mock('@modules/settings/services/settings.service', () => ({
  settingsService: {
    get: jest.fn(() => Promise.resolve({ adminNotifications: { browserPush: true } })),
  },
}));

describe('PushService', () => {
  let mockProvider: MockPushProvider;
  let service: PushService;

  beforeEach(() => {
    mockProvider = new MockPushProvider();
    service = new PushService(mockProvider);
    jest.clearAllMocks();
  });

  it('skips dispatch when no tokens found', async () => {
    (deviceTokenService.findBySubject as jest.Mock).mockResolvedValue([]);

    await service.dispatch({
      subjectType: 'user',
      subjectId: 'u1',
      content: { title: 't', body: 'b' },
      data: { type: 'test', notificationId: 'n1', url: '/' },
    });

    expect(mockProvider.sentMessages).toHaveLength(0);
  });

  it('dispatches to all resolved tokens', async () => {
    (deviceTokenService.findBySubject as jest.Mock).mockResolvedValue([
      { token: 'tok-1' },
      { token: 'tok-2' },
    ]);

    await service.dispatch({
      subjectType: 'user',
      subjectId: 'u1',
      content: { title: 't', body: 'b' },
      data: { type: 'test', notificationId: 'n1', url: '/' },
    });

    expect(mockProvider.sentMessages).toHaveLength(1);
    expect(mockProvider.sentMessages[0].tokens).toEqual(['tok-1', 'tok-2']);
  });

  it('cleans up invalid tokens reported by provider', async () => {
    (deviceTokenService.findBySubject as jest.Mock).mockResolvedValue([
      { token: 'good' },
      { token: 'dead' },
    ]);

    // Override mock provider to report 'dead' as invalid
    const reporterProvider = {
      send: jest.fn(async () => ({
        successCount: 1,
        failureCount: 1,
        invalidTokens: ['dead'],
      })),
    };
    service = new PushService(reporterProvider as any);

    await service.dispatch({
      subjectType: 'user',
      subjectId: 'u1',
      content: { title: 't', body: 'b' },
      data: { type: 'test', notificationId: 'n1', url: '/' },
    });

    expect(deviceTokenService.bulkDelete).toHaveBeenCalledWith(['dead']);
  });

  it('respects admin browserPush toggle', async () => {
    const settingsModule = require('@modules/settings/services/settings.service');
    settingsModule.settingsService.get = jest.fn(() =>
      Promise.resolve({ adminNotifications: { browserPush: false } })
    );

    await service.dispatch({
      subjectType: 'admin',
      toAllAdmins: true,
      content: { title: 't', body: 'b' },
      data: { type: 'test', notificationId: 'n1', url: '/' },
    });

    expect(mockProvider.sentMessages).toHaveLength(0);
  });

  it('respects FIREBASE_PUSH_ENABLED kill switch', async () => {
    const firebaseModule = require('@config/firebase');
    firebaseModule.isPushKillSwitchOn = jest.fn(() => true);

    await service.dispatch({
      subjectType: 'user',
      subjectId: 'u1',
      content: { title: 't', body: 'b' },
      data: { type: 'test', notificationId: 'n1', url: '/' },
    });

    expect(mockProvider.sentMessages).toHaveLength(0);
  });
});
```

### Test: `DeviceTokenService`

**Archivo nuevo:** `backend/src/modules/device-tokens/__tests__/device-token.service.test.ts`

```ts
import { deviceTokenService } from '../services/device-token.service';
import { DeviceToken } from '../models/device-token.model';
import mongoose from 'mongoose';

// Use mongodb-memory-server or whatever pattern the project uses for repo-level tests.

describe('DeviceTokenService', () => {
  beforeEach(async () => {
    await DeviceToken.deleteMany({});
  });

  it('register is idempotent (upsert by token)', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    await deviceTokenService.register({
      subjectType: 'user',
      subjectId: userId,
      token: 'tok-1',
    });
    await deviceTokenService.register({
      subjectType: 'user',
      subjectId: userId,
      token: 'tok-1',
    });
    const count = await DeviceToken.countDocuments({ token: 'tok-1' });
    expect(count).toBe(1);
  });

  it('register reassigns token to new subject', async () => {
    const userA = new mongoose.Types.ObjectId().toString();
    const userB = new mongoose.Types.ObjectId().toString();

    await deviceTokenService.register({ subjectType: 'user', subjectId: userA, token: 'tok-1' });
    await deviceTokenService.register({ subjectType: 'user', subjectId: userB, token: 'tok-1' });

    const docs = await DeviceToken.find({ token: 'tok-1' }).lean();
    expect(docs).toHaveLength(1);
    expect(String(docs[0].subjectId)).toBe(userB);
  });

  it('bulkDelete removes given tokens', async () => {
    const userId = new mongoose.Types.ObjectId().toString();
    await deviceTokenService.register({ subjectType: 'user', subjectId: userId, token: 't1' });
    await deviceTokenService.register({ subjectType: 'user', subjectId: userId, token: 't2' });
    await deviceTokenService.register({ subjectType: 'user', subjectId: userId, token: 't3' });

    const deleted = await deviceTokenService.bulkDelete(['t1', 't2']);
    expect(deleted).toBe(2);

    const remaining = await DeviceToken.countDocuments();
    expect(remaining).toBe(1);
  });
});
```

---

## 7.3 — Smoke E2E manual (checklist)

Antes de declarar "listo":

| # | Escenario | Resultado esperado |
|---|---|---|
| 1 | Cliente login → permite notificaciones → backend crea orden → push llega con app cerrada | Notificación nativa aparece en ~2 s |
| 2 | Mismo cliente → app abierta y pestaña visible → admin aprueba orden | Solo badge actualizado, sin toast nativo |
| 3 | Mismo cliente → app abierta pero otra pestaña al frente → admin aprueba orden | Toast nativo + badge actualizado |
| 4 | Cliente con dos navegadores (Chrome + Edge) | Push llega a AMBOS |
| 5 | Cliente borra datos del navegador → vuelve a entrar | Token nuevo registrado, push funciona |
| 6 | Admin login → permite notificaciones → cliente crea orden | Push llega al admin |
| 7 | Admin desactiva `browserPush` en settings → cliente crea orden | Admin NO recibe push (pero `Notification` sí se persiste) |
| 8 | `FIREBASE_PUSH_ENABLED=false` en backend → crear orden | Nadie recibe push, backend logueado, app sigue funcionando |
| 9 | Token inválido (modificado en BD a un string aleatorio) → dispatch | Backend detecta `UNREGISTERED`, borra token, log lo registra |
| 10 | iOS Safari sin PWA instalada → login | Modal educativo aparece, no error |
| 11 | iOS PWA instalada → login | Permiso pedido, token registrado, push funciona |
| 12 | Crear 50 tokens fake con `lastSeenAt` antiguo → ejecutar cron | 50 tokens borrados |

---

## 7.4 — Observabilidad

### Logs estructurados que deben existir

| Origen | Mensaje | Cuándo |
|---|---|---|
| `[Firebase]` | `Admin SDK initialized for project: <id>` | Startup exitoso |
| `[Firebase]` | `Credentials not configured — push notifications disabled.` | Dev sin creds |
| `[PushService]` | `Dispatch complete: 2/3 (subjectType=user, type=order_approved)` | Cada dispatch |
| `[PushService]` | `Cleaned up 1 invalid token(s) (subjectType=user)` | Token muerto detectado |
| `[FcmProvider]` | `Non-fatal error for token: <code> — <msg>` | Error transitorio |
| `[Cron]` | `Deleted <n> stale device token(s)` | Cron semanal |

### Endpoint de salud (opcional para esta fase, recomendado)

**Archivo:** `backend/src/modules/admin/controllers/admin.controller.ts` (extender)

```ts
async pushHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { DeviceToken } = await import('@modules/device-tokens');
    const [totalTokens, userTokens, adminTokens, recentTokens] = await Promise.all([
      DeviceToken.countDocuments(),
      DeviceToken.countDocuments({ subjectType: 'user' }),
      DeviceToken.countDocuments({ subjectType: 'admin' }),
      DeviceToken.countDocuments({
        lastSeenAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        firebaseEnabled: isFirebaseEnabled(),
        killSwitchOn: isPushKillSwitchOn(),
        tokens: {
          total: totalTokens,
          users: userTokens,
          admins: adminTokens,
          activeLast24h: recentTokens,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}
```

Ruta: `GET /api/admin/push/health`.

---

## 7.5 — Plan de rollback

Si la integración rompe producción tras deploy:

### Nivel 1 — kill switch (sin redeploy, sin downtime)

```bash
# En el dashboard de envvars del backend
FIREBASE_PUSH_ENABLED=false
```

Reiniciar el proceso. Resultado:
- `pushService.dispatch(...)` retorna inmediatamente sin enviar.
- Todo lo demás sigue funcionando: persistencia Mongo, polling, UI.
- El sistema se comporta exactamente como antes de la integración.

**Tiempo de mitigación:** ~30 s (el tiempo de reiniciar el server).

### Nivel 2 — revert del frontend (si el problema es en cliente)

Re-deploy del frontend al commit anterior. El SDK Firebase deja de cargarse en el cliente. El backend sigue funcionando porque el kill switch ya está activo (Nivel 1).

### Nivel 3 — revert del backend (si el problema es en backend pero no se mitiga con kill switch)

Re-deploy del backend al commit anterior. Eliminar las envvars Firebase del entorno (opcional pero recomendado para limpieza).

**Datos que NO se pierden:** los documentos `DeviceToken` quedan en Mongo huérfanos pero no estorban. Se pueden borrar manualmente con `db.devicetokens.drop()` si se quiere espacio.

### Nivel 4 — desinstalación completa

Solo si se decide abandonar Firebase definitivamente:

1. Levantar el kill switch en prod (Nivel 1).
2. PR que revierta:
   - Eliminación del módulo `device-tokens`.
   - Eliminación de `shared/services/push/`.
   - Eliminación de `config/firebase.ts`.
   - Eliminación de `core/firebase/`.
   - Eliminación de `firebase-messaging-sw.js` y su script generador.
   - Eliminación de `firebase-admin` y `firebase` de `package.json`.
   - Eliminación de las llamadas a `dispatchPush(...)` en `notification.service.ts` y `user-notification.service.ts`.
3. Borrar `db.devicetokens` collection.
4. Eliminar envvars del entorno.

**El sistema queda exactamente como antes del plan,** porque ningún call site de negocio fue modificado.

---

## 7.6 — Riesgos conocidos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Service Account JSON filtrado | Baja | Crítico | `.env` en `.gitignore` (ya está); auditar antes de cada commit |
| Quota de FCM Free tier excedida | Muy baja | Medio | FCM Web es gratis ilimitado en Spark plan. No hay quota práctica. |
| Tokens FCM se acumulan (sin cleanup) | Media | Bajo | Cron semanal + cleanup inline en `FcmProvider` |
| Bundle size frontend infla | Baja | Bajo | Tree-shaking del SDK modular; verificar con `npm run build:prod -- --stats-json` |
| iOS PWA support se vuelve más restrictivo | Baja | Bajo | Polling fallback siempre activo |
| FCM Web deprecation | Muy baja | Alto (si pasa) | El patrón Provider permite cambiar a web-push estándar sin tocar negocio |
| Service Worker no se actualiza tras deploy | Media | Bajo | `skipWaiting + clients.claim` ya está; versión por timestamp en cada generate |
| `firebase-messaging-sw.js` genera config errónea | Baja | Medio | Validar projectId en script generador (ya validado) |
| Push duplicados (FCM + browserNotify desde polling) | Baja | Bajo | `tag` deduplica en el SO; `triggerBrowserPush` actual se elimina o gatea por presencia de token |

---

## 7.7 — Checklist final antes de cerrar el plan

- [ ] Todos los criterios de aceptación de Fases 1-6 cumplidos.
- [ ] Tests unitarios pasan (`npm test` en backend).
- [ ] Smoke E2E checklist 100 % verde (sección 7.3).
- [ ] Cron de cleanup operativo (sección 7.1).
- [ ] Endpoint de salud responde (sección 7.4).
- [ ] Plan de rollback documentado y kill switch verificado en staging.
- [ ] Cero warnings TypeScript ni Problems en backend ni frontend.
- [ ] Path aliases (`@core/*`, `@shared/*`, etc.) usados consistentemente.
- [ ] Documentación actualizada (este folder de `docs/plans/`).
- [ ] Si se agregaron nuevos índices Mongo, verificar que se crearon en producción.
- [ ] Variables de entorno producción configuradas y validadas.
