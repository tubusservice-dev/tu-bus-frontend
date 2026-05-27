# 16 — Phase B (iOS) — Windows-Only Track

> **Status:** ⏳ A EJECUTAR (plan aprobado 2026-05-26)
> **Tipo:** Fase preparatoria — ejecuta el ~70% del trabajo iOS que NO requiere Mac/Xcode
> **Owner:** Luis V (workstation Windows)
> **Trigger:** decisión del owner de adelantar todo lo posible para iOS antes de adquirir Mac + cuenta Apple Developer
> **Entry criteria:** Phase 6.6 cerrada (Android estable) + análisis deep-debug `dd-ios-gap-analysis` aprobado
> **Exit criteria:** branch `feat/capacitor-ios-windows-track` lista para merge + handoff package documentado para que cualquier dev con Mac termine el trabajo en ≤1 día
> **Lectura previa:** `00-master-plan.md`, `14-phase-6.6-native-insets-bridge.md`, `05-decisions-log.md`

---

## Resumen ejecutivo

Phase 6.6 cerró Android en estado estable. Phase B (iOS) requiere ~9 días-hombre + Mac + cuenta Apple Developer ($99/año) + iPhone físico. Mientras se reúnen esos recursos, **~70% del trabajo iOS puede ejecutarse desde Windows**: backend Apple Sign-In, frontend platform layer, UI, assets pre-generados, documentación, copy/legal.

Este documento ejecuta ese 70%. El 30% restante (todo lo Mac-only) queda documentado en `15-phase-B-ios.md` (a generar en WB-1) y resuelto en una sesión continua de ~1 día siguiendo `17-mac-handoff-checklist.md` (también generado aquí).

**Garantías contractuales del Windows track:**

1. ✅ Android (Phases 0-6.6) NO se rompe — smoke test en POCO X4 Pro 5G tras cada fase.
2. ✅ Web NO se rompe — smoke test `npm run build:prod` + login Google producción tras cada fase.
3. ✅ Cero código nativo Swift/Objective-C.
4. ✅ Cero ejecución de `npx cap add ios` (requiere Mac).
5. ✅ Cero ejecución de Xcode.

---

## 🔴 AVISO CRÍTICO — Railway auto-deploy

**La branch `feat/capacitor-ios` está vinculada a Railway producción.** Confirmado con el owner el 2026-05-27. Cualquier commit pusheado a esta branch se deploya automáticamente al backend de producción que sirve a la web y a la APK Android en uso real.

**Implicaciones obligatorias para todo cambio backend en este Windows track:**

1. **Estrictamente aditivo:** cero modificación a endpoints existentes, cero rename de columnas Mongoose, cero cambio de contratos de respuesta.
2. **Tests obligatorios antes de cada commit:** `npx tsc --noEmit` + `npm test` sin regresiones en los 36 tests pre-existentes.
3. **Endpoints nuevos deben degradar limpio:** si faltan las env vars Apple (`APPLE_TEAM_ID`, etc.), `POST /api/auth/apple/native` debe responder `500 OAUTH_NOT_CONFIGURED` y no crashear — mismo patrón que ya usa `/google/native` cuando faltan env vars Google.
4. **Smoke test post-deploy obligatorio:** tras cada push, validar manualmente que la web sigue logueando con Google en producción.
5. **Rollback plan en cada commit:** mensajes de commit limpios + commits pequeños y atómicos para que un `git revert` aislado funcione si algo se rompe.

> **Esto invalida la fantasía de "es solo dev, no pasa nada".** Cualquier error en backend tumba TuBus Express producción.

---

## Mapa de las 9 sub-fases

```
WB-0  Autorización + decisiones formales D7-D12     (0.5 día)
   ↓
WB-1  Documentación base (Phase B plan + decisions) (0.5 día)
   ↓
WB-2  Backend Apple Sign-In end-to-end              (1.5 días)  ─┐ paralelos
WB-3  Frontend platform layer @platform/apple-auth  (0.5 día)   ─┤  con
WB-4  Frontend UI: auth-modal + link-modal          (0.5 día)   ─┘  Apple Dev
   ↓                                                                registration
WB-5  Generación assets iOS (capacitor-assets)      (0.5 día)
   ↓
WB-6  Archivos estáticos (AASA placeholder + nginx) (0.5 día)
   ↓
WB-7  Copy & legal (Info.plist strings + listing)   (1 día)
   ↓
WB-8  Validación cross-platform anti-regresión      (0.5 día)
   ↓
WB-9  Consolidación + handoff package               (0.5 día)
                                                    ─────────
                                                    ~6 días-hombre

Paralelo a TODO esto:
WB-A  Trámites administrativos Apple Developer + Firebase + hardware
       (latencia 24-72h Apple, logística iPhone)
```

### Vista consolidada en 5 fases (para tracking y PRs)

El detalle granular de 9 sub-fases (WB-0 → WB-9) es para ejecución diaria. Para reportes de progreso y para estructurar el Pull Request final, se agrupan en **5 fases consolidadas**:

| Fase consolidada | Engloba sub-fases | Entregable |
|---|---|---|
| **F1 — Setup + Decisiones** | WB-0 | Branch activa + decisiones D7-D12 + baselines |
| **F2 — Backend Apple Sign-In** | WB-2 | Endpoints + tests + deploy Railway sin regresión |
| **F3 — Frontend Platform + UI** | WB-3 + WB-4 | Strategy `@platform/apple-auth` + auth-modal + link-modal |
| **F4 — Estáticos (assets + AASA + legal)** | WB-5 + WB-6 + WB-7 | Assets iOS pre-generados + AASA + nginx + copy App Store |
| **F5 — Validación + Docs + PR** | WB-1 + WB-8 + WB-9 | Smoke tests + bitácora final + handoff package + PR draft |

> **Nota sobre orden:** WB-1 (documentación de plan) se ejecuta al final dentro de F5, no al inicio. El doc del plan ya existe (este archivo); lo que falta es actualizarlo con la bitácora del progreso real al cierre de cada fase consolidada — mismo patrón que las Phases 0-6.6.

---

## Phase WB-0 — Autorización + Decisiones Formales

> **Status:** ⏳ A EJECUTAR
> **Esfuerzo:** 0.5 día (análisis + decisiones)
> **Entry criteria:** análisis deep-debug aprobado
> **Exit criteria:** 6 decisiones (D7-D12) registradas + branch git creada + baselines anotadas

### WB-0.1 — Resolver las 6 decisiones bloqueantes

| # | Decisión | Recomendación técnica | Esfuerzo owner |
|---|---|---|---|
| D7 | Apple Sign-In obligatorio iOS | **Sí** — no es opcional (App Store Guideline 4.8) | 1 min confirmar |
| D8 | Orden visual auth-modal en iOS | Apple arriba, Google abajo (iOS HIG); Android al revés | 1 min |
| D9 | Distribución iOS | App Store + TestFlight closed (no hay sideload — Apple lo prohíbe) | 1 min |
| D10 | Mac: comprar o alquilar | Si proyecto único: alquilar $50/mes por 2-3 meses. Si roadmap iOS recurrente: Mac mini M4 (~$700) | Decisión de presupuesto |
| D11 | iOS minSdk | iOS 14 (default Capacitor 8, ~95% cobertura — alineado con Android API 24) | 1 min |
| D12 | Versionado | Sincronizado SemVer: `1.0.0` en ambos, `versionCode` independiente por plataforma | 1 min |

### WB-0.2 — Usar branch existente `feat/capacitor-ios`

