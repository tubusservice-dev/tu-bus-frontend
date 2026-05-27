# Fase 2 — Backend transport layer

**Objetivo:** capa de transporte agnóstica al provider, con `IPushProvider` + `FcmProvider` + `MockPushProvider` + `PushService`. Al final de esta fase, el backend puede invocar `pushService.dispatch(...)` y enviar pushes reales vía FCM. **Aún NO está integrado con `notificationService` ni `userNotificationService`** — eso es Fase 3.

**Esfuerzo estimado:** 1 día.

---

## 2.1 — Estructura de carpetas

```
backend/src/shared/services/push/
├── index.ts
├── push.service.ts
├── interfaces/
│   └── push-provider.interface.ts
└── providers/
    ├── fcm.provider.ts
    └── mock.provider.ts
```

Espejo exacto de `backend/src/shared/services/mail/`.

---

## 2.2 — Contrato `IPushProvider`

**Archivo:** `backend/src/shared/services/push/interfaces/push-provider.interface.ts`

```ts
/**
 * Generic push notification transport contract.
 *
 * Implementations: FcmProvider (production), MockPushProvider (tests).
 * Adding a new provider (web-push, OneSignal, etc.) only requires
 * implementing this interface — the rest of the system is provider-agnostic.
 */

export interface PushNotificationContent {
  /** Short title shown as the OS notification heading. */
  title: string;
  /** Body text shown below the title. */
  body: string;
}

export interface PushDataPayload {
  /** Notification type, e.g. 'order_approved', 'new_order'. */
  type: string;
  /** Mongo ObjectId of the persisted Notification or UserNotification. */
  notificationId: string;
  /** Mongo ObjectId of the related Order, if applicable. */
  relatedOrder?: string;
  /** Icon hint for the client. */
  icon?: string;
  /** Target URL when the user clicks the notification. */
  url: string;
}

export interface SendPushArgs {
  tokens: string[];                       // FCM registration tokens (1..N)
  content: PushNotificationContent;       // for notification.* fields
  data: PushDataPayload;                  // for data.* fields (all stringified)
}

export interface SendPushResult {
  successCount: number;
  failureCount: number;
  /** Tokens that should be removed from the DB (unregistered, invalid). */
  invalidTokens: string[];
}

export interface IPushProvider {
  /**
   * Send a push notification to one or more tokens.
   * Throws on transport-level errors (network, auth). Per-token failures
   * are reported in `SendPushResult.failureCount` + `invalidTokens`.
   */
  send(args: SendPushArgs): Promise<SendPushResult>;
}
```

---

## 2.3 — `FcmProvider`

**Archivo:** `backend/src/shared/services/push/providers/fcm.provider.ts`

```ts
import { firebaseMessaging, isFirebaseEnabled } from '@config/firebase';
import {
  IPushProvider,
  SendPushArgs,
  SendPushResult,
} from '../interfaces/push-provider.interface';
import type { MulticastMessage } from 'firebase-admin/messaging';

/**
 * FCM-backed push provider. Wraps firebase-admin/messaging.
 *
 * Key behaviours:
 *   - Builds payload as notification + data + webpush-specific options.
 *   - Detects per-token failures in the multicast response and returns
 *     the list of tokens that should be deleted (UNREGISTERED, INVALID_ARGUMENT).
 *   - No retry logic — that's the responsibility of PushService.
 */
export class FcmProvider implements IPushProvider {
  async send(args: SendPushArgs): Promise<SendPushResult> {
    if (!isFirebaseEnabled()) {
      // Defensive — PushService should already short-circuit, but be safe.
      console.warn('[FcmProvider] Firebase disabled, skipping send');
      return { successCount: 0, failureCount: args.tokens.length, invalidTokens: [] };
    }

    if (args.tokens.length === 0) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    const message: MulticastMessage = {
      tokens: args.tokens,
      notification: {
        title: args.content.title,
        body: args.content.body,
      },
      data: this.serializeData(args.data),
      webpush: {
        fcmOptions: {
          link: args.data.url,
        },
        notification: {
          icon: '/autobus.png',
          badge: '/autobus.png',
          tag: `notif-${args.data.notificationId}`,
          requireInteraction: false,
        },
      },
    };

    const response = await firebaseMessaging().sendEachForMulticast(message);

    // Identify tokens that should be cleaned up.
    const invalidTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        const code = resp.error.code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/invalid-argument'
        ) {
          invalidTokens.push(args.tokens[idx]);
        } else {
          // Log but don't delete — could be transient (quota, server-error).
          console.warn(
            `[FcmProvider] Non-fatal error for token: ${code} — ${resp.error.message}`
          );
        }
      }
    });

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens,
    };
  }

  /**
   * FCM requires `data` payload to contain only string values.
   * Drops undefined keys to keep payload lean.
   */
  private serializeData(data: SendPushArgs['data']): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        out[key] = String(value);
      }
    }
    return out;
  }
}
```

