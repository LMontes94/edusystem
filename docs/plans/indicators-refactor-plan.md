# Plan: Indicadores Module — Auditoría y Refactor

## Decisiones Confirmadas

### CASL — Nuevos Sujetos: `Indicator`, `StudentObservation`

| Rol | Indicator | StudentObservation |
|-----|-----------|-------------------|
| SUPER_ADMIN | Manage | Manage |
| ADMIN | Manage | Manage |
| DIRECTOR | Manage | Manage |
| SECRETARY | Read | Manage |
| PRECEPTOR | Read | Manage |
| TEACHER | Read | Create + Read + Update |
| GUARDIAN | Read | Read |

### Cambios Requeridos

## Fase A — CASL Types + Ability Factory

### `casl.types.ts`
- Agregar `'Indicator'` y `'StudentObservation'` al union type `Subjects`

### `casl-ability.factory.ts`
En cada bloque de rol, agregar:

- **SECRETARY** (después de `cannot([Action.Create, Action.Update, Action.Delete], 'PendingSubject')`):
  ```
  can(Action.Read, 'Indicator');
  cannot([Action.Create, Action.Update, Action.Delete], 'Indicator');
  can(Action.Manage, 'StudentObservation', inst);
  ```

- **PRECEPTOR** (después de `cannot([Action.Create, Action.Update, Action.Delete], 'PendingSubject')`):
  ```
  can(Action.Read, 'Indicator');
  cannot([Action.Create, Action.Update, Action.Delete], 'Indicator');
  can(Action.Manage, 'StudentObservation', inst);
  ```

- **TEACHER** (después de `cannot(Action.Delete, 'PendingSubject')`):
  ```
  can(Action.Read, 'Indicator');
  cannot([Action.Create, Action.Update, Action.Delete], 'Indicator');
  can([Action.Create, Action.Read, Action.Update], 'StudentObservation', inst);
  cannot(Action.Delete, 'StudentObservation');
  ```

## Fase B — DTOs

### `dto/create-indicator.dto.ts`
```typescript
import { z } from 'zod';

export const CreateIndicatorSchema = z.object({
  subjectId:    z.string().uuid(),
  schoolYearId: z.string().uuid(),
  grade:        z.coerce.number().int().min(1),
  description:  z.string().min(1, 'Requerido').max(300),
  order:        z.coerce.number().int().min(1).optional(),
}).strict();
export type CreateIndicatorDto = z.infer<typeof CreateIndicatorSchema>;
```

### `dto/update-indicator.dto.ts`
```typescript
import { z } from 'zod';

export const UpdateIndicatorSchema = z.object({
  description: z.string().min(1, 'Requerido').max(300),
}).strict();
export type UpdateIndicatorDto = z.infer<typeof UpdateIndicatorSchema>;
```

### `dto/reorder-indicators.dto.ts`
```typescript
import { z } from 'zod';

export const ReorderIndicatorsSchema = z.object({
  ids: z.array(z.string().uuid()).min(2),
}).strict();
export type ReorderIndicatorsDto = z.infer<typeof ReorderIndicatorsSchema>;
```

### `dto/bulk-evaluations.dto.ts`
```typescript
import { z } from 'zod';
import { EvaluationValue } from './indicator.dto';

export const BulkEvaluationSchema = z.object({
  evaluations: z.array(z.object({
    indicatorId: z.string().uuid(),
    studentId:   z.string().uuid(),
    periodId:    z.string().uuid(),
    value:       EvaluationValue,
  })).min(1, 'Debe haber al menos una evaluación'),
}).strict();
export type BulkEvaluationDto = z.infer<typeof BulkEvaluationSchema>;
```

### `dto/upsert-observation.dto.ts`
```typescript
import { z } from 'zod';

export const UpsertObservationSchema = z.object({
  studentId:   z.string().uuid(),
  periodId:    z.string().uuid(),
  courseId:    z.string().uuid(),
  subjectId:   z.string().uuid().optional(),
  observation: z.string().min(1, 'La observación no puede estar vacía').max(500),
}).strict();
export type UpsertObservationDto = z.infer<typeof UpsertObservationSchema>;
```

