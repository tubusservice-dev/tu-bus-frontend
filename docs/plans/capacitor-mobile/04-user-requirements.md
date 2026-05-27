# 04 — Lo que Necesito de Tu Lado

> **Status:** Action items para el owner del proyecto
> **Purpose:** lista exhaustiva de cuentas, credenciales, decisiones y accesos que necesito proveer para que la implementación de Capacitor + Android pueda ejecutarse sin bloqueos.
> **Audiencia:** tú (owner del proyecto). Cuando me autorices a empezar, este documento es la lista que iremos marcando juntos.

---

## Estructura del documento

1. **🚦 Decisiones que tienes que tomar AHORA** — sin esto no puedo arrancar Phase 0.
2. **🔑 Credenciales y accesos que necesito** — me los compartes uno a uno conforme avancemos.
3. **🛠️ Software y hardware en tu workstation** — instalas tú; te asisto en el setup.
4. **📲 Pruebas en dispositivo físico** — necesitas un teléfono Android para QA.
5. **💰 Costos involucrados** — para que no haya sorpresas.
6. **🤝 Acuerdo de comunicación** — cómo coordinamos la ejecución.

---

## 1. 🚦 Decisiones que Tienes que Tomar AHORA

Estas decisiones son **bloqueantes**. Necesito tu respuesta a cada una antes de empezar Phase 0. Marco con (R) la opción que recomiendo profesionalmente.

### Decisión 1.1 — Package name de la app Android

El package name es el identificador único de tu app en Google Play y en el dispositivo. **No se puede cambiar después de publicar la primera versión.**

| Opción | Justificación |
|---|---|
| (R) `com.tubusexpress.app` | Convención estándar reverse-domain, alineada con el dominio actual |
| `com.tubus.express` | Alternativa más corta |
| `com.tubusexpress` | Sin sufijo `.app` — válido pero menos convencional |
| Otro: _______________ | Tu propuesta |

**Tu respuesta:** ____________________

---

### Decisión 1.2 — Min SDK Android (versión mínima soportada)

Determina qué dispositivos pueden instalar tu app.

| Opción | Cobertura mercado | Justificación |
|---|---|---|
| (R) API 23 (Android 6.0) | ~99% dispositivos activos | Estándar de la industria. Cubre Venezuela (alto uso de Android antiguo) |
| API 26 (Android 8.0) | ~95% | Simplifica algunos plugins (notification channels, etc.) |
| API 28 (Android 9.0) | ~90% | Permite usar BiometricPrompt directamente |
| API 30 (Android 11) | ~75% | Solo si quieres features modernas |

**Tu respuesta:** ____________________

> **Mi recomendación:** API 23. Para el segmento venezolano es lo más sensato.

---

### Decisión 1.3 — Esquema de Biometría

Cuando el usuario se loguea, ¿queremos ofrecerle biometría (huella/face) para re-autenticarse rápido?

| Opción | Pros | Contras | Esfuerzo |
|---|---|---|---|
| **A — Solo flag local** | Simple. Tras boot con biometría exitosa, levantamos el JWT de Preferences sin pedir password. | Si alguien roba el dispositivo desbloqueado, accede a la app. | Bajo (1 día) |
| (R) **B — Round trip al backend** | El JWT se borra al cerrar app. Tras biometría exitosa, se pide nuevo JWT al backend con un `biometric_credential_token` opaco. Más seguro. | Requiere endpoint nuevo backend. | Alto (2-3 días) |
| **C — No implementar biometría en v1** | Cero esfuerzo. UX: pedimos password siempre. | Fricción usuario. | Cero |

**Tu respuesta:** ____________________

> **Mi recomendación:** Opción A para v1, evolucionar a B en v2. El costo/beneficio de A es excelente para una app comercial.

---

### Decisión 1.4 — Reverse Geocoding (para feature "Usar mi ubicación")

Cuando el usuario tap "Usar mi ubicación" en el zoning modal, necesitamos convertir lat/lng → ciudad + municipio.

