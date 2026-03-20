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
import { AuthModule } from './modules/auth/auth.module';
import { InstitutionsModule } from './modules/institutions/institutions.module';
import { CaslModule } from './modules/casl/casl.module';
import { UsersModule } from './modules/users/users.module';
import { StudentsModule } from './modules/students/students.module';
import { CoursesModule } from './modules/courses/courses.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { EnvConfig } from './config/env.schema';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig>) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN') },
      }),
    }),

    HealthModule,         // Fase 1
    AuthModule,           // Fase 2
    InstitutionsModule,   // Fase 2
    CaslModule,           // Fase 3
    UsersModule,          // Fase 4 ← nuevo
    StudentsModule,       // Fase 4 ← nuevo
    CoursesModule,        // Fase 4 ← nuevo
    SubjectsModule,       // Fase 4 ← nuevo

    // Fase 5 → GradesModule, AttendanceModule
    // Fase 6 → QueuesModule, NotificationsModule, ChatModule, ReportsModule
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
