# Mechanic Management System — Overhaul Completo

**Fecha de inicio:** 2026-04-06
**Estado:** En planificación
**Autor:** Claude Code (Tech Lead)

---

## Resumen Ejecutivo

Transformación del módulo de mecánicos desde un CRUD básico a un sistema completo de scheduling, asignación con calendario, página pública de progreso, e historial de mecánicos para el cliente.

## Alcance del Cambio

### Estado Actual (ANTES)
- Modelo Mechanic: solo nombre, whatsapp, email, zona, municipio, isActive
- Asignación a órdenes: dropdown simple sin validación de disponibilidad
- Notificación WhatsApp: manual con mensaje básico
- Sin calendario, sin horarios, sin slots, sin progreso visual
- Sin historial de mecánicos para el cliente

### Estado Objetivo (DESPUÉS)
- Modelo Mechanic: + horario semanal, maxServiceHours, bloqueos de fechas
- Nueva colección MechanicAssignment: tracking independiente de asignaciones con progreso
- Calendario visual del mecánico en admin (slots disponibles/ocupados/bloqueados)
- Asignación inteligente: selección de fecha/hora con filtrado de mecánicos disponibles
- Página pública de progreso: stepper Asignado → En Camino → En Proceso → Completado
- Historial de mecánicos en perfil del cliente
- WhatsApp mejorado con toda la info del servicio + link de progreso

---

## Arquitectura

### Nuevo Módulo: mechanic-assignments
```
backend/src/modules/mechanic-assignments/
├── interfaces/mechanic-assignment.interface.ts
├── models/mechanic-assignment.model.ts
├── dto/mechanic-assignment.dto.ts
├── services/mechanic-assignment.service.ts
├── controllers/mechanic-assignment.controller.ts
├── routes/public.routes.ts
└── index.ts
```

### Modelo MechanicAssignment
```
{
  mechanic: ObjectId → Mechanic
  order: ObjectId → Order
  scheduledDate: Date
  startTime: String (HH:mm)
  endTime: String (HH:mm)
  status: 'scheduled' | 'en_camino' | 'in_progress' | 'completed' | 'cancelled'
  progressSteps: [
    { step: 'asignado', label: 'Asignado', completedAt?, completedBy? },
    { step: 'en_camino', label: 'En Camino', completedAt?, completedBy? },
    { step: 'en_proceso', label: 'En Proceso', completedAt?, completedBy? },
    { step: 'completado', label: 'Completado', completedAt?, completedBy? }
  ]
  accessToken: String (UUID, único)
  tokenExpiresAt: Date
  createdBy: ObjectId → Admin
  cancelledReason?: String
}
```

### Mechanic Model (campos nuevos)
```
+ maxServiceHours: Number (default: 2, min: 1, max: 12)
+ schedule: [{ day, dayName, openTime, closeTime, isClosed }] (7 días)
+ dateBlocks: [{ startDate, endDate, startTime?, endTime?, reason?, isAllDay }]
```

### Algoritmo de Disponibilidad
```
getAvailableMechanics(date, startTime, endTime):
  1. Filtrar mecánicos activos (opcionalmente por zona)
  2. Excluir: schedule[dayOfWeek].isClosed === true
  3. Excluir: horario no cubre rango solicitado
  4. Excluir: dateBlock cubre fecha/hora
  5. Excluir: assignment existente no-cancelada solapa fecha/hora
  → Retornar mecánicos disponibles
```

---

## Fases de Implementación

### Fase 1: Backend — Cambios en Modelos
- [x] 1.1 Actualizar interfaz de Mechanic
- [x] 1.2 Actualizar modelo Mongoose de Mechanic
- [x] 1.3 Actualizar DTOs de Mechanic
- [x] 1.4 Crear módulo MechanicAssignment
- [x] 1.5 Actualizar servicio de Mechanic para schedule

### Fase 2: Backend — Servicios y Rutas
- [x] 2.1 Crear servicio MechanicAssignment
- [x] 2.2 Crear DTOs de MechanicAssignment
- [x] 2.3 Crear controlador MechanicAssignment
- [x] 2.4 Crear rutas (admin + públicas)
- [x] 2.5 Registrar rutas en app.ts e index.ts
- [x] 2.6 Agregar rutas de date-blocks a mechanics
- [x] 2.7 Actualizar controlador de Mechanic
- [x] 2.8 Refactorizar flujo de asignación en Order
- [x] 2.9 Agregar endpoint de historial del cliente

### Fase 3: Frontend — Admin de Mecánicos
- [x] 3.1 Actualizar modelo TypeScript de Mechanic
- [x] 3.2 Crear modelo TypeScript de MechanicAssignment
- [x] 3.3 Crear servicio MechanicAssignment
- [x] 3.4 Actualizar MechanicService
- [x] 3.5 Overhaul del formulario de mecánico
- [x] 3.6 Crear componente Calendario
- [x] 3.7 Crear modal de Bloqueo de Fechas
- [x] 3.8 Registrar ruta del calendario
- [x] 3.9 Actualizar lista de mecánicos