**Decisión tomada el 2026-05-27 tras deep-debug:** la branch `feat/capacitor-ios` YA EXISTE en ambos repos (frontend + backend) y está vinculada al deploy de Railway producción. Crear una segunda branch (`feat/capacitor-ios-windows-track`) fragmentaría el esfuerzo y duplicaría el ciclo de merges. Se descarta.

```powershell
# Verificar que estamos en la branch correcta en ambos repos
git -C frontend branch --show-current   # debe imprimir: feat/capacitor-ios
git -C backend  branch --show-current   # debe imprimir: feat/capacitor-ios

# Verificar working tree limpio antes de empezar
git -C frontend status
git -C backend status
```

Si por alguna razón estás en otra branch, regresar:

```powershell
git -C frontend checkout feat/capacitor-ios
git -C backend  checkout feat/capacitor-ios
```

> **Implicación:** cada commit en esta branch va a producción (ver aviso crítico al inicio del documento). Disciplina máxima de tests pre-commit.

### WB-0.3 — Smoke test baseline pre-cambios

```powershell
# Frontend
npm run build:prod
# Anotar bundle transfer baseline (esperado ~187 kB según Phase 6.6)

# Backend
npx tsc --noEmit
npm test
# Anotar tests pasando/fallando
```

### Definition of Done WB-0

- [ ] 6 decisiones D7-D12 registradas formalmente
- [ ] Branch `feat/capacitor-ios-windows-track` activa en frontend Y backend
- [ ] Bundle web baseline anotado (anchor para anti-regresión)
- [ ] Tests backend baseline anotados (36 pasando / 9 fallando pre-existentes según Phase 2)

---

## Phase WB-1 — Documentación Base

> **Status:** ⏳
> **Esfuerzo:** 0.5 día
> **Entry criteria:** WB-0 cerrada
> **Exit criteria:** 4 docs nuevos/actualizados en `docs/plans/capacitor-mobile/`

### Tareas

| # | Archivo | Acción |
|---|---|---|
| WB-1.1 | `15-phase-B-ios.md` | **NUEVO** — plan ejecutable Phase B completa (estilo `06-13`) con las 7 sub-fases iOS (B0-B6) que SÍ requieren Mac |
| WB-1.2 | `16-phase-B-windows-track.md` | **NUEVO** (este documento) — ya creado |
| WB-1.3 | `05-decisions-log.md` | **ACTUALIZAR** — añadir sección "Decisiones Phase B" con D7-D12 cerradas |
| WB-1.4 | `00-master-plan.md` | **ACTUALIZAR** — Phase B expandida con esfuerzo real, costos ($99/año Apple + Mac), riesgos R21-R27, mapa Android↔iOS |

### Definition of Done WB-1

- [ ] Los 4 docs nuevos/actualizados generados, revisados y commiteados
- [ ] Mensaje commit sugerido: `docs(capacitor-ios): add phase B plan + windows-track + D7-D12 decisions`
- [ ] Master plan refleja Phase B como roadmap formal

---

## Phase WB-2 — Backend Apple Sign-In End-to-End

> **Status:** ⏳
> **Esfuerzo:** 1.5 días
> **Entry criteria:** WB-1 cerrada + D7 confirmada (Apple Sign-In adoptado)
> **Exit criteria:** endpoints testeable con `curl` + deployed a Railway + backend compila + tests pasan + web NO regresiona

### WB-2.1 — Instalar dependencia

```powershell
cd backend
npm install --save apple-signin-auth
```

> **Justificación:** `apple-signin-auth` es el wrapper más mantenido (2025) del JWKS público Apple (`https://appleid.apple.com/auth/keys`). Alternativa evaluada: `verify-apple-id-token` (menos mantenida).

### WB-2.2 — Refactor `verifyGoogleIdToken` → extraer `verifyAppleIdToken`

Hoy `auth.controller.ts` tiene `verifyGoogleIdToken()` privado (extraído en Phase 6.5). Aplicar SoC: extraer también `verifyAppleIdToken()` con la misma signatura.

```typescript
// backend/src/modules/users/controllers/auth.controller.ts
private async verifyAppleIdToken(identityToken: string): Promise<AppleProfilePayload>
```

### WB-2.3 — `userService.findOrCreateFromAppleProfile`

Calca exacta de `findOrCreateFromGoogleProfile` con las 3 ramas:

```typescript
// backend/src/modules/users/services/user.service.ts
interface AppleProfilePayload {
  appleId: string;     // sub claim (Apple "user identifier" estable per app)
  email?: string;      // Apple devuelve email SOLO en el primer login
  firstName?: string;  // Apple devuelve nombre SOLO en el primer login
  lastName?: string;
}

async findOrCreateFromAppleProfile(payload: AppleProfilePayload): Promise<IUser>
```

**Particularidades Apple a documentar en código:**

- Apple solo devuelve `email` y nombre en el **primer login** del usuario para esa app — guardar inmediatamente, no esperar al segundo login.
- Email puede ser `relay` (`xxxx@privaterelay.appleid.com`) si el usuario eligió "Hide My Email" — almacenarlo igual, el sistema de emails de TuBus debe poder enviarle al relay.
- `sub` (appleId) es estable PER APP — distinto entre `com.tubusexpress.app` y otra app del mismo dev account. Por tanto sirve como identidad estable.
- Soportar el mismo `OAUTH_LOCAL_COLLISION` sentinel ya existente para reutilizar el patrón bidirectional linking de Phase 6.5.

### WB-2.4 — `User` model — añadir campo `appleId`

```typescript
// backend/src/modules/users/models/user.model.ts
appleId?: {
  type: String,
  unique: true,
  sparse: true,
  select: false,  // Same pattern as googleId
};
```

`sparse: true` permite múltiples docs sin `appleId` (no colisiona con `null`).

### WB-2.5 — `authController.appleNative()`

```typescript
async appleNative(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { identityToken } = req.body;
    const payload = await this.verifyAppleIdToken(identityToken);
    const user = await userService.findOrCreateFromAppleProfile(payload);
    assertAccountUsable(user);
    const token = this.generateToken(user);
    res.json({ success: true, data: { token, user: sanitizeUser(user) } });
  } catch (err) {
    next(err);
  }
}
```

> **🔒 NOTA DE SEGURIDAD CRÍTICA — Validación del claim `aud`:**
>
> La librería `apple-signin-auth` **NO valida el `audience` (aud claim) automáticamente** por defecto. Hay que pasárselo explícitamente al método `verifyIdToken`:
>
> ```typescript
> const appleSignin = require('apple-signin-auth');
>
> const payload = await appleSignin.verifyIdToken(identityToken, {
>   audience: config.oauth.apple.serviceId,  // ← OBLIGATORIO
>   ignoreExpiration: false,                  // ← OBLIGATORIO (no aceptar tokens expirados)
> });
> ```
>
> **Sin esta validación, cualquier app que use Sign in with Apple del mundo podría enviar tokens válidos a nuestro endpoint y autenticar usuarios en TuBus.** Es la misma clase de vulnerabilidad que la falta de validación de `aud` en JWT custom — bypass trivial de autenticación.
>
> El `audience` para Apple es el **Service ID** (`com.tubusexpress.app.signin` o similar — se crea en Apple Developer → Identifiers → Services IDs), NO el bundle ID de la app.

### WB-2.6 — Ruta `POST /api/auth/apple/native`

```typescript
// backend/src/modules/users/routes/auth.routes.ts
router.post(
  '/apple/native',
  loginRateLimit,
  body('identityToken').isString().notEmpty().withMessage('identityToken requerido'),
  validateRequest,
  authController.appleNative.bind(authController),
);
```

