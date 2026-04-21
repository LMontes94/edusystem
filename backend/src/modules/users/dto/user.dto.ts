import { z } from 'zod';

export const CreateUserSchema = z.object({
  email:     z.string().email(),
  password:  z.string().min(8),
  firstName: z.string().min(1).max(100),
  lastName:  z.string().min(1).max(100),
  role:      z.enum(['ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER', 'PRECEPTOR', 'GUARDIAN']),
  phone:     z.string().max(20).optional(),
});
export type CreateUserDto = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName:  z.string().min(1).max(100).optional(),
  phone:     z.string().max(20).optional(),
  status:    z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'ON_LEAVE']).optional(),
});
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(8),
});
export type ChangePasswordDto = z.infer<typeof ChangePasswordSchema>;

export const LeaveSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato esperado: YYYY-MM-DD'),
});
export type LeaveDto = z.infer<typeof LeaveSchema>;

// ── Rol por nivel ─────────────────────────────
export const LevelRoleSchema = z.object({
  level: z.enum(['INICIAL', 'PRIMARIA', 'SECUNDARIA']),
  role:  z.enum(['ADMIN', 'DIRECTOR', 'SECRETARY', 'PRECEPTOR', 'TEACHER', 'GUARDIAN']),
});
export type LevelRoleDto = z.infer<typeof LevelRoleSchema>;