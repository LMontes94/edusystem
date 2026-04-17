# EduSystem — SaaS Educativo

## Stack
- **Backend**: NestJS 10, Prisma ORM, PostgreSQL 16, Redis 7, BullMQ
- **Frontend**: Next.js 14, NextAuth v5, React Query, Zustand, shadcn/ui, Tailwind
- **Storage**: MinIO (S3-compatible)
- **PDF**: Puppeteer

## Repositorio
Monorepo con `backend/` y `frontend/`. Git remote: GitHub (main branch).

---

## Backend

### Puertos y servicios
- Backend API: `http://localhost:4000`
- PostgreSQL: `localhost:5433` (Docker)
- MinIO: `http://localhost:9001` (credenciales: `edusystem_access` / `edusystem_secret_key_change_me`)
- Redis: Docker (requerido para BullMQ)

### Credenciales del seed
- Admin: `admin@sanmartin.edu.ar` / `Admin123!`
- Docentes: `maria.garcia@sanmartin.edu.ar`, `juan.lopez@sanmartin.edu.ar`, `ana.martinez@sanmartin.edu.ar` / `Docente123!`
- Tutores: `roberto.perez@gmail.com`, `laura.gonzalez@gmail.com` / `Padre123!`

### Roles
`SUPER_ADMIN | ADMIN | DIRECTOR | SECRETARY | PRECEPTOR | TEACHER | GUARDIAN`

### Módulos implementados
- `auth` — JWT + refresh tokens
- `institutions` — multi-tenant, stats, report settings
- `users` — CRUD, avatar (MinIO), change password, licencias (ON_LEAVE)
- `students` — CRUD, enrollment
- `courses` — CRUD, school years, periods, course subjects
- `subjects` — CRUD con color
- `grades` — upsert por unique constraint `[studentId, courseSubjectId, periodId, type, date]`
- `attendance` — bulk create/update, historial
- `justifications` — justificar inasistencias, actas automáticas por umbral, notificación al generar acta
- `announcements` — draft/publish workflow
- `indicators` — por materia + grado + año lectivo
- `convivencias` — tipos: observation/warning/reprimand/commendation/suspension/parent_meeting, notificación en suspension y parent_meeting
- `reports` — PDF con Puppeteer (boletín secundaria, informe primaria, pendientes, convivencias)
- `teacher` — temario (múltiples unidades por período), materias pendientes
- `storage` — MinIO upload/download/delete
- `casl` — ABAC permissions
- `notifications` — push tokens, FCM (Firebase), NotificationQueueService, persistencia en DB
- `health` — healthcheck endpoint

### Convenciones importantes
- Fechas: usar `new Date(Date.UTC(year, month-1, day, 12, 0, 0))` para evitar problemas de timezone (Argentina UTC-3)
- Soft delete: `deletedAt DateTime?` en los modelos que lo requieren
- Multi-tenant: siempre filtrar por `institutionId`
- El endpoint `GET /courses/my-subjects` debe ir ANTES de `GET /courses/:id` en el controller
- Notificaciones: usar `NotificationQueueService.notify()` — persiste en DB + envía FCM. Nunca llamar a FcmService directamente desde otros módulos.
- Licencias: `OnLeaveGuard` registrado globalmente bloquea POST/PUT/PATCH/DELETE para usuarios con `status === ON_LEAVE`. Rutas exentas: `/password`, `/leave`, `/restore`.

### CASL subjects registrados
`Institution | User | Student | Course | Grade | Attendance | Announcement | Convivencia | all`

---

## Frontend

### Rutas principales
```
/login
/admin/dashboard
/admin/students
/admin/students/[id]
/admin/courses
/admin/courses/[id]
/admin/subjects
/admin/users                 — CRUD + licencias (otorgar/revocar)
/admin/grades                — lista + carga masiva tipo Excel
/admin/attendance            — tomar lista + historial + justificaciones + actas (tab)
/admin/attendance-detail     — resumen por alumno + ranking faltas + evolución mensual
/admin/announcements
/admin/reports               — PDF + configuración de diseño
/admin/indicators            — por materia + grado + año lectivo
/admin/evaluations           — grilla valoraciones + observaciones
/admin/syllabus              — temario múltiples unidades por período
/admin/pending               — materias pendientes + PDF RITE
/admin/convivencias          — registro + estadísticas + PDF
/teacher/dashboard
/teacher/attendance
/teacher/grades
/teacher/announcements
/teacher/evaluations
/teacher/syllabus
/teacher/pending
/profile
```