### WB-2.7 — Endpoint simétrico `link-apple-with-password`

Mismo patrón que `link-google-with-password` de Phase 6.5 (cuando email colisiona con cuenta local):

```typescript
// backend/src/modules/users/services/user.service.ts
async linkAppleToLocalAccount(payload: AppleProfilePayload, password: string): Promise<IUser>

// backend/src/modules/users/controllers/auth.controller.ts
async linkAppleWithPassword(req, res, next)

// backend/src/modules/users/routes/auth.routes.ts
router.post('/link-apple-with-password', loginRateLimit, ...);
```

### WB-2.8 — Env vars Railway (documentar, NO setear hasta tener cuenta Apple)

```bash
APPLE_TEAM_ID=<10-char alphanumeric>           # Apple Developer → Membership
APPLE_SERVICE_ID=com.tubusexpress.app.signin   # Apple Developer → Identifiers → Services IDs
APPLE_KEY_ID=<10-char>                         # Apple Developer → Keys (Sign in with Apple key)
APPLE_PRIVATE_KEY=<contenido del .p8 base64>   # Multiline, escapar \n
```

Hasta tener la cuenta Apple → dejarlas vacías. El endpoint rechazará con `OAUTH_NOT_CONFIGURED` (mismo patrón que el `/google/native` cuando no había env vars en Phase 2).

### WB-2.9 — Tests unitarios

```typescript
// backend/src/modules/users/services/__tests__/user.service.apple.spec.ts
describe('userService.findOrCreateFromAppleProfile', () => {
  it('returns existing user when appleId matches', ...);
  it('throws OAUTH_LOCAL_COLLISION when email matches local account without appleId', ...);
  it('creates new user when neither appleId nor email exist', ...);
});

describe('userService.linkAppleToLocalAccount', () => {
  it('links apple to local account when password is correct', ...);
  it('throws INVALID_PASSWORD when password is wrong', ...);
  it('throws APPLE_ALREADY_LINKED when account already has appleId', ...);
  it('throws ACCOUNT_HAS_NO_PASSWORD when local account lacks password', ...);
});
```

### WB-2.10 — Compilar + tests + deploy Railway

```powershell
cd backend
npx tsc --noEmit       # Cero errores TS
npm run build          # Cero errores build
npm test               # Tests Apple pasan + cero regresión en Google/local

git add -A
git commit -m "feat(auth): add Apple Sign-In endpoints + service + tests"
git push origin feat/capacitor-ios-windows-track
# Railway auto-deploy de la branch
```

### Definition of Done WB-2

- [ ] `apple-signin-auth` instalada
- [ ] `User.appleId` campo añadido al schema
- [ ] `userService.findOrCreateFromAppleProfile` con 3 ramas + tests (3 specs)
- [ ] `userService.linkAppleToLocalAccount` con tests (4 specs)
- [ ] `authController.appleNative` + `linkAppleWithPassword`
- [ ] Rutas `POST /api/auth/apple/native` + `POST /api/auth/link-apple-with-password`
- [ ] `npx tsc --noEmit` clean
- [ ] Tests nuevos pasan (cero regresión en los 36 pre-existentes)
- [ ] Branch pusheada a Railway, build exitoso
- [ ] **Web sigue logueando con Google sin cambios** (smoke test producción)

---

## Phase WB-3 — Frontend Platform Layer (`@platform/apple-auth`)

> **Status:** ⏳
> **Esfuerzo:** 0.5 día
> **Entry criteria:** WB-2 cerrada (para que el frontend tenga endpoint válido al cual apuntar)
> **Exit criteria:** strategy creada + factory provider wireado + bundle web no crece >5 kB

### WB-3.1 — Estructura de archivos (calca de `@platform/google-auth/`)

```
frontend/src/app/platform/
└── apple-auth/
    ├── apple-auth.service.ts           ← interface IAppleAuth + token APPLE_AUTH + tipos
    ├── web-apple-auth.strategy.ts      ← no-op (Apple JS SDK fuera de scope v1)
    └── native-apple-auth.strategy.ts   ← FirebaseAuthentication.signInWithApple()
```

### WB-3.2 — `apple-auth.service.ts`

```typescript
export interface AppleSignInResult {
  flow: 'native';
  identityToken: string;
}

export interface IAppleAuth {
  signIn(): Promise<AppleSignInResult>;
  signOut(): Promise<void>;
  isAvailable(): boolean;  // false en web + Android
}

export const APPLE_AUTH = new InjectionToken<IAppleAuth>('APPLE_AUTH');
```

### WB-3.3 — `native-apple-auth.strategy.ts`

```typescript
export class NativeAppleAuthStrategy implements IAppleAuth {
  async signIn(): Promise<AppleSignInResult> {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    const result = await FirebaseAuthentication.signInWithApple();
    const identityToken = result.credential?.idToken;
    if (!identityToken) throw new Error('Apple sign-in did not return an identityToken');
    return { flow: 'native', identityToken };
  }

  async signOut(): Promise<void> {
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    await FirebaseAuthentication.signOut();
  }

  isAvailable(): boolean { return true; }
}
```

### WB-3.4 — `web-apple-auth.strategy.ts` (no-op para web + Android)

```typescript
export class WebAppleAuthStrategy implements IAppleAuth {
  async signIn(): Promise<AppleSignInResult> {
    throw new Error('Apple Sign-In not available on this platform');
  }
  async signOut(): Promise<void> { /* no-op */ }
  isAvailable(): boolean { return false; }
}
```

### WB-3.5 — Factory provider en `platform.providers.ts`

```typescript
{
  provide: APPLE_AUTH,
  useFactory: (platform: PlatformService): IAppleAuth =>
    platform.isIos() ? new NativeAppleAuthStrategy() : new WebAppleAuthStrategy(),
  deps: [PlatformService],
}
```

> **Importante:** gateado por `isIos()`, NO por `isNative()`. Android NO debe instanciar el native strategy de Apple — no tiene sentido funcional.

### WB-3.6 — Barrel `@platform/index.ts`

Añadir exports del módulo `apple-auth`.

### WB-3.7 — `capacitor.config.ts` — añadir provider Apple

```typescript
FirebaseAuthentication: {
  skipNativeAuth: false,
  providers: ['google.com', 'apple.com'],  // ← añadir apple.com
},
```

### WB-3.8 — Smoke test frontend

```powershell
cd frontend
npm run build:prod
# Validar: bundle transfer no crece >5 kB vs baseline WB-0
```

### Definition of Done WB-3

- [ ] 4 archivos nuevos en `@platform/apple-auth/`
- [ ] Factory provider wireado en `platform.providers.ts`
- [ ] Barrel `@platform/index.ts` actualizado
- [ ] `capacitor.config.ts` con `providers: ['google.com', 'apple.com']`
- [ ] Build prod exitoso, bundle <5 kB de delta
- [ ] **Compilar APK Android debug + smoke test POCO** (Apple no aparece, Android sin regresión)

---

## Phase WB-4 — Frontend UI: `auth-modal` + `link-apple-password-modal`

> **Status:** ⏳
> **Esfuerzo:** 0.5 día
> **Entry criteria:** WB-3 cerrada
> **Exit criteria:** botón Apple visible solo en iOS + flujo bidirectional Apple linking funcional (validable mentalmente, hasta tener iPhone)

### WB-4.1 — `auth.service.ts` — método `signInWithAppleNative`

