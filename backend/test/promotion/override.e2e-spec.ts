jest.setTimeout(30000);

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  cleanDatabase,
} from '../helpers/test-app.helper';
import { buildApp, seedBaseData, TestContext } from './helpers/promotion-test.helper';

describe('Promotion — Override (e2e)', () => {
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

  describe('POST /promotion/override', () => {
    it('valid override → 201 with isOverride=true', async () => {
      const payload = {
        studentId: ctx.studentA.id,
        fromSchoolYearId: ctx.schoolYear.id,
        result: 'PROMOTED',
        reason: 'Rendimiento excepcional durante todo el ciclo',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/promotion/override')
        .set('Authorization', `Bearer ${ctx.adminToken}`)
        .send(payload)
        .expect(201);

      expect(res.body.isOverride).toBe(true);
      expect(res.body.result).toBe('PROMOTED');
      expect(res.body.reason).toBe(payload.reason);
      expect(res.body.id).toBeDefined();

      const record = await prisma.promotionResult.findUnique({
        where: { id: res.body.id },
      });
      expect(record).not.toBeNull();
      expect(record!.isOverride).toBe(true);

      const schoolYear = await prisma.schoolYear.findUnique({
        where: { id: ctx.schoolYear.id },
      });
      expect(schoolYear!.promotionSummaryStale).toBe(true);
    });

    it('invalid reason (< 10 chars) → 400 validation error', async () => {
      const payload = {
        studentId: ctx.studentB.id,
        fromSchoolYearId: ctx.schoolYear.id,
        result: 'RETAINED',
        reason: 'Corto',
      };

      await request(app.getHttpServer())
        .post('/api/v1/promotion/override')
        .set('Authorization', `Bearer ${ctx.adminToken}`)
        .send(payload)
        .expect(400);
    });

    it('TEACHER cannot override (CASL create denied) → 403', async () => {
      const payload = {
        studentId: ctx.studentA.id,
        fromSchoolYearId: ctx.schoolYear.id,
        result: 'PROMOTED',
        reason: 'Docente intentando modificar resultados sin permiso',
      };

      await request(app.getHttpServer())
        .post('/api/v1/promotion/override')
        .set('Authorization', `Bearer ${ctx.teacherToken}`)
        .send(payload)
        .expect(403);
    });

    it('invalid studentId (non-uuid) → 400 validation error', async () => {
      const payload = {
        studentId: 'not-a-uuid',
        fromSchoolYearId: ctx.schoolYear.id,
        result: 'RETAINED',
        reason: 'Razón suficientemente larga para pasar validación',
      };

      await request(app.getHttpServer())
        .post('/api/v1/promotion/override')
        .set('Authorization', `Bearer ${ctx.adminToken}`)
        .send(payload)
        .expect(400);
    });

    it('EXECUTING school year → 400 OVERRIDE_FORBIDDEN_DURING_EXECUTION', async () => {
      const executingYear = await prisma.schoolYear.create({
        data: {
          institutionId: ctx.institution.id,
          year: 2031,
          startDate: new Date('2031-03-01'),
          endDate: new Date('2031-11-30'),
          isActive: false,
          status: 'CLOSED',
          promotionStatus: 'EXECUTING',
        },
      });

      const payload = {
        studentId: ctx.studentA.id,
        fromSchoolYearId: executingYear.id,
        result: 'RETAINED',
        reason: 'El estudiante necesita reforzar contenidos previos',
      };

      await request(app.getHttpServer())
        .post('/api/v1/promotion/override')
        .set('Authorization', `Bearer ${ctx.adminToken}`)
        .send(payload)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toBe('OVERRIDE_FORBIDDEN_DURING_EXECUTION');
        });
    });
  });
});
