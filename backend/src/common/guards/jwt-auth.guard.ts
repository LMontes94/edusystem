import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

// ──────────────────────────────────────────────
// JwtAuthGuard — guard global aplicado a TODAS
// las rutas de la aplicación.
//
// Si la ruta tiene @Public() → deja pasar sin token.
// Si no tiene @Public() → verifica el JWT con JwtStrategy.
//
// Se registra como guard global en AuthModule,
// no hace falta agregarlo en cada controller.
// ──────────────────────────────────────────────

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Verificar si la ruta está marcada como @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw new UnauthorizedException(
        'Token inválido o expirado. Por favor iniciá sesión nuevamente.',
      );
    }
    return user;
  }
}
