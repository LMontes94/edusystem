// src/common/guards/on-leave.guard.ts
import {
  CanActivate, ExecutionContext, Injectable, ForbiddenException,
} from '@nestjs/common';
import { Reflector }     from '@nestjs/core';
import { JwtService }    from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SetMetadata }   from '@nestjs/common';
import { EnvConfig }     from '../../config/env.schema';

const MUTATING_METHODS            = ['POST', 'PUT', 'PATCH', 'DELETE'];
export const SKIP_LEAVE_CHECK_KEY = 'skipLeaveCheck';
export const SkipLeaveCheck       = () => SetMetadata(SKIP_LEAVE_CHECK_KEY, true);

const EXEMPT_PATHS = [
  /\/auth\/login$/,
  /\/auth\/logout$/,
  /\/auth\/refresh$/,
  /\/users\/[^/]+\/password$/,
  /\/users\/[^/]+\/leave$/,
  /\/users\/[^/]+\/restore$/,
];

@Injectable()
export class OnLeaveGuard implements CanActivate {
  constructor(
    private readonly prisma:    PrismaService,
    private readonly jwt:       JwtService,
    private readonly config:    ConfigService<EnvConfig>,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const method  = request.method as string;

    // Solo actuar en métodos mutantes
    if (!MUTATING_METHODS.includes(method)) return true;

    // Decorador @SkipLeaveCheck()
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_LEAVE_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    // Rutas exentas
    const path: string = request.path ?? '';
    if (EXEMPT_PATHS.some((re) => re.test(path))) return true;

    // ── Extraer userId del JWT directamente desde el header ──
    // No dependemos de request.user porque el orden de APP_GUARDs
    // no garantiza que JwtAuthGuard haya corrido primero.
    const authHeader: string | undefined = request.headers?.authorization;
    if (!authHeader?.startsWith('Bearer ')) return true;

    const token = authHeader.slice(7);

    let userId: string | undefined;
    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get('JWT_SECRET'),
      });
      userId = payload.sub;
    } catch {
      // Token inválido — JwtAuthGuard ya lo rechazará con 401
      return true;
    }

    if (!userId) return true;

    // Consultar status actual en DB
    const user = await this.prisma.user.findUnique({
      where:  { id: userId },
      select: { status: true },
    });

    if (user?.status === 'ON_LEAVE') {
      throw new ForbiddenException(
        'Tu cuenta está en licencia. No podés realizar cambios hasta que se reactive.',
      );
    }

    return true;
  }
}