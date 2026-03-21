// prisma/seed.ts
// ──────────────────────────────────────────────
// Seed completo de EduSystem
//
// Crea:
//   • 1 institución (Colegio San Martín)
//   • 1 ADMIN, 3 TEACHER, 4 GUARDIAN
//   • 6 alumnos con sus tutores vinculados
//   • 1 año lectivo 2026 con 3 períodos
//   • 3 materias (Matemáticas, Lengua, Ciencias)
//   • 2 cursos (3ro A y 4to B)
//   • Asignación de docentes a materias
//   • Matrícula de alumnos en cursos
//   • Notas de ejemplo para cada alumno
//   • Asistencias de la última semana
//   • 2 comunicados
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
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.pushToken.deleteMany();
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
  await prisma.invitation.deleteMany();
  await prisma.user.deleteMany();
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

  // ── Contraseñas ──────────────────────────────
  const adminPass   = await bcrypt.hash('Admin123!',   12);
  const teacherPass = await bcrypt.hash('Docente123!', 12);
  const guardianPass = await bcrypt.hash('Padre123!',  12);

  // ── ADMIN ────────────────────────────────────
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

  // ── TEACHERS ─────────────────────────────────
  const [teacher1, teacher2, teacher3] = await Promise.all([
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
  ]);

  // ── GUARDIANS ────────────────────────────────
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
  console.log(`✅ 8 usuarios creados (1 admin, 3 docentes, 4 tutores)\n`);

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
  console.log(`✅ Año lectivo 2026 con 3 trimestres\n`);

  // ── Materias ─────────────────────────────────
  console.log('📚 Creando materias...');
  const [materia1, materia2, materia3] = await Promise.all([
    prisma.subject.create({
      data: {
        institutionId: institution.id,
        name:          'Matemáticas',
        code:          'MAT',
        color:         '#3B82F6',
      },
    }),
    prisma.subject.create({
      data: {
        institutionId: institution.id,
        name:          'Lengua y Literatura',
        code:          'LEN',
        color:         '#10B981',
      },
    }),
    prisma.subject.create({
      data: {
        institutionId: institution.id,
        name:          'Ciencias Naturales',
        code:          'CNA',
        color:         '#F59E0B',
      },
    }),
  ]);
  console.log(`✅ 3 materias creadas\n`);

  // ── Cursos ───────────────────────────────────
  console.log('🏫 Creando cursos...');
  const [curso3A, curso4B] = await Promise.all([
    prisma.course.create({
      data: {
        institutionId: institution.id,
        schoolYearId:  schoolYear.id,
        name:          '3ro A',
        grade:         3,
        division:      'A',
        level:         'PRIMARIA',
      } as any,
    }),
    prisma.course.create({
      data: {
        institutionId: institution.id,
        schoolYearId:  schoolYear.id,
        name:          '4to B',
        grade:         4,
        division:      'B',
        level:         'PRIMARIA',
      } as any,
    }),
  ]);

  // ── Asignar docentes a materias ──────────────
  const [cs1, cs2, cs3, cs4, cs5, cs6] = await Promise.all([
    // 3ro A
    prisma.courseSubject.create({
      data: { courseId: curso3A.id, subjectId: materia1.id, teacherId: teacher1.id, hoursPerWeek: 5 },
    }),
    prisma.courseSubject.create({
      data: { courseId: curso3A.id, subjectId: materia2.id, teacherId: teacher2.id, hoursPerWeek: 4 },
    }),
    prisma.courseSubject.create({
      data: { courseId: curso3A.id, subjectId: materia3.id, teacherId: teacher3.id, hoursPerWeek: 3 },
    }),
    // 4to B
    prisma.courseSubject.create({
      data: { courseId: curso4B.id, subjectId: materia1.id, teacherId: teacher1.id, hoursPerWeek: 5 },
    }),
    prisma.courseSubject.create({
      data: { courseId: curso4B.id, subjectId: materia2.id, teacherId: teacher2.id, hoursPerWeek: 4 },
    }),
    prisma.courseSubject.create({
      data: { courseId: curso4B.id, subjectId: materia3.id, teacherId: teacher3.id, hoursPerWeek: 3 },
    }),
  ]);
  console.log(`✅ 2 cursos con docentes asignados\n`);

  // ── Alumnos ───────────────────────────────────
  console.log('👨‍🎓 Creando alumnos...');
  const studentsData = [
    { firstName: 'Valentina', lastName: 'Pérez',      doc: '44111001', birth: '2015-03-12' },
    { firstName: 'Tomás',     lastName: 'Pérez',      doc: '44111002', birth: '2016-07-08' },
    { firstName: 'Sofía',     lastName: 'González',   doc: '44222001', birth: '2015-11-20' },
    { firstName: 'Mateo',     lastName: 'Fernández',  doc: '44333001', birth: '2014-05-15' },
    { firstName: 'Emma',      lastName: 'Torres',     doc: '44444001', birth: '2015-09-03' },
    { firstName: 'Santiago',  lastName: 'Torres',     doc: '44444002', birth: '2016-01-22' },
  ];

  const students = await Promise.all(
    studentsData.map((s) =>
      prisma.student.create({
        data: {
          institutionId:  institution.id,
          firstName:      s.firstName,
          lastName:       s.lastName,
          documentNumber: s.doc,
          birthDate:      new Date(s.birth),
        } as any,
      }),
    ),
  );

  const [valentina, tomas, sofia, mateo, emma, santiago] = students;

  // ── Matrícula ─────────────────────────────────
  await Promise.all([
    // 3ro A: Valentina, Sofía, Mateo
    prisma.courseStudent.create({ data: { courseId: curso3A.id, studentId: valentina.id, status: 'ACTIVE' } }),
    prisma.courseStudent.create({ data: { courseId: curso3A.id, studentId: sofia.id,     status: 'ACTIVE' } }),
    prisma.courseStudent.create({ data: { courseId: curso3A.id, studentId: mateo.id,     status: 'ACTIVE' } }),
    // 4to B: Tomás, Emma, Santiago
    prisma.courseStudent.create({ data: { courseId: curso4B.id, studentId: tomas.id,    status: 'ACTIVE' } }),
    prisma.courseStudent.create({ data: { courseId: curso4B.id, studentId: emma.id,     status: 'ACTIVE' } }),
    prisma.courseStudent.create({ data: { courseId: curso4B.id, studentId: santiago.id, status: 'ACTIVE' } }),
  ]);

  // ── Vincular tutores ──────────────────────────
  await Promise.all([
    // Roberto Pérez → Valentina y Tomás (sus hijos)
    prisma.guardian.create({ data: { userId: guardian1.id, studentId: valentina.id, relationship: 'PADRE', isPrimary: true,  canPickup: true  } }),
    prisma.guardian.create({ data: { userId: guardian1.id, studentId: tomas.id,    relationship: 'PADRE', isPrimary: true,  canPickup: true  } }),
    // Laura González → Sofía
    prisma.guardian.create({ data: { userId: guardian2.id, studentId: sofia.id,    relationship: 'MADRE', isPrimary: true,  canPickup: true  } }),
    // Pablo Fernández → Mateo
    prisma.guardian.create({ data: { userId: guardian3.id, studentId: mateo.id,    relationship: 'PADRE', isPrimary: true,  canPickup: false } }),
    // Claudia Torres → Emma y Santiago (sus hijos)
    prisma.guardian.create({ data: { userId: guardian4.id, studentId: emma.id,     relationship: 'MADRE', isPrimary: true,  canPickup: true  } }),
    prisma.guardian.create({ data: { userId: guardian4.id, studentId: santiago.id, relationship: 'MADRE', isPrimary: true,  canPickup: true  } }),
  ]);
  console.log(`✅ 6 alumnos creados, matriculados y vinculados a tutores\n`);

  // ── Notas ─────────────────────────────────────
  console.log('📝 Creando notas...');

  const gradeEntries = [
    // 3ro A — Valentina
    { studentId: valentina.id, csId: cs1.id, score: 9.5,  type: 'EXAM',       date: '2026-03-15' },
    { studentId: valentina.id, csId: cs1.id, score: 8.0,  type: 'ASSIGNMENT', date: '2026-03-22' },
    { studentId: valentina.id, csId: cs2.id, score: 9.0,  type: 'EXAM',       date: '2026-03-16' },
    { studentId: valentina.id, csId: cs3.id, score: 7.5,  type: 'ORAL',       date: '2026-03-18' },
    // 3ro A — Sofía
    { studentId: sofia.id,     csId: cs1.id, score: 7.0,  type: 'EXAM',       date: '2026-03-15' },
    { studentId: sofia.id,     csId: cs1.id, score: 8.5,  type: 'ASSIGNMENT', date: '2026-03-22' },
    { studentId: sofia.id,     csId: cs2.id, score: 10.0, type: 'EXAM',       date: '2026-03-16' },
    { studentId: sofia.id,     csId: cs3.id, score: 8.0,  type: 'PROJECT',    date: '2026-03-19' },
    // 3ro A — Mateo
    { studentId: mateo.id,     csId: cs1.id, score: 6.0,  type: 'EXAM',       date: '2026-03-15' },
    { studentId: mateo.id,     csId: cs2.id, score: 7.5,  type: 'EXAM',       date: '2026-03-16' },
    { studentId: mateo.id,     csId: cs3.id, score: 9.0,  type: 'ORAL',       date: '2026-03-18' },
    // 4to B — Tomás
    { studentId: tomas.id,     csId: cs4.id, score: 8.0,  type: 'EXAM',       date: '2026-03-15' },
    { studentId: tomas.id,     csId: cs5.id, score: 9.5,  type: 'ASSIGNMENT', date: '2026-03-17' },
    { studentId: tomas.id,     csId: cs6.id, score: 7.0,  type: 'PROJECT',    date: '2026-03-19' },
    // 4to B — Emma
    { studentId: emma.id,      csId: cs4.id, score: 9.0,  type: 'EXAM',       date: '2026-03-15' },
    { studentId: emma.id,      csId: cs5.id, score: 8.5,  type: 'EXAM',       date: '2026-03-16' },
    { studentId: emma.id,      csId: cs6.id, score: 10.0, type: 'ORAL',       date: '2026-03-18' },
    // 4to B — Santiago
    { studentId: santiago.id,  csId: cs4.id, score: 5.5,  type: 'EXAM',       date: '2026-03-15' },
    { studentId: santiago.id,  csId: cs5.id, score: 7.0,  type: 'ASSIGNMENT', date: '2026-03-17' },
    { studentId: santiago.id,  csId: cs6.id, score: 6.5,  type: 'PROJECT',    date: '2026-03-19' },
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

  // ── Asistencias ───────────────────────────────
  console.log('📋 Creando asistencias...');
  const today = new Date();
  const lastWeek = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (i + 1));
    return d;
  });

  const attendanceStatuses = ['PRESENT', 'PRESENT', 'PRESENT', 'ABSENT', 'LATE'] as const;

  const attendanceEntries: any[] = [];
  for (const date of lastWeek) {
    for (const student of [valentina, sofia, mateo]) {
      attendanceEntries.push({
  studentId:    student.id,
  courseId:     curso3A.id,
  date,
  status:       attendanceStatuses[Math.floor(Math.random() * attendanceStatuses.length)],
  recordedById: teacher1.id,
});
    }
    for (const student of [tomas, emma, santiago]) {
       attendanceEntries.push({
      studentId:    student.id,
      courseId:     curso4B.id,
      date,
      status:       attendanceStatuses[Math.floor(Math.random() * attendanceStatuses.length)],
      recordedById: teacher2.id,
    });
    }
  }

  await Promise.all(
    attendanceEntries.map((a) => prisma.attendance.create({ data: a as any })),
  );
  console.log(`✅ ${attendanceEntries.length} registros de asistencia creados\n`);

  // ── Comunicados ───────────────────────────────
  console.log('📢 Creando comunicados...');
  await Promise.all([
    prisma.announcement.create({
      data: {
        institutionId: institution.id,
        authorId:      admin.id,
        title:         'Inicio del año lectivo 2026',
        content:       'Estimadas familias, les damos la bienvenida al ciclo lectivo 2026. Las clases comienzan el 2 de marzo. Rogamos puntualidad.',
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
        content:       'Les informamos que la próxima semana se tomará la primera evaluación de Matemáticas. Los temas son: números naturales, operaciones básicas y resolución de problemas.',
        scope:         'COURSE',
        publishedAt:   new Date('2026-03-18'),
      } as any,
    }),
  ]);
  console.log(`✅ 2 comunicados creados\n`);

  // ── Resumen final ─────────────────────────────
  console.log('═══════════════════════════════════════');
  console.log('🎉 Seed completado exitosamente!\n');
  console.log('📋 Credenciales de acceso:');
  console.log('');
  console.log('  ADMIN:');
  console.log('    email:    admin@sanmartin.edu.ar');
  console.log('    password: Admin123!');
  console.log('');
  console.log('  DOCENTES:');
  console.log('    email:    maria.garcia@sanmartin.edu.ar   (Matemáticas)');
  console.log('    email:    juan.lopez@sanmartin.edu.ar     (Lengua)');
  console.log('    email:    ana.martinez@sanmartin.edu.ar   (Ciencias)');
  console.log('    password: Docente123!');
  console.log('');
  console.log('  TUTORES:');
  console.log('    email:    roberto.perez@gmail.com   → Valentina y Tomás');
  console.log('    email:    laura.gonzalez@gmail.com  → Sofía');
  console.log('    email:    pablo.fernandez@gmail.com → Mateo');
  console.log('    email:    claudia.torres@gmail.com  → Emma y Santiago');
  console.log('    password: Padre123!');
  console.log('═══════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