---

## 2.4 — `MockPushProvider`

**Archivo:** `backend/src/shared/services/push/providers/mock.provider.ts`

```ts
import {
  IPushProvider,
  SendPushArgs,
  SendPushResult,
} from '../interfaces/push-provider.interface';

/**
 * In-memory push provider for tests. Captures every `send` call into a
 * public array so test assertions can inspect what was dispatched.
 */
export class MockPushProvider implements IPushProvider {
  public sentMessages: SendPushArgs[] = [];

  async send(args: SendPushArgs): Promise<SendPushResult> {
    this.sentMessages.push(args);
    return {
      successCount: args.tokens.length,
      failureCount: 0,
      invalidTokens: [],
    };
  }

  reset(): void {
    this.sentMessages = [];
  }
}
```

---

## 2.5 — `PushService` (orquestador)

**Archivo:** `backend/src/shared/services/push/push.service.ts`

```ts
import { IPushProvider } from './interfaces/push-provider.interface';
import { deviceTokenService } from '@modules/device-tokens';
import { settingsService } from '@modules/settings/services/settings.service';
import { isFirebaseEnabled, isPushKillSwitchOn } from '@config/firebase';
import type {
  PushNotificationContent,
  PushDataPayload,
} from './interfaces/push-provider.interface';

export interface DispatchArgs {
  /** Receiver scope. */
  subjectType: 'user' | 'admin';
  /** Either a specific subject id, or "broadcast to all admins". */
  subjectId?: string;
  /** When true with subjectType='admin', sends to all admins (respecting browserPush toggle). */
  toAllAdmins?: boolean;
  content: PushNotificationContent;
  data: PushDataPayload;
}

export class PushService {
  constructor(private readonly provider: IPushProvider) {}

  /**
   * Resolve target tokens, send via provider, clean up invalid tokens.
   * Fire-and-forget: callers should NOT await this. Errors are logged,
   * never propagated.
   */
  async dispatch(args: DispatchArgs): Promise<void> {
    try {
      // Short-circuits
      if (!isFirebaseEnabled()) return;
      if (isPushKillSwitchOn()) return;

      // Admin-specific gate: respect the browserPush settings toggle.
      if (args.subjectType === 'admin') {
        const settings = await settingsService.get();
        if ((settings as any).adminNotifications?.browserPush === false) return;
      }

      // Resolve tokens.
      const tokens = await this.resolveTokens(args);
      if (tokens.length === 0) return;

      // Send.
      const result = await this.provider.send({
        tokens,
        content: args.content,
        data: args.data,
      });

      // Cleanup invalid tokens.
      if (result.invalidTokens.length > 0) {
        const deleted = await deviceTokenService.bulkDelete(result.invalidTokens);
        console.log(
          `[PushService] Cleaned up ${deleted} invalid token(s) ` +
            `(subjectType=${args.subjectType})`
        );
      }

      console.log(
        `[PushService] Dispatch complete: ${result.successCount}/${tokens.length} ` +
          `(subjectType=${args.subjectType}, type=${args.data.type})`
      );
    } catch (err) {
      console.error('[PushService] Dispatch failed:', err);
    }
  }

  private async resolveTokens(args: DispatchArgs): Promise<string[]> {
    if (args.subjectType === 'admin' && args.toAllAdmins) {
      // Fan-out to all admins.
      // Implementation note: query DeviceToken directly with subjectType='admin'
      // to avoid a join. The set of admins is small (handful), so this scales.
      const docs = await this.findAllAdminTokens();
      return docs.map((d) => d.token);
    }

    if (!args.subjectId) {
      console.warn('[PushService] dispatch called without subjectId or toAllAdmins');
      return [];
    }

    const docs = await deviceTokenService.findBySubject(args.subjectType, args.subjectId);
    return docs.map((d) => d.token);
  }

  private async findAllAdminTokens() {
    // Late import to avoid circular dep risk.
    const { DeviceToken } = await import('@modules/device-tokens');
    return DeviceToken.find({ subjectType: 'admin' }).lean() as any;
  }
}
```

