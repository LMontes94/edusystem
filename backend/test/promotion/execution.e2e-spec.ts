jest.setTimeout(30000);

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  cleanDatabase,
} from '../helpers/test-app.helper';
import { buildApp, seedBaseData, TestContext } from './helpers/promotion-test.helper';

describe('Promotion — Execution (e2e)', () => {
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

  describe('POST /promotion/execute/:schoolYearId', () => {
    it('PREVIEWED school year → 201 with summary', async () => {
      await prisma.schoolYear.update({
        where: { id: ctx.schoolYear.id },
        data: { promotionStatus: 'PREVIEWED' },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/promotion/execute/${ctx.schoolYear.id}`)
        .set('Authorization', `Bearer ${ctx.adminToken}`)
        .expect(201);

      expect(res.body.schoolYearId).toBe(ctx.schoolYear.id);
      expect(res.body.summary).toBeDefined();
      expect(res.body.summary.totalStudents).toBe(2);

      const results = await prisma.promotionResult.findMany({
        where: { fromSchoolYearId: ctx.schoolYear.id },
      });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('non-PREVIEWED school year → 400 PROMOTION_NOT_PREVIEWED', async () => {
      const freshYear = await prisma.schoolYear.create({
        data: {
          institutionId: ctx.institution.id,
          year: 2029,
          startDate: new Date('2029-03-01'),
          endDate: new Date('2029-11-30'),
          isActive: false,
          status: 'CLOSED',
        },
      });
      await prisma.course.create({
        data: {
          institutionId: ctx.institution.id,
          schoolYearId: freshYear.id,
          name: 'Test Course',
          grade: 1,
          division: 'A',
          level: 'SECUNDARIA',
          levelGradeId: ctx.currentGrade.id,
        } as any,
      });

      await request(app.getHttpServer())
        .post(`/api/v1/promotion/execute/${freshYear.id}`)
        .set('Authorization', `Bearer ${ctx.adminToken}`)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('PROMOTION_NOT_PREVIEWED');
        });
    });

    it('concurrent execute → second receives CONCURRENT_EXECUTION', async () => {
      await prisma.schoolYear.create({
        data: {
          institutionId: ctx.institution.id,
          year: 2031,
          startDate: new Date('2031-03-01'),
          endDate: new Date('2031-11-30'),
          isActive: true,
          status: 'PLANNING',
        },
      });
      const concYear = await prisma.schoolYear.create({
        data: {
          institutionId: ctx.institution.id,
          year: 2030,
          startDate: new Date('2030-03-01'),
          endDate: new Date('2030-11-30'),
          isActive: false,
          status: 'CLOSED',
          promotionStatus: 'PREVIEWED',
        },
      });
      const concCourse = await prisma.course.create({
        data: {
          institutionId: ctx.institution.id,
          schoolYearId: concYear.id,
          name: 'Concurrent Course',
          grade: 1,
          division: 'A',
          level: 'SECUNDARIA',
          levelGradeId: ctx.currentGrade.id,
        } as any,
      });
      await prisma.courseStudent.create({
        data: { courseId: concCourse.id, studentId: ctx.studentA.id, status: 'ACTIVE' },
      });

      const url = `/api/v1/promotion/execute/${concYear.id}`;
      const header = { Authorization: `Bearer ${ctx.adminToken}` };

      const [r1, r2] = await Promise.all([
        request(app.getHttpServer()).post(url).set(header),
        request(app.getHttpServer()).post(url).set(header),
      ]);

      const statuses = [r1.status, r2.status].sort();
      expect(statuses).toEqual([201, 409]);

      const conflict = r1.status === 409 ? r1 : r2;
      expect(conflict.body.message).toBe('CONCURRENT_EXECUTION');
    });
  });
});
