import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { EnvConfig } from '../../config/env.schema';

// ──────────────────────────────────────────────
// TenantMiddleware — el componente más crítico
// del sistema multi-tenant.
//
// Lee el JWT del header Authorization, lo decodifica
// (SIN verificar firma — eso lo hace el JwtAuthGuard)
// y extrae institutionId, userId y role para
// inyectarlos en req.
//
// De esta forma todos los controllers y servicios
// tienen acceso al tenant sin queries adicionales.
//
// ⚠️  IMPORTANTE:
//   Este middleware SOLO decodifica, no verifica.
//   La verificación real ocurre en JwtAuthGuard (fase 2).
//   Un token inválido simplemente deja req.institutionId
//   como null — el guard lo rechazará luego.
// ──────────────────────────────────────────────

interface JwtPayload {
  sub: string;
  institutionId: string | null;
  role: string;
  email: string;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvConfig>,
  ) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);

      try {
        // decode() NO verifica la firma — solo decodifica
        const payload = this.jwtService.decode<JwtPayload>(token);

        if (payload) {
          req['institutionId'] = payload.institutionId ?? null;
          req['userId'] = payload.sub;
          req['userRole'] = payload.role;
          req['userEmail'] = payload.email;
        }
      } catch {
        // Token malformado: dejamos los campos como null
        // El JwtAuthGuard rechazará el request si la ruta no es @Public()
        this.logger.debug('Token malformado en TenantMiddleware — ignorado');
      }
    }

    next();
  }
}
