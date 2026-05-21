import { SetMetadata } from '@nestjs/common';
import { Action, Subjects } from '../casl.types';

export interface WsRequiredRule {
  action: Action;
  subject: Subjects;
}

export const CHECK_ABILITY_WS_KEY = 'check_ability_ws';

export const CheckAbilityWs = (...rules: WsRequiredRule[]) =>
  SetMetadata(CHECK_ABILITY_WS_KEY, rules);
