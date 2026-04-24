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

- `auth` — JWT + refresh tokens. Login permite `ON_LEAVE` (solo bloquea `INACTIVE` y `SUSPENDED`)
- `institutions` — multi-tenant, stats, settings, logo (MinIO), onboarding, invitaciones
- `users` — CRUD, avatar (MinIO), change password, licencias (ON_LEAVE), roles por nivel (UserLevelRole)
- `students` — CRUD, enrollment
- `courses` — CRUD, school years, periods, course subjects, export alumnos CSV
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
- `casl` — ABAC permissions. Rol efectivo = más alto entre `User.role` y todos sus `UserLevelRole`
- `notifications` — push tokens, FCM (Firebase), NotificationQueueService, persistencia en DB
- `health` — healthcheck endpoint

### Convenciones importantes

- Fechas: usar `new Date(Date.UTC(year, month-1, day, 12, 0, 0))` para evitar problemas de timezone (Argentina UTC-3)
- Soft delete: `deletedAt DateTime?` en los modelos que lo requieren
- Multi-tenant: siempre filtrar por `institutionId`
- El endpoint `GET /courses/my-subjects` debe ir ANTES de `GET /courses/:id` en el controller
- Notificaciones: usar `NotificationQueueService.notify()` — persiste en DB + envía FCM. Nunca llamar a FcmService directamente desde otros módulos.
- Licencias: `OnLeaveGuard` registrado globalmente bloquea POST/PUT/PATCH/DELETE. Lee el JWT directamente del header (no depende de `request.user`). Rutas exentas: `/auth/*`, `/password`, `/leave`, `/restore`.
- Jerarquía de roles: `SUPER_ADMIN > ADMIN > DIRECTOR > SECRETARY > PRECEPTOR > TEACHER > GUARDIAN`. Helper: `getHighestRole(roles[])` en `src/common/utils/role-hierarchy.ts`

### CASL subjects registrados

`Institution | User | Student | Course | Grade | Attendance | Announcement | Convivencia | all`

---

## Frontend

### Rutas principales

```
/login
/invite/accept                — página pública para aceptar invitaciones
/admin/dashboard
/admin/settings               — datos institucionales, logo, reportes, actas, invitaciones
/admin/students
/admin/students/[id]
/admin/courses
/admin/courses/[id]           — materias/docentes + alumnos + export CSV
/admin/subjects
/admin/users                  — CRUD + licencias + roles por nivel
/admin/grades                 — lista + carga masiva tipo Excel
/admin/attendance             — tomar lista + historial + justificaciones + actas (tab)
/admin/attendance-detail      — resumen por alumno + ranking faltas + evolución mensual
/admin/announcements
/admin/reports                — PDF + configuración de diseño
/admin/indicators             — por materia + grado + año lectivo
/admin/evaluations            — grilla valoraciones + observaciones
/admin/syllabus               — temario múltiples unidades por período
/admin/pending                — materias pendientes + PDF RITE
/admin/convivencias           — registro + estadísticas + PDF
/superadmin/institutions      — panel superadmin: crear instituciones, cambiar plan/estado
/teacher/dashboard
/teacher/attendance
/teacher/grades
/teacher/announcements
/teacher/evaluations
/teacher/syllabus
/teacher/pending
/profile
```

### Layout compartido

Todos los roles usan `AppLayout` (`src/components/layouts/app-layout.tsx`).
La navegación cambia según el rol via `getNavigation(role)` en `navigation.ts`.

```
src/components/layouts/
├── app-layout.tsx          ← único layout para todos los roles (~35 líneas)
├── navigation.ts           ← nav por rol + getNavigation() + getDashboardHref()
└── components/
    ├── sidebar-brand.tsx   ← logo institución + nombre + subtítulo por rol
    ├── sidebar.tsx         ← nav + footer
    └── app-header.tsx      ← header + campana + avatar + dropdown

src/app/admin/layout.tsx    ← 4 líneas: <AppLayout>{children}</AppLayout>
src/app/teacher/layout.tsx  ← 4 líneas: <AppLayout>{children}</AppLayout>
```

**Navegación por rol:**

