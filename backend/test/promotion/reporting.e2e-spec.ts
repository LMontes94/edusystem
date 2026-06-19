jest.setTimeout(30000);

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  cleanDatabase,
} from '../helpers/test-app.helper';
import { buildApp, seedBaseData, TestContext } from './helpers/promotion-test.helper';

describe('Promotion — Reporting (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ctx: TestContext;

  beforeAll(async () => {
    app = await buildApp();
    prisma = app.get(PrismaService);
    await cleanDatabase(prisma);
    ctx = await seedBaseData(app);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  describe('GET /promotion/student-history/:studentId', () => {
    it('guardian can view own child — 200', async () => {
      await prisma.promotionResult.create({
        data: {
          institutionId: ctx.institution.id,
          studentId: ctx.studentA.id,
          fromSchoolYearId: ctx.schoolYear.id,
          toSchoolYearId: ctx.nextSchoolYear.id,
          fromCourseStudentId: ctx.courseStudentA.id,
          result: 'PROMOTED',
          criteria: { engineVersion: '1.0' },
          isOverride: false,
          decidedById: ctx.adminUser.id,
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/promotion/student-history/${ctx.studentA.id}`)
        .set('Authorization', `Bearer ${ctx.guardianToken}`)
        .expect(200);

      expect(res.body.studentId).toBe(ctx.studentA.id);
      expect(res.body.results.length).toBeGreaterThanOrEqual(1);
    });

    it('guardian cannot view unrelated student — 403', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/promotion/student-history/${ctx.studentB.id}`)
        .set('Authorization', `Bearer ${ctx.guardianToken}`)
        .expect(403)
        .expect((res) => {
          expect(res.body.message).toMatch(/hijos/i);
        });
    });
  });

  describe('GET /promotion/results — effective result latest wins', () => {
    it('latest override wins over engine result', async () => {
      const evalStudent = await prisma.student.create({
        data: {
          institutionId: ctx.institution.id,
          firstName: 'Eva',
          lastName: 'Evaluada',
          documentNumber: '20000001',
          birthDate: new Date('2008-07-20'),
        } as any,
      });
      const evalCourseStudent = await prisma.courseStudent.create({
        data: { courseId: ctx.course.id, studentId: evalStudent.id, status: 'ACTIVE' },
      });

      await prisma.promotionResult.create({
        data: {
          institutionId: ctx.institution.id,
          studentId: evalStudent.id,
          fromSchoolYearId: ctx.schoolYear.id,
          toSchoolYearId: ctx.nextSchoolYear.id,
          fromCourseStudentId: evalCourseStudent.id,
          result: 'RETAINED',
          criteria: { engineVersion: '1.0' },
          evaluationSnapshot: { averageScore: 6.5 },
          isOverride: false,
          decidedById: ctx.adminUser.id,
          decidedAt: new Date('2025-12-01T10:00:00Z'),
        },
      });

      const latestOverride = await prisma.promotionResult.create({
        data: {
          institutionId: ctx.institution.id,
          studentId: evalStudent.id,
          fromSchoolYearId: ctx.schoolYear.id,
          toSchoolYearId: ctx.nextSchoolYear.id,
          fromCourseStudentId: evalCourseStudent.id,
          result: 'PROMOTED',
          criteria: { engineVersion: '1.0' },
          isOverride: true,
          reason: 'Aprobó todas las materias en diciembre',
          decidedById: ctx.adminUser.id,
          decidedAt: new Date('2025-12-15T10:00:00Z'),
        },
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/promotion/results?schoolYearId=${ctx.schoolYear.id}`)
        .set('Authorization', `Bearer ${ctx.adminToken}`)
        .expect(200);

      const rows = res.body as any[];
      const evaRow = rows.find((r: any) => r.student_id === evalStudent.id);
      expect(evaRow).toBeDefined();
      expect(evaRow.id).toBe(latestOverride.id);
      expect(evaRow.is_override).toBe(true);

      const allStudentRows = rows.filter((r: any) => r.student_id === evalStudent.id);
      expect(allStudentRows.length).toBe(1);
    });
  });
});
