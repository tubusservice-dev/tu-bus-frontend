# Fase 6 — Frontend integration

**Objetivo:** integrar el SDK Firebase y el flujo de tokens con `UserNotificationService` y el equivalente admin. Tras esta fase, el flujo completo funciona: usuario otorga permiso → token registrado en backend → push entregado vía FCM con app cerrada → toast in-app cuando está abierta.

**Esfuerzo estimado:** 1 día.

---

## 6.1 — Modelo y service de DeviceToken (frontend)

### Archivo nuevo: `frontend/src/app/models/device-token.model.ts`

```ts
export interface RegisterDeviceTokenRequest {
  token: string;
  platform?: 'web' | 'android' | 'ios';
  userAgent?: string;
}

export interface RegisterDeviceTokenResponse {
  success: boolean;
  data: { id: string };
}
```

### Archivo nuevo: `frontend/src/app/core/services/device-token.service.ts`

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env';
import {
  RegisterDeviceTokenRequest,
  RegisterDeviceTokenResponse,
} from '@models/device-token.model';

/**
 * Thin HTTP client over /api/device-tokens (and /api/admin/device-tokens).
 * Does not own any state — UserNotificationService and AdminNotificationService
 * orchestrate when to register/unregister.
 */
@Injectable({ providedIn: 'root' })
export class DeviceTokenService {
  private readonly http = inject(HttpClient);

  registerForUser(token: string): Observable<RegisterDeviceTokenResponse> {
    const body: RegisterDeviceTokenRequest = {
      token,
      platform: 'web',
      userAgent: navigator.userAgent,
    };
    return this.http.post<RegisterDeviceTokenResponse>(
      `${environment.apiUrl}/device-tokens`,
      body
    );
  }

