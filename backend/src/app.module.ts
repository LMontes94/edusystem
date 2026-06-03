import {
  MiddlewareConsumer, Module,
  NestModule, RequestMethod,
} from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD }     from '@nestjs/core';
import { OnLeaveGuard }  from './common/guards/on-leave.guard';

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
import { ReportsModule } from './modules/reports/reports.module';
import { IndicatorsModule } from './modules/indicators/indicators.module';
import { TeacherModule } from './modules/teacher/teacher.module';
import { ConvivenciasModule } from './modules/convivencias/convivencias.module';
import { SpacesModule } from './modules/spaces/spaces.module';
import { SpaceReservationsModule } from './modules/space-reservations/space-reservations.module';
import { SportsModule }      from './modules/sports/sports.module';
import { SportGroupsModule } from './modules/sport-groups/sport-groups.module';
import { StudentCourseSubjectsModule } from './modules/student-course-subjects/student-course-subjects.module';
import { ChatModule } from './modules/chat/chat.module';
import { GuardiansModule } from './modules/guardians/guardians.module';
import { ClosingGradesModule } from './modules/closing-grades/closing-grades.module';
import { PendingSubjectsModule } from './modules/pending-subjects/pending-subjects.module';


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

    HealthModule,           
    AuthModule,             
    InstitutionsModule,     
    CaslModule,             
    UsersModule,            
    StudentsModule,         
    CoursesModule,          
    SubjectsModule,         
    GradesModule,           
    AttendanceModule,       
    NotificationsModule,    
    AnnouncementsModule,    
    StorageModule,
    ReportsModule,
    IndicatorsModule,
    TeacherModule,
    ConvivenciasModule,
    SpacesModule,
    SpaceReservationsModule,
    SportsModule,
    SportGroupsModule,
    StudentCourseSubjectsModule,
    ChatModule,
    GuardiansModule,
    ClosingGradesModule,
    PendingSubjectsModule,
  ],
  providers:[
    {
       provide:  APP_GUARD,
       useClass: OnLeaveGuard,
    },
  ],
})

export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
