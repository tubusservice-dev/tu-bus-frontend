# 03 — Estrategia de Coexistencia Web ↔ Nativo

> **Status:** Architecture rationale
> **Purpose:** documentar el porqué arquitectural de cada cambio y cómo garantiza que la web actual NO pierda ninguna funcionalidad ni se vea forzada a re-deploy con riesgo.
> **Audiencia:** desarrolladores, reviewers de PR, futuros mantenedores que necesiten entender por qué el código tiene la forma que tiene.
> **Lectura previa requerida:** `00-master-plan.md`, `01-system-blocks-definition.md`, `02-block-baseline-tests.md`.

---

## Tesis central

La regla más importante de toda esta implementación se resume en una frase:

> **El código web actual debe seguir compilando, deployándose y funcionando IDÉNTICO antes y después de la integración Capacitor. Capacitor SOLO añade caminos alternativos gateados por `Capacitor.isNativePlatform()`, nunca reemplaza el camino web.**

Esto no es opinión: es una restricción técnica que se hace cumplir mediante 5 mecanismos arquitectónicos que se explican en este documento.

---

## Los 5 Mecanismos de Coexistencia

### Mecanismo 1 — Strategy Pattern + Factory Provider (DI runtime)

**Problema que resuelve:** existen comportamientos que difieren entre web y nativo (storage, OAuth, push, links externos, cámara). Si los pongo `if (isNative()) ... else ...` distribuidos en cada servicio, el código se vuelve un pantano de condicionales y las pruebas se duplican.

**Solución:** cada capability con divergencia se modela como una **interface** con dos implementaciones (una web, una nativa). Angular DI elige la implementación correcta UNA VEZ al boot mediante un factory provider que consulta `PlatformService.isNative()`.

**Diagrama:**

```
Component / Otro Service
        │
        │  inject(STORAGE_TOKEN)
        ▼
   StorageService (interface)
        │
        ├── WebStorageStrategy   ← localStorage (cuando isNative=false)
        └── NativeStorageStrategy ← @capacitor/preferences (cuando isNative=true)
```

**Snippet ilustrativo (no es el código final):**

```typescript
export interface IStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export const STORAGE = new InjectionToken<IStorage>('STORAGE');

// app.config.ts
{
  provide: STORAGE,
  useFactory: (platform: PlatformService): IStorage =>
    platform.isNative() ? new NativeStorageStrategy() : new WebStorageStrategy(),
  deps: [PlatformService],
}
```

**Ventajas:**

1. Los componentes consumen `STORAGE` y nunca saben qué estrategia se usa.
2. La estrategia web envuelve `localStorage` con `Promise.resolve(...)` para mantener compatibilidad de signature. Cero cambio de comportamiento web.
3. Los tests pueden mockear `STORAGE` con un fake en memoria — más fáciles que antes.
4. Migrar a otro storage en el futuro (IndexedDB, Capacitor SQLite) requiere solo añadir una nueva strategy.

**Por qué NO se elige la alternativa "if (isNative()) en cada caller":**

- Cada componente termina importando `Capacitor` directamente → bundle web pesa más.
- Los tests deben mockear `Capacitor` global → frágiles.
- DRY violado: la condición se repite en N lugares.
- Refactor futuro requiere tocar N archivos en lugar de 1.

---

### Mecanismo 2 — Lazy import de plugins nativos

**Problema que resuelve:** los plugins de Capacitor ocupan ~100-300 kB cada uno. Si los importo estáticamente (`import { Camera } from '@capacitor/camera'` a top-level), entran al bundle web aunque NUNCA se ejecuten en web. Resultado: usuario web descarga código que jamás corre.

**Solución:** los plugins se importan **dinámicamente dentro de la estrategia nativa**. La estrategia web nunca los referencia.

**Snippet:**

