# 06 — Phase 0: Pre-requisitos del Entorno

> **Status:** ⏳ EN EJECUCIÓN (iniciada 2026-05-15)
> **Owner:** Luis V (workstation Windows)
> **Objetivo:** dejar el workstation y los servicios externos listos para compilar la app Android. **Cero código del proyecto se modifica en esta fase.**
> **Entry criteria:** las 12 decisiones cerradas (`05-decisions-log.md`) + autorización formal del owner ✅
> **Exit criteria:** todas las tareas marcadas ✅ y `npx cap doctor` (cuando se instale Capacitor en Phase 1) reporta entorno OK
> **Lectura previa:** `00-master-plan.md` sec 6, `05-decisions-log.md`

---

## Tabla de tareas

| # | Tarea | Status | Validación |
|---|---|---|---|
| 0.1 | JDK 17 disponible | ✅ Pre-completado | Viene con Android Studio en `C:\Program Files\Android\jdk\` |
| 0.2 | Setear `JAVA_HOME` apuntando al JDK 17 + actualizar PATH | ⏳ **A EJECUTAR** | `echo $env:JAVA_HOME` y `java -version` muestran 17.x |
| 0.3 | Android Studio instalado | ✅ Pre-completado | `C:\Program Files\Android\Android Studio\bin\studio64.exe` existe |
| 0.4 | Android SDK Platform 34 + Build Tools 34 instalados | ⏳ **A VERIFICAR** | Visibles en SDK Manager |
| 0.5 | Setear `ANDROID_SDK_ROOT` env var + PATH | ⏳ **A EJECUTAR** | `adb version` funciona desde PowerShell |
| 0.6 | Aceptar todas las licencias Android | ⏳ **A EJECUTAR** | `sdkmanager --licenses` → todos `Y` |
| 0.7 | (Opcional) Crear AVD para emulador | ⏳ Skip si no necesario | Tenemos POCO físico — AVD es backup |
| 0.8 | Dispositivo Android físico disponible | ✅ Pre-completado | POCO X4 Pro 5G, Android 13 |
| 0.9 | Activar Developer Options + USB Debugging en POCO | ⏳ **A EJECUTAR** | `adb devices` lista el dispositivo como `device` (no `unauthorized`) |
| 0.10 | Firebase Console — proyecto accesible | ✅ Pre-completado | Vía guía 2026-05-15 |
| 0.11 | App Android registrada en Firebase | ✅ Pre-completado | Package `com.tubusexpress.app` |
| 0.12 | SHA-1 debug keystore registrado en Firebase | ✅ Pre-completado | `D6:37:DC:C9:BC:5C:13:EB:4D:D8:E3:8D:2D:F8:5F:1E:78:E5:B5:89` |
| 0.13 | OAuth Client ID Android creado | ✅ Pre-completado | Auto-creado por Firebase |
| 0.14 | OAuth Client ID Web creado | ✅ Pre-completado | Auto-creado por Firebase |
| 0.15 | `google-services.json` descargado y guardado | ✅ Pre-completado | `C:\Users\luisv\tubus-credentials\google-services.json` |
| 0.16 | Carpeta de credenciales fuera del repo | ✅ Pre-completado | `C:\Users\luisv\tubus-credentials\` |
| 0.17 | Crear branch git `feat/capacitor-android` para todo el trabajo | ⏳ **A EJECUTAR** | `git branch` muestra la nueva branch activa |
| 0.18 | Smoke test web baseline (anti-regresión) | ⏳ **A EJECUTAR** | Web compila + login local funciona en development |

---

## Plan de ejecución (orden estricto)

### Bloque A — Variables de entorno Java + Android (Tareas 0.2, 0.5, 0.6)

Estas tres van juntas porque dependen entre sí. Las hacemos de un tirón.

### Bloque B — Configuración del POCO (Tarea 0.9)

Setear el dispositivo en modo developer + USB debugging para poder hacer `adb install` desde el PC.

### Bloque C — Verificación SDK (Tarea 0.4)

Confirmar que tenemos los componentes necesarios. Si falta algo, instalamos.

### Bloque D — Branch + smoke test (Tareas 0.17, 0.18)

Aislar el trabajo de Capacitor en una branch + verificar que la web baseline funciona antes de empezar a tocar nada.

### Bloque E — Tarea opcional (0.7) — Crear AVD

Solo si queremos un emulador como respaldo. Skipeamos por ahora.

---

## Detalle ejecutable por bloque

### Bloque A — Java + Android env vars

#### A.1 Identificar exactamente la ruta del JDK 17

```powershell
ls "C:\Program Files\Android\jdk"
```

Esperamos ver algo como `jdk-17.x.x` o similar. Anotar la ruta exacta.

#### A.2 Identificar la ruta del Android SDK

```powershell
Test-Path "$env:LOCALAPPDATA\Android\Sdk"
```

Si `True` → ruta es `C:\Users\luisv\AppData\Local\Android\Sdk` (estándar).
Si `False` → buscar en `C:\Program Files (x86)\Android\android-sdk` u otra ruta.

#### A.3 Setear JAVA_HOME (apuntando al JDK 17 de Android Studio, NO al JDK 11)

PowerShell como **Administrador** (Win+X → "Windows PowerShell (Admin)" o "Terminal (Admin)"):

```powershell
[Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Android\jdk\<carpeta-jdk-17>', 'User')
```

**Nota:** sustituir `<carpeta-jdk-17>` con el nombre exacto que vimos en A.1.

#### A.4 Setear ANDROID_SDK_ROOT

```powershell
[Environment]::SetEnvironmentVariable('ANDROID_SDK_ROOT', "$env:LOCALAPPDATA\Android\Sdk", 'User')
```

#### A.5 Añadir herramientas al PATH (opcional pero útil)

```powershell
$currentPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$newPath = "$currentPath;%JAVA_HOME%\bin;%ANDROID_SDK_ROOT%\platform-tools;%ANDROID_SDK_ROOT%\emulator"
[Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
```

#### A.6 Aplicar cambios — cerrar y reabrir PowerShell

Las env vars de "User" requieren reiniciar la sesión de PowerShell para tomar efecto.

#### A.7 Validaciones

```powershell
echo $env:JAVA_HOME
java -version
keytool -help     # Ahora SÍ debería funcionar sin ruta completa
adb version
```

Esperado:
- `JAVA_HOME` apunta al JDK 17.
- `java -version` reporta `openjdk version "17.x"`.
- `keytool` no falla (ya está en PATH).
- `adb version` reporta versión y "Installed as `<sdk>/platform-tools/adb.exe`".

---

### Bloque B — Configurar POCO

#### B.1 Activar Developer Options

En el POCO:

1. **Configuración** → **Acerca del teléfono**.
2. Tap rápido **7 veces** sobre **"Versión MIUI"** (o "Versión HyperOS" en HyperOS 1.0+).
3. Aparece toast: "¡Ya eres desarrollador!" o equivalente.

#### B.2 Activar USB Debugging + Install via USB

1. **Configuración** → **Ajustes adicionales** → **Opciones de desarrollador**.
2. Toggle **Depuración por USB** → ON.
3. Toggle **Instalar vía USB** → ON. (Probablemente pida loguear con cuenta Mi).
4. Toggle **Optimización MIUI** → **OFF**. ⚠️ Importante para que apps debugged se comporten como Android estándar.
5. Si aparece **"Verificar apps por USB"** → toggle ON.

#### B.3 Conectar al PC vía USB-C

1. Conectar el cable USB-C del POCO al PC.
2. En el POCO aparece prompt: **"Permitir depuración por USB?"** con la huella RSA del PC.
3. Marcar **"Permitir siempre desde este equipo"** → **Aceptar**.

#### B.4 Validar conexión desde PowerShell

```powershell
adb devices
```

Esperado:

```
List of devices attached
<serial-id>    device
```

Si aparece `unauthorized` → no aceptaste el prompt RSA en el POCO. Aceptar y reintentar.
Si aparece vacío → cable solo carga, o el driver USB no se instaló. Te guío si pasa.

---

### Bloque C — Verificar Android SDK

#### C.1 Abrir Android Studio

```powershell
& "C:\Program Files\Android\Android Studio\bin\studio64.exe"
```

(O atajo del menú inicio).

#### C.2 Abrir SDK Manager

1. En Android Studio, si abre con un proyecto, click en **More Actions** → **SDK Manager**.
2. Si abre directamente al SDK Manager, perfecto.

#### C.3 Verificar SDK Platforms tab

Buscar **Android 14.0 (API Level 34)** instalado:
- Si está ✅ → continuar.
- Si NO está → marcar el checkbox y click **Apply** → descarga e instala.

#### C.4 Verificar SDK Tools tab

Confirmar instalados:
- ✅ **Android SDK Build-Tools 34**
- ✅ **Android SDK Platform-Tools** (incluye adb)
- ✅ **Android SDK Command-line Tools (latest)** ← importante para `sdkmanager --licenses`
- ✅ **Google Play services** (opcional pero útil)

Si falta algo, marcar y Apply.

#### C.5 Aceptar licencias

```powershell
sdkmanager --licenses
```

Si no encuentra el comando, usar ruta completa:

```powershell
& "$env:ANDROID_SDK_ROOT\cmdline-tools\latest\bin\sdkmanager.bat" --licenses
```

Responder `y` a cada licencia.

---

### Bloque D — Branch + smoke test

#### D.1 Verificar git instalado

```powershell
git --version
```

#### D.2 Verificar status del repo

```powershell
git status
git branch
```

Esperado: estar en branch `main` o `master`, working tree limpio (o casi).

#### D.3 Crear branch de trabajo

```powershell
git checkout -b feat/capacitor-android
```

#### D.4 Smoke test web baseline

Antes de tocar Capacitor, verificar que la web compila y arranca:

```powershell
cd frontend
npm install   # solo si hay cambios
npm run build:prod
```

Esperado: build exitoso, sin errores. Cero warnings nuevos.

(Opcional) Iniciar dev server y validar visualmente:

```powershell
npm start
# Abrir http://localhost:4200, verificar que la landing carga
```

---

### Bloque E — AVD (skip por ahora)

Skipeamos porque tenemos el POCO físico. Si después necesitamos AVD, lo creamos en 5 min.

---

## Definition of Done de Phase 0

- [ ] `JAVA_HOME` apunta al JDK 17 ✅ verificable con `echo $env:JAVA_HOME`
- [ ] `java -version` reporta 17.x
- [ ] `adb version` funciona sin ruta completa
- [ ] `keytool` funciona sin ruta completa
- [ ] `adb devices` muestra el POCO como `device`
- [ ] Android SDK 34 + Build Tools 34 + Platform Tools + Command Line Tools instalados
- [ ] Licencias SDK aceptadas
- [ ] Branch `feat/capacitor-android` creada
- [ ] Smoke test web: `npm run build:prod` exitoso

Cuando todo esté ✅ → autorizamos Phase 1 (bootstrap Capacitor).

---

## Bitácora de ejecución

> Se actualiza en tiempo real conforme avanza la ejecución.

### 2026-05-15

- 16:00 — Phase 0 autorizada por el owner. Inicio.
- 16:00 — Documento `06-phase-0-prerequisites.md` creado.
- 16:05 — Bloque A: `JAVA_HOME` apuntando a JBR (JDK 21), `ANDROID_SDK_ROOT` configurado, PATH actualizado con jbr/bin + platform-tools + cmdline-tools/latest/bin + emulator. ✅
- 16:15 — Bloque A (cleanup opcional): JBR insertado al inicio del SYSTEM PATH. `java -version` ahora reporta 21.0.8. ✅
- 16:25 — Bloque B: Developer Options activadas en POCO. USB Debugging + Install via USB ON. (Optimización MIUI no existe en HyperOS — no aplica). Cable USB-C conectado, prompt RSA aceptado con "Permitir siempre". `adb devices` reporta `f2591346d590 device`. ✅
- 16:35 — Bloque C: SDK Platforms instaladas: android-34, android-35, android-36. Build Tools: 35.0.0, 35.0.1, 36.1.0. `sdkmanager --licenses` reporta "All SDK package licenses accepted". ✅
- 16:45 — Bloque D: Multi-repo confirmado (frontend + backend con `.git` separados). Branch `feat/capacitor-android` creada en frontend (working tree limpio). `npm install` exitoso (665 packages, 13s). `npm run build:prod` exitoso en 19.695s. ✅

### Baseline web pre-Capacitor (anchor para anti-regresión)

| Métrica | Valor |
|---|---|
| Initial bundle raw | 782.53 kB |
| Initial bundle transfer | 180.79 kB |
| Tiempo de build prod | 19.695 s |
| Lazy chunks | 76+ |
| Errores | 0 |
| Warnings | 0 visibles |

**Restricción contractual:** post-Capacitor, el initial bundle web NO debe crecer más de **30 kB transfer**. Validación obligatoria al cerrar Phase 1.

### Estado final Phase 0

✅ **TODAS las 18 tareas de la tabla principal completadas.**

| Tarea | Status |
|---|---|
| 0.1 - 0.18 | ✅ Completas |

Phase 0 cerrada el 2026-05-15 a las 16:45.

**Pendiente:** autorización formal del owner para iniciar Phase 1 (bootstrap Capacitor).

---

## Próximo documento

[`07-phase-1-bootstrap.md`](./07-phase-1-bootstrap.md) — se genera al completar Phase 0.
