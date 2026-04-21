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
// El admin puede editar datos básicos y settings (colores, umbrales).
// Plan y status solo los edita el SUPER_ADMIN — se validan en el service.
export const UpdateInstitutionSchema = z.object({
  name:     z.string().min(1).max(200).optional(),
  domain:   z.string().max(100).optional(),
  address:  z.string().max(300).optional(),
  phone:    z.string().max(20).optional(),
  logoUrl:  z.string().url().optional().or(z.literal('')),
 
  // Solo SUPER_ADMIN
  plan:     z.enum(['FREE', 'STARTER', 'PRO', 'ENTERPRISE']).optional(),
  status:   z.enum(['ACTIVE', 'SUSPENDED', 'TRIAL']).optional(),
  trialEndsAt: z.string().datetime().optional(),
 
  // Settings JSON — colores PDF, umbrales actas, distrito
  settings: z.object({
    report: z.object({
      primaryColor:   z.string().optional(),
      secondaryColor: z.string().optional(),
      textColor:      z.string().optional(),
      logoPosition:   z.enum(['center', 'left', 'none']).optional(),
      layout:         z.enum(['classic', 'institutional', 'modern']).optional(),
    }).optional(),
    absenceThresholds: z.array(z.number().int().positive()).optional(),
    district:          z.string().max(100).optional(),
  }).optional(),
});
export type UpdateInstitutionDto = z.infer<typeof UpdateInstitutionSchema>;
 

// ── Invitar usuario ───────────────────────────
export const InviteUserSchema = z.object({
  email: z.string().email(),
  role:  z.enum(['ADMIN', 'DIRECTOR', 'SECRETARY', 'PRECEPTOR', 'TEACHER', 'GUARDIAN']),
});
export type InviteUserDto = z.infer<typeof InviteUserSchema>;

// ── Actualizar plan/status (solo SUPER_ADMIN) ─
export const UpdatePlanSchema = z.object({
  plan:        z.enum(['FREE', 'STARTER', 'PRO', 'ENTERPRISE']),
  status:      z.enum(['ACTIVE', 'SUSPENDED', 'TRIAL']).optional(),
  trialEndsAt: z.string().datetime().optional(),
});
export type UpdatePlanDto = z.infer<typeof UpdatePlanSchema>;