```typescript
// native-storage.strategy.ts
export class NativeStorageStrategy implements IStorage {
  async get(key: string): Promise<string | null> {
    const { Preferences } = await import('@capacitor/preferences');
    const result = await Preferences.get({ key });
    return result.value;
  }
}
```

**Cuando Angular bundlea para web** (no hay `Capacitor.isNativePlatform()` en true), el factory provider devuelve `WebStorageStrategy` y el `NativeStorageStrategy` JAMÁS se instancia. **El bundler trata el `import('@capacitor/preferences')` dentro de un método nunca llamado como dead code → tree-shaking lo elimina.**

> **Nota técnica:** esto requiere que el bundler (esbuild en Angular 20) sepa hacer tree-shaking dinámico. Funciona porque la importación está dentro de un método de una clase que jamás se construye en web. **Auditar con `npm run build:prod && du -sh dist/tubus-express/browser` antes y después de cada plugin agregado.**

**Penalty aceptable:** los `import()` dinámicos generan chunks separados. En nativo, esto es un async load extra al primer uso (~10 ms). Imperceptible.

**Por qué NO se elige la alternativa "import estático global":**

- Bundle web crece linealmente con cada plugin agregado.
- Lighthouse / PageSpeed scores caen.
- Carga inicial más lenta para usuarios web móviles con conexión 3G.

---

### Mecanismo 3 — Backend aditivo, nunca destructivo

**Problema que resuelve:** si el backend cambia un endpoint para soportar la app, los clientes web actuales pueden romperse durante el deploy.

**Solución:** **TODA modificación al backend es aditiva**. Tres reglas:

1. **Endpoints nuevos** coexisten con los viejos. Ejemplo: `POST /api/auth/google/native` se añade; `GET /api/auth/google` (Passport) queda intacto. Los clientes web siguen usando el viejo.

2. **Env vars amplían valores existentes**. `CORS_ORIGINS` añade `capacitor://localhost,http://localhost,https://localhost` al final de los valores actuales. La web sigue siendo aceptada porque su origen está al inicio.

3. **Refactors internos extraen lógica a services compartidos sin cambiar contratos**. Ejemplo: la lógica de las 3 ramas de `passport.ts` se extrae a `userService.findOrCreateFromGoogleProfile()`. `passport.ts` la llama (web). `authController.googleNative` la llama (nativo). Los dos llegan al mismo resultado.

**Mecanismo de validación:**

- Tras cada cambio backend → ejecutar smoke test web (login local + login Google + un POST autenticado).
- Si web falla → el cambio NO es realmente aditivo. Revertir.

**Por qué NO se elige la alternativa "versionar API de cero (`/api/v2`)":**

- Costo enorme: duplicar todos los endpoints.
- Cliente web necesitaría migración masiva.
- No hay beneficio: los contratos no cambian, solo se añaden capabilities.

---

### Mecanismo 4 — Detección de plataforma en UN solo punto

**Problema que resuelve:** llamar a `Capacitor.getPlatform()` desde múltiples sitios fragmenta la lógica. Si Capacitor cambia su API, hay que tocar N lugares.

**Solución:** un único `PlatformService` que expone signals readonly. Todo el resto del código consume signals.

**API completa propuesta:**

```typescript
@Injectable({ providedIn: 'root' })
export class PlatformService {
  // Detección básica (una sola lectura al boot)
  readonly isNative: Signal<boolean>;       // true si Android o iOS
  readonly isAndroid: Signal<boolean>;      // true si Android
  readonly isIos: Signal<boolean>;          // true si iOS (Phase B)
  readonly isWeb: Signal<boolean>;          // true si web

  // Capabilities (poblados async vía APP_INITIALIZER)
  readonly hasBiometrics: Signal<boolean>;  // true si dispositivo soporta biometría
  readonly hasGeolocation: Signal<boolean>; // true si dispositivo permite GPS
  readonly hasCamera: Signal<boolean>;      // true si dispositivo tiene cámara

  // Versión de la app instalada
  readonly appVersion: Signal<string>;      // "1.0.0" o "web"
  readonly buildNumber: Signal<string>;     // "1" o "web"
}
```

