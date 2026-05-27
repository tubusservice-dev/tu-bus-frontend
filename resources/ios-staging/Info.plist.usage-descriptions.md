# Info.plist — Usage Descriptions (iOS)

## Qué pegar en `ios/App/App/Info.plist`

Apple **crashea** la app la primera vez que un plugin nativo (cámara, galería, GPS, Face ID) intenta acceder al recurso si no encuentra la `NSUsageDescription` correspondiente en el `Info.plist`. Estos 4 strings son **obligatorios** dado el set de plugins instalados.

## Strings finales (en español, para usuarios venezolanos)

Copiar este bloque dentro del `<dict>` raíz de `ios/App/App/Info.plist`:

```xml
<key>NSCameraUsageDescription</key>
<string>TuBus Express necesita acceso a tu cámara para capturar comprobantes de pago y fotos de perfil.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>TuBus Express necesita acceso a tu galería para subir comprobantes de pago e imágenes de perfil.</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>TuBus Express usa tu ubicación para sugerir la sucursal y la zona de despacho más cercanas a ti.</string>

<key>NSFaceIDUsageDescription</key>
<string>Inicia sesión rápido en TuBus Express con Face ID sin volver a escribir tu contraseña.</string>
```

## Mapeo plugin → key

| Plugin Capacitor | Key requerida | Cuándo se invoca |
|---|---|---|
| `@capacitor/camera` (modo cámara) | `NSCameraUsageDescription` | Tap "Subir foto" → "Cámara" |
| `@capacitor/camera` (modo galería) | `NSPhotoLibraryUsageDescription` | Tap "Subir foto" → "Galería" |
| `@capacitor/geolocation` | `NSLocationWhenInUseUsageDescription` | Tap "Usar mi ubicación" en zoning modal |
| `@capgo/capacitor-native-biometric` (Face ID) | `NSFaceIDUsageDescription` | Tap "Activar inicio rápido con Face ID" tras login |
| `@capgo/capacitor-native-biometric` (Touch ID) | (no necesita key adicional) | Igual que Face ID en dispositivos sin TrueDepth |

## URL Scheme para Google Sign-In nativo

Adicional al bloque de arriba, hay que añadir el `CFBundleURLTypes` con el `REVERSED_CLIENT_ID` del `GoogleService-Info.plist` (que se descargará de Firebase Console cuando se cree la app iOS):

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <!--
        Reemplazar con el valor REVERSED_CLIENT_ID del GoogleService-Info.plist.
        Formato típico: com.googleusercontent.apps.1071922885496-XXXXXXXXXX
      -->
      <string>com.googleusercontent.apps.REVERSED_CLIENT_ID_HERE</string>
    </array>
  </dict>
</array>
```

> **Sin esto**, el plugin `@capacitor-firebase/authentication` falla silenciosamente al intentar iniciar el flujo Google y el usuario ve un picker vacío.

## Capacidades adicionales (Xcode → Signing & Capabilities)

Activar estas 3 capabilities en Xcode tras `cap add ios`:

1. **Push Notifications** — requerido por `@capacitor-firebase/messaging`.
2. **Sign in with Apple** — requerido por el provider `apple.com` en `capacitor.config.ts`.
3. **Associated Domains** — agregar `applinks:tubusexpress.com` y `applinks:www.tubusexpress.com` para Universal Links (equivalente iOS de los Android App Links). Requiere que `apple-app-site-association` ya esté servido en producción (ver F4 / WB-6).
