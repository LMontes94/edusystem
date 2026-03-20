import { SetMetadata } from '@nestjs/common';
import { Action, Subjects } from '../casl.types';

// ──────────────────────────────────────────────
// CheckAbility — decorator que declara qué permiso
// requiere un endpoint.
//
// Uso:
//   @CheckAbility({ action: Action.Read, subject: 'Grade' })
//   @UseGuards(JwtAuthGuard, CaslGuard)
//   findAll() { ... }
//
// El CaslGuard lee este metadata y verifica contra
// el AppAbility del usuario autenticado.
// ──────────────────────────────────────────────

export interface RequiredRule {
  action: Action;
  subject: Subjects;
}

export const CHECK_ABILITY_KEY = 'check_ability';

export const CheckAbility = (...rules: RequiredRule[]) =>
  SetMetadata(CHECK_ABILITY_KEY, rules);
