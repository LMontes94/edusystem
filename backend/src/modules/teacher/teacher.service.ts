// src/modules/teacher/teacher.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TeacherService {
  constructor(private readonly prisma: PrismaService) {}

  // ── TEMARIO ───────────────────────────────────

  async getSyllabus(courseSubjectId: string) {
    return this.prisma.syllabus.findMany({
      where:   { courseSubjectId },
      include: { period: { select: { id: true, name: true, order: true } } },
      orderBy: { period: { order: 'asc' } },
    });
  }

  async upsertSyllabus(data: {
    courseSubjectId: string;
    periodId:        string;
    title:           string;
    contents:        string;
    bibliography?:   string;
  }) {
    return this.prisma.syllabus.upsert({
      where: {
        courseSubjectId_periodId: {
          courseSubjectId: data.courseSubjectId,
          periodId:        data.periodId,
        },
      },
      create: data as any,
      update: {
        title:        data.title,
        contents:     data.contents,
        bibliography: data.bibliography,
      },
      include: { period: { select: { id: true, name: true } } },
    });
  }

  async deleteSyllabus(id: string) {
    await this.prisma.syllabus.delete({ where: { id } });
  }

  // ── PENDIENTES ────────────────────────────────

  async getPendingSubjects(
    courseId:     string,
    schoolYearId: string,
    institutionId: string,
  ) {
    // Obtener alumnos del curso
    const enrollments = await this.prisma.courseStudent.findMany({
      where:   { courseId, status: 'ACTIVE' },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, documentNumber: true },
        },
      },
      orderBy: { student: { lastName: 'asc' } },
    });

    const studentIds = enrollments.map((e) => e.studentId);

    // Obtener pendientes existentes
    const pendingSubjects = await this.prisma.pendingSubject.findMany({
      where: {
        studentId:    { in: studentIds },
        schoolYearId,
        institutionId,
      },
      include: {
        subject: { select: { id: true, name: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return {
      students:       enrollments.map((e) => e.student),
      pendingSubjects,
    };
  }

  async upsertPendingSubject(data: {
    studentId:      string;
    subjectId:      string;
    institutionId:  string;
    schoolYearId:   string;
    initialSabers?: string;
    march?:         string;
    august?:        string;
    november?:      string;
    december?:      string;
    february?:      string;
    finalScore?:    string;
    closingSabers?: string;
  }) {
    return this.prisma.pendingSubject.upsert({
      where: {
        studentId_subjectId_schoolYearId: {
          studentId:    data.studentId,
          subjectId:    data.subjectId,
          schoolYearId: data.schoolYearId,
        },
      },
      create: data as any,
      update: {
        initialSabers: data.initialSabers,
        march:         data.march,
        august:        data.august,
        november:      data.november,
        december:      data.december,
        february:      data.february,
        finalScore:    data.finalScore,
        closingSabers: data.closingSabers,
      },
      include: {
        subject: { select: { id: true, name: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async deletePendingSubject(id: string) {
    await this.prisma.pendingSubject.delete({ where: { id } });
  }

  async getStudentPendingSubjects(studentId: string, schoolYearId: string) {
    return this.prisma.pendingSubject.findMany({
      where: { studentId, schoolYearId },
      include: { subject: { select: { id: true, name: true } } },
    });
  }
}