- `ADMIN / DIRECTOR / SECRETARY` — menú completo
- `PRECEPTOR` — cursos, alumnos, asistencia, convivencia, reportes, pendientes (rutas `/admin/*`)
- `TEACHER` — dashboard, asistencia, notas, comunicados, evaluaciones, temario, pendientes (rutas `/teacher/*`)

### Patrones clave

- **Timezone en fechas**: usar `date.split('T')[0].split('-').reverse().join('/')` para mostrar fechas sin conversión
- **Carga masiva de notas**: debounce 2s + pegar desde Excel + validación visual
- **Temario**: `PeriodSection` como `React.memo` FUERA del componente padre + `usePeriodSyllabus` también fuera — evita re-mount al tipear
- **Avatar**: presigned URL desde MinIO, se carga en header del layout compartido
- **Logo institución**: presigned URL desde MinIO en `SidebarBrand`. Visible para todos los roles. `staleTime: 5min`
- **PDF download**: leer `Content-Disposition` header (requiere `Access-Control-Expose-Headers: Content-Disposition` en el backend)
- **Notificaciones**: `<NotificationBell />` en `AppHeader`. Polling cada 30s.
- **Licencias**: `<LeaveBanner />` en `AppLayout`. Lee `session.user.status`. El JWT incluye `status` y `leaveStartDate`.
- **OnLeave frontend**: `useIsOnLeave()` en `src/lib/hooks/use-is-on-leave.ts`. Deshabilita botones de escritura en componentes. El interceptor de axios también bloquea mutaciones antes de enviarlas.
- **Export CSV/Excel**: usar `TextEncoder` + BOM como `Uint8Array([0xEF, 0xBB, 0xBF])` + separador `;` + `sep=;\n` al inicio del archivo para compatibilidad con Excel en español.

### Estructura de carpetas por página

Las páginas con lógica extensa se refactorizan en:

```
/admin/[ruta]/
├── page.tsx                  ← orquesta estado global (~50-90 líneas)
└── _components/
    ├── [ruta].types.ts       ← tipos, schemas, constantes compartidas
    ├── componente-1.tsx
    └── componente-n.tsx
```

Los hooks van en `src/lib/api/[modulo].ts`.

**Páginas refactorizadas:**

- `attendance` → tabs: tomar lista, historial, actas
- `attendance-detail` → tabs: resumen, ranking faltas, evolución mensual
- `courses` → dialogs: crear curso, año lectivo, período
- `courses/[id]` → cards: materias/docentes, alumnos + export CSV
- `students` → dialog: crear alumno
- `students/[id]` → cards: datos personales, cursos, tutores
- `subjects` → dialog único crear/editar
- `users` → componentes: status badge, crear, reset password, licencia, row actions
- `indicators` → componentes: filtros, lista con edición inline

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
- Usuario `ON_LEAVE` puede iniciar sesión pero no puede realizar ninguna mutación

### UserLevelRole — Roles por nivel

```prisma
model UserLevelRole {
  userId String
  level  Level    // INICIAL | PRIMARIA | SECUNDARIA
  role   Role
  @@unique([userId, level, role])
}
```

- Un usuario puede tener múltiples roles según el nivel educativo
- El rol efectivo para CASL = el más alto entre `User.role` y todos sus `UserLevelRole`
- `syncHighestRole()` actualiza `User.role` automáticamente al agregar/quitar un UserLevelRole
- Filtro en `GET /users?level=SECUNDARIA&role=TEACHER`

### Institution — Onboarding

- `POST /institutions` — crea institución + primer ADMIN (público, usado en onboarding)
- `GET /institutions/mine` — el admin ve su propia institución
- `PATCH /institutions/:id/plan` — solo SUPER_ADMIN puede cambiar plan/status
- `POST /institutions/:id/invite` — genera token de invitación (7 días)
- `POST /institutions/invitations/accept` — público, crea usuario y marca invitación como aceptada
- Logo: `POST /institutions/:id/logo` — sube a MinIO en carpeta `logos/`
- Settings editables por admin: `name`, `address`, `phone`, `logoUrl`, `settings.report`, `settings.absenceThresholds`, `settings.district`
- Settings solo SUPER_ADMIN: `plan`, `status`, `trialEndsAt`

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
