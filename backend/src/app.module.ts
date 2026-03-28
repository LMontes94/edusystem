import {
  MiddlewareConsumer, Module,
  NestModule, RequestMethod,
} from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueuesModule } from './queues/queues.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { InstitutionsModule } from './modules/institutions/institutions.module';
import { CaslModule } from './modules/casl/casl.module';
import { UsersModule } from './modules/users/users.module';
import { StudentsModule } from './modules/students/students.module';
import { CoursesModule } from './modules/courses/courses.module';
import { SubjectsModule } from './modules/subjects/subjects.module';
import { GradesModule } from './modules/grades/grades.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { EnvConfig } from './config/env.schema';
import { StorageModule } from './modules/storage/storage.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    QueuesModule,        

    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig>) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN') },
      }),
    }),

    HealthModule,           // Fase 1
    AuthModule,             // Fase 2
    InstitutionsModule,     // Fase 2
    CaslModule,             // Fase 3
    UsersModule,            // Fase 4
    StudentsModule,         // Fase 4
    CoursesModule,          // Fase 4
    SubjectsModule,         // Fase 4
    GradesModule,           // Fase 5
    AttendanceModule,       // Fase 5
    NotificationsModule,    // Fase 6
    AnnouncementsModule,    // Fase 6
    StorageModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