**En web,** todos los `has*` son `false`, `appVersion = 'web'`. Ningún componente debe asumir una capability — siempre verifica el signal.

**Ventaja secundaria:** facilita logs / analytics. Cualquier evento se puede etiquetar con `{ platform: this.platform.isNative() ? this.platform.isAndroid() ? 'android' : 'ios' : 'web' }`.

**Por qué NO se elige la alternativa "navigator.userAgent":**

- UA spoofing.
- Capacitor expone un API oficial; usar UA es anti-patrón.
- UA cambia entre versiones de WebView.

---

### Mecanismo 5 — Compatibilidad por Capability Detection

**Problema que resuelve:** algunos features (push, biometría, GPS) pueden no estar disponibles aunque la plataforma sí (usuario denegó permiso, hardware no lo soporta, etc.). El código no debe asumir.

**Solución:** cada servicio expone un método `isAvailable(): Promise<boolean>` que verifica:

1. Plataforma soportada (`isNative` y/o `isWeb`).
2. Hardware/OS lo soporta.
3. Usuario otorgó permiso (si ya se pidió).

Los componentes consultan `isAvailable()` antes de renderizar UI o ejecutar el flujo. Si `false`, fallback graceful (esconder botón, mostrar tooltip "no disponible", etc.).

**Ejemplo de uso:**

```typescript
// push-permission-toggle.component.ts
constructor() {
  effect(async () => {
    this.canShowToggle.set(await this.messagingService.isAvailable());
  });
}
```

**En web:** `messagingService.isAvailable()` devuelve `true` si `Notification`, `serviceWorker`, `PushManager` existen.
**En Android:** devuelve `true` siempre que el plugin esté instalado (Google Play Services suele estar siempre).

---

## Ajustes Detallados por Bloque (con justificación)

A continuación, **cada cambio mencionado en `02-block-baseline-tests.md` se justifica arquitectónicamente y se muestra cómo coexiste con la web.**

### Bloque 1 — Auth Cliente Local

#### Cambio 1.1 — `getToken()` pasa de síncrono a `Promise<string | null>`

**Por qué es necesario:**
- En nativo, `Preferences.get()` es asíncrono.
- Mantener `getToken()` síncrono en web pero async en nativo viola Liskov Substitution: el factory devolvería interfaces distintas según plataforma.

**Cómo coexiste sin romper la web:**
- `WebStorageStrategy.get()` envuelve `localStorage.getItem(key)` con `Promise.resolve(...)`.
- El interceptor `auth.interceptor.ts` pasa de invocar `authService.getToken()` síncronicamente a usar `from(authService.getToken()).pipe(switchMap(token => next(req con header)))`. Para web la promesa resuelve INMEDIATAMENTE en el siguiente microtask — overhead imperceptible (~0.01 ms).
- En la práctica: el usuario web no nota ninguna diferencia.

**Riesgo:**
- Cada lugar que llamaba `getToken()` síncronicamente debe migrar. **Audit con grep**: 1 lugar (interceptor) usa el método, además del propio `AuthService` internamente. Migración trivial.

**Test de no regresión:**
- B1.AC2, B1.AC6, B1.AC7 — todos siguen pasando en web.

---

#### Cambio 1.2 — `auth_token` y `auth_user` migran a `STORAGE` (interface)

**Por qué es necesario:**
- En iOS WebView, `localStorage` es purgable por el SO bajo presión de memoria (R1.1).
- Aunque Phase A es Android (donde localStorage es estable), preparar la abstracción ahora simplifica Phase B.

**Cómo coexiste sin romper la web:**
- Web: `STORAGE` resuelve a `WebStorageStrategy` que es un thin wrapper sobre `localStorage`. Las claves siguen siendo `auth_token`, `auth_user`. Si el usuario abre la app web tras la migración, su sesión persiste sin necesidad de re-login.
- Nativo: `STORAGE` resuelve a `NativeStorageStrategy` que escribe en Android SharedPreferences (cifrado por defecto en Android M+).