Calca de `signInWithGoogleNative()`:

```typescript
private async signInWithAppleNative(): Promise<void> {
  this.nativeOAuthLoadingSignal.set(true);
  try {
    const { identityToken } = await this.appleAuth.signIn();
    this.http.post<AuthResponse>(`${this.apiUrl}/auth/apple/native`, { identityToken })
      .pipe(catchError(err => this.handleAppleAuthError(err, identityToken)))
      .subscribe({
        next: (res) => this.handleAuthSuccess(res),
        error: (err) => { /* toast + spinner off */ },
      });
  } catch (err) {
    // Apple Sign-In cancellation codes: 1001 (canceled), "user cancelled"
    if (this.isAppleUserCancelled(err)) return;
    const errMsg = String((err as { message?: unknown } | null)?.message ?? err);
    this.toast.error(`No se pudo iniciar sesión con Apple. Detalle: ${errMsg}`);
  } finally {
    this.nativeOAuthLoadingSignal.set(false);
  }
}
```

### WB-4.2 — Signals para bidirectional linking Apple

```typescript
private readonly linkApplePendingSignal = signal<string | null>(null);  // identityToken staged
readonly linkAppleModalOpen = computed(() => !!this.linkApplePendingSignal());

openLinkAppleModal(identityToken: string): void {
  this.linkApplePendingSignal.set(identityToken);
  this.closeAuthModal();  // Same pattern as openLinkGoogleModal in Phase 6.5
}

closeLinkAppleModal(): void { this.linkApplePendingSignal.set(null); }

linkAppleWithPassword(password: string): Observable<AuthResponse> { ... }
```

### WB-4.3 — `auth-modal.component` — botón Apple gateado

```html
@if (platform.isIos()) {
  <!-- iOS HIG (D8): Apple primero, Google después -->
  <button (click)="onAppleClick()" class="oauth-btn oauth-btn--apple">
    <svg><!-- Apple logo --></svg>
    Continuar con Apple
  </button>
  <button (click)="onGoogleClick()" class="oauth-btn oauth-btn--google">
    Continuar con Google
  </button>
} @else {
  <!-- Android + Web: Google solo (Apple no aplica) -->
  <button (click)="onGoogleClick()">Continuar con Google</button>
}
```

### WB-4.4 — Componente nuevo `link-apple-password-modal` (Opción A confirmada)

**Decisión tomada el 2026-05-27 por el owner:** se elige **Opción A — modal Apple separado** (NO refactorizar el modal Google existente a un componente genérico).

**Justificación:**
- Cero riesgo de regresión en Android producción.
- El modal Google ya está validado en QA POCO (Phase 6.5).
- Trade-off aceptado: ~95 líneas duplicadas vs disciplina de mantenerlos sincronizados manualmente.
- Si en el futuro se quiere refactorizar a genérico, se hace como tarea separada con QA dedicado.

Calca exacta de `link-google-password-modal` (Phase 6.5), cambiando solo los nombres y los strings:

```
frontend/src/app/shared/components/link-apple-password-modal/
├── link-apple-password-modal.component.ts    ← copia de link-google-password-modal.component.ts
├── link-apple-password-modal.component.html  ← copia con textos "Apple" en lugar de "Google"
└── link-apple-password-modal.component.scss  ← copia idéntica (cero divergencia visual)
```

Mapeo de códigos backend a mensajes de error:

| Código backend | Mensaje cliente |
|---|---|
| `INVALID_PASSWORD` | "Contraseña incorrecta" |
| `APPLE_ALREADY_LINKED` | "Esta cuenta ya tiene Apple vinculado. Cierra este modal e inicia sesión con Apple." |
| `ACCOUNT_HAS_NO_PASSWORD` | "Esta cuenta no tiene contraseña. Usa '¿Olvidaste tu contraseña?' para crearla primero." |
| `ACCOUNT_NOT_FOUND` | "La cuenta asociada a este correo ya no existe." |
| `APPLE_EMAIL_MISSING` | "El token de Apple no incluye un correo electrónico." (caso edge cuando user eligió Hide My Email y la cuenta es nueva) |

### WB-4.5 — Registrar modal en `app.ts` + `app.html`

```typescript
// app.ts
imports: [..., LinkApplePasswordModalComponent]
```

```html
<!-- app.html -->
<app-link-apple-password-modal />
```

### WB-4.6 — `performLogoutAsync` — añadir Apple signOut

```typescript
await Promise.race([
  Promise.allSettled([
    this.unregisterFcmTokenSilent(isAdmin),
    this.signOutGoogleSilent(),
    this.signOutAppleSilent(),  // ← NUEVO (mismo patrón que Google en Phase 6.5)
  ]),
  new Promise<void>((resolve) => setTimeout(resolve, 1500)),
]);
```

### WB-4.7 — Smoke test final WB-4

```powershell
npm run build:prod
# Bundle delta total Windows track: anotar
# Esperado: <10 kB transfer growth vs baseline Phase 6.6
```

### Definition of Done WB-4

- [ ] `auth.service.ts` con métodos Apple + signals
- [ ] `auth-modal` con botón Apple gateado por `isIos()` + orden iOS HIG (D8)
- [ ] `link-apple-password-modal` creado
- [ ] Registrado en `app.ts` + `app.html`
- [ ] `performLogoutAsync` invoca `signOutAppleSilent`
- [ ] Build prod exitoso
- [ ] **APK Android rebuilt + smoke test POCO** — botón Apple NO aparece, login local + Google sin regresión

---

## Phase WB-5 — Generación de Assets iOS (desde Windows)

> **Status:** ⏳
> **Esfuerzo:** 0.5 día
> **Entry criteria:** logo master 1024×1024 disponible (ya existe en `resources/icon.png` desde Phase 6)
> **Exit criteria:** carpeta `resources/ios-staging/` poblada con assets pre-generados

### WB-5.1 — Estrategia: carpeta staging `resources/ios-staging/`

Como no podemos correr `npx cap add ios` sin Mac, generamos los assets a una carpeta staging que el día del Mac se copia tal cual a `ios/App/App/Assets.xcassets/`:

```
frontend/resources/
├── icon.png           ← master 1024x1024 (existente)
├── splash.png         ← master 2732x2732 (existente)
└── ios-staging/       ← NUEVO
    ├── AppIcon.appiconset/
    │   ├── Contents.json
    │   ├── AppIcon-20@2x.png
    │   ├── AppIcon-29@2x.png
    │   └── ... (15+ tamaños)
    └── Splash.imageset/
        ├── Contents.json
        └── splash-2732x2732.png
```

### WB-5.2 — Ejecutar `@capacitor/assets` para iOS

```powershell
cd frontend
# @capacitor/assets@3.0.5 ya instalado como devDep desde Phase 5
# Normalmente busca ios/App/App/Assets.xcassets/ (que no existe)
# Workaround: generar y redirigir manualmente

npx capacitor-assets generate --ios --assetPath resources/ios-staging
```

Si el flag `--assetPath` no funciona en la versión 3.0.5, alternativa manual:

1. Crear stub temporal `ios/App/App/Assets.xcassets/`
2. Ejecutar `npx capacitor-assets generate --ios`
3. Mover output a `resources/ios-staging/`
4. Eliminar carpeta stub

### WB-5.3 — Commitear assets generados

```powershell
git add frontend/resources/ios-staging/
git commit -m "build(ios): pre-generate iOS app icon + splash assets from master"
```

### Definition of Done WB-5

