import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  ReportConfig,
  ReportTheme,
  LogoPosition,
  ReportLayout,
  ReportVariant,
  DEFAULT_THEME,
  SecondaryGradeReport,
  RiteReport,
  ValoracionReport,
  AttendanceByPeriod,
} from './report.types';
import { computeTrayectoria } from './trayectoria.helper';
import { aggregatePeriods, getAggregationBySlug, DEFAULT_AGGREGATION } from './report.aggregation';
import type { PeriodAggregationEntry } from './report.aggregation';
import {
  secondaryGradesTemplate,
  primaryQualitativeTemplate,
  riteTemplate,
  valoracionesTemplate,
} from '../../../templates/report.templates';
import { pendingSubjectsTemplate } from '../../../templates/pending.template';
import { convivenciasTemplate } from '../../../templates/convivencias.template';
import * as archiver from 'archiver';
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
  
  private buildFilename(
  type:      'boletin' | 'informe' | 'pendientes' | 'rite' | 'valoraciones',
  student:   { firstName: string; lastName: string },
  course:    { name: string },
  schoolYear: number,
  ): string {
  return `${schoolYear}_${course.name}_${student.lastName}_${student.firstName}_${type}.pdf`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
  }

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

  // ── Resolver agregación de períodos ──────────
  private async resolvePeriodAggregation(
    institutionId: string,
    levelSlug: string,
  ): Promise<PeriodAggregationEntry[]> {
    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { settings: true },
    });

    const settings = (institution?.settings as any) ?? {};
    const upperKey = levelSlug.toUpperCase();
    const config = settings.reportPeriodAggregation?.[upperKey];

    if (Array.isArray(config) && config.length > 0) {
      return config;
    }

    return getAggregationBySlug(levelSlug);
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
  
  private async generatePdfWithBrowser(
  html:    string,
  browser: import('puppeteer').Browser,
): Promise<Buffer> {
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
    const pdf = await page.pdf({
      format:          'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close(); // cerrar la página pero NO el browser
  }
}
  // ── Boletín de secundaria — un alumno (delega a RITE) ─
  async generateSecondaryReport(
    studentId:     string,
    institutionId: string,
    schoolYearId:  string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    return this.generateRiteReport(studentId, institutionId, schoolYearId);
  }

  // ── Boletín de secundaria — curso completo (delega a RITE) ─
  async generateSecondaryReportBulk(
    courseId:      string,
    institutionId: string,
    schoolYearId:  string,
  ): Promise<Buffer> {
    return this.generateRiteReportBulk(courseId, institutionId, schoolYearId);
  }

  // ── RITE — un alumno ─────────────────────────
  async generateRiteReport(
    studentId:     string,
    institutionId: string,
    schoolYearId:  string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const config  = await this.getReportConfig(institutionId);
    const data    = await this.buildRiteData(studentId, institutionId, schoolYearId);
    const html    = riteTemplate(data, config);
    const buffer  = await this.generatePdf(html);
    const filename = this.buildFilename('rite', data.student, data.course, data.schoolYear);

    return { buffer, filename };
  }

  // ── RITE — curso completo ────────────────────
  async generateRiteReportBulk(
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

    const puppeteer = await import('puppeteer');
    const browser   = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const allPdfs: { buffer: Buffer; filename: string }[] = [];

    try {
      for (const enrollment of enrollments) {
        const data   = await this.buildRiteData(enrollment.studentId, institutionId, schoolYearId);
        const html   = riteTemplate(data, config);
        const buffer = await this.generatePdfWithBrowser(html, browser);
        const filename = this.buildFilename('rite', data.student, data.course, data.schoolYear);
        allPdfs.push({ buffer, filename });
      }
    } finally {
      await browser.close();
    }

    return this.createZip(allPdfs);
  }

  // ── Valoración Preliminar — un alumno ────────
  async generateValoracionesReport(
    studentId:     string,
    institutionId: string,
    schoolYearId:  string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const config  = await this.getReportConfig(institutionId);
    const data    = await this.buildValoracionData(studentId, institutionId, schoolYearId);
    const html    = valoracionesTemplate(data, config);
    const buffer  = await this.generatePdf(html);
    const filename = this.buildFilename('valoraciones', data.student, data.course, data.schoolYear);

    return { buffer, filename };
  }

  // ── Valoración Preliminar — curso completo ───
  async generateValoracionesReportBulk(
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

    const puppeteer = await import('puppeteer');
    const browser   = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const allPdfs: { buffer: Buffer; filename: string }[] = [];

    try {
      for (const enrollment of enrollments) {
        const data   = await this.buildValoracionData(enrollment.studentId, institutionId, schoolYearId);
        const html   = valoracionesTemplate(data, config);
        const buffer = await this.generatePdfWithBrowser(html, browser);
        const filename = this.buildFilename('valoraciones', data.student, data.course, data.schoolYear);
        allPdfs.push({ buffer, filename });
      }
    } finally {
      await browser.close();
    }

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
    const filename = this.buildFilename('boletin', data.student, data.course, data.schoolYear);

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
    
    const puppeteer = await import('puppeteer');
    const browser   = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const allPdfs: { buffer: Buffer; filename: string }[] = [];

    try {    
      for (const enrollment of enrollments) {
        const data     = await this.buildPrimaryData(enrollment.studentId, institutionId, schoolYearId);
        const html     = primaryQualitativeTemplate(data, config);
        const buffer   = await this.generatePdfWithBrowser(html, browser);
        const filename = this.buildFilename('boletin', data.student, data.course, data.schoolYear);
        allPdfs.push({ buffer, filename });
      }
    } finally {
    await browser.close(); 
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
            include: {
              course: {
                include: {
                  levelGrade: {
                    include: {
                      educationLevel: {
                        select: { id: true, name: true, slug: true },
                      },
                    },
                  },
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
    const educationLevel = courseStudent?.course.levelGrade?.educationLevel;

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
            grade:    courseStudent.course.levelGrade?.displayOrder ?? courseStudent.course.grade,
            division: courseStudent.course.division,
            level:    courseStudent.course.levelGrade?.educationLevel.slug.toUpperCase() ?? courseStudent.course.level,
            educationLevel: educationLevel
              ? { id: educationLevel.id, name: educationLevel.name, slug: educationLevel.slug }
              : undefined,
          }
        : { name: '—', grade: 0, division: '—', level: '—', educationLevel: undefined },
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

  // ── Builder: RITE ────────────────────────────
  private async buildRiteData(
    studentId:     string,
    institutionId: string,
    schoolYearId:  string,
  ): Promise<RiteReport> {
    const [student, schoolYear, grades, evaluations, attendance, pendings, convivencias, observations] =
      await Promise.all([
        this.prisma.student.findFirst({
          where:   { id: studentId, institutionId },
          include: {
            courseStudents: {
              where:   { status: 'ACTIVE', course: { schoolYearId } },
              include: {
                course: {
                  include: {
                    levelGrade: {
                      include: {
                        educationLevel: {
                          select: { id: true, name: true, slug: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            studentAssignments: {
              where:   { schoolYearId },
              include: { courseSubject: true },
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
        this.prisma.indicatorEvaluation.findMany({
          where: { studentId, indicator: { schoolYearId } },
          include: {
            indicator: { include: { subject: { select: { id: true, name: true } } } },
            period:    { select: { id: true, order: true } },
          },
        }),
        this.prisma.attendance.findMany({
          where:  { studentId, course: { schoolYearId } },
          select: { status: true, date: true },
        }),
        this.prisma.pendingSubject.findMany({
          where: { studentId, schoolYearId, institutionId },
          include: { subject: { select: { id: true, name: true, code: true } } },
        }),
        this.prisma.convivencia.findMany({
          where:   { studentId, institutionId, deletedAt: null },
          orderBy: { date: 'desc' },
          take:    20,
          select:  { date: true, type: true, reason: true },
        }),
        this.prisma.studentObservation.findMany({
          where: { studentId, course: { schoolYearId }, subjectId: { not: null } },
          include: { subject: true },
        }),
      ]);

    if (!student) throw new NotFoundException('Alumno no encontrado');
    if (!schoolYear) throw new NotFoundException('Ciclo lectivo no encontrado');

    const courseStudent = student.courseStudents[0];
    if (!courseStudent) throw new NotFoundException('El alumno no está inscripto en ningún curso');

    const educationLevel = courseStudent.course.levelGrade?.educationLevel;
    const sortedPeriods = schoolYear.periods;

    // Resolve period aggregation config
    const levelForAggregation = educationLevel?.slug ?? courseStudent.course.level.toLowerCase();
    const aggregation = await this.resolvePeriodAggregation(institutionId, levelForAggregation);

    // Map courseSubjects by subjectId for quick lookup
    // Include RECURSE/EXEMPT subjects from studentAssignments (cross-course)
    const assignmentSubjectIds = student.studentAssignments
      .filter((scs) => scs.courseSubject.courseId !== courseStudent.courseId)
      .map((scs) => scs.courseSubject.id);

    const courseSubjects = await this.prisma.courseSubject.findMany({
      where: {
        OR: [
          { courseId: courseStudent.courseId },
          { id: { in: assignmentSubjectIds } },
        ],
      },
      include: { subject: true },
    });

    const courseSubjectBySubjectId = new Map(courseSubjects.map((cs) => [cs.subjectId, cs]));
    const subjectIds = courseSubjects.map((cs) => cs.subjectId);

    // Grades grouped by subjectId + period
    const subjectPeriodGrades = new Map<string, Map<string, number[]>>();
    for (const grade of grades) {
      const subjId = grade.courseSubject.subjectId;
      if (!subjectPeriodGrades.has(subjId)) {
        subjectPeriodGrades.set(subjId, new Map());
      }
      const periodGrades = subjectPeriodGrades.get(subjId)!;
      if (!periodGrades.has(grade.periodId)) {
        periodGrades.set(grade.periodId, []);
      }
      periodGrades.get(grade.periodId)!.push(Number(grade.score));
    }

    // Indicator evaluations grouped by subjectId + period
    const subjectPeriodEvals = new Map<string, Map<string, { value: string }[]>>();
    for (const ev of evaluations) {
      const subjId = ev.indicator.subject.id;
      if (!subjectPeriodEvals.has(subjId)) {
        subjectPeriodEvals.set(subjId, new Map());
      }
      const periodEvals = subjectPeriodEvals.get(subjId)!;
      if (!periodEvals.has(ev.periodId)) {
        periodEvals.set(ev.periodId, []);
      }
      periodEvals.get(ev.periodId)!.push({ value: ev.value });
    }

    // Map studentCourseSubject for C/R type
    const scsBySubjectId = new Map(
      student.studentAssignments.map((scs: any) => [scs.courseSubject.subjectId, scs]),
    );

    // Map pending subjects by subjectId
    const pendingBySubjectId = new Map(pendings.map((p) => [p.subjectId, p]));

    // Map observations by subjectId
    const obsBySubjectId = new Map<string, { type: 'PEDAGOGICAL' | 'DISCIPLINARY' | 'GENERAL'; text: string }[]>();
    for (const ob of observations) {
      if (!ob.subjectId) continue;
      if (!obsBySubjectId.has(ob.subjectId)) {
        obsBySubjectId.set(ob.subjectId, []);
      }
      obsBySubjectId.get(ob.subjectId)!.push({ type: 'PEDAGOGICAL', text: ob.observation });
    }

    // Load ClosingGrades for congelamiento
    const closingGrades = await this.prisma.closingGrade.findMany({
      where: {
        studentId: student.id,
        courseSubject: { course: { schoolYearId: schoolYearId } },
        isClosed: true,
      },
    });
    const closingGradeByKey = new Map(
      closingGrades.map((cg: any) => [`${cg.courseSubjectId}:${cg.periodId}`, cg]),
    );

    // Build subjects
    const period1 = sortedPeriods[0];
    const period2 = sortedPeriods.length > 1 ? sortedPeriods[1] : null;

    const subjects = subjectIds.map((subjectId) => {
      const cs = courseSubjectBySubjectId.get(subjectId)!;

      // Build per-period score overrides from ClosingGrade
      const scoreOverrides = new Map<string, number>();
      for (const period of sortedPeriods) {
        const cg = closingGradeByKey.get(`${cs.id}:${period.id}`);
        if (cg) {
          scoreOverrides.set(period.id, cg.closingScore);
        }
      }

      const columnInput = {
        subjectGrades: subjectPeriodGrades.get(subjectId) ?? new Map(),
        subjectEvals: subjectPeriodEvals.get(subjectId) ?? new Map(),
      };

      const columns = aggregatePeriods(
        columnInput,
        sortedPeriods,
        aggregation,
        scoreOverrides.size > 0 ? scoreOverrides : undefined,
      );

      const grade1 = columns[0]?.avgScore ?? null;
      const preliminary1 = columns[0]?.trayectoria ?? null;
      const grade2 = columns[1]?.avgScore ?? null;
      const preliminary2 = columns[1]?.trayectoria ?? null;

      const scs = scsBySubjectId.get(subjectId);
      const cursada: 'C' | 'R' | 'E' = scs?.type === 'RECURSE' ? 'R' : scs?.type === 'EXEMPT' ? 'E' : 'C';

      const pending = pendingBySubjectId.get(subjectId);
      const intensificacionDec = pending?.december ?? null;
      const intensificacionFeb = pending?.february ?? null;

      const effectiveGrades = [grade1, grade2].filter((g): g is number => g !== null);
      const finalGrade = effectiveGrades.length > 0
        ? Math.round((effectiveGrades.reduce((a, b) => a + b, 0) / effectiveGrades.length) * 100) / 100
        : null;

      return {
        subjectId: cs.subject.id,
        courseSubjectId: cs.id,
        subjectName: cs.subject.name,
        code: cs.subject.code,
        cursada,
        preliminary1,
        grade1,
        preliminary2,
        grade2,
        intensificacionDec,
        intensificacionFeb,
        finalGrade,
        observations: obsBySubjectId.get(subjectId),
      };
    });

    // Build attendance by period (using date range from period start/end)
    const groupAttByDate = (records: typeof attendance, start: Date, end: Date) => {
      const sum = { present: 0, absent: 0, late: 0, justified: 0, total: 0 };
      for (const a of records) {
        if (a.date >= start && a.date <= end) {
          const key = a.status.toLowerCase() as keyof typeof sum;
          if (key in sum) sum[key]++;
          sum.total++;
        }
      }
      const rate = sum.total > 0 ? Math.round(((sum.present + sum.late) / sum.total) * 100) : 0;
      return { ...sum, rate };
    };

    const attFirstC = period1 ? groupAttByDate(attendance as any, period1.startDate, period1.endDate) : { present: 0, absent: 0, late: 0, justified: 0, total: 0, rate: 0 };
    const attSecondC = period2 ? groupAttByDate(attendance as any, period2.startDate, period2.endDate) : { present: 0, absent: 0, late: 0, justified: 0, total: 0, rate: 0 };

    const allAtt = attendance.reduce(
      (acc, a) => {
        const key = a.status.toLowerCase() as 'present' | 'absent' | 'late' | 'justified';
        acc[key]++;
        acc.total++;
        return acc;
      },
      { present: 0, absent: 0, late: 0, justified: 0, total: 0 },
    );

    const attendanceResult: AttendanceByPeriod = {
      firstC:  attFirstC,
      secondC: attSecondC,
      total: {
        ...allAtt,
        rate: allAtt.total > 0 ? Math.round(((allAtt.present + allAtt.late) / allAtt.total) * 100) : 0,
      },
    };

    return {
      student: {
        firstName:      student.firstName,
        lastName:       student.lastName,
        documentNumber: student.documentNumber,
      },
      course: {
        name:     courseStudent.course.name,
        grade:    courseStudent.course.levelGrade?.displayOrder ?? courseStudent.course.grade,
        division: courseStudent.course.division,
        level:    courseStudent.course.levelGrade?.educationLevel.slug.toUpperCase() ?? courseStudent.course.level,
        educationLevel: educationLevel
          ? { id: educationLevel.id, name: educationLevel.name, slug: educationLevel.slug }
          : undefined,
      },
      schoolYear: schoolYear.year,
      variant: 'DEFAULT' as ReportVariant,
      subjects,
      attendance: attendanceResult,
      convivencias: convivencias.map((c) => ({
        date:   c.date.toISOString().split('T')[0],
        type:   c.type === 'suspension' || c.type === 'warning' || c.type === 'reprimand' ? 'APERCIBIMIENTO' as const : 'OBSERVACION' as const,
        description: c.reason,
      })),
    };
  }

  // ── Builder: Valoración Preliminar ───────────
  private async buildValoracionData(
    studentId:     string,
    institutionId: string,
    schoolYearId:  string,
  ): Promise<ValoracionReport> {
    const [student, schoolYear, evaluations, courseSubjects, observations] =
      await Promise.all([
        this.prisma.student.findFirst({
          where:   { id: studentId, institutionId },
          include: {
            courseStudents: {
              where:   { status: 'ACTIVE', course: { schoolYearId } },
              include: {
                course: {
                  include: {
                    levelGrade: {
                      include: {
                        educationLevel: {
                          select: { id: true, name: true, slug: true },
                        },
                      },
                    },
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
        this.prisma.indicatorEvaluation.findMany({
          where: { studentId, indicator: { schoolYearId } },
          include: {
            indicator: {
              include: { subject: { select: { id: true, name: true, code: true } } },
            },
            period: { select: { id: true, order: true } },
          },
        }),
        this.prisma.courseSubject.findMany({
          where: {
            course: {
              schoolYearId,
              courseStudents: { some: { studentId, status: 'ACTIVE' } },
            },
          },
          include: { subject: true },
        }),
        this.prisma.studentObservation.findMany({
          where: {
            studentId,
            course: { schoolYearId },
            subjectId: { not: null },
          },
          include: { subject: true },
        }),
      ]);

    if (!student) throw new NotFoundException('Alumno no encontrado');
    if (!schoolYear) throw new NotFoundException('Ciclo lectivo no encontrado');

    const courseStudent = student.courseStudents[0];
    if (!courseStudent) throw new NotFoundException('El alumno no está inscripto en ningún curso');

    const educationLevel = courseStudent.course.levelGrade?.educationLevel;

    // Use the most recent period (or all periods) for indicators
    const latestPeriod = schoolYear.periods[schoolYear.periods.length - 1];

    // Group evaluations + indicators by subject
    const subjectMap = new Map<string, {
      subjectId: string;
      subjectName: string;
      code: string;
      indicators: { description: string; value: string }[];
      observations?: { type: 'PEDAGOGICAL' | 'DISCIPLINARY' | 'GENERAL'; text: string }[];
    }>();

    for (const cs of courseSubjects) {
      subjectMap.set(cs.subjectId, {
        subjectId: cs.subjectId,
        subjectName: cs.subject.name,
        code: cs.subject.code,
        indicators: [],
      });
    }

    for (const ev of evaluations) {
      const subjId = ev.indicator.subject.id;
      if (!subjectMap.has(subjId)) {
        subjectMap.set(subjId, {
          subjectId: subjId,
          subjectName: ev.indicator.subject.name,
          code: ev.indicator.subject.code,
          indicators: [],
        });
      }
      const subject = subjectMap.get(subjId)!;
      const existing = subject.indicators.find((i) => i.description === ev.indicator.description);
      if (!existing) {
        subject.indicators.push({
          description: ev.indicator.description,
          value: ev.value,
        });
      }
    }

    // Add indicators without evaluations
    const allIndicators = await this.prisma.indicator.findMany({
      where:   { schoolYearId },
      include: { subject: { select: { id: true, name: true, code: true } } },
      orderBy: { order: 'asc' },
    });

    for (const ind of allIndicators) {
      const subjId = ind.subject.id;
      if (!subjectMap.has(subjId)) {
        subjectMap.set(subjId, {
          subjectId: subjId,
          subjectName: ind.subject.name,
          code: ind.subject.code,
          indicators: [],
        });
      }
      const subject = subjectMap.get(subjId)!;
      const existing = subject.indicators.find((i) => i.description === ind.description);
      if (!existing) {
        subject.indicators.push({ description: ind.description, value: '' });
      }
    }

    // Map observations by subjectId
    const obsBySubjectId = new Map<string, { type: 'PEDAGOGICAL' | 'DISCIPLINARY' | 'GENERAL'; text: string }[]>();
    for (const ob of observations) {
      if (!ob.subjectId) continue;
      if (!obsBySubjectId.has(ob.subjectId)) {
        obsBySubjectId.set(ob.subjectId, []);
      }
      obsBySubjectId.get(ob.subjectId)!.push({ type: 'PEDAGOGICAL', text: ob.observation });
    }

    // Compute trayectoria per subject
    const subjects = Array.from(subjectMap.values()).map((s) => {
      const evals = s.indicators.filter((ind) => ['LFD', 'LS', 'LP', 'ANL'].includes(ind.value));
      const trayectoria = evals.length > 0
        ? computeTrayectoria({ indicators: evals, strategy: 'MAJORITY' })
        : 'TED';
      return {
        ...s,
        trayectoria,
        observations: obsBySubjectId.get(s.subjectId),
      };
    });

    return {
      student: {
        firstName:      student.firstName,
        lastName:       student.lastName,
        documentNumber: student.documentNumber,
      },
      course: {
        name:     courseStudent.course.name,
        grade:    courseStudent.course.levelGrade?.displayOrder ?? courseStudent.course.grade,
        division: courseStudent.course.division,
        level:    courseStudent.course.levelGrade?.educationLevel.slug.toUpperCase() ?? courseStudent.course.level,
        educationLevel: educationLevel
          ? { id: educationLevel.id, name: educationLevel.name, slug: educationLevel.slug }
          : undefined,
      },
      schoolYear: schoolYear.year,
      variant: 'DEFAULT' as ReportVariant,
      subjects,
    };
  }

  private async buildPrimaryData(
  studentId:     string,
  institutionId: string,
  schoolYearId:  string,
) {
  const [student, schoolYear, attendance, evaluations] = await Promise.all([
    this.prisma.student.findFirst({
      where:   { id: studentId, institutionId },
      include: {
        courseStudents: {
          where:   { status: 'ACTIVE', course: { schoolYearId } },
          include: {
            course: {
              include: {
                courseSubjects: {
                  include: {
                    subject: true,
                    teacher: { select: { firstName: true, lastName: true } },
                  },
                },
                levelGrade: {
                  include: {
                    educationLevel: {
                      select: { id: true, slug: true, name: true },
                    },
                  },
                },
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
    // Cargar evaluaciones de indicadores del alumno
    this.prisma.indicatorEvaluation.findMany({
      where: {
        studentId,
        indicator: { schoolYearId },
      },
      include: {
        indicator: {
          include: { subject: { select: { id: true, name: true } } },
        },
        period: { select: { id: true, name: true, order: true } },
      },
    }),
  ]);

  if (!student) throw new NotFoundException('Alumno no encontrado');

  const courseStudent = student.courseStudents[0];
  const teachers = courseStudent?.course.courseSubjects
    .map((cs: any) => `${cs.teacher.firstName} ${cs.teacher.lastName}`)
    .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i) ?? [];

  // Calcular asistencia
  const attendanceSummary = attendance.reduce(
    (acc, a) => { acc[a.status] = (acc[a.status] ?? 0) + 1; acc.total++; return acc; },
    { PRESENT: 0, ABSENT: 0, LATE: 0, JUSTIFIED: 0, total: 0 } as any,
  );
  const rate = attendanceSummary.total > 0
    ? Math.round(((attendanceSummary.PRESENT + attendanceSummary.LATE) / attendanceSummary.total) * 100)
    : 0;

  // Agrupar indicadores por materia
  const subjectMap = new Map<string, { name: string; indicators: Map<string, any> }>();

  for (const evaluation of evaluations) {
    const subjectId   = evaluation.indicator.subject.id;
    const subjectName = evaluation.indicator.subject.name;

    if (!subjectMap.has(subjectId)) {
      subjectMap.set(subjectId, { name: subjectName, indicators: new Map() });
    }

    const subject = subjectMap.get(subjectId)!;

    if (!subject.indicators.has(evaluation.indicatorId)) {
      subject.indicators.set(evaluation.indicatorId, {
        description:     evaluation.indicator.description,
        valuesByPeriod:  {},
      });
    }

    subject.indicators.get(evaluation.indicatorId).valuesByPeriod[evaluation.periodId] = evaluation.value;
  }

  // También cargar indicadores sin evaluación para mostrarlos en el PDF
  const allIndicators = await this.prisma.indicator.findMany({
    where:   { schoolYearId },
    include: { subject: { select: { id: true, name: true } } },
    orderBy: { order: 'asc' },
  });

  for (const indicator of allIndicators) {
    const subjectId   = indicator.subject.id;
    const subjectName = indicator.subject.name;

    if (!subjectMap.has(subjectId)) {
      subjectMap.set(subjectId, { name: subjectName, indicators: new Map() });
    }

    const subject = subjectMap.get(subjectId)!;

    if (!subject.indicators.has(indicator.id)) {
      subject.indicators.set(indicator.id, {
        description:    indicator.description,
        valuesByPeriod: {},
      });
    }
  }

  // Convertir a formato del template
  const areas = Array.from(subjectMap.entries()).map(([, subject]) => ({
    name:       subject.name,
    indicators: Array.from(subject.indicators.values()).map((ind) => ({
      description:     ind.description,
      valuesByPeriod:  ind.valuesByPeriod,
    })),
  }));

  return {
    student: {
      firstName:      student.firstName,
      lastName:       student.lastName,
      documentNumber: student.documentNumber,
    },
    course: courseStudent
      ? {
          name:     courseStudent.course.name,
          grade:    courseStudent.course.levelGrade?.displayOrder ?? courseStudent.course.grade,
          division: courseStudent.course.division,
        }
      : { name: '—', grade: 0, division: '—' },
    teachers,
    schoolYear: schoolYear!.year,
    periods:    schoolYear!.periods,
    areas,
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
// ── PDF pendientes — un alumno ────────────────
async generatePendingReport(
  studentId:     string,
  courseId:      string,
  institutionId: string,
  schoolYearId:  string,
): Promise<{ buffer: Buffer; filename: string }> {
  const config = await this.getReportConfig(institutionId);
  const data   = await this.buildPendingData(studentId, courseId, institutionId, schoolYearId);
  const html   = pendingSubjectsTemplate(data, config);
  const buffer = await this.generatePdf(html);
  const filename = this.buildFilename('pendientes', data.student, data.course, data.schoolYear);
  return { buffer, filename };
}
 
// ── PDF pendientes — curso completo ──────────
async generatePendingReportBulk(
  courseId:      string,
  institutionId: string,
  schoolYearId:  string,
): Promise<Buffer> {
  const config = await this.getReportConfig(institutionId);
 
  // Obtener alumnos del curso que tienen pendientes
  const pendingSubjects = await this.prisma.pendingSubject.findMany({
    where: { institutionId, schoolYearId },
    select: { studentId: true },
    distinct: ['studentId'],
  });
 
  const enrollments = await this.prisma.courseStudent.findMany({
    where: {
      courseId,
      status:    'ACTIVE',
      studentId: { in: pendingSubjects.map((p) => p.studentId) },
    },
    include: { student: true },
    orderBy: { student: { lastName: 'asc' } },
  });
 
  if (enrollments.length === 0) {
    throw new Error('No hay alumnos con materias pendientes en este curso');
  }
 
  const allPdfs: { buffer: Buffer; filename: string }[] = [];
 
  for (let i = 0; i < enrollments.length; i += 5) {
    const chunk = enrollments.slice(i, i + 5);
    const pdfs  = await Promise.all(
      chunk.map(async (e) => {
        const data     = await this.buildPendingData(e.studentId, courseId, institutionId, schoolYearId);
        const html     = pendingSubjectsTemplate(data, config);
        const buffer   = await this.generatePdf(html);
        const filename = this.buildFilename('pendientes', data.student, data.course, data.schoolYear);
        return { buffer, filename };
      }),
    );
    allPdfs.push(...pdfs);
  }
 
  return this.createZip(allPdfs);
}
 
// ── Builder de datos para pendientes ─────────
private async buildPendingData(
  studentId:     string,
  courseId:      string,
  institutionId: string,
  schoolYearId:  string,
) {
  const [student, institution, schoolYear, pendings] = await Promise.all([
    this.prisma.student.findFirst({
      where:   { id: studentId, institutionId },
      include: {
        courseStudents: {
          where:   { courseId, status: 'ACTIVE' },
          include: {
            course: {
              include: {
                levelGrade: {
                  include: {
                    educationLevel: {
                      select: { id: true, name: true, slug: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    this.prisma.institution.findUnique({
      where:  { id: institutionId },
      select: { name: true, settings: true },
    }),
    this.prisma.schoolYear.findUnique({
      where:  { id: schoolYearId },
      select: { year: true },
    }),
    this.prisma.pendingSubject.findMany({
      where: { studentId, schoolYearId, institutionId },
      include: {
        subject: { select: { name: true } },
        closingGrade: {
          include: { period: { select: { id: true, name: true } } },
        },
      },
    }),
  ]);
 
  if (!student) throw new NotFoundException('Alumno no encontrado');
 
  const courseStudent = student.courseStudents[0];
  const educationLevel = courseStudent?.course.levelGrade?.educationLevel;
  const settings      = (institution?.settings as any) ?? {};
  
  return {
    student: {
      firstName:      student.firstName,
      lastName:       student.lastName,
      documentNumber: student.documentNumber,
    },
    course: courseStudent
      ? {
          name:     courseStudent.course.name,
          grade:    courseStudent.course.levelGrade?.displayOrder ?? courseStudent.course.grade,
          division: courseStudent.course.division,
          level:    courseStudent.course.levelGrade?.educationLevel.slug.toUpperCase() ?? courseStudent.course.level,
          educationLevel: educationLevel
            ? { id: educationLevel.id, name: educationLevel.name, slug: educationLevel.slug }
            : undefined,
        }
      : { name: '—', grade: 0, division: '—', level: '—', educationLevel: undefined },
    schoolYear: schoolYear!.year,
    institution: {
      name:     institution!.name,
      district: settings.district,
    },
    pendings: pendings.map((p) => ({
      subjectName:    p.subject.name,
      initialSabers:  p.initialSabers ?? undefined,
      march:          p.march         ?? undefined,
      august:         p.august        ?? undefined,
      november:       p.november      ?? undefined,
      december:       p.december      ?? undefined,
      february:       p.february      ?? undefined,
      finalScore:     p.finalScore    ?? undefined,
      closingSabers:  p.closingSabers ?? undefined,
      closingGradeId: p.closingGradeId ?? undefined,
      status:         p.status,
      periodName:     p.closingGrade?.period?.name ?? undefined,
    })),
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

  async generateConvivenciasReport(
  studentId:     string,
  institutionId: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const config = await this.getReportConfig(institutionId);

  const [student, convivencias] = await Promise.all([
    this.prisma.student.findFirst({
      where:   { id: studentId, institutionId },
      include: {
        courseStudents: {
          where:   { status: 'ACTIVE' },
          include: {
            course: {
              include: {
                levelGrade: {
                  include: {
                    educationLevel: {
                      select: { id: true, slug: true, name: true },
                    },
                  },
                },
              },
            },
          },
          take:    1,
        },
      },
    }),
    this.prisma.convivencia.findMany({
      where:   { studentId, institutionId, deletedAt: null },
      include: { author: { select: { firstName: true, lastName: true } } },
      orderBy: { date: 'desc' },
    }),
  ]);

  if (!student) throw new NotFoundException('Alumno no encontrado');

  const course = student.courseStudents[0]?.course;

  const html = convivenciasTemplate({
    student: {
      firstName:      student.firstName,
      lastName:       student.lastName,
      documentNumber: student.documentNumber,
    },
    course: course
      ? { name: course.name, grade: course.levelGrade?.displayOrder ?? course.grade, division: course.division }
      : { name: '—', grade: 0, division: '—' },
    convivencias: convivencias.map((c) => ({
      date:   c.date.toISOString(),
      reason: c.reason,
      type:   c.type,
      author: `${c.author.firstName} ${c.author.lastName}`,
    })),
  }, config);

  const buffer   = await this.generatePdf(html);
  const filename = `${student.lastName}_${student.firstName}_convivencias.pdf`
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_');

  return { buffer, filename };
}
}