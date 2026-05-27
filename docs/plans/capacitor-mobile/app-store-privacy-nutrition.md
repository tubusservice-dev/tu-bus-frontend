# App Store Connect — Privacy Nutrition Labels

> **Status:** Draft generado en F4 (Phase B Windows track).
> **Audiencia:** lo que hay que declarar en App Store Connect → App Privacy.
> **Norma:** App Store Review Guideline 5.1.2 — toda app que recolecta datos debe declararlos antes del submit. Mentir o omitir = rechazo.

---

## Resumen ejecutivo

TuBus Express recolecta datos para:
1. **Account management** (auth, perfil, pedidos).
2. **App functionality** (carrito, zonificación, checkout).
3. **Analytics** (Firebase Analytics — frequency, screens, retention).
4. **Crash diagnostics** (Firebase Crashlytics).
5. **Push delivery** (FCM device token).

**NO recolecta:**
- Tracking publicitario.
- Data brokers.
- Health / fitness.
- Salud financiera (no procesamos pagos in-app — el comprobante es una foto, no datos de tarjeta).

---

## Matriz de datos recolectados

Para cada fila, Apple pregunta 4 cosas:
1. **¿Lo recolectas?** Sí/No.
2. **¿Linked to user?** ¿Está asociado al userId/email del usuario?
3. **¿Used for tracking?** ¿Lo compartes con terceros para seguir al usuario across apps/sites?
4. **Propósito**: ¿para qué?

### Contact Info

| Dato | ¿Recolectas? | Linked | Tracking | Propósito |
|---|---|---|---|---|
| Email Address | ✅ Sí | Sí | No | App Functionality (account creation, login, password reset, email notifications) |
| Name | ✅ Sí | Sí | No | App Functionality (display name, invoice header) |
| Phone Number | ✅ Sí | Sí | No | App Functionality (contact for delivery, WhatsApp checkout link) |
| Physical Address | ✅ Sí | Sí | No | App Functionality (shipping destination, zoning) |
| Other User Contact Info | ❌ No | — | — | — |

### Health & Fitness

| Dato | ¿Recolectas? |
|---|---|
| Health | ❌ No |
| Fitness | ❌ No |

### Financial Info

| Dato | ¿Recolectas? | Linked | Tracking | Propósito |
|---|---|---|---|---|
| Payment Info | ❌ No | — | — | (pagos son offline — la foto del comprobante es Photos, no Payment Info) |
| Credit Info | ❌ No | — | — | — |
| Other Financial Info | ❌ No | — | — | — |

### Location

| Dato | ¿Recolectas? | Linked | Tracking | Propósito |
|---|---|---|---|---|
| Precise Location | ✅ Sí | No (no se persiste a backend con userId) | No | App Functionality (sugerir zona/sucursal cercana — solo cuando el usuario tap "Usar mi ubicación") |
| Coarse Location | ❌ No | — | — | — |

### Sensitive Info

| Dato | ¿Recolectas? |
|---|---|
| Sensitive Info | ❌ No |

### Contacts

| Dato | ¿Recolectas? |
|---|---|
| Contacts | ❌ No |

### User Content

| Dato | ¿Recolectas? | Linked | Tracking | Propósito |
|---|---|---|---|---|
| Photos or Videos | ✅ Sí | Sí | No | App Functionality (payment proof upload, avatar) |
| Customer Support | ❌ No (manejado por WhatsApp/web — fuera del scope app) | — | — | — |
| Other User Content | ❌ No | — | — | — |

### Browsing History

| Dato | ¿Recolectas? |
|---|---|
| Browsing History | ❌ No |

### Search History

| Dato | ¿Recolectas? |
|---|---|
| Search History | ❌ No |

### Identifiers

| Dato | ¿Recolectas? | Linked | Tracking | Propósito |
|---|---|---|---|---|
| User ID | ✅ Sí | Sí | No | App Functionality (auth + persistir sesión), Analytics (Firebase) |
| Device ID | ✅ Sí | Sí | No | App Functionality (FCM push delivery), Analytics |

### Purchases

| Dato | ¿Recolectas? | Linked | Tracking | Propósito |
|---|---|---|---|---|
| Purchase History | ✅ Sí | Sí | No | App Functionality (order list, payment history, customer support reference) |

### Usage Data

| Dato | ¿Recolectas? | Linked | Tracking | Propósito |
|---|---|---|---|---|
| Product Interaction | ✅ Sí | No (Firebase Analytics usa anon ID por defecto en iOS sin ATT consent) | No | Analytics (entender qué features se usan) |
| Advertising Data | ❌ No | — | — | — |
| Other Usage Data | ❌ No | — | — | — |

### Diagnostics

| Dato | ¿Recolectas? | Linked | Tracking | Propósito |
|---|---|---|---|---|
| Crash Data | ✅ Sí | No (Crashlytics anon) | No | App Functionality (Crashlytics) |
| Performance Data | ✅ Sí | No | No | Analytics (Firebase Performance, si se activa) |
| Other Diagnostic Data | ❌ No | — | — | — |

### Other Data

| Dato | ¿Recolectas? |
|---|---|
| Other Data Types | ❌ No |

---

## Tracking (ATT — App Tracking Transparency)

**Pregunta de Apple:** ¿La app trackea al usuario across other companies' apps and websites?

**Respuesta:** **NO**.

Justificación:
- No usamos identifiers para advertising.
- Firebase Analytics está configurado por defecto para NO usar IDFA en iOS sin consent ATT.
- No integramos Facebook SDK, AppsFlyer, Adjust, ni ningún SDK de attribution publicitaria.

**Implicación:** **NO** necesitamos el prompt `App Tracking Transparency` (ATTrackingManager.requestTrackingAuthorization).

---

## Data NOT Collected from This App

(Esta sección Apple la pone automáticamente si declaras "No" en todas las categorías sensibles. Verificar tras submit que se muestra correctamente.)

- No Health & Fitness data
- No Financial Info data
- No Sensitive Info data
- No Contacts data
- No Browsing History data
- No Search History data
- No Advertising Data
- No data is used to track you across apps and websites owned by other companies

---

## Checklist pre-submit

- [ ] Política de privacidad en `https://tubusexpress.com/legal/privacidad` ACTUALIZADA con menciones a:
  - Firebase Authentication (Google + Apple)
  - Firebase Cloud Messaging (push notifications + APNs)
  - Firebase Crashlytics (crash reports)
  - Firebase Analytics (usage metrics)
  - Apple Sign In (`sub`, email, name)
- [ ] Verificar que el bucket Cloudinary donde se suben las fotos de comprobantes tiene retention policy documentada.
- [ ] Si en el futuro se añade IDFA / ad attribution → re-declarar tracking en App Store Connect.
- [ ] Si en algún momento se persiste la lat/lng del usuario al backend → mover Precise Location a Linked=Yes.

---

## Por qué importa que esto sea correcto

Apple Review escanea el listing y lo cruza con el código de la app:
- Si el binario invoca `CLLocationManager.requestLocation()` pero no declaraste Location → rechazo.
- Si invoca `UNUserNotificationCenter.requestAuthorization` pero no declaraste Device ID → warning (no rechazo, pero pendiente de corregir).
- Si declaras "No tracking" y un SDK third-party hace request tracking → rechazo + posible suspensión del developer account.

Este documento es el source of truth interno; el listing en App Store Connect debe coincidir 1:1.
