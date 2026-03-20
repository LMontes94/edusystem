import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateStudentDto,
  UpdateStudentDto,
  EnrollStudentDto,
  LinkGuardianDto,
} from './dto/student.dto';

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(institutionId: string) {
    return this.prisma.student.findMany({
      where: { institutionId, deletedAt: null },
      include: {
        courseStudents: {
          where: { status: 'ACTIVE' },
          include: { course: { select: { id: true, name: true, grade: true, division: true } } },
        },
        guardians: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  async findOne(id: string, institutionId: string) {
    const student = await this.prisma.student.findFirst({
      where: { id, institutionId, deletedAt: null },
      include: {
        courseStudents: {
          include: {
            course: {
              include: {
                courseSubjects: {
                  include: { subject: true, teacher: { select: { id: true, firstName: true, lastName: true } } },
                },
              },
            },
          },
        },
        guardians: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
        },
        grades: {
          include: { period: true, courseSubject: { include: { subject: true } } },
          orderBy: { date: 'desc' },
          take: 20,
        },
      },
    });

    if (!student) throw new NotFoundException('Alumno no encontrado');
    return student;
  }

  async create(dto: CreateStudentDto, institutionId: string) {
    // DNI único por institución
    const existing = await this.prisma.student.findFirst({
      where: { documentNumber: dto.documentNumber, institutionId },
    });
    if (existing) {
      throw new ConflictException('Ya existe un alumno con ese documento en esta institución');
    }

    return this.prisma.student.create({
      data: {
        firstName: dto.firstName!,
        lastName: dto.lastName!,
        documentNumber: dto.documentNumber!,
        birthDate: new Date(dto.birthDate!),
        bloodType: dto.bloodType,
        medicalNotes: dto.medicalNotes,
        institutionId,
      } as any,
    });
  }

  async update(id: string, dto: UpdateStudentDto, institutionId: string) {
    await this.findOne(id, institutionId);

    return this.prisma.student.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.birthDate && { birthDate: new Date(dto.birthDate) }),
      },
    });
  }

  async remove(id: string, institutionId: string) {
    await this.findOne(id, institutionId);
    await this.prisma.student.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  // ── Matrícula ────────────────────────────────
  async enroll(studentId: string, dto: EnrollStudentDto, institutionId: string) {
    await this.findOne(studentId, institutionId);

    // Verificar que el curso pertenece a la institución
    const course = await this.prisma.course.findFirst({
      where: { id: dto.courseId, institutionId },
    });
    if (!course) throw new NotFoundException('Curso no encontrado');

    // Verificar que no está ya matriculado
    const existing = await this.prisma.courseStudent.findUnique({
      where: { courseId_studentId: { courseId: dto.courseId, studentId } },
    });
    if (existing) throw new ConflictException('El alumno ya está matriculado en este curso');

    return this.prisma.courseStudent.create({
      data: { studentId, courseId: dto.courseId, status: 'ACTIVE' },
    });
  }

  // ── Vincular tutor ───────────────────────────
  async linkGuardian(studentId: string, dto: LinkGuardianDto, institutionId: string) {
    await this.findOne(studentId, institutionId);

    // Verificar que el usuario existe y pertenece a la institución
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, institutionId, role: 'GUARDIAN' },
    });
    if (!user) throw new NotFoundException('Tutor no encontrado en esta institución');

    const existing = await this.prisma.guardian.findUnique({
      where: { userId_studentId: { userId: dto.userId, studentId } },
    });
    if (existing) throw new ConflictException('El tutor ya está vinculado a este alumno');

    return this.prisma.guardian.create({
      data: {
        relationship: dto.relationship,
        isPrimary: dto.isPrimary,
        canPickup: dto.canPickup,
        student: { connect: { id: studentId } },
        user: { connect: { id: dto.userId } },
      },
    });
  }

  // ── Alumnos del padre (para GUARDIAN) ────────
  async findByGuardian(userId: string, institutionId: string) {
    return this.prisma.student.findMany({
      where: {
        institutionId,
        deletedAt: null,
        guardians: { some: { userId } },
      },
      include: {
        courseStudents: {
          where: { status: 'ACTIVE' },
          include: { course: { select: { id: true, name: true, grade: true, division: true } } },
        },
      },
    });
  }
}
