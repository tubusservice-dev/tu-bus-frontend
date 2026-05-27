# Fase 2 — Cleanup de tipos backend

**Objetivo:** dejar el panel Problems vacío en el scope auth eliminando `as any` y tipando correctamente `req.user` / `req.admin`.

---

## 2.1. Augmentation global de Express

**Archivo nuevo:** `backend/src/types/express.d.ts`

```ts
import { JwtPayload } from '@shared/middlewares/auth.middleware';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      admin?: { id: string; username: string };
    }
  }
}

export {};
```

`tsconfig.json` ya incluye `./src/types` en `typeRoots`, así que el archivo se carga automáticamente.

---

## 2.2. Eliminación masiva de `as any`

### Archivos afectados

| Archivo | Ocurrencias actuales |
|---------|-------|
| `backend/src/modules/users/controllers/auth.controller.ts` | ~22 |
| `backend/src/modules/users/controllers/user.controller.ts` | ~5 |
| `backend/src/modules/admin/controllers/admin-user.controller.ts` | ~3 |
| `backend/src/shared/middlewares/auth.middleware.ts` | ~2 |

### Patrones a reemplazar

| Patrón actual | Reemplazo |
|---------------|-----------|
| `(req as any).user` | `req.user!` o guard previo |
| `(req as any).admin` | `req.admin!` |
| `user._id as any` | `user._id as Types.ObjectId` |
| `userId: id as any` | `userId: new Types.ObjectId(id)` o `Types.ObjectId.createFromHexString(id)` |
| `req.body as any` | DTO explícito |
| `userService.create(... as any)` | extender `CreateUserDto` con campos internos opcionales |

---

## 2.3. CreateUserDto extendido

**Archivo:** `backend/src/modules/users/dto/user.dto.ts`

Para evitar el `as any` en `register` cuando se inyecta `requiresEmailVerification`:

```ts
export interface CreateUserDto {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  // ...resto
  /** Internal flag — set by AuthController.register based on env snapshot. */
  requiresEmailVerification?: boolean;
}
```

---

## Validación de Fase 2

1. `npm run build` (backend) con `0 warnings, 0 errors`.
2. WebStorm Problems panel vacío en archivos auth-related.
3. Búsqueda de `as any` en backend → reducción significativa.