## Fase C — Module Registration

### `indicators.module.ts`
Agregar imports:
```typescript
import { BullModule } from '@nestjs/bull';
import { QUEUES } from '../../queues/queue.constants';
// En @Module.imports:
BullModule.registerQueue({ name: QUEUES.AUDIT }),
```

## Fase D — Service Layer

### `indicators.service.ts`

**Nuevas dependencias:**
```typescript
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { QUEUES, JOBS, JOB_OPTIONS } from '../../queues/queue.constants';

constructor(
  private readonly prisma: PrismaService,
  @InjectQueue(QUEUES.AUDIT) private readonly auditQueue: Queue,
) {}
```

**Nuevos helpers privados de multitenencia:**
```typescript
private async assertIndicatorBelongsToInstitution(
  indicatorId: string, institutionId: string,
): Promise<void> {
  const indicator = await this.prisma.indicator.findUnique({
    where: { id: indicatorId },
    include: { subject: { select: { institutionId: true } } },
  });
  if (!indicator || indicator.subject.institutionId !== institutionId) {
    throw new NotFoundException('Indicador no encontrado');
  }
}

private async assertCourseBelongsToInstitution(
  courseId: string, institutionId: string,
): Promise<void> {
  const course = await this.prisma.course.findUnique({
    where: { id: courseId },
    select: { institutionId: true },
  });
  if (!course || course.institutionId !== institutionId) {
    throw new NotFoundException('Curso no encontrado');
  }
}

private async assertStudentBelongsToInstitution(
  studentId: string, institutionId: string,
): Promise<void> {
  const student = await this.prisma.student.findUnique({
    where: { id: studentId },
    select: { institutionId: true },
  });
  if (!student || student.institutionId !== institutionId) {
    throw new NotFoundException('Estudiante no encontrado');
  }
}
```

**Métodos modificados (resumen de cambios por endpoint):**

| Método | Valida | Auditoría |
|--------|--------|-----------|
| `findAll` | Subject → institutionId | — |
| `create` | Subject → institutionId | CREATE Indicator |
| `update` | Indicator → Subject → institutionId | UPDATE Indicator |
| `reorder` | All indicator IDs → Subject → institutionId | UPDATE Indicator (batch) |
| `remove` | Indicator → Subject → institutionId | DELETE Indicator |
| `getCourseEvaluations` | Course → institutionId (ya existe) | — |
| `getStudentEvaluations` | Student → institutionId | — |
| `bulkUpsertEvaluations` | All indicators → institutionId | UPDATE IndicatorEvaluation (batch) |
| `upsertObservation` | Course → institutionId | CREATE/UPDATE StudentObservation |
| `getCourseObservations` | Course → institutionId | — |

**Patrón de auditoría (ejemplo para create):**
```typescript
async create(dto: CreateIndicatorDto, institutionId: string, userId: string) {
  const subject = await this.prisma.subject.findUnique({
    where: { id: dto.subjectId },
    select: { institutionId: true },
  });
  if (!subject || subject.institutionId !== institutionId) {
    throw new NotFoundException('Materia no encontrada');
  }

  const order = dto.order ?? ((await this.prisma.indicator.findFirst({
    where: { subjectId: dto.subjectId, schoolYearId: dto.schoolYearId },
    orderBy: { order: 'desc' },
  }))?.order ?? 0) + 1;

  const indicator = await this.prisma.indicator.create({
    data: { ...dto, order },
  });

  await this.auditQueue.add(
    JOBS.AUDIT_LOG,
    { institutionId, userId, action: 'CREATE', resource: 'Indicator', resourceId: indicator.id, after: indicator },
    JOB_OPTIONS.CRITICAL,
  );

  return indicator;
}
```