- [ ] Carpeta `frontend/resources/ios-staging/` con AppIcon + Splash completos
- [ ] Contents.json correctos para cada asset
- [ ] Commiteado en branch

---

## Phase WB-6 — Archivos Estáticos (AASA + nginx)

> **Status:** ⏳ — Bloqueante: Apple Team ID (se obtiene en WB-A.3 post-cuenta Apple activa)
> **Esfuerzo:** 0.5 día
> **Entry criteria:** Apple Developer Program activo + Team ID copiado
> **Exit criteria:** AASA servido vía nginx con Content-Type correcto + validado contra Apple CDN

### WB-6.1 — Crear `apple-app-site-association`

Path:

```
frontend/public/.well-known/apple-app-site-association
```

> **NOTA CRÍTICA:** sin extensión `.json`. Apple lo exige así.

Contenido:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAMID.com.tubusexpress.app",
        "paths": [
          "/verify-email",
          "/reset-password",
          "/verify-account-link",
          "/auth/callback",
          "/perfil/*",
          "/checkout/*",
          "/catalogo/*",
          "*"
        ]
      }
    ]
  }
}
```

> **Placeholder hasta WB-A.3:** dejar `TEAMID` literal y reemplazar cuando Apple Developer esté activo.

### WB-6.2 — Configurar nginx

`frontend/nginx.conf` — añadir bloque:

```nginx
# Apple Universal Links AASA file.
# Must be served with Content-Type: application/json and NO extension.
location = /.well-known/apple-app-site-association {
    default_type application/json;
    add_header Cache-Control "public, max-age=3600";
    try_files $uri =404;
}
```

> **Importante:** este bloque DEBE ir antes del catch-all location `/` para que nginx lo matchee primero.

### WB-6.3 — Validación pre-deploy (mental)

- [ ] Archivo SIN extensión (`apple-app-site-association`, no `.json`)
- [ ] JSON válido (validar con `Get-Content ... | ConvertFrom-Json` en PowerShell)
- [ ] nginx location precedence verificada (debe ir ANTES del catch-all)

### WB-6.4 — Deploy a producción (cuando se autorice)

Tras deploy, validar con Apple CDN:

```
https://app-site-association.cdn-apple.com/a/v1/tubusexpress.com
```

Si Apple lo cacheó correctamente → AASA listo para Universal Links.

### Definition of Done WB-6

- [ ] `apple-app-site-association` creado con placeholder Team ID
- [ ] `nginx.conf` con location + Content-Type
- [ ] JSON validado sintácticamente
- [ ] (Post-WB-A): Team ID real reemplazado y deployado

---

## Phase WB-7 — Copy & Legal (offline, sin cuentas externas)

> **Status:** ⏳
> **Esfuerzo:** 1 día
> **Entry criteria:** ninguna (puede hacerse en paralelo con WB-2/WB-3/WB-4)
> **Exit criteria:** todos los textos legales/marketing listos para pegar en `Info.plist` y App Store Connect

### WB-7.1 — `Info.plist` Usage Descriptions (4 strings en español)

Crear `frontend/resources/ios-staging/Info.plist.usage-descriptions.md` con los textos finales:

```xml
<key>NSCameraUsageDescription</key>
<string>TuBus Express necesita acceso a tu cámara para capturar comprobantes de pago y fotos de perfil.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>TuBus Express necesita acceso a tu galería para subir comprobantes de pago e imágenes de perfil.</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>TuBus Express usa tu ubicación para sugerir la sucursal y zona de despacho más cercanas.</string>

<key>NSFaceIDUsageDescription</key>
<string>Inicia sesión rápido en TuBus Express con Face ID sin volver a escribir tu contraseña.</string>
```

> **Crítico:** sin `NSFaceIDUsageDescription`, la app **crashea** la primera vez que el plugin biométrico invoca Face ID. Apple lo enforza desde iOS 11.

### WB-7.2 — Copy App Store Connect (es-VE)

Crear `frontend/resources/app-store-listing.md`:

| Campo | Límite | Notas |
|---|---|---|
| App Name | 30 chars | "TuBus Express" |
| Subtitle | 30 chars | "Repuestos y servicios" |
| Promotional Text | 170 chars | Editable post-release sin re-submit |
| Description | 4000 chars | Larga, en español venezolano |
| Keywords | 100 chars | "repuestos,autobús,mecánico,aceite,filtros,caracas,venezuela,delivery,taller" |
| What's New | 4000 chars | Por versión |
| Support URL | URL | `https://tubusexpress.com/contacto` |
| Marketing URL | URL | `https://tubusexpress.com` |
| Privacy Policy URL | URL | `https://tubusexpress.com/legal/privacidad` |

### WB-7.3 — App Privacy Nutrition Labels (matriz obligatoria)

App Store Connect exige declarar TODOS los datos recolectados. Pre-llenar la matriz en `docs/plans/capacitor-mobile/app-store-privacy-nutrition.md`:

| Dato | ¿Lo recolectas? | Propósito | ¿Linkado al usuario? | Tracking |
|---|---|---|---|---|
| Email Address | ✅ | Account creation | Sí | No |
| Name | ✅ | Account creation | Sí | No |
| Phone Number | ✅ | Account creation, contact for delivery | Sí | No |
| Physical Address | ✅ | Shipping address | Sí | No |
| User ID | ✅ | Account auth | Sí | No |
| Purchase History | ✅ | Order tracking | Sí | No |
| Photos | ✅ | Payment proof upload | Sí (linkado a la orden) | No |
| Precise Location | ✅ | Zone detection | No (no se persiste) | No |
| Device ID | ✅ | FCM push delivery | Sí | No |
| Crash Data | ✅ | Crashlytics | No | No |
| Performance Data | ✅ | Firebase Analytics | No | No |
| Product Interaction | ✅ | Analytics | No | No |

### WB-7.4 — Actualizar política de privacidad

`https://tubusexpress.com/legal/privacidad` debe mencionar:

- Firebase Authentication (Google + Apple)
- Firebase Cloud Messaging (push notifications)
- Firebase Crashlytics (crash reports)
- Firebase Analytics (usage metrics)
- Apple ID (`sub`, email, name) bajo "Sign in with Apple"

### WB-7.5 — Screenshots iOS — mockups en Figma/equivalente

Apple exige 3 tamaños mínimos para App Store listing:

| Device | Tamaño | Cantidad |
|---|---|---|
| iPhone 6.9" (15/16 Pro Max) | 1290×2796 px | 5 screenshots |
| iPhone 6.5" (11/12/13 Pro Max) | 1242×2688 px | 5 screenshots |
| iPhone 5.5" (8 Plus) | 1242×2208 px | 5 screenshots |

**Estrategia sin iPhone real:** generar mockups en Figma usando frames device + screenshots ACTUALES de Android (POCO) escalados/ajustados al aspect ratio iPhone. Aceptable como placeholder; reemplazar con captures reales post-Mac.

### Definition of Done WB-7

- [ ] 4 Usage Description strings escritas y revisadas
- [ ] Copy App Store completo en `resources/app-store-listing.md`
- [ ] Matriz Privacy Nutrition pre-llenada
- [ ] Política de privacidad actualizada (PR aparte al frontend)
- [ ] 15 screenshots mockup generados (5×3 tamaños)
- [ ] Todo commiteado en branch

---

## Phase WB-8 — Validación Cross-Platform (anti-regresión)

> **Status:** ⏳
> **Esfuerzo:** 0.5 día
> **Entry criteria:** WB-2, WB-3, WB-4, WB-5 cerradas
> **Exit criteria:** Android sin regresión + web sin regresión + bundles dentro de presupuesto

