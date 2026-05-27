# Fase 4 — Frontend Firebase bootstrap

**Objetivo:** dejar listo el bootstrap del SDK Firebase Web en Angular, centralizado y reusable. Al final de esta fase, el SDK Firebase está inicializado en el cliente. **Aún no maneja tokens ni mensajes** — eso es Fase 5 y 6.

**Esfuerzo estimado:** 0.5 día.

---

## 4.1 — Instalar dependencias

```bash
cd frontend
npm install firebase
```

**Versión target:** `^10.x` o `^11.x`. El SDK modular (tree-shakable) reduce el bundle ~70 % comparado con el legado compat.

---

## 4.2 — Estructura de carpetas

```
frontend/src/app/core/firebase/
├── firebase.config.ts                ← initializeApp + accessor del singleton
├── firebase-messaging.service.ts     ← Angular service envoltorio sobre getMessaging
└── index.ts
```

### Por qué bajo `core/firebase/` y no bajo `core/services/`

- `firebase.config.ts` no es un service Angular; es bootstrap puro. Mezclarlo con `services/` ensucia la convención.
- Permite que en el futuro se agreguen `firebase-analytics.service.ts`, `firebase-storage.service.ts` etc. sin saturar `core/services/`.
- Path alias `@core/firebase/*` queda semánticamente claro.

---

## 4.3 — `firebase.config.ts`

**Archivo:** `frontend/src/app/core/firebase/firebase.config.ts`

```ts
import { FirebaseApp, initializeApp, getApp, getApps } from 'firebase/app';
import { environment } from '@env';

/**
 * Initializes the Firebase Web SDK with the project's config.
 *
 * Idempotent: subsequent calls return the existing app instance.
 * Called once at startup via APP_INITIALIZER. Other modules (messaging,
 * future analytics) MUST consume the singleton via `getFirebaseApp()`,
 * never re-initialize.
 */
export const initializeFirebase = (): FirebaseApp => {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(environment.firebase);
};

/**
 * Returns the bootstrapped Firebase app. Throws if `initializeFirebase()`
 * has not been called yet — callers MUST run after APP_INITIALIZER.
 */
export const getFirebaseApp = (): FirebaseApp => {
  if (getApps().length === 0) {
    throw new Error(
      'Firebase has not been initialized. Ensure initializeFirebase() ' +
        'runs in APP_INITIALIZER before consuming the SDK.'
    );
  }
  return getApp();
};
```

---

## 4.4 — `firebase-messaging.service.ts`

**Archivo:** `frontend/src/app/core/firebase/firebase-messaging.service.ts`

```ts
import { Injectable, inject } from '@angular/core';
import {
  getMessaging,
  getToken,
  onMessage,
  type Messaging,
  type MessagePayload,
} from 'firebase/messaging';
import { Observable, Subject } from 'rxjs';
import { environment } from '@env';
import { getFirebaseApp } from './firebase.config';

/**
 * Thin Angular wrapper over firebase/messaging.
 *
 * Responsibilities:
 *   - Lazy-init the Messaging instance after Firebase app is bootstrapped.
 *   - Expose `requestToken()` for token registration.
 *   - Expose `onForegroundMessage$` for handling pushes when the app is open.
 *
 * Does NOT manage token persistence on the backend — that's
 * UserNotificationService / AdminNotificationService responsibility.
 */
@Injectable({ providedIn: 'root' })
export class FirebaseMessagingService {
  private messagingInstance: Messaging | null = null;
  private readonly foregroundSubject = new Subject<MessagePayload>();
  readonly onForegroundMessage$: Observable<MessagePayload> =
    this.foregroundSubject.asObservable();

  /**
   * Returns the FCM token for this browser, or null if:
   *   - Notifications API is unavailable
   *   - User denied permission
   *   - Service Worker registration failed
   *   - Browser does not support Web Push (Safari iOS without PWA installed)
   *
   * Wires up the foreground onMessage listener on first successful call.
   */
  async requestToken(): Promise<string | null> {
    if (!this.isMessagingSupportedSync()) return null;

    try {
      const messaging = this.getMessagingInstance();

      // The SW registration is needed by getToken — it should already be
      // registered by main.ts (firebase-messaging-sw.js). If not, getToken
      // throws and we surface null.
      const swReg = await navigator.serviceWorker.getRegistration(
        '/firebase-cloud-messaging-push-scope'
      );

      const token = await getToken(messaging, {
        vapidKey: environment.fcmVapidKey,
        serviceWorkerRegistration: swReg,
      });

      if (!token) return null;

      // Wire up foreground handler the first time we successfully obtain
      // a token. Idempotent: onMessage attaches a single listener.
      this.attachForegroundListener();

      return token;
    } catch (err) {
      console.warn('[FirebaseMessaging] requestToken failed:', err);
      return null;
    }
  }

  private getMessagingInstance(): Messaging {
    if (!this.messagingInstance) {
      this.messagingInstance = getMessaging(getFirebaseApp());
    }
    return this.messagingInstance;
  }

  private foregroundListenerAttached = false;
  private attachForegroundListener(): void {
    if (this.foregroundListenerAttached) return;
    onMessage(this.getMessagingInstance(), (payload) => {
      this.foregroundSubject.next(payload);
    });
    this.foregroundListenerAttached = true;
  }

  /**
   * Quick capability check — does the browser support Web Push at all?
   * Use before requesting permission so the UI can hide the prompt
   * gracefully on unsupported platforms (iOS Safari without PWA).
   */
  isMessagingSupportedSync(): boolean {
    if (typeof window === 'undefined') return false;
    if (!('Notification' in window)) return false;
    if (!('serviceWorker' in navigator)) return false;
    if (!('PushManager' in window)) return false;
    return true;
  }
}
```

