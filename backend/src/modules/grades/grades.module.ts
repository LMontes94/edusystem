import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { GradesController } from './grades.controller';
import { GradesService } from './grades.service';
import { QUEUES } from '../../queues/queue.constants';
import { StudentCourseSubjectsModule } from '../student-course-subjects/student-course-subjects.module';
import { ClosingGradesModule } from '../closing-grades/closing-grades.module';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUES.NOTIFICATIONS },
      { name: QUEUES.AUDIT },
      { name: QUEUES.GRADES },
    ),StudentCourseSubjectsModule,
    ClosingGradesModule,
  ],
  controllers: [GradesController],
  providers: [GradesService],
  exports: [GradesService], 

})
export class GradesModule {}
