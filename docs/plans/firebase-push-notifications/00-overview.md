# Firebase Push Notifications — Plan Maestro

**Proyecto:** TuBus Express
**Fecha de creación:** 2026-05-08
**Estado:** Pendiente de aprobación
**Owner técnico:** Tech Lead

---

## Resumen ejecutivo

Integración de Firebase Cloud Messaging (FCM) como canal de transporte real para las notificaciones push del sistema. El proyecto **ya tiene un sistema de notificaciones funcional** basado en persistencia Mongo + polling HTTP cada 30 s + `Notification` API local. Este plan **NO reescribe** ese sistema: lo extiende con un canal de entrega real que funciona con la app cerrada.

La integración se diseña pensando en que Firebase será una **plataforma transversal** del proyecto: hoy push, mañana Analytics. Por eso el bootstrap de Firebase queda centralizado y reusable, no oculto dentro del módulo de push.

---

## Objetivos

1. Entrega real de notificaciones push con **app cerrada** o pestaña en background, en navegadores y dispositivos compatibles.
2. Reusar al 100 % los modelos `Notification` y `UserNotification` existentes y los 14 call sites de negocio que ya disparan `notificationService.create()` y `userNotificationService.create()`.
3. Centralizar el bootstrap de Firebase (back y front) para que futuros servicios (Analytics) reusen la misma instancia sin re-trabajo.
4. Mantener el patrón Provider existente (`IMailProvider` + `ResendProvider`) replicándolo en push para preservar SoC y DIP.
5. Coexistir con el sistema actual de polling HTTP, que pasa a rol de **fallback** para garantizar consistencia de UI cuando un push se pierde.

---

## No-objetivos (alcance excluido explícitamente)

| Excluido | Razón |
|---|---|
| Firebase Authentication | Ya existe sistema JWT + Passport + auth-tokens custom. Migrar sería rehacer el 30 % del backend sin ganancia. |
| Firestore / Realtime Database | Ya existe MongoDB con Mongoose. Mezclar dos fuentes de verdad es anti-patrón. |
| Cloud Storage | Ya existe Cloudinary con transformaciones configuradas. |
| Cloud Functions | Lógica reactiva no requerida; Express + node-cron cubren todos los casos. |
| Firebase Analytics | Se integrará en una fase posterior, **fuera de este plan**, reusando el bootstrap definido aquí. |
| Crashlytics, Performance, Remote Config, App Check | Fuera de alcance hasta nuevo análisis. |

---

## Casos de uso cubiertos

### Caso 1 — Cliente recibe push de avance de orden con app cerrada
Backend dispara `userNotificationService.create({ type: 'order_approved', userId, ... })`.
1. Se persiste el documento `UserNotification` (igual que hoy).
2. El nuevo `pushService.dispatch(...)` busca tokens FCM activos del `userId`.
3. FCM entrega push al dispositivo. El SW del cliente muestra notificación nativa del SO.
4. Click en la notificación abre la PWA en `/perfil#notificaciones`.

### Caso 2 — Admin recibe push de nuevo pedido con panel cerrado
Backend dispara `notificationService.create({ type: 'new_order', ... })`.
1. Se persiste el documento `Notification` (igual que hoy).
2. `pushService.dispatch(...)` resuelve los tokens de **todos los admins activos** con `adminNotifications.browserPush === true`.
3. Fan-out vía FCM. Cada admin recibe push.

### Caso 3 — Cliente recibe push con app abierta en foreground
1. Backend dispara igual que Caso 1.
2. FCM entrega al cliente. Como la pestaña está activa, el SDK dispara `onMessage` (NO ejecuta el SW).
3. La app refresca el contador y, si la pestaña está visible, **no** muestra notificación nativa (evita duplicado). Si la pestaña está oculta (otra tab al frente), sí la muestra.

### Caso 4 — Token FCM caduca silenciosamente
1. Cliente desinstala la PWA o borra datos del navegador.
2. Próximo `pushService.dispatch(...)` falla con `messaging/registration-token-not-registered`.
3. `FcmProvider` captura el error y borra el token de la BD inmediatamente.
4. Ningún efecto sobre el flujo de negocio (la entrega push falla silenciosamente, el documento Mongo ya está persistido y el polling lo recogerá).

### Caso 5 — Usuario iOS sin PWA instalada
1. Cliente abre la web en Safari iOS sin instalarla en home screen.
2. `getToken(...)` falla por restricción de Apple.
3. La app muestra banner educativo (reuso de `pwa-install-modal`) explicando cómo instalar para recibir notificaciones.
4. El polling cada 30 s sigue funcionando como fallback.

---

## Decisiones cerradas