**Riesgo:**
- En web, NO se debe escribir en Preferences nativo — `WebStorageStrategy` no carga `@capacitor/preferences`.
- Si por error algún componente importa `Preferences` directamente, el bundle web crece. **Mitigación:** ESLint rule `no-direct-capacitor-imports` (a definir).

**Test de no regresión:**
- B1.AC2, B1.AC6 — sesión persiste tras refresh en web sin pedir login de nuevo.

---

### Bloque 2 — Auth Google y Account Linking

#### Cambio 2.1 — Endpoint nuevo `POST /api/auth/google/native`

**Por qué es necesario:**
- Google bloquea OAuth dentro de WebViews embebidos desde 2021 (error `disallowed_useragent`). El flujo `window.location.href = '/api/auth/google'` que funciona en web FALLA en la app nativa.
- La solución estándar Capacitor: usar Google Sign-In nativo (`@capacitor-firebase/authentication`) que devuelve un `idToken`; el backend lo verifica con `google-auth-library` y emite el JWT correspondiente.

**Cómo coexiste sin romper la web:**
- El endpoint viejo `GET /api/auth/google` (Passport) NO se toca. La web sigue usándolo idéntico.
- El endpoint nuevo `POST /api/auth/google/native` es completamente independiente. Ambos llaman a la misma lógica de creación/lookup de usuario (extraída a `userService.findOrCreateFromGoogleProfile`).
- Refactor pre-condicional: extraer las 3 ramas de `passport.ts` a un service. Esto es un refactor PURO sin cambio de comportamiento — sigue habiendo 3 ramas, mismas decisiones, misma respuesta.

**Riesgo:**
- Si el `idToken` se valida con `audience: clientIdAndroid` y la app envía el web client id (o viceversa), `verifyIdToken` falla. **Mitigación:** aceptar ambos en el array `audience`.
- Si la lógica refactorizada cambia accidentalmente el comportamiento de Passport (web), web Google login se rompe. **Mitigación:** test unitario nuevo cubre las 3 ramas con datos idénticos a los actuales.

**Test de no regresión:**
- B2.AC1 — login Google web pasa idéntico.
- B2.AC4 — colisión local sigue funcionando con redirect.

---

#### Cambio 2.2 — Deep links para email tokens (verify-email, reset-password, verify-account-link, auth/callback)

**Por qué es necesario:**
- Los emails enviados por el backend incluyen URLs `https://tubusexpress.com/verify-email?token=...`. En el dispositivo del usuario, tap en el link abre el navegador (Chrome, Samsung Internet, etc.) — NO la app nativa.
- Para que la app reciba estos eventos, Android necesita Intent Filters declarativos en `AndroidManifest.xml` y la app debe escuchar `App.appUrlOpen`.
- Adicionalmente, para que Android verifique los links como "App Links" (sin pasar por chooser de browser), debe servirse `https://tubusexpress.com/.well-known/assetlinks.json` con el SHA-256 del keystore release.

**Cómo coexiste sin romper la web:**
- Si la app NO está instalada → tap en email link abre Chrome → carga la web normal → flujo de verify-email funciona como hoy.
- Si la app SÍ está instalada → tap en email link abre la app → router navega a la misma ruta (`/verify-email?token=...`) → mismo componente Angular se monta → mismo POST al backend → mismo resultado.
- El backend no nota diferencia: recibe el POST igual que siempre.

**Riesgo:**
- Si el `assetlinks.json` no está bien servido, Android muestra chooser ("Abrir con: Chrome / TuBus Express"). UX degrada pero no rompe.
- `appUrlOpen` puede llegar antes de que Angular Router esté listo. **Mitigación:** encolar la URL hasta que `Router` reporte primer `NavigationEnd`.

