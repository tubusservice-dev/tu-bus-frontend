# Variables de entorno

## Backend

### Variables nuevas

| Variable | Tipo | Obligatoria | Default | Descripción |
|---|---|---|---|---|
| `FIREBASE_PROJECT_ID` | string | Sí (prod) | — | Project ID del proyecto Firebase. Visible en Firebase Console → Project Settings → General. |
| `FIREBASE_CLIENT_EMAIL` | string | Sí (prod) | — | `client_email` del Service Account JSON. Tipo `<algo>@<project-id>.iam.gserviceaccount.com`. |
| `FIREBASE_PRIVATE_KEY` | string | Sí (prod) | — | `private_key` del Service Account JSON. **Multi-línea** — ver formato abajo. |
| `FIREBASE_PUSH_ENABLED` | `'true' \| 'false'` | No | `'true'` | Kill-switch para deshabilitar todo despacho push sin desplegar. Útil en incidentes o staging. |

### Cómo obtener las credenciales

1. Firebase Console → ⚙️ Project Settings → pestaña **Service Accounts**.
2. Botón **"Generate new private key"** → descarga un JSON.
3. Abrir el JSON, copiar:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY`
4. **Eliminar el JSON local** una vez copiado a las envvars. **Nunca** commitearlo.

### Formato de `FIREBASE_PRIVATE_KEY`

El private key contiene saltos de línea (`\n`). Hay dos formas de manejarlo:

**Opción A — escapado en una línea** (recomendado para `.env` files):

```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQI...\n-----END PRIVATE KEY-----\n"
```

El código del backend hace `key.replace(/\\n/g, '\n')` al leerlo.

**Opción B — multilínea real** (Railway, Render, plataformas que soportan multiline secrets):

```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIEvQI...
-----END PRIVATE KEY-----
"
```

El código detecta si tiene `\n` literal o real y normaliza.

### Validaciones agregadas a `validate-env.ts`

```ts
// Pseudo-código de las nuevas validaciones
if (isProd) {
  if (!process.env.FIREBASE_PROJECT_ID) fatal('FIREBASE_PROJECT_ID required in production');
  if (!process.env.FIREBASE_CLIENT_EMAIL) fatal('FIREBASE_CLIENT_EMAIL required in production');
  if (!process.env.FIREBASE_PRIVATE_KEY) fatal('FIREBASE_PRIVATE_KEY required in production');

  if (process.env.FIREBASE_CLIENT_EMAIL && !process.env.FIREBASE_CLIENT_EMAIL.includes('@')) {
    fatal('FIREBASE_CLIENT_EMAIL must be a valid email');
  }

  if (process.env.FIREBASE_PRIVATE_KEY && !process.env.FIREBASE_PRIVATE_KEY.includes('BEGIN PRIVATE KEY')) {
    fatal('FIREBASE_PRIVATE_KEY does not look like a valid PEM key');
  }
}

if (process.env.FIREBASE_PUSH_ENABLED !== undefined &&
    !['true', 'false'].includes(process.env.FIREBASE_PUSH_ENABLED)) {
  fatal('FIREBASE_PUSH_ENABLED must be "true" or "false"');
}
```

### Comportamiento sin credenciales en development

Si las variables están vacías en development:
- `FcmProvider` se construye en estado "disabled".
- Cada `dispatch(...)` retorna inmediatamente sin enviar nada y emite un warning en consola.
- El resto del sistema sigue funcionando: la persistencia Mongo + polling cubren la UI.

Esto permite a un dev nuevo levantar el proyecto sin necesitar Firebase configurado, igual al patrón actual de Resend (`RESEND_API_KEY` vacío → mock provider warnings).

### Ejemplo de `.env` (development)

```env
# === Existentes (sin cambios) ===
NODE_ENV=development
PORT=3003
MONGODB_URI=mongodb://localhost:27017/tu-bus-express-dev
JWT_SECRET=...
RESEND_API_KEY=...

