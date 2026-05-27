# Fase 1 — Backend foundation

**Objetivo:** dejar listo el bootstrap de Firebase Admin SDK y la persistencia de tokens de dispositivo. Al final de esta fase, el backend puede inicializar Firebase, recibir tokens del frontend y almacenarlos en Mongo. **Aún no envía pushes.**

**Esfuerzo estimado:** 0.5 día.

---

## 1.1 — Instalar dependencias

```bash
cd backend
npm install firebase-admin
```

**Versión target:** `^12.x` (la última estable). `firebase-admin` es maintained directamente por Google y soporta Node 18+, que el proyecto ya cumple.

---

## 1.2 — Bootstrap Firebase Admin

### Archivo nuevo: `backend/src/config/firebase.ts`

Sigue el patrón de `backend/src/config/cloudinary.ts`: inicialización con env vars, exporta utilidades on-demand.

```ts
import admin from 'firebase-admin';
import type { App } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

/**
 * Firebase Admin SDK bootstrap.
 *
 * Initialized once at process startup. All consumers (push provider,
 * future analytics, etc.) MUST import the singleton from this module
 * — never call `admin.initializeApp()` elsewhere.
 *
 * Behaviour:
 *   - Production: missing credentials trigger a fatal error in `validateAuthEnv`.
 *   - Development: missing credentials leave `firebaseApp = null`. Consumers
 *     check `isFirebaseEnabled()` before invoking SDK calls.
 */

let firebaseApp: App | null = null;

const normalizePrivateKey = (raw: string): string => {
  // Supports both escaped (\\n) and real newlines, depending on how the
  // env var was loaded by the deployment platform.
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
};

const initFirebase = (): App | null => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    if (process.env.NODE_ENV === 'production') {
      // Should never reach here — validateAuthEnv exits earlier.
      throw new Error('Firebase credentials missing in production');
    }
    console.warn(
      '[Firebase] Credentials not configured — push notifications disabled. ' +
        'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY to enable.'
    );
    return null;
  }

  try {
    const app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: normalizePrivateKey(privateKeyRaw),
      }),
    });
    console.log(`[Firebase] Admin SDK initialized for project: ${projectId}`);
    return app;
  } catch (error) {
    console.error('[Firebase] Failed to initialize Admin SDK:', error);
    if (process.env.NODE_ENV === 'production') throw error;
    return null;
  }
};

firebaseApp = initFirebase();

export const isFirebaseEnabled = (): boolean => firebaseApp !== null;

export const isPushKillSwitchOn = (): boolean =>
  process.env.FIREBASE_PUSH_ENABLED === 'false';

/**
 * Returns the Messaging instance. Throws if Firebase is not initialized —
 * callers MUST guard with isFirebaseEnabled() first.
 */
export const firebaseMessaging = (): Messaging => {
  if (!firebaseApp) {
    throw new Error('Firebase Admin SDK is not initialized');
  }
  return getMessaging(firebaseApp);
};

export { firebaseApp };
```

### Importar el bootstrap desde `server.ts`

**Archivo:** `backend/src/server.ts`

Agregar el import al inicio (junto a otros bootstraps):

```ts
// After validateAuthEnv()
import '@config/firebase';  // triggers initFirebase() side-effect
```

Esto garantiza que la inicialización ocurre antes de que `app.listen()` empiece a aceptar requests.

---

## 1.3 — Validaciones de env

### Archivo: `backend/src/config/validate-env.ts`

Agregar al final de `validateAuthEnv`:

```ts
// Firebase credentials (required in production)
const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  if (!process.env.FIREBASE_PROJECT_ID) {
    console.error('[FATAL] FIREBASE_PROJECT_ID is not configured in production.');
    process.exit(1);
  }
  if (!process.env.FIREBASE_CLIENT_EMAIL) {
    console.error('[FATAL] FIREBASE_CLIENT_EMAIL is not configured in production.');
    process.exit(1);
  }
  if (!process.env.FIREBASE_PRIVATE_KEY) {
    console.error('[FATAL] FIREBASE_PRIVATE_KEY is not configured in production.');
    process.exit(1);
  }
  if (!process.env.FIREBASE_CLIENT_EMAIL.includes('@')) {
    console.error(
      '[FATAL] FIREBASE_CLIENT_EMAIL is not a valid email: ' +
        `"${process.env.FIREBASE_CLIENT_EMAIL}"`
    );
    process.exit(1);
  }
  if (!process.env.FIREBASE_PRIVATE_KEY.includes('BEGIN PRIVATE KEY')) {
    console.error(
      '[FATAL] FIREBASE_PRIVATE_KEY does not look like a valid PEM key. ' +
        'Make sure newlines are correctly escaped.'
    );
    process.exit(1);
  }
}

// Optional kill-switch validation
const pushEnabled = process.env.FIREBASE_PUSH_ENABLED;
if (pushEnabled !== undefined && pushEnabled !== '' && !['true', 'false'].includes(pushEnabled)) {
  console.error(
    `[FATAL] FIREBASE_PUSH_ENABLED must be "true" or "false". ` +
      `Current value: "${pushEnabled}"`
  );
  process.exit(1);
}
```

