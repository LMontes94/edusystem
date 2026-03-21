// test/abac.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  cleanDatabase,
  createTestInstitution,
  createTestUser,
  loginAs,
  authHeader,
} from './helpers/test-app.helper';

// ──────────────────────────────────────────────
// Tests de ABAC — verifican que cada rol solo
// puede hacer lo que debe.
//
// Estos son los tests más críticos del sistema.
// Si alguno falla, hay una brecha de seguridad real.
// ──────────────────────────────────────────────

describe('ABAC — Control de acceso (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let instA: any;
  let instB: any;
  let adminA: any;
  let adminB: any;
  let teacherA: any;
  let guardianA: any;
  let tokenAdminA: string;
  let tokenAdminB: string;
  let tokenTeacherA: string;
  let tokenGuardianA: string;

  beforeAll(async () => {
    app    = await createTestApp();
    prisma = app.get(PrismaService);
    await cleanDatabase(prisma);

    // Crear DOS instituciones para probar aislamiento entre tenants
    [instA, instB] = await Promise.all([
      createTestInstitution(prisma),
      createTestInstitution(prisma),
    ]);

    // Crear usuarios en institución A
    [adminA, teacherA, guardianA] = await Promise.all([
      createTestUser(prisma, instA.id, 'ADMIN',    { email: 'admin-a@test.com' }),
      createTestUser(prisma, instA.id, 'TEACHER',  { email: 'teacher-a@test.com' }),
      createTestUser(prisma, instA.id, 'GUARDIAN', { email: 'guardian-a@test.com' }),
    ]);

    // Crear admin en institución B
    adminB = await createTestUser(prisma, instB.id, 'ADMIN', { email: 'admin-b@test.com' });

    // Obtener tokens
    [tokenAdminA, tokenAdminB, tokenTeacherA, tokenGuardianA] = await Promise.all([
      loginAs(app, 'admin-a@test.com').then((r) => r.accessToken),
      loginAs(app, 'admin-b@test.com').then((r) => r.accessToken),
      loginAs(app, 'teacher-a@test.com').then((r) => r.accessToken),
      loginAs(app, 'guardian-a@test.com').then((r) => r.accessToken),
    ]);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  // ── Aislamiento entre instituciones ──────────
  describe('Aislamiento multi-tenant', () => {
    it('ADMIN de institución B no puede ver usuarios de institución A', async () => {
      // Admin B obtiene lista de usuarios — solo debe ver los suyos
      const res = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set(authHeader(tokenAdminB))
        .expect(200);

      const emails = res.body.map((u: any) => u.email);
      expect(emails).not.toContain('admin-a@test.com');
      expect(emails).not.toContain('teacher-a@test.com');
      expect(emails).toContain('admin-b@test.com');
    });

    it('ADMIN de institución A no puede ver detalles de institución B', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/institutions/${instB.id}`)
        .set(authHeader(tokenAdminA))
        .expect(403);
    });
  });

  // ── Permisos por rol ──────────────────────────
  describe('TEACHER — restricciones', () => {
    it('TEACHER no puede crear usuarios', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set(authHeader(tokenTeacherA))
        .send({
          email:     'nuevo@test.com',
          password:  'Test123!',
          firstName: 'Nuevo',
          lastName:  'Usuario',
          role:      'TEACHER',
        })
        .expect(403);
    });

    it('TEACHER no puede crear alumnos', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/students')
        .set(authHeader(tokenTeacherA))
        .send({
          firstName:      'Alumno',
          lastName:       'Test',
          documentNumber: '99999999',
          birthDate:      '2015-01-01',
        })
        .expect(403);
    });

    it('TEACHER puede leer alumnos de su institución', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/students')
        .set(authHeader(tokenTeacherA))
        .expect(200);
    });

    it('TEACHER puede leer cursos de su institución', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/courses')
        .set(authHeader(tokenTeacherA))
        .expect(200);
    });
  });

  describe('GUARDIAN — restricciones', () => {
    it('GUARDIAN no puede crear usuarios', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/users')
        .set(authHeader(tokenGuardianA))
        .send({
          email:     'otro@test.com',
          password:  'Test123!',
          firstName: 'Otro',
          lastName:  'Usuario',
          role:      'GUARDIAN',
        })
        .expect(403);
    });

    it('GUARDIAN no puede crear alumnos', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/students')
        .set(authHeader(tokenGuardianA))
        .send({
          firstName:      'Alumno',
          lastName:       'Test',
          documentNumber: '88888888',
          birthDate:      '2015-01-01',
        })
        .expect(403);
    });

    it('GUARDIAN no puede crear cursos', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/courses')
        .set(authHeader(tokenGuardianA))
        .send({
          schoolYearId: 'cualquier-id',
          name:         '1ro A',
          grade:        1,
          division:     'A',
          level:        'PRIMARIA',
        })
        .expect(403);
    });

    it('GUARDIAN puede leer cursos', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/courses')
        .set(authHeader(tokenGuardianA))
        .expect(200);
    });

    it('GUARDIAN puede leer sus notificaciones', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set(authHeader(tokenGuardianA))
        .expect(200);
    });
  });

  describe('ADMIN — permisos completos en su institución', () => {
    it('ADMIN puede listar usuarios de su institución', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set(authHeader(tokenAdminA))
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('ADMIN puede ver su propia institución', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/institutions/${instA.id}`)
        .set(authHeader(tokenAdminA))
        .expect(200);

      expect(res.body.id).toBe(instA.id);
    });
  });
});