**Test de no regresión:**
- B1.AC9, B1.AC10, B2.AC6 — los flujos de email tokens siguen funcionando en web (sin cambios de servidor).

---

### Bloque 3 — Auth Admin

#### Cambio 3.x — NINGUNO

**Por qué:** la decisión arquitectural es que la app móvil v1 NO incluye admin. El usuario móvil no necesita acceder a CRUDs.

**Coexistencia:**
- El bundle nativo INCLUYE el código admin (no se hace tree-shaking selectivo por seguridad — un usuario que navegue manualmente a `/admin/login` ve el form, intenta loguear, recibe redirect).
- En web: cero cambios.

**Decisión de no hacer:** crear una build separada para móvil sin código admin (overkill para v1).

---

### Bloque 4 — Navegación, Catálogo y Detalle de Producto

#### Cambio 4.1 — Hardware back button (Android) sincronizado con `OverlayStackService`

**Por qué es necesario:**
- En Android, el botón físico Atrás dispara el evento `App.backButton` del plugin `@capacitor/app`. NO dispara `popstate` automáticamente — pueden coexistir, pero el flujo nativo es separado.
- Sin gestionarlo, el botón Atrás en la app cierra la app entera incluso cuando hay un overlay abierto.

**Cómo coexiste sin romper la web:**
- En web, este servicio (`BackButtonService`) tiene `init()` no-op (sale al detectar `!isNative()`). El comportamiento del browser back se mantiene gestionado por `popstate` en `OverlayStackService` igual que hoy.
- En nativo, el listener de `App.backButton` delega a `OverlayStackService.goBack()` si hay overlay, sino a `Location.back()`, sino `App.exitApp()`.

**Riesgo:**
- Si el listener no se desuscribe al destroy del servicio, leaks. **Mitigación:** `App.removeAllListeners()` en `ngOnDestroy` (improbable porque el servicio es providedIn root, vive toda la app).

**Test de no regresión:**
- B4.AC6 — browser back en web sigue cerrando overlay y manteniendo scroll.
- B4.AC7 — hardware back en app cierra overlay (nuevo comportamiento, equivalente).

---

#### Cambio 4.2 — `ChunkLoadErrorHandler` queda igual pero gateado en nativo

**Por qué:** en nativo, los chunks JS se empaquetan dentro de la APK. Si por algún error 404 ocurre, recargar la página no soluciona nada (no hay servidor que sirva chunks nuevos).

**Cómo coexiste:**
- Web: igual.
- Nativo: el handler sigue ejecutándose pero `window.location.reload()` solo recarga el WebView con el mismo bundle empaquetado. **Realmente no hace daño**, pero tampoco ayuda. Aceptable como guard preventivo.

**Decisión:** dejar como está. Si genera ruido en logs nativos, gatear con `if (!isNative()) return` en el handler.

---

### Bloque 5 — Carrito y Estado Persistente Local

#### Cambio 5.1 — Cart, theme, location quedan en localStorage en ambas plataformas

**Por qué:**
- No son datos sensibles (no JWTs).
- localStorage en Android WebView es estable (no se purga).
- Migrar a Preferences añadiría complejidad sin beneficio.

**Coexistencia:** trivial — sin cambios.

**Test de no regresión:** B5.AC6, B5.AC9, B5.AC10 — todo funciona igual.

---

#### Cambio 5.2 — `PwaService` se gateifica para no ejecutarse en nativo

**Por qué:**
- En la app nativa, `beforeinstallprompt` jamás se dispara (no hay browser).
- El modal de install / banner de update son sin sentido.

**Cómo coexiste:**
- `PwaService.init()` añade un guard al inicio: `if (this.platform.isNative()) return;`.
- En web: comportamiento idéntico.
- En nativo: el servicio se construye, init() retorna inmediatamente, todos los signals quedan en valores default (`canInstall=false`, etc.). El template `@if (pwaService.showInstallModal())` evalúa false y no renderiza el modal.

