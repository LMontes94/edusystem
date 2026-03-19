import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// ──────────────────────────────────────────────
// @InstitutionId() — extrae el institutionId del request.
// Lo inyecta el TenantMiddleware a partir del JWT.
//
// REGLA DE ORO: siempre usar este decorator para
// obtener el tenant. Nunca leer institutionId del
// body o query params del cliente.
//
// Uso:
//   findAll(@InstitutionId() institutionId: string) { ... }
// ──────────────────────────────────────────────

export const InstitutionId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request['institutionId'];
  },
);