| Opción | Costo mensual | Precisión | Mantenimiento |
|---|---|---|---|
| **A — Google Maps Geocoding API** | ~$5/mes con uso bajo (~10k requests) | Excelente | Cero — Google lo mantiene |
| (R) **B — Bounding boxes propias** | $0 | Buena para Venezuela (ciudades grandes) | Manual: actualizar coords si añades ciudades |
| **C — Diferir a v2** | $0 | — | El feature se posterga |

**Tu respuesta:** ____________________

> **Mi recomendación:** B para v1. Venezuela tiene ~30 ciudades principales; un dataset de bounding boxes manual es trivial.

---

### Decisión 1.5 — Forced Updates (obligar a actualizar la app)

¿Implementamos un mecanismo desde v1 para forzar actualizaciones cuando hagamos cambios breaking?

| Opción | Justificación |
|---|---|
| (R) **Sí, desde v1** | Te permite hacer breaking changes en backend con confianza. ~0.5 día implementar. |
| **No, evaluar después** | Si no esperas hacer breaking changes pronto, puedes diferirlo |

**Tu respuesta:** ____________________

> **Mi recomendación:** Sí. Es una salvaguarda barata.

---

### Decisión 1.6 — Live Updates (parches sin pasar por Play Store)

Capgo / Ionic Appflow permiten desplegar bundle JS/HTML/CSS a apps instaladas sin pasar por revisión de Play.

| Opción | Costo | Pros | Contras |
|---|---|---|---|
| **A — Capgo self-hosted** | $0 (servidor propio) o $12/mes cloud | Ágil para hotfixes | Setup ~1 día |
| **B — Ionic Appflow** | Desde $499/mes | Soporte enterprise | Caro |
| (R) **C — Diferir a v2** | $0 | Lanzar v1 sin esto, evaluar tras 1-2 meses de uso | Las correcciones requieren nuevo release de Play |

**Tu respuesta:** ____________________

> **Mi recomendación:** C. No vale la pena complicar v1. Si tras 2 meses ves que necesitas patches frecuentes, agregamos Capgo.

---

### Decisión 1.7 — App Signing en Play Store

Google ofrece "Play App Signing": ellos guardan tu keystore privado de release y firman cada AAB que subes. Tú subes con un upload key.

| Opción | Pros | Contras |
|---|---|---|
| (R) **Activar Play App Signing** | Si pierdes tu upload key, Google lo regenera. Más seguro. | Vendor lock-in con Google |
| **Self-managed keystore** | Control total | Si pierdes el keystore = imposibilidad de actualizar la app PARA SIEMPRE |

**Tu respuesta:** ____________________

> **Mi recomendación:** Play App Signing. Es la opción default de Google y reduce drásticamente el riesgo de pérdida.

---

### Decisión 1.8 — Distribución

¿Solo Play Store o también APK directo en `tubusexpress.com`?

| Opción | Pros | Contras |
|---|---|---|
| **A — Solo Play Store** | Updates automáticos. Confianza usuario. | Tarda 1-3 días en revisión. Comisión 15% en compras in-app (no aplica acá). |
| **B — Solo APK directo** | Control total, deploy inmediato | Usuario tiene que activar "instalar de fuentes desconocidas" |
| (R) **C — Ambos** | Lo mejor de ambos: Play como canal principal, APK directo como backup / beta | Mantener ambos |

**Tu respuesta:** ____________________

> **Mi recomendación:** C. Empezar solo con APK directo en internal testing mientras se prepara el listing de Play. Play queda como canal principal a futuro.

---

### Decisión 1.9 — Crashlytics

Firebase Crashlytics te muestra en tiempo real qué crashes están ocurriendo en producción.

| Opción | Costo | Justificación |
|---|---|---|
| (R) **Activar desde v1** | $0 | Visibilidad crítica. Sin esto, no sabes qué se rompe en celulares de usuarios. |
| **No** | $0 | Solo si ya tienes otra herramienta (Sentry, Bugsnag) |

**Tu respuesta:** ____________________

> **Mi recomendación:** Sí.

---

### Decisión 1.10 — Analytics

| Opción | Costo | Pros |
|---|---|---|
| (R) **Firebase Analytics** | $0 | Gratis, integrado con Crashlytics |
| **Mixpanel** | Plan free hasta 100k MTU | Mejor segmentación |
| **No analytics en v1** | $0 | Decisión de privacidad |

**Tu respuesta:** ____________________

