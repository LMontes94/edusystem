import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { envSchema } from './env.schema';

// ──────────────────────────────────────────────
// ConfigModule global — disponible en toda la app
// sin necesidad de importarlo en cada módulo.
//
// Al arrancar, valida todas las env vars contra
// el schema Zod. Si algo falla, lanza un error
// con el campo exacto que está mal.
// ──────────────────────────────────────────────

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true, // cachea los valores para no parsear en cada acceso
      validate: (config: Record<string, unknown>) => {
        const result = envSchema.safeParse(config);

        if (!result.success) {
          const errors = result.error.issues
            .map((issue) => `  • ${issue.path.join('.')}: ${issue.message}`)
            .join('\n');

          throw new Error(
            `\n❌ Variables de entorno inválidas:\n${errors}\n\n` +
              `Revisá tu archivo .env o las variables del contenedor.\n`,
          );
        }

        return result.data;
      },
    }),
  ],
})
export class AppConfigModule {}
