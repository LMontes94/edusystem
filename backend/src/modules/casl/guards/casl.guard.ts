import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AbilityFactory } from '../casl-ability.factory';
import {
  CHECK_ABILITY_KEY,
  RequiredRule,
} from '../decorators/check-ability.decorator';
import { RequestUser } from '../../../common/decorators/current-user.decorator';

// ──────────────────────────────────────────────
// CaslGuard — verifica permisos ABAC en cada request.
//
// Flujo:
//   1. Leer las reglas requeridas del @CheckAbility()
//   2. Si no hay reglas → dejar pasar (solo JwtAuthGuard aplica)
//   3. Construir el AppAbility del usuario autenticado
//   4. Verificar que el usuario puede ejecutar cada acción
//
// Se usa junto con JwtAuthGuard:
//   @UseGuards(JwtAuthGuard, CaslGuard)
//
// O se puede registrar globalmente (después de JwtAuthGuard).
// ──────────────────────────────────────────────

@Injectable()
export class CaslGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Leer reglas declaradas con @CheckAbility()
    const rules = this.reflector.getAllAndOverride<RequiredRule[]>(
      CHECK_ABILITY_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Sin reglas → solo requiere estar autenticado (JwtAuthGuard ya lo verificó)
    if (!rules || rules.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: RequestUser = request.user;

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // Construir ability del usuario
    const ability = await this.abilityFactory.createForUser(user);

    // Verificar cada regla requerida
    for (const rule of rules) {
      if (!ability.can(rule.action, rule.subject)) {
        throw new ForbiddenException(
          `No tenés permiso para ${rule.action} en ${String(rule.subject)}`,
        );
      }
    }

    return true;
  }
}
