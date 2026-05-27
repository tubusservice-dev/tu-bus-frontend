# Plan: Sistema de Gestión de Mecánicos — Overhaul Completo

## Contexto

El módulo de mecánicos actual es un CRUD básico (nombre, whatsapp, email, zona, municipio). No tiene horarios de disponibilidad, calendario, ni sistema de asignación con fechas/horas. La asignación a órdenes es un simple dropdown sin validación de disponibilidad. Se necesita transformar esto en un sistema completo de scheduling, asignación con calendario, página pública de progreso para el mecánico, e historial de mecánicos para el cliente.

### Decisiones de arquitectura clave
- **Nueva colección `MechanicAssignment`** separada de `Order` — permite queries de calendario eficientes, historial de re-asignaciones, y desacopla el tracking de progreso
- **Schedule embebido en `Mechanic`** (no colección separada) — sigue el patrón existente de `Branch.schedule`
- **Slots calculados en runtime** (no almacenados) — se derivan de `schedule + maxServiceHours`, evitando datos stale
- **4 pasos de progreso fijos**: Asignado → En Camino → En Proceso → Completado

---

## Fase 1: Backend — Cambios en Modelos

### 1.1 Actualizar interfaz de Mechanic
**Archivo:** `backend/src/modules/mechanics/interfaces/mechanic.interface.ts`
- Agregar `IScheduleDay` (reusar forma de Branch: `day`, `dayName`, `openTime`, `closeTime`, `isClosed`)
- Agregar `IDateBlock`: `startDate`, `endDate`, `startTime?`, `endTime?`, `reason?`, `isAllDay`
- Extender `IMechanic`: `maxServiceHours: number`, `schedule: IScheduleDay[]`, `dateBlocks: IDateBlock[]`
- Extender `IMechanicResponse` con los mismos campos

### 1.2 Actualizar modelo Mongoose de Mechanic
**Archivo:** `backend/src/modules/mechanics/models/mechanic.model.ts`
- Agregar `scheduleDaySchema` (réplica de `backend/src/modules/branches/models/branch.model.ts` líneas 4-13)
- Agregar `dateBlockSchema`: startDate, endDate, startTime, endTime, reason, isAllDay
- Nuevos campos: `maxServiceHours` (Number, default: 2, min: 1, max: 12), `schedule` (array scheduleDaySchema), `dateBlocks` (array dateBlockSchema)

### 1.3 Actualizar DTOs de Mechanic
**Archivo:** `backend/src/modules/mechanics/dto/mechanic.dto.ts`
- Agregar a `CreateMechanicDto`: `maxServiceHours?`, `schedule?`
- Agregar a `UpdateMechanicDto`: `maxServiceHours?`, `schedule?`, `dateBlocks?`
- Nuevo `AddDateBlockDto`: campos del date block

### 1.4 Crear módulo MechanicAssignment (NUEVO)
**Archivos nuevos:**
- `backend/src/modules/mechanic-assignments/interfaces/mechanic-assignment.interface.ts`
  - `AssignmentStatus`: `'scheduled' | 'en_camino' | 'in_progress' | 'completed' | 'cancelled'`
  - `IProgressStep`: `step` ('asignado'|'en_camino'|'en_proceso'|'completado'), `label`, `completedAt?`, `completedBy?` ('mechanic'|'admin')
  - `IMechanicAssignment`: mechanic, order, scheduledDate, startTime, endTime, status, progressSteps[], accessToken, tokenExpiresAt, createdBy, cancelledReason?
- `backend/src/modules/mechanic-assignments/models/mechanic-assignment.model.ts`
  - Indexes: `{ mechanic: 1, scheduledDate: 1 }`, `{ order: 1 }`, `{ accessToken: 1 }` (unique sparse)
  - Default progressSteps con 4 pasos sin completar
- `backend/src/modules/mechanic-assignments/index.ts`

### 1.5 Actualizar servicio de Mechanic para schedule
**Archivo:** `backend/src/modules/mechanics/services/mechanic.service.ts`
- `create()`: inicializar schedule por defecto (Lun-Vie 8am-6pm, Sáb-Dom cerrado) si no se provee
- `update()`: manejar schedule y dateBlocks
- Nuevo `addDateBlock(id, dto)`: push a dateBlocks array
- Nuevo `removeDateBlock(id, blockIndex)`: remover por índice
- Actualizar `toResponse()` con nuevos campos

