// test/grades.e2e-spec.ts
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

describe('Grades — Flujo de notas (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let institution: any;
  let admin: any;
  let teacher1: any;
  let teacher2: any;
  let guardian: any;
  let student: any;
  let schoolYear: any;
  let period: any;
  let subject: any;
  let course: any;
  let courseSubject1: any; // teacher1 → subject
  let courseSubject2: any; // teacher2 → subject2

  let tokenAdmin: string;
  let tokenTeacher1: string;
  let tokenTeacher2: string;
  let tokenGuardian: string;

  beforeAll(async () => {
    app    = await createTestApp();
    prisma = app.get(PrismaService);
    await cleanDatabase(prisma);

    institution = await createTestInstitution(prisma);

    [admin, teacher1, teacher2, guardian] = await Promise.all([
      createTestUser(prisma, institution.id, 'ADMIN',    { email: 'admin@gradestest.com' }),
      createTestUser(prisma, institution.id, 'TEACHER',  { email: 'teacher1@gradestest.com' }),
      createTestUser(prisma, institution.id, 'TEACHER',  { email: 'teacher2@gradestest.com' }),
      createTestUser(prisma, institution.id, 'GUARDIAN', { email: 'guardian@gradestest.com' }),
    ]);

    // Estructura académica
    schoolYear = await prisma.schoolYear.create({
      data: {
        institutionId: institution.id,
        year:          2026,
        startDate:     new Date('2026-03-01'),
        endDate:       new Date('2026-11-30'),
        isActive:      true,
      },
    });

    period = await prisma.period.create({
      data: {
        schoolYearId: schoolYear.id,
        name:         'Primer Trimestre',
        type:         'TRIMESTRE',
        order:        1,
        startDate:    new Date('2026-03-01'),
        endDate:      new Date('2026-05-31'),
      },
    });

    const [subj1, subj2] = await Promise.all([
      prisma.subject.create({
        data: { institutionId: institution.id, name: 'Matemáticas', code: 'MAT' } as any,
      }),
      prisma.subject.create({
        data: { institutionId: institution.id, name: 'Lengua', code: 'LEN' } as any,
      }),
    ]);
    subject = subj1;

    course = await prisma.course.create({
      data: {
        institutionId: institution.id,
        schoolYearId:  schoolYear.id,
        name:          '3ro A',
        grade:         3,
        division:      'A',
        level:         'PRIMARIA',
      } as any,
    });

    [courseSubject1, courseSubject2] = await Promise.all([
      prisma.courseSubject.create({
        data: { courseId: course.id, subjectId: subj1.id, teacherId: teacher1.id },
      }),
      prisma.courseSubject.create({
        data: { courseId: course.id, subjectId: subj2.id, teacherId: teacher2.id },
      }),
    ]);

    student = await prisma.student.create({
      data: {
        institutionId:  institution.id,
        firstName:      'Pedro',
        lastName:       'Test',
        documentNumber: '12345999',
        birthDate:      new Date('2015-01-01'),
      } as any,
    });

    await prisma.courseStudent.create({
      data: { courseId: course.id, studentId: student.id, status: 'ACTIVE' },
    });

    await prisma.guardian.create({
      data: {
        userId:       guardian.id,
        studentId:    student.id,
        relationship: 'PADRE',
        isPrimary:    true,
        canPickup:    true,
      },
    });

    // Tokens
    [tokenAdmin, tokenTeacher1, tokenTeacher2, tokenGuardian] = await Promise.all([
      loginAs(app, 'admin@gradestest.com').then((r) => r.accessToken),
      loginAs(app, 'teacher1@gradestest.com').then((r) => r.accessToken),
      loginAs(app, 'teacher2@gradestest.com').then((r) => r.accessToken),
      loginAs(app, 'guardian@gradestest.com').then((r) => r.accessToken),
    ]);
  });

  afterAll(async () => {
    await cleanDatabase(prisma);
    await app.close();
  });

  // ── Crear nota ────────────────────────────────
  describe('POST /grades', () => {
    it('TEACHER puede cargar nota en su propia materia', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/grades')
        .set(authHeader(tokenTeacher1))
        .send({
          studentId:       student.id,
          courseSubjectId: courseSubject1.id,
          periodId:        period.id,
          score:           8.5,
          type:            'EXAM',
          date:            '2026-03-15',
        })
        .expect(201);

      expect(Number(res.body.score)).toBe(8.5);
      expect(res.body.student.id).toBe(student.id);
    });

    it('TEACHER NO puede cargar nota en materia de otro docente', async () => {
      // teacher2 intenta cargar nota en la materia de teacher1
      await request(app.getHttpServer())
        .post('/api/v1/grades')
        .set(authHeader(tokenTeacher2))
        .send({
          studentId:       student.id,
          courseSubjectId: courseSubject1.id, // materia de teacher1
          periodId:        period.id,
          score:           7.0,
          type:            'EXAM',
          date:            '2026-03-15',
        })
        .expect(403);
    });

    it('GUARDIAN no puede cargar notas', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/grades')
        .set(authHeader(tokenGuardian))
        .send({
          studentId:       student.id,
          courseSubjectId: courseSubject1.id,
          periodId:        period.id,
          score:           10,
          type:            'EXAM',
          date:            '2026-03-15',
        })
        .expect(403);
    });

    it('ADMIN puede cargar nota en cualquier materia', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/grades')
        .set(authHeader(tokenAdmin))
        .send({
          studentId:       student.id,
          courseSubjectId: courseSubject2.id,
          periodId:        period.id,
          score:           9.0,
          type:            'ASSIGNMENT',
          date:            '2026-03-16',
        })
        .expect(201);

      expect(Number(res.body.score)).toBe(9.0);
    });

    it('debe validar que el score esté entre 0 y 10', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/grades')
        .set(authHeader(tokenTeacher1))
        .send({
          studentId:       student.id,
          courseSubjectId: courseSubject1.id,
          periodId:        period.id,
          score:           15, // inválido
          type:            'EXAM',
          date:            '2026-03-15',
        })
        .expect(400);
    });
  });

  // ── Leer notas ────────────────────────────────
  describe('GET /grades', () => {
    it('TEACHER solo ve notas de sus materias', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/grades')
        .set(authHeader(tokenTeacher1))
        .expect(200);

      // Todas las notas deben ser de la materia de teacher1
      res.body.forEach((g: any) => {
        expect(g.courseSubject.id).toBe(courseSubject1.id);
      });
    });

    it('GUARDIAN solo ve notas de sus hijos', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/grades')
        .set(authHeader(tokenGuardian))
        .expect(200);

      res.body.forEach((g: any) => {
        expect(g.student.id).toBe(student.id);
      });
    });

    it('ADMIN ve todas las notas de la institución', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/grades')
        .set(authHeader(tokenAdmin))
        .expect(200);

      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  // ── Promedio ──────────────────────────────────
  describe('GET /grades/student/:id/average/:periodId', () => {
    it('devuelve el promedio correctamente', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/grades/student/${student.id}/average/${period.id}`)
        .set(authHeader(tokenAdmin))
        .expect(200);

      expect(res.body.average).toBeDefined();
      expect(res.body.total).toBeGreaterThan(0);
    });

    it('GUARDIAN puede ver el promedio de su hijo', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/grades/student/${student.id}/average/${period.id}`)
        .set(authHeader(tokenGuardian))
        .expect(200);
    });
  });
});