> **Mi recomendación:** Firebase Analytics. Cero costo, te da datos útiles desde día 1.

---

### Decisión 1.11 — Plugin de Google Auth

Existen dos paquetes serios para Google Sign-In nativo en Capacitor:

| Paquete | Mantenimiento | Justificación |
|---|---|---|
| (R) `@capacitor-firebase/authentication` | Robingenz, activo, integrado con Firebase | Si ya usas Firebase (lo haces), es la opción coherente |
| `@codetrix-studio/capacitor-google-auth` | Comunidad, activo | Más simple si NO usas Firebase Auth |

**Tu respuesta:** ____________________

> **Mi recomendación:** El primero (Firebase). Tu proyecto ya tiene Firebase configurado para FCM; reutilizar el mismo SDK simplifica.

---

### Decisión 1.12 — Plugin de FCM

| Paquete | Mantenimiento | Justificación |
|---|---|---|
| (R) `@capacitor-firebase/messaging` | Robingenz, activo, simétrico con auth | Mismo proveedor que el plugin de auth |
| `@capacitor/push-notifications` | Capacitor oficial | Más genérico (también soporta APNS), pero menos integrado con FCM |

**Tu respuesta:** ____________________

> **Mi recomendación:** El primero (Robingenz Firebase Messaging).

---

## 2. 🔑 Credenciales y Accesos que Necesito

A medida que avanzamos, te iré pidiendo cada uno de estos. **No me los compartas en chat público** — cuando llegue el momento, te indico cómo (vault interno, archivo cifrado, env var de Railway, etc.).

### Phase 0 — Pre-requisitos

| # | Item | Cuándo | Cómo lo proveas |
|---|---|---|---|
| 2.1 | Acceso al dashboard de **Firebase Console** del proyecto `tubusexpress` | Phase 0 | Añadir mi email como editor del proyecto |
| 2.2 | Acceso al **Google Cloud Console** del mismo proyecto (necesario para OAuth client IDs) | Phase 0 | Añadir mi email como Project Editor |
| 2.3 | Acceso al **dashboard de Railway** (para añadir env vars al backend) | Phase 2 | Añadir mi email como collaborator |
| 2.4 | Acceso al **registrar de DNS** de `tubusexpress.com` (necesario para servir `assetlinks.json`) | Phase 4 | Tu provider DNS — Cloudflare, Namecheap, etc. |

### Phase 1 — Bootstrap

| # | Item | Cuándo | Notas |
|---|---|---|---|
| 2.5 | Confirmación del **package name** (Decisión 1.1) | Phase 1 | Bloqueante para `npx cap init` |

### Phase 2 — Backend

| # | Item | Cuándo | Notas |
|---|---|---|---|
| 2.6 | Permiso para añadir env var **`CORS_ORIGINS`** ampliada en Railway | Phase 2 | Aditivo, no destructivo |
| 2.7 | Permiso para crear endpoint **`POST /api/auth/google/native`** | Phase 2 | Aditivo |
| 2.8 | Permiso para añadir dependencia **`google-auth-library`** al backend | Phase 2 | Es paquete oficial de Google |

### Phase 4 — Migraciones

| # | Item | Cuándo | Cómo |
|---|---|---|---|
| 2.9 | Acceso para subir `assetlinks.json` a `https://tubusexpress.com/.well-known/assetlinks.json` | Phase 4 | Lo añadimos al `nginx.conf` o servimos como asset estático |
| 2.10 | OAuth Client ID **Android** (creado en Google Cloud Console) | Phase 2-4 | Lo creamos juntos |
| 2.11 | OAuth Client ID **Web** (puede que ya exista) | Phase 2 | Verificar que existe |
| 2.12 | `google-services.json` (descarga del Firebase Console tras registrar app Android) | Phase 1 | Va al `android/app/` (no commitear) |

### Phase 7 — Release

| # | Item | Cuándo | Notas |
|---|---|---|---|
| 2.13 | Cuenta de **Google Play Developer** ($25 one-time fee) — solo si publicarás en Play | Phase 7 | Tu cuenta Google personal o de empresa |
| 2.14 | Decisión sobre **Play App Signing** (Decisión 1.7) | Phase 7 | Si activas, Google guarda el release keystore |
| 2.15 | **Keystore de release** (lo generaré, lo guardas tú) | Phase 7 | Backup OBLIGATORIO en lugar seguro |
| 2.16 | Contraseñas del keystore (3: storePassword, keyPassword, alias) | Phase 7 | Vault personal |