**Riesgo:** ninguno.

---

#### Cambio 5.3 — `main.ts registerServiceWorker` NO registra SW en nativo

**Por qué:**
- En la app nativa, registrar `/sw.js` no tiene utilidad (no hay PWA install). Adicionalmente puede confundir el FCM SDK (el SW de FCM es manejado por el plugin nativo, no por Service Workers Web).

**Cómo coexiste:**
- Web: registra SW si `production && pointer:coarse` (mismo comportamiento actual).
- Nativo: añadir guard `if (Capacitor.isNativePlatform()) return;`.

**Riesgo:** ninguno.

---

### Bloque 6 — Checkout, Zoning y Pagos

#### Cambio 6.1 — Cero cambios en Phase 4. Cámara nativa opcional en Phase 5.

**Por qué:**
- En Android, `<input type="file" accept="image/*">` funciona out-of-the-box dentro del WebView (abre el picker del SO).
- Permisos `NSCameraUsageDescription` (iOS) y `<uses-permission android.permission.CAMERA />` (Android) deben declararse aunque solo se use el input file.

**Cómo coexiste sin romper la web:**
- Phase 4: cero cambios al código del checkout. Solo permisos en `AndroidManifest.xml`.
- Phase 5 (opcional): introducir `CameraService` strategy. La estrategia web ejecuta el `<input type="file">` programático actual. La estrategia nativa usa `@capacitor/camera`. **Los componentes solo cambian de `<input file>` a `<button (click)="cameraService.pickImage()">`.**
- Web sigue mostrando el input file estándar.

**Riesgo:** si `Camera.getPhoto` falla en algunos dispositivos, fallback a input file.

---

#### Cambio 6.2 — Zoning modal añade botón "Usar mi ubicación" (Phase 5)

**Por qué:**
- UX: en mobile el usuario espera GPS-driven flow.

**Cómo coexiste:**
- Web: el botón también puede usar `navigator.geolocation.getCurrentPosition` (HTTPS only, funciona en `tubusexpress.com`).
- App: usa `@capacitor/geolocation`.
- El componente expone un `geolocationService` que ambos usan vía interface común.
- Si el usuario rechaza permission o no soporta GPS, el flujo manual sigue disponible (no se reemplaza).

**Riesgo:** ninguno — es feature aditiva.

---

### Bloque 7 — Perfil Cliente y Garaje

#### Cambio 7.x — Avatar puede usar cámara nativa (Phase 5)

**Por qué y cómo coexiste:** igual que checkout proof. Web sigue con input file, nativo gana cámara nativa.

---

### Bloque 8 — Pedidos, Servicios y Reviews

#### Cambio 8.x — NINGUNO en Phase 4

**Por qué:**
- No hay puntos críticos en este bloque.
- Mechanic-progress sigue siendo público vía URL — no se invita al mecánico a la app v1.

---

### Bloque 9 — Notificaciones Push y Comunicación Externa

#### Cambio 9.1 — `FirebaseMessagingService` se factoriza por strategy

**Por qué es necesario:**
- El SDK web `firebase/messaging` requiere Service Workers, VAPID, `Notification` API. Funciona en navegadores pero NO en WebView nativo (especialmente iOS).
- Capacitor expone `@capacitor-firebase/messaging` que usa los SDK nativos de FCM (Android: `firebase-messaging`).

**Cómo coexiste sin romper la web:**
- `MessagingService` (interface) expone: `requestToken()`, `onPushReceived$`, `isAvailable()`.
- `WebMessagingStrategy` envuelve el código actual de `firebase-messaging.service.ts`. Cero cambio funcional para usuarios web.
- `NativeMessagingStrategy` usa el plugin Capacitor.
- El backend recibe el token igual: `POST /api/device-tokens { token, platform: 'web' | 'android', userAgent }`. Firebase Admin envía pushes igual a tokens nativos y web.
- Service Workers `sw.js` y `firebase-messaging-sw.js` siguen siendo servidos por nginx para usuarios web (no se eliminan).

