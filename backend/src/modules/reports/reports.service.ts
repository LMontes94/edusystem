import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  ReportConfig,
  ReportTheme,
  LogoPosition,
  ReportLayout,
  DEFAULT_THEME,
  SecondaryGradeReport,
} from './report.types';
import {
  secondaryGradesTemplate,
  primaryQualitativeTemplate,
} from '../../../templates/report.templates';
import archiver from 'archiver';
import { Readable } from 'stream';

// ──────────────────────────────────────────────
// ReportsService — generación de PDFs con Puppeteer
// ──────────────────────────────────────────────

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ── Obtener config de la institución ─────────
  private async getReportConfig(institutionId: string): Promise<ReportConfig> {
    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
    });

    if (!institution) throw new NotFoundException('Institución no encontrada');

    const settings = (institution.settings as any) ?? {};
    const reportSettings = settings.report ?? {};

    // Obtener URL del logo si existe
    let logoUrl: string | undefined;
    if (institution.logoUrl) {
      try {
        logoUrl = await this.storage.getFileUrl(institution.logoUrl, 3600);
      } catch {}
    }

    return {
      institutionName: institution.name,
      logoUrl,
      theme: {
        primaryColor:   reportSettings.primaryColor   ?? DEFAULT_THEME.primaryColor,
        secondaryColor: reportSettings.secondaryColor ?? DEFAULT_THEME.secondaryColor,
        textColor:      reportSettings.textColor      ?? DEFAULT_THEME.textColor,
      },
      logoPosition: (reportSettings.logoPosition ?? 'center') as LogoPosition,
      layout:       (reportSettings.layout       ?? 'classic') as ReportLayout,
    };
  }

  // ── Generar PDF desde HTML ────────────────────
  private async generatePdf(html: string): Promise<Buffer> {
    // Importación dinámica para evitar problemas de inicialización
    const puppeteer = await import('puppeteer');
    const browser   = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdf = await page.pdf({
        format:            'A4',
        printBackground:   true,
        margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
      });

      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  // ── Boletín de secundaria — un alumno ────────
  async generateSecondaryReport(
    studentId:     string,
    institutionId: string,
    schoolYearId:  string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const config  = await this.getReportConfig(institutionId);
    const data    = await this.buildSecondaryData(studentId, institutionId, schoolYearId);
    const html    = secondaryGradesTemplate(data, config);
    const buffer  = await this.generatePdf(html);
    const filename = `boletin_${data.student.lastName}_${data.student.firstName}_${data.schoolYear}.pdf`
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');

    return { buffer, filename };
  }

  // ── Boletín de secundaria — curso completo ───
  async generateSecondaryReportBulk(
    courseId:      string,
    institutionId: string,
    schoolYearId:  string,
  ): Promise<Buffer> {
    const config = await this.getReportConfig(institutionId);

    const enrollments = await this.prisma.courseStudent.findMany({
      where:   { courseId, status: 'ACTIVE' },
      include: { student: true },
      orderBy: { student: { lastName: 'asc' } },
    });

    // Generar PDFs en paralelo (máximo 5 a la vez para no sobrecargar)
    const chunks = [];
    for (let i = 0; i < enrollments.length; i += 5) {
      chunks.push(enrollments.slice(i, i + 5));
    }

    const allPdfs: { buffer: Buffer; filename: string }[] = [];

    for (const chunk of chunks) {
      const pdfs = await Promise.all(
        chunk.map(async (e) => {
          const data     = await this.buildSecondaryData(e.studentId, institutionId, schoolYearId);
          const html     = secondaryGradesTemplate(data, config);
          const buffer   = await this.generatePdf(html);
          const filename = `boletin_${data.student.lastName}_${data.student.firstName}.pdf`
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
          return { buffer, filename };
        }),
      );
      allPdfs.push(...pdfs);
    }

    // Empaquetar en ZIP
    return this.createZip(allPdfs);
  }

  // ── Informe cualitativo — un alumno ──────────
  async generatePrimaryReport(
    studentId:     string,
    institutionId: string,
    schoolYearId:  string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const config  = await this.getReportConfig(institutionId);
    const data    = await this.buildPrimaryData(studentId, institutionId, schoolYearId);
    const html    = primaryQualitativeTemplate(data, config);
    const buffer  = await this.generatePdf(html);
    const filename = `informe_${data.student.lastName}_${data.student.firstName}_${data.schoolYear}.pdf`
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');

    return { buffer, filename };
  }

  // ── Informe cualitativo — curso completo ─────
  async generatePrimaryReportBulk(
    courseId:      string,
    institutionId: string,
    schoolYearId:  string,
  ): Promise<Buffer> {
    const config = await this.getReportConfig(institutionId);

    const enrollments = await this.prisma.courseStudent.findMany({
      where:   { courseId, status: 'ACTIVE' },
      include: { student: true },
      orderBy: { student: { lastName: 'asc' } },
    });

    const allPdfs: { buffer: Buffer; filename: string }[] = [];

    for (let i = 0; i < enrollments.length; i += 5) {
      const chunk = enrollments.slice(i, i + 5);
      const pdfs  = await Promise.all(
        chunk.map(async (e) => {
          const data     = await this.buildPrimaryData(e.studentId, institutionId, schoolYearId);
          const html     = primaryQualitativeTemplate(data, config);
          const buffer   = await this.generatePdf(html);
          const filename = `informe_${data.student.lastName}_${data.student.firstName}.pdf`
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');
          return { buffer, filename };
        }),
      );
      allPdfs.push(...pdfs);
    }

    return this.createZip(allPdfs);
  }

  // ── Actualizar configuración de reportes ─────
  async updateReportSettings(
    institutionId: string,
    settings: {
      primaryColor?:   string;
      secondaryColor?: string;
      textColor?:      string;
      logoPosition?:   LogoPosition;
      layout?:         ReportLayout;
    },
  ) {
    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
    });

    const currentSettings = (institution?.settings as any) ?? {};
    const currentReport   = currentSettings.report ?? {};

    await this.prisma.institution.update({
      where: { id: institutionId },
      data: {
        settings: {
          ...currentSettings,
          report: { ...currentReport, ...settings },
        },
      },
    });

    return { message: 'Configuración actualizada' };
  }

  // ── Builders de datos ─────────────────────────

  private async buildSecondaryData(
    studentId:     string,
    institutionId: string,
    schoolYearId:  string,
  ): Promise<SecondaryGradeReport> {
    const [student, schoolYear, grades, attendance] = await Promise.all([
      this.prisma.student.findFirst({
        where:   { id: studentId, institutionId },
        include: {
          courseStudents: {
            where:   { status: 'ACTIVE', course: { schoolYearId } },
            include: { course: true },
          },
        },
      }),
      this.prisma.schoolYear.findUnique({
        where:   { id: schoolYearId },
        include: { periods: { orderBy: { order: 'asc' } } },
      }),
      this.prisma.grade.findMany({
        where:   { studentId, period: { schoolYearId } },
        include: {
          courseSubject: { include: { subject: true } },
          period:        true,
        },
      }),
      this.prisma.attendance.findMany({
        where: {
          studentId,
          course: { schoolYearId },
        },
        select: { status: true },
      }),
    ]);

    if (!student) throw new NotFoundException('Alumno no encontrado');

    const courseStudent = student.courseStudents[0];

    // Agrupar notas por materia y período
    const subjectMap = new Map<string, any>();

    for (const grade of grades) {
      const subjectId = grade.courseSubject.subjectId;
      if (!subjectMap.has(subjectId)) {
        subjectMap.set(subjectId, {
          name:           grade.courseSubject.subject.name,
          code:           grade.courseSubject.subject.code,
          gradesByPeriod: {},
        });
      }
      const subj = subjectMap.get(subjectId);
      if (!subj.gradesByPeriod[grade.periodId]) {
        subj.gradesByPeriod[grade.periodId] = [];
      }
      subj.gradesByPeriod[grade.periodId].push({
        score: Number(grade.score),
        type:  grade.type,
      });
    }

    // Calcular promedio final por materia
    const subjects = Array.from(subjectMap.values()).map((s) => {
      const allGrades = Object.values(s.gradesByPeriod as Record<string, { score: number }[]>).flat();
      const average   = allGrades.length > 0
        ? Math.round((allGrades.reduce((sum, g) => sum + g.score, 0) / allGrades.length) * 100) / 100
        : null;
      return { ...s, average };
    });

    // Calcular asistencia
    const attendanceSummary = attendance.reduce(
      (acc, a) => { acc[a.status] = (acc[a.status] ?? 0) + 1; acc.total++; return acc; },
      { PRESENT: 0, ABSENT: 0, LATE: 0, JUSTIFIED: 0, total: 0 } as any,
    );
    const rate = attendanceSummary.total > 0
      ? Math.round(((attendanceSummary.PRESENT + attendanceSummary.LATE) / attendanceSummary.total) * 100)
      : 0;

    return {
      student: {
        firstName:      student.firstName,
        lastName:       student.lastName,
        documentNumber: student.documentNumber,
      },
      course: courseStudent
        ? {
            name:     courseStudent.course.name,
            grade:    courseStudent.course.grade,
            division: courseStudent.course.division,
            level:    courseStudent.course.level,
          }
        : { name: '—', grade: 0, division: '—', level: '—' },
      schoolYear: schoolYear!.year,
      periods:    schoolYear!.periods,
      subjects,
      attendance: {
        present:   attendanceSummary.PRESENT,
        absent:    attendanceSummary.ABSENT,
        late:      attendanceSummary.LATE,
        justified: attendanceSummary.JUSTIFIED,
        total:     attendanceSummary.total,
        rate,
      },
    };
  }

  private async buildPrimaryData(
    studentId:     string,
    institutionId: string,
    schoolYearId:  string,
  ) {
    const [student, schoolYear, attendance] = await Promise.all([
      this.prisma.student.findFirst({
        where:   { id: studentId, institutionId },
        include: {
          courseStudents: {
            where:   { status: 'ACTIVE', course: { schoolYearId } },
            include: {
              course: {
                include: {
                  courseSubjects: { include: { teacher: { select: { firstName: true, lastName: true } } } },
                },
              },
            },
          },
        },
      }),
      this.prisma.schoolYear.findUnique({
        where:   { id: schoolYearId },
        include: { periods: { orderBy: { order: 'asc' } } },
      }),
      this.prisma.attendance.findMany({
        where:  { studentId, course: { schoolYearId } },
        select: { status: true },
      }),
    ]);

    if (!student) throw new NotFoundException('Alumno no encontrado');

    const courseStudent = student.courseStudents[0];
    const teachers = courseStudent?.course.courseSubjects
      .map((cs: any) => `${cs.teacher.firstName} ${cs.teacher.lastName}`)
      .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i) ?? [];

    const attendanceSummary = attendance.reduce(
      (acc, a) => { acc[a.status] = (acc[a.status] ?? 0) + 1; acc.total++; return acc; },
      { PRESENT: 0, ABSENT: 0, LATE: 0, JUSTIFIED: 0, total: 0 } as any,
    );
    const rate = attendanceSummary.total > 0
      ? Math.round(((attendanceSummary.PRESENT + attendanceSummary.LATE) / attendanceSummary.total) * 100)
      : 0;

    return {
      student: {
        firstName:      student.firstName,
        lastName:       student.lastName,
        documentNumber: student.documentNumber,
      },
      course: courseStudent
        ? {
            name:     courseStudent.course.name,
            grade:    courseStudent.course.grade,
            division: courseStudent.course.division,
          }
        : { name: '—', grade: 0, division: '—' },
      teachers,
      schoolYear: schoolYear!.year,
      periods:    schoolYear!.periods,
      areas:      [], // Se completa con el sistema de indicadores (próxima iteración)
      observations: {},
      attendance: {
        present:   attendanceSummary.PRESENT,
        absent:    attendanceSummary.ABSENT,
        late:      attendanceSummary.LATE,
        total:     attendanceSummary.total,
        rate,
      },
    };
  }

  // ── Crear ZIP ─────────────────────────────────
  private createZip(files: { buffer: Buffer; filename: string }[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const archive = archiver('zip', { zlib: { level: 6 } });

      archive.on('data',  (chunk) => chunks.push(chunk));
      archive.on('end',   () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      files.forEach(({ buffer, filename }) => {
        const stream = Readable.from(buffer);
        archive.append(stream, { name: filename });
      });

      archive.finalize();
    });
  }
}