### Patrones clave
- **Timezone en fechas**: usar `date.split('T')[0].split('-').reverse().join('/')` para mostrar fechas sin conversión
- **Carga masiva de notas**: debounce 2s + pegar desde Excel + validación visual
- **Temario**: `PeriodSection` como `React.memo` FUERA del componente padre + `usePeriodSyllabus` también fuera — evita re-mount al tipear
- **Avatar**: presigned URL desde MinIO, se carga en header de ambos layouts
- **PDF download**: leer `Content-Disposition` header (requiere `Access-Control-Expose-Headers: Content-Disposition` en el backend)
- **Notificaciones**: `<NotificationBell />` en el header de ambos layouts (`/admin` y `/teacher`). Polling cada 30s con `useUnreadCount` y `useNotifications`.
- **Licencias**: `<LeaveBanner />` en el layout de `/teacher`. Lee `session.user.status` — se muestra si es `ON_LEAVE`. El token JWT incluye `status` y `leaveStartDate`.

### Sidebar navigation
Usa el patrón `{ name: 'Sección', separator: true }` para separadores visuales en el sidebar.

### Estructura de carpetas por página compleja
Las páginas con múltiples tabs o lógica extensa se refactorizan en:
```
/admin/[ruta]/
├── page.tsx                  ← orquesta estado global y tabs (~70 líneas)
└── _components/
    ├── [ruta].types.ts       ← tipos, constantes, helpers compartidos
    ├── [tab-1].tsx
    ├── [tab-2].tsx
    └── [tab-n].tsx
```
Páginas ya refactorizadas: `attendance`, `attendance-detail`.

---

## Modelos Prisma destacados

### Grade
```prisma
@@unique([studentId, courseSubjectId, periodId, type, date])
```
Usar `upsert` para crear/actualizar notas.

### Indicator
```prisma
subjectId + schoolYearId + grade  // filtrar por los tres
```

### Syllabus
Múltiples unidades por período (sin unique constraint en courseSubjectId+periodId).
Status: `completed | pending | postponed`

### Convivencia
Soft delete con `deletedAt`. Tipos: `observation | warning | reprimand | commendation | suspension | parent_meeting`
Notificación automática en `suspension` y `parent_meeting` → directivos + preceptor del curso + tutores del alumno.

### Justification
- `attendanceId` es `@unique` (relación 1-a-1 con Attendance)
- Al crear justificación → cambia `Attendance.status` a `JUSTIFIED`
- Al eliminar justificación → revierte `Attendance.status` a `ABSENT`

### AbsenceRecord
Generado automáticamente cuando se superan los umbrales configurados en `Institution.settings.absenceThresholds` (default: `[10, 20, 30]`).
Solo cuenta inasistencias con status `ABSENT` (no JUSTIFIED).
Notificación automática al generar acta → directivos + preceptor del curso + tutores del alumno.

### User — Licencias
```prisma
status         UserStatus  // ACTIVE | INACTIVE | SUSPENDED | ON_LEAVE
leaveStartDate DateTime?   @map("leave_start_date")
```
- `PATCH /users/:id/leave` — otorga licencia (solo ADMIN/DIRECTOR/SECRETARY)
- `PATCH /users/:id/restore` — revoca licencia, vuelve a ACTIVE
- Usuario `ON_LEAVE` no puede realizar ninguna mutación (bloqueado por `OnLeaveGuard`)

### Notification
```prisma
userId  String
type    NotificationType  // GRADE | ATTENDANCE | CHAT | ANNOUNCEMENT | SYSTEM
title   String
body    String
data    Json?
isRead  Boolean
sentAt  DateTime
```
Usar siempre `NotificationQueueService.notify()` para crear notificaciones.
Destinatarios estándar para eventos de alumno: `getRecipientsForStudent({ studentId, courseId, institutionId })` → directivos + preceptores + tutores.

---

## Configuración de reportes PDF
Se guarda en `Institution.settings.report`:
```json
{
  "primaryColor": "#1e3a5f",
  "secondaryColor": "#2d6a9f",
  "textColor": "#1a1a1a",
  "logoPosition": "center | left | none",
  "layout": "classic | institutional | modern"
}
```

## Configuración de actas
Se guarda en `Institution.settings`:
```json
{
  "absenceThresholds": [10, 20, 30],
  "district": "Vicente López"
}
```

---

## Pendiente
- [ ] App móvil para padres (React Native)
- [ ] Testing end-to-end completo
