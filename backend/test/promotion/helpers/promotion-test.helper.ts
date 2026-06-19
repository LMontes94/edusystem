import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bull';
import { AppModule } from '../../../src/app.module';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../../../src/common/filters/global-exception.filter';
import { QUEUES } from '../../../src/queues/queue.constants';
import {
  cleanDatabase,
  createTestInstitution,
  createTestUser,
  loginAs,
  authHeader,
} from '../../helpers/test-app.helper';
export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  institution: any;
  adminUser: any;
  teacherUser: any;
  guardianUser: any;
  adminToken: string;
  teacherToken: string;
  guardianToken: string;
  schoolYear: any;
  nextSchoolYear: any;
  educationLevel: any;
  currentGrade: any;
  nextGrade: any;
  studentA: any;
  studentB: any;
  subject: any;
  course: any;
  courseSubject: any;
  courseStudentA: any;
  courseStudentB: any;
}

export async function buildApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(getQueueToken(QUEUES.AUDIT))
    .useValue({ add: jest.fn() })
    .compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.init();
  return app;
}

export async function seedBaseData(app: INestApplication): Promise<TestContext> {
  const prisma = app.get(PrismaService);
  const ctx: Partial<TestContext> = { app, prisma };

  ctx.institution = await createTestInstitution(prisma);

  const instId = ctx.institution.id;

  ctx.educationLevel = await prisma.educationLevel.create({
    data: { institutionId: instId, name: 'Secundaria', slug: 'secundaria' },
  });

  ctx.nextGrade = await prisma.levelGrade.create({
    data: {
      educationLevelId: ctx.educationLevel.id,
      name: '2do Año',
      displayOrder: 2,
      isGraduating: true,
    } as any,
  });

  ctx.currentGrade = await prisma.levelGrade.create({
    data: {
      educationLevelId: ctx.educationLevel.id,
      name: '1ro Año',
      displayOrder: 1,
      nextLevelGradeId: ctx.nextGrade.id,
      isGraduating: false,
    } as any,
  });

  ctx.schoolYear = await prisma.schoolYear.create({
    data: {
      institutionId: instId,
      year: 2025,
      startDate: new Date('2025-03-01'),
      endDate: new Date('2025-11-30'),
      isActive: false,
      status: 'CLOSED',
    } as any,
  });

  ctx.nextSchoolYear = await prisma.schoolYear.create({
    data: {
      institutionId: instId,
      year: 2026,
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-11-30'),
      isActive: true,
      status: 'PLANNING',
    } as any,
  });

  [ctx.adminUser, ctx.teacherUser, ctx.guardianUser] = await Promise.all([
    createTestUser(prisma, instId, 'ADMIN', { email: 'promo-admin@test.com' }),
    createTestUser(prisma, instId, 'TEACHER', { email: 'promo-teacher@test.com' }),
    createTestUser(prisma, instId, 'GUARDIAN', { email: 'promo-guardian@test.com' }),
  ]);

  ctx.subject = await prisma.subject.create({
    data: { institutionId: instId, name: 'Matemáticas', code: 'MAT' } as any,
  });

  ctx.course = await prisma.course.create({
    data: {
      institutionId: instId,
      schoolYearId: ctx.schoolYear.id,
      name: '1ro A',
      grade: 1,
      division: 'A',
      level: 'SECUNDARIA',
      levelGradeId: ctx.currentGrade.id,
    } as any,
  });

  await prisma.courseSubject.create({
    data: { courseId: ctx.course.id, subjectId: ctx.subject.id, teacherId: ctx.teacherUser.id },
  });

  const [stuA, stuB] = await Promise.all([
    prisma.student.create({
      data: {
        institutionId: instId,
        firstName: 'Ana',
        lastName: 'Promovida',
        documentNumber: '10000001',
        birthDate: new Date('2008-05-10'),
      } as any,
    }),
    prisma.student.create({
      data: {
        institutionId: instId,
        firstName: 'Beatriz',
        lastName: 'Retenida',
        documentNumber: '10000002',
        birthDate: new Date('2008-06-15'),
      } as any,
    }),
  ]);
  ctx.studentA = stuA;
  ctx.studentB = stuB;

  const [csa, csb] = await Promise.all([
    prisma.courseStudent.create({
      data: { courseId: ctx.course.id, studentId: stuA.id, status: 'ACTIVE' },
    }),
    prisma.courseStudent.create({
      data: { courseId: ctx.course.id, studentId: stuB.id, status: 'ACTIVE' },
    }),
  ]);
  ctx.courseStudentA = csa;
  ctx.courseStudentB = csb;

  await prisma.guardian.create({
    data: {
      userId: ctx.guardianUser.id,
      studentId: stuA.id,
      relationship: 'PADRE',
      isPrimary: true,
      canPickup: true,
    },
  });

  const [tokAdmin, tokTeacher, tokGuardian] = await Promise.all([
    loginAs(app, 'promo-admin@test.com').then((r) => r.accessToken),
    loginAs(app, 'promo-teacher@test.com').then((r) => r.accessToken),
    loginAs(app, 'promo-guardian@test.com').then((r) => r.accessToken),
  ]);
  ctx.adminToken = tokAdmin;
  ctx.teacherToken = tokTeacher;
  ctx.guardianToken = tokGuardian;

  return ctx as TestContext;
}
