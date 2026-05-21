import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Socket } from 'socket.io';
import { AbilityFactory } from '../casl-ability.factory';
import { CHECK_ABILITY_WS_KEY, WsRequiredRule } from '../decorators/check-ability-ws.decorator';
import { RequestUser } from '../../../common/decorators/current-user.decorator';

@Injectable()
export class CaslWsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();
    const user = client.data.user as RequestUser | undefined;
    if (!user) return false;

    const requirements = this.reflector.get<WsRequiredRule[]>(
      CHECK_ABILITY_WS_KEY,
      context.getHandler(),
    );
    if (!requirements || requirements.length === 0) return true;

    const ability = await this.abilityFactory.createForUser(user);

    return requirements.every(({ action, subject }) =>
      ability.can(action, subject),
    );
  }
}
