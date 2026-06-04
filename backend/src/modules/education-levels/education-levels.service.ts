import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUES, JOBS, JOB_OPTIONS } from '../../queues/queue.constants';
import type { CreateEducationLevelDto } from './dto/create-education-level.dto';
import type { UpdateEducationLevelDto } from './dto/update-education-level.dto';
import type { CreateLevelGradeDto } from './dto/create-level-grade.dto';
import type { UpdateLevelGradeDto } from './dto/update-level-grade.dto';

@Injectable()
export class EducationLevelsService {
  private readonly logger = new Logger(EducationLevelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.AUDIT) private readonly auditQueue: Queue,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────

  private async assertLevelBelongsToInstitution(
    id: string,
    institutionId: string,
  ) {
    const level = await this.prisma.educationLevel.findUnique({
      where: { id },
      select: { id: true, institutionId: true },
    });
    if (!level || level.institutionId !== institutionId) {
      throw new NotFoundException('Nivel educativo no encontrado');
    }
    return level.id;
  }

  private async assertGradeBelongsToInstitution(
    id: string,
    educationLevelId: string,
    institutionId: string,
  ) {
    const grade = await this.prisma.levelGrade.findUnique({
      where: { id },
      select: { id: true, educationLevelId: true },
    });
    if (!grade) {
      throw new NotFoundException('Grado no encontrado');
    }
    if (grade.educationLevelId !== educationLevelId) {
      throw new NotFoundException('Grado no encontrado en este nivel');
    }
    return grade;
  }

  // ── EducationLevel CRUD ─────────────────────────────────────

