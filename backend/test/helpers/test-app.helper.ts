// test/helpers/test-app.helper.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';
import * as bcrypt from 'bcryptjs';

// ──────────────────────────────────────────────
// Helpers compartidos para tests de integración.
// Crean una app NestJS real con DB de test.
// ──────────────────────────────────────────────

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.init();
  return app;
}

export async function cleanDatabase(prisma: PrismaService) {
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatRoomMember.deleteMany();
  await prisma.chatRoom.deleteMany();
  await prisma.announcement.deleteMany();  
  await prisma.attendance.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.guardian.deleteMany();
  await prisma.courseStudent.deleteMany();
  await prisma.courseSubject.deleteMany();
  await prisma.period.deleteMany();
  await prisma.course.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.schoolYear.deleteMany();
  await prisma.student.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.pushToken.deleteMany();    
  await prisma.invitation.deleteMany();
  await prisma.user.deleteMany();
  await prisma.institution.deleteMany();
}

export async function createTestInstitution(prisma: PrismaService) {
  return prisma.institution.create({
    data: {
      name:   'Test Institution',
      status: 'ACTIVE',
      plan:   'PRO',
    },
  });
}

export async function createTestUser(
  prisma: PrismaService,
  institutionId: string,
  role: 'ADMIN' | 'TEACHER' | 'GUARDIAN',
  overrides: Partial<{ email: string; firstName: string; lastName: string }> = {},
) {
  const passwordHash = await bcrypt.hash('Test123!', 10);
  return prisma.user.create({
    data: {
      institutionId,
      email:        overrides.email        ?? `${role.toLowerCase()}-${Date.now()}@test.com`,
      passwordHash,
      firstName:    overrides.firstName    ?? role,
      lastName:     overrides.lastName     ?? 'Test',
      role,
      status:       'ACTIVE',
    },
  });
}

export async function loginAs(
  app: INestApplication,
  email: string,
  password = 'Test123!',
): Promise<{ accessToken: string; refreshToken: string }> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password });

  return {
    accessToken:  res.body.accessToken,
    refreshToken: res.body.refreshToken,
  };
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
