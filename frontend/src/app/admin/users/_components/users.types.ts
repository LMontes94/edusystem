import { z } from 'zod';

export interface User {
  id:             string;
  firstName:      string;
  lastName:       string;
  email:          string;
  role:           string;
  status:         string;
  phone?:         string | null;
  avatarUrl?:     string | null;
  lastLoginAt?:   string | null;
  leaveStartDate?: string | null;
  levelRoles?:    { id: string; level: string; role: string }[];
}

export const roleLabels: Record<string, string> = {
  ADMIN:     'Administrador',
  DIRECTOR:  'Director',
  SECRETARY: 'Secretaria',
  TEACHER:   'Docente',
  PRECEPTOR: 'Preceptor',
  GUARDIAN:  'Tutor',
};

export const roleVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  ADMIN:     'default',
  DIRECTOR:  'default',
  SECRETARY: 'secondary',
  TEACHER:   'secondary',
  PRECEPTOR: 'secondary',
  GUARDIAN:  'outline',
};

export const LEAVE_ALLOWED_ROLES = ['ADMIN', 'DIRECTOR', 'SECRETARY'];

export const createUserSchema = z.object({
  firstName: z.string().min(1, 'Requerido'),
  lastName:  z.string().min(1, 'Requerido'),
  email:     z.string().email('Email inválido'),
  password:  z.string().min(8, 'Mínimo 8 caracteres'),
  role:      z.enum(['ADMIN', 'DIRECTOR', 'SECRETARY', 'TEACHER', 'PRECEPTOR', 'GUARDIAN']),
  phone:     z.string().optional(),
});
export type CreateUserForm = z.infer<typeof createUserSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  confirm:  z.string().min(8, 'Requerido'),
}).refine((d) => d.password === d.confirm, {
  message: 'Las contraseñas no coinciden',
  path:    ['confirm'],
});
export type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;