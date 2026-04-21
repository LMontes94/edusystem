import {
  ConflictException, ForbiddenException, Injectable,
  Logger, NotFoundException, BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser }   from '../../common/decorators/current-user.decorator';
import {
  CreateInstitutionDto, UpdateInstitutionDto,
  InviteUserDto, UpdatePlanDto,
} from './dto/institution.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class InstitutionsService {
  private readonly logger = new Logger(InstitutionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Crear institución + primer ADMIN ──────────
  async create(dto: CreateInstitutionDto) {
    if (dto.domain) {
      const existing = await this.prisma.institution.findUnique({
        where: { domain: dto.domain },
      });
      if (existing) throw new ConflictException(`El dominio ${dto.domain} ya está registrado`);
    }

    return this.prisma.$transaction(async (tx) => {
      const institution = await tx.institution.create({
        data: {
          name:    dto.name,
          domain:  dto.domain,
          address: dto.address,
          phone:   dto.phone,
          status:  'TRIAL',
          plan:    'FREE',
          trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
        },
      });

      const passwordHash = await bcrypt.hash(dto.adminPassword, 12);
      const admin = await tx.user.create({
        data: {
          institutionId: institution.id,
          email:         dto.adminEmail,
          passwordHash,
          firstName:     dto.adminFirstName,
          lastName:      dto.adminLastName,
          role:          'ADMIN',
          status:        'ACTIVE',
        },
      });

      this.logger.log(`Institución creada: ${institution.name} (${institution.id}) — Admin: ${admin.email}`);

      return {
        institution,
        admin: {
          id: admin.id, email: admin.email,
          firstName: admin.firstName, lastName: admin.lastName, role: admin.role,
        },
      };
    });
  }

  // ── Obtener institución ───────────────────────
  async findOne(id: string, user: RequestUser) {
    if (user.role !== 'SUPER_ADMIN' && user.institutionId !== id) {
      throw new ForbiddenException();
    }

    const institution = await this.prisma.institution.findUnique({
      where:   { id },
      include: { _count: { select: { users: true, students: true, courses: true } } },
    });
    if (!institution) throw new NotFoundException('Institución no encontrada');
    return institution;
  }

  // ── Obtener institución propia (para el admin) ─
  async findMine(user: RequestUser) {
    if (!user.institutionId) throw new ForbiddenException();
    return this.findOne(user.institutionId, user);
  }

  // ── Listar (solo SUPER_ADMIN) ─────────────────
  async findAll() {
    return this.prisma.institution.findMany({
      where:   { deletedAt: null },
      include: { _count: { select: { users: true, students: true, courses: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Actualizar datos básicos ──────────────────
  // Admin puede editar: name, address, phone, logoUrl, settings
  // SUPER_ADMIN puede editar todo incluyendo plan y status
  async update(id: string, dto: UpdateInstitutionDto, user: RequestUser) {
    if (user.role !== 'SUPER_ADMIN' && user.institutionId !== id) {
      throw new ForbiddenException();
    }

    const institution = await this.prisma.institution.findUnique({ where: { id } });
    if (!institution) throw new NotFoundException('Institución no encontrada');

    // Admin NO puede cambiar plan ni status
    if (user.role !== 'SUPER_ADMIN') {
      if (dto.plan || dto.status || dto.trialEndsAt) {
        throw new ForbiddenException('No tenés permisos para modificar el plan o estado');
      }
    }

    // Merge de settings — no pisar keys existentes
    let newSettings = institution.settings as any ?? {};
    if (dto.settings) {
      newSettings = { ...newSettings, ...dto.settings };
      if (dto.settings.report) {
        newSettings.report = { ...(newSettings.report ?? {}), ...dto.settings.report };
      }
    }

    return this.prisma.institution.update({
      where: { id },
      data: {
        ...(dto.name    && { name:    dto.name    }),
        ...(dto.domain  && { domain:  dto.domain  }),
        ...(dto.address && { address: dto.address }),
        ...(dto.phone   && { phone:   dto.phone   }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.plan        && { plan:        dto.plan        }),
        ...(dto.status      && { status:      dto.status      }),
        ...(dto.trialEndsAt && { trialEndsAt: new Date(dto.trialEndsAt) }),
        settings: newSettings,
      },
    });
  }

  // ── Actualizar plan (solo SUPER_ADMIN) ────────
  async updatePlan(id: string, dto: UpdatePlanDto, user: RequestUser) {
    if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Solo el super admin puede cambiar el plan');
    }
    const institution = await this.prisma.institution.findUnique({ where: { id } });
    if (!institution) throw new NotFoundException('Institución no encontrada');

    return this.prisma.institution.update({
      where: { id },
      data: {
        plan:        dto.plan,
        status:      dto.status      ?? institution.status,
        trialEndsAt: dto.trialEndsAt ? new Date(dto.trialEndsAt) : institution.trialEndsAt,
      },
    });
  }

  // ── Invitar usuario ───────────────────────────
  async invite(institutionId: string, dto: InviteUserDto, user: RequestUser) {
    if (user.role !== 'SUPER_ADMIN' && user.institutionId !== institutionId) {
      throw new ForbiddenException();
    }

    const institution = await this.prisma.institution.findUnique({ where: { id: institutionId } });
    if (!institution) throw new NotFoundException('Institución no encontrada');

    // Verificar que no haya una invitación pendiente para ese email
    const existing = await this.prisma.invitation.findFirst({
      where: {
        institutionId,
        email:      dto.email,
        acceptedAt: null,
        expiresAt:  { gt: new Date() },
      },
    });
    if (existing) throw new ConflictException('Ya existe una invitación pendiente para ese email');

    const token     = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

    const invitation = await this.prisma.invitation.create({
      data: { institutionId, email: dto.email, role: dto.role, token, expiresAt },
    });

    // TODO: enviar email con link de invitación
    // Link: process.env.FRONTEND_URL + '/invite/accept?token=' + token
    this.logger.log(`Invitación creada: ${dto.email} (${dto.role}) → ${institutionId}`);

    return {
      id:         invitation.id,
      email:      invitation.email,
      role:       invitation.role,
      expiresAt:  invitation.expiresAt,
      inviteLink: `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/invite/accept?token=${token}`,
      ...(process.env.NODE_ENV === 'development' && { token }),
    };
  }

  // ── Listar invitaciones de una institución ────
  async findInvitations(institutionId: string, user: RequestUser) {
    if (user.role !== 'SUPER_ADMIN' && user.institutionId !== institutionId) {
      throw new ForbiddenException();
    }
    return this.prisma.invitation.findMany({
      where:   { institutionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Revocar invitación ────────────────────────
  async revokeInvitation(institutionId: string, invitationId: string, user: RequestUser) {
    if (user.role !== 'SUPER_ADMIN' && user.institutionId !== institutionId) {
      throw new ForbiddenException();
    }
    const inv = await this.prisma.invitation.findFirst({
      where: { id: invitationId, institutionId },
    });
    if (!inv) throw new NotFoundException('Invitación no encontrada');
    if (inv.acceptedAt) throw new BadRequestException('La invitación ya fue aceptada');

    await this.prisma.invitation.delete({ where: { id: invitationId } });
    return { message: 'Invitación revocada' };
  }

  // ── Aceptar invitación (endpoint público) ─────
  async acceptInvitation(token: string, data: {
    firstName: string;
    lastName:  string;
    password:  string;
  }) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { token },
      include: { institution: true },
    });

    if (!invitation)           throw new NotFoundException('Invitación no encontrada');
    if (invitation.acceptedAt) throw new BadRequestException('Esta invitación ya fue utilizada');
    if (invitation.expiresAt < new Date()) throw new BadRequestException('La invitación expiró');

    // Verificar que el email no esté en uso
    const existing = await this.prisma.user.findFirst({
      where: { email: invitation.email, institutionId: invitation.institutionId },
    });
    if (existing) throw new ConflictException('El email ya está registrado en esta institución');

    return this.prisma.$transaction(async (tx) => {
      const passwordHash = await bcrypt.hash(data.password, 12);

      const user = await tx.user.create({
        data: {
          institutionId: invitation.institutionId,
          email:         invitation.email,
          passwordHash,
          firstName:     data.firstName,
          lastName:      data.lastName,
          role:          invitation.role,
          status:        'ACTIVE',
        },
        select: {
          id: true, email: true, firstName: true, lastName: true, role: true,
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data:  { acceptedAt: new Date() },
      });

      this.logger.log(`Invitación aceptada: ${user.email} (${user.role}) → ${invitation.institutionId}`);
      return { user, institution: invitation.institution };
    });
  }

  // ── Stats del tenant ──────────────────────────
  async getStats(institutionId: string) {
    const now      = new Date();
    const todayStr = now.toLocaleDateString('en-CA');
    const [y, m, d] = todayStr.split('-').map(Number);
    const todayUTC    = new Date(Date.UTC(y, m - 1, d, 0,  0, 0));
    const tomorrowUTC = new Date(Date.UTC(y, m - 1, d, 23, 59, 59));

    const [students, users, courses, attendanceToday, recentGrades, recentAnnouncements] =
      await Promise.all([
        this.prisma.student.count({ where: { institutionId, deletedAt: null } }),
        this.prisma.user.groupBy({
          by: ['role'], where: { institutionId, deletedAt: null }, _count: { id: true },
        }),
        this.prisma.course.count({ where: { institutionId, schoolYear: { isActive: true } } }),
        this.prisma.attendance.groupBy({
          by: ['status'],
          where: { course: { institutionId }, date: { gte: todayUTC, lte: tomorrowUTC } },
          _count: { id: true },
        }),
        this.prisma.grade.findMany({
          where:   { student: { institutionId } },
          orderBy: { createdAt: 'desc' },
          take:    5,
          include: {
            student:       { select: { firstName: true, lastName: true } },
            courseSubject: { include: { subject: { select: { name: true } } } },
            period:        { select: { name: true } },
          },
        }),
        this.prisma.announcement.findMany({
          where:   { institutionId, publishedAt: { not: null }, deletedAt: null },
          orderBy: { publishedAt: 'desc' },
          take:    3,
          include: {
            author: { select: { firstName: true, lastName: true } },
            course: { select: { name: true } },
          },
        }),
      ]);

    const totalAttendance = attendanceToday.reduce((sum, a) => sum + a._count.id, 0);
    const presentCount    = attendanceToday.find((a) => a.status === 'PRESENT')?._count.id ?? 0;
    const attendanceRate  = totalAttendance > 0
      ? Math.round((presentCount / totalAttendance) * 100)
      : null;

    return {
      students,
      courses,
      users:           Object.fromEntries(users.map((u) => [u.role, u._count.id])),
      totalUsers:      users.reduce((sum, u) => sum + u._count.id, 0),
      attendanceRate,
      attendanceTotal: totalAttendance,
      recentGrades,
      recentAnnouncements,
    };
  }
}