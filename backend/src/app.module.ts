import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { EnvConfig } from './config/env.schema';

// ──────────────────────────────────────────────
// AppModule — módulo raíz.
//
// Fase 1 incluye:
//   • AppConfigModule (env validation)
//   • PrismaModule (DB singleton)
//   • HealthModule (GET /health)
//   • JwtModule (para TenantMiddleware — decode only)
//   • TenantMiddleware aplicado a todas las rutas
//
// En fases siguientes se agregan:
//   • AuthModule, UsersModule, GradesModule, etc.
// ──────────────────────────────────────────────

@Module({
  imports: [
    // Infraestructura
    AppConfigModule,
    PrismaModule,

    // JwtModule asíncrono: lee JWT_SECRET desde ConfigService
    // Lo necesita TenantMiddleware para decodificar tokens
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig>) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN') },
      }),
    }),

    // Feature modules — Fase 1
    HealthModule,

    // Fase 2 → AuthModule, InstitutionsModule
    // Fase 3 → CaslModule
    // Fase 4 → UsersModule, StudentsModule, CoursesModule, SubjectsModule
    // Fase 5 → GradesModule, AttendanceModule
    // Fase 6 → QueuesModule, NotificationsModule, ChatModule, ReportsModule
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // TenantMiddleware en TODAS las rutas
    // No se excluyen rutas públicas aquí —
    // el middleware solo decodifica, no bloquea.
    consumer
      .apply(TenantMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