### WB-8.1 — Android end-to-end (POCO X4 Pro 5G)

```powershell
cd frontend
npm run build:prod
cd android
.\gradlew assembleDebug
adb install -r app\build\outputs\apk\debug\app-debug.apk
adb shell am start -n com.tubusexpress.app/.MainActivity
```

Checklist en POCO:

- [ ] App abre sin crashes
- [ ] Login local funciona
- [ ] Login Google nativo funciona
- [ ] Push notifications llegan y al tap navegan
- [ ] Botón Apple **NO aparece** en auth-modal (correctamente gateado)
- [ ] Hardware back funciona
- [ ] Safe-area Phase 6.6 sigue funcionando

### WB-8.2 — Web (browser desktop + mobile)

- [ ] Login local funciona
- [ ] Login Google funciona
- [ ] Push web funciona (Firebase web SDK)
- [ ] Botón Apple **NO aparece** (correctamente)
- [ ] Bundle size: `dist/tubus-express/browser/main-*.js` <200 kB transfer

### WB-8.3 — Backend (Railway prod)

```bash
curl -X POST https://api.tubusexpress.com/api/auth/apple/native \
  -H "Content-Type: application/json" \
  -d '{"identityToken":"invalid-token"}'

# Esperado: 401 OAUTH_NOT_CONFIGURED (si APPLE_* env vars no están seteadas)
# O 401 INVALID_TOKEN si las env vars sí están seteadas pero token inválido
```

- [ ] Google login web aún funciona en producción (smoke test manual)
- [ ] Endpoint `/apple/native` responde (aunque sea con error de configuración)
- [ ] Endpoint `/link-apple-with-password` responde

### WB-8.4 — Métricas finales

Anotar para comparación contractual:

| Métrica | Phase 0 baseline | Phase 6.6 | Post WB-8 | Delta total |
|---|---|---|---|---|
| Initial bundle raw | 782.53 kB | ~820 kB | ¿? | <40 kB total |
| Initial bundle transfer | 180.79 kB | ~187 kB | ¿? | <10 kB |
| APK debug size | 17 MB | 17 MB | ¿? | sin cambio |
| Backend TS errors | 0 | 0 | 0 | obligatorio |

### Definition of Done WB-8

- [ ] Android POCO: validación funcional checklist completa
- [ ] Web: smoke test sin regresión
- [ ] Backend prod: endpoints Apple responden, Google no se rompió
- [ ] Métricas dentro del budget contractual

---

## Phase WB-9 — Consolidación + Handoff Package

> **Status:** ⏳
> **Esfuerzo:** 0.5 día
> **Entry criteria:** WB-8 cerrada
> **Exit criteria:** branch lista para merge + "Mac handoff package" documentado para que cualquier dev con Mac termine el trabajo en ≤1 día

### WB-9.1 — Generar "Day-of-Mac" handoff checklist

Crear `docs/plans/capacitor-mobile/17-mac-handoff-checklist.md`:

