jest.setTimeout(30000);

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  cleanDatabase,
} from '../helpers/test-app.helper';
import { buildApp, seedBaseData, TestContext } from './helpers/promotion-test.helper';

describe('Promotion — Preview (e2e)', () => {
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

  describe('GET /promotion/preview/:schoolYearId', () => {
    it('CLOSED year → 200 with projections', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/promotion/preview/${ctx.schoolYear.id}`)
        .set('Authorization', `Bearer ${ctx.adminToken}`)
        .expect(200);

      expect(res.body.schoolYearId).toBe(ctx.schoolYear.id);
      expect(res.body.totalStudents).toBe(2);
      expect(res.body.projections).toBeDefined();
      expect(res.body.projections.promoted + res.body.projections.retained + res.body.projections.graduated).toBe(2);
      expect(res.body.students).toHaveLength(2);
    });

    it('ACTIVE school year → 400 SCHOOL_YEAR_NOT_CLOSED', async () => {
      const activeYear = await prisma.schoolYear.create({
        data: {
          institutionId: ctx.institution.id,
          year: 2027,
          startDate: new Date('2027-03-01'),
          endDate: new Date('2027-11-30'),
          isActive: true,
          status: 'ACTIVE',
        },
      });

      await request(app.getHttpServer())
        .get(`/api/v1/promotion/preview/${activeYear.id}`)
        .set('Authorization', `Bearer ${ctx.adminToken}`)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('SCHOOL_YEAR_NOT_CLOSED');
        });
    });

    it('TEACHER can read preview (CASL read access) → 200', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/promotion/preview/${ctx.schoolYear.id}`)
        .set('Authorization', `Bearer ${ctx.teacherToken}`)
        .expect(200);

      expect(res.body.totalStudents).toBe(2);
    });

    it('EXECUTING promotion status → 400 PROMOTION_ALREADY_EXECUTING', async () => {
      const executingYear = await prisma.schoolYear.create({
        data: {
          institutionId: ctx.institution.id,
          year: 2028,
          startDate: new Date('2028-03-01'),
          endDate: new Date('2028-11-30'),
          isActive: true,
          status: 'CLOSED',
          promotionStatus: 'EXECUTING',
        },
      });

      await request(app.getHttpServer())
        .get(`/api/v1/promotion/preview/${executingYear.id}`)
        .set('Authorization', `Bearer ${ctx.adminToken}`)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('PROMOTION_ALREADY_EXECUTING');
        });
    });
  });
});