---

## 1.4 — Módulo `device-tokens`

### Estructura de carpetas (espejo del patrón del proyecto)

```
backend/src/modules/device-tokens/
├── index.ts
├── interfaces/
│   └── device-token.interface.ts
├── models/
│   └── device-token.model.ts
├── services/
│   └── device-token.service.ts
├── controllers/
│   └── device-token.controller.ts
├── dto/
│   └── device-token.dto.ts
└── routes/
    ├── device-token.routes.ts        ← user-facing
    └── admin-device-token.routes.ts  ← admin-facing
```

### `interfaces/device-token.interface.ts`

(Schema completo en `02-data-model.md`.)

### `models/device-token.model.ts`

(Schema completo en `02-data-model.md`.)

### `dto/device-token.dto.ts`

```ts
import { DevicePlatform } from '../interfaces/device-token.interface';

export interface RegisterTokenDto {
  token: string;
  platform?: DevicePlatform;
  userAgent?: string;
}
```

### `services/device-token.service.ts`

```ts
import { DeviceToken } from '../models/device-token.model';
import {
  IDeviceToken,
  DeviceTokenSubjectType,
  DevicePlatform,
} from '../interfaces/device-token.interface';
import { Types } from 'mongoose';

export class DeviceTokenService {
  /**
   * Idempotent token registration. If the token already exists, reassigns
   * it to the new subject (handles logout/login on the same browser) and
   * refreshes lastSeenAt.
   */
  async register(args: {
    subjectType: DeviceTokenSubjectType;
    subjectId: string;
    token: string;
    platform?: DevicePlatform;
    userAgent?: string;
  }): Promise<IDeviceToken> {
    const subjectId = new Types.ObjectId(args.subjectId);
    const doc = await DeviceToken.findOneAndUpdate(
      { token: args.token },
      {
        $set: {
          subjectType: args.subjectType,
          subjectId,
          platform: args.platform || 'web',
          userAgent: args.userAgent,
          lastSeenAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );
    return doc;
  }

  async unregister(token: string): Promise<void> {
    await DeviceToken.deleteOne({ token });
  }

  async findBySubject(
    subjectType: DeviceTokenSubjectType,
    subjectId: string
  ): Promise<IDeviceToken[]> {
    return DeviceToken.find({
      subjectType,
      subjectId: new Types.ObjectId(subjectId),
    }).lean() as any;
  }

  async findByToken(token: string): Promise<IDeviceToken | null> {
    return DeviceToken.findOne({ token }).lean() as any;
  }

  async refreshLastSeen(token: string): Promise<void> {
    await DeviceToken.updateOne({ token }, { $set: { lastSeenAt: new Date() } });
  }

  /**
   * Bulk delete invalid tokens. Called by FcmProvider when FCM rejects
   * a batch with UNREGISTERED / INVALID_ARGUMENT error codes.
   */
  async bulkDelete(tokens: string[]): Promise<number> {
    if (!tokens.length) return 0;
    const result = await DeviceToken.deleteMany({ token: { $in: tokens } });
    return result.deletedCount;
  }

  /**
   * Cleanup stale tokens not seen in the given window.
   */
  async deleteStale(olderThanMs: number): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanMs);
    const result = await DeviceToken.deleteMany({ lastSeenAt: { $lt: cutoff } });
    return result.deletedCount;
  }
}

export const deviceTokenService = new DeviceTokenService();
```

### `controllers/device-token.controller.ts`

