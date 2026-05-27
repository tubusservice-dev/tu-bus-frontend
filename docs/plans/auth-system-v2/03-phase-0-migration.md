# Fase 0 — Migración de schema y datos

**Objetivo:** preparar el modelo de datos y migrar usuarios existentes para los nuevos campos sin romper la app.

---

## Tareas

### 0.1. Modificar `IUser` interface

**Archivo:** `backend/src/modules/users/interfaces/user.interface.ts`

- Añadir `profileCompleted: boolean`.
- Añadir `tokensInvalidatedAt?: Date`.
- Eliminar `username?: string`.
- Eliminar `facebookId?: string`.
- Actualizar `IUserResponse`: añadir `profileCompleted`, eliminar `username`.
- Actualizar `IAdminUserResponse`: añadir `profileCompleted`, eliminar `username`.

### 0.2. Modificar schema `User`

**Archivo:** `backend/src/modules/users/models/user.model.ts`

- Añadir `profileCompleted` con `default: false, index: true`.
- Añadir `tokensInvalidatedAt` (sin default).
- Eliminar definición de `username` y `facebookId`.
- Pre-save hook nuevo: recalcula `profileCompleted` cuando cambia documentType / documentNumber / phone / birthDate / companyName.

### 0.3. Modificar `CreateUserDto`

**Archivo:** `backend/src/modules/users/dto/user.dto.ts`

- Eliminar `username` y `facebookId` de `CreateUserDto`.
- Añadir `profileCompleted?: boolean` a `UpdateUserDto` (uso interno: el pre-save hook lo recalcula, pero permite override admin).

### 0.4. Actualizar `userService.toResponse`

**Archivo:** `backend/src/modules/users/services/user.service.ts`

- Incluir `profileCompleted` en el response.
- Eliminar `username` del response.

### 0.5. Actualizar `adminUserService.toAdminResponse`

**Archivo:** `backend/src/modules/admin/services/admin-user.service.ts`

- Incluir `profileCompleted`.
- Eliminar `username` y referencias a `facebookId` en el filtro `hasOAuth` (ahora solo `googleId`).

### 0.6. Script de migración

**Archivo nuevo:** `backend/src/scripts/migrate-auth-system-v2.ts`

```ts
import 'dotenv/config';
import mongoose from 'mongoose';
import { config } from '@config/index';
import { User } from '@modules/users/models/user.model';

interface MigrationStats {
  scanned: number;
  profileCompletedTrue: number;
  profileCompletedFalse: number;
  usernamesUnset: number;
  facebookIdsUnset: number;
}

const computeProfileCompleted = (doc: any): boolean => {
  const hasCore = !!(doc.documentType && doc.documentNumber && doc.phone);
  if (!hasCore) return false;
  if (doc.documentType === 'J') return !!doc.companyName;
  return !!doc.birthDate;
};

const run = async (): Promise<void> => {
  await mongoose.connect(config.mongodb.uri);
  const collection = User.collection;

  const stats: MigrationStats = {
    scanned: 0,
    profileCompletedTrue: 0,
    profileCompletedFalse: 0,
    usernamesUnset: 0,
    facebookIdsUnset: 0,
  };

  const cursor = collection.find({});
  const ops: any[] = [];

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc) break;
    stats.scanned++;

    const completed = computeProfileCompleted(doc);
    if (completed) stats.profileCompletedTrue++;
    else stats.profileCompletedFalse++;

    const unset: Record<string, ''> = {};
    if ('username' in doc) {
      unset.username = '';
      stats.usernamesUnset++;
    }
    if ('facebookId' in doc) {
      unset.facebookId = '';
      stats.facebookIdsUnset++;
    }

    ops.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: { profileCompleted: completed },
          ...(Object.keys(unset).length ? { $unset: unset } : {}),
        },
      },
    });

    if (ops.length >= 500) {
      await collection.bulkWrite(ops);
      ops.length = 0;
    }
  }
  if (ops.length) await collection.bulkWrite(ops);

  // Drop legacy unique indexes
  const indexes = await collection.indexes();
  for (const idx of indexes) {
    if (idx.name === 'username_1' || idx.name === 'facebookId_1') {
      await collection.dropIndex(idx.name);
    }
  }

  console.log('[migrate-auth-v2] Stats:', stats);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('[migrate-auth-v2] FAILED:', err);
  process.exit(1);
});
```

### 0.7. Añadir script al `package.json`

**Archivo:** `backend/package.json`

```json
"migrate:auth-v2": "ts-node -r tsconfig-paths/register src/scripts/migrate-auth-system-v2.ts"
```

### 0.8. Modelo Frontend

**Archivo:** `frontend/src/app/models/user.model.ts`

- Añadir `profileCompleted: boolean` a `User`.
- Eliminar `username`.

### 0.9. Ejecución

```bash
# DEV
cd backend
npm run migrate:auth-v2

# QA: cambiar MONGODB_URI en .env apuntando a QA y volver a ejecutar
npm run migrate:auth-v2
```

---

## Validación de Fase 0

1. Verificar en MongoDB Compass que ningún documento contiene `username` o `facebookId`.
2. Spot-check: 1 user OAuth existente → `profileCompleted: false`. 1 user local completo → `true`.
3. Build backend (`npm run build`) sin warnings.
4. Build frontend (`ng build`) sin warnings.
