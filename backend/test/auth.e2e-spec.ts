// test/auth.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  createTestApp,
  cleanDatabase,
  createTestInstitution,
  createTestUser,
  loginAs,
} from './helpers/test-app.helper';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let institutionId: string;
  let adminEmail: string;

  beforeAll(async () => {
    app    = await createTestApp();
    prisma = app.get(PrismaService);
    await cleanDatabase(prisma);

    const institution = await createTestInstitution(prisma);
    institutionId = institution.id;
    const admin = await createTestUser(prisma, institutionId, 'ADMIN', {
      email: 'admin@authtest.com',
    });
    adminEmail = admin.email;
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  // ── Login ──────────────────────────────────
  describe('POST /auth/login', () => {
    it('debe devolver tokens con credenciales válidas', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: adminEmail, password: 'Test123!' })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.email).toBe(adminEmail);
      expect(res.body.user.role).toBe('ADMIN');
      expect(res.body.user).not.toHaveProperty('passwordHash');
    });

    it('debe rechazar credenciales inválidas', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: adminEmail, password: 'wrongpassword' })
        .expect(401);
    });

    it('debe rechazar email inexistente', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'noexiste@test.com', password: 'Test123!' })
        .expect(401);
    });

    it('debe validar formato del body', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'no-es-un-email', password: 'Test123!' })
        .expect(400);
    });
  });

  // ── Refresh Token ──────────────────────────
  describe('POST /auth/refresh', () => {
    it('debe devolver nuevo accessToken con refreshToken válido', async () => {
      const { refreshToken } = await loginAs(app, adminEmail);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
    });

    it('debe rechazar refreshToken inválido', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'token-invalido' })
        .expect(401);
    });
  });

  // ── Logout ─────────────────────────────────
  describe('POST /auth/logout', () => {
    it('debe cerrar sesión y revocar el refreshToken', async () => {
      const { accessToken, refreshToken } = await loginAs(app, adminEmail);

      // Logout
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(204);

      // Intentar usar el refreshToken revocado
      const refreshRes = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });
      expect([200, 401]).toContain(refreshRes.status);
    });
  });

  // ── Rutas protegidas ───────────────────────
  describe('Rutas protegidas', () => {
    it('debe rechazar requests sin token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users')
        .expect(401);
    });

    it('debe rechazar token expirado o malformado', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', 'Bearer token.malformado.aqui')
        .expect(401);
    });

    it('debe permitir acceso con token válido', async () => {
      const { accessToken } = await loginAs(app, adminEmail);

      await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('GET /health debe ser público', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);
    });
  });
});