---

## Fase 2: Backend — Servicios y Rutas

### 2.1 Crear servicio MechanicAssignment
**Archivo nuevo:** `backend/src/modules/mechanic-assignments/services/mechanic-assignment.service.ts`

Métodos principales:
- `create(dto)` — valida disponibilidad, genera UUID accessToken (expira 7 días), crea con progressSteps default
- `findByMechanic(mechanicId, startDate, endDate)` — query para calendario
- `findByOrder(orderId)` — todas las asignaciones de una orden
- `findByAccessToken(token)` — para página pública de progreso, populate mechanic + order + user + vehicles
- `advanceProgress(token, step)` — marca paso como completado, actualiza status del assignment
- `cancel(assignmentId, reason?)` — cancela asignación, libera slot
- `getAvailableMechanics(date, startTime, endTime, zoneId?)` — **query core de scheduling**:
  1. Obtener mecánicos activos (filtro opcional por zona)
  2. Excluir los que tienen `schedule[dayOfWeek].isClosed === true`
  3. Excluir los que su horario no cubre el rango solicitado
  4. Excluir los que tienen `dateBlock` cubriendo la fecha/hora
  5. Excluir los que tienen assignment no-cancelada solapando fecha/hora
- `getMechanicCalendar(mechanicId, month, year)` — retorna assignments + dateBlocks + schedule del mes
- `getCustomerMechanicHistory(userId)` — join assignments con orders donde `order.user === userId`

### 2.2 Crear DTOs de MechanicAssignment
**Archivo nuevo:** `backend/src/modules/mechanic-assignments/dto/mechanic-assignment.dto.ts`
- `CreateAssignmentDto`: mechanicId, orderId, scheduledDate, startTime, endTime
- `AdvanceProgressDto`: step (enum de los 4 pasos)
- `CancelAssignmentDto`: reason?
- `AvailableMechanicsQueryDto`: date, startTime, endTime, zoneId?
- `MechanicCalendarQueryDto`: month, year

### 2.3 Crear controlador MechanicAssignment
**Archivo nuevo:** `backend/src/modules/mechanic-assignments/controllers/mechanic-assignment.controller.ts`
- Sigue patrón de `backend/src/modules/mechanics/controllers/mechanic.controller.ts`

### 2.4 Crear rutas
**Archivos nuevos:**
- `backend/src/modules/admin/routes/mechanic-assignments.routes.ts` — rutas admin:
  - `POST /` — crear asignación
  - `GET /mechanic/:mechanicId` — por mecánico + rango de fechas
  - `GET /mechanic/:mechanicId/calendar` — datos de calendario
  - `GET /order/:orderId` — asignaciones de una orden
  - `GET /available-mechanics` — query de disponibilidad
  - `PATCH /:id/cancel` — cancelar asignación
- `backend/src/modules/mechanic-assignments/routes/public.routes.ts` — rutas públicas:
  - `GET /:token` — obtener progreso por token
  - `PATCH /:token/advance` — avanzar paso de progreso

### 2.5 Registrar rutas
**Archivos a modificar:**
- `backend/src/modules/admin/routes/index.ts` (línea ~57) — agregar `router.use('/mechanic-assignments', mechanicAssignmentRoutes)`
- `backend/src/app.ts` (línea ~134) — agregar `app.use('/api/mechanic-progress', mechanicProgressPublicRoutes)`

### 2.6 Agregar rutas de date-blocks al módulo mechanics
**Archivo:** `backend/src/modules/admin/routes/mechanics.routes.ts`
- `POST /:id/date-blocks` — agregar bloqueo
- `DELETE /:id/date-blocks/:index` — eliminar bloqueo

### 2.7 Actualizar controlador de Mechanic
**Archivo:** `backend/src/modules/mechanics/controllers/mechanic.controller.ts`
- Agregar métodos `addDateBlock` y `removeDateBlock`