**Riesgo:**
- Token nativo y web son strings de mismo formato (FCM). El backend NO necesita gates por plataforma para `dispatch()`.
- Si en futuro se quiere distinguir (ej. para enviar notificaciones con sound específico Android), el campo `platform` ya existe.

**Test de no regresión:**
- B9.AC1 a B9.AC10 todos pasan en web idéntico.

---

#### Cambio 9.2 — `window.open` se reemplaza por `ExternalLinkService`

**Por qué:**
- En web, `window.open(url, '_blank')` funciona perfecto.
- En nativo Capacitor, `window.open` en un WebView puede:
  - Abrir el link dentro del WebView (rompe UX — el usuario ve la página externa en lugar de WhatsApp).
  - O ser bloqueado por el WebView.
- Solución estándar:
  - Para `tel:`, `mailto:`, `sms:`, `wa.me`: usar `App.openUrl({ url })` que delega al SO (abre el dialer / app nativa correspondiente).
  - Para URLs http(s) generales: usar `Browser.open({ url })` que abre Custom Tabs (Android) — UX in-app premium.

**Cómo coexiste sin romper la web:**
- `ExternalLinkService.open(url, target?)`:
  - Web: ejecuta `window.open(url, target ?? '_blank')` — comportamiento idéntico al actual.
  - Nativo: enruta según prefijo del URL (`tel:|mailto:|sms:|wa.me/` → `App.openUrl`, resto → `Browser.open`).
- Los 7 lugares que hoy usan `window.open` se cambian a `externalLinkService.open(...)`. En web, el resultado es idéntico.

**Riesgo:**
- En web, `window.open(url, '_self')` (usado para `tel:` en algunos lugares) tiene semántica distinta: reemplaza la URL actual. Si el `ExternalLinkService` siempre hace `_blank`, podríamos perder esa diferencia.
- **Mitigación:** el método acepta un parámetro `target?: '_self' | '_blank'` que en web se respeta y en nativo se ignora (el SO decide).

**Test de no regresión:**
- B9.AC12, B9.AC13, B9.AC14, B9.AC15 — todo funciona igual en web.

---

### Bloque 10 — Admin Panel Operacional

#### Cambio 10.x — NINGUNO

**Por qué:** admin no entra en la app v1. Cero modificación.

---

## Tabla maestra de cambios y su impacto en web

| # | Cambio | Bloque | Impacto web | Impacto nativo |
|---|---|---|---|---|
| C1 | `getToken()` → async | B1 | Imperceptible (Promise resuelve en microtask) | Habilita Preferences |
| C2 | Storage abstraction | B1 | Cero cambio funcional | Cifrado nativo |
| C3 | Endpoint OAuth nativo | B2 | Cero (no se usa en web) | Habilita login Google nativo |
| C4 | CORS_ORIGINS amplía | B2 | Cero (web sigue allowed) | Permite requests app |
| C5 | Refactor `passport.ts` → service | B2 | Cero (mismo comportamiento) | Reusable desde controller nativo |
| C6 | Deep links handler | B1, B2 | Cero (no se ejecuta en web) | Habilita email tokens en app |
| C7 | Hardware back service | B4 | Cero (no se ejecuta en web) | Sincroniza con OverlayStack |
| C8 | PwaService gate nativo | B5 | Cero | Evita ejecuciones inútiles |
| C9 | main.ts SW gate nativo | B5 | Cero | Evita registrar SW |
| C10 | MessagingService strategy | B9 | Cero (web envuelve código actual) | FCM nativo |
| C11 | ExternalLinkService | B9 | Cero (web envuelve `window.open`) | App.openUrl / Browser.open |
| C12 | Permisos AndroidManifest | B6, B7 | Cero | Habilita cámara/storage |
| C13 | CameraService (Phase 5) | B6, B7 | Cero (web sigue input file) | Cámara nativa premium |
| C14 | GeolocationService (Phase 5) | B6 | Mejora UX si HTTPS | GPS nativo |
| C15 | BiometricService (Phase 5) | B1 | Cero (no disponible) | Login con huella |
| C16 | Splash + Status Bar | — | Cero | Branding nativo |
| C17 | Capacitor.config.ts | — | Cero (es config nativa) | Configuración Android |

