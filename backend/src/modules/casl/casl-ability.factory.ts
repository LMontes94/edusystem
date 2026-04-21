import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser }   from '../../common/decorators/current-user.decorator';
import {
  Action, AppAbility, AbilityBuilder, createMongoAbility,
} from './casl.types';
import { getHighestRole } from '../../common/utils/role-hierarchy';

@Injectable()
export class AbilityFactory {
  constructor(private readonly prisma: PrismaService) {}

  async createForUser(user: RequestUser): Promise<AppAbility> {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    // ── Resolver rol efectivo ─────────────────────
    // Obtener todos los roles del usuario (principal + por nivel)
    // y usar el de mayor jerarquía para definir permisos.
    const levelRoles = await this.prisma.userLevelRole.findMany({
      where:  { userId: user.id },
      select: { role: true },
    });

    const allRoles    = [user.role, ...levelRoles.map((lr) => lr.role as string)];
    const effectiveRole = getHighestRole(allRoles);

    switch (effectiveRole) {

      // ── SUPER_ADMIN ──────────────────────────
      case 'SUPER_ADMIN': {
        can(Action.Manage, 'all');
        break;
      }

      // ── ADMIN / DIRECTOR ─────────────────────
      case 'ADMIN':
      case 'DIRECTOR': {
        can(Action.Manage, 'all', { institutionId: user.institutionId } as any);
        cannot(Action.Manage, 'all', { institutionId: { $ne: user.institutionId } } as any);
        break;
      }

      // ── SECRETARY ────────────────────────────
      case 'SECRETARY': {
        const inst = { institutionId: user.institutionId } as any;

        can(Action.Read,   'Institution', { id: user.institutionId } as any);
        can(Action.Manage, 'Student',  inst);
        can(Action.Manage, 'Course',   inst);
        can(Action.Read,   'User',     inst);
        can(Action.Create, 'User',     inst);
        can(Action.Update, 'User', { institutionId: user.institutionId, role: 'TEACHER'   } as any);
        can(Action.Update, 'User', { institutionId: user.institutionId, role: 'PRECEPTOR' } as any);
        can(Action.Read,   'Grade',      inst);
        can(Action.Read,   'Attendance', inst);
        can(Action.Read,   'Announcement', inst);
        can(Action.Create, 'Announcement', inst);
        can(Action.Update, 'Announcement', { institutionId: user.institutionId, authorId: user.id } as any);
        can(Action.Delete, 'Announcement', { institutionId: user.institutionId, authorId: user.id } as any);

        cannot([Action.Create, Action.Update, Action.Delete], 'Grade');
        cannot(Action.Delete, 'User');
        break;
      }

      // ── PRECEPTOR ────────────────────────────
      case 'PRECEPTOR': {
        const inst = { institutionId: user.institutionId } as any;

        can(Action.Read,   'Institution', { id: user.institutionId } as any);
        can(Action.Manage, 'Student',    inst);
        can(Action.Read,   'Course',     inst);
        can(Action.Read,   'Grade',      inst);
        can(Action.Read,   'User',       inst);
        can(Action.Manage, 'Attendance', inst);
        can(Action.Read,   'Announcement', inst);
        can(Action.Create, 'Announcement', inst);
        can(Action.Update, 'Announcement', { institutionId: user.institutionId, authorId: user.id } as any);
        can(Action.Delete, 'Announcement', { institutionId: user.institutionId, authorId: user.id } as any);
        can(Action.Manage, 'Convivencia');

        cannot([Action.Create, Action.Update, Action.Delete], 'User');
        cannot([Action.Create, Action.Update, Action.Delete], 'Grade');
        cannot([Action.Create, Action.Update, Action.Delete], 'Course');
        break;
      }

      // ── TEACHER ──────────────────────────────
      case 'TEACHER': {
        const inst = { institutionId: user.institutionId } as any;

        can(Action.Update, 'User', { id: user.id } as any);
        can(Action.Read,   'all',  inst);
        can([Action.Create, Action.Update, Action.Delete], 'Grade',      inst);
        can([Action.Create, Action.Update],                'Attendance', inst);
        can([Action.Create, Action.Update, Action.Delete], 'Announcement', {
          institutionId: user.institutionId,
          authorId:      user.id,
        } as any);

        cannot([Action.Create, Action.Update, Action.Delete], 'User');
        cannot([Action.Create, Action.Update, Action.Delete], 'Student');
        cannot(Action.Manage, 'Institution');
        break;
      }

      // ── GUARDIAN ─────────────────────────────
      case 'GUARDIAN': {
        const inst = { institutionId: user.institutionId } as any;
        can(Action.Read, 'all', inst);
        cannot([Action.Create, Action.Update, Action.Delete], 'all');
        break;
      }
    }

    return build({
      detectSubjectType: (item: any) => item.constructor?.name ?? item.__typename,
    });
  }
}