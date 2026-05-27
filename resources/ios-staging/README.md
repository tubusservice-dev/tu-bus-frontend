# iOS Assets — Staging (Windows-generated)

## Qué hay aquí

App icon + Splash image pre-generados para iOS desde Windows, antes de que la carpeta `ios/` exista (porque `npx cap add ios` solo corre en macOS).

| Carpeta | Contenido | Uso final |
|---|---|---|
| `AppIcon.appiconset/` | 1 PNG 1024×1024 + `Contents.json` | App Icon iOS (todas las densidades las extrae Xcode) |
| `Splash.imageset/` | 6 PNG (1x/2x/3x para light + dark) + `Contents.json` | Splash screen iOS con soporte dark mode |

**Total:** ~3.3 MB. Generados con `@capacitor/assets@3.0.5` a partir de:
- `resources/icon.png` (1024×1024, brand TuBus Express)
- `resources/splash.png` (2732×2732, brand TuBus Express)

## Cómo usar el día del Mac

Después de ejecutar `npx cap add ios` en el Mac, sobrescribe la carpeta `Assets.xcassets/` recién creada con estos assets:

```bash
# Desde la raíz del proyecto, en el Mac:
cp -r frontend/resources/ios-staging/AppIcon.appiconset \
      frontend/ios/App/App/Assets.xcassets/
cp -r frontend/resources/ios-staging/Splash.imageset \
      frontend/ios/App/App/Assets.xcassets/
```

Luego en Xcode: el target ya leerá los assets sin trabajo adicional.

## Por qué no regenerar en el Mac

Se puede, pero esto ahorra:
- 1 paso de `npx capacitor-assets generate --ios` en el Mac.
- Asegura que el icono/splash es exactamente el mismo binario validado en Windows.
- Garantiza el mismo resultado visual entre cualquier dev con/sin Mac.

## Regenerar (si los masters cambian)

```powershell
# Desde frontend/, requiere stub temporal porque el CLI exige ios/App/App/Assets.xcassets:
mkdir -p ios/App/App/Assets.xcassets/AppIcon.appiconset
mkdir -p ios/App/App/Assets.xcassets/Splash.imageset
# Copiar los Contents.json mínimos (ver historia git para los templates)
npx capacitor-assets generate --ios
# Mover lo nuevo a resources/ios-staging/ y borrar ios/
```
