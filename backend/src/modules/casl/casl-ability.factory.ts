import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import {
  Action,
  AppAbility,
  AbilityBuilder,
  createMongoAbility,
} from './casl.types';

// ──────────────────────────────────────────────
// AbilityFactory — construye los permisos ABAC
// para cada usuario según su rol.
//
// Reglas por rol:
//
//   SUPER_ADMIN → manage all (sin restricciones)
//
//   ADMIN       → manage all dentro de su institución
//                 condición: { institutionId: user.institutionId }
//
//   TEACHER     → read entidades de su institución
//                 manage Grade y Attendance solo de sus cursos
//                 condición: { courseSubject.teacherId: user.id }
//
//   GUARDIAN    → read solo datos de sus hijos
//                 condición vía guardians join
//
// ⚠️  Las condiciones con joins (TEACHER, GUARDIAN) no pueden
//     expresarse 100% en CASL con MongoDB conditions porque
//     requieren queries relacionales. En esos casos el guard
//     pasa y la validación fina ocurre en el servicio.
//     Ver: GradesService.update() — doble check ABAC.
// ──────────────────────────────────────────────

@Injectable()
export class AbilityFactory {
  constructor(private readonly prisma: PrismaService) {}

  async createForUser(user: RequestUser): Promise<AppAbility> {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      createMongoAbility,
    );

    switch (user.role) {

      // ── SUPER_ADMIN ──────────────────────────
      case 'SUPER_ADMIN': {
        can(Action.Manage, 'all');
        break;
      }

      // ── ADMIN ────────────────────────────────
      case 'ADMIN': {
        // Puede hacer todo dentro de su institución
        can(Action.Manage, 'all', {
          institutionId: user.institutionId,
        } as any);
        // Pero no puede acceder a otras instituciones
        cannot(Action.Manage, 'all', {
          institutionId: { $ne: user.institutionId },
        } as any);
        break;
      }

      // ── TEACHER ──────────────────────────────
      case 'TEACHER': {
        // Puede leer entidades de su institución
        can(Action.Read, 'all', {
          institutionId: user.institutionId,
        } as any);

        // Puede crear/editar notas (validación fina en GradesService)
        can([Action.Create, Action.Update, Action.Delete], 'Grade', {
          institutionId: user.institutionId,
        } as any);

        // Puede registrar asistencia (validación fina en AttendanceService)
        can([Action.Create, Action.Update], 'Attendance', {
          institutionId: user.institutionId,
        } as any);

        // Puede crear anuncios en su institución
        can([Action.Create, Action.Update, Action.Delete], 'Announcement', {
          institutionId: user.institutionId,
          authorId: user.id,
        } as any);

        // NO puede modificar usuarios, instituciones ni alumnos
        cannot([Action.Create, Action.Update, Action.Delete], 'User');
        cannot([Action.Create, Action.Update, Action.Delete], 'Student');
        cannot(Action.Manage, 'Institution');
        break;
      }

      // ── GUARDIAN ─────────────────────────────
      case 'GUARDIAN': {
        // Solo puede leer — nunca escribir
        can(Action.Read, 'all', {
          institutionId: user.institutionId,
        } as any);

        // Explícitamente NO puede modificar nada
        cannot([Action.Create, Action.Update, Action.Delete], 'all');

        // La validación fina (solo sus hijos) ocurre en los servicios
        // porque requiere un JOIN con la tabla guardians
        break;
      }
    }

    return build({
      // Detectar el subject por el nombre del constructor de Prisma
      detectSubjectType: (item: any) =>
        item.constructor?.name ?? item.__typename,
    });
  }
}
