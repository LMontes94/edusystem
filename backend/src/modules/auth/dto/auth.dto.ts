import { z } from 'zod';

// ── Login ─────────────────────────────────────
export const LoginSchema = z.object({
  email: z.string().email({ message: 'Email inválido' }),
  password: z.string().min(1, { message: 'La contraseña es requerida' }),
});

export type LoginDto = z.infer<typeof LoginSchema>;

// ── Refresh Token ─────────────────────────────
export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, { message: 'El refresh token es requerido' }),
});

export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>;

// ── Respuesta de Auth ─────────────────────────
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    institutionId: string | null;
  };
}