### 2.8 Refactorizar flujo de asignación en Order
**Archivos a modificar:**
- `backend/src/modules/orders/models/order.model.ts` — agregar campo `mechanicAssignment: ObjectId ref 'MechanicAssignment'`
- `backend/src/modules/orders/interfaces/order.interface.ts` — agregar `mechanicAssignment?` a `IOrder` y `IOrderResponse`
- `backend/src/modules/orders/services/order.service.ts` — actualizar `assignMechanic()` (líneas 245-270) para aceptar `scheduledDate`, `startTime`, `endTime`, crear MechanicAssignment, y usar el accessToken del assignment como mechanicToken de la orden

### 2.9 Agregar endpoint de historial de mecánicos del cliente
**Archivos a modificar:**
- `backend/src/modules/orders/routes/order.routes.ts` — agregar `GET /mechanic-history`
- `backend/src/modules/orders/controllers/order.controller.ts` — agregar método `getMechanicHistory`

---

## Fase 3: Frontend — Admin de Mecánicos

### 3.1 Actualizar modelo TypeScript de Mechanic
**Archivo:** `frontend/src/app/models/mechanic.model.ts`
- Agregar interfaces `ScheduleDay`, `DateBlock`
- Agregar `maxServiceHours`, `schedule`, `dateBlocks` a `Mechanic`
- Actualizar `CreateMechanicRequest` y `UpdateMechanicRequest`

### 3.2 Crear modelo TypeScript de MechanicAssignment
**Archivo nuevo:** `frontend/src/app/models/mechanic-assignment.model.ts`
- Interfaces: `AssignmentStatus`, `ProgressStep`, `MechanicAssignment`, `MechanicCalendarData`, responses

### 3.3 Crear servicio MechanicAssignment (frontend)
**Archivo nuevo:** `frontend/src/app/core/services/mechanic-assignment.service.ts`
- Sigue patrón de `frontend/src/app/core/services/mechanic.service.ts`
- Métodos: `createAssignment`, `getByMechanic`, `getMechanicCalendar`, `getByOrder`, `getAvailableMechanics`, `cancelAssignment`, `getProgressByToken` (público), `advanceProgress` (público)

### 3.4 Actualizar MechanicService (frontend)
**Archivo:** `frontend/src/app/core/services/mechanic.service.ts`
- Agregar `addDateBlock()` y `removeDateBlock()`

### 3.5 Overhaul del formulario de mecánico
**Archivos:**
- `frontend/src/app/features/admin/mechanics/mechanic-form/mechanic-form.component.ts`
- `frontend/src/app/features/admin/mechanics/mechanic-form/mechanic-form.component.html`
- Agregar `FormArray` para schedule (réplica del patrón en `branch-form.component.ts` líneas 79-84, 96-106)
- Agregar control `maxServiceHours` (input numérico, min 1, max 12)
- 7 filas de horario (Lun-Dom): openTime, closeTime, toggle isClosed

### 3.6 Crear componente Calendario del Mecánico
**Archivos nuevos:**
- `frontend/src/app/features/admin/mechanics/mechanic-calendar/mechanic-calendar.component.ts`
- `frontend/src/app/features/admin/mechanics/mechanic-calendar/mechanic-calendar.component.html`
- `frontend/src/app/features/admin/mechanics/mechanic-calendar/mechanic-calendar.component.scss`
- Grilla mensual con navegación mes a mes
- Color coding: verde=disponible, azul/naranja=asignado, rojo/gris=bloqueado
- Click en día → muestra slots del día con detalle
- Slots generados desde schedule + maxServiceHours, cruzado con assignments y dateBlocks

### 3.7 Crear componente Modal de Bloqueo de Fechas
**Archivos nuevos:**
- `frontend/src/app/features/admin/mechanics/date-block-modal/date-block-modal.component.ts`
- `frontend/src/app/features/admin/mechanics/date-block-modal/date-block-modal.component.html`
- `frontend/src/app/features/admin/mechanics/date-block-modal/date-block-modal.component.scss`
- Inputs: rango de fechas, toggle all-day, rango horario opcional, razón

### 3.8 Registrar ruta del calendario
**Archivo:** `frontend/src/app/app.routes.ts`
- Agregar después de mechanics/edit/:id (línea ~241):
  ```
  { path: 'mechanics/:id/calendar', loadComponent: () => import(MechanicCalendarComponent) }
  ```

### 3.9 Actualizar lista de mecánicos
**Archivo:** `frontend/src/app/features/admin/mechanics/mechanic-list/mechanic-list.component.html`
- Agregar botón/ícono de calendario por fila → navega a `/admin/mechanics/:id/calendar`
- Mostrar `maxServiceHours` en la tabla