**Patrón de auditoría batch (para bulkUpsertEvaluations):**
```typescript
const uniqueStudents = new Set(evaluations.map(e => e.studentId));
const uniqueIndicators = new Set(evaluations.map(e => e.indicatorId));
const periodId = evaluations[0].periodId;

// Validar todos los indicators pertenecen a la institución
const indicatorIds = [...uniqueIndicators];
const found = await this.prisma.indicator.findMany({
  where: { id: { in: indicatorIds } },
  include: { subject: { select: { institutionId: true } } },
});
if (found.length !== indicatorIds.length || found.some(i => i.subject.institutionId !== institutionId)) {
  throw new NotFoundException('Algunos indicadores no pertenecen a esta institución');
}

// upsert de todas las evaluaciones
await Promise.all(evaluations.map(e => this.upsertEvaluation(e)));

// Auditoría batch
await this.auditQueue.add(
  JOBS.AUDIT_LOG,
  {
    institutionId,
    userId,
    action: 'UPDATE',
    resource: 'IndicatorEvaluation',
    resourceId: `bulk@${periodId}`,
    after: { affectedStudents: uniqueStudents.size, affectedIndicators: uniqueIndicators.size, periodId },
  },
  JOB_OPTIONS.CRITICAL,
);
```

**Error handling para Prisma P2025 (registro no encontrado):**
Envolver `update`, `delete` con try-catch:
```typescript
try {
  return await this.prisma.indicator.update({ where: { id }, data: { description } });
} catch (err) {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    throw new NotFoundException('Indicador no encontrado');
  }
  throw err;
}
```

## Fase E — Controller

### `indicators.controller.ts`

| Endpoint | CASL Subject | InstitutionId | ZodPipe |
|----------|-------------|---------------|---------|
| GET `/` | `Read Indicator` | Agregar | — |
| POST `/` | `Create Indicator` | Agregar | `CreateIndicatorSchema` |
| PATCH `/:id` | `Update Indicator` | Agregar | `UpdateIndicatorSchema` |
| POST `/reorder` | `Update Indicator` | Agregar | `ReorderIndicatorsSchema` |
| DELETE `/:id` | `Delete Indicator` | Agregar | — |
| GET `/course/:courseId` | `Read Indicator` | Ya tiene | — |
| GET `/student/:studentId` | `Read StudentObservation` | Agregar | — |
| POST `/evaluations/bulk` | `Update IndicatorEvaluation` | Agregar | `BulkEvaluationSchema` |
| POST `/observations` | `Create StudentObservation` | Agregar | `UpsertObservationSchema` |
| GET `/observations/:courseId` | `Read StudentObservation` | Agregar | — |

**Patrón de endpoint (ejemplo):**
```typescript
@Post()
@CheckAbility({ action: Action.Create, subject: 'Indicator' })
create(
  @Body(new ZodPipe(CreateIndicatorSchema)) dto: CreateIndicatorDto,
  @InstitutionId() institutionId: string,
  @CurrentUser() user: RequestUser,
) {
  return this.indicatorsService.create(dto, institutionId, user.id);
}
```

**Ver también:** `getStudentEvaluations` debe validar `Student` scoping:
```typescript
@Get('student/:studentId')
@CheckAbility({ action: Action.Read, subject: 'StudentObservation' })
getStudentEvaluations(
  @Param('studentId') studentId: string,
  @Query('schoolYearId') schoolYearId: string,
  @InstitutionId() institutionId: string,
) {
  return this.indicatorsService.getStudentEvaluations(studentId, schoolYearId, institutionId);
}
```

## Resumen de Archivos a Modificar/Crear

1. `backend/src/modules/casl/casl.types.ts` — Subjects union
2. `backend/src/modules/casl/casl-ability.factory.ts` — Permission rules
3. `backend/src/modules/indicators/dto/indicator.dto.ts` — Mantener (EvaluationValue, BulkEvaluationSchema)
4. `backend/src/modules/indicators/dto/create-indicator.dto.ts` — Nuevo
5. `backend/src/modules/indicators/dto/update-indicator.dto.ts` — Nuevo
6. `backend/src/modules/indicators/dto/reorder-indicators.dto.ts` — Nuevo
7. `backend/src/modules/indicators/dto/upsert-observation.dto.ts` — Nuevo (reemplaza CreateObservationSchema)
8. `backend/src/modules/indicators/indicators.module.ts` — Agregar BullModule
9. `backend/src/modules/indicators/indicators.service.ts` — Refactor mayor
10. `backend/src/modules/indicators/indicators.controller.ts` — Refactor endpoints