---

## 4.5 — `index.ts`

**Archivo:** `frontend/src/app/core/firebase/index.ts`

```ts
export { initializeFirebase, getFirebaseApp } from './firebase.config';
export { FirebaseMessagingService } from './firebase-messaging.service';
```

---

## 4.6 — Wire-up en `APP_INITIALIZER`

**Archivo:** `frontend/src/app/app.config.ts`

Agregar el factory de inicialización:

```ts
import { initializeFirebase } from '@core/firebase';

/**
 * Initializes the Firebase Web SDK. Non-blocking — the SDK boots
 * synchronously and the app continues. Push registration happens
 * later in UserNotificationService when the user is authenticated.
 */
function initializeFirebaseSdk(): () => void {
  return () => {
    try {
      initializeFirebase();
    } catch (err) {
      // Should not happen — initializeApp throws only on invalid config.
      console.error('[App] Firebase initialization failed:', err);
    }
  };
}
```

Y registrar en el array de providers:

```ts
providers: [
  // ... existing providers ...
  {
    provide: APP_INITIALIZER,
    useFactory: initializeFirebaseSdk,
    multi: true,
  },
  // initializeAuth, initializeSettings, initializePwa siguen como están
],
```

**Orden recomendado de los APP_INITIALIZERs:**
1. `initializeFirebaseSdk` (primero — sincronizado, casi instantáneo).
2. `initializeAuth`.
3. `initializeSettings`.
4. `initializePwa`.

Razón: el push depende de que Firebase exista cuando otros services se construyan. No hay race condition porque `initializeFirebase` es síncrono.

---

## 4.7 — Verificación visual rápida

Tras esta fase, agregar un log temporal en `app.component.ts` (o equivalente):

```ts
import { getFirebaseApp } from '@core/firebase';

ngOnInit() {
  console.log('[App] Firebase app:', getFirebaseApp().name, getFirebaseApp().options.projectId);
}
```

Salida esperada en consola del navegador: `[App] Firebase app: [DEFAULT] tubus-express-dev` (o el projectId que corresponda al entorno).

**Eliminar el log antes de cerrar la fase.**

---

## Criterios de aceptación de la Fase 4

- [ ] `npm run start` levanta el frontend sin errores.
- [ ] No hay errores de TypeScript ni warnings de Angular en consola.
- [ ] La consola del navegador muestra que Firebase se inicializa sin errores.
- [ ] Bundle size: el aumento es razonable (~50-100 KB gzip por `firebase/app` + `firebase/messaging`). Si supera los 200 KB, revisar tree-shaking.
- [ ] El path alias `@core/firebase` resuelve correctamente.
- [ ] `FirebaseMessagingService.isMessagingSupportedSync()` devuelve `true` en Chrome/Edge desktop, `false` en Safari iOS sin PWA instalada.