# === Nuevas: Firebase ===
FIREBASE_PROJECT_ID=tubus-express-dev
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@tubus-express-dev.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQI...\n-----END PRIVATE KEY-----\n"
FIREBASE_PUSH_ENABLED=true
```

---

## Frontend

### Filosofía

La config web de Firebase (`apiKey`, `projectId`, etc.) **no es secreta**. Es pública por diseño — Google la expone en el cliente y se autentica vía SHA fingerprints, dominios autorizados y App Check (cuando se active).

Por eso va en `environment.ts` versionado, no en envvars.

### Estructura nueva en `environment.ts`

**Archivo:** `frontend/src/environments/environment.ts`

```ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3003/api',
  appName: 'TuBus Express',
  version: '1.0.0',

  // === NUEVO: Firebase config web ===
  firebase: {
    apiKey: 'AIzaSy...',
    authDomain: 'tubus-express-dev.firebaseapp.com',
    projectId: 'tubus-express-dev',
    storageBucket: 'tubus-express-dev.appspot.com',
    messagingSenderId: '123456789012',
    appId: '1:123456789012:web:abc123def456',
    // measurementId: 'G-XXXXXXXX',  // Opcional — solo si activas Analytics
  },

  // VAPID public key para FCM Web Push.
  // Generada en Firebase Console → Project Settings → Cloud Messaging
  // → Web configuration → "Web Push certificates" → "Generate key pair".
  fcmVapidKey: 'BL...',
};
```

**Archivo:** `frontend/src/environments/environment.prod.ts`

```ts
export const environment = {
  production: true,
  apiUrl: 'https://api.tu-dominio.com/api',
  appName: 'TuBus Express',
  version: '1.0.0',

  firebase: {
    apiKey: 'AIzaSy...',  // diferente al de dev
    authDomain: 'tubus-express-prod.firebaseapp.com',
    projectId: 'tubus-express-prod',
    storageBucket: 'tubus-express-prod.appspot.com',
    messagingSenderId: '987654321098',
    appId: '1:987654321098:web:xyz789ghi012',
  },

  fcmVapidKey: 'BL...',  // VAPID key del proyecto prod
};
```

### Modelo del config (TypeScript)

**Archivo:** `frontend/src/environments/environment.model.ts` (nuevo)

```ts
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

export interface AppEnvironment {
  production: boolean;
  apiUrl: string;
  appName: string;
  version: string;
  firebase: FirebaseWebConfig;
  fcmVapidKey: string;
}
```

(Si ya existe un modelo de environment en el proyecto, extenderlo en lugar de crear nuevo.)

### Recomendación operativa: dos proyectos Firebase

Crear **dos** proyectos en Firebase Console:
- `tubus-express-dev` — usado en development y QA.
- `tubus-express-prod` — usado en production.

**Por qué dos proyectos y no uno:**
- Tokens FCM de dev no contaminan métricas prod.
- Una credencial filtrada en dev no compromete prod.
- Las cuotas (free tier) se calculan por proyecto.
- Permite testear cambios de config (VAPID rotation, App Check) sin riesgo.

---

## Service Worker (`firebase-messaging-sw.js`)

El SW es un archivo **estático** servido desde `/public/`. NO consume `environment.ts` (no tiene acceso al bundle Angular). La config se hardcodea en el SW.

**Problema:** mismo proyecto Firebase para dev y prod no se puede hacer con un solo SW si quieres entornos separados.

**Solución:** generar el SW en build-time vía script Node:

```
frontend/scripts/generate-firebase-sw.js  ← lee environment.ts y emite firebase-messaging-sw.js
```

Lo ejecuta `npm run build` antes de `ng build`. El SW emitido contiene la config correcta del entorno target.

**Detalle de implementación:** ver `08-phase-5-frontend-service-worker.md`.

---

## Resumen del archivo `.env.example` (nuevo)

```env
# Firebase Cloud Messaging
# Required in production. In development, omit to disable push (Mongo + polling still work).
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_PUSH_ENABLED=true
```

(Agregar al `.env.example` existente si lo hay, o crear si no.)
