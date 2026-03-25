import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// ──────────────────────────────────────────────
// @CurrentUser() — extrae el usuario del request.
// El JwtAuthGuard (fase 2) lo inyecta en req.user
// después de verificar el token JWT.
//
// Uso:
//   findAll(@CurrentUser() user: RequestUser) { ... }
// ──────────────────────────────────────────────

export interface RequestUser {
  id: string;
  institutionId: string | null; // null solo para SUPER_ADMIN
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'DIRECTOR' | 'SECRETARY' | 'PRECEPTOR' | 'TEACHER' | 'GUARDIAN';
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