```ts
import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { deviceTokenService } from '../services/device-token.service';
import { RegisterTokenDto } from '../dto/device-token.dto';
import { AppError } from '@shared/errors/app-error';

export class DeviceTokenController {
  /**
   * POST /api/device-tokens
   * Customer-facing token registration. The subject is the JWT user.
   */
  async registerForUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const dto = req.body as RegisterTokenDto;
      if (!dto.token || typeof dto.token !== 'string') {
        throw new AppError('Token requerido', StatusCodes.BAD_REQUEST);
      }
      const doc = await deviceTokenService.register({
        subjectType: 'user',
        subjectId: userId,
        token: dto.token,
        platform: dto.platform,
        userAgent: dto.userAgent || req.get('user-agent'),
      });
      res.status(StatusCodes.OK).json({
        success: true,
        data: { id: String(doc._id) },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/device-tokens/:token
   * Called on logout to clean up. Accepts the token as a path param.
   */
  async unregisterForUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params;
      await deviceTokenService.unregister(token);
      res.status(StatusCodes.OK).json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin equivalents — same logic, different subjectType.
   */
  async registerForAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = req.admin!.id;  // populated by authenticateAdmin middleware
      const dto = req.body as RegisterTokenDto;
      if (!dto.token || typeof dto.token !== 'string') {
        throw new AppError('Token requerido', StatusCodes.BAD_REQUEST);
      }
      const doc = await deviceTokenService.register({
        subjectType: 'admin',
        subjectId: adminId,
        token: dto.token,
        platform: dto.platform,
        userAgent: dto.userAgent || req.get('user-agent'),
      });
      res.status(StatusCodes.OK).json({
        success: true,
        data: { id: String(doc._id) },
      });
    } catch (err) {
      next(err);
    }
  }

  async unregisterForAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.params;
      await deviceTokenService.unregister(token);
      res.status(StatusCodes.OK).json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}

export const deviceTokenController = new DeviceTokenController();
```

### `routes/device-token.routes.ts`

```ts
import { Router } from 'express';
import { deviceTokenController } from '../controllers/device-token.controller';
import { authenticate } from '@shared/middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

router.post('/', (req, res, next) => deviceTokenController.registerForUser(req, res, next));
router.delete('/:token', (req, res, next) => deviceTokenController.unregisterForUser(req, res, next));

export default router;
```

### `routes/admin-device-token.routes.ts`

```ts
import { Router } from 'express';
import { deviceTokenController } from '../controllers/device-token.controller';
import { authenticateAdmin } from '@modules/admin/middlewares/admin-auth.middleware';

const router = Router();
router.use(authenticateAdmin);

router.post('/', (req, res, next) => deviceTokenController.registerForAdmin(req, res, next));
router.delete('/:token', (req, res, next) => deviceTokenController.unregisterForAdmin(req, res, next));

export default router;
```

### `index.ts`

```ts
export * from './interfaces/device-token.interface';
export * from './models/device-token.model';
export { DeviceTokenService, deviceTokenService } from './services/device-token.service';
export { DeviceTokenController, deviceTokenController } from './controllers/device-token.controller';
export { default as deviceTokenRoutes } from './routes/device-token.routes';
export { default as adminDeviceTokenRoutes } from './routes/admin-device-token.routes';
```

---

## 1.5 — Montar las rutas en `app.ts`

**Archivo:** `backend/src/app.ts`

Agregar imports:

```ts
import { deviceTokenRoutes, adminDeviceTokenRoutes } from '@modules/device-tokens';
```

Montar en la sección de rutas:

```ts
app.use('/api/device-tokens', deviceTokenRoutes);
// adminDeviceTokenRoutes se monta dentro de adminRoutes — ver 1.6
```

---

## 1.6 — Integrar admin routes

**Archivo:** `backend/src/modules/admin/routes/index.ts`

Agregar el sub-router:

```ts
import { adminDeviceTokenRoutes } from '@modules/device-tokens';
// ...
adminRouter.use('/device-tokens', adminDeviceTokenRoutes);
```

(Ajustar al patrón exacto del archivo según la convención existente.)

---

## Criterios de aceptación de la Fase 1

- [ ] `npm run dev` arranca sin errores con env vars Firebase configuradas.
- [ ] `npm run dev` arranca sin errores con env vars Firebase **vacías** (warning en consola, no fatal).
- [ ] `npm run start` (production) **falla fast** si las env vars Firebase faltan.
- [ ] `POST /api/device-tokens` con JWT válido y body `{ token: "fake-token-123" }` crea un documento en `devicetokens`.
- [ ] Repetir el POST con el mismo token NO crea duplicados (upsert).
- [ ] `DELETE /api/device-tokens/fake-token-123` con JWT válido borra el documento.
- [ ] Las mismas operaciones funcionan en `POST /api/admin/device-tokens` con sesión admin.
- [ ] El log de inicio del servidor muestra: `[Firebase] Admin SDK initialized for project: <project-id>`.
- [ ] No hay warnings en TypeScript ni en el panel Problems.
