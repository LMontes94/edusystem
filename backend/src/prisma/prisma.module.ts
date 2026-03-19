import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// ──────────────────────────────────────────────
// PrismaModule — @Global() para que PrismaService
// esté disponible en toda la app sin importar
// el módulo en cada feature module.
// ──────────────────────────────────────────────

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