### Para Listing en Play Console (si optas por publicar)

| # | Item | Cuándo |
|---|---|---|
| 2.17 | **Logo cuadrado 1024x1024** alta resolución (puede ser el actual `icon-512.png` upscale) | Phase 7 |
| 2.18 | **Feature graphic 1024x500** para banner del listing | Phase 7 |
| 2.19 | **5+ screenshots de la app** (1080x1920 vertical) | Phase 7 |
| 2.20 | **Descripción corta** (≤80 chars) en español | Phase 7 |
| 2.21 | **Descripción larga** (≤4000 chars) en español | Phase 7 |
| 2.22 | URL de **política de privacidad** (probablemente `https://tubusexpress.com/legal/privacidad`) | Phase 7 |
| 2.23 | Categoría primaria (**Compras**) y secundaria (**Auto y vehículos**) | Phase 7 |
| 2.24 | Información de contacto (email + teléfono opcional) para Play | Phase 7 |
| 2.25 | Rating de contenido (cuestionario IARC: PG, 12+, etc.) | Phase 7 |

---

## 3. 🛠️ Software y Hardware en Tu Workstation

Para que puedas correr la app localmente y hacer ajustes tras el handoff:

| # | Software | Por qué | Dificultad |
|---|---|---|---|
| 3.1 | **JDK 17** (OpenJDK Temurin) | Requerido por Gradle/Android | Trivial — instalador |
| 3.2 | **Android Studio Hedgehog+** | IDE + SDK + emulador | Medio — descarga 4 GB |
| 3.3 | **Android SDK Platform 34** + Build Tools 34 | Requerido para compilar | Se baja desde Android Studio |
| 3.4 | **Android Emulator AVD** Pixel 7 API 34 (opcional) | Para probar sin dispositivo físico | Auto desde Android Studio |
| 3.5 | **Variables de entorno**: `JAVA_HOME`, `ANDROID_SDK_ROOT` en PATH | Capacitor las usa | Setup manual |

> **Espacio en disco estimado:** ~12 GB (Android Studio + SDK + AVD + Gradle cache).

> **Tiempo estimado de setup:** ~2 horas (mayoría es descarga).

Te asistiré paso a paso cuando llegue el momento (Phase 0).

---

## 4. 📲 Pruebas en Dispositivo Físico

Necesitamos al menos **un dispositivo Android físico** para QA real. El emulador NO replica:

- Push notifications con app force-stopped (sí en emulador con Google APIs, pero comportamiento difiere).
- GPS realista.
- Biometría (huella).
- Performance real en chips ARM modestos.
- WhatsApp / Tel: el emulador no tiene SIM ni WhatsApp instalado.

### Matriz de dispositivos ideal (según `00-master-plan.md` sec 12.2)

| Tier | Modelo objetivo | API Android | Quién provee |
|---|---|---|---|
| **A (alto)** | Pixel / Samsung Galaxy S22+ / similar | API 34 | Tu dispositivo personal o gama alta accesible |
| **B (medio)** | Xiaomi Redmi Note 10 / Samsung A50/A52 | API 30-31 | El más común en tu mercado — esencial |
| **C (bajo)** | Cualquier Android API 23-26 con 2 GB RAM | API 23 | Dispositivo viejo de la oficina o usuario beta |

### Lo que necesitamos del dispositivo

1. **USB cable** para conectarlo al workstation.
2. **Activar "Opciones de desarrollador"**: ajustes → acerca de → tap 7 veces en "Número de compilación".
3. **Activar "Depuración por USB"** dentro de Opciones de desarrollador.
4. Aceptar el prompt de "permitir depuración USB" cuando conectes al PC.

### Si no tienes los 3 tiers

- **Mínimo absoluto:** Tier A o B (para validar el happy path).
- **Recomendado:** A + B.
- **Ideal:** A + B + C.

Si no consigues Tier C, podemos pedir a un beta tester (familiar / empleado) probar en su dispositivo.

