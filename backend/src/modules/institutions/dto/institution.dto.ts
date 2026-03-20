import { z } from 'zod';

// ── Crear institución ─────────────────────────
export const CreateInstitutionSchema = z.object({
  name: z.string().min(3).max(200),
  domain: z.string().max(100).optional(),
  address: z.string().max(300).optional(),
  phone: z.string().max(20).optional(),
  // Datos del primer ADMIN de la institución
  adminEmail: z.string().email(),
  adminPassword: z.string().min(8, {
    message: 'La contraseña debe tener al menos 8 caracteres',
  }),
  adminFirstName: z.string().min(1).max(100),
  adminLastName: z.string().min(1).max(100),
});

export type CreateInstitutionDto = z.infer<typeof CreateInstitutionSchema>;

// ── Actualizar institución ────────────────────
export const UpdateInstitutionSchema = z.object({
  name: z.string().min(3).max(200).optional(),
  domain: z.string().max(100).optional(),
  address: z.string().max(300).optional(),
  phone: z.string().max(20).optional(),
  settings: z.record(z.unknown()).optional(),
});

export type UpdateInstitutionDto = z.infer<typeof UpdateInstitutionSchema>;

// ── Invitar usuario ───────────────────────────
export const InviteUserSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'TEACHER', 'GUARDIAN']),
});

export type InviteUserDto = z.infer<typeof InviteUserSchema>;