```markdown
# El día que llegue el Mac

Pasos exactos (calculado: 4-6 horas si todo Apple ya está configurado):

1. `git clone <repo>` + `git checkout feat/capacitor-ios-windows-track`
2. `cd frontend && npm install`
3. `npm run build:prod`
4. `npx cap add ios`
5. Copiar `GoogleService-Info.plist` (descargado en WB-A.6) a `ios/App/App/`
6. Drag-drop el `.plist` al target en Xcode (verificar "Copy items if needed")
7. Copiar `resources/ios-staging/AppIcon.appiconset/*` → `ios/App/App/Assets.xcassets/AppIcon.appiconset/`
8. Copiar `resources/ios-staging/Splash.imageset/*` → `ios/App/App/Assets.xcassets/Splash.imageset/`
9. Editar `ios/App/App/Info.plist`: pegar los 4 Usage Descriptions
10. Editar `Info.plist`: añadir `CFBundleURLTypes` con `REVERSED_CLIENT_ID` del GoogleService-Info.plist
11. Xcode → Signing & Capabilities: configurar Team
12. Xcode → Signing & Capabilities → +Capability: Push Notifications
13. Xcode → Signing & Capabilities → +Capability: Sign in with Apple
14. Xcode → Signing & Capabilities → +Capability: Associated Domains → `applinks:tubusexpress.com`, `applinks:www.tubusexpress.com`
15. `cd ios/App && pod install`
16. Xcode → Run en iPhone físico
17. QA Tier A: ejecutar matrices del documento `15-phase-B-ios.md`
18. Si OK → Archive → TestFlight upload
```

### WB-9.2 — Actualizar master plan (capacitor-mobile)

`00-master-plan.md` — añadir sección 18.12 "Phase B Windows Track":

```markdown
### 18.12 Phase B Windows Track (paralelo, sin Mac)

- [x] WB-0.x Decisiones D7-D12 + branch
- [x] WB-1.x Documentación Phase B + windows-track
- [x] WB-2.x Backend Apple Sign-In end-to-end + deploy Railway
- [x] WB-3.x Frontend @platform/apple-auth strategy
- [x] WB-4.x Frontend UI auth-modal + link-apple-modal
- [x] WB-5.x Assets iOS pre-generados
- [x] WB-6.x AASA + nginx (con Team ID)
- [x] WB-7.x Copy/legal/screenshots mockup
- [x] WB-8.x Validación cross-platform
- [x] WB-9.x Handoff package
```

### WB-9.3 — Pull Request strategy

Estrategia recomendada: **un solo PR a `main`** con todo el Windows track (cerca de 30-50 archivos modificados).

Título sugerido:

```
feat(capacitor-ios): add Phase B foundation (Windows-only track, ~70% of iOS work)
```

Body con:

- Lista de los 9 WB-N completados
- Diff de bundles (web + backend tests)
- Smoke tests pasados (Android POCO + web)
- Lo que NO se incluye (todo lo Mac-only listado explícitamente)
- Link al `15-phase-B-ios.md` y `16-phase-B-windows-track.md`

### Definition of Done WB-9

- [ ] Handoff checklist creado (`17-mac-handoff-checklist.md`)
- [ ] Master plan actualizado (sección 18.12)
- [ ] PR draft preparado con descripción completa
- [ ] Branch lista para review

---

## Phase WB-A — Trámites Administrativos (paralelo a TODO lo anterior)

> **Status:** ⏳
> **Esfuerzo:** 30 min de trabajo activo + 24-72 h espera Apple + logística iPhone
> **Tipo:** no técnico — bloqueante para WB-6, WB-7.4, y todo Phase B post-Mac

### Tareas paralelas

| # | Tarea | Cuándo iniciar | Latencia |
|---|---|---|---|
| WB-A.1 | Inscribirse Apple Developer Program ($99/año) — [developer.apple.com/programs](https://developer.apple.com/programs/) | **HOY mismo** | 24-72 h verificación Apple |
| WB-A.2 | Decidir cuenta Individual vs Organization (Org requiere D-U-N-S Number → +1-2 semanas) | Pre WB-A.1 | — |
| WB-A.3 | Una vez activa: copiar **Team ID** (Membership → 10 chars) | Post WB-A.1 | 5 min |
| WB-A.4 | Apple Developer → Identifiers → crear App ID `com.tubusexpress.app` con capabilities | Post WB-A.1 | 10 min |
| WB-A.5 | Apple Developer → Keys → generar APNs Authentication Key (.p8) | Post WB-A.1 | 5 min |
| WB-A.6 | Firebase Console → añadir app iOS con bundle `com.tubusexpress.app` → descargar `GoogleService-Info.plist` | Post WB-A.1 | 10 min |
| WB-A.7 | Firebase Console → Cloud Messaging → subir .p8 con Key ID + Team ID | Post WB-A.5 + WB-A.6 | 5 min |
| WB-A.8 | Apple Developer → Identifiers → Services IDs → crear Service ID para Sign in with Apple | Post WB-A.1 | 10 min |
| WB-A.9 | Apple Developer → Keys → generar Sign in with Apple key (.p8) | Post WB-A.8 | 5 min |
| WB-A.10 | Setear env vars Railway: `APPLE_TEAM_ID`, `APPLE_SERVICE_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` | Post WB-A.9 + WB-2 deployed | 10 min |
| WB-A.11 | Comprar/conseguir iPhone físico (Tier A mínimo) | ASAP | Logístico |
| WB-A.12 | Registrar UDID en Apple Developer → Devices | Post WB-A.11 | 5 min |
| WB-A.13 | Decisión sobre Mac (D10): comprar Mac mini M4 (~$700) o alquilar MacInCloud (~$30/mes) | ASAP | Logístico |

### Definition of Done WB-A

- [ ] Apple Developer Program activo + Team ID copiado
- [ ] App ID + Service ID + 2 keys .p8 generadas
- [ ] Firebase iOS app creada + GoogleService-Info.plist guardado en vault
- [ ] APNs key conectada en Firebase
- [ ] iPhone físico disponible + UDID registrado
- [ ] Env vars Apple seteadas en Railway

---

## Timeline propuesto (semana ideal)

| Día | Bloque |
|---|---|
| **Lunes** | WB-A.1 (iniciar Apple Dev — el reloj corre) + WB-0 (decisiones + branch) + iniciar WB-1 (docs) |
| **Martes** | WB-1 cerrar + WB-2 backend Apple (en paralelo: validar Apple Dev approval) |
| **Miércoles** | WB-2 cerrar + WB-3 platform layer |
| **Jueves** | WB-4 UI + WB-5 assets |
| **Viernes** | WB-7 copy/legal + WB-8 validación cross-platform |
| **Cuando Apple Dev esté activo** | WB-6 AASA con Team ID real + WB-A.10 env vars Railway |
| **WB-9** | Consolidación + PR draft |

---

## Métricas objetivo final del Windows track

| Indicador | Target |
|---|---|
| Bundle web growth vs baseline | <10 kB transfer |
| Android no-regresión | 100% checklist pasa en POCO |
| Backend tests | Cero regresión en 36 pre-existentes + 7 nuevos Apple |
| Docs nuevos | 4 (`15-phase-B-ios.md`, `16-phase-B-windows-track.md`, `17-mac-handoff-checklist.md`, `app-store-privacy-nutrition.md`) |
| Archivos código nuevos frontend | ~10 |
| Archivos código nuevos backend | ~3 (service + controller method + route) |
| Esfuerzo total | ~6 días-hombre (paralelo a trámites Apple) |
| Trabajo iOS restante post-Mac | ~1 día (siguiendo handoff checklist WB-9.1) |

---

## Riesgos del plan Windows-track

| # | Riesgo | Mitigación |
|---|---|---|
| WB-R1 | Apple rechaza la cuenta Developer (raro pero pasa) | Iniciar HOY para tener buffer; tener cuenta alterna como respaldo |
| WB-R2 | Backend Apple endpoint no se valida bien sin un identityToken real | Tests unitarios con mocks JWKS + validación funcional diferida al día del Mac |
| WB-R3 | Strategy `NativeAppleAuthStrategy` falla silenciosamente al primer Mac build (typos en provider Firebase) | El bundle web prueba que el TS compila; el funcional se valida en Mac |
| WB-R4 | El `MainActivity.java` Phase 6.6 no tiene equivalente iOS y podría romper safe-area en iPhone con notch | **Validación crítica WB-8 propuesta**: revisar específicamente todos los `var(--safe-area-*)` en CSS — iOS WKWebView SÍ los propaga, confirmar el día del Mac |
| WB-R5 | Apple Sign-In requiere ofrecer "Hide My Email" — el backend debe aceptar emails `@privaterelay.appleid.com` | Documentar explícitamente en WB-2.3; el schema `User.email` ya es String libre |
| WB-R6 | Las versiones de `apple-signin-auth` cambian su API | Pin de versión en `package.json` + lock en `package-lock.json` |
| WB-R7 | `@capacitor/assets@3.0.5` no soporta `--assetPath` para iOS | Workaround documentado en WB-5.2 (carpeta stub temporal) |

---

## Estado final esperado del Windows track

✅ Backend con paridad Google ↔ Apple desplegado en Railway.
✅ Frontend con strategy + UI Apple gateada por iOS (Android sin regresión).
✅ Assets iOS pre-generados desde Windows.
✅ AASA file + nginx config listos (pendiente Team ID).
✅ Copy + legal + privacy nutrition labels + screenshots mockup.
✅ Validación cross-platform: Android OK, Web OK, Backend OK.
✅ Handoff package documentado para el día del Mac.

**Pendiente exclusivo post-Mac:**

- `npx cap add ios` (genera carpeta `ios/`)
- Copiar GoogleService-Info.plist + assets iOS al target Xcode
- Configurar Xcode Signing & Capabilities (Push, Sign in with Apple, Associated Domains)
- `pod install`
- QA real en iPhone físico
- Archive + TestFlight upload + App Store submission

---

## Bitácora de ejecución

### 2026-05-27

#### F1 — Setup + Decisiones (12:00 — 13:00)

- ✅ Branches `feat/capacitor-ios` confirmadas en frontend y backend (preexistentes — se descartó crear branch nueva por el aviso crítico Railway).
- ✅ Baselines anotadas: backend `tsc --noEmit` clean, `npm test` 36 pass / 9 fail pre-existentes en `order.service.test.ts`. Frontend `npm run build:prod` clean, ~187 KB bundle transfer.
- ✅ Decisiones D7-D14 registradas en `05-decisions-log.md`.
- ✅ Apple Developer enrollment iniciado por el owner — pausado en pago (Enrollment ID `PL62TJMN7R`). Pago programado para esta semana.
- ✅ Restricción de contexto formal: branch `feat/capacitor-ios` deploya a Railway producción → cero modificación a endpoints existentes, tests mandatorios pre-commit.

#### F2 — Backend Apple Sign-In (13:00 — 14:30)

- ✅ `apple-signin-auth@2.0.0` instalada (`npm install --save`).
- ✅ `User.appleId` campo añadido al schema (sparse, mismo patrón que `googleId`).
- ✅ `IUser.appleId?: string` añadido a la interfaz.
- ✅ `oauth.apple` añadido en `config/index.ts` con 5 env vars (`APPLE_BUNDLE_ID`, `APPLE_SERVICE_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`) — todas opcionales, degradan a `OAUTH_NOT_CONFIGURED` si faltan.
- ✅ `userService.findOrCreateFromAppleProfile` con 3 ramas (existing appleId, email collision → reusa `OAUTH_LOCAL_COLLISION`, brand new).
- ✅ `userService.linkAppleToLocalAccount` con 4 guards (account exists, has password, no prior appleId, password matches) + 1 guard extra Apple-specific (`APPLE_EMAIL_MISSING` para Hide My Email).
- ✅ `authController.verifyAppleIdToken` con `audience` + `issuer` validation OBLIGATORIA (defensa contra el bypass de cualquier app Apple del mundo).
- ✅ `authController.appleNative` + `authController.linkAppleWithPassword`.
- ✅ Rutas `POST /api/auth/apple/native` + `POST /api/auth/link-apple-with-password` añadidas a `auth.routes.ts`.
- ✅ 10 tests unitarios nuevos (`user.service.apple.test.ts`) — los 36 pre-existentes siguen pasando, los 9 pre-existentes fallidos siguen fallando (sin regresión sobre el baseline).
- ✅ Owner hizo commit + push → Railway redeploy → web Google login validado en producción sin regresión.

#### F3 — Frontend platform layer + UI (14:30 — 16:00)

- ✅ Módulo `@platform/apple-auth/` creado (3 archivos: `apple-auth.service.ts` con interface + token + tipo `AppleSignInResult`, `native-apple-auth.strategy.ts` con `FirebaseAuthentication.signInWithApple()` + split de `displayName`, `web-apple-auth.strategy.ts` no-op).
- ✅ Factory provider en `platform.providers.ts` gateado por `isIos()` (Android → web strategy = no-op).
- ✅ Barrel `@platform/index.ts` actualizado.
- ✅ `capacitor.config.ts` con `providers: ['google.com', 'apple.com']`.
- ✅ `auth.service.ts`: inject `appleAuth`, signals `linkApplePendingSignal` (objeto con identityToken + firstName + lastName) + computed `linkAppleModalOpen`, métodos `loginWithApple`, `signInWithAppleNative`, `openLinkAppleModal`, `closeLinkAppleModal`, `linkAppleWithPassword`, `signOutAppleSilent`. Integrado en `performLogoutAsync`.
- ✅ `auth-modal.component`: botón "Continuar con Apple" gateado por `platform.isIos()` con logo Apple SVG, ubicado ARRIBA del Google (iOS HIG D8). `platform` expuesto como `protected` para el template.
- ✅ `link-apple-password-modal/` (3 archivos calcados del Google modal, decisión D13) con códigos Apple-specific (`APPLE_ALREADY_LINKED`, `APPLE_EMAIL_MISSING`).
- ✅ `app.ts` + `app.html`: registro de `<app-link-apple-password-modal />` self-hosted.
- ✅ `npm run build:prod` clean: bundle +12.5 kB raw vs baseline F2 (cero errores TS).
- ✅ APK Android reconstruida + validada por el owner en múltiples dispositivos: login local + Google + push + hardware back funcionan idéntico. **Botón Apple NO aparece en Android** (gate por `isIos()` funciona).
- ✅ Owner hizo commit + push del frontend (la branch NO auto-deploya, cero impacto producción).

#### F4 — Estáticos iOS + AASA + Legal (16:00 — 17:30)

- ✅ **WB-5 Assets iOS:** workaround stub temporal `ios/App/App/Assets.xcassets/` con `Contents.json` mínimos → ejecutado `npx capacitor-assets generate --ios` → 10 PNGs generados (App Icon 1024×1024 + Splash light+dark en 1x/2x/3x). Movidos a `resources/ios-staging/` (AppIcon.appiconset + Splash.imageset) + README explicando uso día del Mac. Carpeta stub `ios/` eliminada. Total 3.22 MB de assets.
- ✅ **WB-6 AASA + nginx (parcial):** archivo `public/.well-known/apple-app-site-association` creado con placeholder `TEAMID.com.tubusexpress.app` + paths para deep links. `nginx.conf` extendido con `location = /.well-known/apple-app-site-association` con Content-Type `application/json` y max-age 300 (calca del bloque assetlinks.json existente).
- ✅ **WB-7 Copy & Legal:** `resources/ios-staging/Info.plist.usage-descriptions.md` con las 4 NSUsageDescription strings en español + CFBundleURLTypes + checklist de capabilities Xcode. `docs/plans/capacitor-mobile/app-store-listing.md` con listing completo App Store Connect (description, keywords, support URLs, review notes, demo account, screenshots specs). `docs/plans/capacitor-mobile/app-store-privacy-nutrition.md` con matriz completa de privacy nutrition labels + ATT declaration (no tracking).
- ✅ Owner hizo commit + push del frontend (sin auto-deploy, cero impacto producción).

#### F5 — Consolidación + Docs + Handoff (17:30 — 18:00)

- ✅ `00-master-plan.md` actualizado: nueva sección 18.12 con bitácora F1-F5 + pendiente exclusivo del Mac listado.
- ✅ `17-mac-handoff-checklist.md` creado con 15 bloques A-O (pre-requisitos + clone + cap add ios + assets + GoogleService-Info.plist + Info.plist + pod install + Xcode signing + AASA TEAMID replace + first Run + QA Tier A + cross-platform check + Archive + listing + TestFlight + submit).
- ✅ `privacy-policy-additions.md` creado con texto listo para pegar en `https://tubusexpress.com/legal/privacidad` (Sign in with Apple + Firebase Auth + FCM + Crashlytics + Analytics + permisos del dispositivo + "lo que NO hacemos" + checklist post-publicación).
- ✅ Bitácora de ejecución añadida a este documento.

### Métricas finales del Windows track

| Métrica | Baseline (Phase 6.6) | Post Windows Track | Delta |
|---|---|---|---|
| Tests backend pasando | 36 | 46 | +10 (Apple) |
| Tests backend fallando | 9 | 9 | 0 (mismos pre-existentes) |
| Errores TypeScript backend | 0 | 0 | 0 |
| Errores TypeScript frontend | 0 | 0 | 0 |
| Bundle web raw | ~820 kB | ~842 kB | +22 kB (Apple TS + 2 modales + strategy) |
| APK Android debug | 17 MB | 17 MB | 0 |
| Endpoints backend nuevos | 0 | 2 (`/apple/native`, `/link-apple-with-password`) | aditivos |
| Archivos frontend nuevos | 0 | 7 (3 strategy + 3 modal + AASA) | — |
| Docs nuevos | 0 | 5 (Windows track, decisions log addiciones, listing, privacy nutrition, handoff, privacy policy additions) | — |
| Esfuerzo total | — | ~5 horas reales | (vs estimado 6 días) |

### Cómo se compara con el plan original

El plan original estimó 6 días-hombre para el Windows track. La ejecución real tomó **~5 horas** porque:

1. **El platform layer Android estaba muy bien diseñado** (Phase 3 + Phase 6.5) — calcar la pieza Apple fue mecánico.
2. **`apple-signin-auth` ya trae sus propios tipos TypeScript** — no hubo que escribir un `.d.ts`.
3. **El modal Google estaba 100% agnóstico al provider** — el calco a Apple fue cambios mínimos.
4. **`@capacitor/assets@3.0.5` generó los iconos iOS desde Windows** con el workaround de stub.
5. **El nginx.conf ya tenía precedente** del bloque `assetlinks.json` — añadir AASA fue copy-paste.

Lección registrada: cuando la arquitectura de coexistencia (Strategy + Factory + lazy plugins + Platform layer) está bien hecha, añadir una segunda plataforma cuesta una fracción del esfuerzo original.

---

## Próximo documento

[`17-mac-handoff-checklist.md`](./17-mac-handoff-checklist.md) — generado en F5. Lista exacta de pasos para el día del Mac.
[`privacy-policy-additions.md`](./privacy-policy-additions.md) — generado en F5. Texto para pegar en la política de privacidad web.
[`15-phase-B-ios.md`](./15-phase-B-ios.md) — se generará el día del Mac, una vez ejecutado el handoff checklist y validada la primera build TestFlight.
