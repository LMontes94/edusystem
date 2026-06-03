import { Module } from '@nestjs/common';
import { TeacherController } from './teacher.controller';
import { TeacherService } from './teacher.service';
import { PendingSubjectsModule } from '../pending-subjects/pending-subjects.module';

@Module({
  imports:     [PendingSubjectsModule],
  controllers: [TeacherController],
  providers:   [TeacherService],
  exports:     [TeacherService],
})
export class TeacherModule {}