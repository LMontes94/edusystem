import { Global, Module } from '@nestjs/common';
import { AbilityFactory } from './casl-ability.factory';
import { CaslGuard } from './guards/casl.guard';

// ──────────────────────────────────────────────
// CaslModule — @Global() para que AbilityFactory
// y CaslGuard estén disponibles en toda la app
// sin necesidad de importar el módulo en cada feature.
// ──────────────────────────────────────────────

@Global()
@Module({
  providers: [AbilityFactory, CaslGuard],
  exports: [AbilityFactory, CaslGuard],
})
export class CaslModule {}