---

## Fase 4: Frontend — Asignación en Órdenes (Enhanced)

### 4.1 Overhaul del modal de asignación de despacho
**Archivo:** `frontend/src/app/features/admin/orders/order-dispatch-modal/order-dispatch-modal.component.ts`
- Reemplazar dropdown simple por flujo multi-paso:
  1. **Date picker** — selección de fecha
  2. **Selector de slot** — slots computados desde mecánicos disponibles
  3. **Query mecánicos disponibles** — `mechanicAssignmentService.getAvailableMechanics(date, startTime, endTime)`
  4. **Selección de mecánico** de la lista filtrada
  5. **Crear asignación** vía `mechanicAssignmentService.createAssignment()`
- Post-asignación: mostrar fecha/hora, link de progreso, botón WhatsApp

### 4.2 Actualizar detalle de orden admin
**Archivos:**
- `frontend/src/app/features/admin/orders/order-detail/admin-order-detail.component.ts`
- `frontend/src/app/features/admin/orders/order-detail/admin-order-detail.component.html`
- Mostrar datos de asignación (fecha, hora, mecánico, progreso)
- Cargar vía `mechanicAssignmentService.getByOrder(orderId)`
- Mostrar historial de re-asignaciones si existen múltiples

---

## Fase 5: Página Pública de Progreso del Mecánico

### 5.1 Crear componente de progreso
**Archivos nuevos:**
- `frontend/src/app/features/mechanic-progress/mechanic-progress.component.ts`
- `frontend/src/app/features/mechanic-progress/mechanic-progress.component.html`
- `frontend/src/app/features/mechanic-progress/mechanic-progress.component.scss`
- Página pública, sin auth, sin layout wrapper
- Route param: `accessToken`
- Llama `mechanicAssignmentService.getProgressByToken(token)`
- **Visual stepper**: Asignado → En Camino → En Proceso → Completado
- Botón "Siguiente Paso" para avanzar progreso
- Info del servicio: nombre del cliente, dirección, vehículos, fecha/hora
- Estados de error: token expirado/inválido/completado
- **Mobile-first design** (mecánicos acceden por teléfono)

### 5.2 Registrar ruta del progreso
**Archivo:** `frontend/src/app/app.routes.ts`
- Agregar antes del catch-all `**` (línea ~405):
  ```
  { path: 'mechanic/progress/:token', loadComponent: () => import(MechanicProgressComponent) }
  ```

---

## Fase 6: Historial de Mecánicos del Cliente

### 6.1 Crear componente de historial
**Archivos nuevos:**
- `frontend/src/app/features/profile/components/mechanic-history/mechanic-history.component.ts`
- `frontend/src/app/features/profile/components/mechanic-history/mechanic-history.component.html`
- `frontend/src/app/features/profile/components/mechanic-history/mechanic-history.component.scss`
- Lista: nombre mecánico, fecha servicio, número de orden, badge de status
- Click en fila → navega al detalle de la orden

### 6.2 Integrar en perfil
**Archivos:**
- `frontend/src/app/features/profile/profile.component.ts` + template
- Agregar tab 'mecanicos' al `ProfileTab` type
- Renderizar `MechanicHistoryComponent` cuando el tab está activo

### 6.3 Agregar método al OrderService (frontend)
**Archivo:** `frontend/src/app/core/services/order.service.ts`
- `getMechanicHistory()`: `GET /api/orders/mechanic-history`

---

## Fase 7: Mejora de Notificación WhatsApp

### 7.1 Actualizar mensaje de WhatsApp
**Archivo:** `frontend/src/app/features/admin/orders/order-dispatch-modal/order-dispatch-modal.component.ts`
- Actualizar `getWhatsAppUrl()` para incluir:
  - Nombre del cliente
  - Dirección de entrega
  - Info del vehículo (placa, marca, modelo)
  - Fecha y hora programada (de la asignación)
  - Link de la página de progreso: `{clientUrl}/mechanic/progress/{accessToken}`
- Formato multi-línea con todos los detalles del servicio

---

## Orden de Implementación

