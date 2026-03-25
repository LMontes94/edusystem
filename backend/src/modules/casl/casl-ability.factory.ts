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
// Roles y permisos:
//
//   SUPER_ADMIN → manage all (sin restricciones de tenant)
//
//   ADMIN / DIRECTOR → manage all dentro de su institución
//
//   SECRETARY   → manage Student, Course, User (solo TEACHER/PRECEPTOR)
//                 read Grade, Attendance
//                 create Announcement
//
//   PRECEPTOR   → manage Student
//                 read Course, Grade, Announcement
//                 manage Attendance
//                 create Announcement
//
//   TEACHER     → read entidades de su institución
//                 manage Grade y Attendance de sus cursos
//                 create Announcement de sus cursos
//
//   GUARDIAN    → read solo datos de los cursos de sus hijos
//                 validación fina en los servicios
//
//   Las condiciones con joins (TEACHER, GUARDIAN) no pueden
//     expresarse 100% en CASL con MongoDB conditions porque
//     requieren queries relacionales. En esos casos el guard
//     pasa y la validación fina ocurre en el servicio.
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

      // ── ADMIN / DIRECTOR ─────────────────────
      case 'ADMIN':
      case 'DIRECTOR': {
        can(Action.Manage, 'all', {
          institutionId: user.institutionId,
        } as any);
        cannot(Action.Manage, 'all', {
          institutionId: { $ne: user.institutionId },
        } as any);
        break;
      }

      // ── SECRETARY ────────────────────────────
      case 'SECRETARY': {
        const inst = { institutionId: user.institutionId } as any;

        // Puede ver su institución
        can(Action.Read, 'Institution', { id: user.institutionId } as any);

        // Gestión completa de alumnos y cursos
        can(Action.Manage, 'Student',  inst);
        can(Action.Manage, 'Course',   inst);

        // Usuarios: puede ver y crear, pero solo editar TEACHER y PRECEPTOR
        can(Action.Read,   'User', inst);
        can(Action.Create, 'User', inst);
        can(Action.Update, 'User', { institutionId: user.institutionId, role: 'TEACHER'   } as any);
        can(Action.Update, 'User', { institutionId: user.institutionId, role: 'PRECEPTOR' } as any);

        // Solo lectura de notas y asistencia
        can(Action.Read, 'Grade',      inst);
        can(Action.Read, 'Attendance', inst);

        // Comunicados: puede crear y leer
        can(Action.Read,   'Announcement', inst);
        can(Action.Create, 'Announcement', inst);
        can(Action.Update, 'Announcement', { institutionId: user.institutionId, authorId: user.id } as any);
        can(Action.Delete, 'Announcement', { institutionId: user.institutionId, authorId: user.id } as any);

        // NO puede modificar notas ni borrar usuarios
        cannot([Action.Create, Action.Update, Action.Delete], 'Grade');
        cannot(Action.Delete, 'User');
        break;
      }

      // ── PRECEPTOR ────────────────────────────
      case 'PRECEPTOR': {
        const inst = { institutionId: user.institutionId } as any;

        can(Action.Read, 'Institution', { id: user.institutionId } as any);

        // Gestión completa de alumnos
        can(Action.Manage, 'Student', inst);

        // Solo lectura de cursos, notas y usuarios
        can(Action.Read, 'Course', inst);
        can(Action.Read, 'Grade',  inst);
        can(Action.Read, 'User',   inst);

        // Gestión completa de asistencia
        can(Action.Manage, 'Attendance', inst);

        // Comunicados: puede crear y leer
        can(Action.Read,   'Announcement', inst);
        can(Action.Create, 'Announcement', inst);
        can(Action.Update, 'Announcement', { institutionId: user.institutionId, authorId: user.id } as any);
        can(Action.Delete, 'Announcement', { institutionId: user.institutionId, authorId: user.id } as any);

        // NO puede modificar usuarios, notas ni cursos
        cannot([Action.Create, Action.Update, Action.Delete], 'User');
        cannot([Action.Create, Action.Update, Action.Delete], 'Grade');
        cannot([Action.Create, Action.Update, Action.Delete], 'Course');
        break;
      }

      // ── TEACHER ──────────────────────────────
      case 'TEACHER': {
        const inst = { institutionId: user.institutionId } as any;

        // Puede leer entidades de su institución
        can(Action.Read, 'all', inst);

        // Puede crear/editar notas (validación fina en GradesService)
        can([Action.Create, Action.Update, Action.Delete], 'Grade', inst);

        // Puede registrar asistencia (validación fina en AttendanceService)
        can([Action.Create, Action.Update], 'Attendance', inst);

        // Puede crear anuncios solo de sus cursos
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
        const inst = { institutionId: user.institutionId } as any;

        // Solo puede leer — nunca escribir
        can(Action.Read, 'all', inst);

        // Explícitamente NO puede modificar nada
        cannot([Action.Create, Action.Update, Action.Delete], 'all');

        // La validación fina (solo sus hijos y sus cursos) ocurre en los servicios
        // porque requiere un JOIN con la tabla guardians y courseStudents
        break;
      }
    }

    return build({
      detectSubjectType: (item: any) =>
        item.constructor?.name ?? item.__typename,
    });
  }
}