| ID | Decisión |
|----|----------|
| D1 | **Reusar** modelos `Notification` y `UserNotification`. Cero migración de datos. |
| D2 | **Reusar** los 14 call sites de negocio. Cero refactor en `order.service.ts` y `mechanic-assignment.service.ts`. |
| D3 | Patrón Provider espejo de `mail/`: `IPushProvider` + `FcmProvider` + `MockPushProvider` + `PushService`. |
| D4 | Bootstrap Firebase **centralizado** en `backend/src/config/firebase.ts` y `frontend/src/app/core/firebase/`. NO oculto dentro de `FcmProvider`. |
| D5 | Nuevo módulo `device-tokens` polimórfico (`subjectType: 'user' \| 'admin'`). Una sola colección para ambos paneles. |
| D6 | NO agregar campos de tokens al modelo `User`. Separación de concerns: un usuario tiene N dispositivos. |
| D7 | Service Worker de Firebase (`firebase-messaging-sw.js`) **separado** del `sw.js` actual. Coexistencia por scope distinto. |
| D8 | El `notificationclick` handler se **duplica** en ambos SWs (no se intenta deduplicar con `importScripts`). Más simple, más mantenible. |
| D9 | Polling HTTP existente se **conserva** como fallback. Se reduce a 120 s cuando hay token FCM activo; se mantiene 30 s si no hay token. |
| D10 | Despachos de push son **fire-and-forget**. Nunca bloquean la transacción de negocio. |
| D11 | Payload FCM **mixto** (`notification` + `data`). FCM muestra la notificación automáticamente; `data` lleva metadatos para el `notificationclick`. |
| D12 | Tokens muertos se **borran inmediatamente** al detectar `UNREGISTERED` o `INVALID_ARGUMENT`. Cron semanal complementario para tokens con `lastSeenAt > 90 días`. |
| D13 | Toggle `settings.adminNotifications.browserPush` se **conserva** y ahora gobierna también el envío de push real al admin. |
| D14 | `firebase-admin` se inicializa al **arrancar el server** y falla fast si las credenciales son inválidas en producción. |
| D15 | Firebase config web va en `environment.ts` (es config pública, no es secreto). Service Account JSON va **solo** en envvar del backend, nunca en repo. |

---

## Estructura de la documentación

| Archivo | Contenido |
|---|---|
| `00-overview.md` | Este archivo. Resumen, casos de uso, decisiones cerradas. |
| `01-architecture.md` | Diagrama de capas, patrón Provider, separación SoC, integración con sistema actual. |
| `02-data-model.md` | Schema `DeviceToken`, estructura de payload FCM, cambios a settings. |
| `03-environment-variables.md` | Variables nuevas backend y frontend, validaciones, `.env.example`. |
| `04-phase-1-backend-foundation.md` | Bootstrap `config/firebase.ts` + módulo `device-tokens`. |
| `05-phase-2-backend-transport.md` | Capa de transporte: `IPushProvider`, `FcmProvider`, `PushService`. |
| `06-phase-3-backend-integration.md` | Integración con `notificationService.create` y `userNotificationService.create`. |
| `07-phase-4-frontend-firebase-bootstrap.md` | `core/firebase/` + `APP_INITIALIZER`. |
| `08-phase-5-frontend-service-worker.md` | `firebase-messaging-sw.js`, registro, scope, payload handling. |
| `09-phase-6-frontend-integration.md` | Token registration, `onMessage`, reducción de polling, logout. |
| `10-phase-7-hardening-tests-rollback.md` | Cron cleanup, tests unitarios, smoke E2E, plan de rollback, riesgos. |

---

## Estimación de esfuerzo

| Fase | Esfuerzo estimado |
|---|---|
| Fase 1 — Backend foundation | 0.5 día |
| Fase 2 — Backend transport | 1 día |
| Fase 3 — Backend integration | 0.5 día |
| Fase 4 — Frontend bootstrap | 0.5 día |
| Fase 5 — Frontend SW | 0.5 día |
| Fase 6 — Frontend integration | 1 día |
| Fase 7 — Hardening + tests + rollback | 1 día |
| **Total** | **~5 días de trabajo enfocado** |

---

## Pre-requisitos para arrancar la implementación

1. Service Account JSON descargado de Firebase Console → Project Settings → Service Accounts → "Generate new private key". **No commitear.**
2. Web Push certificate (VAPID public key) generado en Firebase Console → Project Settings → Cloud Messaging → Web configuration.
3. Config web obtenida de Firebase Console → Project Settings → General → "Your apps" → Web app: `apiKey`, `authDomain`, `projectId`, `messagingSenderId`, `appId`.
4. Variables de entorno configuradas en `.env` local del backend (ver `03-environment-variables.md`).
5. `npm i firebase-admin` en backend, `npm i firebase` en frontend.