---

## 2.6 — Singleton wiring (`index.ts`)

**Archivo:** `backend/src/shared/services/push/index.ts`

```ts
import { FcmProvider } from './providers/fcm.provider';
import { PushService } from './push.service';

export type {
  IPushProvider,
  SendPushArgs,
  SendPushResult,
  PushNotificationContent,
  PushDataPayload,
} from './interfaces/push-provider.interface';
export { PushService } from './push.service';
export { FcmProvider } from './providers/fcm.provider';
export { MockPushProvider } from './providers/mock.provider';

/**
 * Singleton instance of PushService bound to the production FCM provider.
 * Import this from anywhere in the codebase to dispatch pushes.
 *
 * For tests, instantiate `PushService` directly with `MockPushProvider`.
 */
const pushProvider = new FcmProvider();
export const pushService = new PushService(pushProvider);
```

---

## 2.7 — Smoke test manual

Antes de pasar a Fase 3, validar manualmente que el envío funciona end-to-end. Crear un script temporal:

**Archivo:** `backend/src/scripts/test-push-dispatch.ts` (temporal, eliminar después)

```ts
import '@config/bootstrap-timezone';
import '@config/firebase';
import { connectDatabase } from '@config/database';
import { pushService } from '@shared/services/push';
import { deviceTokenService } from '@modules/device-tokens';

(async () => {
  await connectDatabase();

  // Argumentos: el script recibe el FCM token desde CLI para no hardcodear.
  const fakeToken = process.argv[2];
  if (!fakeToken) {
    console.error('Usage: ts-node src/scripts/test-push-dispatch.ts <fcm-token>');
    process.exit(1);
  }

  // Simular un token registrado para un user ficticio.
  const fakeUserId = '000000000000000000000001';
  await deviceTokenService.register({
    subjectType: 'user',
    subjectId: fakeUserId,
    token: fakeToken,
    platform: 'web',
  });

  // Despachar.
  await pushService.dispatch({
    subjectType: 'user',
    subjectId: fakeUserId,
    content: {
      title: 'Test push',
      body: 'Si ves este toast, el dispatch funciona end-to-end.',
    },
    data: {
      type: 'test',
      notificationId: '000000000000000000000099',
      icon: 'order',
      url: '/perfil#notificaciones',
    },
  });

  console.log('Dispatch fired. Check the device that owns the token.');
  process.exit(0);
})();
```

**Cómo obtener el token para el smoke test:**
1. Abrir cualquier herramienta web de FCM testing (e.g. `firebase.google.com/docs/cloud-messaging/js/client` ejemplos).
2. O implementar Fase 4-6 antes y obtener un token real desde el frontend.

**Recomendado:** posponer este smoke test hasta tener Fase 6 lista, así se prueba el flujo real.

---

## Criterios de aceptación de la Fase 2

- [ ] `pushService.dispatch(...)` se puede invocar desde cualquier servicio del backend importando de `@shared/services/push`.
- [ ] Si `FIREBASE_PUSH_ENABLED=false`, ningún dispatch envía nada (kill-switch funcional).
- [ ] Si `isFirebaseEnabled() === false`, ningún dispatch envía nada (graceful degradation en dev sin creds).
- [ ] Si `subjectType='admin'` y `settings.adminNotifications.browserPush === false`, ningún dispatch envía nada.
- [ ] Tokens muertos (`UNREGISTERED`, `INVALID_ARGUMENT`) se borran de Mongo en el mismo dispatch.
- [ ] Errores no fatales (quota, server-error) se loggean sin borrar tokens.
- [ ] No hay warnings en TypeScript ni en el panel Problems.
- [ ] `MockPushProvider` permite asserts en tests futuros: `expect(mock.sentMessages).toHaveLength(1)`.