---

## 5. 💰 Costos Involucrados

Lista exhaustiva. Sin sorpresas.

| Item | Costo | Quién paga | Notas |
|---|---|---|---|
| Google Play Developer Account | **$25 USD una vez** | Tú | Solo si publicas en Play. Si solo distribuyes APK directo, $0. |
| Firebase (FCM, Auth, Crashlytics, Analytics) | **$0** | — | Plan Spark gratis cubre uso esperado. Si superan los límites generosos del plan free, suben a Blaze (pay-as-you-go ~ centavos/mes). |
| Google Cloud OAuth | **$0** | — | OAuth Client IDs son gratis |
| Google Maps Geocoding API (si eliges Decisión 1.4 opción A) | **~$5/mes** | Tú | Solo si activas reverse geocoding pago |
| Capgo (live updates) si eliges Decisión 1.6 opción A cloud | **~$12/mes** | Tú | Diferido a v2 — recomendado |
| Capacitor + plugins | **$0** | — | Open source |
| Hardware: dispositivo Android para QA | **$0 - $300** | Tú | Si no tienes uno apto |
| Tiempo desarrollador (yo) | Según acuerdo | — | 4 semanas estimadas |

**Costo mínimo para tener la app v1 publicable:** **$25** (cuenta Play Store).
**Costo recomendado inicial:** **$25 + $0/mes operativo + dispositivo QA** = una sola vez.

---

## 6. 🤝 Acuerdo de Comunicación

### 6.1 Cadencia de avance

Te propongo:

- **Daily async update** (cuando esté trabajando activamente): mensaje breve con qué hice + qué sigue + bloqueos.
- **Weekly sync** (15-30 min): revisión de progreso, decisiones pendientes, demos.

### 6.2 Cómo apruebas y revisas

Cada PR de Capacitor implementation:

1. Yo abro PR con descripción detallada (qué bloques toca, smoke test web ejecutado, screenshots/video si aplica).
2. Tú revisas y apruebas o pides cambios.
3. Mergeas tú (o me autorizas a mergear).

### 6.3 Cuándo te pido decisiones

Cualquier decisión arquitectural fuera del plan documentado → te pregunto antes de proceder. Ejemplos:

- "Encontré que X plugin no es compatible con API 23, ¿bajamos min API o cambiamos plugin?"
- "El backend necesita un cambio que no había previsto, ¿lo hacemos así?"

### 6.4 Bloqueadores

Si algo me bloquea (espero credencial, decisión, acceso), te aviso de inmediato y pauso. No avanzo "creativamente" sin tu OK.

### 6.5 Demos

Al terminar cada Phase importante (1, 4, 5, 6, 7), grabo demo de 2-3 minutos para que veas el progreso sin que tengas que correr nada local.

### 6.6 Escalación

Si encuentro un bug crítico durante la implementación que afecta la web actual (no debería pasar por diseño, pero por si acaso), pauso TODO, te aviso, y arreglamos antes de continuar Capacitor.

---

## Resumen ejecutivo: Lo Mínimo para Empezar

Si quieres arrancar ya, el set mínimo absoluto es:

1. **Decisión 1.1** — package name
2. **Decisión 1.2** — min SDK
3. **Item 2.1** — acceso a Firebase Console
4. **Item 2.2** — acceso a Google Cloud Console
5. **Item 2.3** — acceso a Railway

Con eso puedo arrancar Phase 0 + Phase 1 + Phase 2 inmediatamente. El resto se puede ir resolviendo conforme avance.

---

## Cómo me dices "OK, empieza"

Cuando estés listo, contesta este documento marcando tus decisiones (o respondes en chat: "Decisión 1.1 = X, Decisión 1.2 = Y, ..."). Yo confirmo que tengo todo lo que necesito y procedo con Phase 0.

> **Recordatorio:** después de implementar todas las fases, voy a re-ejecutar las **122 acceptance criteria** del documento `02-block-baseline-tests.md`. Cualquier regresión la marco y la arreglo antes de considerar la implementación terminada.

---

## Próximo documento

[`00-master-plan.md`](./00-master-plan.md) — el plan maestro (a actualizar con referencias a estos documentos).
