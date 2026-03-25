import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';
import {
  CreateInstitutionDto,
  UpdateInstitutionDto,
  InviteUserDto,
} from './dto/institution.dto';
import { randomBytes } from 'crypto';

// ──────────────────────────────────────────────
// InstitutionsService
//
// create()  → crea institución + primer ADMIN
//             en una sola transacción atómica.
//             Solo SUPER_ADMIN puede hacerlo.
//
// findOne() → SUPER_ADMIN ve cualquiera,
//             ADMIN solo ve la suya.
//
// update()  → SUPER_ADMIN o ADMIN propio.
//
// invite()  → genera token de invitación para
//             que un nuevo usuario se registre.
// ──────────────────────────────────────────────

@Injectable()
export class InstitutionsService {
  private readonly logger = new Logger(InstitutionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Crear institución + primer ADMIN ────────
  async create(dto: CreateInstitutionDto) {
    // Verificar que el dominio no esté ocupado
    if (dto.domain) {
      const existing = await this.prisma.institution.findUnique({
        where: { domain: dto.domain },
      });
      if (existing) {
        throw new ConflictException(`El dominio ${dto.domain} ya está registrado`);
      }
    }

    // Verificar que el email del admin no esté en uso en esta institución
    // (no podemos verificar institutionId aún porque la institución no existe)
    // La transacción se encarga de que sea atómica

    return this.prisma.$transaction(async (tx) => {
      // 1. Crear la institución
      const institution = await tx.institution.create({
        data: {
          name: dto.name,
          domain: dto.domain,
          address: dto.address,
          phone: dto.phone,
          status: 'TRIAL',
          plan: 'FREE',
        },
      });

      // 2. Crear el primer ADMIN
      const passwordHash = await bcrypt.hash(dto.adminPassword, 12);

      const admin = await tx.user.create({
        data: {
          institutionId: institution.id,
          email: dto.adminEmail,
          passwordHash,
          firstName: dto.adminFirstName,
          lastName: dto.adminLastName,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });

      this.logger.log(
        `Institución creada: ${institution.name} (${institution.id}) — Admin: ${admin.email}`,
      );

      return {
        institution,
        admin: {
          id: admin.id,
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: admin.role,
        },
      };
    });
  }

  // ── Obtener institución ──────────────────────
  async findOne(id: string, user: RequestUser) {
    // ADMIN solo puede ver su propia institución
    if (user.role === 'ADMIN' && user.institutionId !== id) {
      throw new ForbiddenException();
    }

    const institution = await this.prisma.institution.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            students: true,
            courses: true,
          },
        },
      },
    });

    if (!institution) {
      throw new NotFoundException('Institución no encontrada');
    }

    return institution;
  }

  // ── Listar instituciones (solo SUPER_ADMIN) ──
  async findAll() {
    return this.prisma.institution.findMany({
      where: { deletedAt: null },
      include: {
        _count: {
          select: { users: true, students: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Actualizar ───────────────────────────────
  async update(id: string, dto: UpdateInstitutionDto, user: RequestUser) {
    if (user.role === 'ADMIN' && user.institutionId !== id) {
      throw new ForbiddenException();
    }

    const institution = await this.prisma.institution.findUnique({
      where: { id },
    });

    if (!institution) {
      throw new NotFoundException('Institución no encontrada');
    }

    return this.prisma.institution.update({
      where: { id },
      data: {
        ...dto,
        settings: dto.settings ? (dto.settings as object) : undefined,
      },
    });
  }

  // ── Invitar usuario ──────────────────────────
  async invite(institutionId: string, dto: InviteUserDto, user: RequestUser) {
    if (user.role === 'ADMIN' && user.institutionId !== institutionId) {
      throw new ForbiddenException();
    }

    // Verificar que la institución existe
    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
    });

    if (!institution) {
      throw new NotFoundException('Institución no encontrada');
    }

    // Generar token de invitación
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 días

    const invitation = await this.prisma.invitation.create({
      data: {
        institutionId,
        email: dto.email,
        role: dto.role,
        token,
        expiresAt,
      },
    });

    // TODO Fase 6: emitir job para enviar email con el link de invitación
    // await this.notificationQueue.add('invitation.created', { invitationId: invitation.id })

    this.logger.log(
      `Invitación creada: ${dto.email} (${dto.role}) → institución ${institutionId}`,
    );

    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      // En desarrollo devolvemos el token para facilitar pruebas
      ...(process.env.NODE_ENV === 'development' && { token }),
    };
  }

  // ── Stats del tenant ─────────────────────────
  async getStats(institutionId: string) {
  const now      = new Date();
  const todayStr = now.toLocaleDateString('en-CA'); // formato YYYY-MM-DD
  const [y, m, d] = todayStr.split('-').map(Number);
  const todayUTC    = new Date(Date.UTC(y, m - 1, d, 0,  0, 0));
  const tomorrowUTC = new Date(Date.UTC(y, m - 1, d, 23, 59, 59));

  const [students, users, courses, attendanceToday, recentGrades, recentAnnouncements] =
    await Promise.all([
      // Total alumnos activos
      this.prisma.student.count({
        where: { institutionId, deletedAt: null },
      }),

      // Usuarios por rol
      this.prisma.user.groupBy({
        by: ['role'],
        where: { institutionId, deletedAt: null },
        _count: { id: true },
      }),

      // Cursos del año lectivo activo
      this.prisma.course.count({
        where: { institutionId, schoolYear: { isActive: true } },
      }),

      // Asistencia de hoy
      this.prisma.attendance.groupBy({
        by: ['status'],
        where: {
          course: { institutionId },
          date: { gte: todayUTC, lte: tomorrowUTC },
        },
      _count: { id: true },
      }),

      // Últimas 5 notas
      this.prisma.grade.findMany({
        where: { student: { institutionId } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          student:       { select: { firstName: true, lastName: true } },
          courseSubject: { include: { subject: { select: { name: true } } } },
          period:        { select: { name: true } },
        },
      }),

      // Últimos 3 comunicados publicados
      this.prisma.announcement.findMany({
        where: { institutionId, publishedAt: { not: null }, deletedAt: null },
        orderBy: { publishedAt: 'desc' },
        take: 3,
        include: {
          author: { select: { firstName: true, lastName: true } },
          course: { select: { name: true } },
        },
      }),
    ]);

  // Calcular porcentaje de asistencia
  const totalAttendance = attendanceToday.reduce((sum, a) => sum + a._count.id, 0);
  const presentCount    = attendanceToday.find((a) => a.status === 'PRESENT')?._count.id ?? 0;
  const attendanceRate  = totalAttendance > 0
    ? Math.round((presentCount / totalAttendance) * 100)
    : null;

  // Mapear usuarios por rol
  const usersByRole = Object.fromEntries(
    users.map((u) => [u.role, u._count.id]),
  );

  return {
    students,
    courses,
    users:          usersByRole,
    totalUsers:     users.reduce((sum, u) => sum + u._count.id, 0),
    attendanceRate,
    attendanceTotal: totalAttendance,
    recentGrades,
    recentAnnouncements,
  };
}
}