  async findAll(institutionId: string) {
    return this.prisma.educationLevel.findMany({
      where: { institutionId },
      include: { levelGrades: { orderBy: { displayOrder: 'asc' } } },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async findOne(id: string, institutionId: string) {
    await this.assertLevelBelongsToInstitution(id, institutionId);
    return this.prisma.educationLevel.findUnique({
      where: { id },
      include: { levelGrades: { orderBy: { displayOrder: 'asc' } } },
    });
  }

  async create(
    dto: CreateEducationLevelDto,
    institutionId: string,
    userId: string,
  ) {
    const data: Prisma.EducationLevelCreateInput = {
      name: dto.name,
      slug: dto.slug,
      displayOrder: dto.displayOrder ?? 0,
      institution: { connect: { id: institutionId } },
    };

    const level = await this.prisma.educationLevel.create({ data });

    await this.auditQueue.add(
      JOBS.AUDIT_LOG,
      {
        institutionId,
        userId,
        action: 'CREATE',
        resource: 'EducationLevel',
        resourceId: level.id,
        after: level,
      },
      JOB_OPTIONS.CRITICAL,
    );

    return level;
  }

  async update(
    id: string,
    dto: UpdateEducationLevelDto,
    institutionId: string,
    userId: string,
  ) {
    await this.assertLevelBelongsToInstitution(id, institutionId);

    if ((dto as any).slug !== undefined) {
      throw new ConflictException('El slug no puede modificarse');
    }

    const before = await this.prisma.educationLevel.findUnique({
      where: { id },
    });

    const data: Prisma.EducationLevelUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;
    if (dto.status !== undefined) data.status = dto.status;

    const after = await this.prisma.educationLevel.update({
      where: { id },
      data,
    });

    await this.auditQueue.add(
      JOBS.AUDIT_LOG,
      {
        institutionId,
        userId,
        action: 'UPDATE',
        resource: 'EducationLevel',
        resourceId: id,
        before,
        after,
      },
      JOB_OPTIONS.CRITICAL,
    );

    return after;
  }

  async delete(
    id: string,
    institutionId: string,
    userId: string,
  ) {
    await this.assertLevelBelongsToInstitution(id, institutionId);

    const [gradeCount, courseCount, indicatorCount, userLevelRoleCount, chatRoomCount, ilcsCount] =
      await Promise.all([
        this.prisma.levelGrade.count({ where: { educationLevelId: id } }),
        this.prisma.course.count({ where: { levelGrade: { educationLevelId: id } } }),
        this.prisma.indicator.count({ where: { levelGrade: { educationLevelId: id } } }),
        this.prisma.userLevelRole.count({ where: { educationLevelId: id } }),
        this.prisma.chatRoom.count({ where: { educationLevelId: id } }),
        this.prisma.institutionLevelCommunicationSettings.count({
          where: { educationLevelId: id },
        }),
      ]);

    const depNames: string[] = [];
    if (gradeCount > 0) depNames.push(`${gradeCount} grado(s)`);
    if (courseCount > 0) depNames.push(`${courseCount} curso(s)`);
    if (indicatorCount > 0) depNames.push(`${indicatorCount} indicador(es)`);
    if (userLevelRoleCount > 0) depNames.push(`${userLevelRoleCount} rol(es) de usuario`);
    if (chatRoomCount > 0) depNames.push(`${chatRoomCount} sala(s) de chat`);
    if (ilcsCount > 0) depNames.push(`${ilcsCount} configuración(es) de comunicación`);

    if (depNames.length > 0) {
      throw new ConflictException(
        `No se puede eliminar el nivel porque tiene dependencias: ${depNames.join(', ')}`,
      );
    }

    const before = await this.prisma.educationLevel.findUnique({
      where: { id },
    });

    await this.prisma.educationLevel.delete({ where: { id } });

    await this.auditQueue.add(
      JOBS.AUDIT_LOG,
      {
        institutionId,
        userId,
        action: 'DELETE',
        resource: 'EducationLevel',
        resourceId: id,
        before,
      },
      JOB_OPTIONS.CRITICAL,
    );
  }

  // ── LevelGrade sub-resource CRUD ───────────────────────────

  async findGrades(educationLevelId: string, institutionId: string) {
    await this.assertLevelBelongsToInstitution(educationLevelId, institutionId);
    return this.prisma.levelGrade.findMany({
      where: { educationLevelId },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async createGrade(
    educationLevelId: string,
    dto: CreateLevelGradeDto,
    institutionId: string,
    userId: string,
  ) {
    await this.assertLevelBelongsToInstitution(educationLevelId, institutionId);

    const grade = await this.prisma.levelGrade.create({
      data: {
        name: dto.name,
        displayOrder: dto.displayOrder ?? 0,
        educationLevel: { connect: { id: educationLevelId } },
      },
    });

    await this.auditQueue.add(
      JOBS.AUDIT_LOG,
      {
        institutionId,
        userId,
        action: 'CREATE',
        resource: 'LevelGrade',
        resourceId: grade.id,
        after: grade,
      },
      JOB_OPTIONS.CRITICAL,
    );

    return grade;
  }

  async updateGrade(
    educationLevelId: string,
    id: string,
    dto: UpdateLevelGradeDto,
    institutionId: string,
    userId: string,
  ) {
    await this.assertLevelBelongsToInstitution(educationLevelId, institutionId);
    await this.assertGradeBelongsToInstitution(id, educationLevelId, institutionId);

    const before = await this.prisma.levelGrade.findUnique({
      where: { id },
    });

    const data: Prisma.LevelGradeUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.displayOrder !== undefined) data.displayOrder = dto.displayOrder;
    if (dto.status !== undefined) data.status = dto.status;

    const after = await this.prisma.levelGrade.update({
      where: { id },
      data,
    });

    await this.auditQueue.add(
      JOBS.AUDIT_LOG,
      {
        institutionId,
        userId,
        action: 'UPDATE',
        resource: 'LevelGrade',
        resourceId: id,
        before,
        after,
      },
      JOB_OPTIONS.CRITICAL,
    );

    return after;
  }

  async deleteGrade(
    educationLevelId: string,
    id: string,
    institutionId: string,
    userId: string,
  ) {
    await this.assertLevelBelongsToInstitution(educationLevelId, institutionId);
    await this.assertGradeBelongsToInstitution(id, educationLevelId, institutionId);

    const before = await this.prisma.levelGrade.findUnique({
      where: { id },
    });

    try {
      await this.prisma.levelGrade.delete({ where: { id } });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2003'
      ) {
        throw new ConflictException(
          'No se puede eliminar el grado porque tiene cursos, indicadores o ILCS asociados',
        );
      }
      throw err;
    }

    await this.auditQueue.add(
      JOBS.AUDIT_LOG,
      {
        institutionId,
        userId,
        action: 'DELETE',
        resource: 'LevelGrade',
        resourceId: id,
        before,
      },
      JOB_OPTIONS.CRITICAL,
    );
  }
}
