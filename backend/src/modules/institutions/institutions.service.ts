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
  async getStats(id: string, user: RequestUser) {
    if (user.role === 'ADMIN' && user.institutionId !== id) {
      throw new ForbiddenException();
    }

    const [users, students, courses] = await Promise.all([
      this.prisma.user.count({ where: { institutionId: id } }),
      this.prisma.student.count({ where: { institutionId: id } }),
      this.prisma.course.count({ where: { institutionId: id } }),
    ]);

    return { users, students, courses };
  }
}
