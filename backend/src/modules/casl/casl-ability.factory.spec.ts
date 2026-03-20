import { Test, TestingModule } from '@nestjs/testing';
import { AbilityFactory } from './casl-ability.factory';
import { Action } from './casl.types';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../../common/decorators/current-user.decorator';

// ──────────────────────────────────────────────
// Tests unitarios de permisos ABAC.
// Verifican que cada rol puede y NO puede hacer
// exactamente lo que se espera.
//
// Correr con: npm run test -- casl
// ──────────────────────────────────────────────

const mockPrisma = {} as PrismaService;

const makeUser = (overrides: Partial<RequestUser>): RequestUser => ({
  id: 'user-1',
  email: 'test@test.com',
  institutionId: 'inst-1',
  role: 'ADMIN',
  ...overrides,
});

describe('AbilityFactory', () => {
  let factory: AbilityFactory;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AbilityFactory,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    factory = module.get<AbilityFactory>(AbilityFactory);
  });

  // ── SUPER_ADMIN ───────────────────────────────
  describe('SUPER_ADMIN', () => {
    it('puede hacer todo', async () => {
      const user = makeUser({ role: 'SUPER_ADMIN', institutionId: null });
      const ability = await factory.createForUser(user);

      expect(ability.can(Action.Manage, 'all')).toBe(true);
      expect(ability.can(Action.Create, 'Institution')).toBe(true);
      expect(ability.can(Action.Delete, 'User')).toBe(true);
      expect(ability.can(Action.Export, 'Grade')).toBe(true);
    });
  });

  // ── ADMIN ─────────────────────────────────────
  describe('ADMIN', () => {
    it('puede gestionar entidades de su institución', async () => {
      const user = makeUser({ role: 'ADMIN', institutionId: 'inst-1' });
      const ability = await factory.createForUser(user);

      expect(ability.can(Action.Create, 'Student')).toBe(true);
      expect(ability.can(Action.Update, 'Course')).toBe(true);
      expect(ability.can(Action.Delete, 'User')).toBe(true);
      expect(ability.can(Action.Read, 'Grade')).toBe(true);
    });
  });

  // ── TEACHER ───────────────────────────────────
  describe('TEACHER', () => {
    it('puede leer entidades de su institución', async () => {
      const user = makeUser({ role: 'TEACHER', institutionId: 'inst-1' });
      const ability = await factory.createForUser(user);

      expect(ability.can(Action.Read, 'Student')).toBe(true);
      expect(ability.can(Action.Read, 'Course')).toBe(true);
      expect(ability.can(Action.Read, 'Grade')).toBe(true);
    });

    it('puede crear y editar notas', async () => {
      const user = makeUser({ role: 'TEACHER', institutionId: 'inst-1' });
      const ability = await factory.createForUser(user);

      expect(ability.can(Action.Create, 'Grade')).toBe(true);
      expect(ability.can(Action.Update, 'Grade')).toBe(true);
      expect(ability.can(Action.Delete, 'Grade')).toBe(true);
    });

    it('puede registrar asistencia', async () => {
      const user = makeUser({ role: 'TEACHER', institutionId: 'inst-1' });
      const ability = await factory.createForUser(user);

      expect(ability.can(Action.Create, 'Attendance')).toBe(true);
      expect(ability.can(Action.Update, 'Attendance')).toBe(true);
    });

    it('NO puede modificar usuarios ni alumnos', async () => {
      const user = makeUser({ role: 'TEACHER', institutionId: 'inst-1' });
      const ability = await factory.createForUser(user);

      expect(ability.can(Action.Create, 'User')).toBe(false);
      expect(ability.can(Action.Update, 'User')).toBe(false);
      expect(ability.can(Action.Delete, 'User')).toBe(false);
      expect(ability.can(Action.Create, 'Student')).toBe(false);
      expect(ability.can(Action.Delete, 'Student')).toBe(false);
    });

    it('NO puede gestionar instituciones', async () => {
      const user = makeUser({ role: 'TEACHER', institutionId: 'inst-1' });
      const ability = await factory.createForUser(user);

      expect(ability.can(Action.Manage, 'Institution')).toBe(false);
      expect(ability.can(Action.Update, 'Institution')).toBe(false);
    });
  });

  // ── GUARDIAN ──────────────────────────────────
  describe('GUARDIAN', () => {
    it('puede leer entidades de su institución', async () => {
      const user = makeUser({ role: 'GUARDIAN', institutionId: 'inst-1' });
      const ability = await factory.createForUser(user);

      expect(ability.can(Action.Read, 'Grade')).toBe(true);
      expect(ability.can(Action.Read, 'Attendance')).toBe(true);
      expect(ability.can(Action.Read, 'Announcement')).toBe(true);
    });

    it('NO puede crear, editar ni eliminar nada', async () => {
      const user = makeUser({ role: 'GUARDIAN', institutionId: 'inst-1' });
      const ability = await factory.createForUser(user);

      expect(ability.can(Action.Create, 'Grade')).toBe(false);
      expect(ability.can(Action.Update, 'Grade')).toBe(false);
      expect(ability.can(Action.Delete, 'Grade')).toBe(false);
      expect(ability.can(Action.Create, 'Announcement')).toBe(false);
      expect(ability.can(Action.Update, 'Student')).toBe(false);
    });
  });
});
