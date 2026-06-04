// prisma/seed.ts
// ──────────────────────────────────────────────
// Seed completo de EduSystem
//
// Crea:
//   • 1 institución (Colegio San Martín)
//   • 1 ADMIN, 3 TEACHER, 1 PRECEPTOR, 4 GUARDIAN
//   • 6 alumnos con sus tutores vinculados
//   • 1 año lectivo 2026 con 3 períodos
//   • 4 materias (Matemáticas, Lengua, Ciencias, Ed. Física)
//   • 2 cursos (3ro A y 4to B)
//   • Asignación de docentes a materias
//   • Matrícula de alumnos en cursos
//   • Notas y asistencias de ejemplo
//   • 2 comunicados
//   • 3 espacios físicos con reservas
//   • 2 deportes con grupos
//   • Asignaciones de materias recursadas/eximidas
//
// Uso:
//   npx ts-node prisma/seed.ts
//   o
//   npm run prisma:seed
// ──────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...\n');

  // ── Limpiar datos existentes ─────────────────
  console.log('🧹 Limpiando datos anteriores...');

  // 1. Tablas pivot / intermedias
  await prisma.sportGroupStudent.deleteMany();
  await prisma.sportGroupTeacher.deleteMany();
  await prisma.chatRoomMember.deleteMany();
  await prisma.userLevelRole.deleteMany();

  // 2. Tablas hijas que referencian otras hijas
  await prisma.justification.deleteMany();
  await prisma.absenceRecord.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.studentObservation.deleteMany();
  await prisma.studentCourseSubject.deleteMany();
  await prisma.pendingSubject.deleteMany();
  await prisma.closingGrade.deleteMany();
  await prisma.syllabus.deleteMany();
  await prisma.convivencia.deleteMany();
  await prisma.guardian.deleteMany();
  await prisma.courseStudent.deleteMany();
  await prisma.courseSubject.deleteMany();
  await prisma.indicator.deleteMany();
  await prisma.spaceReservation.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.pushToken.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.auditLog.deleteMany();

  // 3. Tablas principales
  await prisma.sportGroup.deleteMany();
  await prisma.sport.deleteMany();
  await prisma.space.deleteMany();
  await prisma.period.deleteMany();
  await prisma.course.deleteMany();
  await prisma.student.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.schoolYear.deleteMany();
  await prisma.chatRoom.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.user.deleteMany();

  // 4. Raíz
  await prisma.institution.deleteMany();

  console.log('✅ Datos anteriores eliminados\n');

  // ── Institución ──────────────────────────────
  console.log('🏫 Creando institución...');
  const institution = await prisma.institution.create({
    data: {
      name:    'Colegio San Martín',
      domain:  'sanmartin.edu.ar',
      address: 'Av. San Martín 1234, Buenos Aires',
      phone:   '+54 11 4567-8900',
      plan:    'PRO',
      status:  'ACTIVE',
    },
  });
  console.log(`✅ Institución: ${institution.name} (${institution.id})\n`);

  // ── EducationLevels ───────────────────────────
  console.log('📊 Creando niveles educativos...');
  const educLevels = await Promise.all([
    prisma.educationLevel.create({ data: { institutionId: institution.id, slug: 'inicial',    name: 'Inicial',    displayOrder: 1, status: 'ACTIVE' } }),
    prisma.educationLevel.create({ data: { institutionId: institution.id, slug: 'primaria',   name: 'Primaria',   displayOrder: 2, status: 'ACTIVE' } }),
    prisma.educationLevel.create({ data: { institutionId: institution.id, slug: 'secundaria', name: 'Secundaria', displayOrder: 3, status: 'ACTIVE' } }),
  ]);
  const [nivelInicial, nivelPrimaria, nivelSecundaria] = educLevels;
  console.log(`✅ 3 niveles educativos creados\n`);

  // ── LevelGrades ──────────────────────────────
  const ordinalSuffix = (n: number) => {
    const map: Record<number, string> = { 1: 'ro', 2: 'do', 3: 'ro', 4: 'to' };
    return map[n] ?? 'to';
  };
  const levelGradeNames: { slug: string; grade: number }[] = [];
  for (let g = 1; g <= 5; g++) levelGradeNames.push({ slug: 'secundaria', grade: g });

  const levelGrades = await Promise.all(
    levelGradeNames.map(({ slug, grade }) => {
      const el = educLevels.find((e) => e.slug === slug)!;
      return prisma.levelGrade.create({
        data: {
          educationLevelId: el.id,
          name:             `${grade}${ordinalSuffix(grade)}`,
          displayOrder:     grade,
          status:           'ACTIVE',
        },
      });
    }),
  );
  const lgByGrade = Object.fromEntries(levelGrades.map((lg) => [lg.displayOrder, lg.id]));
  console.log(`✅ ${levelGrades.length} LevelGrades creados (${levelGradeNames.map((l) => `${l.slug}/${l.grade}`).join(', ')})\n`);

  // ── Contraseñas ──────────────────────────────
  const adminPass     = await bcrypt.hash('Admin123!',    12);
  const teacherPass   = await bcrypt.hash('Docente123!',  12);
  const guardianPass  = await bcrypt.hash('Padre123!',    12);
  const preceptorPass = await bcrypt.hash('Preceptor123!',12);

  // ── Usuarios ─────────────────────────────────
  console.log('👤 Creando usuarios...');

  const admin = await prisma.user.create({
    data: {
      institutionId: institution.id,
      email:         'admin@sanmartin.edu.ar',
      passwordHash:  adminPass,
      firstName:     'Carlos',
      lastName:      'Rodríguez',
      role:          'ADMIN',
      status:        'ACTIVE',
    },
  });

  const preceptor = await prisma.user.create({
    data: {
      institutionId: institution.id,
      email:         'preceptor@sanmartin.edu.ar',
      passwordHash:  preceptorPass,
      firstName:     'Diego',
      lastName:      'Ramírez',
      role:          'PRECEPTOR',
      status:        'ACTIVE',
    },
  });

  // Docentes: teacher1=Matemáticas, teacher2=Lengua, teacher3=Ciencias, teacher4=Ed.Física
  const [teacher1, teacher2, teacher3, teacher4] = await Promise.all([
    prisma.user.create({
      data: {
        institutionId: institution.id,
        email:         'maria.garcia@sanmartin.edu.ar',
        passwordHash:  teacherPass,
        firstName:     'María',
        lastName:      'García',
        role:          'TEACHER',
        status:        'ACTIVE',
      },
    }),
    prisma.user.create({
      data: {
        institutionId: institution.id,
        email:         'juan.lopez@sanmartin.edu.ar',
        passwordHash:  teacherPass,
        firstName:     'Juan',
        lastName:      'López',
        role:          'TEACHER',
        status:        'ACTIVE',
      },
    }),
    prisma.user.create({
      data: {
        institutionId: institution.id,
        email:         'ana.martinez@sanmartin.edu.ar',
        passwordHash:  teacherPass,
        firstName:     'Ana',
        lastName:      'Martínez',
        role:          'TEACHER',
        status:        'ACTIVE',
      },
    }),
    prisma.user.create({
      data: {
        institutionId: institution.id,
        email:         'pedro.silva@sanmartin.edu.ar',
        passwordHash:  teacherPass,
        firstName:     'Pedro',
        lastName:      'Silva',
        role:          'TEACHER',
        status:        'ACTIVE',
      },
    }),
  ]);

  const [guardian1, guardian2, guardian3, guardian4] = await Promise.all([
    prisma.user.create({
      data: {
        institutionId: institution.id,
        email:         'roberto.perez@gmail.com',
        passwordHash:  guardianPass,
        firstName:     'Roberto',
        lastName:      'Pérez',
        role:          'GUARDIAN',
        status:        'ACTIVE',
      },
    }),
    prisma.user.create({
      data: {
        institutionId: institution.id,
        email:         'laura.gonzalez@gmail.com',
        passwordHash:  guardianPass,
        firstName:     'Laura',
        lastName:      'González',
        role:          'GUARDIAN',
        status:        'ACTIVE',
      },
    }),
    prisma.user.create({
      data: {
        institutionId: institution.id,
        email:         'pablo.fernandez@gmail.com',
        passwordHash:  guardianPass,
        firstName:     'Pablo',
        lastName:      'Fernández',
        role:          'GUARDIAN',
        status:        'ACTIVE',
      },
    }),
    prisma.user.create({
      data: {
        institutionId: institution.id,
        email:         'claudia.torres@gmail.com',
        passwordHash:  guardianPass,
        firstName:     'Claudia',
        lastName:      'Torres',
        role:          'GUARDIAN',
        status:        'ACTIVE',
      },
    }),
  ]);
  console.log('✅ 10 usuarios creados (1 admin, 1 preceptor, 4 docentes, 4 tutores)\n');

  // ── Año lectivo y períodos ───────────────────
  console.log('📅 Creando año lectivo y períodos...');
  const schoolYear = await prisma.schoolYear.create({
    data: {
      institutionId: institution.id,
      year:          2026,
      startDate:     new Date('2026-03-01'),
      endDate:       new Date('2026-11-30'),
      isActive:      true,
    },
  });

  const [period1, period2, period3] = await Promise.all([
    prisma.period.create({
      data: {
        schoolYearId: schoolYear.id,
        name:         'Primer Trimestre',
        type:         'TRIMESTRE',
        order:        1,
        startDate:    new Date('2026-03-01'),
        endDate:      new Date('2026-05-31'),
      },
    }),
    prisma.period.create({
      data: {
        schoolYearId: schoolYear.id,
        name:         'Segundo Trimestre',
        type:         'TRIMESTRE',
        order:        2,
        startDate:    new Date('2026-06-01'),
        endDate:      new Date('2026-08-31'),
      },
    }),
    prisma.period.create({
      data: {
        schoolYearId: schoolYear.id,
        name:         'Tercer Trimestre',
        type:         'TRIMESTRE',
        order:        3,
        startDate:    new Date('2026-09-01'),
        endDate:      new Date('2026-11-30'),
      },
    }),
  ]);
  console.log('✅ Año lectivo 2026 con 3 trimestres\n');

  // ── Materias ──────────────────────────────────
  console.log('📚 Creando materias y cursos...');
  const [materia1, materia2, materia3, materiaEF] = await Promise.all([
    prisma.subject.create({ data: { institutionId: institution.id, name: 'Matemáticas', code: 'MAT', color: '#6366f1' } }),
    prisma.subject.create({ data: { institutionId: institution.id, name: 'Lengua',      code: 'LEN', color: '#0ea5e9' } }),
    prisma.subject.create({ data: { institutionId: institution.id, name: 'Ciencias',    code: 'CIE', color: '#10b981' } }),
    prisma.subject.create({ data: { institutionId: institution.id, name: 'Ed. Física',  code: 'EDF', color: '#f59e0b' } }),
  ]);

  // ── Cursos ────────────────────────────────────
  // 3ro A (año anterior para recursantes) y 4to B (año actual)
  const curso3A = await prisma.course.create({
    data: {
      institutionId: institution.id,
      schoolYearId:  schoolYear.id,
      name:          '3ro A',
      grade:         3,
      division:      'A',
      level:         'SECUNDARIA',
      levelGradeId:  lgByGrade[3],
    } as any,
  });

  const curso4B = await prisma.course.create({
    data: {
      institutionId: institution.id,
      schoolYearId:  schoolYear.id,
      name:          '4to B',
      grade:         4,
      division:      'B',
      level:         'SECUNDARIA',
      levelGradeId:  lgByGrade[4],
    } as any,
  });

  // ── CourseSubjects ────────────────────────────
  // 3ro A
  const [cs3A_mat, cs3A_len, cs3A_cie, cs3A_ef] = await Promise.all([
    prisma.courseSubject.create({ data: { courseId: curso3A.id, subjectId: materia1.id,  teacherId: teacher1.id, hoursPerWeek: 4 } }),
    prisma.courseSubject.create({ data: { courseId: curso3A.id, subjectId: materia2.id,  teacherId: teacher2.id, hoursPerWeek: 4 } }),
    prisma.courseSubject.create({ data: { courseId: curso3A.id, subjectId: materia3.id,  teacherId: teacher3.id, hoursPerWeek: 3 } }),
    prisma.courseSubject.create({ data: { courseId: curso3A.id, subjectId: materiaEF.id, teacherId: teacher4.id, hoursPerWeek: 2 } }),
  ]);

  // 4to B
  const [cs4B_mat, cs4B_len, cs4B_cie, cs4B_ef] = await Promise.all([
    prisma.courseSubject.create({ data: { courseId: curso4B.id, subjectId: materia1.id,  teacherId: teacher1.id, hoursPerWeek: 4 } }),
    prisma.courseSubject.create({ data: { courseId: curso4B.id, subjectId: materia2.id,  teacherId: teacher2.id, hoursPerWeek: 4 } }),
    prisma.courseSubject.create({ data: { courseId: curso4B.id, subjectId: materia3.id,  teacherId: teacher3.id, hoursPerWeek: 3 } }),
    prisma.courseSubject.create({ data: { courseId: curso4B.id, subjectId: materiaEF.id, teacherId: teacher4.id, hoursPerWeek: 2 } }),
  ]);
  console.log('✅ 2 cursos con 4 materias cada uno\n');

  // ── Alumnos ───────────────────────────────────
  console.log('👨‍🎓 Creando alumnos...');
  const [valentina, tomas, sofia, mateo, emma, santiago] = await Promise.all([
    prisma.student.create({ data: { institutionId: institution.id, firstName: 'Valentina', lastName: 'Pérez',     documentNumber: '44111001', birthDate: new Date('2012-03-12') } as any }),
    prisma.student.create({ data: { institutionId: institution.id, firstName: 'Tomás',     lastName: 'Pérez',     documentNumber: '44111002', birthDate: new Date('2011-07-08') } as any }),
    prisma.student.create({ data: { institutionId: institution.id, firstName: 'Sofía',     lastName: 'González',  documentNumber: '44222001', birthDate: new Date('2012-11-20') } as any }),
    prisma.student.create({ data: { institutionId: institution.id, firstName: 'Mateo',     lastName: 'Fernández', documentNumber: '44333001', birthDate: new Date('2011-05-15') } as any }),
    prisma.student.create({ data: { institutionId: institution.id, firstName: 'Emma',      lastName: 'Torres',    documentNumber: '44444001', birthDate: new Date('2011-09-03') } as any }),
    prisma.student.create({ data: { institutionId: institution.id, firstName: 'Santiago',  lastName: 'Torres',    documentNumber: '44444002', birthDate: new Date('2012-01-22') } as any }),
  ]);

  // ── Matrícula ─────────────────────────────────
  // 3ro A: Valentina, Sofía, Santiago (Santiago recursa desde 4to)
  // 4to B: Tomás, Mateo, Emma
  await Promise.all([
    prisma.courseStudent.create({ data: { courseId: curso3A.id, studentId: valentina.id, status: 'ACTIVE' } }),
    prisma.courseStudent.create({ data: { courseId: curso3A.id, studentId: sofia.id,     status: 'ACTIVE' } }),
    prisma.courseStudent.create({ data: { courseId: curso3A.id, studentId: santiago.id,  status: 'ACTIVE' } }),
    prisma.courseStudent.create({ data: { courseId: curso4B.id, studentId: tomas.id,     status: 'ACTIVE' } }),
    prisma.courseStudent.create({ data: { courseId: curso4B.id, studentId: mateo.id,     status: 'ACTIVE' } }),
    prisma.courseStudent.create({ data: { courseId: curso4B.id, studentId: emma.id,      status: 'ACTIVE' } }),
  ]);

  // ── Tutores ───────────────────────────────────
  await Promise.all([
    prisma.guardian.create({ data: { userId: guardian1.id, studentId: valentina.id, relationship: 'PADRE', isPrimary: true,  canPickup: true  } }),
    prisma.guardian.create({ data: { userId: guardian1.id, studentId: tomas.id,    relationship: 'PADRE', isPrimary: true,  canPickup: true  } }),
    prisma.guardian.create({ data: { userId: guardian2.id, studentId: sofia.id,    relationship: 'MADRE', isPrimary: true,  canPickup: true  } }),
    prisma.guardian.create({ data: { userId: guardian3.id, studentId: mateo.id,    relationship: 'PADRE', isPrimary: true,  canPickup: false } }),
    prisma.guardian.create({ data: { userId: guardian4.id, studentId: emma.id,     relationship: 'MADRE', isPrimary: true,  canPickup: true  } }),
    prisma.guardian.create({ data: { userId: guardian4.id, studentId: santiago.id, relationship: 'MADRE', isPrimary: true,  canPickup: true  } }),
  ]);
  console.log('✅ 6 alumnos creados, matriculados y vinculados a tutores\n');

  // ── Asignaciones de materias recursadas/eximidas ──────────────────────────
  // Caso real: Mateo (4to B) recursa Matemáticas de 3ro A (le quedó pendiente)
  //            y tiene Ciencias de 4to eximida (el director decidió que no la curse
  //            para no superar el límite de horas)
  console.log('📋 Creando asignaciones de recursantes...');
  await Promise.all([
    // Mateo recursa Matemáticas de 3ro A con teacher1
    prisma.studentCourseSubject.create({
      data: {
        studentId:       mateo.id,
        courseSubjectId: cs3A_mat.id,
        schoolYearId:    schoolYear.id,
        type:            'RECURSE',
        createdById:     admin.id,
      },
    }),
    // Mateo está eximido de Ciencias de 4to B (decisión del director por límite de horas)
    prisma.studentCourseSubject.create({
      data: {
        studentId:       mateo.id,
        courseSubjectId: cs4B_cie.id,
        schoolYearId:    schoolYear.id,
        type:            'EXEMPT',
        createdById:     admin.id,
      },
    }),
    // Emma también recursa Lengua de 3ro A (le quedó de años anteriores)
    prisma.studentCourseSubject.create({
      data: {
        studentId:       emma.id,
        courseSubjectId: cs3A_len.id,
        schoolYearId:    schoolYear.id,
        type:            'RECURSE',
        createdById:     admin.id,
      },
    }),
  ]);
  console.log('✅ Mateo: recursa Mat 3ro A + eximido de Ciencias 4to B');
  console.log('✅ Emma: recursa Lengua 3ro A\n');

  // ── Notas ─────────────────────────────────────
  console.log('📝 Creando notas...');
  const gradeEntries = [
    // 3ro A — Valentina
    { studentId: valentina.id, csId: cs3A_mat.id, score: 9.5,  type: 'EXAM',       date: '2026-03-15' },
    { studentId: valentina.id, csId: cs3A_len.id, score: 8.0,  type: 'ASSIGNMENT', date: '2026-03-22' },
    { studentId: valentina.id, csId: cs3A_cie.id, score: 9.0,  type: 'EXAM',       date: '2026-03-16' },
    // 3ro A — Sofía
    { studentId: sofia.id,     csId: cs3A_mat.id, score: 7.0,  type: 'EXAM',       date: '2026-03-15' },
    { studentId: sofia.id,     csId: cs3A_len.id, score: 10.0, type: 'EXAM',       date: '2026-03-16' },
    { studentId: sofia.id,     csId: cs3A_cie.id, score: 8.0,  type: 'PROJECT',    date: '2026-03-19' },
    // 4to B — Tomás
    { studentId: tomas.id,     csId: cs4B_mat.id, score: 8.0,  type: 'EXAM',       date: '2026-03-15' },
    { studentId: tomas.id,     csId: cs4B_len.id, score: 9.5,  type: 'ASSIGNMENT', date: '2026-03-17' },
    { studentId: tomas.id,     csId: cs4B_cie.id, score: 7.0,  type: 'PROJECT',    date: '2026-03-19' },
    // 4to B — Mateo (recursa Mat 3ro, no tiene Ciencias 4to por EXEMPT)
    { studentId: mateo.id,     csId: cs3A_mat.id, score: 6.0,  type: 'EXAM',       date: '2026-03-15' }, // materia recursada
    { studentId: mateo.id,     csId: cs4B_mat.id, score: 5.5,  type: 'EXAM',       date: '2026-03-15' },
    { studentId: mateo.id,     csId: cs4B_len.id, score: 7.5,  type: 'EXAM',       date: '2026-03-17' },
    // 4to B — Emma (recursa Len 3ro)
    { studentId: emma.id,      csId: cs3A_len.id, score: 6.5,  type: 'EXAM',       date: '2026-03-16' }, // materia recursada
    { studentId: emma.id,      csId: cs4B_mat.id, score: 9.0,  type: 'EXAM',       date: '2026-03-15' },
    { studentId: emma.id,      csId: cs4B_len.id, score: 8.5,  type: 'EXAM',       date: '2026-03-16' },
    { studentId: emma.id,      csId: cs4B_cie.id, score: 10.0, type: 'ORAL',       date: '2026-03-18' },
    // 3ro A — Santiago
    { studentId: santiago.id,  csId: cs3A_mat.id, score: 7.5,  type: 'EXAM',       date: '2026-03-15' },
    { studentId: santiago.id,  csId: cs3A_len.id, score: 8.0,  type: 'ASSIGNMENT', date: '2026-03-17' },
    { studentId: santiago.id,  csId: cs3A_cie.id, score: 9.5,  type: 'PROJECT',    date: '2026-03-19' },
  ];

  await Promise.all(
    gradeEntries.map((g) =>
      prisma.grade.create({
        data: {
          studentId:       g.studentId,
          courseSubjectId: g.csId,
          periodId:        period1.id,
          score:           g.score,
          type:            g.type as any,
          date:            new Date(g.date),
        } as any,
      }),
    ),
  );
  console.log(`✅ ${gradeEntries.length} notas creadas\n`);

  // ── ClosingGrades ─────────────────────────────
  console.log('🔒 Creando ClosingGrades de prueba...');
  const [cg_mateo_mat, cg_mateo_len, cg_emma_mat, cg_santiago_cie, cg_valentina_mat, cg_tomas_len] = await Promise.all([
    prisma.closingGrade.create({ data: { studentId: mateo.id,     courseSubjectId: cs4B_mat.id, periodId: period1.id, closingScore: 4.5,  isClosed: true, closedAt: new Date(), closedById: admin.id } }),
    prisma.closingGrade.create({ data: { studentId: mateo.id,     courseSubjectId: cs4B_len.id, periodId: period1.id, closingScore: 8.5,  isClosed: true, closedAt: new Date(), closedById: admin.id } }),
    prisma.closingGrade.create({ data: { studentId: emma.id,      courseSubjectId: cs4B_mat.id, periodId: period1.id, closingScore: 6.0,  isClosed: true, closedAt: new Date(), closedById: admin.id } }),
    prisma.closingGrade.create({ data: { studentId: santiago.id,  courseSubjectId: cs3A_cie.id, periodId: period1.id, closingScore: 5.0,  isClosed: true, closedAt: new Date(), closedById: admin.id } }),
    prisma.closingGrade.create({ data: { studentId: valentina.id, courseSubjectId: cs3A_mat.id, periodId: period1.id, closingScore: 9.5,  isClosed: true, closedAt: new Date(), closedById: admin.id } }),
    prisma.closingGrade.create({ data: { studentId: tomas.id,     courseSubjectId: cs4B_len.id, periodId: period1.id, closingScore: 9.0,  isClosed: true, closedAt: new Date(), closedById: admin.id } }),
  ]);
  console.log(`✅ ${6} ClosingGrades de prueba creados\n`);

  // ── PendingSubject desde ClosingGrade ─────────
  console.log('📋 Creando PendingSubject desde ClosingGrade...');
  await prisma.pendingSubject.create({
    data: {
      institutionId:  institution.id,
      studentId:      mateo.id,
      subjectId:      materia1.id,
      schoolYearId:   schoolYear.id,
      closingGradeId: cg_mateo_mat.id,
      status:         'ENROLLED',
    },
  });
  console.log('✅ 1 PendingSubject vinculado a ClosingGrade (Mateo — Matemáticas 4to B, score 4.5)\n');

  // ── Asistencias ───────────────────────────────
  console.log('📋 Creando asistencias...');
  const today = new Date();
  const lastWeek = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (i + 1));
    return d;
  });

  const statuses = ['PRESENT', 'PRESENT', 'PRESENT', 'ABSENT', 'LATE'] as const;
  const rndStatus = () => statuses[Math.floor(Math.random() * statuses.length)];

  const attendanceEntries: any[] = [];
  for (const date of lastWeek) {
    // 3ro A — asistencia normal
    for (const student of [valentina, sofia, santiago]) {
      attendanceEntries.push({ studentId: student.id, courseId: curso3A.id, date, status: rndStatus(), recordedById: teacher1.id });
    }
    // 4to B — asistencia normal
    for (const student of [tomas, mateo, emma]) {
      attendanceEntries.push({ studentId: student.id, courseId: curso4B.id, date, status: rndStatus(), recordedById: teacher2.id });
    }
    // Asistencia de Ed. Física separada (la toma el docente de deportes)
    for (const student of [valentina, sofia, santiago]) {
      attendanceEntries.push({ studentId: student.id, courseId: curso3A.id, date, status: rndStatus(), recordedById: teacher4.id, sportGroupId: null });
    }
  }

  await Promise.all(
    attendanceEntries.map((a) => prisma.attendance.create({ data: a as any })),
  );
  console.log(`✅ ${attendanceEntries.length} registros de asistencia creados\n`);

  // ── Espacios físicos ──────────────────────────
  console.log('🏢 Creando espacios físicos...');
  const [gimnasio, salaReuniones, laboratorio] = await Promise.all([
    prisma.space.create({
      data: {
        institutionId: institution.id,
        name:          'Gimnasio',
        description:   'Cancha de básquet y vóley. Equipado con aros, red y colchonetas.',
        capacity:      80,
        color:         '#6366f1',
        isAvailable:   true,
      },
    }),
    prisma.space.create({
      data: {
        institutionId: institution.id,
        name:          'Sala de Reuniones',
        description:   'Sala con proyector, pizarrón y capacidad para reuniones de personal.',
        capacity:      20,
        color:         '#0ea5e9',
        isAvailable:   true,
      },
    }),
    prisma.space.create({
      data: {
        institutionId: institution.id,
        name:          'Laboratorio',
        description:   'Laboratorio de ciencias con mesadas, microscopios y reactivos básicos.',
        capacity:      30,
        color:         '#10b981',
        isAvailable:   true,
      },
    }),
  ]);
  console.log('✅ 3 espacios creados (Gimnasio, Sala de Reuniones, Laboratorio)\n');

  // ── Reservas de espacios ──────────────────────
  console.log('📅 Creando reservas de espacios...');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [tYear, tMonth, tDay] = [tomorrow.getFullYear(), tomorrow.getMonth() + 1, tomorrow.getDate()];
  const tomorrowUTC = new Date(Date.UTC(tYear, tMonth - 1, tDay, 12, 0, 0));

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const [nYear, nMonth, nDay] = [nextWeek.getFullYear(), nextWeek.getMonth() + 1, nextWeek.getDate()];
  const nextWeekUTC = new Date(Date.UTC(nYear, nMonth - 1, nDay, 12, 0, 0));

  await Promise.all([
    // Reunión de docentes mañana en Sala de Reuniones
    prisma.spaceReservation.create({
      data: {
        institutionId: institution.id,
        spaceId:       salaReuniones.id,
        userId:        admin.id,
        date:          tomorrowUTC,
        startTime:     '09:00',
        endTime:       '10:30',
        title:         'Reunión de personal docente',
        description:   '10 sillas, proyector y pizarrón',
        status:        'CONFIRMED',
      },
    }),
    // Clase de Ed. Física mañana en Gimnasio
    prisma.spaceReservation.create({
      data: {
        institutionId: institution.id,
        spaceId:       gimnasio.id,
        userId:        teacher4.id,
        date:          tomorrowUTC,
        startTime:     '10:00',
        endTime:       '11:30',
        title:         'Clase Ed. Física 3ro A',
        description:   'Colchonetas y aros de básquet',
        status:        'CONFIRMED',
      },
    }),
    // Práctica de laboratorio la semana que viene — pendiente de confirmación
    prisma.spaceReservation.create({
      data: {
        institutionId: institution.id,
        spaceId:       laboratorio.id,
        userId:        teacher3.id,
        date:          nextWeekUTC,
        startTime:     '08:00',
        endTime:       '09:30',
        title:         'Práctica de Ciencias 4to B',
        description:   'Necesito microscopios y reactivos para experimento de células',
        status:        'PENDING',
      },
    }),
  ]);
  console.log('✅ 3 reservas creadas (2 confirmadas, 1 pendiente)\n');

  // ── Deportes y grupos ─────────────────────────
  console.log('⚽ Creando deportes y grupos...');
  const [futbol, voley] = await Promise.all([
    prisma.sport.create({ data: { institutionId: institution.id, name: 'Fútbol' } }),
    prisma.sport.create({ data: { institutionId: institution.id, name: 'Vóley' } }),
  ]);

  // Grupo Fútbol A — mezcla 3ro y 4to
  const grupoFutbolA = await prisma.sportGroup.create({
    data: {
      institutionId: institution.id,
      sportId:       futbol.id,
      schoolYearId:  schoolYear.id,
      name:          'Fútbol A',
    },
  });

  // Grupo Vóley — mezcla 3ro y 4to
  const grupoVoley = await prisma.sportGroup.create({
    data: {
      institutionId: institution.id,
      sportId:       voley.id,
      schoolYearId:  schoolYear.id,
      name:          'Vóley 3ro/4to',
    },
  });

  // Asignar docentes a grupos
  await Promise.all([
    prisma.sportGroupTeacher.create({ data: { sportGroupId: grupoFutbolA.id, userId: teacher4.id } }),
    prisma.sportGroupTeacher.create({ data: { sportGroupId: grupoVoley.id,   userId: teacher4.id } }),
  ]);

  // Asignar alumnos a grupos
  await Promise.all([
    // Fútbol A: Tomás, Mateo, Santiago
    prisma.sportGroupStudent.create({ data: { sportGroupId: grupoFutbolA.id, studentId: tomas.id    } }),
    prisma.sportGroupStudent.create({ data: { sportGroupId: grupoFutbolA.id, studentId: mateo.id    } }),
    prisma.sportGroupStudent.create({ data: { sportGroupId: grupoFutbolA.id, studentId: santiago.id } }),
    // Vóley: Valentina, Sofía, Emma
    prisma.sportGroupStudent.create({ data: { sportGroupId: grupoVoley.id,   studentId: valentina.id } }),
    prisma.sportGroupStudent.create({ data: { sportGroupId: grupoVoley.id,   studentId: sofia.id     } }),
    prisma.sportGroupStudent.create({ data: { sportGroupId: grupoVoley.id,   studentId: emma.id      } }),
  ]);
  console.log('✅ 2 deportes creados (Fútbol, Vóley)');
  console.log('✅ Fútbol A: Tomás, Mateo, Santiago — Vóley: Valentina, Sofía, Emma\n');

  // ── Asistencia de deportes ────────────────────
  console.log('📋 Creando asistencias de deportes...');
  const sportAttendanceEntries: any[] = [];
  for (const date of lastWeek.slice(0, 3)) {
    for (const student of [tomas, mateo, santiago]) {
      sportAttendanceEntries.push({
        studentId:    student.id,
        courseId:     curso4B.id,
        sportGroupId: grupoFutbolA.id,
        date,
        status:       rndStatus(),
        recordedById: teacher4.id,
      });
    }
    for (const student of [valentina, sofia, emma]) {
      sportAttendanceEntries.push({
        studentId:    student.id,
        courseId:     curso3A.id,
        sportGroupId: grupoVoley.id,
        date,
        status:       rndStatus(),
        recordedById: teacher4.id,
      });
    }
  }
  await Promise.all(
    sportAttendanceEntries.map((a) => prisma.attendance.create({ data: a as any })),
  );
  console.log(`✅ ${sportAttendanceEntries.length} registros de asistencia deportiva\n`);

  // ── Comunicados ───────────────────────────────
  console.log('📢 Creando comunicados...');
  await Promise.all([
    prisma.announcement.create({
      data: {
        institutionId: institution.id,
        authorId:      admin.id,
        title:         'Inicio del año lectivo 2026',
        content:       'Estimadas familias, les damos la bienvenida al ciclo lectivo 2026. Las clases comienzan el 2 de marzo.',
        scope:         'INSTITUTION',
        publishedAt:   new Date('2026-02-25'),
      } as any,
    }),
    prisma.announcement.create({
      data: {
        institutionId: institution.id,
        authorId:      teacher1.id,
        courseId:      curso3A.id,
        title:         'Evaluación de Matemáticas — Semana del 23/3',
        content:       'La próxima semana se tomará la primera evaluación de Matemáticas. Temas: números naturales, operaciones y resolución de problemas.',
        scope:         'COURSE',
        publishedAt:   new Date('2026-03-18'),
      } as any,
    }),
    prisma.announcement.create({
      data: {
        institutionId: institution.id,
        authorId:      teacher4.id,
        title:         'Inicio de actividades deportivas',
        content:       'Esta semana comienzan los grupos de deportes. Fútbol: martes y jueves. Vóley: lunes y miércoles. Recordá traer ropa deportiva.',
        scope:         'INSTITUTION',
        publishedAt:   new Date('2026-03-10'),
      } as any,
    }),
  ]);
  console.log('✅ 3 comunicados creados\n');

  // ── Resumen final ─────────────────────────────
  console.log('═══════════════════════════════════════════════════');
  console.log('🎉 Seed completado exitosamente!\n');
  console.log('📋 Credenciales de acceso:\n');
  console.log('  ADMIN:');
  console.log('    admin@sanmartin.edu.ar / Admin123!\n');
  console.log('  PRECEPTOR:');
  console.log('    preceptor@sanmartin.edu.ar / Preceptor123!\n');
  console.log('  DOCENTES (password: Docente123!):');
  console.log('    maria.garcia@sanmartin.edu.ar   → Matemáticas (3ro A y 4to B)');
  console.log('    juan.lopez@sanmartin.edu.ar     → Lengua (3ro A y 4to B)');
  console.log('    ana.martinez@sanmartin.edu.ar   → Ciencias (3ro A y 4to B)');
  console.log('    pedro.silva@sanmartin.edu.ar    → Ed. Física + Deportes\n');
  console.log('  TUTORES (password: Padre123!):');
  console.log('    roberto.perez@gmail.com   → Valentina (3ro A) y Tomás (4to B)');
  console.log('    laura.gonzalez@gmail.com  → Sofía (3ro A)');
  console.log('    pablo.fernandez@gmail.com → Mateo (4to B) ← recursante');
  console.log('    claudia.torres@gmail.com  → Emma (4to B) + Santiago (3ro A)\n');
  console.log('  CASOS DE PRUEBA:');
  console.log('    Mateo Fernández  → recursa Mat 3ro A + eximido de Ciencias 4to B');
  console.log('    Emma Torres      → recursa Lengua 3ro A');
  console.log('    ClosingGrades    → 6 creados, scores < 7 y >= 7');
  console.log('    Intensificación  → Mateo tiene Matemáticas 4.5 como PendingSubject');
  console.log('    Fútbol A         → Tomás, Mateo, Santiago (docente: Pedro Silva)');
  console.log('    Vóley 3ro/4to   → Valentina, Sofía, Emma (docente: Pedro Silva)');
  console.log('    Reservas         → Sala Reuniones y Gimnasio (mañana), Lab (próx. semana)');
  console.log('═══════════════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());