  unregisterForUser(token: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${environment.apiUrl}/device-tokens/${encodeURIComponent(token)}`
    );
  }

  registerForAdmin(token: string): Observable<RegisterDeviceTokenResponse> {
    const body: RegisterDeviceTokenRequest = {
      token,
      platform: 'web',
      userAgent: navigator.userAgent,
    };
    return this.http.post<RegisterDeviceTokenResponse>(
      `${environment.apiUrl}/admin/device-tokens`,
      body
    );
  }

  unregisterForAdmin(token: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(
      `${environment.apiUrl}/admin/device-tokens/${encodeURIComponent(token)}`
    );
  }
}
```

---

## 6.2 — Cambios en `UserNotificationService` (cliente)

**Archivo:** `frontend/src/app/core/services/user-notification.service.ts`

### Imports nuevos

```ts
import { FirebaseMessagingService } from '@core/firebase';
import { DeviceTokenService } from './device-token.service';
import { Subscription } from 'rxjs';
```

### Inyecciones

```ts
private readonly fcm = inject(FirebaseMessagingService);
private readonly deviceTokenService = inject(DeviceTokenService);
private currentToken: string | null = null;
private foregroundSub?: Subscription;
```

### Cambio en `requestNotificationPermission()`

```ts
/**
 * Request browser notification permission and register the FCM token
 * with the backend if granted.
 *
 * Flow:
 *  1. Capability check (Notifications + SW + PushManager available).
 *  2. Request permission via Notification.requestPermission().
 *  3. On 'granted', call FirebaseMessaging.requestToken() to obtain
 *     the FCM registration token (the SDK ensures the SW is registered).
 *  4. POST the token to /api/device-tokens.
 *  5. Wire up the foreground onMessage listener.
 *  6. Adjust polling interval (longer when push is active).
 *
 * Silent fail on every step — the polling fallback keeps the UI in sync
 * even if FCM never works on this browser.
 */
async requestNotificationPermission(): Promise<void> {
  if (!this.fcm.isMessagingSupportedSync()) {
    // iOS Safari without PWA installed lands here. UI handles it elsewhere.
    return;
  }
  if (!('Notification' in window)) return;

  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {
      return;
    }
  }

  if (Notification.permission !== 'granted') return;

  // Permission granted — obtain and register FCM token.
  const token = await this.fcm.requestToken();
  if (!token) return;

  // Register with backend. Idempotent — backend uses upsert by token.
  this.deviceTokenService.registerForUser(token).subscribe({
    next: () => {
      this.currentToken = token;
      this.attachForegroundListener();
      this.adjustPollingInterval();
    },
    error: (err) => {
      console.warn('[UserNotificationService] Failed to register FCM token:', err);
      // Token registration failed but polling fallback continues.
    },
  });
}

private attachForegroundListener(): void {
  if (this.foregroundSub) return;  // idempotent
  this.foregroundSub = this.fcm.onForegroundMessage$.subscribe((payload) => {
    // The SDK does NOT show the OS notification when the page is in foreground.
    // We handle UX based on visibility:
    //  - Tab visible: silent UI refresh (counter + popover). User already
    //    sees the app — a native toast would be redundant noise.
    //  - Tab hidden (other tab focused): show OS notification manually so
    //    the user notices.
    this.fetchUnreadCount();

    if (document.visibilityState === 'hidden') {
      this.showNativeFromPayload(payload);
    }
  });
}

private showNativeFromPayload(payload: { notification?: any; data?: any }): void {
  const title = payload.notification?.title || 'Nueva notificación';
  const body = payload.notification?.body || '';
  const url = payload.data?.url || '/perfil#notificaciones';

  // Reuse the existing browser-notify util.
  // Import dynamically to avoid pulling the dependency for users who
  // never grant push permission.
  import('@shared/utils/browser-notify.util').then(({ browserNotify }) => {
    browserNotify(title, {
      body,
      icon: '/autobus.png',
      badge: '/autobus.png',
      tag: `user-notif-fg-${Date.now()}`,
      data: { url },
    });
  });
}

private adjustPollingInterval(): void {
  // When FCM token is active, the polling acts only as a backstop for
  // missed pushes. Slow it down to reduce request volume. If the user
  // had no token, the constructor already set the 30 s default.
  this.stopPolling();
  this.startPollingWithInterval(120000);
}

private startPollingWithInterval(ms: number): void {
  this.fetchUnreadCount();
  this.pollSub = interval(ms).subscribe(() => {
    if (this.authService.isAuthenticated()) {
      this.fetchUnreadCount();
    }
  });
}
```

### Refactor: hacer `startPolling` flexible

**Antes:**

```ts
startPolling(): void {
  this.fetchUnreadCount();
  this.pollSub = interval(30000).subscribe(() => {
    if (this.authService.isAuthenticated()) {
      this.fetchUnreadCount();
    }
  });
}
```

**Después:**

```ts
startPolling(): void {
  // Default interval: 30s. requestNotificationPermission() will switch to
  // 120s once an FCM token is successfully registered.
  this.startPollingWithInterval(30000);
}
```

### Nuevo: cleanup en logout

Exponer un método público `unregisterToken()` que el `AuthService` llame en logout:

```ts
async unregisterToken(): Promise<void> {
  if (!this.currentToken) return;
  try {
    await firstValueFrom(
      this.deviceTokenService.unregisterForUser(this.currentToken)
    );
  } catch (err) {
    console.warn('[UserNotificationService] Failed to unregister token on logout:', err);
  }
  this.currentToken = null;
  this.foregroundSub?.unsubscribe();
  this.foregroundSub = undefined;
}
```

### Hook en `AuthService.logout()`

**Archivo:** `frontend/src/app/core/services/auth.service.ts`

Antes de limpiar el JWT, llamar al unregister:

```ts
async logout(): Promise<void> {
  // Unregister FCM token BEFORE clearing JWT (the call needs auth)
  try {
    const userNotif = inject(UserNotificationService);  // o la inyección que aplique
    await userNotif.unregisterToken();
  } catch { /* non-blocking */ }

  // Existing logout logic...
}
```

(Ajustar al estilo real del `AuthService` actual — aquí solo se ilustra el orden.)

---

## 6.3 — Cambios en `AdminNotificationsService`

Replicar exactamente el mismo flujo en el servicio admin (`frontend/src/app/core/services/admin-notifications.service.ts` o equivalente):

- Llamar a `requestToken()`.
- Registrar vía `deviceTokenService.registerForAdmin(token)`.
- Suscribir al `onForegroundMessage$` con misma lógica visibility-aware.
- Reducir polling a 120 s.
- Unregister en logout admin.

**Detalle a verificar:** el admin tiene su propio flujo de auth. Asegurar que `requestNotificationPermission()` se llama tras el login admin, no en `app.config.ts` (donde el user puede no estar autenticado todavía).

---

## 6.4 — Cuándo invocar `requestNotificationPermission()`

**Decisión cerrada (D-FE1):** invocar tras el primer login exitoso, no al cargar la app.

**Razón:** pedir permiso de notificaciones es una interacción intrusiva. El usuario lo entiende mejor justo después de loguearse (espera comunicación de la app) que en el primer load (cuando ni siquiera ha visto el contenido).

**Implementación:** en `AuthService.handleLoginSuccess()` (o el hook equivalente), al final del flujo:

```ts
private handleLoginSuccess(user: User): void {
  // ... existing logic (set user, store token, redirect) ...

  // Defer push permission request slightly so the UI renders first.
  setTimeout(() => {
    this.userNotificationService.requestNotificationPermission().catch(() => {
      // silent fail
    });
  }, 1500);
}
```

El `setTimeout(1500)` evita que el prompt nativo aparezca al mismo tiempo que la transición de UI post-login (mejor UX).

---

## 6.5 — UI educativa para iOS sin PWA instalada

Reusar `pwa-install-modal` con copy adaptado.

**Archivo:** `frontend/src/app/shared/components/pwa-install-modal/pwa-install-modal.component.ts`

Agregar un input `mode: 'general' | 'notifications-required'`. Cuando sea `notifications-required`, el copy del modal cambia a algo como:

> "Para recibir notificaciones cuando hay novedades en tu pedido, agrega TuBus Express a tu pantalla de inicio. Toca el ícono de Compartir y selecciona 'Agregar a Inicio'."

**Cuándo dispararlo:**

```ts
// En UserNotificationService.requestNotificationPermission()
if (!this.fcm.isMessagingSupportedSync()) {
  if (this.isIosSafariWithoutPwa()) {
    this.pwaService.showInstallModal({ mode: 'notifications-required' });
  }
  return;
}
```

Helper `isIosSafariWithoutPwa()`:

```ts
private isIosSafariWithoutPwa(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isStandalone = (window.navigator as any).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  return isIos && !isStandalone;
}
```

---

## 6.6 — Manejo del caso `permission === 'denied'`

Si el usuario denegó permisos previamente, el navegador NO volverá a preguntar. La única vía es que el usuario lo cambie manualmente en configuración del navegador.

**UX:** detectar el caso y mostrar un banner suave (no bloqueante):

```ts
if (Notification.permission === 'denied') {
  // No re-prompt possible. Show educational banner once per session.
  this.notificationsBlockedSignal.set(true);
}
```

Componente sugerido: un toast pequeño en `/perfil` con copy:

> "Las notificaciones están bloqueadas. Activa los permisos en la configuración de tu navegador para recibir avisos de tus pedidos."

(Implementación: opcional para esta fase; puede dejarse para una iteración posterior.)

---

## 6.7 — Resumen del flujo completo end-to-end

```
Usuario se loguea en la PWA
            ↓
AuthService.handleLoginSuccess()
            ↓ (setTimeout 1500ms)
UserNotificationService.requestNotificationPermission()
            ↓
isMessagingSupportedSync() → si false (iOS sin PWA): mostrar modal educativo, return
            ↓
Notification.requestPermission() → si denied: banner suave, return
            ↓ (granted)
FirebaseMessaging.requestToken({ vapidKey, swReg })
            ↓
DeviceTokenService.registerForUser(token) → POST /api/device-tokens
            ↓
Backend: DeviceToken upsert by token
            ↓
attachForegroundListener() (onMessage → fetchUnreadCount)
adjustPollingInterval() (30s → 120s)
            ↓
[Más tarde]
            ↓
Backend dispara userNotificationService.create({ ... })
            ↓
UserNotification persistido en Mongo
            ↓
pushService.dispatch({ subjectType: 'user', subjectId, ... })
            ↓
DeviceToken.findBySubject → tokens del user
            ↓
FcmProvider.send → Google FCM → dispositivo del user
            ↓
Si app cerrada → firebase-messaging-sw.js muestra notificación nativa
Si app abierta → onMessage → fetchUnreadCount + (si tab oculta) browserNotify

[Polling cada 120s] → backstop de eventual consistency
```

---

## Criterios de aceptación de la Fase 6

- [ ] Login en frontend → setTimeout → prompt nativo de permisos aparece.
- [ ] Aceptar permisos → token aparece en BD (`DeviceToken` collection).
- [ ] Test: aprobar orden desde admin panel → cliente con app **cerrada** recibe notificación nativa del SO en ~2 s.
- [ ] Test: aprobar orden desde admin panel → cliente con app **abierta y visible** ve solo el badge actualizado, sin toast nativo.
- [ ] Test: aprobar orden desde admin panel → cliente con app **abierta pero pestaña oculta** ve toast nativo + badge actualizado.
- [ ] Logout → token desaparece de BD.
- [ ] Login en otro navegador → segundo token registrado, ambos reciben push.
- [ ] iOS Safari sin PWA instalada → modal educativo aparece, sin error en consola.
- [ ] Polling cuando hay token: 120 s. Polling cuando no hay token: 30 s. Verificar en Network tab.
- [ ] Cero warnings en TypeScript ni en panel Problems.
- [ ] Bundle size razonable: incremento total (Fase 4 + 6) < 200 KB gzip.