**Conclusión:** **17 cambios identificados, 0 con impacto funcional negativo en web.**

---

## Validación de coexistencia: Smoke Test Web tras cada cambio

Cada cambio backend o frontend debe ir acompañado de un smoke test web:

```
1. Compilar bundle web: npm run build:prod
2. Servir local: serve dist/tubus-express/browser -p 4200
3. Verificar:
   - Landing carga
   - Login local funciona
   - Login Google funciona
   - Catálogo carga productos
   - Add to cart funciona
   - Checkout abre
   - Push toggle funciona
   - Logout funciona
4. Si algo falla → el cambio NO es coexistente. Revertir.
```

Este smoke test debe ejecutarse **antes de cada PR merge**.

---

## Anti-patrones a evitar (lista negra)

Durante la implementación, NUNCA se debe hacer:

1. **`if (typeof Capacitor !== 'undefined')` en componentes/servicios feature.** Usar `PlatformService` siempre.
2. **`import { X } from '@capacitor/y'` a top-level en estrategias web o servicios genéricos.** Solo dentro de estrategias nativas y con `await import(...)`.
3. **Modificar el comportamiento de un endpoint backend existente.** Si necesitas cambiar contrato, crea uno nuevo.
4. **Renombrar claves de localStorage existentes.** Romperás sesiones de usuarios web. Solo añade claves nuevas.
5. **Eliminar `sw.js` o `firebase-messaging-sw.js` del `public/`.** Web los usa.
6. **Cambiar las rutas Angular existentes.** Solo añade nuevas si necesario.
7. **Modificar `auth.guard.ts` para gates por plataforma.** Las reglas de auth son las mismas web y nativo.
8. **Asumir que un plugin Capacitor está disponible.** Siempre verifica `isAvailable()`.
9. **Pedir permisos al boot.** Solo tras user gesture (excepto Notifications cuyo prompt browser ya respeta esa regla).
10. **Olvidar el smoke test web tras cambios.** Cero excepciones.

---

## Garantías que ofrece este diseño

Tras implementar Phase 4 + Phase 5, **garantizamos contractualmente**:

1. ✅ Web sigue compilando con `npm run build:prod` sin warnings.
2. ✅ Web sigue deployando a Railway sin cambio de pipeline.
3. ✅ Web sigue logueando con email/password, Google, admin.
4. ✅ Web sigue recibiendo push notifications.
5. ✅ Web sigue usando localStorage para sesión.
6. ✅ Web sigue mostrando PWA install / update modals.
7. ✅ Web sigue manejando deep links de email (vía URL del browser).
8. ✅ Web sigue funcionando en desktop y mobile browsers.
9. ✅ Backend mantiene 100% de endpoints actuales con misma semántica.
10. ✅ Bundle web no crece más de 30 kB tras la migración (verificar).

Y la app nativa **adicionalmente** ofrece:

11. ✅ Login Google con cuenta nativa del dispositivo.
12. ✅ Push notifications confiables en background.
13. ✅ Deep links que abren la app cuando está instalada.
14. ✅ JWT en storage cifrado.
15. ✅ Hardware back button funciona.
16. ✅ WhatsApp / tel se abre con la app nativa correspondiente.
17. ✅ Splash screen y status bar branded.
18. ✅ (Phase 5) Cámara nativa, biometría, GPS.

---

## Próximo documento

[`04-user-requirements.md`](./04-user-requirements.md) — todo lo que necesito de tu lado (cuentas, credenciales, decisiones, accesos) para que la implementación pueda proceder sin bloqueos.