```
Fase 1 (modelos) → Fase 2 (servicios/rutas) → Fase 3 (admin frontend) → Fase 4 (asignación) → Fase 5 (progreso) → Fase 6 (historial) → Fase 7 (WhatsApp) → Fase 8 (testing integral)
```

Cada fase depende de la anterior. Dentro de cada fase, los pasos se ejecutan en orden numérico.

### Registro de Progreso

| Fase | Descripción | Estado | Fecha Inicio | Fecha Fin | Notas |
|------|-------------|--------|-------------|-----------|-------|
| 1 | Backend — Cambios en Modelos | ⬜ Pendiente | — | — | — |
| 2 | Backend — Servicios y Rutas | ⬜ Pendiente | — | — | — |
| 3 | Frontend — Admin de Mecánicos | ⬜ Pendiente | — | — | — |
| 4 | Frontend — Asignación en Órdenes | ⬜ Pendiente | — | — | — |
| 5 | Página Pública de Progreso | ⬜ Pendiente | — | — | — |
| 6 | Historial de Mecánicos del Cliente | ⬜ Pendiente | — | — | — |
| 7 | Mejora de Notificación WhatsApp | ⬜ Pendiente | — | — | — |
| 8 | Testing Integral y Validación | ⬜ Pendiente | — | — | — |

---

## Fase 8: Testing Integral y Validación Final

**OBLIGATORIO**: Al finalizar las 7 fases de implementación, se ejecutará una fase completa de testing para garantizar **cero errores y cero warnings** en todo el sistema.

### 8.1 Compilación limpia (Backend)
- `cd backend && npx tsc --noEmit` — verificar compilación TypeScript sin errores ni warnings
- Corregir cualquier error de tipos, imports faltantes, o incompatibilidades

### 8.2 Compilación limpia (Frontend)
- `cd frontend && ng build` — build de producción completo
- **Tolerancia cero**: no se admiten warnings de Angular, TypeScript, o Tailwind
- Verificar que no hay imports huérfanos ni circular dependencies

### 8.3 Tests unitarios Backend
- `cd backend && npm test` — ejecutar suite de tests existente
- Verificar que los tests existentes de OrderService, ProductService, BranchProductService no se rompieron
- Escribir tests nuevos para:
  - `MechanicAssignmentService.getAvailableMechanics()` — el query core de scheduling
  - `MechanicAssignmentService.advanceProgress()` — validar transiciones de estado
  - `MechanicAssignmentService.create()` — validar detección de conflictos
  - `MechanicService.create()` — validar schedule por defecto
  - `MechanicService.addDateBlock()` / `removeDateBlock()`

### 8.4 Verificación funcional Backend (servidor levantado)
- Levantar servidor (`npm run dev`)
- Probar endpoints críticos:
  - CRUD mecánico con schedule + dateBlocks
  - Query de mecánicos disponibles para una fecha/hora
  - Crear asignación → verificar slot ocupado → re-query confirma slot no disponible
  - Avanzar progreso vía token público (4 pasos secuenciales)
  - Historial de mecánicos del cliente
  - Token expirado/inválido retorna error correcto

### 8.5 Verificación funcional Frontend (browser)
- Levantar app (`ng serve`)
- Verificar en browser:
  - Formulario de mecánico con horarios + maxServiceHours (crear, editar, validaciones)
  - Calendario visual del mecánico (navegación mensual, slots, bloqueos, colores)
  - Modal de asignación con date picker + mecánicos filtrados por disponibilidad
  - Página de progreso pública (responsive mobile, stepper funcional)
  - Tab de historial de mecánicos en perfil del cliente
  - Consola del browser: **cero errores, cero warnings**

### 8.6 Flujo E2E completo
1. Admin crea mecánico con schedule (Lun-Vie 8am-6pm) y maxServiceHours=2
2. Admin agrega bloqueo de fecha (ej: próximo viernes)
3. Cliente crea orden `oil_change_service` con vehículo
4. Admin abre orden → modal de asignación → selecciona fecha → ve mecánicos disponibles
5. Admin asigna mecánico → se genera link de progreso
6. Admin envía WhatsApp con info completa y link
7. Mecánico abre link → ve info del servicio → avanza: Asignado → En Camino → En Proceso → Completado
8. Cliente ve en su perfil → tab Mecánicos → historial con la asignación completada
9. Admin verifica en calendario del mecánico que el slot aparece como completado

