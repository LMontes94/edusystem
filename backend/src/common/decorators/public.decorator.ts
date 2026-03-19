import { SetMetadata } from '@nestjs/common';

// ──────────────────────────────────────────────
// @Public() — marca un endpoint como público.
// El JwtAuthGuard (fase 2) revisa este metadata
// antes de verificar el token. Si está presente,
// deja pasar el request sin autenticación.
//
// Uso:
//   @Get('health')
//   @Public()
//   check() { ... }
// ──────────────────────────────────────────────

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