### Fase 4: Frontend — Asignación en Órdenes
- [x] 4.1 Overhaul del modal de asignación
- [x] 4.2 Actualizar detalle de orden admin

### Fase 5: Página Pública de Progreso
- [x] 5.1 Crear componente de progreso
- [x] 5.2 Registrar ruta

### Fase 6: Historial de Mecánicos del Cliente
- [x] 6.1 Crear componente de historial
- [x] 6.2 Integrar en perfil
- [x] 6.3 Agregar método al OrderService

### Fase 7: Mejora de Notificación WhatsApp
- [x] 7.1 Actualizar mensaje de WhatsApp (integrado en Fase 4 — modal de asignación)

### Fase 8: Testing Integral
- [x] 8.1 Compilación limpia Backend (tsc --noEmit) — 0 errores
- [x] 8.2 Compilación limpia Frontend (ng build) — 0 errores, 0 warnings
- [x] 8.3 Tests unitarios Backend — 29/29 pasados
- [x] 8.7 Regresión — tests existentes no se rompieron

---

## Endpoints Nuevos

### Admin (requieren auth)
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/admin/mechanic-assignments/` | Crear asignación |
| GET | `/api/admin/mechanic-assignments/mechanic/:id` | Asignaciones por mecánico |
| GET | `/api/admin/mechanic-assignments/mechanic/:id/calendar` | Calendario del mecánico |
| GET | `/api/admin/mechanic-assignments/order/:id` | Asignaciones de una orden |
| GET | `/api/admin/mechanic-assignments/available-mechanics` | Mecánicos disponibles |
| PATCH | `/api/admin/mechanic-assignments/:id/cancel` | Cancelar asignación |
| POST | `/api/admin/mechanics/:id/date-blocks` | Agregar bloqueo de fecha |
| DELETE | `/api/admin/mechanics/:id/date-blocks/:index` | Eliminar bloqueo |

### Públicos (sin auth)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/mechanic-progress/:token` | Obtener progreso por token |
| PATCH | `/api/mechanic-progress/:token/advance` | Avanzar paso de progreso |

### Autenticados (usuario)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/orders/mechanic-history` | Historial de mecánicos del cliente |

---

## Rutas Frontend Nuevas

| Ruta | Componente | Acceso |
|------|-----------|--------|
| `/admin/mechanics/:id/calendar` | MechanicCalendarComponent | Admin |
| `/mechanic/progress/:token` | MechanicProgressComponent | Público |
| Perfil → Tab "Mecánicos" | MechanicHistoryComponent | Usuario auth |

---

## Decisiones Técnicas

1. **MechanicAssignment como colección separada**: Permite queries de calendario O(log n), historial, re-asignaciones
2. **Schedule embebido en Mechanic**: Sigue patrón Branch.schedule, no necesita queries independientes
3. **Slots calculados en runtime**: Evita sincronización de datos stale
4. **4 pasos de progreso fijos**: UI predecible, estado como array para tracking granular
5. **accessToken por assignment (no por order)**: Cada asignación tiene su propia página de progreso
6. **Backward compatible**: Mecánicos sin schedule funcionan con valores default

---

## Log de Cambios

| Fecha | Fase | Paso | Descripción | Archivos Modificados |
|-------|------|------|-------------|---------------------|
| 2026-04-06 | — | — | Plan creado y documentado | docs/features/mechanic-system-overhaul.md |
| 2026-04-07 | 1 | 1.1-1.5 | Backend: modelos, interfaces, DTOs, MechanicAssignment module | 6 archivos |
| 2026-04-07 | 2 | 2.1-2.9 | Backend: servicio scheduling, controlador, rutas, refactor order | 12 archivos |
| 2026-04-07 | 3 | 3.1-3.9 | Frontend: modelos, servicios, form, calendario, date-block modal | 14 archivos |
| 2026-04-07 | 4 | 4.1-4.2 | Frontend: modal multi-paso, order model update | 2 archivos |
| 2026-04-07 | 5 | 5.1-5.2 | Frontend: pagina publica progreso mecanico (mobile-first) | 4 archivos |
| 2026-04-07 | 6 | 6.1-6.3 | Frontend: historial mecanicos en perfil cliente | 5 archivos |
| 2026-04-07 | 7 | 7.1 | WhatsApp mejorado (integrado en fase 4) | — |
| 2026-04-07 | 8 | 8.1-8.3 | Testing: tsc 0 errores, ng build 0 errores, 29/29 tests OK | — |