### 8.7 Regresión
- Verificar que el flujo de checkout existente (6 tipos de despacho) sigue funcionando
- Verificar que órdenes existentes en DB siguen mostrándose correctamente
- Verificar que la migración es backward-compatible (mecánicos sin schedule funcionan)

---

## Archivos Críticos (Resumen)

### Backend — Modificar
| Archivo | Cambio |
|---------|--------|
| `backend/src/modules/mechanics/interfaces/mechanic.interface.ts` | Agregar IScheduleDay, IDateBlock, campos nuevos |
| `backend/src/modules/mechanics/models/mechanic.model.ts` | Sub-schemas + campos nuevos |
| `backend/src/modules/mechanics/dto/mechanic.dto.ts` | Campos nuevos en DTOs |
| `backend/src/modules/mechanics/services/mechanic.service.ts` | Schedule default, dateBlocks CRUD |
| `backend/src/modules/mechanics/controllers/mechanic.controller.ts` | Métodos dateBlock |
| `backend/src/modules/admin/routes/mechanics.routes.ts` | Rutas dateBlock |
| `backend/src/modules/orders/models/order.model.ts` | Campo mechanicAssignment |
| `backend/src/modules/orders/interfaces/order.interface.ts` | Campo mechanicAssignment |
| `backend/src/modules/orders/services/order.service.ts` | Refactor assignMechanic |
| `backend/src/modules/orders/controllers/order.controller.ts` | getMechanicHistory |
| `backend/src/modules/orders/routes/order.routes.ts` | Ruta mechanic-history |
| `backend/src/modules/admin/routes/index.ts` | Registrar mechanic-assignments |
| `backend/src/app.ts` | Registrar ruta pública mechanic-progress |

### Backend — Crear
| Archivo | Propósito |
|---------|-----------|
| `backend/src/modules/mechanic-assignments/interfaces/mechanic-assignment.interface.ts` | Interfaces del assignment |
| `backend/src/modules/mechanic-assignments/models/mechanic-assignment.model.ts` | Schema Mongoose |
| `backend/src/modules/mechanic-assignments/dto/mechanic-assignment.dto.ts` | DTOs de validación |
| `backend/src/modules/mechanic-assignments/services/mechanic-assignment.service.ts` | **Core scheduling logic** |
| `backend/src/modules/mechanic-assignments/controllers/mechanic-assignment.controller.ts` | Controlador HTTP |
| `backend/src/modules/mechanic-assignments/routes/public.routes.ts` | Rutas públicas de progreso |
| `backend/src/modules/mechanic-assignments/index.ts` | Barrel exports |
| `backend/src/modules/admin/routes/mechanic-assignments.routes.ts` | Rutas admin |

### Frontend — Modificar
| Archivo | Cambio |
|---------|--------|
| `frontend/src/app/models/mechanic.model.ts` | ScheduleDay, DateBlock, nuevos campos |
| `frontend/src/app/core/services/mechanic.service.ts` | dateBlock methods |
| `frontend/src/app/core/services/order.service.ts` | getMechanicHistory |
| `frontend/src/app/features/admin/mechanics/mechanic-form/*` | Schedule + maxServiceHours |
| `frontend/src/app/features/admin/mechanics/mechanic-list/*` | Botón calendario, mostrar maxHours |
| `frontend/src/app/features/admin/orders/order-dispatch-modal/*` | Multi-step assignment + WhatsApp |
| `frontend/src/app/features/admin/orders/order-detail/*` | Mostrar assignment details |
| `frontend/src/app/features/profile/profile.component.ts` | Tab mecánicos |
| `frontend/src/app/app.routes.ts` | Rutas calendar + progress |

### Frontend — Crear
| Archivo | Propósito |
|---------|-----------|
| `frontend/src/app/models/mechanic-assignment.model.ts` | Interfaces TypeScript |
| `frontend/src/app/core/services/mechanic-assignment.service.ts` | API calls |
| `frontend/src/app/features/admin/mechanics/mechanic-calendar/*` | Calendario visual |
| `frontend/src/app/features/admin/mechanics/date-block-modal/*` | Modal de bloqueos |
| `frontend/src/app/features/mechanic-progress/*` | Página pública de progreso |
| `frontend/src/app/features/profile/components/mechanic-history/*` | Historial del cliente |
